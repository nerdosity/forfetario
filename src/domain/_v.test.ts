import { it } from 'vitest'
import { calcola } from './calcolo'
import type { CalcoloInput } from './types'

const input: CalcoloInput = {
  anno: 2025,
  regimiCorrente: [{ id: 'r3', tipo: 'artigiani', aliquota: 15, coefficiente: 67, meseInizio: 1, giornoInizio: 1, meseFine: 12, giornoFine: 31, fatturato: 51574, riduzioneContributi: '35' }],
  regimiPrecedente: [
    { id: 'r4', tipo: 'separata', aliquota: 15, coefficiente: 67, meseInizio: 1, giornoInizio: 1, meseFine: 2, giornoFine: 14, fatturato: 1516, riduzioneContributi: 'nessuna' },
    { id: 'r5', tipo: 'artigiani', aliquota: 15, coefficiente: 67, meseInizio: 2, giornoInizio: 15, meseFine: 12, giornoFine: 31, fatturato: 39870, riduzioneContributi: '35' }],
  contributiVersatiDuranteAnno: null, modalitaContributiVersati: 'dettaglio',
  contributiVersatiDettaglio: [], versamentiAnnoSuccessivo: [],
  contributiVersatiDuranteAnnoPrecedente: 7281, impostaSaldoVersatoAnnoCorrente: 0,
  impostaAcconto1VersatoAnnoCorrente: 0, impostaAcconto2VersatoAnnoCorrente: 0,
  accontiImposteVersatiPerAnnoPrecedente: 2904, rateazioniImposta: {},
}

const e2 = (n: number) => Math.round(n * 100) / 100

it('v', () => {
  const r = calcola(input)
  const acc2026 = r.scadenzeAnnoSuccessivo.filter((s) => s.categoria === 'Contributi eccedenza artigiani/commercianti' && s.voce?.includes('competenza 2026') && s.voce?.includes('acconto'))
  // eslint-disable-next-line no-console
  console.log('V', JSON.stringify({
    acconto2026: acc2026.map((s) => ({ voce: s.voce, importo: e2(s.importo) })),
    fissi2026: r.scadenzeAnnoSuccessivo.filter((s) => /Contributi fissi/.test(s.categoria ?? '') && s.voce?.includes('2026')).map((s) => ({ voce: s.voce, importo: e2(s.importo) })),
  }, null, 2))
})
