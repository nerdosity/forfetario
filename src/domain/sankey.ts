/**
 * Logica pura del diagramma Sankey "dove vanno i soldi".
 *
 * Trasforma i totali di un RisultatoAnno in un grafo a tre colonne
 * (fatturato → primo split → destinazioni) e ne calcola la geometria:
 * posizione verticale dei nodi e spessore dei nastri, proporzionale
 * all'importo. Nessuna dipendenza da React o dall'SVG: il componente
 * consuma solo il risultato di `costruisciSankey`.
 *
 * Colonne:
 *   0. Fatturato
 *   1. Quota non imponibile (coefficiente) | Imponibile lordo
 *   2. Contributi INPS | Imposta sostitutiva | Netto in tasca
 *   3. (solo se più gestioni) suddivisione dei contributi INPS
 *
 * Nota sul flusso: contributi e imposta escono dalla CASSA, non dalla sola base
 * imponibile, quindi la loro somma può superare l'imponibile lordo (coefficiente
 * basso e aliquote alte). La colonna 1 è quindi una CLASSIFICAZIONE del fatturato
 * (parte tassabile / parte non tassabile) e la colonna 2 una DESTINAZIONE: ogni
 * destinazione attinge da entrambi i secchielli in proporzione al loro peso sul
 * fatturato. Così i conti tornano su entrambi i lati di ogni nodo per qualsiasi
 * combinazione di coefficiente e aliquote.
 *
 * Invariante: per ogni nodo la somma dei nastri uscenti non supera il nodo, e la
 * somma dei nastri entranti è pari al nodo. Se gli arrotondamenti sforano, i
 * valori vengono normalizzati.
 */

/** Sotto il centesimo un ramo è considerato inesistente e non viene mostrato. */
export const SOGLIA_RAMO = 0.005

/** Accenti disponibili per i nastri: chiavi risolte in colori dal componente. */
export type ColoreSankey = 'neutro' | 'imponibile' | 'contributi' | 'imposta' | 'netto'

/**
 * Dove va scritta l'etichetta rispetto al nodo. Le colonne interne usano
 * 'sopra' (testo appoggiato sopra il bordo alto del nodo) perché a sinistra e a
 * destra lo spazio orizzontale è occupato dai nastri e dalle etichette delle
 * colonne adiacenti: così le etichette non si sovrappongono mai fra colonne.
 */
export type PosizioneEtichetta = 'sinistra' | 'destra' | 'sopra'

/** Totali di partenza, presi dai campi già esposti dall'engine `calcola`. */
export interface IngressoSankey {
  /** RisultatoAnno.totaleFatturato */
  fatturato: number
  /** RisultatoAnno.totaleImponibileLordo (fatturato × coefficiente) */
  imponibileLordo: number
  /** RisultatoAnno.totaleContributiINPS */
  contributiINPS: number
  /** RisultatoAnno.totaleImposte */
  imposte: number
  /** RisultatoAnno.totaleContributiSeparata */
  contributiSeparata?: number
  /** RisultatoAnno.totaleContributiFissiArtComm */
  contributiFissiArtComm?: number
  /** RisultatoAnno.totaleContributiEccedenzaArtComm */
  contributiEccedenzaArtComm?: number
}

/** Un nodo del grafo, con geometria già risolta. */
export interface NodoSankey {
  id: string
  etichetta: string
  valore: number
  /** Quota sul fatturato, 0-1. Zero se il fatturato è zero. */
  quota: number
  colonna: number
  colore: ColoreSankey
  /** Coordinate del rettangolo del nodo nello spazio del viewBox. */
  x: number
  y: number
  larghezza: number
  altezza: number
  /** Dove disegnare l'etichetta rispetto al nodo. */
  posizioneEtichetta: PosizioneEtichetta
}

