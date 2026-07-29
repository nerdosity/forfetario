import { describe, it, expect } from 'vitest'
import {
  clamp,
  normalizzaFigli,
  ripartisci,
  quotaSuFatturato,
  costruisciSankey,
  pathNastro,
  contaIncroci,
  incrociInevitabili,
  geometriaEtichetta,
  riquadroRiga,
  bandaNastro,
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

  it('il fatturato etichetta a sinistra, le colonne intermedie fuori dal rettangolo', () => {
    const g = costruisciSankey(misto)
    expect(g.nodi.find((n) => n.id === 'fatturato')?.posizioneEtichetta).toBe('sinistra')
    expect(g.nodi.find((n) => n.id === 'imponibile')?.posizioneEtichetta).toBe('sopra')
    // 'sotto' e non 'sopra': è l'ultimo nodo della colonna 1 e la fascia sopra il
    // suo bordo alto è attraversata dalle diagonali che scendono dall'imponibile
    // verso il fondo della colonna 2 (vedi la suite sulle sovrapposizioni).
    expect(g.nodi.find((n) => n.id === 'nonImponibile')?.posizioneEtichetta).toBe('sotto')
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

/**
 * Dati reali osservati nel rendering: fatturato 51.574,00 con coefficiente 67%,
 * artigiano con contributi fissi ed eccedenza. È il caso su cui il diagramma
 * risultava illeggibile per via dei nastri incrociati.
 */
const realeArtigiano: IngressoSankey = {
  fatturato: 51_574.0,
  imponibileLordo: 34_554.58,
  contributiINPS: 5_398.02,
  imposte: 4_059.49,
  contributiSeparata: 0,
  contributiFissiArtComm: 2_902.02,
  contributiEccedenzaArtComm: 2_496.0,
}

/** Opzioni con cui il componente costruisce il grafico (viewBox 760 × 340). */
const COME_IL_COMPONENTE = { larghezza: 760 - 2 * 148, altezza: 340, margineEtichette: 0 }

describe('contaIncroci', () => {
  it('due nastri paralleli non si incrociano', () => {
    const nastri = [
      { id: 'a', da: 'x', a: 'p', valore: 1, colore: 'neutro' as const, path: '', y0: 0, y1: 0, colonnaDa: 0, colonnaA: 1, descrizione: '' },
      { id: 'b', da: 'x', a: 'q', valore: 1, colore: 'neutro' as const, path: '', y0: 10, y1: 10, colonnaDa: 0, colonnaA: 1, descrizione: '' },
    ]
    expect(contaIncroci(nastri)).toBe(0)
  })

  it('due nastri con ordine verticale invertito si incrociano', () => {
    const nastri = [
      { id: 'a', da: 'x', a: 'p', valore: 1, colore: 'neutro' as const, path: '', y0: 0, y1: 10, colonnaDa: 0, colonnaA: 1, descrizione: '' },
      { id: 'b', da: 'x', a: 'q', valore: 1, colore: 'neutro' as const, path: '', y0: 10, y1: 0, colonnaDa: 0, colonnaA: 1, descrizione: '' },
    ]
    expect(contaIncroci(nastri)).toBe(1)
  })

  it('nastri su span di colonne diversi non sono confrontabili', () => {
    const nastri = [
      { id: 'a', da: 'x', a: 'p', valore: 1, colore: 'neutro' as const, path: '', y0: 0, y1: 10, colonnaDa: 0, colonnaA: 1, descrizione: '' },
      { id: 'b', da: 'p', a: 'z', valore: 1, colore: 'neutro' as const, path: '', y0: 10, y1: 0, colonnaDa: 1, colonnaA: 2, descrizione: '' },
    ]
    expect(contaIncroci(nastri)).toBe(0)
  })
})

describe('incrociInevitabili', () => {
  it('un albero (ogni destinazione ha una sola sorgente) non impone incroci', () => {
    const nastri = [
      { id: 'a', da: 'x', a: 'p', valore: 1, colore: 'neutro' as const, path: '', y0: 0, y1: 0, colonnaDa: 0, colonnaA: 1, descrizione: '' },
      { id: 'b', da: 'x', a: 'q', valore: 1, colore: 'neutro' as const, path: '', y0: 1, y1: 1, colonnaDa: 0, colonnaA: 1, descrizione: '' },
    ]
    expect(incrociInevitabili(nastri)).toBe(0)
  })

  it('un bipartito completo 2x2 impone esattamente un incrocio', () => {
    const nastri = ['x|p', 'x|q', 'y|p', 'y|q'].map((k, i) => {
      const [da, a] = k.split('|')
      return { id: k, da, a, valore: 1, colore: 'neutro' as const, path: '', y0: i, y1: i, colonnaDa: 0, colonnaA: 1, descrizione: '' }
    })
    expect(incrociInevitabili(nastri)).toBe(1)
  })

  it('il bipartito completo 2x3 della colonna 1→2 impone 3 incroci', () => {
    const g = costruisciSankey(realeArtigiano, COME_IL_COMPONENTE)
    const span = g.nastri.filter((n) => n.colonnaDa === 1 && n.colonnaA === 2)
    expect(span).toHaveLength(6)
    expect(incrociInevitabili(span)).toBe(3)
  })
})

describe('layout anti-incrocio', () => {
  // Il cuore della verifica: il layout non deve produrre NESSUN incrocio oltre
  // a quelli strutturalmente imposti dal grafo. Si misura, non si valuta a occhio.
  const casi: Array<[string, IngressoSankey]> = [
    ['dati reali artigiano', realeArtigiano],
    ['gestione separata', separata],
    ['anno misto', misto],
  ]

  for (const [nome, ingresso] of casi) {
    it(`${nome}: zero incroci evitabili`, () => {
      const g = costruisciSankey(ingresso, COME_IL_COMPONENTE)
      const evitabili = contaIncroci(g.nastri) - incrociInevitabili(g.nastri)
      expect(evitabili).toBe(0)
    })
  }

  it('dati reali: gli incroci totali sono esattamente i 3 inevitabili dello span 1→2', () => {
    const g = costruisciSankey(realeArtigiano, COME_IL_COMPONENTE)
    expect(contaIncroci(g.nastri)).toBe(3)
    expect(incrociInevitabili(g.nastri)).toBe(3)
  })

  it('lo span dei contributi verso le gestioni non ha alcun incrocio', () => {
    const g = costruisciSankey(realeArtigiano, COME_IL_COMPONENTE)
    const span = g.nastri.filter((n) => n.colonnaDa === 2 && n.colonnaA === 3)
    expect(span.length).toBeGreaterThan(0)
    expect(contaIncroci(span)).toBe(0)
  })

  it('la colonna delle gestioni è allineata al bordo alto dei contributi', () => {
    // Senza allineamento la sottocolonna resterebbe centrata e i suoi nastri
    // scenderebbero in diagonale dal padre fino al centro del disegno.
    const g = costruisciSankey(realeArtigiano, COME_IL_COMPONENTE)
    const contributi = g.nodi.find((n) => n.id === 'contributi')!
    const cima = Math.min(...g.nodi.filter((n) => n.colonna === 3).map((n) => n.y))
    expect(cima).toBeCloseTo(contributi.y, 6)
  })

  it('il netto sta in cima alla colonna delle destinazioni', () => {
    // È la scelta che accorcia i nastri: il ramo dominante resta orizzontale.
    const g = costruisciSankey(realeArtigiano, COME_IL_COMPONENTE)
    const destinazioni = g.nodi.filter((n) => n.colonna === 2).sort((a, b) => a.y - b.y)
    expect(destinazioni[0].id).toBe('netto')
  })

  it('nessun nastro attraversa più di metà dell\'altezza del disegno', () => {
    // Guardia contro il ritorno delle diagonali che tagliavano tutto il grafico:
    // prima della correzione il salto peggiore superava 195 unità su 340.
    const g = costruisciSankey(realeArtigiano, COME_IL_COMPONENTE)
    for (const nastro of g.nastri) {
      expect(Math.abs(nastro.y1 - nastro.y0)).toBeLessThan(340 / 2)
    }
  })

  it('i nastri espongono i capi e la descrizione per il tooltip', () => {
    const g = costruisciSankey(realeArtigiano, COME_IL_COMPONENTE)
    const nastro = g.nastri.find((n) => n.da === 'contributi' && n.a === 'fissi')!
    expect(nastro.descrizione).toBe('Contributi INPS → Art/Comm fissi')
    expect(nastro.colonnaDa).toBe(2)
    expect(nastro.colonnaA).toBe(3)
  })

  it('l\'impilamento è coerente sui due lati di ogni nodo', () => {
    // Regola standard: su un nodo le uscite si ordinano per y della destinazione
    // e gli ingressi per y della sorgente. Se vale, i nastri non si "scambiano"
    // di posto lungo il bordo del nodo.
    const g = costruisciSankey(misto, COME_IL_COMPONENTE)
    const perId = new Map(g.nodi.map((n) => [n.id, n]))
    for (const nodo of g.nodi) {
      const uscenti = g.nastri.filter((n) => n.da === nodo.id).sort((a, b) => a.y0 - b.y0)
      for (let i = 1; i < uscenti.length; i++) {
        expect(perId.get(uscenti[i].a)!.y).toBeGreaterThanOrEqual(perId.get(uscenti[i - 1].a)!.y)
      }
      const entranti = g.nastri.filter((n) => n.a === nodo.id).sort((a, b) => a.y1 - b.y1)
      for (let i = 1; i < entranti.length; i++) {
        expect(perId.get(entranti[i].da)!.y).toBeGreaterThanOrEqual(perId.get(entranti[i - 1].da)!.y)
      }
    }
  })

  it('i nastri restano attaccati ai bordi dei nodi che collegano', () => {
    // L'allineamento della colonna derivata non deve far sbordare gli attacchi.
    for (const ingresso of [realeArtigiano, separata, misto]) {
      const g = costruisciSankey(ingresso, COME_IL_COMPONENTE)
      const perId = new Map(g.nodi.map((n) => [n.id, n]))
      for (const nastro of g.nastri) {
        const sorgente = perId.get(nastro.da)!
        const destinazione = perId.get(nastro.a)!
        const spessore = Math.max(1, nastro.valore * (sorgente.altezza / sorgente.valore))
        expect(nastro.y0).toBeGreaterThanOrEqual(sorgente.y - 1e-6)
        expect(nastro.y0 + spessore).toBeLessThanOrEqual(sorgente.y + sorgente.altezza + 1e-6)
        expect(nastro.y1).toBeGreaterThanOrEqual(destinazione.y - 1e-6)
      }
    }
  })

  it('le gestioni allineate restano dentro il viewBox', () => {
    const g = costruisciSankey(realeArtigiano, COME_IL_COMPONENTE)
    for (const nodo of g.nodi) {
      expect(nodo.y).toBeGreaterThanOrEqual(0)
      expect(nodo.y + nodo.altezza).toBeLessThanOrEqual(340.001)
    }
  })
})

/**
 * Caso semplice: una sola gestione, quindi nessuna colonna 3 e etichette
 * 'destra' sulla colonna 2. Serve a verificare che il layout delle etichette
 * non regredisca sullo scenario più stretto, dove il passo fra colonne è ampio.
 */
const piccolo: IngressoSankey = {
  fatturato: 15_000,
  imponibileLordo: 11_700,
  contributiINPS: 3_800,
  imposte: 900,
}

describe('etichette: nessuna sovrapposizione con elementi estranei', () => {
  /** Opzioni identiche a quelle usate dal componente (viewBox 900, corsie 92/132). */
  const COME_IL_COMPONENTE_REALE = {
    larghezza: 900 - 92 - 132,
    altezza: 380,
    margineEtichette: 0,
  }

  /** Lo stesso testo di importo e quota che passa il componente, a larghezza tipica. */
  const TESTO_VALORE = '00.000,00 € · 00%'

  const casi: Array<[string, IngressoSankey]> = [
    ['dati reali artigiano', realeArtigiano],
    ['gestione separata', separata],
    ['anno misto', misto],
    ['fatturato basso senza gestioni multiple', piccolo],
  ]

  /** Sovrapposizione fra due riquadri: positiva su entrambi gli assi = collisione. */
  const sovrapposti = (
    a: { x0: number; x1: number; y0: number; y1: number },
    b: { x0: number; x1: number; y0: number; y1: number },
  ): boolean =>
    Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0 &&
    Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0

  for (const [nome, ingresso] of casi) {
    it(`${nome}: nessuna etichetta invade un nodo o un nastro estraneo`, () => {
      const g = costruisciSankey(ingresso, COME_IL_COMPONENTE_REALE)
      const collisioni: string[] = []

      for (const nodo of g.nodi) {
        const etichetta = geometriaEtichetta(nodo, TESTO_VALORE, g.passoX, 8)
        for (const riga of etichetta.righe) {
          const box = riquadroRiga(riga, etichetta.x, etichetta.anchor)

          // Contro i nodi: l'etichetta non deve coprire nessun ALTRO rettangolo.
          for (const altro of g.nodi) {
            if (altro.id === nodo.id) continue
            const rettangolo = {
              x0: altro.x,
              x1: altro.x + altro.larghezza,
              y0: altro.y,
              y1: altro.y + altro.altezza,
            }
            if (sovrapposti(box, rettangolo)) {
              collisioni.push(`"${riga.testo}" (${nodo.id}) sul nodo ${altro.id}`)
            }
          }

          // Contro i nastri: sono ammessi solo i nastri del nodo etichettato,
          // che nascono o finiscono sul suo bordo e gli appartengono visivamente.
          for (const nastro of g.nastri) {
            if (nastro.da === nodo.id || nastro.a === nodo.id) continue
            const banda = bandaNastro(nastro, g.nodi, box.x0, box.x1)
            if (!banda) continue
            const oy = Math.min(box.y1, banda.bottom) - Math.max(box.y0, banda.top)
            if (oy > 0) {
              collisioni.push(
                `"${riga.testo}" (${nodo.id}) sul nastro ${nastro.da}→${nastro.a} (${oy.toFixed(1)} unità)`,
              )
            }
          }
        }
      }

      expect(collisioni).toEqual([])
    })

    it(`${nome}: ogni etichetta resta dentro il viewBox in verticale`, () => {
      // Il blocco 'sotto' cresce verso il margine inferiore: va verificato che la
      // coda riservata in fondo alla colonna basti davvero.
      const g = costruisciSankey(ingresso, COME_IL_COMPONENTE_REALE)
      for (const nodo of g.nodi) {
        const etichetta = geometriaEtichetta(nodo, TESTO_VALORE, g.passoX, 8)
        for (const riga of etichetta.righe) {
          const box = riquadroRiga(riga, etichetta.x, etichetta.anchor)
          expect(box.y0).toBeGreaterThanOrEqual(0)
          expect(box.y1).toBeLessThanOrEqual(380)
        }
      }
    })
  }

  it('la quota non imponibile etichetta sotto il proprio bordo inferiore', () => {
    // È il fix della collisione misurata: sopra il suo bordo alto passano le
    // diagonali imponibile→contributi e imponibile→imposta, che coprono l'intera
    // banda a qualunque ascissa. Sotto il bordo inferiore non passa nulla.
    const g = costruisciSankey(realeArtigiano, COME_IL_COMPONENTE_REALE)
    const nonImponibile = g.nodi.find((n) => n.id === 'nonImponibile')!
    expect(nonImponibile.posizioneEtichetta).toBe('sotto')

    const etichetta = geometriaEtichetta(nonImponibile, TESTO_VALORE, g.passoX, 8)
    for (const riga of etichetta.righe) {
      expect(riga.y).toBeGreaterThan(nonImponibile.y + nonImponibile.altezza)
    }
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
