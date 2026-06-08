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
  bar: string
  text: string
}

/**
 * Funnel "dal fatturato all'imposta": barre proporzionali in scala che si
 * restringono da fatturato a imposta sostitutiva. Riutilizzato per anno
 * corrente e anno precedente.
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
    { label: 'Fatturato', value: fatturato, bar: 'bg-emerald-500', text: 'text-emerald-700' },
    { label: 'Imponibile lordo', value: imponibileLordo, bar: 'bg-blue-500', text: 'text-blue-700' },
    { label: 'Imponibile netto', value: imponibileNetto, bar: 'bg-indigo-500', text: 'text-indigo-700' },
    { label: 'Imposta sostitutiva', value: imposta, bar: 'bg-red-500', text: 'text-red-700' },
  ]
  const pct = (v: number) => `${Math.max(2, Math.min(100, (v / max) * 100))}%`
  const incidenza = fatturato > 0 ? (imposta / fatturato) * 100 : 0

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className={theme.groupLabel}>{titolo}</h3>
        <span className="text-xs text-slate-400">Incidenza imposta {incidenza.toFixed(1)}%</span>
      </div>

      <div className="space-y-2.5">
        {stages.map((s) => (
          <div key={s.label}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">{s.label}</span>
              <span className={`text-sm font-semibold tabular-nums ${s.text}`}>{formatEuro(s.value)}</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${s.bar} transition-all`} style={{ width: pct(s.value) }} />
            </div>
          </div>
        ))}
      </div>

      {contributiDedotti > 0.005 && (
        <p className="mt-3 text-xs text-amber-700">
          Include {formatEuro(contributiDedotti)} di contributi dedotti dall'imponibile.
        </p>
      )}
    </div>
  )
}
