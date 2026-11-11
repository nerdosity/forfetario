import { describe, expect, it } from 'vitest'
import { normalizzaInput } from '@/data/inputStorage'
import { ESEMPIO_IMPORT, SPEC_IMPORT } from './specImport'
import type { CalcoloInput, TipoRegime, TipoVersamento } from './types'

const BASE: CalcoloInput = { anno: 2025, anni: {}, rateazioniImposta: {} }

// Gli id sono generati a ogni normalizzazione: si confrontano le strutture senza.
const senzaId = (v: unknown) => JSON.parse(JSON.stringify(v, (k, x) => (k === 'id' ? undefined : x)))

describe('specifica di importazione', () => {
  it("l'esempio sopravvive alla normalizzazione invariato", () => {
    const out = normalizzaInput(ESEMPIO_IMPORT as unknown as Record<string, unknown>, BASE)
    expect(senzaId(out)).toEqual(senzaId(ESEMPIO_IMPORT))
  })

  it('la specifica cita ogni tipo di versamento e di regime', () => {
    const versamenti: Record<TipoVersamento, true> = {
      'gs-saldo': true, 'gs-acconto-1': true, 'gs-acconto-2': true,
      'fissi-1': true, 'fissi-2': true, 'fissi-3': true, 'fissi-4-prec': true,
      'ecc-saldo': true, 'ecc-acconto-1': true, 'ecc-acconto-2': true,
      'enpap-soggettivo': true, 'enpap-integrativo': true, 'enpap-maternita': true,
      'fpls-trattenute': true, altro: true,
    }
    const regimi: Record<TipoRegime, true> = {
      separata: true, artigiani: true, commercianti: true, enpap: true, spettacolo: true,
    }
    for (const t of [...Object.keys(versamenti), ...Object.keys(regimi)]) {
      expect(SPEC_IMPORT).toContain(t)
    }
  })
})