/** Un nastro che collega due nodi. */
export interface NastroSankey {
  id: string
  da: string
  a: string
  valore: number
  colore: ColoreSankey
  /** Path SVG chiuso, da usare con `fill`. */
  path: string
  /** Bordo alto del nastro sul lato sorgente: serve al conteggio degli incroci. */
  y0: number
  /** Bordo alto del nastro sul lato destinazione. */
  y1: number
  /** Colonna del nodo sorgente: due nastri si confrontano solo nello stesso span. */
  colonnaDa: number
  /** Colonna del nodo destinazione. */
  colonnaA: number
  /** Etichetta pronta per il `<title>` SVG: "Sorgente → Destinazione". */
  descrizione: string
}

export interface GraficoSankey {
  nodi: NodoSankey[]
  nastri: NastroSankey[]
  larghezza: number
  altezza: number
  /** Falso quando non c'è nulla da mostrare (fatturato a zero). */
  haDati: boolean
}

/** Opzioni geometriche; i default sono tarati sul viewBox usato dal componente. */
export interface OpzioniSankey {
  larghezza?: number
  altezza?: number
  /** Spessore del rettangolo di un nodo. */
  spessoreNodo?: number
  /** Spazio verticale minimo fra due nodi della stessa colonna. */
  spazioNodi?: number
  /** Margine verticale sopra e sotto il diagramma. */
  margineVerticale?: number
  /** Spazio a sinistra e a destra riservato alle etichette. */
  margineEtichette?: number
}

const DEFAULT: Required<OpzioniSankey> = {
  larghezza: 720,
  altezza: 380,
  spessoreNodo: 10,
  // Deve bastare a due righe di testo da 11px: le etichette 'sopra' vivono qui.
  spazioNodi: 34,
  margineVerticale: 30,
  margineEtichette: 4,
}

/** Azzera i negativi e i NaN: nel diagramma non esistono importi sotto zero. */
export function clamp(valore: number): number {
  return Number.isFinite(valore) && valore > 0 ? valore : 0
}

/**
 * Riporta i figli entro il padre. Se la somma sfora (arrotondamenti o input
 * incoerenti) i valori vengono riscalati proporzionalmente; se il padre è zero
 * tutti i figli vanno a zero.
 */
export function normalizzaFigli(figli: number[], padre: number): number[] {
  const puliti = figli.map(clamp)
  const totale = puliti.reduce((a, b) => a + b, 0)
  const limite = clamp(padre)
  if (limite === 0) return puliti.map(() => 0)
  if (totale <= limite + 1e-9) return puliti
  return puliti.map((v) => (v / totale) * limite)
}

/**
 * Ripartisce il fatturato nelle voci del diagramma, con tutte le guardie.
 *
 * L'imposta sostitutiva è calcolata dall'engine sull'imponibile al netto dei
 * contributi versati: qui si prende il valore già pronto, non si riapplica
 * l'aliquota. Il netto è ciò che resta di cassa: fatturato - contributi - imposta.
 */
