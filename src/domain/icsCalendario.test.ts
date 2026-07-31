import { describe, it, expect } from 'vitest'
import { generaIcsScadenze } from './icsCalendario'
import type { Scadenza } from './types'

const DTSTAMP = '20260731T120000Z'

/** Rimuove il line-folding ICS (RFC 5545: "\r\n " di continuazione) per confronti più semplici nei test. */
function spiega(ics: string): string {
  return ics.replace(/\r\n /g, '')
}

function scadenza(over: Partial<Scadenza>): Scadenza {
  return {
    data: '20 Agosto 2026',
    descrizione: 'test',
    importo: 735.37,
    componenti: [],
    annoScadenza: 2026,
    ...over,
  }
}

describe('generaIcsScadenze', () => {
  it('produce un calendario valido con BEGIN/END VCALENDAR', () => {
    const ics = generaIcsScadenze([scadenza({})], DTSTAMP)
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.trim().endsWith('END:VCALENDAR')).toBe(true)
    expect(ics).toContain('VERSION:2.0')
  })

  it('un evento per scadenza, con date DTSTART/DTEND all-day corrette', () => {
    const ics = generaIcsScadenze(
      [scadenza({ data: '20 Agosto 2026', annoScadenza: 2026 })],
      DTSTAMP,
    )
    expect(ics).toContain('DTSTART;VALUE=DATE:20260820')
    expect(ics).toContain('DTEND;VALUE=DATE:20260821') // esclusivo: giorno dopo
  })

  it('gestisce il cambio mese/anno nel DTEND', () => {
    const ics = generaIcsScadenze(
      [scadenza({ data: '31 Dicembre 2026', annoScadenza: 2026 })],
      DTSTAMP,
    )
    expect(ics).toContain('DTSTART;VALUE=DATE:20261231')
    expect(ics).toContain('DTEND;VALUE=DATE:20270101')
  })

  it('include categoria, voce e importo formattato nel titolo', () => {
    const ics = generaIcsScadenze(
      [scadenza({ categoria: 'Contributi fissi artigiani', voce: '2ª rata trimestrale · competenza 2026', importo: 735.37 })],
      DTSTAMP,
    )
    expect(ics).toContain('SUMMARY:Contributi fissi artigiani')
    expect(ics).toContain('735\\,37')
  })

  it('due scadenze producono due VEVENT con UID diversi', () => {
    const ics = generaIcsScadenze(
      [scadenza({ data: '20 Agosto 2026' }), scadenza({ data: '16 Settembre 2026' })],
      DTSTAMP,
    )
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    const uids = [...ics.matchAll(/UID:([^\r\n]+)/g)].map((m) => m[1])
    expect(new Set(uids).size).toBe(2)
  })

  it('include un VALARM di preavviso per ogni evento', () => {
    const ics = generaIcsScadenze([scadenza({})], DTSTAMP)
    expect(ics).toContain('BEGIN:VALARM')
    expect(ics).toContain('TRIGGER:-P7D')
  })

  it('scadenza con data non riconoscibile viene scartata senza rompere il file', () => {
    const ics = generaIcsScadenze([scadenza({ data: 'data non valida' })], DTSTAMP)
    expect(ics.match(/BEGIN:VEVENT/g)).toBeNull()
    expect(ics.trim()).toBe('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Forfettario//Calendario fiscale//IT\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nEND:VCALENDAR')
  })

  it('escapa correttamente virgole nel titolo (importo con centesimi)', () => {
    const ics = generaIcsScadenze([scadenza({ importo: 1234.56 })], DTSTAMP)
    expect(ics).toMatch(/SUMMARY:.*1\.234\\,56/)
  })

  it('descrizione include cosa si paga, importo e dettaglio componenti (rata, quota, interessi)', () => {
    const ics = generaIcsScadenze(
      [
        scadenza({
          categoria: 'Imposta sostitutiva',
          voce: '1° acconto · competenza 2026 · rata 2 di 5',
          importo: 407.57,
          componenti: [
            { tipo: 'Quota', importo: 405.95 },
            { tipo: 'Interessi rateazione 0,18%', importo: 1.62 },
          ],
        }),
      ],
      DTSTAMP,
    )
    const testo = spiega(ics)
    expect(testo).toContain('Cosa: Imposta sostitutiva – 1° acconto · competenza 2026 · rata 2 di 5')
    expect(testo).toContain('Importo da versare: 407\\,57')
    expect(testo).toContain('Quota: 405\\,95')
    expect(testo).toContain('Interessi rateazione')
  })

  it('descrizione include l\'importo consigliato quando presente (conguaglio)', () => {
    const ics = generaIcsScadenze(
      [scadenza({ importoConsigliato: 569.13, notaConsigliato: 'Hai un credito su questa gestione.' })],
      DTSTAMP,
    )
    expect(ics).toContain('Importo consigliato')
    expect(ics).toContain('569\\,13')
  })

  it('lista vuota produce un calendario valido senza eventi', () => {
    const ics = generaIcsScadenze([], DTSTAMP)
    expect(ics.match(/BEGIN:VEVENT/g)).toBeNull()
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
  })
})
