/**
 * Tema centralizzato dell'applicazione.
 *
 * Tutte le combinazioni di classi Tailwind riutilizzabili sono definite qui e
 * riciclate nei componenti. Non scrivere classi "sciolte" nei componenti per
 * elementi ricorrenti: aggiungere o modificare il token corrispondente qui.
 */

export const theme = {
  // --- Layout ---
  page: 'max-w-7xl mx-auto p-6',
  grid: 'grid lg:grid-cols-3 gap-6',
  colInput: 'lg:col-span-1',
  colResults: 'lg:col-span-2 space-y-6',
  sidebar: 'bg-slate-50 rounded-xl p-6 sticky top-6 space-y-6 border border-slate-200',

  // --- Card / sezioni ---
  card: 'bg-white rounded-xl border border-slate-200 p-6 shadow-sm',
  cardCompact: 'bg-white rounded-lg border border-slate-200 p-4',
  section: 'rounded-lg border border-slate-200 p-4 space-y-3',

  // --- Tipografia ---
  h1: 'text-3xl font-bold text-slate-900',
  h2: 'text-xl font-semibold text-slate-900',
  h3: 'text-base font-semibold text-slate-800',
  subtitle: 'text-sm text-slate-500',
  label: 'block text-sm font-medium text-slate-700',
  labelSmall: 'block text-xs font-medium text-slate-600',
  helpText: 'text-xs text-slate-500',
  mono: 'font-mono text-xs text-slate-600 whitespace-pre-wrap',

  // --- Controlli form ---
  input:
    'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 ' +
    'shadow-sm transition-colors placeholder:text-slate-400 ' +
    'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30',
  inputSmall:
    'w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 ' +
    'transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30',
  select:
    'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 ' +
    'transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30',
  checkbox: 'h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/40',

  // --- Bottoni ---
  btnIcon: 'inline-flex items-center justify-center rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700',
  btnIconDanger: 'inline-flex items-center justify-center rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600',
  btnGhost: 'inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 transition-colors hover:text-blue-800',
  btnPrimary:
    'inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm ' +
    'font-medium text-white shadow-sm transition-colors hover:bg-blue-700',

  // --- Righe riepilogo ---
  row: 'flex items-center justify-between text-sm',
  rowLabel: 'text-slate-600',
  rowValue: 'font-medium text-slate-900',
  rowTotal: 'flex items-center justify-between border-t border-slate-200 pt-2 text-sm font-semibold',

  // --- Tooltip ---
  tooltipTrigger: 'inline-flex text-slate-400 transition-colors hover:text-slate-600',
  tooltipBubble:
    'pointer-events-none absolute left-1/2 bottom-full z-20 mb-2 w-72 -translate-x-1/2 ' +
    'rounded-md bg-slate-900 px-3 py-2 text-xs font-normal leading-relaxed text-white ' +
    'opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 whitespace-pre-wrap',

  // --- Badge / evidenze numeriche ---
  metricValue: 'text-lg font-bold tabular-nums',
  metricLabel: 'text-xs text-slate-500',
  highlightBox: 'rounded-lg bg-slate-50 p-4 text-center border border-slate-200',
} as const

/**
 * Accenti di colore semantici, riutilizzati per icone, importi e bordi.
 * Mappa un "intent" alle relative classi così i componenti non hardcodano colori.
 */
export const intent = {
  neutral: { text: 'text-slate-700', icon: 'text-slate-500', amount: 'text-slate-900' },
  income: { text: 'text-emerald-700', icon: 'text-emerald-600', amount: 'text-emerald-700' },
  cost: { text: 'text-red-700', icon: 'text-red-600', amount: 'text-red-700' },
  warning: { text: 'text-amber-700', icon: 'text-amber-600', amount: 'text-amber-700' },
  info: { text: 'text-blue-700', icon: 'text-blue-600', amount: 'text-blue-700' },
} as const

export type Intent = keyof typeof intent