export function ripartisci(ingresso: IngressoSankey) {
  const fatturato = clamp(ingresso.fatturato)
  // L'imponibile lordo non può superare il fatturato (coefficiente ≤ 100%).
  const imponibileLordo = Math.min(clamp(ingresso.imponibileLordo), fatturato)
  const quotaNonImponibile = Math.max(0, fatturato - imponibileLordo)

  // Contributi e imposta escono dalla cassa: insieme non possono superare il
  // fatturato, altrimenti il netto sarebbe negativo.
  const [contributiINPS, imposte] = normalizzaFigli(
    [ingresso.contributiINPS, ingresso.imposte],
    fatturato,
  )
  const nettoInTasca = Math.max(0, fatturato - contributiINPS - imposte)

  // Ogni destinazione attinge da entrambi i secchielli della colonna 1 in
  // proporzione al peso del secchiello sul fatturato. È l'unico modo di far
  // tornare i conti su ENTRAMBI i lati: contributi e imposta escono dalla cassa
  // e con un coefficiente basso supererebbero da soli l'imponibile lordo.
  const pesoImponibile = fatturato > 0 ? imponibileLordo / fatturato : 0
  const dalImponibile = (valore: number) => valore * pesoImponibile
  const dalNonImponibile = (valore: number) => valore * (1 - pesoImponibile)

  // Suddivisione per gestione: solo le voci effettivamente presenti.
  const [separata, fissiArtComm, eccedenzaArtComm] = normalizzaFigli(
    [
      ingresso.contributiSeparata ?? 0,
      ingresso.contributiFissiArtComm ?? 0,
      ingresso.contributiEccedenzaArtComm ?? 0,
    ],
    contributiINPS,
  )

  return {
    fatturato,
    imponibileLordo,
    quotaNonImponibile,
    contributiINPS,
    imposte,
    nettoInTasca,
    separata,
    fissiArtComm,
    eccedenzaArtComm,
    /** Quota di ogni destinazione imputata all'imponibile lordo. */
    dalImponibile,
    /** Quota di ogni destinazione imputata alla parte non imponibile. */
    dalNonImponibile,
  }
}

/** Quota di `valore` sul fatturato, 0-1, con guardia sulla divisione per zero. */
export function quotaSuFatturato(valore: number, fatturato: number): number {
  if (fatturato <= 0) return 0
  return Math.min(1, Math.max(0, valore / fatturato))
}

/** Definizione di un nodo prima del calcolo della geometria. */
interface NodoGrezzo {
  id: string
  etichetta: string
  valore: number
  colonna: number
  colore: ColoreSankey
  posizioneEtichetta: PosizioneEtichetta
}

/** Nastro logico, prima del calcolo del path. */
interface NastroGrezzo {
  da: string
  a: string
  valore: number
  colore: ColoreSankey
}

/**
 * Costruisce il grafo completo (nodi + nastri con path SVG) per un anno.
 *
 * Con fatturato a zero restituisce `haDati: false` e liste vuote: il componente
 * mostra il placeholder invece del disegno.
 */
