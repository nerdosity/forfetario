import { describe, it, expect } from 'vitest'
import { attenua, type Evidenza } from './SankeyFlusso'
import { costruisciSankey, type IngressoSankey } from '@/domain/sankey'

/** Stessi dati reali del test di dominio, così la topologia è quella vera. */
const reale: IngressoSankey = {
  fatturato: 51_574.0,
  imponibileLordo: 34_554.58,
  contributiINPS: 5_398.02,
  imposte: 4_059.49,
  contributiSeparata: 0,
  contributiFissiArtComm: 2_902.02,
  contributiEccedenzaArtComm: 2_496.0,
}

const grafico = costruisciSankey(reale, { larghezza: 464, altezza: 340, margineEtichette: 0 })
const nodo = (id: string) => grafico.nodi.find((n) => n.id === id)!
const nastro = (da: string, a: string) => grafico.nastri.find((n) => n.da === da && n.a === a)!

const evidenziaNodo = (id: string): Evidenza => ({ tipo: 'nodo', id })
const evidenziaNastro = (da: string, a: string): Evidenza => {
  const n = nastro(da, a)
  return { tipo: 'nastro', id: n.id, da: n.da, a: n.a }
}

describe('attenua — nessuna evidenza', () => {
  it('senza evidenza nulla viene attenuato', () => {
    for (const n of grafico.nodi) expect(attenua(null, { tipo: 'nodo', nodo: n })).toBe(false)
    for (const n of grafico.nastri) expect(attenua(null, { tipo: 'nastro', nastro: n })).toBe(false)
  })
})

describe('attenua — nodo evidenziato', () => {
  const evidenza = evidenziaNodo('contributi')

  it('il nodo sotto il cursore resta pieno', () => {
    expect(attenua(evidenza, { tipo: 'nodo', nodo: nodo('contributi') })).toBe(false)
  })

  it('gli altri nodi vengono attenuati', () => {
    expect(attenua(evidenza, { tipo: 'nodo', nodo: nodo('netto') })).toBe(true)
    expect(attenua(evidenza, { tipo: 'nodo', nodo: nodo('fatturato') })).toBe(true)
  })

  it('tutti i nastri entranti nel nodo restano pieni', () => {
    for (const n of grafico.nastri.filter((n) => n.a === 'contributi')) {
      expect(attenua(evidenza, { tipo: 'nastro', nastro: n })).toBe(false)
    }
  })

  it('tutti i nastri uscenti dal nodo restano pieni', () => {
    const uscenti = grafico.nastri.filter((n) => n.da === 'contributi')
    expect(uscenti.length).toBeGreaterThan(0)
    for (const n of uscenti) {
      expect(attenua(evidenza, { tipo: 'nastro', nastro: n })).toBe(false)
    }
  })

  it('i nastri che non toccano il nodo vengono attenuati', () => {
    expect(attenua(evidenza, { tipo: 'nastro', nastro: nastro('imponibile', 'netto') })).toBe(true)
    expect(attenua(evidenza, { tipo: 'nastro', nastro: nastro('fatturato', 'imponibile') })).toBe(true)
  })
})

describe('attenua — nastro evidenziato', () => {
  const evidenza = evidenziaNastro('imponibile', 'contributi')

  it('il nastro sotto il cursore resta pieno', () => {
    expect(attenua(evidenza, { tipo: 'nastro', nastro: nastro('imponibile', 'contributi') })).toBe(false)
  })

  it('gli altri nastri vengono attenuati', () => {
    expect(attenua(evidenza, { tipo: 'nastro', nastro: nastro('imponibile', 'netto') })).toBe(true)
    expect(attenua(evidenza, { tipo: 'nastro', nastro: nastro('nonImponibile', 'contributi') })).toBe(true)
  })

  it('i due nodi collegati dal nastro restano pieni', () => {
    expect(attenua(evidenza, { tipo: 'nodo', nodo: nodo('imponibile') })).toBe(false)
    expect(attenua(evidenza, { tipo: 'nodo', nodo: nodo('contributi') })).toBe(false)
  })

  it('gli altri nodi vengono attenuati', () => {
    expect(attenua(evidenza, { tipo: 'nodo', nodo: nodo('netto') })).toBe(true)
    expect(attenua(evidenza, { tipo: 'nodo', nodo: nodo('fatturato') })).toBe(true)
  })

  it('funziona anche su un nastro fra nodi con id composti', () => {
    // 'contributi-fissi': i capi arrivano dallo stato, non dallo split dell'id.
    const e = evidenziaNastro('contributi', 'fissi')
    expect(attenua(e, { tipo: 'nodo', nodo: nodo('contributi') })).toBe(false)
    expect(attenua(e, { tipo: 'nodo', nodo: nodo('fissi') })).toBe(false)
    expect(attenua(e, { tipo: 'nodo', nodo: nodo('ecc') })).toBe(true)
  })
})

describe('attenua — esattamente un percorso per volta', () => {
  it('evidenziando un nodo restano pieni il nodo e i soli nastri adiacenti', () => {
    const evidenza = evidenziaNodo('netto')
    const pieni = grafico.nastri.filter((n) => !attenua(evidenza, { tipo: 'nastro', nastro: n }))
    const attesi = grafico.nastri.filter((n) => n.da === 'netto' || n.a === 'netto')
    expect(pieni.map((n) => n.id).sort()).toEqual(attesi.map((n) => n.id).sort())
  })
})
