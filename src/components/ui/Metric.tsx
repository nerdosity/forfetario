import type { ReactNode } from 'react'
import { theme, intent, type Intent } from '@/theme'

interface MetricProps {
  /** Valore principale (già formattato). */
  value: ReactNode
  label: string
  caption?: ReactNode
  valueIntent?: Intent
}

/** Blocco metrica centrato: valore grande + etichetta + nota opzionale. */
export function Metric({ value, label, caption, valueIntent = 'neutral' }: MetricProps) {
  return (
    <div className={theme.highlightBox}>
      <div className={`${theme.metricValue} ${intent[valueIntent].amount}`}>{value}</div>
      <div className={theme.metricLabel}>{label}</div>
      {caption && <div className="mt-1 text-xs text-slate-500">{caption}</div>}
    </div>
  )
}