export function costruisciSankey(
  ingresso: IngressoSankey,
  opzioni: OpzioniSankey = {},
): GraficoSankey {
  const opt = { ...DEFAULT, ...opzioni }
  const v = ripartisci(ingresso)

  if (v.fatturato <= SOGLIA_RAMO) {
    return { nodi: [], nastri: [], larghezza: opt.larghezza, altezza: opt.altezza, haDati: false }
  }

  // Le gestioni si mostrano solo se più di una supera la soglia: con una sola
  // voce la colonna aggiuntiva ripeterebbe il nodo "Contributi INPS".
  const gestioni: NodoGrezzo[] = (
    [
      { id: 'gs', etichetta: 'Gestione separata', valore: v.separata, colonna: 3, colore: 'contributi', posizioneEtichetta: 'destra' },
      { id: 'fissi', etichetta: 'Art/Comm fissi', valore: v.fissiArtComm, colonna: 3, colore: 'contributi', posizioneEtichetta: 'destra' },
      { id: 'ecc', etichetta: 'Art/Comm eccedenza', valore: v.eccedenzaArtComm, colonna: 3, colore: 'contributi', posizioneEtichetta: 'destra' },
    ] satisfies NodoGrezzo[]
  ).filter((g) => g.valore > SOGLIA_RAMO)
  const mostraGestioni = gestioni.length > 1

  // Ordine dentro la colonna = ordine di dichiarazione, e va scelto per tenere
  // corti i nastri: nella colonna 2 il netto sta IN ALTO, contributi e imposta
  // sotto di esso.
  //
  // Il motivo è geometrico. Ogni destinazione attinge da entrambi i secchielli
  // della colonna 1, quindi lo span 1→2 è un bipartito completo 2×3 e ha un
  // numero di incroci irriducibile (vedi `incrociInevitabili`): non lo si
  // azzera, lo si rende però locale. Con contributi e imposta in alto, le loro
  // quote provenienti dalla "quota non imponibile" (nodo in basso) risalgono
  // tutto il disegno tagliando il nastro del netto. Mettendo in alto il netto —
  // che è il nastro dominante, ~80% del fatturato — i due nastri lunghi
  // diventano corti e gli incroci restano confinati in una fascia stretta:
  // il salto verticale peggiore si dimezza (da ~195 a ~98 unità sui dati reali).
  const grezzi: NodoGrezzo[] = (
    [
      // Prima colonna a sinistra e ultima a destra: sfruttano le corsie di testo
      // esterne. Le colonne intermedie scrivono sopra il nodo, dove non c'è
      // contesa con i nastri né con le etichette delle colonne vicine.
      { id: 'fatturato', etichetta: 'Fatturato', valore: v.fatturato, colonna: 0, colore: 'neutro', posizioneEtichetta: 'sinistra' },
      { id: 'imponibile', etichetta: 'Imponibile lordo', valore: v.imponibileLordo, colonna: 1, colore: 'imponibile', posizioneEtichetta: 'sopra' },
      { id: 'nonImponibile', etichetta: 'Quota non imponibile (coefficiente)', valore: v.quotaNonImponibile, colonna: 1, colore: 'neutro', posizioneEtichetta: 'sopra' },
      { id: 'netto', etichetta: 'Netto in tasca', valore: v.nettoInTasca, colonna: 2, colore: 'netto', posizioneEtichetta: mostraGestioni ? 'sopra' : 'destra' },
      { id: 'contributi', etichetta: 'Contributi INPS', valore: v.contributiINPS, colonna: 2, colore: 'contributi', posizioneEtichetta: mostraGestioni ? 'sopra' : 'destra' },
      { id: 'imposta', etichetta: 'Imposta sostitutiva', valore: v.imposte, colonna: 2, colore: 'imposta', posizioneEtichetta: mostraGestioni ? 'sopra' : 'destra' },
      ...(mostraGestioni ? gestioni : []),
    ] satisfies NodoGrezzo[]
  ).filter((n) => n.valore > SOGLIA_RAMO)

  const idPresenti = new Set(grezzi.map((n) => n.id))

  // L'ordine di dichiarazione qui è solo quello logico: l'impilamento sui bordi
  // dei nodi viene poi riordinato in `costruisciNastri` secondo la regola
  // anti-incrocio standard (per posizione del nodo opposto).
  const nastriGrezzi: NastroGrezzo[] = (
    [
      { da: 'fatturato', a: 'imponibile', valore: v.imponibileLordo, colore: 'imponibile' },
      { da: 'fatturato', a: 'nonImponibile', valore: v.quotaNonImponibile, colore: 'neutro' },
      // Dall'imponibile lordo: le tre destinazioni, per la loro quota parte.
      { da: 'imponibile', a: 'contributi', valore: v.dalImponibile(v.contributiINPS), colore: 'contributi' },
      { da: 'imponibile', a: 'imposta', valore: v.dalImponibile(v.imposte), colore: 'imposta' },
      { da: 'imponibile', a: 'netto', valore: v.dalImponibile(v.nettoInTasca), colore: 'netto' },
      // Dalla parte non imponibile: stessa ripartizione, quota complementare.
      { da: 'nonImponibile', a: 'contributi', valore: v.dalNonImponibile(v.contributiINPS), colore: 'contributi' },
      { da: 'nonImponibile', a: 'imposta', valore: v.dalNonImponibile(v.imposte), colore: 'imposta' },
      { da: 'nonImponibile', a: 'netto', valore: v.dalNonImponibile(v.nettoInTasca), colore: 'neutro' },
      ...gestioni.map((g): NastroGrezzo => ({ da: 'contributi', a: g.id, valore: mostraGestioni ? g.valore : 0, colore: 'contributi' })),
    ] satisfies NastroGrezzo[]
  ).filter((n) => n.valore > SOGLIA_RAMO && idPresenti.has(n.da) && idPresenti.has(n.a))

  // ─── Geometria ────────────────────────────────────────────────────────────
  // Scala verticale unica per tutto il diagramma: il fatturato occupa l'altezza
  // utile della colonna più affollata, così gli spessori sono confrontabili.
  const colonne = [...new Set(grezzi.map((n) => n.colonna))].sort((a, b) => a - b)
  const nodiPerColonna = new Map<number, NodoGrezzo[]>()
  for (const c of colonne) nodiPerColonna.set(c, grezzi.filter((n) => n.colonna === c))

  const spazioMassimo = Math.max(
    ...colonne.map((c) => (nodiPerColonna.get(c)!.length - 1) * opt.spazioNodi),
  )
  const altezzaUtile = Math.max(20, opt.altezza - 2 * opt.margineVerticale - spazioMassimo)
  const scala = altezzaUtile / v.fatturato

  const ultimaColonna = colonne[colonne.length - 1]
  const xDisponibile = opt.larghezza - 2 * opt.margineEtichette - opt.spessoreNodo
  const passoX = ultimaColonna > 0 ? xDisponibile / ultimaColonna : 0

  const nodi: NodoSankey[] = []
  for (const c of colonne) {
    const listaColonna = nodiPerColonna.get(c)!
    const altezzaTotale =
      listaColonna.reduce((somma, n) => somma + n.valore * scala, 0) +
      (listaColonna.length - 1) * opt.spazioNodi
    // Colonna centrata verticalmente: i nastri restano il più orizzontali possibile.
    let y = opt.margineVerticale + Math.max(0, (opt.altezza - 2 * opt.margineVerticale - altezzaTotale) / 2)
    for (const grezzo of listaColonna) {
      const altezza = Math.max(1, grezzo.valore * scala)
      nodi.push({
        ...grezzo,
        quota: quotaSuFatturato(grezzo.valore, v.fatturato),
        x: opt.margineEtichette + c * passoX,
        y,
        larghezza: opt.spessoreNodo,
        altezza,
      })
      y += altezza + opt.spazioNodi
    }
  }

  allineaColonneDerivate(nodi, nastriGrezzi, colonne, opt)

  return {
    nodi,
    nastri: costruisciNastri(nodi, nastriGrezzi, scala),
    larghezza: opt.larghezza,
    altezza: opt.altezza,
    haDati: true,
  }
}

