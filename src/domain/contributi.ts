import type { DatiAnno, Regime, RiduzioneContributi, TipoVersamento } from '@/domain/types'
import { datiAnno, anniDisponibili, type DatiAnno as DatiFiscali } from '@/data/taxData'
import { proiettaDatiAnno } from '@/data/proiezioneAnno'
import { formattaScadenza } from '@/domain/dates'
import { labelTipo } from '@/domain/labels'

/**
 * Dati fiscali di un anno con FALLBACK: se l'anno non è nel database, li proietta
 * dai dati storici (trend INPS) invece di lanciare. Così gli anni futuri (es.
 * acconti dell'anno+1 non ancora pubblicato) non bloccano il calcolo.
 */
function datiFiscaliConFallback(anno: number): DatiFiscali {
  if (anniDisponibili().includes(anno)) return datiAnno(anno)
  const proiettato = proiettaDatiAnno(anno)
  if (proiettato) return proiettato
  // Estrema istanza: usa l'anno più recente disponibile.
  return datiAnno(anniDisponibili()[0])
}

/**
 * Valore effettivo dei contributi versati in un anno, usato per la deducibilità.
 * Dipende dalla modalità: cifra unica manuale oppure somma delle righe di
 * dettaglio. Tenere separate le due fonti evita di perdere dati allo switch.
 */
export function contributiVersatiEffettivi(dati: DatiAnno): number {
  if (dati.modalitaContributi === 'dettaglio') {
    // Solo le voci deducibili (default true) entrano nella deducibilità: le voci
    // marcate non deducibili (es. contributi volontari extra IVS) sono escluse.
    return dati.contributiVersati
      .filter((r) => r.deducibile !== false)
      .reduce((s, r) => s + (r.importo ?? 0), 0)
  }
  return dati.contributiVersatiTotale ?? 0
}

/**
 * Somma degli acconti versati per una categoria, estratti dalla lista di
 * dettaglio (solo in modalità 'dettaglio'). Ogni acconto ha due rate (giugno e
 * novembre): le sommiamo entrambe. In modalità 'cifra unica' non c'è dettaglio,
 * quindi 0.
 */
export function accontoVersatoDaLista(dati: DatiAnno, categoria: 'gs' | 'ecc'): number {
  if (dati.modalitaContributi !== 'dettaglio') return 0
  const tipi: TipoVersamento[] =
    categoria === 'gs' ? ['gs-acconto-1', 'gs-acconto-2'] : ['ecc-acconto-1', 'ecc-acconto-2']
  return dati.contributiVersati
    .filter((r) => tipi.includes(r.tipo))
    .reduce((s, r) => s + (r.importo ?? 0), 0)
}

/** Reddito imponibile (fatturato × coefficiente) di un regime. */
const imponibileRegime = (r: Regime): number => (r.fatturato * r.coefficiente) / 100

/**
 * Base degli acconti contributi col metodo INPS: eccedenza IVS sui redditi
 * artigiani/commercianti di un anno, calcolata sul reddito ANNUO AGGREGATO
 * della gestione, col minimale PIENO (non proporzionato ai mesi) e le COSTANTI
 * dell'anno in cui l'acconto si versa. È così che lo strumento ufficiale INPS
 * "Contributi eccedenti il minimale" dimensiona gli acconti: parte dal reddito
 * comunicato come importo annuo, applica minimale e aliquote dell'anno corrente.
 *
 * Distingue artigiani e commercianti (aliquote diverse): somma le due eccedenze
 * calcolate separatamente, ciascuna sul proprio reddito di gestione.
 */
export function baseEccedenzaAcconto(regimi: Regime[], annoCostanti: number): number {
  const dati = datiFiscaliConFallback(annoCostanti)
  const calcola = (tipo: 'artigiani' | 'commercianti'): number => {
    const periodi = regimi.filter((r) => r.tipo === tipo)
    if (periodi.length === 0) return 0
    // INPS calcola i contributi sul reddito imponibile arrotondato all'euro
    // (il calcolatore richiede il reddito senza decimali).
    const reddito = Math.round(periodi.reduce((s, r) => s + imponibileRegime(r), 0))
    if (reddito <= dati.minimaleReddito) return 0
    const aliquota = tipo === 'artigiani' ? dati.aliquotaArtigiani : dati.aliquotaCommercianti
    let bruti: number
    if (reddito <= dati.sogliaPrimaFascia) {
      bruti = ((reddito - dati.minimaleReddito) * aliquota) / 100
    } else {
      const fascia1 = dati.sogliaPrimaFascia - dati.minimaleReddito
      const fascia2 = reddito - dati.sogliaPrimaFascia
      bruti = (fascia1 * aliquota) / 100 + (fascia2 * (aliquota + 1)) / 100
    }
    // Riduzione: usa quella del primo periodo della gestione (in pratica omogenea).
    return applicaRiduzioneIVS(bruti, 0, periodi[0].riduzioneContributi)
  }
  return calcola('artigiani') + calcola('commercianti')
}

