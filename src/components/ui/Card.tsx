import type { ComponentType, ReactNode } from 'react'
import type { LucideProps } from 'lucide-react'
import { theme, intent, type Intent } from '@/theme'
import { Tooltip } from './Tooltip'

interface CardProps {
  title?: string
  icon?: ComponentType<LucideProps>
  iconIntent?: Intent
  info?: string
  compact?: boolean
  children: ReactNode
}

/** Sezione riquadrata con titolo, icona Lucide e tooltip opzionali. */
export function Card({
  title,
  icon: Icon,
  iconIntent = 'neutral',
  info,
  compact,
  children,
}: CardProps) {
  return (
    <section className={compact ? theme.cardCompact : theme.card}>
      {title && (
        <header className="mb-4 flex items-center gap-2">
          {Icon && <Icon size={20} className={intent[iconIntent].icon} aria-hidden />}
          <h2 className={theme.h2}>{title}</h2>
          {info && <Tooltip content={info} />}
        </header>
      )}
      {children}
    </section>
  )
}
