import { useMemo, useState } from 'react'
import {
  costruisciSankey,
  geometriaEtichetta,
  type EtichettaGeometrica,
  type IngressoSankey,
  type NastroSankey,
  type NodoSankey,
} from '@/domain/sankey'
import { formatEuro, formatPercent } from '@/domain/labels'
import { theme, flowColore } from '@/theme'

interface Props extends IngressoSankey {
  titolo?: string
}

/**
 * Larghezza del viewBox: coordinate di lavoro, non pixel (l'SVG scala sulla
 * larghezza del contenitore). Più larga è, più spazio orizzontale hanno le
 * etichette rispetto al testo, che resta di 11 unità.
 */
const LARGHEZZA = 900
/** Altezza del viewBox, tarata per lasciare aria alle etichette su più righe. */
const ALTEZZA = 380
/** Distanza fra il bordo del nodo e l'inizio del testo dell'etichetta. */
const GAP_ETICHETTA = 8
/**
 * Corsie di testo esterne al disegno. Sono asimmetriche perché lo sono le
 * etichette che ci scrivono: a sinistra solo "Fatturato" (che con l'importo
 * sta in ~80 unità), a destra le voci più lunghe delle gestioni. Tenere la
 * corsia sinistra stretta restituisce spazio al disegno, e quindi al passo fra
 * colonne entro cui devono stare le etichette 'sopra'.
 */
const CORSIA_SINISTRA = 92
const CORSIA_DESTRA = 132

/**
 * Diagramma Sankey "dove vanno i soldi": colonne di nodi collegate da nastri
 * curvi il cui spessore è proporzionale all'importo (stile flusso energetico).
 *
 *   Fatturato → imponibile lordo | quota non imponibile (coefficiente)
 *   colonna 1 → contributi INPS | imposta sostitutiva | netto in tasca
 *   contributi INPS → gestioni (solo con più di una gestione attiva)
 *
 * Tutti i valori arrivano dall'engine `calcola`: l'imposta è già calcolata
 * sull'imponibile al netto dei contributi versati, qui non si ricalcola nulla.
 * Geometria e ripartizione stanno in `@/domain/sankey` (testate a parte);
 * questo componente si limita a disegnare.
 */