/**
 * Base dell'acconto gestione separata col metodo INPS: contributi sul reddito
 * G.S. annuo aggregato, con l'aliquota dell'anno in cui l'acconto si versa.
 */
export function baseSeparataAcconto(regimi: Regime[], annoCostanti: number): number {
  // Reddito imponibile arrotondato all'euro, come il calcolatore INPS.
  const reddito = Math.round(regimi.filter((r) => r.tipo === 'separata').reduce((s, r) => s + imponibileRegime(r), 0))
  return (reddito * datiFiscaliConFallback(annoCostanti).aliquotaSeparata) / 100
}

/**
 * Conguaglio contributivo di una gestione INPS: differenza, in NETTO, tra quanto
 * versato e quanto dovuto per quella gestione nella COMPETENZA dell'anno di
 * riferimento. Positivo = versato in più (credito); negativo = versato in meno.
 * Si compensa sulla prima rata calcolata sul reddito non ancora pagata (saldo →
 * acconti) della stessa gestione; non si mescolano gestioni diverse.
 *
 * IMPORTANTE: si considerano solo i versamenti di COMPETENZA dell'anno corrente
 * (rate fisse 1ª-3ª che si versano nell'anno + acconti eccedenza). Si ESCLUDONO
 * `ecc-saldo` e `fissi-4-prec`, che sono versamenti per la competenza dell'anno
 * PRECEDENTE (il loro conguaglio appartiene a quell'anno). Restano comunque
 * deducibili in dichiarazione: l'esclusione vale solo per questo conguaglio.
 *
 * `dovutoGestione` è il totale dovuto per quella gestione nella competenza (per
 * art/comm: fissi annuali + eccedenza; per G.S.: contributi G.S.).
 */
export function creditoContributivoGestione(
  dati: DatiAnno,
  gestione: 'artComm' | 'gs',
  dovutoGestione: number,
): number {
  if (dati.modalitaContributi !== 'dettaglio') return 0
  // Solo versamenti di competenza dell'anno corrente (no saldo/4ª-rata dell'anno prima)
  const tipiArtComm: TipoVersamento[] = ['fissi-1', 'fissi-2', 'fissi-3', 'ecc-acconto-1', 'ecc-acconto-2']
  const tipiGs: TipoVersamento[] = ['gs-acconto-1', 'gs-acconto-2']
  const tipi = gestione === 'gs' ? tipiGs : tipiArtComm
  const versato = dati.contributiVersati
    .filter((r) => tipi.includes(r.tipo))
    .reduce((s, r) => s + (r.importo ?? 0), 0)
  return Math.max(0, versato - dovutoGestione)
}

// ---------------------------------------------------------------------------
// Conteggio mesi (base per i contributi fissi Art/Comm)
// ---------------------------------------------------------------------------

/**
 * Conta i mesi interi coperti dal periodo, inclusi estremi.
 * Restituisce 0 se il periodo è invalido.
 */
export function getMesiInPeriodo(
  meseInizio: number,
  giornoInizio: number,
  meseFine: number,
  giornoFine: number,
): number {
  if (meseInizio < 1 || meseFine > 12 || meseInizio > meseFine) return 0
  if (giornoInizio < 1 || giornoFine < 1) return 0
  return meseFine - meseInizio + 1
}

// ---------------------------------------------------------------------------
// Riduzione IVS
// ---------------------------------------------------------------------------

/**
 * Applica la riduzione alla sola quota IVS, lasciando invariata la maternità.
 * La riduzione non si applica mai alla quota di maternità (non riducibile).
 */
export function applicaRiduzioneIVS(
  importoIVS: number,
  importoMaternitaNonRiducibile: number,
  riduzione: RiduzioneContributi,
): number {
  let ivsRidotto = importoIVS
  if (riduzione === '35') ivsRidotto *= 0.65
  else if (riduzione === '50') ivsRidotto *= 0.5
  return ivsRidotto + importoMaternitaNonRiducibile
}

// ---------------------------------------------------------------------------
// Rate contributi fissi (artigiani/commercianti)
// ---------------------------------------------------------------------------

