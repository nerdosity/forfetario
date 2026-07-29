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
 *
 * 'sotto' è la variante per l'ULTIMO nodo di una colonna interna. Sopra di lui
 * passano le diagonali che scendono dai nodi più alti della sua colonna verso il
 * fondo di quella successiva: quella fascia è attraversata per intero a
 * qualunque ascissa, quindi nessuna riduzione di larghezza del testo la libera.
 * Sotto il suo bordo inferiore, invece, non passa più nulla — i nastri nascono
 * tutti dai bordi ALTI dei nodi e l'ultimo nodo è il più basso della colonna.
 */
export type PosizioneEtichetta = 'sinistra' | 'destra' | 'sopra' | 'sotto'

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
  /**
   * Distanza orizzontale fra due colonne consecutive. È lo spazio entro cui
   * un'etichetta 'sopra' deve stare per non invadere la colonna successiva.
   */
  passoX: number
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

/** Altezza di una riga di testo da 11px, comprensiva di interlinea. */
export const ALTEZZA_RIGA = 11
/**
 * Larghezza media di un carattere a 11px nel font dell'interfaccia. Non è una
 * misura tipografica esatta — serve come stima prudente e ripetibile per
 * decidere gli a-capo e per il controllo di sovrapposizione nei test.
 */
export const LARGHEZZA_CARATTERE = 6
/** Parte della riga sopra la linea di base (approssimata, font da 11px). */
export const ASCENDENTE = 8
/** Parte della riga sotto la linea di base. */
export const DISCENDENTE = 3
/**
 * Aria fra il testo di un'etichetta e l'elemento che la segue: sotto, il bordo
 * del nodo etichettato; a destra, la colonna successiva.
 */
export const RESPIRO_ETICHETTA = 6
/** Distacco minimo fra due nodi della stessa colonna senza etichetta in mezzo. */
export const DISTACCO_MINIMO = 8
/**
 * Quota del passo fra colonne che un'etichetta 'sopra' può occupare.
 *
 * Non è tutto il passo: lo spazio fra due colonne è attraversato dai nastri di
 * quello span, che partono orizzontali dal bordo del nodo e curvano verso metà
 * strada. Il vincolo non riguarda solo i nastri dello stesso span: un'etichetta
 * lunga può anche sconfinare in un nastro che nasce da un ALTRO nodo della
 * propria colonna (a un'altezza diversa) o da una colonna successiva. Restando
 * in una fascia stretta vicino al bordo del nodo il testo occupa lo spazio in
 * cui i nastri sono ancora prevedibilmente vicini alla loro quota di partenza;
 * il valore è tarato sugli scenari reali in sankey.test.ts (nessuna etichetta
 * deve invadere un nodo o un nastro estraneo).
 */
export const QUOTA_PASSO_ETICHETTA = 0.45

const DEFAULT: Required<OpzioniSankey> = {
  larghezza: 720,
  altezza: 380,
  spessoreNodo: 10,
  // Deve bastare alle righe di testo delle etichette 'sopra', che vivono qui:
  // nome (fino a due righe se lungo) più la riga di importo e quota.
  spazioNodi: 46,
  margineVerticale: 34,
  margineEtichette: 4,
}

/** Azzera i negativi e i NaN: nel diagramma non esistono importi sotto zero. */
export function clamp(valore: number): number {
  return Number.isFinite(valore) && valore > 0 ? valore : 0
}

/** Larghezza stimata di una stringa a 11px, in unità del viewBox. */
export function larghezzaTesto(testo: string): number {
  return testo.length * LARGHEZZA_CARATTERE
}

/**
 * Larghezza utile per un'etichetta 'sopra', dato il passo fra colonne. Unico
 * punto di verità: la usano sia il calcolo dell'altezza delle righe in
 * `costruisciSankey` sia `geometriaEtichetta`, che devono concordare.
 */
export function larghezzaEtichettaSopra(passoX: number): number {
  return Math.max(40, passoX * QUOTA_PASSO_ETICHETTA - RESPIRO_ETICHETTA)
}

/**
 * Spezza l'etichetta in righe che stiano entro `larghezzaMax`.
 *
 * L'SVG non manda a capo da solo: un `<text>` lungo esce dal suo spazio e si
 * scrive sopra i nastri della colonna successiva. Con le gestioni attive il
 * passo fra colonne scende a ~150 unità, mentre "Quota non imponibile
 * (coefficiente)" da sola ne misura ~210: senza a-capo sfonda l'intero span.
 *
 * Taglia solo sugli spazi (non spezza le parole) e si ferma al massimo a
 * `righeMax` righe: se una parola da sola sfora, resta sulla sua riga.
 */
