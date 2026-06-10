import type { CalcoloInput, Regime, Scadenza, RiferimentoScadenza, TipoVersamento } from '@/domain/types'
import { datiAnno, anniDisponibili } from '@/data/taxData'
import { proiettaDatiAnno } from '@/data/proiezioneAnno'
import { calcolaRateContributiFissi, applicaRiduzioneIVS } from '@/domain/contributi'
import { formattaScadenza } from '@/domain/dates'
import { labelTipo } from '@/domain/labels'

const annoEsisteNelDatabase = (anno: number) => anniDisponibili().includes(anno)

const SOGLIA_ACCONTO = 257 // soglia minima per generare acconti
const QUOTA_ACCONTO_IMPOSTE = 0.5
const QUOTA_ACCONTO_GS = 0.8
const QUOTA_ACCONTO_ECC = 0.5

const regimiConFissi = (regimi: Regime[]) =>
  regimi.filter((r) => r.tipo === 'artigiani' || r.tipo === 'commercianti')

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
  // imposte/contributi anno corrente (base per gli acconti anno+1)
  totaleImposteCorrente: number
  totaleContributiSeparataCorrente: number
  totaleContributiEccedenzaArtCommCorrente: number
  // imposte anno precedente (base per gli acconti anno corrente)
  totaleImpostePrecedente: number
  accontiImposteVersatiPerAnnoPrecedente: number
  // contributi dovuti anno precedente: si versano a saldo NELL'anno corrente
  totaleContributiSeparataPrecedente: number
  totaleContributiEccedenzaArtCommPrecedente: number
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

  const importoVoce = (tipo: TipoVersamento): number =>
    input.modalitaContributiVersati === 'dettaglio'
      ? input.contributiVersatiDettaglio
          .filter((r) => r.tipo === tipo)
          .reduce((s, r) => s + (r.importo ?? 0), 0)
      : 0

  return rif.reduce((tot, r) => {
    if (r === 'imposta-saldo') return tot + (input.impostaSaldoVersatoAnnoCorrente ?? 0)
    if (r === 'imposta-acconto1') return tot + (input.impostaAcconto1VersatoAnnoCorrente ?? 0)
    if (r === 'imposta-acconto2') return tot + (input.impostaAcconto2VersatoAnnoCorrente ?? 0)
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

/** Vero se la scadenza riguarda l'imposta sostitutiva (anziché i contributi INPS). */
function isImposta(s: Scadenza): boolean {
  return (s.riferimenti ?? []).some((r) => r.startsWith('imposta-'))
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
  contributi: BilancioCategoria
  imposte: BilancioCategoria
}

/**
 * Bilancio dei pagamenti di un anno: confronta dovuto e pagato separando i
 * contributi INPS dalle imposte. Considera solo le scadenze TRACCIABILI (quelle
 * con un versamento collegato); le altre (es. previsioni future) sono escluse.
 */
export function bilancioPagamenti(scadenze: Scadenza[], input: CalcoloInput): BilancioAnno {
  const vuoto = (): BilancioCategoria => ({ dovuto: 0, pagato: 0, saldo: 0 })
  const contributi = vuoto()
  const imposte = vuoto()

  for (const s of scadenze) {
    const versato = versatoPerScadenza(s, input)
    if (versato == null) continue // non tracciabile → fuori dal bilancio
    const cat = isImposta(s) ? imposte : contributi
    cat.dovuto += s.importo
    cat.pagato += versato
  }
  contributi.saldo = contributi.pagato - contributi.dovuto
  imposte.saldo = imposte.pagato - imposte.dovuto
  return { contributi, imposte }
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
  totaleContributiSeparataCorrente,
  totaleContributiEccedenzaArtCommCorrente,
  totaleImpostePrecedente,
  accontiImposteVersatiPerAnnoPrecedente,
  totaleContributiSeparataPrecedente,
  totaleContributiEccedenzaArtCommPrecedente,
}: ParamsScadenze): RisultatoScadenze {
  const globali: Scadenza[] = []
  const annoSucc = anno + 1
  const annoPrec = anno - 1
  const {
    saldoImposte,
    primoAccontoImposte,
    secondoAccontoImposte,
    primoAccontoContributi,
    secondoAccontoContributi,
  } = datiAnno(anno).scadenze
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
      data: formattaScadenza(saldoImposte, anno),
      descrizione: `Saldo contributi G.S. ${annoPrec}`,
      importo: totaleContributiSeparataPrecedente,
      componenti: [{ tipo: `Saldo contributi G.S. ${annoPrec}`, importo: totaleContributiSeparataPrecedente }],
      annoScadenza: anno,
      riferimenti: ['gs-saldo'],
    })
  }

  // ─── Saldo contributi eccedenza Art/Comm anno precedente (giugno anno corr.) ──
  if (totaleContributiEccedenzaArtCommPrecedente > 0.005) {
    globali.push({
      data: formattaScadenza(saldoImposte, anno),
      descrizione: `Saldo contributi ecc. Art/Comm ${annoPrec}`,
      importo: totaleContributiEccedenzaArtCommPrecedente,
      componenti: [{ tipo: `Saldo contributi ecc. Art/Comm ${annoPrec}`, importo: totaleContributiEccedenzaArtCommPrecedente }],
      annoScadenza: anno,
      riferimenti: ['ecc-saldo'],
    })
  }

  // ─── Acconti contributi per l'anno corrente (1° giugno, 2° novembre) ──────
  // Basati sui contributi dovuti dell'anno precedente, solo se ancora attivi.
  const accontoGSCorr =
    attivoADicembre(regimiSeparata(regimiCorrente)) && totaleContributiSeparataPrecedente > 0
      ? (totaleContributiSeparataPrecedente * QUOTA_ACCONTO_GS) / 2
      : 0
  if (accontoGSCorr > 0.005) {
    globali.push({
      data: formattaScadenza(primoAccontoContributi, anno),
      descrizione: `1° acconto contributi G.S. ${anno}`,
      importo: accontoGSCorr,
      componenti: [{ tipo: `1° acconto contributi G.S. ${anno}`, importo: accontoGSCorr }],
      annoScadenza: anno,
      riferimenti: ['gs-acconto-1'],
    })
    globali.push({
      data: formattaScadenza(secondoAccontoContributi, anno),
      descrizione: `2° acconto contributi G.S. ${anno}`,
      importo: accontoGSCorr,
      componenti: [{ tipo: `2° acconto contributi G.S. ${anno}`, importo: accontoGSCorr }],
      annoScadenza: anno,
      riferimenti: ['gs-acconto-2'],
    })
  }

  // Acconto eccedenza: 100% del dovuto in due rate da 50% → per rata = totale × 0,5
  const accontoEccCorr =
    attivoADicembre(regimiConFissi(regimiCorrente)) && totaleContributiEccedenzaArtCommPrecedente > 0
      ? totaleContributiEccedenzaArtCommPrecedente * QUOTA_ACCONTO_ECC
      : 0
  if (accontoEccCorr > 0.005) {
    globali.push({
      data: formattaScadenza(primoAccontoContributi, anno),
      descrizione: `1° acconto contributi ecc. Art/Comm ${anno}`,
      importo: accontoEccCorr,
      componenti: [{ tipo: `1° acconto contributi ecc. Art/Comm ${anno}`, importo: accontoEccCorr }],
      annoScadenza: anno,
      riferimenti: ['ecc-acconto-1'],
    })
    globali.push({
      data: formattaScadenza(secondoAccontoContributi, anno),
      descrizione: `2° acconto contributi ecc. Art/Comm ${anno}`,
      importo: accontoEccCorr,
      componenti: [{ tipo: `2° acconto contributi ecc. Art/Comm ${anno}`, importo: accontoEccCorr }],
      annoScadenza: anno,
      riferimenti: ['ecc-acconto-2'],
    })
  }

  // ─── Saldo imposte anno precedente + 1° acconto imposte anno corrente ──────
  const saldoImpostePrecedente = Math.max(
    0,
    totaleImpostePrecedente - (accontiImposteVersatiPerAnnoPrecedente ?? 0),
  )
  const accontoImposteAnnoCorrente =
    totaleImpostePrecedente > SOGLIA_ACCONTO ? totaleImpostePrecedente * QUOTA_ACCONTO_IMPOSTE : 0

  // Saldo e 1° acconto cadono lo stesso giorno ma sono due versamenti distinti
  if (saldoImpostePrecedente > 0) {
    globali.push({
      data: formattaScadenza(saldoImposte, anno),
      descrizione: `Saldo imposte ${anno - 1}`,
      importo: saldoImpostePrecedente,
      componenti: [{ tipo: `Saldo imposte ${anno - 1}`, importo: saldoImpostePrecedente }],
      annoScadenza: anno,
      riferimenti: ['imposta-saldo'],
    })
  }
  if (accontoImposteAnnoCorrente > 0) {
    globali.push({
      data: formattaScadenza(primoAccontoImposte, anno),
      descrizione: `1° acconto imposte ${anno}`,
      importo: accontoImposteAnnoCorrente,
      componenti: [{ tipo: `1° acconto imposte ${anno} (su tax netta ${anno - 1})`, importo: accontoImposteAnnoCorrente }],
      annoScadenza: anno,
      riferimenti: ['imposta-acconto1'],
    })
  }
  if (accontoImposteAnnoCorrente > 0) {
    globali.push({
      data: formattaScadenza(secondoAccontoImposte, anno),
      descrizione: `2° acconto imposte ${anno}`,
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
    globali.push({
      data: formattaScadenza(saldoImposte, annoSucc),
      descrizione: `Saldo imposte ${anno}`,
      importo: saldoImposteDaVersare,
      componenti: [{ tipo: `Saldo imposte ${anno}`, importo: saldoImposteDaVersare }],
      annoScadenza: annoSucc,
    })
  }
  if (accontoImposteAnnoSucc > 0) {
    globali.push({
      data: formattaScadenza(primoAccontoImposte, annoSucc),
      descrizione: `1° acconto imposte ${annoSucc}`,
      importo: accontoImposteAnnoSucc,
      componenti: [{ tipo: `1° acconto imposte ${annoSucc} (su tax ${anno})`, importo: accontoImposteAnnoSucc }],
      annoScadenza: annoSucc,
    })
  }
  if (accontoImposteAnnoSucc > 0) {
    globali.push({
      data: formattaScadenza(secondoAccontoImposte, annoSucc),
      descrizione: `2° acconto imposte ${annoSucc}`,
      importo: accontoImposteAnnoSucc,
      componenti: [{ tipo: `2° acconto imposte ${annoSucc} (su tax ${anno})`, importo: accontoImposteAnnoSucc }],
      annoScadenza: annoSucc,
    })
  }

  // ─── Saldo + acconti Gestione Separata ────────────────────────────────────
  const accontoGSAnnoSucc =
    attivoADicembre(regimiSeparata(regimiCorrente)) && totaleContributiSeparataCorrente > 0
      ? (totaleContributiSeparataCorrente * QUOTA_ACCONTO_GS) / 2
      : 0

  if (saldoContributiGS > 0) {
    globali.push({
      data: formattaScadenza(saldoImposte, annoSucc),
      descrizione: `Saldo contributi G.S. ${anno}`,
      importo: saldoContributiGS,
      componenti: [{ tipo: `Saldo contributi G.S. ${anno}`, importo: saldoContributiGS }],
      annoScadenza: annoSucc,
    })
  }
  if (accontoGSAnnoSucc > 0) {
    globali.push({
      data: formattaScadenza(primoAccontoContributi, annoSucc),
      descrizione: `1° acconto contributi G.S. ${annoSucc}`,
      importo: accontoGSAnnoSucc,
      componenti: [{ tipo: `1° acconto contributi G.S. ${annoSucc} (su contr. G.S. ${anno})`, importo: accontoGSAnnoSucc }],
      annoScadenza: annoSucc,
    })
  }
  if (accontoGSAnnoSucc > 0) {
    globali.push({
      data: formattaScadenza(secondoAccontoContributi, annoSucc),
      descrizione: `2° acconto contributi G.S. ${annoSucc}`,
      importo: accontoGSAnnoSucc,
      componenti: [{ tipo: `2° acconto contributi G.S. ${annoSucc} (su contr. G.S. ${anno})`, importo: accontoGSAnnoSucc }],
      annoScadenza: annoSucc,
    })
  }

  // ─── Saldo + acconti eccedenza Art/Comm ───────────────────────────────────
  const accontoEccAnnoSucc =
    attivoADicembre(regimiConFissi(regimiCorrente)) && totaleContributiEccedenzaArtCommCorrente > 0
      ? totaleContributiEccedenzaArtCommCorrente * QUOTA_ACCONTO_ECC
      : 0

  if (saldoContributiEccArtComm > 0) {
    globali.push({
      data: formattaScadenza(saldoImposte, annoSucc),
      descrizione: `Saldo contributi ecc. Art/Comm ${anno}`,
      importo: saldoContributiEccArtComm,
      componenti: [{ tipo: `Saldo contributi ecc. Art/Comm ${anno}`, importo: saldoContributiEccArtComm }],
      annoScadenza: annoSucc,
    })
  }
  if (accontoEccAnnoSucc > 0) {
    globali.push({
      data: formattaScadenza(primoAccontoContributi, annoSucc),
      descrizione: `1° acconto contributi ecc. Art/Comm ${annoSucc}`,
      importo: accontoEccAnnoSucc,
      componenti: [{ tipo: `1° acconto contributi ecc. Art/Comm ${annoSucc} (su ecc. ${anno})`, importo: accontoEccAnnoSucc }],
      annoScadenza: annoSucc,
    })
  }
  if (accontoEccAnnoSucc > 0) {
    globali.push({
      data: formattaScadenza(secondoAccontoContributi, annoSucc),
      descrizione: `2° acconto contributi ecc. Art/Comm ${annoSucc}`,
      importo: accontoEccAnnoSucc,
      componenti: [{ tipo: `2° acconto contributi ecc. Art/Comm ${annoSucc} (su ecc. ${anno})`, importo: accontoEccAnnoSucc }],
      annoScadenza: annoSucc,
    })
  }

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
