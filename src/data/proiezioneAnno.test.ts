import { describe, it, expect } from 'vitest'
import { proiettaDatiAnno } from './proiezioneAnno'
import { anniDisponibili, datiAnno } from './taxData'

describe('proiettaDatiAnno', () => {
  it('proietta un anno futuro continuando il trend di crescita', () => {
    const piuRecente = anniDisponibili()[0]
    const stima = proiettaDatiAnno(piuRecente + 1)!
    const ultimo = datiAnno(piuRecente)
    // IVS e minimale crescono storicamente → la proiezione supera l'ultimo noto
    expect(stima.contributoFisso.artigiani.ivsAnnuale).toBeGreaterThan(ultimo.contributoFisso.artigiani.ivsAnnuale)
    expect(stima.minimaleReddito).toBeGreaterThan(ultimo.minimaleReddito)
  })

  it('eredita aliquote e scadenze dall\'anno più recente', () => {
    const piuRecente = anniDisponibili()[0]
    const stima = proiettaDatiAnno(piuRecente + 1)!
    const ultimo = datiAnno(piuRecente)
    expect(stima.aliquotaArtigiani).toBe(ultimo.aliquotaArtigiani)
    expect(stima.aliquotaSeparata).toBe(ultimo.aliquotaSeparata)
    expect(stima.scadenze).toEqual(ultimo.scadenze)
  })

  it('valori arrotondati a 2 decimali', () => {
    const stima = proiettaDatiAnno(anniDisponibili()[0] + 1)!
    const v = stima.contributoFisso.artigiani.ivsAnnuale
    expect(Math.round(v * 100) / 100).toBe(v)
  })

  it('produce un DatiAnno valido (campi tutti presenti e positivi)', () => {
    const s = proiettaDatiAnno(anniDisponibili()[0] + 5)!
    expect(s.minimaleReddito).toBeGreaterThan(0)
    expect(s.sogliaPrimaFascia).toBeGreaterThan(0)
    expect(s.contributoFisso.commercianti.ivsAnnuale).toBeGreaterThan(0)
  })
})
