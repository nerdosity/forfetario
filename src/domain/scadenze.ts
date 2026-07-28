import type { CalcoloInput, ComponenteScadenza, OpzioniRateazione, Regime, Scadenza, RiferimentoScadenza, TipoVersamento } from '@/domain/types'
import { datiDellAnno } from '@/domain/types'
import { datiAnno, anniDisponibili, type ScadenzeAnno } from '@/data/taxData'
import { proiettaDatiAnno } from '@/data/proiezioneAnno'
import { calcolaRateContributiFissi, applicaRiduzioneIVS, baseEccedenzaAcconto } from '@/domain/contributi'
import { espandiRateazione } from '@/domain/rateazione'
import { formattaScadenza } from '@/domain/dates'
import { labelTipo } from '@/domain/labels'

const annoEsisteNelDatabase = (anno: number) => anniDisponibili().includes(anno)

const SOGLIA_ACCONTO = 257 // soglia minima per generare acconti
const QUOTA_ACCONTO_IMPOSTE = 0.5
const QUOTA_ACCONTO_GS = 0.8
const QUOTA_ACCONTO_ECC = 0.5

const regimiConFissi = (regimi: Regime[]) =>
  regimi.filter((r) => r.tipo === 'artigiani' || r.tipo === 'commercianti')

/**
 * Spezza un acconto totale in due rate al centesimo come il calcolatore INPS:
 * 1ª rata arrotondata per difetto (floor a 2 decimali), 2ª rata = totale - 1ª
 * (così la somma è esatta). Es. 2456,53 → [1228,26, 1228,27].
 */
const rateAcconto = (totale: number): [number, number] => {
  const r1 = Math.floor((totale / 2) * 100) / 100
  const r2 = Math.round((totale - r1) * 100) / 100
  return [r1, r2]
}

// Etichette estese e leggibili per le scadenze (niente abbreviazioni stipate).
const ORDINALE = ['', '1°', '2°', '3°', '4°']
const ORDINALE_RATA = ['', '1ª', '2ª', '3ª', '4ª']
const accontoLabel = (n: number) => `${ORDINALE[n]} acconto`

const regimiSeparata = (regimi: Regime[]) =>
  regimi.filter((r) => r.tipo === 'separata')

const attivoADicembre = (regimi: Regime[]) =>
  regimi.some((r) => r.meseFine === 12)

interface ParamsScadenze {
  anno: number
  regimiCorrente: Regime[]
  /** Periodi dell'anno precedente: per la 4ª rata fissi che si versa a febbraio. */
  regimiPrecedente: Regime[]
  // saldi anno corrente
  saldoImposteDaVersare: number
  saldoContributiGS: number
  saldoContributiEccArtComm: number
  // dettaglio per documentare il saldo (dovuto - acconti già versati nell'anno)
  totaleContributiSeparataDovutoCorrente?: number
  accontiGSVersatiNelCorrente?: number
  totaleContributiEccArtCommDovutoCorrente?: number
  accontiEccVersatiNelCorrente?: number
  /**
   * Input utente: serve a calcolare il conguaglio (versato vs dovuto di cassa
   * della competenza, per gestione) e a marcare le scadenze già pagate.
   */
  input?: CalcoloInput
  // imposta anno corrente (base per l'acconto imposte anno+1)
  totaleImposteCorrente: number
  // imposte anno precedente (base per gli acconti anno corrente)
  totaleImpostePrecedente: number
  accontiImposteVersatiPerAnnoPrecedente: number
  /**
   * Contributi DOVUTI dell'anno precedente, importo pieno: base ufficiale degli
   * acconti dell'anno corrente (metodo ADE/INPS), che non si netta degli acconti.
   */
  totaleContributiSeparataPrecedente: number
  totaleContributiEccedenzaArtCommPrecedente: number
  /**
   * Saldi contributi dell'anno precedente al NETTO degli acconti dovuti per
   * quell'anno: è l'importo che si versa davvero a giugno dell'anno corrente.
   * Se assenti si ricade sul dovuto pieno (compatibilità con chiamate parziali).
   */
  saldoContributiGSPrecedente?: number
  saldoContributiEccArtCommPrecedente?: number
  /** Acconti dovuti per l'anno precedente, per documentare i saldi qui sopra. */
  accontiGSDovutiPerPrecedente?: number
  accontiEccDovutiPerPrecedente?: number
  /** Scelte di rateazione dei versamenti rateizzabili (imposte e contributi), per chiave. */
  rateazioniImposta?: Record<string, OpzioniRateazione>
}

export interface RisultatoScadenze {
  scadenzeAnnoCorrente: Scadenza[]
  scadenzeAnnoSuccessivo: Scadenza[]
}

/**
 * Importo complessivamente versato a fronte di una scadenza, sommando i
 * versamenti collegati ai suoi riferimenti. I riferimenti 'imposta-*' guardano
 * i campi acconti imposta; gli altri le righe tipizzate della lista contributi.
 * Restituisce null se la scadenza non è tracciabile (nessun riferimento, es.
 * scadenze future i cui versamenti non sono ancora stati inseriti).
 */
