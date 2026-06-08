import { type ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { theme } from '@/theme'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  /** Contenuto del footer (azioni). Reso in una barra sticky in fondo. */
  footer?: ReactNode
  children: ReactNode
}

/** Dialog modale centrato con overlay, chiusura su Esc e click sul backdrop. */
export function Modal({ open, onClose, title, subtitle, footer, children }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    // Blocca lo scroll del body mentre il modal è aperto
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className={theme.modalOverlay}
      onMouseDown={(e) => {
        // Chiude solo se il click parte dal backdrop, non dal dialog
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className={theme.modalDialog}>
        <header className={theme.modalHeader}>
          <div>
            <h2 className={theme.h2}>{title}</h2>
            {subtitle && <p className={`${theme.subtitle} mt-0.5`}>{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className={theme.btnIcon} aria-label="Chiudi">
            <X size={20} aria-hidden />
          </button>
        </header>

        <div className={theme.modalBody}>{children}</div>

        {footer && <footer className={theme.modalFooter}>{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