export function SankeyFlusso({
  titolo = 'Dove vanno i soldi',
  fatturato,
  imponibileLordo,
  contributiINPS,
  imposte,
  contributiSeparata,
  contributiFissiArtComm,
  contributiEccedenzaArtComm,
}: Props) {
  // Dipendenze primitive: l'oggetto props cambia identità a ogni render, i numeri no.
  const grafico = useMemo(
    () =>
      costruisciSankey(
        {
          fatturato,
          imponibileLordo,
          contributiINPS,
          imposte,
          contributiSeparata,
          contributiFissiArtComm,
          contributiEccedenzaArtComm,
        },
        {
          larghezza: LARGHEZZA - CORSIA_SINISTRA - CORSIA_DESTRA,
          altezza: ALTEZZA,
          margineEtichette: 0,
        },
      ),
    [
      fatturato,
      imponibileLordo,
      contributiINPS,
      imposte,
      contributiSeparata,
      contributiFissiArtComm,
      contributiEccedenzaArtComm,
    ],
  )

  // Cosa sta sotto il cursore (o ha il focus da tastiera): un nodo, un nastro,
  // o niente. Stato locale, nessuna libreria di animazione.
  const [evidenza, setEvidenza] = useState<Evidenza>(null)

  if (!grafico.haDati) {
    return (
      <div>
        <div className={theme.flowHeader}>
          <h3 className={theme.groupLabel}>{titolo}</h3>
        </div>
        <p className={theme.flowEmpty}>Inserisci il fatturato per vedere il flusso.</p>
      </div>
    )
  }

  const netto = grafico.nodi.find((n) => n.id === 'netto')
  const descrizione = descriviFlusso(grafico.nodi)

  return (
    <div>
      <div className={theme.flowHeader}>
        <h3 className={theme.groupLabel}>{titolo}</h3>
        {netto && (
          <span className={theme.flowCaption}>
            In tasca {formatPercent(netto.quota)} del fatturato
          </span>
        )}
      </div>

      <div className={theme.flowWrap}>
        <svg
          className={theme.flowSvg}
          viewBox={`0 0 ${LARGHEZZA} ${ALTEZZA}`}
          preserveAspectRatio="xMidYMid meet"
          // `group` e non `img`: nodi e nastri sono elementi focalizzabili con
          // etichetta propria, e `role="img"` li nasconderebbe alle tecnologie
          // assistive presentando il disegno come un'immagine unica.
          role="group"
          aria-label={descrizione}
        >
          <title>{descrizione}</title>

          {/* Uscendo dall'area del disegno l'evidenziazione si azzera, anche se
              il puntatore lascia l'SVG di scatto senza passare dagli elementi. */}
          <g
            transform={`translate(${CORSIA_SINISTRA} 0)`}
            onMouseLeave={() => setEvidenza(null)}
          >
            {/* I nastri stanno sotto i nodi: i bordi dei nodi li rifiniscono. */}
            {grafico.nastri.map((nastro) => (
              <path
                key={nastro.id}
                d={nastro.path}
                className={`${flowColore[nastro.colore].nastro} ${theme.flowInterattivo} ${
                  attenua(evidenza, { tipo: 'nastro', nastro }) ? theme.flowAttenuato : theme.flowEvidenziato
                }`}
                fillOpacity={0.55}
                tabIndex={0}
                role="img"
                aria-label={`${nastro.descrizione}: ${formatEuro(nastro.valore)}`}
                onMouseEnter={() =>
                  setEvidenza({ tipo: 'nastro', id: nastro.id, da: nastro.da, a: nastro.a })
                }
                onFocus={() =>
                  setEvidenza({ tipo: 'nastro', id: nastro.id, da: nastro.da, a: nastro.a })
                }
                onBlur={() => setEvidenza(null)}
              >
                {/* Tooltip nativo SVG: voce e importo, utile anche per lo screen reader. */}
                <title>{`${nastro.descrizione}: ${formatEuro(nastro.valore)}`}</title>
              </path>
            ))}

            {grafico.nodi.map((nodo) => (
              <rect
                key={nodo.id}
                x={nodo.x}
                y={nodo.y}
                width={nodo.larghezza}
                height={nodo.altezza}
                rx={2}
                className={`${flowColore[nodo.colore].nodo} ${theme.flowInterattivo} ${
                  attenua(evidenza, { tipo: 'nodo', nodo }) ? theme.flowAttenuato : theme.flowEvidenziato
                }`}
                tabIndex={0}
                role="img"
                aria-label={`${nodo.etichetta}: ${formatEuro(nodo.valore)} (${formatPercent(nodo.quota)})`}
                onMouseEnter={() => setEvidenza({ tipo: 'nodo', id: nodo.id })}
                onFocus={() => setEvidenza({ tipo: 'nodo', id: nodo.id })}
                onBlur={() => setEvidenza(null)}
              >
                <title>{`${nodo.etichetta}: ${formatEuro(nodo.valore)} (${formatPercent(nodo.quota)})`}</title>
              </rect>
            ))}

            {/* Etichette fuori dal nastro: nome sopra, importo e quota sotto.
                Restano leggibili anche sui rami sottili perché il testo non è
                mai dentro il nastro. Non si attenuano MAI con l'evidenziazione:
                l'informazione non dipende dall'effetto al passaggio del mouse. */}
            {grafico.nodi.map((nodo) => (
              <EtichettaNodo key={nodo.id} nodo={nodo} passoX={grafico.passoX} />
            ))}
          </g>
        </svg>
      </div>

      {/* Legenda testuale: l'informazione non è veicolata solo dal colore. */}
      <ul className={theme.flowLegend}>
        {grafico.nodi
          .filter((n) => n.id !== 'fatturato')
          .map((nodo) => (
            <li key={nodo.id} className={theme.flowLegendItem}>
              <span className={`${theme.flowLegendDot} ${flowColore[nodo.colore].dot}`} aria-hidden />
              <span>{nodo.etichetta}</span>
              <span className={theme.flowLegendValore}>{formatEuro(nodo.valore)}</span>
              <span className={theme.flowLegendQuota}>{formatPercent(nodo.quota)}</span>
            </li>
          ))}
      </ul>
    </div>
  )
}