/**
 * Riallinea le colonne che derivano da un solo nodo padre (oggi: la colonna 3
 * delle gestioni, figlia di "Contributi INPS") portandone il blocco all'altezza
 * del padre. Centrare ogni colonna in modo indipendente è corretto per le
 * colonne che ripartiscono l'intero fatturato, ma per una sottocolonna piccola
 * produce nastri che scendono in diagonale dal padre — in alto — fino al centro
 * del disegno, tagliando il nastro del netto. Traslando il blocco si azzerano
 * quegli incroci senza toccare nessun importo.
 */
function allineaColonneDerivate(
  nodi: NodoSankey[],
  nastriGrezzi: NastroGrezzo[],
  colonne: number[],
  opt: Required<OpzioniSankey>,
): void {
  const perId = new Map(nodi.map((n) => [n.id, n]))

  for (const c of colonne) {
    const lista = nodi.filter((n) => n.colonna === c)
    if (lista.length === 0) continue

    // La colonna è "derivata" solo se TUTTI i suoi nodi hanno un unico padre comune.
    const padri = new Set(
      lista.flatMap((n) => nastriGrezzi.filter((g) => g.a === n.id).map((g) => g.da)),
    )
    if (padri.size !== 1) continue
    const padre = perId.get([...padri][0])
    if (!padre || padre.colonna >= c) continue

    // Il blocco parte dal bordo alto del padre, così il primo nastro è orizzontale.
    const cima = Math.min(...lista.map((n) => n.y))
    const fondo = Math.max(...lista.map((n) => n.y + n.altezza))
    const massimoY = opt.altezza - opt.margineVerticale - (fondo - cima)
    const bersaglio = Math.min(Math.max(opt.margineVerticale, padre.y), Math.max(opt.margineVerticale, massimoY))
    const delta = bersaglio - cima
    if (delta === 0) continue
    for (const nodo of lista) nodo.y += delta
  }
}

