import { Info } from 'lucide-react'

interface TooltipProps {
  /** Testo informativo mostrato al passaggio del mouse. */
  content: string
  /** Etichetta accessibile alternativa (default: il contenuto). */
  label?: string
}

/**
 * Icona informativa (i) con bolla esplicativa. La bolla è in posizione ASSOLUTA
 * sopra l'icona (verso l'alto): compare in overlay senza occupare spazio nel
 * flusso, quindi non spinge mai giù il layout. Appare su hover e focus.
 */
export function Tooltip({ content, label }: TooltipProps) {
  return (
    <span className="group/tip relative inline-flex">
      <button
        type="button"
        className="inline-flex text-slate-400 transition-colors hover:text-slate-600"
        aria-label={label ?? content}
      >
        <Info size={14} aria-hidden />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 max-w-[80vw]
          -translate-x-1/2 rounded-md bg-slate-900 px-3 py-2 text-xs font-normal leading-relaxed
          text-white opacity-0 shadow-lg transition-opacity duration-150 whitespace-pre-wrap
          group-hover/tip:opacity-100 group-focus-within/tip:opacity-100"
      >
        {content}
        {/* Freccetta verso l'icona */}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
      </span>
    </span>
  )
}