/**
 * Nome (su una o due righe, secondo la lunghezza) e, sotto, importo e quota.
 * Sempre FUORI dal nastro, così anche i rami sottilissimi restano etichettati.
 *
 * La geometria — righe, a-capo e coordinate — arriva da `geometriaEtichetta`:
 * l'SVG non manda a capo da solo e il calcolo sta nel dominio, dove i test
 * possono verificare che nessuna etichetta finisca sopra un nastro altrui.
 */
function EtichettaNodo({ nodo, passoX }: { nodo: NodoSankey; passoX: number }) {
  const colore = flowColore[nodo.colore]
  const etichetta: EtichettaGeometrica = geometriaEtichetta(
    nodo,
    `${formatEuro(nodo.valore)} · ${formatPercent(nodo.quota)}`,
    passoX,
    GAP_ETICHETTA,
  )

  return (
    <g textAnchor={etichetta.anchor} className={`${colore.testo} ${theme.flowEtichetta}`} aria-hidden>
      {etichetta.righe.map((riga) => (
        <text
          key={`${riga.valore ? 'v' : 'n'}-${riga.y}`}
          x={etichetta.x}
          y={riga.y}
          className={riga.valore ? theme.flowValore : theme.flowNome}
        >
          {riga.testo}
        </text>
      ))}
    </g>
  )
}

/**
 * Elemento attualmente sotto il cursore o con il focus da tastiera.
 *
 * Per un nastro si portano dietro anche i due capi (`da`/`a`): così `attenua`
 * non deve ricavarli spezzando l'id, che è solo una chiave di rendering.
 */
export type Evidenza =
  | { tipo: 'nodo'; id: string }
  | { tipo: 'nastro'; id: string; da: string; a: string }
  | null

/**
 * Decide se un elemento va attenuato.
 *
 * Con un nastro evidenziato restano pieni quel nastro e i due nodi che collega.
 * Con un nodo evidenziato restano pieni il nodo stesso e tutti i nastri
 * entranti e uscenti da esso: è il "percorso correlato". Senza evidenza nulla
 * si attenua.
 */
export function attenua(
  evidenza: Evidenza,
  elemento: { tipo: 'nodo'; nodo: NodoSankey } | { tipo: 'nastro'; nastro: NastroSankey },
): boolean {
  if (!evidenza) return false

  if (evidenza.tipo === 'nastro') {
    if (elemento.tipo === 'nastro') return elemento.nastro.id !== evidenza.id
    // Il nodo resta pieno se è un capo del nastro evidenziato.
    return elemento.nodo.id !== evidenza.da && elemento.nodo.id !== evidenza.a
  }

  if (elemento.tipo === 'nodo') return elemento.nodo.id !== evidenza.id
  return elemento.nastro.da !== evidenza.id && elemento.nastro.a !== evidenza.id
}

/** Descrizione testuale del flusso, usata come aria-label e <title>. */
function descriviFlusso(nodi: NodoSankey[]): string {
  const voce = (id: string) => nodi.find((n) => n.id === id)
  const parti = ['imponibile', 'contributi', 'imposta', 'netto']
    .map(voce)
    .filter((n): n is NodoSankey => n !== undefined)
    .map((n) => `${n.etichetta} ${formatEuro(n.valore)} (${formatPercent(n.quota)})`)
  const fatturato = voce('fatturato')
  const testa = fatturato ? `Flusso del fatturato ${formatEuro(fatturato.valore)}` : 'Flusso del fatturato'
  return parti.length ? `${testa}: ${parti.join('; ')}.` : `${testa}.`
}
