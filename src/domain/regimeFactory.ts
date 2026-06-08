import type { Regime } from '@/domain/types'

let contatore = 0
const nuovoId = () => `regime-${++contatore}`

/**
 * Crea un regime vuoto senza dati precompilati, con periodo sull'anno intero
 * come punto di partenza neutro da compilare.
 */
export function regimeVuoto(): Regime {
  return {
    id: nuovoId(),
    tipo: 'separata',
    aliquota: 15,
    coefficiente: 67,
    meseInizio: 1,
    giornoInizio: 1,
    meseFine: 12,
    giornoFine: 31,
    fatturato: 0,
    riduzioneContributi: 'nessuna',
  }
}
