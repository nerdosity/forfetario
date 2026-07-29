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

  // Ordine dentro la colonna = ordine di dichiarazione. Le uscite (contributi,
  // imposta) stanno in alto, il denaro che resta in basso: così la quota non
  // imponibile è adiacente al netto in cui confluisce e i nastri non si incrociano.
  const grezzi: NodoGrezzo[] = (
    [
      // Prima colonna a sinistra e ultima a destra: sfruttano le corsie di testo
      // esterne. Le colonne intermedie scrivono sopra il nodo, dove non c'è
      // contesa con i nastri né con le etichette delle colonne vicine.
      { id: 'fatturato', etichetta: 'Fatturato', valore: v.fatturato, colonna: 0, colore: 'neutro', posizioneEtichetta: 'sinistra' },
      { id: 'imponibile', etichetta: 'Imponibile lordo', valore: v.imponibileLordo, colonna: 1, colore: 'imponibile', posizioneEtichetta: 'sopra' },
      { id: 'nonImponibile', etichetta: 'Quota non imponibile (coefficiente)', valore: v.quotaNonImponibile, colonna: 1, colore: 'neutro', posizioneEtichetta: 'sopra' },
      { id: 'contributi', etichetta: 'Contributi INPS', valore: v.contributiINPS, colonna: 2, colore: 'contributi', posizioneEtichetta: mostraGestioni ? 'sopra' : 'destra' },
      { id: 'imposta', etichetta: 'Imposta sostitutiva', valore: v.imposte, colonna: 2, colore: 'imposta', posizioneEtichetta: mostraGestioni ? 'sopra' : 'destra' },
      { id: 'netto', etichetta: 'Netto in tasca', valore: v.nettoInTasca, colonna: 2, colore: 'netto', posizioneEtichetta: mostraGestioni ? 'sopra' : 'destra' },
      ...(mostraGestioni ? gestioni : []),
    ] satisfies NodoGrezzo[]
  ).filter((n) => n.valore > SOGLIA_RAMO)

  const idPresenti = new Set(grezzi.map((n) => n.id))

  // L'ordine conta: i nastri si impilano lungo il bordo dei nodi nell'ordine di
  // dichiarazione, quindi va scelto per minimizzare gli incroci (uscite verso
  // l'alto prima, netto per ultimo, coerente con l'ordine dei nodi in colonna).
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

  const perId = new Map(nodi.map((n) => [n.id, n]))

  // Offset progressivo di attacco: i nastri uscenti da uno stesso nodo si
  // impilano lungo il suo bordo destro, quelli entranti lungo il bordo sinistro.
  const offsetUscita = new Map<string, number>()
  const offsetIngresso = new Map<string, number>()

  const nastri: NastroSankey[] = []
  for (const grezzo of nastriGrezzi) {
    const sorgente = perId.get(grezzo.da)!
    const destinazione = perId.get(grezzo.a)!
    const spessore = Math.max(1, grezzo.valore * scala)

    const partenza = offsetUscita.get(grezzo.da) ?? 0
    const arrivo = offsetIngresso.get(grezzo.a) ?? 0
    offsetUscita.set(grezzo.da, partenza + spessore)
    offsetIngresso.set(grezzo.a, arrivo + spessore)

    const x0 = sorgente.x + sorgente.larghezza
    const x1 = destinazione.x
    const y0 = sorgente.y + partenza
    const y1 = destinazione.y + arrivo

    nastri.push({
      id: `${grezzo.da}-${grezzo.a}`,
      da: grezzo.da,
      a: grezzo.a,
      valore: grezzo.valore,
      colore: grezzo.colore,
      path: pathNastro(x0, y0, x1, y1, spessore),
    })
  }

  return { nodi, nastri, larghezza: opt.larghezza, altezza: opt.altezza, haDati: true }
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
