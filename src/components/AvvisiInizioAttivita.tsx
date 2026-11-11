import { TriangleAlert } from 'lucide-react'
import type { Avviso } from '@/domain/diagnostica'
import { avvisiTheme } from '@/theme'

/** Elenco compatto di avvisi di coerenza sull'inizio attività. */
export function AvvisiInizioAttivita({ avvisi }: { avvisi: Avviso[] }) {
  if (avvisi.length === 0) return null
  return (
    <ul className={avvisiTheme.lista} role="status">
      {avvisi.map((a) => (
        <li key={a.id} className={avvisiTheme.voce}>
          <TriangleAlert className={avvisiTheme.icona} aria-hidden />
          <span>{a.messaggio}</span>
        </li>
      ))}
    </ul>
  )
}