export function versatoPerScadenza(scadenza: Scadenza, input: CalcoloInput): number | null {
  const rif = scadenza.riferimenti
  if (!rif || rif.length === 0) return null

  // Una scadenza si paga nell'anno SOLARE in cui cade (scadenza.annoScadenza):
  // i suoi versamenti stanno in anni[annoScadenza]. Così i pagamenti seguono
  // sempre l'anno giusto, senza distinzioni corrente/successivo.
  const dati = datiDellAnno(input, scadenza.annoScadenza)

  const importoVoce = (tipo: TipoVersamento): number =>
    dati.modalitaContributi === 'dettaglio'
      ? dati.contributiVersati
          .filter((r) => r.tipo === tipo)
          .reduce((s, r) => s + (r.importo ?? 0), 0)
      : 0

  return rif.reduce((tot, r) => {
    if (r === 'imposta-saldo') return tot + (dati.impostaSaldoVersato ?? 0)
    if (r === 'imposta-acconto1') return tot + (dati.impostaAcconto1Versato ?? 0)
    if (r === 'imposta-acconto2') return tot + (dati.impostaAcconto2Versato ?? 0)
    return tot + importoVoce(r)
  }, 0)
}

/**
 * Tolleranza sul "pagato": i contributi al modello F24 si versano arrotondati
 * all'euro, quindi una differenza fino a ~1 € (arrotondamento) NON significa
 * scadenza non saldata.
 */
const TOLLERANZA_PAGAMENTO = 1.0

/** Vero se la scadenza risulta saldata (versato ≥ dovuto, a meno dell'arrotondamento).
 * Se è presente un importoConsigliato (conguaglio), è sufficiente aver versato almeno quello. */
export function scadenzaPagata(scadenza: Scadenza, input: CalcoloInput): boolean {
  const versato = versatoPerScadenza(scadenza, input)
  if (versato == null || scadenza.importo <= 0.005) return false
  const soglia = scadenza.importoConsigliato != null
    ? Math.min(scadenza.importoConsigliato, scadenza.importo)
    : scadenza.importo
  return versato >= soglia - TOLLERANZA_PAGAMENTO
}

/** Categoria di una scadenza ai fini del bilancio per gestione. */
type CategoriaBilancio = 'imposte' | 'gs' | 'artComm'

/** Classifica la scadenza per gestione: imposte, gestione separata o artigiani/commercianti. */
function categoriaBilancio(s: Scadenza): CategoriaBilancio {
  const rif = s.riferimenti ?? []
  if (rif.some((r) => r.startsWith('imposta-'))) return 'imposte'
  if (rif.some((r) => r.startsWith('gs-'))) return 'gs'
  return 'artComm'
}

export interface BilancioCategoria {
  /** Totale dovuto sulle scadenze tracciabili (con versamento collegato). */
  dovuto: number
  /** Totale effettivamente versato. */
  pagato: number
  /** pagato - dovuto: positivo = versato in più, negativo = in meno. */
  saldo: number
}

export interface BilancioAnno {
  /** Contributi artigiani/commercianti (fissi + eccedenza). */
  artComm: BilancioCategoria
  /** Contributi gestione separata. */
  gs: BilancioCategoria
  /** Imposta sostitutiva. */
  imposte: BilancioCategoria
}

/**
 * Bilancio dei pagamenti di un anno: confronta dovuto e pagato separando i
 * contributi per GESTIONE (artigiani/commercianti, gestione separata) e le
 * imposte. Tenere le gestioni distinte è coerente con il conguaglio INPS, che
 * si applica per gestione senza mischiarle. Considera solo le scadenze
 * TRACCIABILI (con un versamento collegato); le altre sono escluse.
 */
export function bilancioPagamenti(scadenze: Scadenza[], input: CalcoloInput): BilancioAnno {
  const vuoto = (): BilancioCategoria => ({ dovuto: 0, pagato: 0, saldo: 0 })
  const cat: Record<CategoriaBilancio, BilancioCategoria> = {
    artComm: vuoto(),
    gs: vuoto(),
    imposte: vuoto(),
  }

  for (const s of scadenze) {
    const versato = versatoPerScadenza(s, input)
    if (versato == null) continue // non tracciabile → fuori dal bilancio
    const c = cat[categoriaBilancio(s)]
    c.dovuto += s.importo
    c.pagato += versato
  }
  for (const c of Object.values(cat)) c.saldo = c.pagato - c.dovuto
  return cat
}

/**
 * Costruisce il calendario fiscale completo:
 * - Scadenze nell'anno di riferimento (rate fissi correnti + saldo/acconti basati sull'anno precedente)
 * - Scadenze nell'anno successivo (ultima rata fissi correnti + saldo/acconti basati sull'anno corrente
 *   + prime 3 rate fissi dell'anno successivo se il regime continua)
 */
