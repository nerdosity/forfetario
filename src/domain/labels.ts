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

/**
 * Formatta un importo in euro con la convenzione italiana: "1.234,56 €".
 *
 * `useGrouping` esplicito è necessario, non cosmetico. Il default (`'auto'`)
 * rispetta il `minimumGroupingDigits` del CLDR, che per la locale it-IT vale 2:
 * i numeri a quattro cifre intere (1000-9999) escono SENZA separatore delle
 * migliaia ("5398,02 €") mentre quelli a cinque lo hanno ("34.554,58 €").
 * Nello stesso diagramma o nella stessa tabella la differenza si legge come un
 * bug di formattazione. Forzandolo, il separatore c'è sempre.
 *
 * Si usa la forma booleana e non la stringa `'always'` (equivalente: `true` si
 * risolve in `'always'`) perché la stringa richiede i tipi ES2023, mentre il
 * progetto compila con `lib: ES2022`.
 */
export const formatEuro = (value: number | null | undefined): string =>
  new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    useGrouping: true,
  }).format(value ?? 0)

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
