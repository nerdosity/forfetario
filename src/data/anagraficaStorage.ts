const LS_KEY = 'forfettario_anagrafica'

/**
 * Dati anagrafici del contribuente per la sezione "contribuente" del modello
 * F24. Tutti i campi sono facoltativi: quelli vuoti restano caselle bianche
 * nel facsimile, da completare a mano.
 */
export interface AnagraficaContribuente {
  codiceFiscale: string
  cognome: string
  nome: string
  sesso: '' | 'M' | 'F'
  /** Testo libero "GG/MM/AAAA". */
  dataNascita: string
  comuneNascita: string
  provinciaNascita: string
}

export function anagraficaVuota(): AnagraficaContribuente {
  return {
    codiceFiscale: '',
    cognome: '',
    nome: '',
    sesso: '',
    dataNascita: '',
    comuneNascita: '',
    provinciaNascita: '',
  }
}

const testo = (v: unknown): string => (typeof v === 'string' ? v : '')

/** Carica l'anagrafica salvata; dati corrotti o assenti → anagrafica vuota. */
export function caricaAnagrafica(): AnagraficaContribuente {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return anagraficaVuota()
    const o = JSON.parse(raw) as Record<string, unknown>
    return {
      codiceFiscale: testo(o.codiceFiscale).toUpperCase(),
      cognome: testo(o.cognome),
      nome: testo(o.nome),
      sesso: o.sesso === 'M' || o.sesso === 'F' ? o.sesso : '',
      dataNascita: testo(o.dataNascita),
      comuneNascita: testo(o.comuneNascita),
      provinciaNascita: testo(o.provinciaNascita).toUpperCase(),
    }
  } catch {
    return anagraficaVuota()
  }
}

/** Salva l'anagrafica in localStorage. Silenzioso su errori (quota, ecc.). */
export function salvaAnagrafica(anagrafica: AnagraficaContribuente): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(anagrafica))
  } catch {
    // storage non disponibile — ignora
  }
}
