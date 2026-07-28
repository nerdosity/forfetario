export const NOMI_MESI = [
  'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
  'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic',
] as const

const NOMI_MESI_ESTESI = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
] as const

const GIORNI_MESE = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

export function isBisestile(anno: number): boolean {
  return (anno % 4 === 0 && anno % 100 !== 0) || anno % 400 === 0
}

export function giorniInAnno(anno: number): number {
  return isBisestile(anno) ? 366 : 365
}

/** Numero di giorni del mese (1-based) tenendo conto dell'anno bisestile. */
export function giorniInMese(mese: number, anno: number): number {
  if (mese === 2 && isBisestile(anno)) return 29
  return GIORNI_MESE[mese - 1]
}

/** Giorni di permanenza (inclusivi) tra inizio e fine periodo nello stesso anno. */
export function giorniPermanenza(
  meseInizio: number,
  giornoInizio: number,
  meseFine: number,
  giornoFine: number,
  anno: number,
): number {
  if (meseInizio === meseFine) {
    return giornoFine - giornoInizio + 1
  }

  let giorni = giorniInMese(meseInizio, anno) - giornoInizio + 1
  for (let mese = meseInizio + 1; mese < meseFine; mese++) {
    giorni += giorniInMese(mese, anno)
  }
  giorni += giornoFine
  return giorni
}

/**
 * Valida la coerenza di un periodo (inizio/fine) all'interno di un anno.
 * Controlla che i giorni esistano nel rispettivo mese (con bisestile) e che
 * la fine non preceda l'inizio. Restituisce un messaggio d'errore o null.
 */
export function validaPeriodo(
  meseInizio: number,
  giornoInizio: number,
  meseFine: number,
  giornoFine: number,
  anno: number,
): string | null {
  const maxInizio = giorniInMese(meseInizio, anno)
  const maxFine = giorniInMese(meseFine, anno)

  if (giornoInizio < 1 || giornoInizio > maxInizio) {
    return `Giorno di inizio non valido: ${NOMI_MESI_ESTESI[meseInizio - 1]} ${anno} ha ${maxInizio} giorni.`
  }
  if (giornoFine < 1 || giornoFine > maxFine) {
    return `Giorno di fine non valido: ${NOMI_MESI_ESTESI[meseFine - 1]} ${anno} ha ${maxFine} giorni.`
  }
  if (meseFine < meseInizio || (meseFine === meseInizio && giornoFine < giornoInizio)) {
    return 'La data di fine periodo precede quella di inizio.'
  }
  return null
}

/** Converte una data "MM-GG" + anno in stringa leggibile "GG Mese AAAA". */
export function formattaScadenza(mmGiorno: string, anno: number): string {
  const [mm, gg] = mmGiorno.split('-').map(Number)
  return `${gg} ${NOMI_MESI_ESTESI[mm - 1]} ${anno}`
}

/** Converte una data leggibile "GG Mese AAAA" in "MM-GG". Null se non riconosciuta. */
export function mmggDaLeggibile(data: string): string | null {
  const m = data.trim().match(/^(\d{1,2})\s+([A-Za-zàèéìòù]+)\s+\d{4}$/)
  if (!m) return null
  const idx = NOMI_MESI_ESTESI.findIndex((n) => n.toLowerCase() === m[2].toLowerCase())
  if (idx < 0) return null
  return `${String(idx + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`
}
