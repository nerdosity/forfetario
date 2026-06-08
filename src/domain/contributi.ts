import type { Regime, RiduzioneContributi } from '@/domain/types'
import { contributoFissoAnno, datiAnno } from '@/data/taxData'
import { formattaScadenza } from '@/domain/dates'
import { labelTipo } from '@/domain/labels'

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
