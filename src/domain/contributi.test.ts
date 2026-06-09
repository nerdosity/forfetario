import { describe, it, expect } from 'vitest'
import { getMesiInPeriodo, applicaRiduzioneIVS, calcolaRateContributiFissi } from './contributi'
import type { Regime } from './types'

describe('getMesiInPeriodo', () => {
  it('anno intero → 12', () => expect(getMesiInPeriodo(1, 1, 12, 31)).toBe(12))
  it('mar-dic → 10', () => expect(getMesiInPeriodo(3, 1, 12, 31)).toBe(10))
  it('mese singolo → 1', () => expect(getMesiInPeriodo(6, 1, 6, 30)).toBe(1))
  it('meseInizio > meseFine → 0', () => expect(getMesiInPeriodo(12, 1, 3, 31)).toBe(0))

  // Regola INPS contributi fissi: il mese conta intero anche se attivo un solo
  // giorno. Il giorno NON cambia il conteggio (vale "dal 1° del mese").
  it('ingresso a metà mese: gen 1 → feb 14 conta comunque 2 mesi', () =>
    expect(getMesiInPeriodo(1, 1, 2, 14)).toBe(2))
  it('uscita a metà mese: feb 15 → dic 31 conta comunque 11 mesi', () =>
    expect(getMesiInPeriodo(2, 15, 12, 31)).toBe(11))
  it('stesso mese, frazione di giorni: feb 10 → feb 14 conta 1 mese', () =>
    expect(getMesiInPeriodo(2, 10, 2, 14)).toBe(1))
})

describe('applicaRiduzioneIVS', () => {
  it('nessuna riduzione: restituisce ivs + maternità invariati', () =>
    expect(applicaRiduzioneIVS(100, 10, 'nessuna')).toBeCloseTo(110))
  it('riduzione 35%: ivs × 0.65 + maternità', () =>
    expect(applicaRiduzioneIVS(100, 10, '35')).toBeCloseTo(75))
  it('riduzione 50%: ivs × 0.5 + maternità', () =>
    expect(applicaRiduzioneIVS(100, 10, '50')).toBeCloseTo(60))
  it('maternità non ridotta (riduzione 35%)', () =>
    expect(applicaRiduzioneIVS(0, 10, '35')).toBeCloseTo(10))
})

const regimeArtigianoAnnoIntero: Regime = {
  id: 'test-1',
  tipo: 'artigiani',
  aliquota: 15,
  coefficiente: 67,
  meseInizio: 1, giornoInizio: 1,
  meseFine: 12, giornoFine: 31,
  fatturato: 30000,
  riduzioneContributi: 'nessuna',
}

describe('calcolaRateContributiFissi', () => {
  it('anno intero → 4 rate', () => {
    const { rate } = calcolaRateContributiFissi(regimeArtigianoAnnoIntero, 2024)
    expect(rate).toHaveLength(4)
  })

  it('totaleContributi > 0 per anno intero 2024', () => {
    const { totaleContributi } = calcolaRateContributiFissi(regimeArtigianoAnnoIntero, 2024)
    expect(totaleContributi).toBeGreaterThan(0)
  })

  it('ingresso a marzo → 4 rate, l\'ultima a febbraio anno+1', () => {
    const regime: Regime = { ...regimeArtigianoAnnoIntero, meseInizio: 3, giornoInizio: 1 }
    const { rate } = calcolaRateContributiFissi(regime, 2024)
    // trim 1 (gen-mar) → mesi 3 attivi; trim 2, 3, 4 → 3 mesi ciascuno
    expect(rate).toHaveLength(4)
    const ultime = rate.filter((r) => r.anno === 2025)
    expect(ultime).toHaveLength(1)
  })

  it('ingresso a settembre → 2 rate (trim 3: set; trim 4: ott-dic)', () => {
    // meseInizio=9, meseFine=12: settembre rientra nel trim 3 (lug-set), ott-dic nel trim 4
    const regime: Regime = { ...regimeArtigianoAnnoIntero, meseInizio: 9, giornoInizio: 1 }
    const { rate } = calcolaRateContributiFissi(regime, 2024)
    expect(rate).toHaveLength(2)
    const ultima = rate.find((r) => r.anno === 2025)
    expect(ultima).toBeDefined()
  })

  it('riduzione 35% riduce totale contributi', () => {
    const ridotto: Regime = { ...regimeArtigianoAnnoIntero, riduzioneContributi: '35' }
    const { totaleContributi: pieno } = calcolaRateContributiFissi(regimeArtigianoAnnoIntero, 2024)
    const { totaleContributi: rid } = calcolaRateContributiFissi(ridotto, 2024)
    expect(rid).toBeLessThan(pieno)
  })
})
