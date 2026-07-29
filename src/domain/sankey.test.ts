import { describe, it, expect } from 'vitest'
import {
  clamp,
  normalizzaFigli,
  ripartisci,
  quotaSuFatturato,
  costruisciSankey,
  pathNastro,
  SOGLIA_RAMO,
  type IngressoSankey,
} from './sankey'

/** Caso base: gestione separata, coefficiente 78%, nessun contributo dedotto. */
const separata: IngressoSankey = {
  fatturato: 50_000,
  imponibileLordo: 39_000,
  contributiINPS: 10_140,
  imposte: 5_850,
  contributiSeparata: 10_140,
  contributiFissiArtComm: 0,
  contributiEccedenzaArtComm: 0,
}

/** Anno misto: separata + artigiani (fissi ed eccedenza tutti presenti). */
const misto: IngressoSankey = {
  fatturato: 60_000,
  imponibileLordo: 40_200,
  contributiINPS: 9_000,
  imposte: 4_680,
  contributiSeparata: 3_000,
  contributiFissiArtComm: 4_000,
  contributiEccedenzaArtComm: 2_000,
}

describe('clamp', () => {
  it('lascia passare i positivi', () => expect(clamp(12.5)).toBe(12.5))
  it('azzera i negativi', () => expect(clamp(-100)).toBe(0))
  it('azzera lo zero', () => expect(clamp(0)).toBe(0))
  it('azzera NaN', () => expect(clamp(NaN)).toBe(0))
  it('azzera Infinity', () => expect(clamp(Infinity)).toBe(0))
})

describe('normalizzaFigli', () => {
  it('lascia invariati i figli che stanno nel padre', () =>
    expect(normalizzaFigli([30, 20], 100)).toEqual([30, 20]))

  it('riscala proporzionalmente i figli che sforano il padre', () => {
    const [a, b] = normalizzaFigli([80, 40], 60)
    expect(a + b).toBeCloseTo(60, 6)
    expect(a / b).toBeCloseTo(2, 6)
  })

  it('somma esattamente pari al padre non viene riscalata', () =>
    expect(normalizzaFigli([50, 50], 100)).toEqual([50, 50]))

  it('padre a zero azzera tutti i figli', () =>
    expect(normalizzaFigli([10, 20], 0)).toEqual([0, 0]))

  it('padre negativo azzera tutti i figli', () =>
    expect(normalizzaFigli([10, 20], -5)).toEqual([0, 0]))

  it('i figli negativi vengono clampati a zero', () =>
    expect(normalizzaFigli([-10, 20], 100)).toEqual([0, 20]))

  it('tollera lo sforo da arrotondamento senza distorcere', () => {
    const [a, b] = normalizzaFigli([50.000000001, 50], 100)
    expect(a + b).toBeLessThanOrEqual(100.000000002)
    expect(b).toBeCloseTo(50, 6)
  })
})

describe('quotaSuFatturato', () => {
  it('calcola la quota', () => expect(quotaSuFatturato(25, 100)).toBe(0.25))
  it('fatturato zero → 0, nessun NaN', () => expect(quotaSuFatturato(25, 0)).toBe(0))
  it('fatturato negativo → 0', () => expect(quotaSuFatturato(25, -10)).toBe(0))
  it('valore maggiore del fatturato è limitato a 1', () => expect(quotaSuFatturato(200, 100)).toBe(1))
  it('valore negativo → 0', () => expect(quotaSuFatturato(-5, 100)).toBe(0))
})

