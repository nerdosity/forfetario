import { useMemo } from 'react'
import { costruisciSankey, type IngressoSankey, type NodoSankey } from '@/domain/sankey'
import { formatEuro, formatPercent } from '@/domain/labels'
import { theme, flowColore } from '@/theme'

interface Props extends IngressoSankey {
  titolo?: string
}

/** Larghezza del viewBox: coordinate di lavoro, non pixel (l'SVG scala). */
const LARGHEZZA = 760
/** Altezza del viewBox, tarata per lasciare aria alle etichette su due righe. */
const ALTEZZA = 340
/** Distanza fra il bordo del nodo e l'inizio del testo dell'etichetta. */
const GAP_ETICHETTA = 8
/** Spazio riservato al testo su ciascun lato del disegno. */
const CORSIA_TESTO = 148

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
          larghezza: LARGHEZZA - 2 * CORSIA_TESTO,
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
          role="img"
          aria-label={descrizione}
        >
          <title>{descrizione}</title>

          <g transform={`translate(${CORSIA_TESTO} 0)`}>
            {/* I nastri stanno sotto i nodi: i bordi dei nodi li rifiniscono. */}
            {grafico.nastri.map((nastro) => (
              <path
                key={nastro.id}
                d={nastro.path}
                className={flowColore[nastro.colore].nastro}
                fillOpacity={0.55}
              />
            ))}

            {grafico.nodi.map((nodo) => (
              <rect
                key={nodo.id}
                x={nodo.x}
                y={nodo.y}
                width={nodo.larghezza}
                height={nodo.altezza}
                rx={2}
                className={flowColore[nodo.colore].nodo}
              />
            ))}

            {/* Etichette fuori dal nastro: nome sopra, importo e quota sotto.
                Restano leggibili anche sui rami sottili perché il testo non è
                mai dentro il nastro. */}
            {grafico.nodi.map((nodo) => (
              <EtichettaNodo key={nodo.id} nodo={nodo} />
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
              <span className="font-medium tabular-nums text-slate-800">{formatEuro(nodo.valore)}</span>
              <span className="tabular-nums text-slate-400">{formatPercent(nodo.quota)}</span>
            </li>
          ))}
      </ul>
    </div>
  )
}

/**
 * Nome su una riga, importo e quota sulla successiva. Sempre FUORI dal nastro,
 * così anche i rami sottilissimi restano etichettati e leggibili.
 */
function EtichettaNodo({ nodo }: { nodo: NodoSankey }) {
  const colore = flowColore[nodo.colore]
  const sopra = nodo.posizioneEtichetta === 'sopra'

  // 'sopra': testo allineato al bordo sinistro del nodo, appoggiato sopra di esso.
  // 'sinistra'/'destra': testo centrato verticalmente sul nodo, nella corsia esterna.
  const x = sopra
    ? nodo.x
    : nodo.posizioneEtichetta === 'destra'
      ? nodo.x + nodo.larghezza + GAP_ETICHETTA
      : nodo.x - GAP_ETICHETTA
  const anchor = sopra ? 'start' : nodo.posizioneEtichetta === 'destra' ? 'start' : 'end'
  const yNome = sopra ? nodo.y - 14 : nodo.y + nodo.altezza / 2 - 2
  const yValore = sopra ? nodo.y - 3 : nodo.y + nodo.altezza / 2 + 12

  return (
    <g textAnchor={anchor} className={colore.testo}>
      <text x={x} y={yNome} className="fill-current text-[11px] font-medium">
        {nodo.etichetta}
      </text>
      <text x={x} y={yValore} className="fill-current text-[11px] tabular-nums opacity-80">
        {formatEuro(nodo.valore)} · {formatPercent(nodo.quota)}
      </text>
    </g>
  )
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
