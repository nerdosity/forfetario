import { Info } from 'lucide-react'
import { theme } from '@/theme'

interface TooltipProps {
  /** Testo informativo mostrato al passaggio del mouse. */
  content: string
  /** Etichetta accessibile alternativa (default: il contenuto). */
  label?: string
}

/** Icona informativa (i) con bolla esplicativa al hover/focus. */
export function Tooltip({ content, label }: TooltipProps) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        className={theme.tooltipTrigger}
        aria-label={label ?? content}
      >
        <Info size={14} aria-hidden />
      </button>
      <span role="tooltip" className={theme.tooltipBubble}>
        {content}
      </span>
    </span>
  )
}
