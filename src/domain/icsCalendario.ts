import type { Scadenza } from '@/domain/types'
import { mmggDaLeggibile } from '@/domain/dates'
import { formatEuro } from '@/domain/labels'

/**
 * Esportazione delle scadenze fiscali come file iCalendar (.ics), importabile
 * in Google Calendar, Outlook o Apple Calendar. Un evento "tutto il giorno"
 * per scadenza, con un promemoria alcuni giorni prima: Google Calendar importa
 * solo VEVENT (i VTODO, cioè i "task", non vengono riconosciuti in importazione),
 * quindi l'evento all-day con reminder è l'equivalente più vicino a un promemoria.
 */

/** Giorni di anticipo del promemoria (VALARM) rispetto alla scadenza. */
const GIORNI_PREAVVISO = 7

/** Converte "MM-GG" + anno in "AAAAMMGG" (formato data ICS, DATE senza ora). */
function dataIcs(mmgg: string, anno: number): string {
  const [mm, gg] = mmgg.split('-')
  return `${anno}${mm}${gg}`
}

/** Aggiunge un giorno a una data "AAAAMMGG" (per DTEND, esclusivo negli eventi all-day). */
function giornoSuccessivoIcs(dataAAAAMMGG: string): string {
  const anno = Number(dataAAAAMMGG.slice(0, 4))
  const mese = Number(dataAAAAMMGG.slice(4, 6))
  const giorno = Number(dataAAAAMMGG.slice(6, 8))
  const d = new Date(Date.UTC(anno, mese - 1, giorno + 1))
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const gg = String(d.getUTCDate()).padStart(2, '0')
  return `${d.getUTCFullYear()}${mm}${gg}`
}

/**
 * Escapa i caratteri speciali del formato ICS (RFC 5545): backslash, punto e
 * virgola, virgola, e newline letterali diventano `\n`.
 */
function escapaTesto(testo: string): string {
  return testo
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

/** Spezza le righe ICS oltre i 75 ottetti (RFC 5545 "line folding"), con continuazione a spazio. */
function piegaRiga(riga: string): string {
  const LIMITE = 75
  if (riga.length <= LIMITE) return riga
  const pezzi: string[] = []
  let resto = riga
  let primo = true
  while (resto.length > 0) {
    const n = primo ? LIMITE : LIMITE - 1
    pezzi.push((primo ? '' : ' ') + resto.slice(0, n))
    resto = resto.slice(n)
    primo = false
  }
  return pezzi.join('\r\n')
}

let contatoreUid = 0
/** UID univoco e stabile per riga (non riusa Date.now/Math.random: deterministico). */
function nuovoUid(): string {
  contatoreUid += 1
  return `forfettario-${contatoreUid}-${Math.trunc(performance.now() * 1000)}@forfettario.local`
}

/** Riga di una componente del dettaglio, per la descrizione dell'evento. */
function rigaComponente(c: { tipo: string; importo: number }): string {
  return c.importo < -0.005
    ? `${c.tipo}: − ${formatEuro(-c.importo)}`
    : `${c.tipo}: ${formatEuro(c.importo)}`
}

/** Un singolo evento VEVENT per una scadenza. */
function eventoIcs(s: Scadenza, dataStampa: string): string | null {
  const mmgg = mmggDaLeggibile(s.data)
  if (!mmgg) return null
  const dtstart = dataIcs(mmgg, s.annoScadenza)
  const dtend = giornoSuccessivoIcs(dtstart)

  // Cosa si sta pagando, per intero: categoria (es. "Imposta sostitutiva") +
  // voce (include già "1° acconto · competenza 2026 · rata 2 di 5" quando
  // rateizzata), con fallback sulla descrizione completa se manca la categoria.
  const cosa = s.categoria ? `${s.categoria}${s.voce ? ` – ${s.voce}` : ''}` : s.descrizione
  const importo = s.stimata ? `≈ ${formatEuro(s.importo)}` : formatEuro(s.importo)

  const descrizioneRighe = [
    `Cosa: ${cosa}`,
    `Importo da versare: ${importo}`,
    ...(s.importoConsigliato != null
      ? [`Importo consigliato (tiene conto di crediti/conguagli): ${
          s.importoConsigliato > 0 ? formatEuro(s.importoConsigliato) : '0,00 € (a credito)'
        }`]
      : []),
    // Dettaglio componenti (es. quota + interessi + maggiorazione di una rata,
    // o dovuto - acconti già versati di un saldo): solo se aggiunge informazione
    // oltre al totale già mostrato sopra.
    ...(s.componenti.length > 1 ? ['', 'Dettaglio:', ...s.componenti.map(rigaComponente)] : []),
    ...(s.nota ? ['', s.nota] : []),
    ...(s.stimata ? ['', 'Importo e data sono una stima: verifica i valori ufficiali quando pubblicati.'] : []),
    '',
    'Generato da Forfettario — verifica sempre l\'importo definitivo prima del versamento.',
  ]

  const righe = [
    'BEGIN:VEVENT',
    `UID:${nuovoUid()}`,
    `DTSTAMP:${dataStampa}`,
    `DTSTART;VALUE=DATE:${dtstart}`,
    `DTEND;VALUE=DATE:${dtend}`,
    `SUMMARY:${escapaTesto(`${cosa} — ${importo}`)}`,
    `DESCRIPTION:${escapaTesto(descrizioneRighe.join('\n'))}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Promemoria scadenza fiscale',
    `TRIGGER:-P${GIORNI_PREAVVISO}D`,
    'END:VALARM',
    'END:VEVENT',
  ]
  return righe.map(piegaRiga).join('\r\n')
}

/**
 * Genera il contenuto di un file .ics con un evento per ciascuna scadenza.
 * `dataStampa` è il timestamp DTSTAMP (UTC, formato "AAAAMMGGTHHMMSSZ"): va
 * passato dal chiamante (Date.now non è deterministico/testabile qui dentro).
 */
export function generaIcsScadenze(scadenze: Scadenza[], dataStampa: string): string {
  const eventi = scadenze.map((s) => eventoIcs(s, dataStampa)).filter((e): e is string => e !== null)
  const corpo = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Forfettario//Calendario fiscale//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...eventi,
    'END:VCALENDAR',
  ].join('\r\n')
  return corpo + '\r\n'
}

/** DTSTAMP ICS ("AAAAMMGGTHHMMSSZ") dall'istante corrente, per generaIcsScadenze. */
export function dataStampaIcsOra(): string {
  return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}