export function calcolaScadenze({
  anno,
  regimiCorrente,
  regimiPrecedente,
  saldoImposteDaVersare,
  saldoContributiGS,
  saldoContributiEccArtComm,
  totaleImposteCorrente,
  totaleImpostePrecedente,
  accontiImposteVersatiPerAnnoPrecedente,
  totaleContributiSeparataPrecedente,
  totaleContributiEccedenzaArtCommPrecedente,
  saldoContributiGSPrecedente,
  saldoContributiEccArtCommPrecedente,
  accontiGSDovutiPerPrecedente,
  accontiEccDovutiPerPrecedente,
  totaleContributiSeparataDovutoCorrente,
  accontiGSVersatiNelCorrente,
  totaleContributiEccArtCommDovutoCorrente,
  accontiEccVersatiNelCorrente,
  input,
  rateazioniImposta,
}: ParamsScadenze): RisultatoScadenze {
  const globali: Scadenza[] = []
  const annoSucc = anno + 1
  const annoPrec = anno - 1

  /**
   * Componenti che documentano un saldo a conguaglio: dovuto totale dell'anno di
   * COMPETENZA meno gli acconti già versati durante quell'anno. Se i dati di
   * dettaglio non ci sono (o gli acconti sono nulli) si ricade su una voce
   * singola. `annoCompetenza` distingue il saldo dell'anno corrente (che si versa
   * l'anno dopo) da quello dell'anno precedente (che si versa quest'anno).
   */
  const componentiSaldo = (
    etichetta: string,
    saldo: number,
    dovuto: number | undefined,
    acconti: number | undefined,
    annoCompetenza: number,
  ): ComponenteScadenza[] => {
    if (dovuto == null || acconti == null || acconti <= 0.005) {
      return [{ tipo: etichetta, importo: saldo }]
    }
    return [
      { tipo: `Totale dovuto ${annoCompetenza}`, importo: dovuto },
      { tipo: 'Acconti già versati nell\'anno', importo: -acconti },
    ]
  }

  /**
   * Applica a una scadenza di saldo contributi l'eventuale credito della stessa
   * gestione INPS maturato l'anno corrente. Imposta importoConsigliato (può
   * essere negativo = credito residuo) e una nota; lascia invariato l'importo
   * dovuto ufficiale. Restituisce la scadenza (eventualmente arricchita).
   */
  const conConguaglioGestione = (s: Scadenza, credito: number | undefined): Scadenza => {
    if (!credito || credito <= 0.005) return s
    const consigliato = s.importo - credito
    return {
      ...s,
      importoConsigliato: consigliato,
      notaConsigliato:
        consigliato >= 0
          ? `Su questa gestione hai versato in totale ${credito.toFixed(2)} € in più del dovuto ` +
            `(differenza netta tra rate pagate in più e in meno): puoi versare ${consigliato.toFixed(2)} € ` +
            `invece di ${s.importo.toFixed(2)} €.`
          : `Su questa gestione hai versato in totale ${credito.toFixed(2)} € in più del dovuto: ` +
            `coprono l'intero saldo e resta un credito di ${(-consigliato).toFixed(2)} € da compensare ` +
            `sui versamenti successivi della stessa gestione.`,
    }
  }

  /**
   * Applica il credito di conguaglio alla PRIMA scadenza sul reddito non ancora
   * pagata, in ordine: saldo → 1° acconto → 2° acconto. Le rate già pagate sono
   * saltate (il loro conguaglio andrà sul saldo dell'anno dopo). Restituisce le
   * scadenze, con il consigliato impostato su quella scelta. `input` può mancare
   * (nessun dato pagamenti): in tal caso il credito va sul saldo (la prima).
   */
  const applicaCreditoPrimaNonPagata = (scadenzeOrdinate: Scadenza[], credito: number): Scadenza[] => {
    if (credito <= 0.005) return scadenzeOrdinate
    const idx = input
      ? scadenzeOrdinate.findIndex((s) => !scadenzaPagata(s, input))
      : 0
    const target = idx < 0 ? -1 : idx
    return scadenzeOrdinate.map((s, i) => (i === target ? conConguaglioGestione(s, credito) : s))
  }

  // Base acconto eccedenza col metodo INPS: reddito di gestione annuo aggregato,
  // minimale pieno, costanti dell'anno in cui l'acconto si versa (contributi.ts).
  // La G.S. invece usa il DOVUTO dell'anno precedente (regola ADE dell'80%).
  const baseAccontoEcc = baseEccedenzaAcconto

  // Espande una scadenza rateizzabile (imposta o contributi) nelle sue rate,
  // se l'utente ha scelto una rateazione per la sua chiave; altrimenti la
  // lascia invariata.
  const espandi = (s: Scadenza): Scadenza[] => {
    const opzioni = s.chiaveRateazione ? rateazioniImposta?.[s.chiaveRateazione] : undefined
    return opzioni ? espandiRateazione(s, opzioni) : [s]
  }
  const pushRateizzabile = (s: Scadenza) => globali.push(...espandi(s))

  /**
   * Date di scadenza dell'anno indicato. Ogni scadenza usa le date del PROPRIO
   * anno di competenza (non dell'anno selezionato). Se l'anno non è nel database
   * si proietta; in ultima istanza si ricade sulle date dell'anno corrente.
   */
  const dateAnno = (a: number): ScadenzeAnno =>
    annoEsisteNelDatabase(a)
      ? datiAnno(a).scadenze
      : proiettaDatiAnno(a)?.scadenze ?? datiAnno(anno).scadenze

  // Date dei due anni in gioco: ogni scadenza usa quelle del suo anno.
  const dCorr = dateAnno(anno)
  const dSucc = dateAnno(annoSucc)

  const fissiCorrenti = regimiConFissi(regimiCorrente)

  // Riferimento al versamento per la rata fissi, in base al trimestre.
  // La 4ª rata (annoOffset → annoSucc) si paga l'anno dopo come 'fissi-4-prec'.
  const rifRataFissi = (idxTrim: number): RiferimentoScadenza | undefined =>
    (['fissi-1', 'fissi-2', 'fissi-3', 'fissi-4-prec'] as const)[idxTrim]

  // ─── 4ª rata fissi dell'anno PRECEDENTE: si versa a febbraio dell'anno corrente ──
  for (const regime of regimiConFissi(regimiPrecedente)) {
    for (const rata of calcolaRateContributiFissi(regime, annoPrec).rate) {
      if (rata.anno === anno && rata.rataIdx === 3) {
        globali.push({
          data: rata.data,
          descrizione: `Contributi fissi ${labelTipo(regime.tipo)} ${annoPrec} (4ª rata)`,
          categoria: `Contributi fissi ${labelTipo(regime.tipo).toLowerCase()}`,
          voce: `4ª rata trimestrale · competenza ${annoPrec}`,
          importo: rata.importo,
          componenti: [{ tipo: `Rata contributi fissi ${labelTipo(regime.tipo)} ${annoPrec}`, importo: rata.importo }],
          annoScadenza: anno,
          riferimenti: ['fissi-4-prec'],
        })
      }
    }
  }

  // ─── Rate fissi 1ª-3ª che cadono nell'anno corrente ────────────────────────
  for (const regime of fissiCorrenti) {
    for (const rata of calcolaRateContributiFissi(regime, anno).rate) {
      if (rata.anno === anno) {
        globali.push({
          data: rata.data,
          descrizione: rata.descrizione,
          categoria: `Contributi fissi ${labelTipo(regime.tipo).toLowerCase()}`,
          voce: `${ORDINALE_RATA[rata.rataIdx + 1]} rata trimestrale · competenza ${anno}`,
          importo: rata.importo,
          componenti: [{ tipo: `Rata contributi fissi ${labelTipo(regime.tipo)} ${anno}`, importo: rata.importo }],
          annoScadenza: anno,
          riferimenti: [rifRataFissi(rata.rataIdx)].filter(Boolean) as RiferimentoScadenza[],
        })
      }
    }
  }

  // ─── Saldo contributi G.S. anno precedente (versato a giugno anno corrente) ──
  // Importo NETTO: dovuto di N-1 meno gli acconti dovuti per N-1 (stessa regola
  // del saldo dell'anno corrente). Se il netto è ≤ 0 gli acconti coprono già
  // tutto e la scadenza non si emette.
  const saldoGSPrec = saldoContributiGSPrecedente ?? totaleContributiSeparataPrecedente
  if (saldoGSPrec > 0.005) {
    pushRateizzabile({
      data: formattaScadenza(dCorr.saldoContributi, anno),
      descrizione: `Saldo contributi Gestione separata ${annoPrec}`,
      categoria: 'Contributi Gestione separata',
      voce: `Saldo · competenza ${annoPrec}`,
      importo: saldoGSPrec,
      componenti: componentiSaldo(
        `Saldo contributi G.S. ${annoPrec}`,
        saldoGSPrec,
        totaleContributiSeparataPrecedente,
        accontiGSDovutiPerPrecedente,
        annoPrec,
      ),
      annoScadenza: anno,
      riferimenti: ['gs-saldo'],
      chiaveRateazione: `gs-saldo-${annoPrec}`,
    })
  }

  // ─── Saldo contributi eccedenza Art/Comm anno precedente (giugno anno corr.) ──
  const saldoEccPrec =
    saldoContributiEccArtCommPrecedente ?? totaleContributiEccedenzaArtCommPrecedente
  if (saldoEccPrec > 0.005) {
    pushRateizzabile({
      data: formattaScadenza(dCorr.saldoContributi, anno),
      descrizione: `Saldo contributi eccedenza artigiani/commercianti ${annoPrec}`,
      categoria: 'Contributi eccedenza artigiani/commercianti',
      voce: `Saldo · competenza ${annoPrec}`,
      importo: saldoEccPrec,
      componenti: componentiSaldo(
        `Saldo contributi ecc. Art/Comm ${annoPrec}`,
        saldoEccPrec,
        totaleContributiEccedenzaArtCommPrecedente,
        accontiEccDovutiPerPrecedente,
        annoPrec,
      ),
      annoScadenza: anno,
      riferimenti: ['ecc-saldo'],
      chiaveRateazione: `ecc-saldo-${annoPrec}`,
    })
  }

  // ─── Acconti contributi per l'anno corrente (1° giugno, 2° novembre) ──────
  // Basati sui contributi dovuti dell'anno precedente, solo se ancora attivi.
  // Base ufficiale ADE: il contributo G.S. DOVUTO dell'anno precedente (quadro RR),
  // con le costanti di quell'anno; l'acconto è l'80% in due rate del 40%.
  const baseGSCorr = totaleContributiSeparataPrecedente ?? 0
  const accontoGSCorrTot =
    attivoADicembre(regimiSeparata(regimiCorrente)) && baseGSCorr > 0
      ? baseGSCorr * QUOTA_ACCONTO_GS
      : 0
  if (accontoGSCorrTot > 0.005) {
    const [r1, r2] = rateAcconto(accontoGSCorrTot)
    pushRateizzabile({
      data: formattaScadenza(dCorr.primoAccontoContributi, anno),
      descrizione: `1° acconto contributi Gestione separata ${anno}`,
      categoria: 'Contributi Gestione separata',
      voce: `${accontoLabel(1)} · competenza ${anno}`,
      importo: r1,
      componenti: [{ tipo: `1° acconto contributi G.S. ${anno}`, importo: r1 }],
      annoScadenza: anno,
      riferimenti: ['gs-acconto-1'],
      chiaveRateazione: `gs-acconto1-${anno}`,
    })
    globali.push({
      data: formattaScadenza(dCorr.secondoAccontoContributi, anno),
      descrizione: `2° acconto contributi Gestione separata ${anno}`,
      categoria: 'Contributi Gestione separata',
      voce: `${accontoLabel(2)} · competenza ${anno}`,
      importo: r2,
      componenti: [{ tipo: `2° acconto contributi G.S. ${anno}`, importo: r2 }],
      annoScadenza: anno,
      riferimenti: ['gs-acconto-2'],
    })
  }

  // Acconto eccedenza: 100% del dovuto, spezzato in due rate al centesimo (1ª per
  // difetto, 2ª = resto) come fa il calcolatore INPS. Base: eccedenza sui redditi
  // dell'anno prima, costanti dell'anno corrente.
  const baseEccCorr = baseAccontoEcc(regimiPrecedente, anno)
  const accontoEccCorrTot =
    attivoADicembre(regimiConFissi(regimiCorrente)) && baseEccCorr > 0
      ? baseEccCorr * (QUOTA_ACCONTO_ECC * 2)
      : 0
  const [eccR1, eccR2] = rateAcconto(accontoEccCorrTot)
  if (accontoEccCorrTot > 0.005) {
    pushRateizzabile({
      data: formattaScadenza(dCorr.primoAccontoContributi, anno),
      descrizione: `1° acconto contributi eccedenza artigiani/commercianti ${anno}`,
      categoria: 'Contributi eccedenza artigiani/commercianti',
      voce: `${accontoLabel(1)} · competenza ${anno}`,
      importo: eccR1,
      componenti: [{ tipo: `1° acconto contributi ecc. Art/Comm ${anno}`, importo: eccR1 }],
      annoScadenza: anno,
      riferimenti: ['ecc-acconto-1'],
      chiaveRateazione: `ecc-acconto1-${anno}`,
    })
    globali.push({
      data: formattaScadenza(dCorr.secondoAccontoContributi, anno),
      descrizione: `2° acconto contributi eccedenza artigiani/commercianti ${anno}`,
      categoria: 'Contributi eccedenza artigiani/commercianti',
      voce: `${accontoLabel(2)} · competenza ${anno}`,
      importo: eccR2,
      componenti: [{ tipo: `2° acconto contributi ecc. Art/Comm ${anno}`, importo: eccR2 }],
      annoScadenza: anno,
      riferimenti: ['ecc-acconto-2'],
    })
  }

  // ─── Conguaglio per gestione: NETTO (versato - dovuto) sulle rate obbligatorie ─
  // Il saldo è il punto in cui si scontano le differenze (in più e in meno) pagate
  // sulle altre rate della STESSA gestione. Si considerano tutte le rate
  // obbligatorie GIÀ VERSATE durante l'anno di riferimento e l'anno successivo
  // (anni solari di pagamento), di qualsiasi competenza: es. +1200 su una rata e
  // -200 su un'altra → credito netto 1000 da scontare sul saldo. Le tre gestioni
  // (artigiani/commercianti = IVS art/comm, gestione separata) restano SEPARATE.
  // Solo le rate effettivamente versate entrano (versato > 0): una rata non ancora
  // pagata non genera un "-dovuto" fittizio. Questo esclude automaticamente il
  // saldo a cui si applica il conguaglio (non ancora pagato), ma include un saldo
  // di competenza precedente già versato nell'anno (è una rata obbligatoria pagata).
  const rifEcc: RiferimentoScadenza[] = ['fissi-1', 'fissi-2', 'fissi-3', 'fissi-4-prec', 'ecc-saldo', 'ecc-acconto-1', 'ecc-acconto-2']
  const rifGs: RiferimentoScadenza[] = ['gs-saldo', 'gs-acconto-1', 'gs-acconto-2']
  const isRif = (s: Scadenza, set: RiferimentoScadenza[]) =>
    (s.riferimenti ?? []).some((r) => set.includes(r))

  const nettoGestione = (set: RiferimentoScadenza[]): number => {
    if (!input) return 0
    const tot = globali
      .filter((s) => (s.annoScadenza === anno || s.annoScadenza === annoSucc) && isRif(s, set))
      .reduce((acc, s) => {
        const versato = versatoPerScadenza(s, input)
        // Conta solo le rate effettivamente versate (versato > 0).
        if (versato == null || versato <= 0.005) return acc
        return acc + (versato - s.importo)
      }, 0)
    return Math.max(0, tot)
  }
  // NB: i crediti si calcolano più in basso, DOPO che tutte le rate obbligatorie
  // dell'anno successivo (es. 4ª rata fissi competenza corrente, versata a febbraio
  // dell'anno+1) sono state aggiunte a `globali`, così entrano nel netto.

  // ─── Saldo imposte anno precedente + 1° acconto imposte anno corrente ──────
  const saldoImpostePrecedente = Math.max(
    0,
    totaleImpostePrecedente - (accontiImposteVersatiPerAnnoPrecedente ?? 0),
  )
  const accontoImposteAnnoCorrente =
    totaleImpostePrecedente > SOGLIA_ACCONTO ? totaleImpostePrecedente * QUOTA_ACCONTO_IMPOSTE : 0

  // Saldo e 1° acconto cadono lo stesso giorno ma sono due versamenti distinti
  if (saldoImpostePrecedente > 0) {
    pushRateizzabile({
      data: formattaScadenza(dCorr.saldoImposte, anno),
      descrizione: `Saldo imposta sostitutiva ${anno - 1}`,
      categoria: 'Imposta sostitutiva',
      voce: `Saldo · competenza ${anno - 1}`,
      importo: saldoImpostePrecedente,
      componenti: [{ tipo: `Saldo imposte ${anno - 1}`, importo: saldoImpostePrecedente }],
      annoScadenza: anno,
      riferimenti: ['imposta-saldo'],
      chiaveRateazione: `saldo-${anno - 1}`,
    })
  }
  if (accontoImposteAnnoCorrente > 0) {
    pushRateizzabile({
      data: formattaScadenza(dCorr.primoAccontoImposte, anno),
      descrizione: `1° acconto imposta sostitutiva ${anno}`,
      categoria: 'Imposta sostitutiva',
      voce: `${accontoLabel(1)} · competenza ${anno}`,
      importo: accontoImposteAnnoCorrente,
      componenti: [{ tipo: `1° acconto imposte ${anno} (su tax netta ${anno - 1})`, importo: accontoImposteAnnoCorrente }],
      annoScadenza: anno,
      riferimenti: ['imposta-acconto1'],
      chiaveRateazione: `acconto1-${anno}`,
    })
  }
  if (accontoImposteAnnoCorrente > 0) {
    globali.push({
      data: formattaScadenza(dCorr.secondoAccontoImposte, anno),
      descrizione: `2° acconto imposta sostitutiva ${anno}`,
      categoria: 'Imposta sostitutiva',
      voce: `${accontoLabel(2)} · competenza ${anno}`,
      importo: accontoImposteAnnoCorrente,
      componenti: [{ tipo: `2° acconto imposte ${anno} (su tax netta ${anno - 1})`, importo: accontoImposteAnnoCorrente }],
      annoScadenza: anno,
      riferimenti: ['imposta-acconto2'],
    })
  }
  // ─── Ultima rata contributi fissi correnti (cade nell'anno+1) ─────────────
  // Si versa nell'anno+1: il collegamento al pagamento usa 'fissi-4-prec' (nel
  // contesto dell'anno+1 è la 4ª rata della competenza precedente).
  for (const regime of fissiCorrenti) {
    for (const rata of calcolaRateContributiFissi(regime, anno).rate) {
      if (rata.anno === annoSucc) {
        globali.push({
          data: rata.data,
          descrizione: rata.descrizione,
          categoria: `Contributi fissi ${labelTipo(regime.tipo).toLowerCase()}`,
          voce: `4ª rata trimestrale · competenza ${anno}`,
          importo: rata.importo,
          componenti: [{ tipo: `Rata contributi fissi ${labelTipo(regime.tipo)} ${anno}`, importo: rata.importo }],
          annoScadenza: annoSucc,
          riferimenti: ['fissi-4-prec'],
        })
      }
    }
  }

  // ─── Saldo imposte anno corrente + 1° acconto imposte anno+1 ──────────────
  const accontoImposteAnnoSucc =
    totaleImposteCorrente > SOGLIA_ACCONTO ? totaleImposteCorrente * QUOTA_ACCONTO_IMPOSTE : 0

  // Saldo e 1° acconto: righe separate (le date possono divergere)
  if (saldoImposteDaVersare > 0) {
    pushRateizzabile({
      data: formattaScadenza(dSucc.saldoImposte, annoSucc),
      descrizione: `Saldo imposta sostitutiva ${anno}`,
      categoria: 'Imposta sostitutiva',
      voce: `Saldo · competenza ${anno}`,
      importo: saldoImposteDaVersare,
      componenti: [{ tipo: `Saldo imposte ${anno}`, importo: saldoImposteDaVersare }],
      annoScadenza: annoSucc,
      chiaveRateazione: `saldo-${anno}`,
    })
  }
  if (accontoImposteAnnoSucc > 0) {
    pushRateizzabile({
      data: formattaScadenza(dSucc.primoAccontoImposte, annoSucc),
      descrizione: `1° acconto imposta sostitutiva ${annoSucc}`,
      categoria: 'Imposta sostitutiva',
      voce: `${accontoLabel(1)} · competenza ${annoSucc}`,
      importo: accontoImposteAnnoSucc,
      componenti: [{ tipo: `1° acconto imposte ${annoSucc} (su tax ${anno})`, importo: accontoImposteAnnoSucc }],
      annoScadenza: annoSucc,
      chiaveRateazione: `acconto1-${annoSucc}`,
    })
  }
  if (accontoImposteAnnoSucc > 0) {
    globali.push({
      data: formattaScadenza(dSucc.secondoAccontoImposte, annoSucc),
      descrizione: `2° acconto imposta sostitutiva ${annoSucc}`,
      categoria: 'Imposta sostitutiva',
      voce: `${accontoLabel(2)} · competenza ${annoSucc}`,
      importo: accontoImposteAnnoSucc,
      componenti: [{ tipo: `2° acconto imposte ${annoSucc} (su tax ${anno})`, importo: accontoImposteAnnoSucc }],
      annoScadenza: annoSucc,
    })
  }

  // Crediti di conguaglio per gestione: calcolati ORA, dopo che TUTTE le rate
  // obbligatorie dell'anno corrente e successivo (incluse fissi 1ª-3ª annoSucc e
  // la 4ª rata competenza corrente versata a febbraio annoSucc) sono in `globali`.
  const creditoGestioneArtComm = nettoGestione(rifEcc)
  const creditoGestioneGS = nettoGestione(rifGs)

  // ─── Saldo + acconti Gestione Separata ────────────────────────────────────
  // Acconto anno+1: 80% del contributo G.S. DOVUTO dell'anno corrente (quadro RR),
  // come fa il software ADE.
  const baseGSSucc = totaleContributiSeparataDovutoCorrente ?? 0
  const accontoGSAnnoSuccTot =
    attivoADicembre(regimiSeparata(regimiCorrente)) && baseGSSucc > 0
      ? baseGSSucc * QUOTA_ACCONTO_GS
      : 0
  const [gsSuccR1, gsSuccR2] = rateAcconto(accontoGSAnnoSuccTot)

  // Scadenze sul reddito (G.S.) dell'anno successivo, in ordine: saldo → acconti.
  const scadenzeGSSucc: Scadenza[] = []
  if (saldoContributiGS > 0) {
    scadenzeGSSucc.push({
      data: formattaScadenza(dSucc.saldoContributi, annoSucc),
      descrizione: `Saldo contributi Gestione separata ${anno}`,
      categoria: 'Contributi Gestione separata',
      voce: `Saldo · competenza ${anno}`,
      importo: saldoContributiGS,
      componenti: componentiSaldo(
        `Saldo contributi G.S. ${anno}`,
        saldoContributiGS,
        totaleContributiSeparataDovutoCorrente,
        accontiGSVersatiNelCorrente,
        anno,
      ),
      annoScadenza: annoSucc,
      riferimenti: ['gs-saldo'],
      chiaveRateazione: `gs-saldo-${anno}`,
    })
  }
  if (accontoGSAnnoSuccTot > 0) {
    scadenzeGSSucc.push({
      data: formattaScadenza(dSucc.primoAccontoContributi, annoSucc),
      descrizione: `1° acconto contributi Gestione separata ${annoSucc}`,
      categoria: 'Contributi Gestione separata',
      voce: `${accontoLabel(1)} · competenza ${annoSucc}`,
      importo: gsSuccR1,
      componenti: [{ tipo: `1° acconto contributi G.S. ${annoSucc} (su contr. G.S. ${anno})`, importo: gsSuccR1 }],
      annoScadenza: annoSucc,
      riferimenti: ['gs-acconto-1'],
      chiaveRateazione: `gs-acconto1-${annoSucc}`,
    })
    scadenzeGSSucc.push({
      data: formattaScadenza(dSucc.secondoAccontoContributi, annoSucc),
      descrizione: `2° acconto contributi Gestione separata ${annoSucc}`,
      categoria: 'Contributi Gestione separata',
      voce: `${accontoLabel(2)} · competenza ${annoSucc}`,
      importo: gsSuccR2,
      componenti: [{ tipo: `2° acconto contributi G.S. ${annoSucc} (su contr. G.S. ${anno})`, importo: gsSuccR2 }],
      annoScadenza: annoSucc,
      riferimenti: ['gs-acconto-2'],
    })
  }
  // Le rate del piano si generano DOPO il conguaglio (che si applica alla
  // scadenza intera, non alle singole rate).
  globali.push(...applicaCreditoPrimaNonPagata(scadenzeGSSucc, creditoGestioneGS).flatMap(espandi))

  // ─── Saldo + acconti eccedenza Art/Comm ───────────────────────────────────
  // Acconto anno+1 (proiezione): base sui redditi correnti, costanti dell'anno+1.
  const baseEccSucc = baseAccontoEcc(regimiCorrente, annoSucc)
  const accontoEccAnnoSuccTot =
    attivoADicembre(regimiConFissi(regimiCorrente)) && baseEccSucc > 0
      ? baseEccSucc * (QUOTA_ACCONTO_ECC * 2)
      : 0
  const [eccSuccR1, eccSuccR2] = rateAcconto(accontoEccAnnoSuccTot)

  // Scadenze sul reddito (eccedenza) dell'anno successivo, in ordine cronologico:
  // saldo competenza anno → 1° acconto → 2° acconto. Il conguaglio si applica
  // alla prima non ancora pagata.
  const scadenzeEccSucc: Scadenza[] = []
  if (saldoContributiEccArtComm > 0) {
    scadenzeEccSucc.push({
      data: formattaScadenza(dSucc.saldoContributi, annoSucc),
      descrizione: `Saldo contributi eccedenza artigiani/commercianti ${anno}`,
      categoria: 'Contributi eccedenza artigiani/commercianti',
      voce: `Saldo · competenza ${anno}`,
      importo: saldoContributiEccArtComm,
      componenti: componentiSaldo(
        `Saldo contributi ecc. Art/Comm ${anno}`,
        saldoContributiEccArtComm,
        totaleContributiEccArtCommDovutoCorrente,
        accontiEccVersatiNelCorrente,
        anno,
      ),
      annoScadenza: annoSucc,
      riferimenti: ['ecc-saldo'],
      chiaveRateazione: `ecc-saldo-${anno}`,
    })
  }
  if (accontoEccAnnoSuccTot > 0) {
    scadenzeEccSucc.push({
      data: formattaScadenza(dSucc.primoAccontoContributi, annoSucc),
      descrizione: `1° acconto contributi eccedenza artigiani/commercianti ${annoSucc}`,
      categoria: 'Contributi eccedenza artigiani/commercianti',
      voce: `${accontoLabel(1)} · competenza ${annoSucc}`,
      importo: eccSuccR1,
      componenti: [{ tipo: `1° acconto contributi ecc. Art/Comm ${annoSucc} (su ecc. ${anno})`, importo: eccSuccR1 }],
      annoScadenza: annoSucc,
      riferimenti: ['ecc-acconto-1'],
      chiaveRateazione: `ecc-acconto1-${annoSucc}`,
    })
    scadenzeEccSucc.push({
      data: formattaScadenza(dSucc.secondoAccontoContributi, annoSucc),
      descrizione: `2° acconto contributi eccedenza artigiani/commercianti ${annoSucc}`,
      categoria: 'Contributi eccedenza artigiani/commercianti',
      voce: `${accontoLabel(2)} · competenza ${annoSucc}`,
      importo: eccSuccR2,
      componenti: [{ tipo: `2° acconto contributi ecc. Art/Comm ${annoSucc} (su ecc. ${anno})`, importo: eccSuccR2 }],
      annoScadenza: annoSucc,
      riferimenti: ['ecc-acconto-2'],
    })
  }
  globali.push(...applicaCreditoPrimaNonPagata(scadenzeEccSucc, creditoGestioneArtComm).flatMap(espandi))

  // ─── Prime 3 rate contributi fissi dell'anno successivo ───────────────────
  // Se l'anno successivo non è nel database, le costanti si STIMANO per
  // regressione lineare sui dati storici (proiezione del trend INPS).
  const datiSucc = annoEsisteNelDatabase(annoSucc) ? datiAnno(annoSucc) : proiettaDatiAnno(annoSucc)
  const stimata = !annoEsisteNelDatabase(annoSucc)
  const fissiAttiviADicembre = fissiCorrenti.filter((r) => r.meseFine === 12)
  if (datiSucc) {
    for (const regime of fissiAttiviADicembre) {
      const cf = regime.tipo === 'artigiani' ? datiSucc.contributoFisso.artigiani : datiSucc.contributoFisso.commercianti
      const mensile = applicaRiduzioneIVS(cf.ivsAnnuale / 12, cf.maternitaMensile, regime.riduzioneContributi)
      // 1ª, 2ª, 3ª rata (3 mesi ciascuna) — la 4ª cade nell'anno dopo ancora.
      // Importo arrotondato al centesimo (come INPS); collegato ai pagamenti
      // dell'anno+1 via 'fissi-1/2/3'.
      const rifFissi: RiferimentoScadenza[] = ['fissi-1', 'fissi-2', 'fissi-3']
      for (let idx = 0; idx < 3; idx++) {
        const importoRata = Math.round(mensile * 3 * 100) / 100
        globali.push({
          data: formattaScadenza(datiSucc.scadenze.rateContributiFissi[idx], annoSucc),
          descrizione: `Contributi fissi ${labelTipo(regime.tipo)} ${annoSucc} (3 mesi trim. ${idx + 1})`,
          categoria: `Contributi fissi ${labelTipo(regime.tipo).toLowerCase()}`,
          voce: `${ORDINALE_RATA[idx + 1]} rata trimestrale · competenza ${annoSucc}`,
          importo: importoRata,
          componenti: [{ tipo: `Rata contributi fissi ${labelTipo(regime.tipo)} ${annoSucc}`, importo: importoRata }],
          annoScadenza: annoSucc,
          riferimenti: [rifFissi[idx]],
          stimata,
        })
      }
    }
  }

  const ordina = (s: Scadenza[]) =>
    [...s].sort((a, b) => {
      const diff = parseDataOrd(a.data) - parseDataOrd(b.data)
      return diff !== 0 ? diff : b.importo - a.importo
    })

  return {
    scadenzeAnnoCorrente: ordina(globali.filter((s) => s.annoScadenza === anno)),
    scadenzeAnnoSuccessivo: ordina(globali.filter((s) => s.annoScadenza === annoSucc)),
  }
}

// ---------------------------------------------------------------------------
// Helper di ordinamento date testuali "GG Mese AAAA"
// ---------------------------------------------------------------------------

const MESI: Record<string, number> = {
  Gennaio: 1, Febbraio: 2, Marzo: 3, Aprile: 4, Maggio: 5, Giugno: 6,
  Luglio: 7, Agosto: 8, Settembre: 9, Ottobre: 10, Novembre: 11, Dicembre: 12,
}

function parseDataOrd(data: string): number {
  const [gg, mese, anno] = data.split(' ')
  const mm = MESI[mese] ?? 1
  return new Date(Number(anno), mm - 1, Number(gg)).getTime()
}
