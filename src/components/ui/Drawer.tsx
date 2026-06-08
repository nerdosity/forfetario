import { type ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { theme } from '@/theme'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  footer?: ReactNode
  children: ReactNode
}

/** Pannello laterale a scomparsa che scorre da destra. Chiude su Esc o backdrop. */
export function Drawer({ open, onClose, title, subtitle, footer, children }: DrawerProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <>
      <div className={theme.drawerOverlay} onClick={onClose} aria-hidden />
      <aside role="dialog" aria-modal="true" aria-label={title} className={theme.drawerPanel}>
        <header className={theme.drawerHeader}>
          <div>
            <h2 className={theme.h2}>{title}</h2>
            {subtitle && <p className={`${theme.subtitle} mt-0.5`}>{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className={theme.btnIcon} aria-label="Chiudi">
            <X size={20} aria-hidden />
          </button>
        </header>

        <div className={theme.drawerBody}>{children}</div>

        {footer && <footer className={theme.drawerFooter}>{footer}</footer>}
      </aside>
    </>,
    document.body,
  )
}
