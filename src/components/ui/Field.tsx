import type { ReactNode } from 'react'
import { Tooltip } from './Tooltip'
import { theme } from '@/theme'

interface FieldProps {
  label: string
  /** Testo del tooltip informativo (i). Omesso = nessuna icona. */
  info?: string
  small?: boolean
  htmlFor?: string
  children: ReactNode
}

/** Wrapper etichetta + tooltip (i) + controllo. */
export function Field({ label, info, small, htmlFor, children }: FieldProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <label htmlFor={htmlFor} className={small ? theme.labelSmall : theme.label}>
          {label}
        </label>
        {info && <Tooltip content={info} />}
      </div>
      {children}
    </div>
  )
}
