import type { ReactNode } from 'react'
import { Label } from 'flowbite-react'
import { Tooltip } from './Tooltip'

interface FieldProps {
  label: string
  /** Testo del tooltip informativo (i). Omesso = nessuna icona. */
  info?: string
  small?: boolean
  htmlFor?: string
  children: ReactNode
}

/** Wrapper etichetta (Flowbite Label) + tooltip (i) + controllo. */
export function Field({ label, info, small, htmlFor, children }: FieldProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={htmlFor} className={small ? 'text-xs' : undefined}>
          {label}
        </Label>
        {info && <Tooltip content={info} />}
      </div>
      {children}
    </div>
  )
}
