import { describe, it, expect } from 'vitest'
import { avvisiInizioAttivita } from './diagnostica'
import { datiAnnoVuoto } from './types'
import type { CalcoloInput, Regime } from './types'

const regime = (p: Partial<Regime>): Regime => ({
  id: 'r', tipo: 'artigiani', aliquota: 15, coefficiente: 67,
  meseInizio: 1, giornoInizio: 1, meseFine: 12, giornoFine: 31,
  fatturato: 0, riduzioneContributi: 'nessuna', ...p,
})
const input = (anno: number, r: Partial<Regime>, inizio: CalcoloInput['inizioAttivita']): CalcoloInput => ({
  anno,
  anni: { [anno]: datiAnnoVuoto([regime(r)]) },
  rateazioniImposta: {},
  inizioAttivita: inizio,
})

describe('avvisiInizioAttivita', () => {
  it('nessun avviso se il campo non è compilato', () => {
    expect(avvisiInizioAttivita(input(2030, { aliquota: 5 }, null))).toEqual([])
  })
  it('segnala il 5% oltre i 5 anni e il 5% prima dell\'inizio', () => {
    const a = avvisiInizioAttivita(input(2030, { aliquota: 5 }, '2025-03-15'))
    expect(a.map((x) => x.id)).toEqual(['startup-scaduto-2030'])
    expect(a[0].messaggio).toContain('dal 2030 si applica il 15%')
    expect(avvisiInizioAttivita(input(2024, { aliquota: 5 }, '2025-03-15')).map((x) => x.id))
      .toEqual(['precedente-inizio-2024'])
    expect(avvisiInizioAttivita(input(2029, { aliquota: 5 }, '2025-03-15'))).toEqual([])
  })
  it('segnala la riduzione 50% oltre 36 mesi', () => {
    const r: Partial<Regime> = { riduzioneContributi: '50', meseInizio: 4 }
    expect(avvisiInizioAttivita(input(2028, r, '2025-03-15'))).toHaveLength(1)
    expect(avvisiInizioAttivita(input(2028, { ...r, meseInizio: 2 }, '2025-03-15'))).toEqual([])
  })
})
