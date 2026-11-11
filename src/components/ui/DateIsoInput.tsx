import { TextInput } from 'flowbite-react'

interface DateIsoInputProps {
  /** Valore in formato "AAAA-MM-GG", oppure null se vuoto. */
  value: string | null
  onChange: (iso: string | null) => void
  id?: string
}

/** Date-picker NATIVO del browser (input type="date") con data completa ISO. */
export function DateIsoInput({ value, onChange, id }: DateIsoInputProps) {
  return (
    <TextInput
      id={id}
      type="date"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
    />
  )
}
