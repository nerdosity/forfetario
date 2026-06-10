import { Info } from 'lucide-react'

interface TooltipProps {
  /** Testo informativo mostrato al passaggio del mouse. */
  content: string
  /** Etichetta accessibile alternativa (default: il contenuto). */
  label?: string
  /**
   * Lato di apertura della bolla. Default 'sopra'; usare 'sotto' quando il
   * trigger sta vicino al bordo superiore di un contenitore con overflow
   * (es. dentro un modal), dove la bolla verso l'alto verrebbe tagliata.
   */
  posizione?: 'sopra' | 'sotto'
  /** Allineamento orizzontale della bolla rispetto all'icona. Default 'centro'. */
  allinea?: 'centro' | 'sinistra'
}

/**
 * Icona informativa (i) con bolla esplicativa. La bolla è in posizione ASSOLUTA
 * rispetto all'icona: compare in overlay senza occupare spazio nel flusso,
 * quindi non spinge mai giù il layout. Appare su hover e focus.
 */
export function Tooltip({ content, label, posizione = 'sopra', allinea = 'centro' }: TooltipProps) {
  const vert = posizione === 'sopra' ? 'bottom-full mb-2' : 'top-full mt-2'
  const oriz = allinea === 'centro' ? 'left-1/2 -translate-x-1/2' : 'left-0'
  const frecciaVert =
    posizione === 'sopra' ? 'top-full border-t-slate-900' : 'bottom-full border-b-slate-900'
  const frecciaOriz = allinea === 'centro' ? 'left-1/2 -translate-x-1/2' : 'left-2'

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
        className={`pointer-events-none absolute z-50 w-64 max-w-[80vw] rounded-md bg-slate-900
          px-3 py-2 text-xs font-normal leading-relaxed text-white opacity-0 shadow-lg
          transition-opacity duration-150 whitespace-pre-wrap
          group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 ${vert} ${oriz}`}
      >
        {content}
        {/* Freccetta verso l'icona */}
        <span className={`absolute border-4 border-transparent ${frecciaVert} ${frecciaOriz}`} />
      </span>
    </span>
  )
}
