import type { ReactNode } from 'react'
import { Modal as FbModal, ModalHeader, ModalBody, ModalFooter } from 'flowbite-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  /** Larghezza del dialog (default '2xl'). */
  size?: 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl'
  /** Contenuto del footer (azioni). */
  footer?: ReactNode
  children: ReactNode
}

/** Dialog modale basato sul Modal di Flowbite. */
export function Modal({ open, onClose, title, subtitle, size = '2xl', footer, children }: ModalProps) {
  return (
    <FbModal show={open} onClose={onClose} size={size}>
      <ModalHeader>
        <span className="flex flex-col">
          <span>{title}</span>
          {subtitle && <span className="mt-0.5 text-sm font-normal text-slate-500">{subtitle}</span>}
        </span>
      </ModalHeader>
      <ModalBody>
        <div className="space-y-6">{children}</div>
      </ModalBody>
      {footer && <ModalFooter className="justify-end">{footer}</ModalFooter>}
    </FbModal>
  )
}
