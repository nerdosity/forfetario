import type { ReactNode } from 'react'
import { TextInput, Select as FbSelect } from 'flowbite-react'

interface NumberInputProps {
  value: number | null
  onChange: (value: number | null) => void
  placeholder?: string
  min?: number
  max?: number
  step?: number
  small?: boolean
  id?: string
  /** Se true, una stringa vuota produce null invece di 0. */
  nullable?: boolean
}

/** Input numerico controllato (Flowbite TextInput) che normalizza vuoto/NaN. */
export function NumberInput({
  value,
  onChange,
  placeholder,
  min,
  max,
  step,
  small,
  id,
  nullable = false,
}: NumberInputProps) {
  return (
    <TextInput
      id={id}
      type="number"
      sizing={small ? 'sm' : 'md'}
      value={value ?? ''}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const raw = e.target.value
        if (raw === '') {
          onChange(nullable ? null : 0)
          return
        }
        const n = Number(raw)
        onChange(Number.isNaN(n) ? (nullable ? null : 0) : n)
      }}
    />
  )
}

/** NumberInput con € come addon iniziale (Flowbite TextInput addon). */
export function MoneyInput(props: Omit<NumberInputProps, 'placeholder'> & { placeholder?: string }) {
  const { value, onChange, placeholder, min, max, step, small, id, nullable = false } = props
  return (
    <TextInput
      id={id}
      type="number"
      addon="€"
      sizing={small ? 'sm' : 'md'}
      value={value ?? ''}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const raw = e.target.value
        if (raw === '') {
          onChange(nullable ? null : 0)
          return
        }
        const n = Number(raw)
        onChange(Number.isNaN(n) ? (nullable ? null : 0) : n)
      }}
    />
  )
}

interface Option<T> {
  value: T
  label: ReactNode
}

interface SelectProps<T extends string | number> {
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
  small?: boolean
  id?: string
}

/** Select controllata (Flowbite Select) che preserva il tipo del valore. */
export function Select<T extends string | number>({
  value,
  options,
  onChange,
  small,
  id,
}: SelectProps<T>) {
  const isNumeric = typeof value === 'number'
  return (
    <FbSelect
      id={id}
      sizing={small ? 'sm' : 'md'}
      value={value}
      onChange={(e) => onChange((isNumeric ? Number(e.target.value) : e.target.value) as T)}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={o.value}>
          {o.label}
        </option>
      ))}
    </FbSelect>
  )
}
