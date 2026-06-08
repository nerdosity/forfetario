/**
 * Tema centralizzato dell'applicazione.
 *
 * Tutte le combinazioni di classi Tailwind riutilizzabili sono definite qui e
 * riciclate nei componenti. Non scrivere classi "sciolte" nei componenti per
 * elementi ricorrenti: aggiungere o modificare il token corrispondente qui.
 */

export const theme = {
  // --- App shell ---
  appBg: 'min-h-screen bg-slate-100',
  topbar: 'sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur',
  topbarInner: 'mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3',
  brand: 'flex items-center gap-2.5',
  brandMark: 'inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-sm',
  brandTitle: 'text-base font-semibold tracking-tight text-slate-900 leading-none',
  brandTag: 'text-xs text-slate-400 leading-none mt-0.5',
  shell: 'mx-auto max-w-7xl px-6 py-6 space-y-6',

  // --- KPI (tiles piene in stile Fiscozen) ---
  kpiStrip: 'grid grid-cols-2 gap-4 sm:grid-cols-4',
  kpiTile: 'flex flex-col items-center justify-center rounded-xl px-4 py-6 text-center text-white shadow-sm',
  kpiTileValue: 'text-2xl font-bold tabular-nums tracking-tight leading-none',
  kpiTileLabel: 'mt-2 text-sm font-medium text-white/90',
  kpiTileCaption: 'mt-0.5 text-xs text-white/70',

  // --- Tabella adempimenti / scadenze ---
  table: 'w-full text-sm',
  tableHead: 'border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-400',
  tableHeadCell: 'px-4 py-3',
  tableRow: 'border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60',
  tableCell: 'px-4 py-3.5',
  statusBadge: 'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',

  // --- Tabs ---
  tabBar: 'flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm',
  tab: 'inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800',
  tabActive: 'bg-blue-50 text-blue-700',

  // --- Drawer ---
  drawerOverlay: 'fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity',
  drawerPanel:
    'fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl ' +
    'ring-1 ring-slate-900/5',
  drawerHeader: 'flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4',
  drawerBody: 'flex-1 overflow-y-auto',
  drawerFooter: 'flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-5 py-3',

  // --- Layout (legacy grid, ancora usato altrove) ---
  page: 'max-w-7xl mx-auto p-6',
  grid: 'grid lg:grid-cols-3 gap-6',
  colInput: 'lg:col-span-1',
  colResults: 'lg:col-span-2 space-y-6',
  // Sidebar: contenitore esterno, le sezioni interne sono separate da divisori
  // (sidebarBlock) anziché da scatole annidate, per evitare padding-dentro-padding.
  sidebar: 'bg-white rounded-xl border border-slate-200 shadow-sm sticky top-6 overflow-hidden',
  sidebarBlock: 'px-5 py-4 border-b border-slate-100 last:border-b-0 space-y-3',

  // --- Card / sezioni ---
  card: 'bg-white rounded-xl border border-slate-200 p-6 shadow-sm',
  // Badge tondo per l'icona nell'intestazione delle card (colore via intent.badge)
  cardIconBadge: 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
  cardCompact: 'bg-white rounded-lg border border-slate-200 p-4',
  // Sezione "piatta": raggruppa contenuti senza bordo/sfondo, per non annidare scatole.
  section: 'rounded-lg border border-slate-200 p-4 space-y-3',
  sectionFlat: 'space-y-3',
  // Mini-card interna senza bordo, solo sfondo tenue: usata per i periodi.
  cardInner: 'bg-slate-50 rounded-lg p-3 space-y-2',
  // Etichetta di gruppo (intestazione di una sezione nella sidebar)
  groupLabel: 'text-xs font-semibold text-slate-500 uppercase tracking-wide',

  // --- Intestazione pagina ---
  hero: 'rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 px-8 py-10 mb-8 text-white shadow-lg',
  heroIcon: 'inline-flex items-center justify-center rounded-xl bg-white/15 p-3 ring-1 ring-white/25 backdrop-blur',
  heroTitle: 'text-3xl font-bold tracking-tight',
  heroSubtitle: 'text-sm text-blue-100',

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
  btnSecondary:
    'inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white ' +
    'px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50',
  // Sezione di form con intestazione: usata dentro il modal per raggruppare campi
  formSection: 'space-y-3',
  formSectionTitle: 'flex items-center gap-2 text-sm font-semibold text-slate-800',

  // --- Righe riepilogo ---
  row: 'flex items-center justify-between text-sm',
  rowLabel: 'text-slate-600',
  rowValue: 'font-medium text-slate-900',
  rowTotal: 'flex items-center justify-between border-t border-slate-200 pt-2 text-sm font-semibold',

  // --- Modal ---
  modalOverlay:
    'fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 ' +
    'p-4 backdrop-blur-sm sm:items-center',
  modalDialog:
    'relative my-8 w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5',
  modalHeader: 'flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4',
  modalBody: 'max-h-[70vh] overflow-y-auto px-6 py-5 space-y-6',
  modalFooter:
    'flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 rounded-b-2xl',

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