describe('ripartisci', () => {
  it('la quota non imponibile completa l\'imponibile lordo', () => {
    const v = ripartisci(separata)
    expect(v.imponibileLordo + v.quotaNonImponibile).toBeCloseTo(v.fatturato, 6)
    expect(v.quotaNonImponibile).toBeCloseTo(11_000, 6)
  })

  it('netto = fatturato - contributi - imposta', () => {
    const v = ripartisci(separata)
    expect(v.nettoInTasca).toBeCloseTo(50_000 - 10_140 - 5_850, 6)
  })

  it('contributi + imposta + netto = fatturato', () => {
    const v = ripartisci(separata)
    expect(v.contributiINPS + v.imposte + v.nettoInTasca).toBeCloseTo(v.fatturato, 6)
  })

  it('le gestioni sommano ai contributi totali', () => {
    const v = ripartisci(misto)
    expect(v.separata + v.fissiArtComm + v.eccedenzaArtComm).toBeCloseTo(v.contributiINPS, 6)
  })

  it('imponibile lordo maggiore del fatturato viene limitato al fatturato', () => {
    const v = ripartisci({ fatturato: 1_000, imponibileLordo: 5_000, contributiINPS: 0, imposte: 0 })
    expect(v.imponibileLordo).toBe(1_000)
    expect(v.quotaNonImponibile).toBe(0)
  })

  it('contributi + imposta oltre il fatturato: netto resta zero, mai negativo', () => {
    const v = ripartisci({ fatturato: 1_000, imponibileLordo: 800, contributiINPS: 900, imposte: 600 })
    expect(v.nettoInTasca).toBe(0)
    expect(v.contributiINPS + v.imposte).toBeCloseTo(1_000, 6)
  })

  it('valori negativi in ingresso sono clampati a zero', () => {
    const v = ripartisci({ fatturato: -5_000, imponibileLordo: -100, contributiINPS: -1, imposte: -2 })
    expect(v).toMatchObject({ fatturato: 0, imponibileLordo: 0, contributiINPS: 0, imposte: 0, nettoInTasca: 0 })
  })

  it('fatturato zero non produce NaN in nessun campo', () => {
    const v = ripartisci({ fatturato: 0, imponibileLordo: 0, contributiINPS: 0, imposte: 0 })
    for (const valore of Object.values(v)) expect(Number.isNaN(valore)).toBe(false)
  })

  it('gestioni assenti (campi opzionali omessi) valgono zero', () => {
    const v = ripartisci({ fatturato: 10_000, imponibileLordo: 6_700, contributiINPS: 1_700, imposte: 750 })
    expect(v.separata).toBe(0)
    expect(v.fissiArtComm).toBe(0)
    expect(v.eccedenzaArtComm).toBe(0)
  })

  it('le due quote parte di una destinazione ne ricompongono il totale', () => {
    for (const ingresso of [separata, misto]) {
      const v = ripartisci(ingresso)
      for (const valore of [v.contributiINPS, v.imposte, v.nettoInTasca]) {
        expect(v.dalImponibile(valore) + v.dalNonImponibile(valore)).toBeCloseTo(valore, 6)
      }
    }
  })

  it('la quota parte segue il peso dell\'imponibile sul fatturato', () => {
    // 39.000 su 50.000 = 78%
    const v = ripartisci(separata)
    expect(v.dalImponibile(10_000)).toBeCloseTo(7_800, 6)
    expect(v.dalNonImponibile(10_000)).toBeCloseTo(2_200, 6)
  })

  it('fatturato zero: le quote parte non producono NaN', () => {
    const v = ripartisci({ fatturato: 0, imponibileLordo: 0, contributiINPS: 0, imposte: 0 })
    expect(v.dalImponibile(0)).toBe(0)
    expect(v.dalNonImponibile(0)).toBe(0)
  })

  it('coefficiente 100%: tutto imputato all\'imponibile', () => {
    const v = ripartisci({ fatturato: 10_000, imponibileLordo: 10_000, contributiINPS: 2_600, imposte: 1_110 })
    expect(v.dalImponibile(1_000)).toBeCloseTo(1_000, 6)
    expect(v.dalNonImponibile(1_000)).toBeCloseTo(0, 6)
  })
})

describe('costruisciSankey — stato vuoto', () => {
  it('fatturato zero → haDati false, nessun nodo né nastro', () => {
    const g = costruisciSankey({ fatturato: 0, imponibileLordo: 0, contributiINPS: 0, imposte: 0 })
    expect(g.haDati).toBe(false)
    expect(g.nodi).toHaveLength(0)
    expect(g.nastri).toHaveLength(0)
  })

  it('fatturato sotto soglia → haDati false', () => {
    const g = costruisciSankey({ fatturato: SOGLIA_RAMO / 2, imponibileLordo: 0, contributiINPS: 0, imposte: 0 })
    expect(g.haDati).toBe(false)
  })

  it('fatturato negativo → haDati false', () => {
    const g = costruisciSankey({ fatturato: -1_000, imponibileLordo: 0, contributiINPS: 0, imposte: 0 })
    expect(g.haDati).toBe(false)
  })
})

