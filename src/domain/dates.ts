export const NOMI_MESI = [
  'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
  'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic',
] as const

export const NOMI_MESI_ESTESI = [
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

/** Converte una data "MM-GG" + anno in stringa leggibile "GG Mese AAAA". */
export function formattaScadenza(mmGiorno: string, anno: number): string {
  const [mm, gg] = mmGiorno.split('-').map(Number)
  return `${gg} ${NOMI_MESI_ESTESI[mm - 1]} ${anno}`
}

/** Estrae una Date ordinabile da "MM-GG" + anno (per ordinare le scadenze). */
export function dataOrdinabile(mmGiorno: string, anno: number): number {
  const [mm, gg] = mmGiorno.split('-').map(Number)
  return new Date(anno, mm - 1, gg).getTime()
}
