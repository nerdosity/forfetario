/**
 * Calcolo della codeline INPS (campo "Matricola INPS/Codice INPS" della sezione
 * INPS del modello F24) per i contributi di artigiani e commercianti.
 *
 * La codeline è di 17 cifre:
 *   matricola(8) + anno(2) + "1" + codiceSoggetto(2) + rata(1) + check(3)
 *
 * Le 3 cifre finali sono un codice di controllo deterministico. La formula è
 * stata ricostruita per reverse engineering dallo strumento ufficiale INPS
 * ("Calcolo Codeline" del Cassetto previdenziale Artigiani e Commercianti),
 * campionando ogni cifra in ogni posizione: il check risulta una somma di
 * contributi tabellari per posizione, modulo 1000. Validata su 83 casi reali.
 *
 * I contributi (CONTRIB[posizione][cifra]) sono relativi al caso di riferimento
 * matricola 10130045, anno 2025, rata 0 → check 565; la posizione 8 (decina
 * dell'anno) è costante e assorbita nella base. Per le posizioni con dati
 * incompleti (anno ≥ 2027, rate non previste) il calcolo restituisce null.
 */

const BASE_CHECK = 565 // check del caso di riferimento (matricola 10130045, anno 2025, rata 0)

/**
 * Contributi per posizione della stringa simbolica (11 cifre):
 * indici 0-7 = matricola, 8-9 = anno (2 cifre), 10 = rata.
 * Valore = delta da sommare a BASE_CHECK quando quella posizione ha quella cifra.
 */
const CONTRIB: Record<number, Record<number, number>> = {
  0: { 0: 704, 1: 0, 2: 296, 3: 608, 4: 905, 5: 211, 6: 523, 7: 819, 8: 134, 9: 441 },
  1: { 0: 0, 1: 30, 2: 55, 3: 85, 4: 115, 5: 151, 6: 181, 7: 211, 8: 236, 9: 266 },
  2: { 0: 799, 1: 0, 2: 201, 3: 402, 4: 608, 5: 809, 6: 10, 7: 211, 8: 420, 9: 626 },
  3: { 0: 939, 1: 963, 2: 976, 3: 0, 4: 24, 5: 43, 6: 56, 7: 80, 8: 104, 9: 117 },
  4: { 0: 0, 1: 95, 2: 201, 3: 296, 4: 402, 5: 513, 6: 608, 7: 722, 8: 817, 9: 923 },
  5: { 0: 0, 1: 7, 2: 15, 3: 32, 4: 35, 5: 52, 6: 59, 7: 66, 8: 84, 9: 91 },
  6: { 0: 383, 1: 787, 2: 186, 3: 601, 4: 0, 5: 399, 6: 822, 7: 221, 8: 625, 9: 25 },
  7: { 0: 801, 1: 840, 2: 884, 3: 917, 4: 956, 5: 0, 6: 39, 7: 83, 8: 116, 9: 155 },
  8: { 2: 0 }, // decina dell'anno: costante '2' nel periodo coperto
  9: { 0: 751, 1: 795, 2: 854, 3: 897, 4: 946, 5: 0, 6: 49 }, // unità anno: 2020..2026
  10: { 0: 0, 1: 5, 2: 19, 3: 34, 4: 44 }, // rata 0..4
}

/** Causali INPS gestite per la codeline (sezione INPS F24). */
export type CausaleInps = 'AF' | 'AP'

export interface ParametriCodeline {
  /** Matricola azienda INPS (8 cifre). */
  matricola: string
  /** Anno di imposizione del contributo (es. 2025). */
  anno: number
  /** Codice soggetto (10 = titolare; 11,12… collaboratori). */
  codiceSoggetto: string
  /** Numero rata: 0 = unica/saldo; 1-4 = rate (per i fissi). */
  rata: number
}

