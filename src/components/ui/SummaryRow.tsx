import { theme, intent, type Intent } from '@/theme'
import { formatEuro } from '@/domain/labels'

interface SummaryRowProps {
  label: string
  /** Importo in euro, formattato automaticamente. */
  value: number
  valueIntent?: Intent
  /** Mostra il valore preceduto da segno (+/-). */
  sign?: '+' | '-'
  total?: boolean
}

/** Riga "etichetta … importo" usata nei riepiloghi. */
export function SummaryRow({ label, value, valueIntent, sign, total }: SummaryRowProps) {
  const amountClass = valueIntent ? intent[valueIntent].amount : theme.rowValue
  const prefix = sign ? `${sign} ` : ''
  return (
    <div className={total ? theme.rowTotal : theme.row}>
      <span className={theme.rowLabel}>{label}</span>
      <span className={amountClass}>
        {prefix}
        {formatEuro(value)}
      </span>
    </div>
  )
}