/**
 * Calcola i path dei nastri applicando la regola anti-incrocio standard dei
 * Sankey: su ogni nodo i nastri USCENTI si impilano ordinati per posizione
 * verticale del nodo di DESTINAZIONE, e i nastri ENTRANTI ordinati per posizione
 * verticale del nodo SORGENTE. Con l'impilamento coerente sulle due estremità
 * restano solo gli incroci strutturalmente inevitabili (vedi `contaIncroci`).
 */
function costruisciNastri(
  nodi: NodoSankey[],
  nastriGrezzi: NastroGrezzo[],
  scala: number,
): NastroSankey[] {
  const perId = new Map(nodi.map((n) => [n.id, n]))

  interface Parziale extends NastroGrezzo {
    spessore: number
    y0: number
    y1: number
  }
  const parziali: Parziale[] = nastriGrezzi.map((g) => ({
    ...g,
    spessore: Math.max(1, g.valore * scala),
    y0: 0,
    y1: 0,
  }))

  // Bordo destro dei nodi: uscite ordinate per y della destinazione.
  for (const nodo of nodi) {
    let offset = 0
    for (const n of parziali
      .filter((p) => p.da === nodo.id)
      .sort((a, b) => perId.get(a.a)!.y - perId.get(b.a)!.y)) {
      n.y0 = nodo.y + offset
      offset += n.spessore
    }
  }

  // Bordo sinistro dei nodi: ingressi ordinati per y della sorgente.
  for (const nodo of nodi) {
    let offset = 0
    for (const n of parziali
      .filter((p) => p.a === nodo.id)
      .sort((a, b) => perId.get(a.da)!.y - perId.get(b.da)!.y)) {
      n.y1 = nodo.y + offset
      offset += n.spessore
    }
  }

  return parziali.map((p) => {
    const sorgente = perId.get(p.da)!
    const destinazione = perId.get(p.a)!
    return {
      id: `${p.da}-${p.a}`,
      da: p.da,
      a: p.a,
      valore: p.valore,
      colore: p.colore,
      path: pathNastro(sorgente.x + sorgente.larghezza, p.y0, destinazione.x, p.y1, p.spessore),
      y0: p.y0,
      y1: p.y1,
      colonnaDa: sorgente.colonna,
      colonnaA: destinazione.colonna,
      descrizione: `${sorgente.etichetta} → ${destinazione.etichetta}`,
    }
  })
}

/**
 * Conta le coppie di nastri che si incrociano.
 *
 * Due nastri si incrociano quando appartengono allo stesso span di colonne e
 * l'ordine verticale dei punti di partenza è invertito rispetto a quello dei
 * punti di arrivo. Serve come verifica oggettiva del layout: non si giudica la
 * leggibilità a occhio, la si misura.
 *
 * Attenzione: NON tutti gli incroci sono eliminabili. Nello span 1→2 il grafo è
 * bipartito completo (2 sorgenti × 3 destinazioni, perché ogni destinazione
 * attinge da entrambi i secchielli): il numero di incroci di un disegno a due
 * livelli di K(2,3) è C(2,2) × C(3,2) = 3 per qualsiasi permutazione. Il
 * conteggio atteso è quindi il minimo strutturale, non zero — vedi
 * `incrociInevitabili`.
 */
