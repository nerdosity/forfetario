import { type ReactNode, useEffect, useRef, useState } from 'react'
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

/** Converte un numero in stringa per il campo: null/0-nullable → vuoto. */
function valoreInTesto(value: number | null, nullable: boolean): string {
  if (value === null) return ''
  // In modalità nullable lo 0 si mostra vuoto, così non resta uno "0" che dà
  // fastidio quando si inizia a digitare. Senza nullable, 0 resta 0.
  if (nullable && value === 0) return ''
  return String(value)
}

/** Normalizza l'input: virgola → punto, tiene solo cifre, un punto e meno iniziale. */
function normalizza(raw: string): string {
  let s = raw.replace(/,/g, '.')
  s = s.replace(/[^0-9.-]/g, '')
  // un solo punto
  const i = s.indexOf('.')
  if (i !== -1) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '')
  // meno solo in testa
  if (s.indexOf('-') > 0) s = s.replace(/-/g, '')
  return s
}

/**
 * Input numerico robusto e consolidato.
 *
 * Usa `type="text"` con `inputMode="decimal"` (niente frecce native, niente
 * blocco della virgola da parte del browser) e mantiene uno stato TESTUALE
 * locale, così la digitazione non viene mai interrotta da una normalizzazione
 * di React (nessuna perdita di focus, nessun "0" residuo). Il numero viene
 * propagato al genitore a ogni input valido; il testo si riallinea al valore
 * esterno solo quando questo cambia per davvero (non mentre si digita).
 */
function NumericField({
  value,
  onChange,
  placeholder,
  min,
  max,
  step,
  small,
  id,
  nullable = false,
  addon,
}: NumberInputProps & { addon?: ReactNode }) {
  const [testo, setTesto] = useState(() => valoreInTesto(value, nullable))
  // Traccia l'ultimo numero che ABBIAMO propagato, per non sovrascrivere il
  // testo dell'utente quando il re-render ci ripassa lo stesso valore.
  const ultimoEmesso = useRef<number | null>(value)

  useEffect(() => {
    if (value !== ultimoEmesso.current) {
      setTesto(valoreInTesto(value, nullable))
      ultimoEmesso.current = value
    }
  }, [value, nullable])

  const emit = (s: string) => {
    if (s === '' || s === '-' || s === '.') {
      const v = nullable ? null : 0
      ultimoEmesso.current = v
      onChange(v)
      return
    }
    const n = Number(s)
    if (!Number.isNaN(n)) {
      ultimoEmesso.current = n
      onChange(n)
    }
  }

  const clamp = () => {
    // Al blur normalizza il testo a un numero pulito entro i limiti
    if (testo === '' || testo === '-' || testo === '.') {
      setTesto(valoreInTesto(nullable ? null : 0, nullable))
      return
    }
    let n = Number(testo)
    if (Number.isNaN(n)) n = 0
    if (min !== undefined && n < min) n = min
    if (max !== undefined && n > max) n = max
    ultimoEmesso.current = n
    setTesto(valoreInTesto(n, nullable))
    onChange(n)
  }

  return (
    <TextInput
      id={id}
      type="text"
      inputMode="decimal"
      addon={addon}
      sizing={small ? 'sm' : 'md'}
      value={testo}
      placeholder={placeholder}
      step={step}
      onChange={(e) => {
        const s = normalizza(e.target.value)
        setTesto(s)
        emit(s)
      }}
      onBlur={clamp}
    />
  )
}

/** Input numerico controllato. */
export function NumberInput(props: NumberInputProps) {
  return <NumericField {...props} />
}

/** NumberInput con € come addon iniziale. */
export function MoneyInput(props: Omit<NumberInputProps, 'placeholder'> & { placeholder?: string }) {
  return <NumericField {...props} addon="€" />
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
