import { TextInput } from 'flowbite-react'

interface DateInputProps {
  /** Valore in formato "MM-GG". */
  value: string
  onChange: (mmgg: string) => void
  /** Anno usato solo per il date-picker nativo (il valore salvato resta MM-GG). */
  anno: number
  small?: boolean
  id?: string
}

/**
 * Date-picker NATIVO del browser (input type="date") per scadenze ricorrenti.
 * Internamente lavora su "AAAA-MM-GG" (richiesto dall'input nativo) ma espone
 * e restituisce solo "MM-GG", perché l'anno della scadenza è implicito.
 */
export function DateInput({ value, onChange, anno, small, id }: DateInputProps) {
  const isoValue = /^\d{2}-\d{2}$/.test(value) ? `${anno}-${value}` : ''

  return (
    <TextInput
      id={id}
      type="date"
      sizing={small ? 'sm' : 'md'}
      value={isoValue}
      onChange={(e) => {
        const iso = e.target.value
        if (!iso) return
        onChange(iso.slice(5))
      }}
    />
  )
}
