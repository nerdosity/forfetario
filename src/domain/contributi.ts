import type { CalcoloInput, Regime, RiduzioneContributi, TipoVersamento } from '@/domain/types'
import { contributoFissoAnno, datiAnno } from '@/data/taxData'
import { formattaScadenza } from '@/domain/dates'
import { labelTipo } from '@/domain/labels'

/**
 * Valore effettivo dei contributi versati nell'anno, usato per la deducibilità.
 * Dipende dalla modalità: cifra unica manuale oppure somma delle righe di
 * dettaglio. Tenere separate le due fonti evita di perdere dati allo switch.
 */
export function contributiVersatiEffettivi(input: CalcoloInput): number {
  if (input.modalitaContributiVersati === 'dettaglio') {
    return input.contributiVersatiDettaglio.reduce((s, r) => s + (r.importo ?? 0), 0)
  }
  return input.contributiVersatiDuranteAnno ?? 0
}

/**
 * Somma degli acconti versati per una categoria, estratti dalla lista di
 * dettaglio (solo in modalità 'dettaglio'). Ogni acconto ha due rate (giugno e
 * novembre): le sommiamo entrambe. In modalità 'cifra unica' non c'è dettaglio,
 * quindi 0.
 */
export function accontoVersatoDaLista(input: CalcoloInput, categoria: 'gs' | 'ecc'): number {
  if (input.modalitaContributiVersati !== 'dettaglio') return 0
  const tipi: TipoVersamento[] =
    categoria === 'gs' ? ['gs-acconto-1', 'gs-acconto-2'] : ['ecc-acconto-1', 'ecc-acconto-2']
  return input.contributiVersatiDettaglio
    .filter((r) => tipi.includes(r.tipo))
    .reduce((s, r) => s + (r.importo ?? 0), 0)
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
  const { ivsAnnuale, maternitaMensile } = contributoFissoAnno(anno, regime.tipo)
  const { rateContributiFissi } = datiAnno(anno).scadenze
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
      const importo = mensileEffettivo * mesiAttivi
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
  const { ivsAnnuale, maternitaMensile } = contributoFissoAnno(anno, regime.tipo)
  const ivsMensileRidotto = applicaRiduzioneIVS(ivsAnnuale / 12, 0, regime.riduzioneContributi)
  const mensileEffettivo = ivsMensileRidotto + maternitaMensile

  return TRIMESTRI_MESI.map((mesi) => {
    const mesiAttivi = mesi.filter((m) => m >= regime.meseInizio && m <= regime.meseFine).length
    return mensileEffettivo * mesiAttivi
  }) as [number, number, number, number]
}
