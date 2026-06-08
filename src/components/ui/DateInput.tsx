import { theme } from '@/theme'

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
 * Date-picker nativo del browser per scadenze ricorrenti.
 * Internamente lavora su "AAAA-MM-GG" (richiesto da <input type="date">) ma
 * espone e restituisce solo "MM-GG", perché l'anno della scadenza è implicito.
 */
export function DateInput({ value, onChange, anno, small, id }: DateInputProps) {
  // "MM-GG" → "AAAA-MM-GG" per il controllo nativo
  const isoValue = /^\d{2}-\d{2}$/.test(value) ? `${anno}-${value}` : ''

  return (
    <input
      id={id}
      type="date"
      className={small ? theme.inputSmall : theme.input}
      value={isoValue}
      onChange={(e) => {
        const iso = e.target.value // "AAAA-MM-GG" oppure ""
        if (!iso) return
        onChange(iso.slice(5)) // tiene "MM-GG"
      }}
    />
  )
}