export function spezzaEtichetta(
  testo: string,
  larghezzaMax: number,
  righeMax = 2,
): string[] {
  const parole = testo.split(' ').filter((p) => p.length > 0)
  if (parole.length === 0) return ['']

  const righe: string[] = []
  let corrente = parole[0]
  for (const parola of parole.slice(1)) {
    const tentativo = `${corrente} ${parola}`
    // Sull'ultima riga disponibile non si spezza più: si accoda tutto il resto.
    if (righe.length === righeMax - 1 || larghezzaTesto(tentativo) <= larghezzaMax) {
      corrente = tentativo
    } else {
      righe.push(corrente)
      corrente = parola
    }
  }
  righe.push(corrente)
  return righe
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
    return { nodi: [], nastri: [], larghezza: opt.larghezza, altezza: opt.altezza, passoX: 0, haDati: false }
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
      // 'sotto' e non 'sopra': è l'ultimo nodo della colonna 1, e la fascia sopra
      // il suo bordo alto è attraversata per intero dalle diagonali che scendono
      // da "Imponibile lordo" verso il fondo della colonna 2 (contributi e
      // imposta). Restringere il testo non serve — il nastro copre quella banda a
      // qualunque ascissa; sotto il bordo inferiore, invece, non passa nulla.
      { id: 'nonImponibile', etichetta: 'Quota non imponibile (coefficiente)', valore: v.quotaNonImponibile, colonna: 1, colore: 'neutro', posizioneEtichetta: 'sotto' },
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

  const ultimaColonna = colonne[colonne.length - 1]
  const xDisponibile = opt.larghezza - 2 * opt.margineEtichette - opt.spessoreNodo
  const passoX = ultimaColonna > 0 ? xDisponibile / ultimaColonna : 0

  // Quante righe scrive un nodo fuori dal proprio rettangolo: le righe del nome
  // (una o due, secondo la lunghezza) più quella di importo e quota. Solo le
  // etichette 'sopra' e 'sotto' consumano spazio verticale; 'sinistra' e
  // 'destra' scrivono nelle corsie esterne, centrate sul nodo.
  const larghezzaUtile = larghezzaEtichettaSopra(passoX)
  const righeFuori = new Map<string, number>()
  for (const grezzo of grezzi) {
    righeFuori.set(
      grezzo.id,
      grezzo.posizioneEtichetta === 'sopra' || grezzo.posizioneEtichetta === 'sotto'
        ? spezzaEtichetta(grezzo.etichetta, larghezzaUtile).length + 1
        : 0,
    )
  }

  /** Altezza del blocco di testo di un'etichetta, compresa l'aria dal nodo. */
  const bloccoEtichetta = (id: string): number => {
    const righe = righeFuori.get(id) ?? 0
    return righe === 0 ? 0 : righe * ALTEZZA_RIGA + RESPIRO_ETICHETTA
  }

  /**
   * Spazio da lasciare SOPRA un nodo per la sua etichetta. Chi non scrive sopra
   * non ha bisogno di nulla, ma fra due nodi resta comunque un distacco minimo
   * perché i due rettangoli non si tocchino.
   */
  const spazioSopra = (id: string): number => {
    const grezzo = grezzi.find((n) => n.id === id)
    if (grezzo?.posizioneEtichetta !== 'sopra') return DISTACCO_MINIMO
    return Math.max(DISTACCO_MINIMO, bloccoEtichetta(id))
  }

  /**
   * Spazio da lasciare SOTTO un nodo: serve solo a chi scrive 'sotto', e va
   * riservato in fondo alla colonna perché il testo non esca dal viewBox.
   */
  const spazioSotto = (id: string): number => {
    const grezzo = grezzi.find((n) => n.id === id)
    if (grezzo?.posizioneEtichetta !== 'sotto') return 0
    return bloccoEtichetta(id) + DISCENDENTE
  }

  // Lo spazio fra due nodi consecutivi dipende da quante righe scrive il nodo
  // di sotto: con `spazioNodi` fisso l'etichetta più lunga finiva dentro il
  // nastro sottostante. `spazioNodi` resta come minimo garantito. Se il nodo di
  // SOPRA scrive 'sotto', il suo blocco occupa la stessa intercapedine: i due
  // ingombri si sommano, altrimenti si sovrapporrebbero.
  const spazioFra = (idSopra: string, idSotto: string): number =>
    Math.max(opt.spazioNodi, spazioSopra(idSotto) + spazioSotto(idSopra))

  // Il primo nodo di ogni colonna deve stare abbastanza in basso perché la sua
  // etichetta non esca dal viewBox: è il caso di "Netto in tasca", primo nodo
  // della colonna 2 e più alto di tutti.
  const cimaColonna = (lista: NodoGrezzo[]): number =>
    Math.max(opt.margineVerticale, spazioSopra(lista[0].id) + ASCENDENTE)

  /** Spazio sotto l'ultimo nodo della colonna, per la sua etichetta 'sotto'. */
  const codaColonna = (lista: NodoGrezzo[]): number => spazioSotto(lista[lista.length - 1].id)

  /** Somma delle intercapedini fra i nodi di una colonna. */
  const intercapedini = (lista: NodoGrezzo[]): number =>
    lista
      .slice(1)
      .reduce((somma, n, i) => somma + spazioFra(lista[i].id, n.id), 0)

  const spazioMassimo = Math.max(...colonne.map((c) => intercapedini(nodiPerColonna.get(c)!)))
  const cimaMassima = Math.max(...colonne.map((c) => cimaColonna(nodiPerColonna.get(c)!)))
  const codaMassima = Math.max(...colonne.map((c) => codaColonna(nodiPerColonna.get(c)!)))
  const altezzaUtile = Math.max(
    20,
    opt.altezza - cimaMassima - Math.max(opt.margineVerticale, codaMassima) - spazioMassimo,
  )
  const scala = altezzaUtile / v.fatturato

  const nodi: NodoSankey[] = []
  for (const c of colonne) {
    const listaColonna = nodiPerColonna.get(c)!
    const cima = cimaColonna(listaColonna)
    const altezzaTotale =
      listaColonna.reduce((somma, n) => somma + n.valore * scala, 0) +
      intercapedini(listaColonna)
    // Colonna centrata nello spazio disponibile: i nastri restano il più
    // orizzontali possibile, senza risalire sopra la cima riservata alle etichette
    // né scendere nella coda riservata all'etichetta 'sotto' dell'ultimo nodo.
    const fondo = Math.max(opt.margineVerticale, codaColonna(listaColonna))
    let y = cima + Math.max(0, (opt.altezza - cima - fondo - altezzaTotale) / 2)
    for (const [indice, grezzo] of listaColonna.entries()) {
      if (indice > 0) y += spazioFra(listaColonna[indice - 1].id, grezzo.id)
      const altezza = Math.max(1, grezzo.valore * scala)
      nodi.push({
        ...grezzo,
        quota: quotaSuFatturato(grezzo.valore, v.fatturato),
        x: opt.margineEtichette + c * passoX,
        y,
        larghezza: opt.spessoreNodo,
        altezza,
      })
      y += altezza
    }
  }

  allineaColonneDerivate(nodi, nastriGrezzi, colonne, opt)

  return {
    nodi,
    nastri: costruisciNastri(nodi, nastriGrezzi, scala),
    larghezza: opt.larghezza,
    altezza: opt.altezza,
    passoX,
    haDati: true,
  }
}

