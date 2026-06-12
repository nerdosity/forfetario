import { describe, it, expect } from 'vitest'
import { datiAnno } from '@/data/taxData'
import { applicaRiduzioneIVS } from './contributi'

/**
 * Verifica contro lo strumento ufficiale INPS "Contributi eccedenti il minimale"
 * (caso di prova, gestione artigiani, riduzione 35%).
 * INPS per anno competenza 2025: reddito 2025 = 34.554, reddito 2024 = 26.713.
 *   eccedenza dovuta 2025 = 2.495,84
 *   1° acconto = 636,32 · 2° acconto = 636,32 · saldo = 1.223,20
 * Obiettivo: capire su quale reddito INPS calcola gli acconti.
 */

// Eccedenza IVS artigiani su un reddito ANNUO INTERO (attività tutto l'anno),
// con riduzione 35%, secondo le costanti dell'anno indicato.
function eccedenzaArtigiani(reddito: number, anno: number): number {
  const { minimaleReddito, sogliaPrimaFascia, aliquotaArtigiani } = datiAnno(anno)
  if (reddito <= minimaleReddito) return 0
  let bruti: number
  if (reddito <= sogliaPrimaFascia) {
    bruti = ((reddito - minimaleReddito) * aliquotaArtigiani) / 100
  } else {
    const fascia1 = sogliaPrimaFascia - minimaleReddito
    const fascia2 = reddito - sogliaPrimaFascia
    bruti = (fascia1 * aliquotaArtigiani) / 100 + (fascia2 * (aliquotaArtigiani + 1)) / 100
  }
  return applicaRiduzioneIVS(bruti, 0, '35')
}

describe('verifica formula eccedenza vs INPS (caso reale)', () => {
  it('eccedenza 2025 su 34.554 ≈ 2.495,84 (INPS)', () => {
    const ecc = eccedenzaArtigiani(34554, 2025)
    // eslint-disable-next-line no-console
    console.log('Eccedenza 2025 (reddito 34554):', ecc.toFixed(2), '— INPS: 2495.84')
    expect(ecc).toBeCloseTo(2495.84, 0)
  })

  it('eccedenza 2024 su 26.713 e suo 50% vs acconto INPS 636,32', () => {
    // L'acconto INPS si calcola sul reddito dell'anno PRECEDENTE (2024).
    // Ma con quali costanti: 2024 o 2025? Provo entrambe.
    const eccCon2024 = eccedenzaArtigiani(26713, 2024)
    const eccCon2025 = eccedenzaArtigiani(26713, 2025)
    // eslint-disable-next-line no-console
    console.log('Eccedenza su 26713 — costanti 2024:', eccCon2024.toFixed(2),
      '(50% =', (eccCon2024 / 2).toFixed(2), ') · costanti 2025:', eccCon2025.toFixed(2),
      '(50% =', (eccCon2025 / 2).toFixed(2), ') — acconto INPS: 636.32')
    expect(true).toBe(true)
  })

  it('SCARTO: l\'acconto INPS usa le costanti dell\'anno in corso, non dell\'anno prima', () => {
    // INPS acconto 2025 = 636,32 = 50% di [eccedenza su reddito 2024 con costanti 2025].
    // La mia app calcola l'eccedenza 2024 con le costanti 2024 → base diversa.
    const baseInps = eccedenzaArtigiani(26713, 2025) / 2     // costanti 2025
    const baseApp = eccedenzaArtigiani(26713, 2024) / 2      // costanti 2024 (come fa l'app)
    // eslint-disable-next-line no-console
    console.log('Acconto 2025 — base INPS (costanti 2025):', baseInps.toFixed(2),
      '· base app (costanti 2024):', baseApp.toFixed(2), '· scarto:', (baseApp - baseInps).toFixed(2))
    expect(baseInps).toBeCloseTo(636.32, 1)
    // documenta lo scarto: NON sono uguali
    expect(Math.abs(baseApp - baseInps)).toBeGreaterThan(5)
  })

  it('IPOTESI: l\'acconto usa minimale PIENO (no proporzione mesi)', () => {
    // Reddito 2024 = 26713 su 11 mesi (attività dal 15/2) vs su 12 mesi.
    // minimale pieno → 636,32 ; minimale proporz. 11/12 → di più.
    const minimalePieno = eccedenzaArtigiani(26713, 2025) / 2
    // eslint-disable-next-line no-console
    console.log('Acconto con minimale pieno:', minimalePieno.toFixed(2), '— INPS: 636.32')
    expect(minimalePieno).toBeCloseTo(636.32, 1)
  })

  it('verifica quadratura: 2 acconti + saldo = eccedenza 2025', () => {
    // eslint-disable-next-line no-console
    console.log('Quadratura INPS: 636.32 + 636.32 + 1223.20 =', (636.32 + 636.32 + 1223.20).toFixed(2))
    expect(636.32 + 636.32 + 1223.20).toBeCloseTo(2495.84, 1)
  })
})
