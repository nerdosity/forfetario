import { registraAnnoEsterno, rimuoviAnnoEsterno, validaAnno, type DatiAnno } from './taxData'

const LS_KEY = 'forfettario_custom_years'

/**
 * Carica gli anni personalizzati da localStorage e li registra nel database fiscale.
 * Chiamare prima del rendering React (in main.tsx) per garantire che
 * `anniDisponibili()` e `datiAnno()` restituiscano dati completi fin dall'avvio.
 */
export function caricaAnniPersonalizzati(): void {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return
    const stored = JSON.parse(raw) as Record<string, unknown>
    for (const [annoStr, dati] of Object.entries(stored)) {
      try {
        registraAnnoEsterno(Number(annoStr), validaAnno(annoStr, dati))
      } catch {
        // entry malformata — salta silenziosamente
      }
    }
  } catch {
    // JSON corrotto — ignora
  }
}

/** Salva un anno personalizzato nel database fiscale in memoria e in localStorage. */
export function salvaAnnoPersonalizzato(anno: number, dati: DatiAnno): void {
  registraAnnoEsterno(anno, dati)
  _persistLocally(anno, dati)
}

/** Rimuove un anno personalizzato dal database fiscale e da localStorage. */
export function rimuoviAnnoPersonalizzato(anno: number): void {
  rimuoviAnnoEsterno(anno)
  _removeLocally(anno)
}

/** Elenco degli anni personalizzati attualmente salvati in localStorage. */
export function anniPersonalizzatiSalvati(): number[] {
  try {
    const raw = localStorage.getItem(LS_KEY) ?? '{}'
    return Object.keys(JSON.parse(raw) as object)
      .map(Number)
      .sort((a, b) => b - a)
  } catch {
    return []
  }
}

function _persistLocally(anno: number, dati: DatiAnno): void {
  try {
    const raw = localStorage.getItem(LS_KEY) ?? '{}'
    const stored = JSON.parse(raw) as Record<string, unknown>
    stored[String(anno)] = dati
    localStorage.setItem(LS_KEY, JSON.stringify(stored))
  } catch {
    // quota exceeded o storage non disponibile
  }
}

function _removeLocally(anno: number): void {
  try {
    const raw = localStorage.getItem(LS_KEY) ?? '{}'
    const stored = JSON.parse(raw) as Record<string, unknown>
    delete stored[String(anno)]
    localStorage.setItem(LS_KEY, JSON.stringify(stored))
  } catch {}
}