/**
 * Righe di testo di un'etichetta, con la geometria già risolta: il componente
 * le disegna, i test ne verificano le sovrapposizioni. Tenere il calcolo qui
 * (e non nel JSX) è ciò che rende la verifica possibile senza un browser.
 */
export interface RigaEtichetta {
  testo: string
  /** Coordinata della linea di base. */
  y: number
  /** `true` per la riga di importo e quota, `false` per le righe del nome. */
  valore: boolean
}

export interface EtichettaGeometrica {
  nodo: NodoSankey
  /** Ascissa di ancoraggio del testo. */
  x: number
  /** Ancoraggio SVG corrispondente a `posizioneEtichetta`. */
  anchor: 'start' | 'end'
  righe: RigaEtichetta[]
}

/**
 * Calcola le righe e le coordinate dell'etichetta di un nodo.
 *
 * 'sopra': il blocco di testo è appoggiato SOPRA il bordo alto del nodo, con la
 * riga di importo per ultima, subito sopra il rettangolo; il nome va a capo se
 * non sta nel passo fra colonne. 'sotto': stesso blocco, appoggiato SOTTO il
 * bordo inferiore, con le righe che si impilano verso il basso.
 * 'sinistra'/'destra': testo nella corsia esterna, centrato verticalmente sul
 * nodo, sempre su due righe.
 */
