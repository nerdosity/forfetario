import type { ReactNode } from 'react'
import { theme, intent, intentSurface, type Intent } from '@/theme'

interface MetricProps {
  /** Valore principale (già formattato). */
  value: ReactNode
  label: string
  caption?: ReactNode
  valueIntent?: Intent
  /** Evidenzia con sfondo colorato secondo l'intent (per il dato chiave). */
  featured?: boolean
}

/** Blocco metrica centrato: valore grande + etichetta + nota opzionale. */
export function Metric({ value, label, caption, valueIntent = 'neutral', featured }: MetricProps) {
  if (featured) {
    const s = intentSurface[valueIntent]
    return (
      <div className={`rounded-xl border p-4 text-center sm:p-5 ${s.bg} ${s.border}`}>
        <div className={`text-xl font-bold tabular-nums sm:text-2xl ${s.text}`}>{value}</div>
        <div className={`mt-1 text-xs font-medium ${s.label}`}>{label}</div>
        {caption && <div className={`mt-1 text-xs ${s.label}`}>{caption}</div>}
      </div>
    )
  }
  return (
    <div className={theme.highlightBox}>
      <div className={`${theme.metricValue} ${intent[valueIntent].amount}`}>{value}</div>
      <div className={theme.metricLabel}>{label}</div>
      {caption && <div className="mt-1 text-xs text-slate-500">{caption}</div>}
    </div>
  )
}
