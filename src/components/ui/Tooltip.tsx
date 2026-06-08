import { Info } from 'lucide-react'
import { Tooltip as FbTooltip } from 'flowbite-react'

interface TooltipProps {
  /** Testo informativo mostrato al passaggio del mouse. */
  content: string
  /** Etichetta accessibile alternativa (default: il contenuto). */
  label?: string
}

/** Icona informativa (i) con tooltip Flowbite al hover/focus. */
export function Tooltip({ content, label }: TooltipProps) {
  return (
    <FbTooltip content={<span className="whitespace-pre-wrap">{content}</span>}>
      <button type="button" className="inline-flex text-slate-400 transition-colors hover:text-slate-600" aria-label={label ?? content}>
        <Info size={14} aria-hidden />
      </button>
    </FbTooltip>
  )
}