export function geometriaEtichetta(
  nodo: NodoSankey,
  testoValore: string,
  passoX: number,
  gapEtichetta: number,
): EtichettaGeometrica {
  if (nodo.posizioneEtichetta === 'sopra' || nodo.posizioneEtichetta === 'sotto') {
    const righeNome = spezzaEtichetta(nodo.etichetta, larghezzaEtichettaSopra(passoX))
    const testi = [...righeNome, testoValore]
    // 'sopra': l'ultima riga si appoggia sopra il bordo alto e le altre si
    // impilano verso l'alto, così il blocco cresce lontano dal nodo e non dentro
    // di esso. 'sotto': la PRIMA riga si appoggia sotto il bordo inferiore e le
    // successive scendono, per lo stesso motivo speculare.
    const sotto = nodo.posizioneEtichetta === 'sotto'
    const primaBase = nodo.y + nodo.altezza + RESPIRO_ETICHETTA + ASCENDENTE
    const ultimaBase = nodo.y - RESPIRO_ETICHETTA
    return {
      nodo,
      x: nodo.x,
      anchor: 'start',
      righe: testi.map((testo, i) => ({
        testo,
        y: sotto ? primaBase + i * ALTEZZA_RIGA : ultimaBase - (testi.length - 1 - i) * ALTEZZA_RIGA,
        valore: i === testi.length - 1,
      })),
    }
  }

  const destra = nodo.posizioneEtichetta === 'destra'
  return {
    nodo,
    x: destra ? nodo.x + nodo.larghezza + gapEtichetta : nodo.x - gapEtichetta,
    anchor: destra ? 'start' : 'end',
    righe: [
      { testo: nodo.etichetta, y: nodo.y + nodo.altezza / 2 - 2, valore: false },
      { testo: testoValore, y: nodo.y + nodo.altezza / 2 + 12, valore: true },
    ],
  }
}

/** Rettangolo di ingombro, in unità del viewBox. */
export interface Riquadro {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** Ingombro stimato di una riga di testo, secondo il suo ancoraggio. */
export function riquadroRiga(riga: RigaEtichetta, x: number, anchor: 'start' | 'end'): Riquadro {
  const larghezza = larghezzaTesto(riga.testo)
  return {
    x0: anchor === 'start' ? x : x - larghezza,
    x1: anchor === 'start' ? x + larghezza : x,
    y0: riga.y - ASCENDENTE,
    y1: riga.y + DISCENDENTE,
  }
}

/** Ingombro complessivo di tutte le righe di un'etichetta. */
export function riquadroEtichetta(etichetta: EtichettaGeometrica): Riquadro {
  const riquadri = etichetta.righe.map((r) => riquadroRiga(r, etichetta.x, etichetta.anchor))
  return {
    x0: Math.min(...riquadri.map((r) => r.x0)),
    x1: Math.max(...riquadri.map((r) => r.x1)),
    y0: Math.min(...riquadri.map((r) => r.y0)),
    y1: Math.max(...riquadri.map((r) => r.y1)),
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
 * Banda verticale occupata da un nastro nell'intervallo orizzontale [xa, xb].
 *
 * Il nastro è una Bézier cubica a tangenti orizzontali con spessore costante:
 * si campiona la curva e si prende il minimo/massimo nell'intervallo. Serve al
 * controllo di sovrapposizione delle etichette: un'etichetta non deve mai
 * cadere sopra un nastro che non sia uno dei propri.
 *
 * Restituisce `null` se il nastro non passa affatto per quell'intervallo.
 */
export function bandaNastro(
  nastro: NastroSankey,
  nodi: NodoSankey[],
  xa: number,
  xb: number,
  campioni = 160,
): { top: number; bottom: number } | null {
  const perId = new Map(nodi.map((n) => [n.id, n]))
  const sorgente = perId.get(nastro.da)
  const destinazione = perId.get(nastro.a)
  if (!sorgente || !destinazione || sorgente.valore <= 0) return null

  const x0 = sorgente.x + sorgente.larghezza
  const x1 = destinazione.x
  const cx = (x0 + x1) / 2
  const spessore = Math.max(1, nastro.valore * (sorgente.altezza / sorgente.valore))

  let top = Infinity
  let bottom = -Infinity
  for (let i = 0; i <= campioni; i++) {
    const t = i / campioni
    const u = 1 - t
    const x = u * u * u * x0 + 3 * u * u * t * cx + 3 * u * t * t * cx + t * t * t * x1
    if (x < xa || x > xb) continue
    const y =
      u * u * u * nastro.y0 +
      3 * u * u * t * nastro.y0 +
      3 * u * t * t * nastro.y1 +
      t * t * t * nastro.y1
    top = Math.min(top, y)
    bottom = Math.max(bottom, y + spessore)
  }
  return Number.isFinite(top) ? { top, bottom } : null
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
