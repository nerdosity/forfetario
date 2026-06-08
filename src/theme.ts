/**
 * Tema centralizzato dell'applicazione.
 *
 * Raccoglie le combinazioni di classi Tailwind ricorrenti che NON sono già
 * coperte dai componenti Flowbite (shell, KPI, card, righe riepilogo…).
 * Per i controlli (input, select, bottoni, tabelle, modali) si usano
 * direttamente i componenti di flowbite-react.
 */

export const theme = {
  // --- App shell (barra brand piena + nav orizzontale) ---
  appBg: 'min-h-screen bg-slate-50',
  topbar: 'bg-blue-600',
  topbarInner: 'mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4',
  brand: 'flex items-center gap-2.5',
  brandMark: 'inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-white ring-1 ring-white/20',
  brandTitle: 'text-lg font-semibold tracking-tight text-white leading-none',
  topbarYear: 'flex items-center gap-2 text-sm text-white/90',
  navbar: 'sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm',
  navbarInner: 'mx-auto flex max-w-7xl items-center gap-1 px-6',
  navItem:
    'inline-flex items-center gap-2 border-b-2 border-transparent px-4 py-4 text-sm font-medium ' +
    'text-slate-500 transition-colors hover:text-slate-800',
  navItemActive: 'border-blue-600 text-blue-700',
  breadcrumb: 'flex items-center gap-1.5 text-sm text-slate-400',
  breadcrumbCurrent: 'text-slate-700 font-medium',
  shell: 'mx-auto max-w-7xl px-6 py-6 space-y-6',
  pageTitle: 'text-2xl font-semibold tracking-tight text-blue-700',
  // Blocco di sezione nel drawer dei dati: diviso da un bordo, niente scatole annidate.
  sidebarBlock: 'px-5 py-4 border-b border-slate-100 last:border-b-0 space-y-3',

  // --- KPI (tiles piene) ---
  kpiStrip: 'grid grid-cols-2 gap-4 sm:grid-cols-4',
  kpiTile: 'flex flex-col items-center justify-center rounded-xl px-4 py-6 text-center text-white shadow-sm',
  kpiTileValue: 'text-2xl font-bold tabular-nums tracking-tight leading-none',
  kpiTileLabel: 'mt-2 text-sm font-medium text-white/90',
  kpiTileCaption: 'mt-0.5 text-xs text-white/70',

  // --- Card / sezioni ---
  card: 'bg-white rounded-xl border border-slate-200 p-6 shadow-sm',
  // Badge tondo per l'icona nell'intestazione delle card (colore via intent.badge)
  cardIconBadge: 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
  cardCompact: 'bg-white rounded-lg border border-slate-200 p-4',
  // Sezione "piatta": raggruppa contenuti senza bordo/sfondo, per non annidare scatole.
  sectionFlat: 'space-y-3',
  // Mini-card interna senza bordo, solo sfondo tenue: usata per i periodi.
  cardInner: 'bg-slate-50 rounded-lg p-3 space-y-2',
  groupLabel: 'text-xs font-semibold text-slate-500 uppercase tracking-wide',

  // --- Tipografia ---
  h2: 'text-xl font-semibold text-slate-900',
  h3: 'text-base font-semibold text-slate-800',
  labelSmall: 'block text-xs font-medium text-slate-600',
  helpText: 'text-xs text-slate-500',

  // --- Bottoni icona (azioni inline nei card) ---
  btnIcon: 'inline-flex items-center justify-center rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700',
  btnIconDanger: 'inline-flex items-center justify-center rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600',

  // --- Sezione di form con intestazione (dentro il modal anno) ---
  formSection: 'space-y-3',
  formSectionTitle: 'flex items-center gap-2 text-sm font-semibold text-slate-800',

  // --- Righe riepilogo ---
  row: 'flex items-center justify-between text-sm',
  rowLabel: 'text-slate-600',
  rowValue: 'font-medium text-slate-900',
  rowTotal: 'flex items-center justify-between border-t border-slate-200 pt-2 text-sm font-semibold',

  // --- Evidenze numeriche ---
  metricValue: 'text-lg font-bold tabular-nums',
  metricLabel: 'text-xs text-slate-500',
  highlightBox: 'rounded-lg bg-slate-50 p-4 text-center border border-slate-200',
} as const

/**
 * Accenti di colore semantici, riutilizzati per icone, importi e bordi.
 * Mappa un "intent" alle relative classi così i componenti non hardcodano colori.
 */
export const intent = {
  neutral: { text: 'text-slate-700', icon: 'text-slate-500', amount: 'text-slate-900', badge: 'bg-slate-100 text-slate-600' },
  income: { text: 'text-emerald-700', icon: 'text-emerald-600', amount: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
  cost: { text: 'text-red-700', icon: 'text-red-600', amount: 'text-red-700', badge: 'bg-red-100 text-red-700' },
  warning: { text: 'text-amber-700', icon: 'text-amber-600', amount: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  info: { text: 'text-blue-700', icon: 'text-blue-600', amount: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
} as const

export type Intent = keyof typeof intent

/**
 * Superfici colorate (sfondo + bordo + testo) per blocchi evidenziati,
 * es. la metrica chiave. Tonalità tenui coerenti con gli accenti `intent`.
 */
export const intentSurface = {
  neutral: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-900', label: 'text-slate-500' },
  income: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', label: 'text-emerald-600' },
  cost: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', label: 'text-red-600' },
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', label: 'text-amber-600' },
  info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', label: 'text-blue-600' },
} as const
