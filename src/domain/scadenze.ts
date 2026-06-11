import type { CalcoloInput, ComponenteScadenza, OpzioniRateazione, Regime, Scadenza, RiferimentoScadenza, TipoVersamento } from '@/domain/types'
import { datiAnno, anniDisponibili, type ScadenzeAnno } from '@/data/taxData'
import { proiettaDatiAnno } from '@/data/proiezioneAnno'
import { calcolaRateContributiFissi, applicaRiduzioneIVS, baseEccedenzaAcconto, baseSeparataAcconto } from '@/domain/contributi'
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
  // dettaglio per documentare il saldo (dovuto − acconti già versati nell'anno)
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
  // contributi dovuti anno precedente: si versano a saldo NELL'anno corrente
  totaleContributiSeparataPrecedente: number
  totaleContributiEccedenzaArtCommPrecedente: number
  /** Scelte di rateazione dei versamenti d'imposta, per chiave. */
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

  // Le scadenze che cadono nell'anno SUCCESSIVO (saldo competenza anno + acconti
  // anno+1) si pagano nell'anno successivo: i loro versamenti stanno nella lista
  // dedicata. Le scadenze dell'anno di riferimento usano i versamenti correnti.
  const isAnnoSuccessivo = scadenza.annoScadenza === input.anno + 1
  const listaVersamenti = isAnnoSuccessivo ? input.versamentiAnnoSuccessivo : input.contributiVersatiDettaglio

  const importoVoce = (tipo: TipoVersamento): number =>
    input.modalitaContributiVersati === 'dettaglio'
      ? (listaVersamenti ?? [])
          .filter((r) => r.tipo === tipo)
          .reduce((s, r) => s + (r.importo ?? 0), 0)
      : 0

  return rif.reduce((tot, r) => {
    // I versamenti d'imposta correnti restano gli stessi campi solo per le
    // scadenze dell'anno di riferimento (l'anno+1 non ha campi imposta dedicati).
    if (r === 'imposta-saldo') return tot + (isAnnoSuccessivo ? 0 : input.impostaSaldoVersatoAnnoCorrente ?? 0)
    if (r === 'imposta-acconto1') return tot + (isAnnoSuccessivo ? 0 : input.impostaAcconto1VersatoAnnoCorrente ?? 0)
    if (r === 'imposta-acconto2') return tot + (isAnnoSuccessivo ? 0 : input.impostaAcconto2VersatoAnnoCorrente ?? 0)
    return tot + importoVoce(r)
  }, 0)
}

/**
 * Tolleranza sul "pagato": i contributi al modello F24 si versano arrotondati
 * all'euro, quindi una differenza fino a ~1 € (arrotondamento) NON significa
 * scadenza non saldata.
 */
const TOLLERANZA_PAGAMENTO = 1.0