export interface RataContributo {
  /** Data leggibile "GG Mese AAAA". */
  data: string
  descrizione: string
  importo: number
  /** Anno solare in cui la rata va versata (l'ultima cade nell'anno+1). */
  anno: number
  /** Indice del trimestre (0=1ª rata … 3=4ª rata). */
  rataIdx: number
}

export interface RisultatoRate {
  rate: RataContributo[]
  totaleContributi: number
}

/**
 * Calcola le rate trimestrali dei contributi fissi (artigiani/commercianti).
 *
 * La logica usa i mesi di competenza di ogni trimestre INPS per determinare
 * quante mensilità ricadono nel periodo del regime:
 * - Trim 1 → gen-mar  (scadenza 16 maggio anno corrente)
 * - Trim 2 → apr-giu  (scadenza 20 agosto)
 * - Trim 3 → lug-set  (scadenza 18 novembre)
 * - Trim 4 → ott-dic  (scadenza 17 febbraio anno+1)
 *
 * Il contributo mensile effettivo = ivsMensile×fattore + maternitàMensile.
 */
export function calcolaRateContributiFissi(regime: Regime, anno: number): RisultatoRate {
  const dati = datiFiscaliConFallback(anno)
  const cf = regime.tipo === 'commercianti' ? dati.contributoFisso.commercianti : dati.contributoFisso.artigiani
  const { ivsAnnuale, maternitaMensile } = cf
  const { rateContributiFissi } = dati.scadenze
  const label = labelTipo(regime.tipo)

  const ivsMensile = ivsAnnuale / 12
  const ivsMensileRidotto = applicaRiduzioneIVS(ivsMensile, 0, regime.riduzioneContributi)
  const mensileEffettivo = ivsMensileRidotto + maternitaMensile

  const trimestri = [
    { mesiCoperti: [1, 2, 3], rataIdx: 0, annoOffset: 0 },
    { mesiCoperti: [4, 5, 6], rataIdx: 1, annoOffset: 0 },
    { mesiCoperti: [7, 8, 9], rataIdx: 2, annoOffset: 0 },
    { mesiCoperti: [10, 11, 12], rataIdx: 3, annoOffset: 1 },
  ]

  const rate: RataContributo[] = []

  for (const trim of trimestri) {
    const mesiAttivi = trim.mesiCoperti.filter(
      (m) => m >= regime.meseInizio && m <= regime.meseFine,
    ).length

    if (mesiAttivi > 0) {
      // Ogni rata trimestrale è arrotondata a 2 decimali, come fa l'INPS sul
      // modello F24 (le rate si versano al centesimo, non con frazioni).
      const importo = Math.round(mensileEffettivo * mesiAttivi * 100) / 100
      const annoVers = anno + trim.annoOffset
      rate.push({
        data: formattaScadenza(rateContributiFissi[trim.rataIdx], annoVers),
        descrizione: `Contributi fissi ${label} ${anno} (${mesiAttivi} mes${mesiAttivi > 1 ? 'i' : 'e'} trim. ${trim.rataIdx + 1})`,
        importo,
        anno: annoVers,
        rataIdx: trim.rataIdx,
      })
    }
  }

  const mesiTotali = getMesiInPeriodo(
    regime.meseInizio, regime.giornoInizio,
    regime.meseFine, regime.giornoFine,
  )
  const totaleContributi = mensileEffettivo * mesiTotali

  return { rate, totaleContributi }
}

const TRIMESTRI_MESI: number[][] = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]]

/**
 * Importo di ciascuna delle 4 rate trimestrali per un singolo regime Art/Comm.
 * Ogni rata = contributo mensile × mesi attivi nel trimestre (mesi INTERI,
 * regola INPS: il mese conta intero anche se attivo un solo giorno). Per i
 * regimi in gestione separata restituisce tutte zero.
 */
export function rateFissePerTrimestre(regime: Regime, anno: number): [number, number, number, number] {
  if (regime.tipo === 'separata') return [0, 0, 0, 0]
  const dati = datiFiscaliConFallback(anno)
  const { ivsAnnuale, maternitaMensile } =
    regime.tipo === 'commercianti' ? dati.contributoFisso.commercianti : dati.contributoFisso.artigiani
  const ivsMensileRidotto = applicaRiduzioneIVS(ivsAnnuale / 12, 0, regime.riduzioneContributi)
  const mensileEffettivo = ivsMensileRidotto + maternitaMensile

  return TRIMESTRI_MESI.map((mesi) => {
    const mesiAttivi = mesi.filter((m) => m >= regime.meseInizio && m <= regime.meseFine).length
    return mensileEffettivo * mesiAttivi
  }) as [number, number, number, number]
}
