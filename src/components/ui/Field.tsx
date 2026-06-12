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
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-1.5">
        <Label htmlFor={htmlFor} className={`font-medium text-slate-700 ${small ? 'text-xs' : 'text-sm'}`}>
          {label}
        </Label>
        {info && (
          <span className="mt-0.5 shrink-0 leading-none">
            <Tooltip content={info} />
          </span>
        )}
      </div>
      {/* mt-auto: con label su una o due righe, il controllo resta allineato in basso
          quando i Field sono affiancati in un grid con altezze diverse */}
      <div className="mt-auto">{children}</div>
    </div>
  )
}