export function contaIncroci(nastri: NastroSankey[]): number {
  let incroci = 0
  for (let i = 0; i < nastri.length; i++) {
    for (let j = i + 1; j < nastri.length; j++) {
      const a = nastri[i]
      const b = nastri[j]
      // Solo nastri che attraversano lo stesso paio di colonne sono confrontabili.
      if (a.colonnaDa !== b.colonnaDa || a.colonnaA !== b.colonnaA) continue
      if ((a.y0 - b.y0) * (a.y1 - b.y1) < 0) incroci++
    }
  }
  return incroci
}

/**
 * Minimo strutturale di incroci del grafo, indipendente dal layout.
 *
 * Per ogni span di colonne, ogni coppia di sorgenti distinte combinata con ogni
 * coppia di destinazioni distinte collegate a entrambe genera un incrocio
 * obbligato: i due nastri "diretti" e i due "scambiati" non possono essere
 * entrambi non incrociati. Il totale è la somma su tutti gli span.
 *
 * Confrontato con `contaIncroci`, dà la misura degli incroci EVITABILI:
 * `contaIncroci(nastri) - incrociInevitabili(nastri)` deve valere zero.
 */
export function incrociInevitabili(nastri: NastroSankey[]): number {
  const spans = new Map<string, NastroSankey[]>()
  for (const n of nastri) {
    const chiave = `${n.colonnaDa}->${n.colonnaA}`
    const lista = spans.get(chiave)
    if (lista) lista.push(n)
    else spans.set(chiave, [n])
  }

  let totale = 0
  for (const lista of spans.values()) {
    const sorgenti = [...new Set(lista.map((n) => n.da))]
    const destinazioni = [...new Set(lista.map((n) => n.a))]
    const collegati = new Set(lista.map((n) => `${n.da}|${n.a}`))
    // Ogni "quadrilatero" completo sorgente×destinazione impone un incrocio.
    for (let s1 = 0; s1 < sorgenti.length; s1++) {
      for (let s2 = s1 + 1; s2 < sorgenti.length; s2++) {
        for (let d1 = 0; d1 < destinazioni.length; d1++) {
          for (let d2 = d1 + 1; d2 < destinazioni.length; d2++) {
            const completo =
              collegati.has(`${sorgenti[s1]}|${destinazioni[d1]}`) &&
              collegati.has(`${sorgenti[s1]}|${destinazioni[d2]}`) &&
              collegati.has(`${sorgenti[s2]}|${destinazioni[d1]}`) &&
              collegati.has(`${sorgenti[s2]}|${destinazioni[d2]}`)
            if (completo) totale++
          }
        }
      }
    }
  }
  return totale
}

/**
 * Path chiuso di un nastro: bordo superiore da (x0,y0) a (x1,y1) con una Bézier
 * cubica a tangenti orizzontali, lato destro verticale, bordo inferiore di
 * ritorno e chiusura. Lo spessore resta costante lungo il percorso, come nei
 * diagrammi di flusso energetico.
 */
export function pathNastro(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  spessore: number,
): string {
  // Punti di controllo a metà strada: curvatura simmetrica, partenza e arrivo
  // orizzontali così i nastri escono "piatti" dai bordi dei nodi.
  const cx = (x0 + x1) / 2
  const b0 = y0 + spessore
  const b1 = y1 + spessore
  return [
    `M ${arr(x0)} ${arr(y0)}`,
    `C ${arr(cx)} ${arr(y0)} ${arr(cx)} ${arr(y1)} ${arr(x1)} ${arr(y1)}`,
    `L ${arr(x1)} ${arr(b1)}`,
    `C ${arr(cx)} ${arr(b1)} ${arr(cx)} ${arr(b0)} ${arr(x0)} ${arr(b0)}`,
    'Z',
  ].join(' ')
}

/** Arrotonda a 2 decimali per non gonfiare il markup dei path. */
const arr = (n: number): number => Math.round(n * 100) / 100
