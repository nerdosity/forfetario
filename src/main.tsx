import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import { caricaAnniPersonalizzati } from '@/data/customYears'
import './index.css'

// Carica anni personalizzati da localStorage prima che React inizializzi lo stato.
// Garantisce che anniDisponibili() e datiAnno() siano già completi in inputIniziale().
caricaAnniPersonalizzati()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
