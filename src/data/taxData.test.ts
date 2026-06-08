import { describe, it, expect } from 'vitest'
import { DATI_FISCALI, ANNI_DISPONIBILI, datiAnno, aliquotaContributi, contributoFissoAnno } from './taxData'

describe('DATI_FISCALI', () => {
  it('carica almeno 4 anni', () => {
    expect(Object.keys(DATI_FISCALI).length).toBeGreaterThanOrEqual(4)
  })

  it('ANNI_DISPONIBILI è ordinato discendente', () => {
    for (let i = 0; i < ANNI_DISPONIBILI.length - 1; i++) {
      expect(ANNI_DISPONIBILI[i]).toBeGreaterThan(ANNI_DISPONIBILI[i + 1])
    }
  })

  it('ogni anno ha i campi richiesti', () => {
    for (const dati of Object.values(DATI_FISCALI)) {
      expect(dati.minimaleReddito).toBeGreaterThan(0)
      expect(dati.sogliaPrimaFascia).toBeGreaterThan(dati.minimaleReddito)
      expect(dati.aliquotaSeparata).toBeGreaterThan(0)
      expect(dati.aliquotaArtigiani).toBeGreaterThan(0)
      expect(dati.aliquotaCommercianti).toBeGreaterThan(0)
      expect(dati.contributoFisso.artigiani.ivsAnnuale).toBeGreaterThan(0)
      expect(dati.contributoFisso.commercianti.ivsAnnuale).toBeGreaterThan(0)
      expect(dati.scadenze.rateContributiFissi).toHaveLength(4)
    }
  })
})

describe('datiAnno', () => {
  it('restituisce i dati per un anno esistente', () => {
    const d = datiAnno(2024)
    expect(d.minimaleReddito).toBe(18415)
    expect(d.sogliaPrimaFascia).toBe(55008)
  })

  it('lancia per un anno non presente', () => {
    expect(() => datiAnno(1900)).toThrow()
  })
})

describe('aliquotaContributi', () => {
  it('separata 2024 → 26.07', () => expect(aliquotaContributi(2024, 'separata')).toBe(26.07))
  it('artigiani → 24', () => expect(aliquotaContributi(2024, 'artigiani')).toBe(24))
  it('commercianti → 24.48', () => expect(aliquotaContributi(2024, 'commercianti')).toBe(24.48))
})

describe('contributoFissoAnno', () => {
  it('artigiani 2024 ivs > 0', () => {
    expect(contributoFissoAnno(2024, 'artigiani').ivsAnnuale).toBeGreaterThan(0)
  })
  it('separata → ivs = 0', () => {
    expect(contributoFissoAnno(2024, 'separata').ivsAnnuale).toBe(0)
  })
})
