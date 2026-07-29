import type { TipoRegime } from '@/domain/types'

export function labelTipo(tipo: TipoRegime): string {
  switch (tipo) {
    case 'separata':
      return 'Gestione Separata'
    case 'artigiani':
      return 'Artigiani'
    case 'commercianti':
      return 'Commercianti'
  }
}

export const formatEuro = (value: number | null | undefined): string =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value ?? 0)

/**
 * Formatta una quota (0-1) come percentuale, un decimale.
 * Es. 0.2378 → "23,8%". I valori non finiti diventano "0%".
 */
export const formatPercent = (quota: number | null | undefined, decimali = 1): string => {
  const q = Number.isFinite(quota ?? NaN) ? (quota as number) : 0
  return new Intl.NumberFormat('it-IT', {
    style: 'percent',
    minimumFractionDigits: decimali,
    maximumFractionDigits: decimali,
  }).format(q)
}
