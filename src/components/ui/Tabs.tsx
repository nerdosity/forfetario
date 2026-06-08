import type { ComponentType } from 'react'
import type { LucideProps } from 'lucide-react'
import { theme } from '@/theme'

export interface TabItem<T extends string> {
  id: T
  label: string
  icon?: ComponentType<LucideProps>
}

interface TabsProps<T extends string> {
  items: TabItem<T>[]
  value: T
  onChange: (id: T) => void
}

/** Barra di navigazione a tab. Stile "pill" segmentato. */
export function Tabs<T extends string>({ items, value, onChange }: TabsProps<T>) {
  return (
    <div className={theme.tabBar} role="tablist">
      {items.map(({ id, label, icon: Icon }) => {
        const active = id === value
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={`${theme.tab} ${active ? theme.tabActive : ''}`}
          >
            {Icon && <Icon size={16} aria-hidden />}
            {label}
          </button>
        )
      })}
    </div>
  )
}