/** Le 3 cifre di controllo, o null se i dati escono dal dominio campionato. */
function calcolaCheck(matricola: string, anno: number, rata: number): string | null {
  const annoStr = String(anno).slice(-2).padStart(2, '0')
  const simbolica = `${matricola}${annoStr}${rata}` // 8 + 2 + 1 = 11 cifre
  if (simbolica.length !== 11 || !/^\d{11}$/.test(simbolica)) return null

  let totale = BASE_CHECK
  for (let pos = 0; pos < 11; pos++) {
    const cifra = Number(simbolica[pos])
    const contributo = CONTRIB[pos]?.[cifra]
    if (contributo === undefined) return null // cifra fuori dal dominio noto
    totale += contributo
  }
  return String(((totale % 1000) + 1000) % 1000).padStart(3, '0')
}

/**
 * Genera la codeline INPS completa (17 cifre) o null se i parametri sono fuori
 * dal dominio ricostruito (es. anno ≥ 2027, rata ≥ 5). Il chiamante, in caso di
 * null, deve ricadere sullo strumento ufficiale INPS.
 */
export function generaCodeline({ matricola, anno, codiceSoggetto, rata }: ParametriCodeline): string | null {
  if (!/^\d{8}$/.test(matricola)) return null
  if (!/^\d{2}$/.test(codiceSoggetto)) return null
  if (rata < 0 || rata > 4) return null

  const check = calcolaCheck(matricola, anno, rata)
  if (check === null) return null

  const annoStr = String(anno).slice(-2).padStart(2, '0')
  // matricola(8) + anno(2) + "1" progressivo fisso + codiceSoggetto(2) + rata(1) + check(3)
  return `${matricola}${annoStr}1${codiceSoggetto}${rata}${check}`
}

/** Vero se i parametri ricadono nel dominio in cui la codeline è calcolabile offline. */
export function codelineCalcolabile(p: ParametriCodeline): boolean {
  return generaCodeline(p) !== null
}

/** Una riga di versamento contributi con la sua codeline INPS. */
export interface RigaCodeline {
  descrizione: string
  causale: CausaleInps
  /** Anno di imposizione del contributo. */
  anno: number
  rata: number
  importo: number
  /** Codeline calcolata, o null se fuori dominio (usare lo strumento INPS). */
  codeline: string | null
}

/**
 * Costruisce le righe codeline per le scadenze di contributi artigiani/commercianti
 * di un anno. Riconosce dai metadati della scadenza:
 *  - "Contributi fissi …" → causale AF, rata dal numero di rata trimestrale (1-4);
 *  - "Contributi eccedenza …" → causale AP, rata 0 (saldo/acconti in unica imputazione).
 * Le scadenze di gestione separata sono escluse (codeline diversa, non gestita qui).
 */
export interface ScadenzaContributo {
  categoria?: string
  voce?: string
  descrizione: string
  importo: number
  annoScadenza: number
}

export function righeCodelineDaScadenze(
  scadenze: ScadenzaContributo[],
  matricola: string,
  codiceSoggetto: string,
): RigaCodeline[] {
  const righe: RigaCodeline[] = []
  for (const s of scadenze) {
    const cat = s.categoria ?? ''
    const isFissi = /Contributi fissi/i.test(cat)
    const isEccedenza = /eccedenza/i.test(cat)
    if (!isFissi && !isEccedenza) continue

    // anno di imposizione dal testo "competenza AAAA" nella voce, fallback annoScadenza
    const m = (s.voce ?? '').match(/competenza (\d{4})/)
    const anno = m ? Number(m[1]) : s.annoScadenza
    // rata trimestrale dal testo "Nª rata"; per l'eccedenza rata 0
    const rm = (s.voce ?? '').match(/(\d)ª rata/)
    const rata = isFissi && rm ? Number(rm[1]) : 0
    const causale: CausaleInps = isFissi ? 'AF' : 'AP'

    righe.push({
      descrizione: `${cat}${s.voce ? ' · ' + s.voce : ''}`,
      causale,
      anno,
      rata,
      importo: s.importo,
      codeline: generaCodeline({ matricola, anno, codiceSoggetto, rata }),
    })
  }
  return righe
}
