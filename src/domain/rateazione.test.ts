import { describe, it, expect } from 'vitest'
import {
  MAGGIORAZIONE_LUGLIO,
  numeroRateMax,
  normalizzaOpzioni,
  rateazioneNeutra,
  calcolaPianoRateazione,
  espandiRateazione,
} from './rateazione'
import type { Scadenza } from './types'

// I valori attesi replicano il software ufficiale "Redditi PF" (Agenzia delle
// Entrate, sogei.f24uniNN.utility.Costanti): calcoli in centesimi interi,
// quota = floor(totale/n) col resto sulla prima rata, interessi per rata
// arrotondati al centesimo con le aliquote cumulate 0,33%/mese.

describe('numeroRateMax', () => {
  it('da giugno fino a 7 rate', () => expect(numeroRateMax('giugno')).toBe(7))
  it('da luglio fino a 6 rate', () => expect(numeroRateMax('luglio')).toBe(6))
})

describe('normalizzaOpzioni / rateazioneNeutra', () => {
  it('clampa il numero di rate al massimo consentito', () => {
    expect(normalizzaOpzioni({ inizio: 'giugno', numeroRate: 9 }).numeroRate).toBe(7)
    expect(normalizzaOpzioni({ inizio: 'luglio', numeroRate: 7 }).numeroRate).toBe(6)
    expect(normalizzaOpzioni({ inizio: 'giugno', numeroRate: 0 }).numeroRate).toBe(1)
  })
  it('rata unica a giugno è neutra, a luglio no (maggiorazione)', () => {
    expect(rateazioneNeutra({ inizio: 'giugno', numeroRate: 1 })).toBe(true)
    expect(rateazioneNeutra({ inizio: 'luglio', numeroRate: 1 })).toBe(false)
    expect(rateazioneNeutra({ inizio: 'giugno', numeroRate: 2 })).toBe(false)
  })
})

describe('calcolaPianoRateazione — da giugno', () => {
  // 992,35 € in 7 rate: 99235 centesimi → quota 14176, resto 3 sulla 1ª rata.
  const piano = calcolaPianoRateazione(992.35, { inizio: 'giugno', numeroRate: 7 })

  it('aliquote interessi della tabella ufficiale', () => {
    expect(piano.rate.map((r) => r.aliquotaInteressi)).toEqual([
      0, 0.0018, 0.0051, 0.0084, 0.0117, 0.015, 0.0183,
    ])
  })

  it('quota = floor(totale/n) col resto sulla prima rata', () => {
    expect(piano.rate[0].quota).toBeCloseTo(141.79, 2)
    for (const rata of piano.rate.slice(1)) expect(rata.quota).toBeCloseTo(141.76, 2)
  })

  it('le quote ricompongono esattamente l\'importo originario', () => {
    const somma = piano.rate.reduce((s, r) => s + r.quota, 0)
    expect(somma).toBeCloseTo(992.35, 2)
    expect(piano.maggiorazione).toBe(0)
  })

  it('interessi per rata arrotondati al centesimo (round, come il software AdE)', () => {
    // round(14176 × aliquota) in centesimi
    expect(piano.rate.map((r) => r.interessi)).toEqual([0, 0.26, 0.72, 1.19, 1.66, 2.13, 2.59])
    expect(piano.totaleInteressi).toBeCloseTo(8.55, 2)
    expect(piano.totale).toBeCloseTo(1000.9, 2)
  })

  it('date nominali: 30/06 poi il 16 del mese (20 ad agosto)', () => {
    expect(piano.rate.map((r) => r.dataMMGG)).toEqual([
      '06-30', '07-16', '08-20', '09-16', '10-16', '11-16', '12-16',
    ])
  })
})

describe('calcolaPianoRateazione — da luglio', () => {
  // 992,35 €: maggiorazione 0,4% = round(99235 × 0.004) = 397 centesimi.
  const piano = calcolaPianoRateazione(992.35, { inizio: 'luglio', numeroRate: 6 })

  it('maggiorazione 0,4% sull\'intero importo, poi suddivisione in rate', () => {
    expect(MAGGIORAZIONE_LUGLIO).toBe(0.004)
    expect(piano.maggiorazione).toBeCloseTo(3.97, 2)
    const sommaQuote = piano.rate.reduce((s, r) => s + r.quota, 0)
    expect(sommaQuote).toBeCloseTo(992.35 + 3.97, 2)
  })

  it('quota = floor((totale+maggiorazione)/n) col resto sulla prima rata', () => {
    // 99632 centesimi / 6 → 16605, resto 2.
    expect(piano.rate[0].quota).toBeCloseTo(166.07, 2)
    for (const rata of piano.rate.slice(1)) expect(rata.quota).toBeCloseTo(166.05, 2)
  })

  it('stesse aliquote di giugno, limitate a 6 rate', () => {
    expect(piano.rate.map((r) => r.aliquotaInteressi)).toEqual([
      0, 0.0018, 0.0051, 0.0084, 0.0117, 0.015,
    ])
  })

  it('date nominali: 30/07 poi il 16 del mese (20 ad agosto)', () => {
    expect(piano.rate.map((r) => r.dataMMGG)).toEqual([
      '07-30', '08-20', '09-16', '10-16', '11-16', '12-16',
    ])
  })
})

describe('espandiRateazione', () => {
  const scadenza: Scadenza = {
    data: '30 Giugno 2026',
    descrizione: 'Saldo imposta sostitutiva 2025',
    categoria: 'Imposta sostitutiva',
    voce: 'Saldo · competenza 2025',
    importo: 992.35,
    componenti: [{ tipo: 'Saldo imposte 2025', importo: 992.35 }],
    annoScadenza: 2026,
    riferimenti: ['imposta-saldo'],
    chiaveRateazione: 'saldo-2025',
  }

  it('opzioni neutre: scadenza invariata', () => {
    const out = espandiRateazione(scadenza, { inizio: 'giugno', numeroRate: 1 })
    expect(out).toEqual([scadenza])
  })

  it('7 rate: una riga per rata, totale = importo + interessi', () => {
    const out = espandiRateazione(scadenza, { inizio: 'giugno', numeroRate: 7 })
    expect(out).toHaveLength(7)
    const totale = out.reduce((s, r) => s + r.importo, 0)
    expect(totale).toBeCloseTo(1000.9, 2)
    expect(out[0].data).toBe('30 Giugno 2026')
    expect(out[1].data).toBe('16 Luglio 2026')
    expect(out[2].data).toBe('20 Agosto 2026')
    expect(out[6].data).toBe('16 Dicembre 2026')
    // Con più rate il collegamento ai versamenti non è più significativo.
    for (const r of out) expect(r.riferimenti).toBeUndefined()
    // La chiave e l'importo originario restano per riconfigurare il piano.
    for (const r of out) {
      expect(r.chiaveRateazione).toBe('saldo-2025')
      expect(r.importoRateazioneBase).toBeCloseTo(992.35, 2)
    }
  })

  it('rata unica differita a luglio: una riga maggiorata, ancora tracciabile', () => {
    const out = espandiRateazione(scadenza, { inizio: 'luglio', numeroRate: 1 })
    expect(out).toHaveLength(1)
    expect(out[0].data).toBe('30 Luglio 2026')
    expect(out[0].importo).toBeCloseTo(996.32, 2)
    expect(out[0].riferimenti).toEqual(['imposta-saldo'])
  })
})