describe('costruisciSankey — grafo', () => {
  it('crea i nodi principali del flusso', () => {
    const g = costruisciSankey(separata)
    const ids = g.nodi.map((n) => n.id)
    expect(ids).toContain('fatturato')
    expect(ids).toContain('nonImponibile')
    expect(ids).toContain('imponibile')
    expect(ids).toContain('contributi')
    expect(ids).toContain('imposta')
    expect(ids).toContain('netto')
  })

  it('con una sola gestione non aggiunge la colonna di suddivisione', () => {
    const g = costruisciSankey(separata)
    expect(g.nodi.some((n) => n.colonna === 3)).toBe(false)
  })

  it('senza gestioni l\'ultima colonna etichetta a destra, nella corsia esterna', () => {
    const g = costruisciSankey(separata)
    for (const id of ['contributi', 'imposta', 'netto']) {
      expect(g.nodi.find((n) => n.id === id)?.posizioneEtichetta).toBe('destra')
    }
  })

  it('con le gestioni la colonna 2 diventa interna e etichetta sopra', () => {
    const g = costruisciSankey(misto)
    for (const id of ['contributi', 'imposta', 'netto']) {
      expect(g.nodi.find((n) => n.id === id)?.posizioneEtichetta).toBe('sopra')
    }
    for (const id of ['gs', 'fissi', 'ecc']) {
      expect(g.nodi.find((n) => n.id === id)?.posizioneEtichetta).toBe('destra')
    }
  })

  it('il fatturato etichetta a sinistra, le colonne intermedie sopra', () => {
    const g = costruisciSankey(misto)
    expect(g.nodi.find((n) => n.id === 'fatturato')?.posizioneEtichetta).toBe('sinistra')
    expect(g.nodi.find((n) => n.id === 'imponibile')?.posizioneEtichetta).toBe('sopra')
    expect(g.nodi.find((n) => n.id === 'nonImponibile')?.posizioneEtichetta).toBe('sopra')
  })

  it('lascia spazio verticale sopra ogni nodo con etichetta "sopra"', () => {
    // Le etichette 'sopra' occupano ~28 unità sopra il bordo del nodo: serve
    // margine dal bordo del viewBox e dal nodo precedente della stessa colonna.
    const g = costruisciSankey(misto, { larghezza: 464, altezza: 340, margineEtichette: 0 })
    const conSopra = g.nodi.filter((n) => n.posizioneEtichetta === 'sopra')
    expect(conSopra.length).toBeGreaterThan(0)
    for (const nodo of conSopra) {
      expect(nodo.y).toBeGreaterThanOrEqual(28)
      const precedente = g.nodi
        .filter((n) => n.colonna === nodo.colonna && n.y < nodo.y)
        .sort((a, b) => b.y - a.y)[0]
      if (precedente) {
        expect(nodo.y - (precedente.y + precedente.altezza)).toBeGreaterThanOrEqual(28)
      }
    }
  })

  it('con più gestioni aggiunge un nodo per ciascuna', () => {
    const g = costruisciSankey(misto)
    const gestioni = g.nodi.filter((n) => n.colonna === 3).map((n) => n.id)
    expect(gestioni).toEqual(['gs', 'fissi', 'ecc'])
  })

  it('le gestioni sotto soglia non compaiono', () => {
    const g = costruisciSankey({ ...misto, contributiSeparata: 0.001, contributiFissiArtComm: 5_000, contributiEccedenzaArtComm: 3_999 })
    const gestioni = g.nodi.filter((n) => n.colonna === 3).map((n) => n.id)
    expect(gestioni).toEqual(['fissi', 'ecc'])
  })

  it('i rami di valore nullo non generano nodi (coefficiente 100%)', () => {
    const g = costruisciSankey({ fatturato: 10_000, imponibileLordo: 10_000, contributiINPS: 2_600, imposte: 1_110 })
    expect(g.nodi.some((n) => n.id === 'nonImponibile')).toBe(false)
    expect(g.nastri.some((n) => n.a === 'nonImponibile')).toBe(false)
    expect(g.nastri.some((n) => n.da === 'nonImponibile')).toBe(false)
  })

  it('ogni destinazione riceve un nastro da entrambi i secchielli della colonna 1', () => {
    const g = costruisciSankey(separata)
    for (const destinazione of ['contributi', 'imposta', 'netto']) {
      const entranti = g.nastri.filter((n) => n.a === destinazione).map((n) => n.da).sort()
      expect(entranti).toEqual(['imponibile', 'nonImponibile'])
    }
  })

  it('con coefficiente 100% le destinazioni ricevono solo dall\'imponibile', () => {
    const g = costruisciSankey({ fatturato: 10_000, imponibileLordo: 10_000, contributiINPS: 2_600, imposte: 1_110 })
    for (const nastro of g.nastri) expect(nastro.da).not.toBe('nonImponibile')
  })

  it('nessun nastro punta a un nodo assente', () => {
    const g = costruisciSankey(misto)
    const ids = new Set(g.nodi.map((n) => n.id))
    for (const nastro of g.nastri) {
      expect(ids.has(nastro.da)).toBe(true)
      expect(ids.has(nastro.a)).toBe(true)
    }
  })

  it('la somma dei nastri uscenti da un nodo non supera il nodo stesso', () => {
    const stress: IngressoSankey = { fatturato: 10_000, imponibileLordo: 4_000, contributiINPS: 3_000, imposte: 1_500 }
    for (const g of [costruisciSankey(separata), costruisciSankey(misto), costruisciSankey(stress)]) {
      for (const nodo of g.nodi) {
        const uscenti = g.nastri.filter((n) => n.da === nodo.id)
        if (uscenti.length === 0) continue
        const somma = uscenti.reduce((a, n) => a + n.valore, 0)
        expect(somma).toBeLessThanOrEqual(nodo.valore + 1e-6)
      }
    }
  })

  it('i nastri uscenti dal fatturato lo saturano esattamente', () => {
    const g = costruisciSankey(separata)
    const somma = g.nastri.filter((n) => n.da === 'fatturato').reduce((a, n) => a + n.valore, 0)
    expect(somma).toBeCloseTo(50_000, 6)
  })

  it('i nastri entranti in un nodo lo saturano esattamente', () => {
    const g = costruisciSankey(misto)
    for (const nodo of g.nodi.filter((n) => n.id !== 'fatturato')) {
      const entranti = g.nastri.filter((n) => n.a === nodo.id)
      const somma = entranti.reduce((a, n) => a + n.valore, 0)
      expect(somma).toBeCloseTo(nodo.valore, 6)
    }
  })

  it('le quote sono coerenti col fatturato e mai fuori da 0-1', () => {
    const g = costruisciSankey(misto)
    for (const nodo of g.nodi) {
      expect(nodo.quota).toBeGreaterThanOrEqual(0)
      expect(nodo.quota).toBeLessThanOrEqual(1)
      expect(nodo.quota).toBeCloseTo(nodo.valore / 60_000, 6)
    }
    expect(g.nodi.find((n) => n.id === 'fatturato')?.quota).toBe(1)
  })

  it('tutti i nodi stanno dentro il viewBox', () => {
    const g = costruisciSankey(misto, { larghezza: 720, altezza: 380 })
    for (const nodo of g.nodi) {
      expect(nodo.x).toBeGreaterThanOrEqual(0)
      expect(nodo.x + nodo.larghezza).toBeLessThanOrEqual(720.001)
      expect(nodo.y).toBeGreaterThanOrEqual(0)
      expect(nodo.y + nodo.altezza).toBeLessThanOrEqual(380.001)
    }
  })

  it('le colonne sono a x crescente e distinte', () => {
    const g = costruisciSankey(misto)
    const xPerColonna = new Map<number, number>()
    for (const nodo of g.nodi) {
      const atteso = xPerColonna.get(nodo.colonna)
      if (atteso === undefined) xPerColonna.set(nodo.colonna, nodo.x)
      else expect(nodo.x).toBeCloseTo(atteso, 6)
    }
    const xs = [...xPerColonna.entries()].sort((a, b) => a[0] - b[0]).map(([, x]) => x)
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1])
  })

  it('i nodi della stessa colonna non si sovrappongono', () => {
    const g = costruisciSankey(misto)
    const colonne = new Set(g.nodi.map((n) => n.colonna))
    for (const c of colonne) {
      const lista = g.nodi.filter((n) => n.colonna === c).sort((a, b) => a.y - b.y)
      for (let i = 1; i < lista.length; i++) {
        expect(lista[i].y).toBeGreaterThanOrEqual(lista[i - 1].y + lista[i - 1].altezza)
      }
    }
  })

  it('lo spessore dei nodi è proporzionale al valore (scala unica)', () => {
    const g = costruisciSankey(separata)
    const fatt = g.nodi.find((n) => n.id === 'fatturato')!
    const imp = g.nodi.find((n) => n.id === 'imponibile')!
    expect(imp.altezza / fatt.altezza).toBeCloseTo(39_000 / 50_000, 3)
  })

  it('ogni nastro ha un path SVG chiuso e senza NaN', () => {
    const g = costruisciSankey(misto)
    expect(g.nastri.length).toBeGreaterThan(0)
    for (const nastro of g.nastri) {
      expect(nastro.path).toMatch(/^M /)
      expect(nastro.path.endsWith('Z')).toBe(true)
      expect(nastro.path).not.toMatch(/NaN|Infinity/)
    }
  })

  it('rispetta le dimensioni richieste', () => {
    const g = costruisciSankey(separata, { larghezza: 500, altezza: 240 })
    expect(g.larghezza).toBe(500)
    expect(g.altezza).toBe(240)
  })
})

describe('pathNastro', () => {
  it('produce una Bézier cubica chiusa', () => {
    const path = pathNastro(0, 0, 100, 50, 10)
    expect(path).toBe('M 0 0 C 50 0 50 50 100 50 L 100 60 C 50 60 50 10 0 10 Z')
  })

  it('mantiene lo spessore costante fra bordo iniziale e finale', () => {
    const path = pathNastro(10, 20, 110, 80, 15)
    // il ritorno parte da y1+spessore e chiude su y0+spessore
    expect(path).toContain('L 110 95')
    expect(path).toContain('0 35 Z'.slice(-5))
  })

  it('non genera NaN con coordinate degeneri', () => {
    expect(pathNastro(0, 0, 0, 0, 1)).not.toMatch(/NaN/)
  })
})
