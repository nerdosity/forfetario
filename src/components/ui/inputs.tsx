import type { ReactNode } from 'react'
import { theme } from '@/theme'

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

/** Input numerico controllato che normalizza vuoto/NaN. */
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
    <input
      id={id}
      type="number"
      className={small ? theme.inputSmall : theme.input}
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

/** Select controllata che preserva il tipo (numero o stringa) del valore. */
export function Select<T extends string | number>({
  value,
  options,
  onChange,
  small,
  id,
}: SelectProps<T>) {
  const isNumeric = typeof value === 'number'
  return (
    <select
      id={id}
      className={small ? theme.inputSmall : theme.select}
      value={value}
      onChange={(e) => onChange((isNumeric ? Number(e.target.value) : e.target.value) as T)}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
