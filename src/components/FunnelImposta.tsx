import { formatEuro } from '@/domain/labels'
import { theme } from '@/theme'

interface Props {
  fatturato: number
  imponibileLordo: number
  imponibileNetto: number
  imposta: number
  /** Etichetta facoltativa sopra il funnel. */
  titolo?: string
  /** Contributi dedotti, mostrati come nota se > 0. */
  contributiDedotti?: number
}

interface Stage {
  label: string
  value: number
  /** Colore pieno del segmento. */
  fill: string
  text: string
}

/**
 * Funnel a imbuto "dal fatturato all'imposta": segmenti CENTRATI che si
 * restringono progressivamente (larghezza proporzionale al valore), così la
 * forma comunica a colpo d'occhio quanto del fatturato resta come imposta.
 */
export function FunnelImposta({
  fatturato,
  imponibileLordo,
  imponibileNetto,
  imposta,
  titolo = "Dal fatturato all'imposta",
  contributiDedotti = 0,
}: Props) {
  const max = Math.max(fatturato, 1)
  const stages: Stage[] = [
    { label: 'Fatturato', value: fatturato, fill: 'bg-emerald-500', text: 'text-emerald-700' },
    { label: 'Imponibile lordo', value: imponibileLordo, fill: 'bg-blue-500', text: 'text-blue-700' },
    { label: 'Imponibile netto', value: imponibileNetto, fill: 'bg-indigo-500', text: 'text-indigo-700' },
    { label: 'Imposta sostitutiva', value: imposta, fill: 'bg-rose-500', text: 'text-rose-700' },
  ]
  // Larghezza % del segmento (minimo 8% per restare leggibile anche se piccolo)
  const larghezza = (v: number) => Math.max(8, Math.min(100, (v / max) * 100))
  const incidenza = fatturato > 0 ? (imposta / fatturato) * 100 : 0

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className={theme.groupLabel}>{titolo}</h3>
        <span className="text-xs text-slate-400">Incidenza imposta {incidenza.toFixed(1)}%</span>
      </div>

      {/* Imbuto: ogni segmento è centrato e più stretto del precedente. Un
          trapezio tenue collega lo stadio precedente a quello corrente. */}
      <div className="space-y-0">
        {stages.map((s, i) => {
          const w = larghezza(s.value)
          const wPrev = i > 0 ? larghezza(stages[i - 1].value) : w
          // Vertici del trapezio (in % della larghezza dello stadio precedente)
          const off = (1 - w / wPrev) * 50
          return (
            <div key={s.label}>
              {i > 0 && (
                <div className="mx-auto h-2.5" style={{ width: `${wPrev}%` }}>
                  <div
                    className={`h-full w-full ${stages[i - 1].fill} opacity-20`}
                    style={{ clipPath: `polygon(0 0, 100% 0, ${100 - off}% 100%, ${off}% 100%)` }}
                  />
                </div>
              )}
              <div
                className={`mx-auto flex h-9 items-center justify-between gap-2 rounded-md px-3 ${s.fill} text-white shadow-sm transition-all`}
                style={{ width: `${w}%` }}
              >
                <span className="truncate text-xs font-medium">{s.label}</span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{formatEuro(s.value)}</span>
              </div>
            </div>
          )
        })}
      </div>

      {contributiDedotti > 0.005 && (
        <p className="mt-3 text-xs text-amber-700">
          Include {formatEuro(contributiDedotti)} di contributi dedotti dall'imponibile.
        </p>
      )}
    </div>
  )
}