/** Vero se la scadenza risulta saldata (versato ≥ dovuto, a meno dell'arrotondamento). */
export function scadenzaPagata(scadenza: Scadenza, input: CalcoloInput): boolean {
  const versato = versatoPerScadenza(scadenza, input)
  return (
    versato != null &&
    versato >= scadenza.importo - TOLLERANZA_PAGAMENTO &&
    scadenza.importo > 0.005
  )
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
  /** pagato − dovuto: positivo = versato in più, negativo = in meno. */
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
   * Componenti che documentano un saldo a conguaglio: dovuto totale dell'anno
   * meno gli acconti già versati durante l'anno. Se i dati di dettaglio non ci
   * sono (o gli acconti sono nulli) si ricade su una voce singola.
   */
  const componentiSaldo = (
    etichetta: string,
    saldo: number,
    dovuto: number | undefined,
    acconti: number | undefined,
  ): ComponenteScadenza[] => {
    if (dovuto == null || acconti == null || acconti <= 0.005) {
      return [{ tipo: etichetta, importo: saldo }]
    }
    return [
      { tipo: `Totale dovuto ${anno}`, importo: dovuto },
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
          ? `Hai versato ${credito.toFixed(2)} € in più del dovuto su questa gestione nel ${anno}: ` +
            `puoi versare ${consigliato.toFixed(2)} € invece di ${s.importo.toFixed(2)} €.`
          : `Hai versato ${credito.toFixed(2)} € in più del dovuto su questa gestione nel ${anno}: ` +
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

  // Base acconti col metodo INPS: reddito di gestione annuo aggregato, minimale
  // pieno, costanti dell'anno in cui l'acconto si versa (vedi contributi.ts).
  const baseAccontoEcc = baseEccedenzaAcconto
  const baseAccontoGS = baseSeparataAcconto

  // Espande una scadenza d'imposta nelle sue rate, se l'utente ha scelto
  // una rateazione per la sua chiave; altrimenti la lascia invariata.
  const pushImposta = (s: Scadenza) => {
    const opzioni = s.chiaveRateazione ? rateazioniImposta?.[s.chiaveRateazione] : undefined
    globali.push(...(opzioni ? espandiRateazione(s, opzioni) : [s]))
  }

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
  if (totaleContributiSeparataPrecedente > 0.005) {
    globali.push({
      data: formattaScadenza(dCorr.saldoImposte, anno),
      descrizione: `Saldo contributi Gestione separata ${annoPrec}`,
      categoria: 'Contributi Gestione separata',
      voce: `Saldo · competenza ${annoPrec}`,
      importo: totaleContributiSeparataPrecedente,
      componenti: [{ tipo: `Saldo contributi G.S. ${annoPrec}`, importo: totaleContributiSeparataPrecedente }],
      annoScadenza: anno,
      riferimenti: ['gs-saldo'],
    })
  }

  // ─── Saldo contributi eccedenza Art/Comm anno precedente (giugno anno corr.) ──
  if (totaleContributiEccedenzaArtCommPrecedente > 0.005) {
    globali.push({
      data: formattaScadenza(dCorr.saldoImposte, anno),
      descrizione: `Saldo contributi eccedenza artigiani/commercianti ${annoPrec}`,
      categoria: 'Contributi eccedenza artigiani/commercianti',
      voce: `Saldo · competenza ${annoPrec}`,
      importo: totaleContributiEccedenzaArtCommPrecedente,
      componenti: [{ tipo: `Saldo contributi ecc. Art/Comm ${annoPrec}`, importo: totaleContributiEccedenzaArtCommPrecedente }],
      annoScadenza: anno,
      riferimenti: ['ecc-saldo'],
    })
  }

  // ─── Acconti contributi per l'anno corrente (1° giugno, 2° novembre) ──────
  // Basati sui contributi dovuti dell'anno precedente, solo se ancora attivi.
  // Base INPS: contributi G.S. sui redditi dell'anno prima, costanti dell'anno corrente.
  const baseGSCorr = baseAccontoGS(regimiPrecedente, anno)
  const accontoGSCorr =
    attivoADicembre(regimiSeparata(regimiCorrente)) && baseGSCorr > 0
      ? (baseGSCorr * QUOTA_ACCONTO_GS) / 2
      : 0
  if (accontoGSCorr > 0.005) {
    globali.push({
      data: formattaScadenza(dCorr.primoAccontoContributi, anno),
      descrizione: `1° acconto contributi Gestione separata ${anno}`,
      categoria: 'Contributi Gestione separata',
      voce: `${accontoLabel(1)} · competenza ${anno}`,
      importo: accontoGSCorr,
      componenti: [{ tipo: `1° acconto contributi G.S. ${anno}`, importo: accontoGSCorr }],
      annoScadenza: anno,
      riferimenti: ['gs-acconto-1'],
    })
    globali.push({
      data: formattaScadenza(dCorr.secondoAccontoContributi, anno),
      descrizione: `2° acconto contributi Gestione separata ${anno}`,
      categoria: 'Contributi Gestione separata',
      voce: `${accontoLabel(2)} · competenza ${anno}`,
      importo: accontoGSCorr,
      componenti: [{ tipo: `2° acconto contributi G.S. ${anno}`, importo: accontoGSCorr }],
      annoScadenza: anno,
      riferimenti: ['gs-acconto-2'],
    })
  }

  // Acconto eccedenza: 100% del dovuto in due rate da 50% → per rata = totale × 0,5.
  // Base INPS: eccedenza sui redditi dell'anno prima, costanti dell'anno corrente.
  const baseEccCorr = baseAccontoEcc(regimiPrecedente, anno)
  const accontoEccCorr =
    attivoADicembre(regimiConFissi(regimiCorrente)) && baseEccCorr > 0
      ? baseEccCorr * QUOTA_ACCONTO_ECC
      : 0
  if (accontoEccCorr > 0.005) {
    globali.push({
      data: formattaScadenza(dCorr.primoAccontoContributi, anno),
      descrizione: `1° acconto contributi eccedenza artigiani/commercianti ${anno}`,
      categoria: 'Contributi eccedenza artigiani/commercianti',
      voce: `${accontoLabel(1)} · competenza ${anno}`,
      importo: accontoEccCorr,
      componenti: [{ tipo: `1° acconto contributi ecc. Art/Comm ${anno}`, importo: accontoEccCorr }],
      annoScadenza: anno,
      riferimenti: ['ecc-acconto-1'],
    })
    globali.push({
      data: formattaScadenza(dCorr.secondoAccontoContributi, anno),
      descrizione: `2° acconto contributi eccedenza artigiani/commercianti ${anno}`,
      categoria: 'Contributi eccedenza artigiani/commercianti',
      voce: `${accontoLabel(2)} · competenza ${anno}`,
      importo: accontoEccCorr,
      componenti: [{ tipo: `2° acconto contributi ecc. Art/Comm ${anno}`, importo: accontoEccCorr }],
      annoScadenza: anno,
      riferimenti: ['ecc-acconto-2'],
    })
  }

  // ─── Conguaglio per gestione: somma dei soli di-PIÙ sulle rate obbligatorie ─
  // Il saldo eccedenza è il punto in cui si scontano gli EXTRA pagati sulle altre
  // rate della stessa gestione (minimali fisse e acconti). Vale solo per i di-PIÙ:
  // una rata pagata in MENO non riduce il credito — va regolarizzata a parte (con
  // mora), non si compensa col saldo. Si confrontano solo le rate di competenza
  // dell'anno (fisse 1ª-3ª + acconti); saldo e 4ª rata sono competenza precedente.
  const importoVersato = (tipo: TipoVersamento): number =>
    input?.modalitaContributiVersati === 'dettaglio'
      ? input.contributiVersatiDettaglio
          .filter((r) => r.tipo === tipo)
          .reduce((s, r) => s + (r.importo ?? 0), 0)
      : 0
  /** Somma dei soli eccessi (versato − dovuto, se positivo) voce per voce. */
  const sommaDiPiu = (voci: { tipo: TipoVersamento; dovuto: number }[]): number =>
    voci.reduce((s, v) => s + Math.max(0, importoVersato(v.tipo) - v.dovuto), 0)

  // Rate fisse 1ª-3ª correnti dovute (la 4ª si versa l'anno dopo).
  const rateFissiCorrenti = regimiConFissi(regimiCorrente).flatMap((regime) =>
    calcolaRateContributiFissi(regime, anno).rate.filter((r) => r.anno === anno && r.rataIdx <= 2),
  )
  const dovutoRata = (idx: number) =>
    rateFissiCorrenti.filter((r) => r.rataIdx === idx).reduce((s, r) => s + r.importo, 0)

  const creditoGestioneArtComm = sommaDiPiu([
    { tipo: 'fissi-1', dovuto: dovutoRata(0) },
    { tipo: 'fissi-2', dovuto: dovutoRata(1) },
    { tipo: 'fissi-3', dovuto: dovutoRata(2) },
    { tipo: 'ecc-acconto-1', dovuto: accontoEccCorr },
    { tipo: 'ecc-acconto-2', dovuto: accontoEccCorr },
  ])
  const creditoGestioneGS = sommaDiPiu([
    { tipo: 'gs-acconto-1', dovuto: accontoGSCorr },
    { tipo: 'gs-acconto-2', dovuto: accontoGSCorr },
  ])

  // ─── Saldo imposte anno precedente + 1° acconto imposte anno corrente ──────
  const saldoImpostePrecedente = Math.max(
    0,
    totaleImpostePrecedente - (accontiImposteVersatiPerAnnoPrecedente ?? 0),
  )
  const accontoImposteAnnoCorrente =
    totaleImpostePrecedente > SOGLIA_ACCONTO ? totaleImpostePrecedente * QUOTA_ACCONTO_IMPOSTE : 0

  // Saldo e 1° acconto cadono lo stesso giorno ma sono due versamenti distinti
  if (saldoImpostePrecedente > 0) {
    pushImposta({
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
    pushImposta({
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
  // Niente riferimento: il suo versamento starà nella lista dell'anno+1, non qui.
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
        })
      }
    }
  }

  // ─── Saldo imposte anno corrente + 1° acconto imposte anno+1 ──────────────
  const accontoImposteAnnoSucc =
    totaleImposteCorrente > SOGLIA_ACCONTO ? totaleImposteCorrente * QUOTA_ACCONTO_IMPOSTE : 0

  // Saldo e 1° acconto: righe separate (le date possono divergere)
  if (saldoImposteDaVersare > 0) {
    pushImposta({
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
    pushImposta({
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

  // ─── Saldo + acconti Gestione Separata ────────────────────────────────────
  // Acconto anno+1 (proiezione): base sui redditi correnti, costanti dell'anno+1.
  const baseGSSucc = baseAccontoGS(regimiCorrente, annoSucc)
  const accontoGSAnnoSucc =
    attivoADicembre(regimiSeparata(regimiCorrente)) && baseGSSucc > 0
      ? (baseGSSucc * QUOTA_ACCONTO_GS) / 2
      : 0

  // Scadenze sul reddito (G.S.) dell'anno successivo, in ordine: saldo → acconti.
  const scadenzeGSSucc: Scadenza[] = []
  if (saldoContributiGS > 0) {
    scadenzeGSSucc.push({
      data: formattaScadenza(dSucc.saldoImposte, annoSucc),
      descrizione: `Saldo contributi Gestione separata ${anno}`,
      categoria: 'Contributi Gestione separata',
      voce: `Saldo · competenza ${anno}`,
      importo: saldoContributiGS,
      componenti: componentiSaldo(
        `Saldo contributi G.S. ${anno}`,
        saldoContributiGS,
        totaleContributiSeparataDovutoCorrente,
        accontiGSVersatiNelCorrente,
      ),
      annoScadenza: annoSucc,
      riferimenti: ['gs-saldo'],
    })
  }
  if (accontoGSAnnoSucc > 0) {
    scadenzeGSSucc.push({
      data: formattaScadenza(dSucc.primoAccontoContributi, annoSucc),
      descrizione: `1° acconto contributi Gestione separata ${annoSucc}`,
      categoria: 'Contributi Gestione separata',
      voce: `${accontoLabel(1)} · competenza ${annoSucc}`,
      importo: accontoGSAnnoSucc,
      componenti: [{ tipo: `1° acconto contributi G.S. ${annoSucc} (su contr. G.S. ${anno})`, importo: accontoGSAnnoSucc }],
      annoScadenza: annoSucc,
      riferimenti: ['gs-acconto-1'],
    })
    scadenzeGSSucc.push({
      data: formattaScadenza(dSucc.secondoAccontoContributi, annoSucc),
      descrizione: `2° acconto contributi Gestione separata ${annoSucc}`,
      categoria: 'Contributi Gestione separata',
      voce: `${accontoLabel(2)} · competenza ${annoSucc}`,
      importo: accontoGSAnnoSucc,
      componenti: [{ tipo: `2° acconto contributi G.S. ${annoSucc} (su contr. G.S. ${anno})`, importo: accontoGSAnnoSucc }],
      annoScadenza: annoSucc,
      riferimenti: ['gs-acconto-2'],
    })
  }
  globali.push(...applicaCreditoPrimaNonPagata(scadenzeGSSucc, creditoGestioneGS))

  // ─── Saldo + acconti eccedenza Art/Comm ───────────────────────────────────
  // Acconto anno+1 (proiezione): base sui redditi correnti, costanti dell'anno+1.
  const baseEccSucc = baseAccontoEcc(regimiCorrente, annoSucc)
  const accontoEccAnnoSucc =
    attivoADicembre(regimiConFissi(regimiCorrente)) && baseEccSucc > 0
      ? baseEccSucc * QUOTA_ACCONTO_ECC
      : 0

  // Scadenze sul reddito (eccedenza) dell'anno successivo, in ordine cronologico:
  // saldo competenza anno → 1° acconto → 2° acconto. Il conguaglio si applica
  // alla prima non ancora pagata.
  const scadenzeEccSucc: Scadenza[] = []
  if (saldoContributiEccArtComm > 0) {
    scadenzeEccSucc.push({
      data: formattaScadenza(dSucc.saldoImposte, annoSucc),
      descrizione: `Saldo contributi eccedenza artigiani/commercianti ${anno}`,
      categoria: 'Contributi eccedenza artigiani/commercianti',
      voce: `Saldo · competenza ${anno}`,
      importo: saldoContributiEccArtComm,
      componenti: componentiSaldo(
        `Saldo contributi ecc. Art/Comm ${anno}`,
        saldoContributiEccArtComm,
        totaleContributiEccArtCommDovutoCorrente,
        accontiEccVersatiNelCorrente,
      ),
      annoScadenza: annoSucc,
      riferimenti: ['ecc-saldo'],
    })
  }
  if (accontoEccAnnoSucc > 0) {
    scadenzeEccSucc.push({
      data: formattaScadenza(dSucc.primoAccontoContributi, annoSucc),
      descrizione: `1° acconto contributi eccedenza artigiani/commercianti ${annoSucc}`,
      categoria: 'Contributi eccedenza artigiani/commercianti',
      voce: `${accontoLabel(1)} · competenza ${annoSucc}`,
      importo: accontoEccAnnoSucc,
      componenti: [{ tipo: `1° acconto contributi ecc. Art/Comm ${annoSucc} (su ecc. ${anno})`, importo: accontoEccAnnoSucc }],
      annoScadenza: annoSucc,
      riferimenti: ['ecc-acconto-1'],
    })
    scadenzeEccSucc.push({
      data: formattaScadenza(dSucc.secondoAccontoContributi, annoSucc),
      descrizione: `2° acconto contributi eccedenza artigiani/commercianti ${annoSucc}`,
      categoria: 'Contributi eccedenza artigiani/commercianti',
      voce: `${accontoLabel(2)} · competenza ${annoSucc}`,
      importo: accontoEccAnnoSucc,
      componenti: [{ tipo: `2° acconto contributi ecc. Art/Comm ${annoSucc} (su ecc. ${anno})`, importo: accontoEccAnnoSucc }],
      annoScadenza: annoSucc,
      riferimenti: ['ecc-acconto-2'],
    })
  }
  globali.push(...applicaCreditoPrimaNonPagata(scadenzeEccSucc, creditoGestioneArtComm))

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
      // 1ª, 2ª, 3ª rata (3 mesi ciascuna) — la 4ª cade nell'anno dopo ancora
      for (let idx = 0; idx < 3; idx++) {
        globali.push({
          data: formattaScadenza(datiSucc.scadenze.rateContributiFissi[idx], annoSucc),
          descrizione: `Contributi fissi ${labelTipo(regime.tipo)} ${annoSucc} (3 mesi trim. ${idx + 1})`,
          categoria: `Contributi fissi ${labelTipo(regime.tipo).toLowerCase()}`,
          voce: `${ORDINALE_RATA[idx + 1]} rata trimestrale · competenza ${annoSucc}`,
          importo: mensile * 3,
          componenti: [{ tipo: `Rata contributi fissi ${labelTipo(regime.tipo)} ${annoSucc}`, importo: mensile * 3 }],
          annoScadenza: annoSucc,
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
