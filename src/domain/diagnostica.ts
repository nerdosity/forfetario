import type { CalcoloInput } from './types'

/** Avviso informativo non bloccante, derivato dall'input. */
export interface Avviso {
  id: string
  messaggio: string
}

/**
 * Avvisi di coerenza con l'inizio dell'attività. Restituisce un elenco vuoto
 * se il campo non è compilato. Non influisce sui calcoli.
 */
export function avvisiInizioAttivita(input: CalcoloInput): Avviso[] {
  const inizio = input.inizioAttivita
  if (!inizio) return []
  const avvisi: Avviso[] = []
  const indiceInizio = inizio.anno * 12 + (inizio.mese - 1)

  const anni = Object.keys(input.anni).map(Number).sort((a, b) => a - b)
  for (const anno of anni) {
    const regimi = input.anni[anno].regimi

    if (anno > inizio.anno + 4 && regimi.some((r) => r.aliquota === 5)) {
      avvisi.push({
        id: `startup-scaduto-${anno}`,
        messaggio: `Anno ${anno}: il 5% start-up vale per 5 anni (anno di inizio e i 4 successivi); dal ${inizio.anno + 5} si applica il 15%.`,
      })
    }

    if (anno < inizio.anno && regimi.some((r) => r.aliquota === 5 || r.riduzioneContributi === '50')) {
      avvisi.push({
        id: `precedente-inizio-${anno}`,
        messaggio: `Anno ${anno}: aliquota 5% o riduzione del 50% indicate in un anno precedente all'inizio dell'attività (${inizio.anno}).`,
      })
    }

    if (
      regimi.some(
        (r) => r.riduzioneContributi === '50' && anno * 12 + (r.meseInizio - 1) - indiceInizio >= 36,
      )
    ) {
      avvisi.push({
        id: `riduzione-50-oltre-36-mesi-${anno}`,
        messaggio: `Anno ${anno}: la riduzione del 50% dura 36 mesi dall'inizio dell'attività.`,
      })
    }
  }
  return avvisi
}
