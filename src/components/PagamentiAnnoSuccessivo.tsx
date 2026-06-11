import { Plus, Trash2 } from 'lucide-react'
import { Button, Dropdown, DropdownItem } from 'flowbite-react'
import type { TipoVersamento, VersamentoContributo } from '@/domain/types'
import { versamentoVuoto } from '@/domain/regimeFactory'
import { MoneyInput, Select, Tooltip } from '@/components/ui'
import { formatEuro } from '@/domain/labels'
import { theme } from '@/theme'

interface Props {
  /** Anno di riferimento; i pagamenti sono quelli fatti nell'anno + 1. */
  anno: number
  dettaglio: VersamentoContributo[]
  onChange: (righe: VersamentoContributo[]) => void
}

// I pagamenti dell'anno successivo riguardano: saldo (competenza anno rif.),
// acconti dell'anno successivo, rate fisse. Stesso set di tipi.
const TIPI: { value: TipoVersamento; label: string }[] = [
  { value: 'ecc-saldo', label: 'Eccedenza · saldo' },
  { value: 'ecc-acconto-1', label: 'Eccedenza · 1° acconto' },
  { value: 'ecc-acconto-2', label: 'Eccedenza · 2° acconto' },
  { value: 'gs-saldo', label: 'G.S. · saldo' },
  { value: 'gs-acconto-1', label: 'G.S. · 1° acconto' },
  { value: 'gs-acconto-2', label: 'G.S. · 2° acconto' },
  { value: 'fissi-1', label: 'Fissi · 1ª rata' },
  { value: 'fissi-2', label: 'Fissi · 2ª rata' },
  { value: 'fissi-3', label: 'Fissi · 3ª rata' },
  { value: 'fissi-4-prec', label: 'Fissi · 4ª rata (anno rif.)' },
  { value: 'altro', label: 'Altro' },
]

const MENU: { label: string; voci: { tipo: TipoVersamento; label: string }[] }[] = [
  {
    label: 'Artigiani/Commercianti',
    voci: [
      { tipo: 'ecc-saldo', label: 'Eccedenza · saldo' },
      { tipo: 'ecc-acconto-1', label: 'Eccedenza · 1° acconto' },
      { tipo: 'ecc-acconto-2', label: 'Eccedenza · 2° acconto' },
      { tipo: 'fissi-1', label: 'Fissi · 1ª rata' },
      { tipo: 'fissi-2', label: 'Fissi · 2ª rata' },
      { tipo: 'fissi-3', label: 'Fissi · 3ª rata' },
      { tipo: 'fissi-4-prec', label: 'Fissi · 4ª rata (anno rif.)' },
    ],
  },
  {
    label: 'Gestione separata',
    voci: [
      { tipo: 'gs-saldo', label: 'Saldo' },
      { tipo: 'gs-acconto-1', label: '1° acconto' },
      { tipo: 'gs-acconto-2', label: '2° acconto' },
    ],
  },
]

/**
 * Pagamenti di contributi effettuati NELL'ANNO SUCCESSIVO a quello di
 * riferimento (es. anno 2025 → pagamenti nel 2026: saldo eccedenza 2025,
 * acconti 2026, rate fisse). Marcano come pagate le scadenze del calendario
 * dell'anno successivo e permettono di applicare il conguaglio alla prima rata
 * sul reddito ancora aperta.
 */
export function PagamentiAnnoSuccessivo({ anno, dettaglio, onChange }: Props) {
  const annoSucc = anno + 1
  const somma = dettaglio.reduce((s, r) => s + (r.importo ?? 0), 0)

  const giaUsato = (tipo: TipoVersamento, escludiId?: string) =>
    tipo !== 'altro' && dettaglio.some((r) => r.tipo === tipo && r.id !== escludiId)

  const aggiungi = (tipo: TipoVersamento) => {
    if (giaUsato(tipo)) return
    onChange([...dettaglio, versamentoVuoto(tipo)])
  }
  const rimuovi = (id: string) => onChange(dettaglio.filter((r) => r.id !== id))
  const aggiorna = (id: string, patch: Partial<VersamentoContributo>) =>
    onChange(dettaglio.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  return (
    <div className="space-y-4">
      <p className={`${theme.helpText} -mt-2`}>
        Pagamenti di contributi effettuati nel {annoSucc} (saldo {anno}, acconti {annoSucc}, rate fisse).
        Servono a sapere cosa hai già versato e ad applicare il conguaglio alla prima rata aperta.
      </p>

      {dettaglio.length === 0 && (
        <p className={theme.helpText}>Aggiungi i pagamenti effettuati nel {annoSucc}.</p>
      )}

      {dettaglio.map((r) => (
        <div key={r.id} className="flex items-start gap-2">
          <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
            <Select<TipoVersamento>
              small
              value={r.tipo}
              onChange={(v) => {
                if (giaUsato(v, r.id)) return
                aggiorna(r.id, { tipo: v })
              }}
              options={TIPI.filter((t) => !giaUsato(t.value, r.id))}
            />
            <MoneyInput
              small
              value={r.importo}
              onChange={(v) => aggiorna(r.id, { importo: v })}
              placeholder="0"
              min={0}
              step={0.01}
              nullable
            />
            {r.tipo === 'altro' && (
              <input
                type="text"
                value={r.descrizione}
                onChange={(e) => aggiorna(r.id, { descrizione: e.target.value })}
                placeholder="Descrizione (es. ravvedimento, rata pregressa…)"
                className="col-span-2 rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            )}
            <label className="col-span-2 inline-flex items-center gap-1.5 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={r.deducibile !== false}
                onChange={(e) => aggiorna(r.id, { deducibile: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30"
              />
              Deducibile in dichiarazione
              <Tooltip
                content={`Lascia spuntato per i contributi obbligatori (deducibili per cassa nel ${annoSucc}). Togli la spunta per i volontari extra IVS.`}
                label="Quando è deducibile"
                posizione="sotto"
                allinea="sinistra"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => rimuovi(r.id)}
            className={`${theme.btnIconDanger} mt-0.5`}
            aria-label="Rimuovi pagamento"
          >
            <Trash2 size={15} aria-hidden />
          </button>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        {MENU.map((m) => {
          const disponibili = m.voci.filter((v) => !giaUsato(v.tipo))
          if (disponibili.length === 0) return null
          return (
            <Dropdown
              key={m.label}
              size="xs"
              color="light"
              label={
                <span className="inline-flex items-center">
                  <Plus size={13} className="mr-1" /> {m.label}
                </span>
              }
              dismissOnClick
            >
              {disponibili.map((v) => (
                <DropdownItem key={v.tipo} onClick={() => aggiungi(v.tipo)}>
                  {v.label}
                </DropdownItem>
              ))}
            </Dropdown>
          )
        })}
        <Button color="light" size="xs" onClick={() => aggiungi('altro')}>
          <Plus size={13} className="mr-1" />
          Altro
        </Button>
      </div>

      {dettaglio.length > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
          <span className="text-sm font-medium text-slate-600">Totale pagato nel {annoSucc}</span>
          <span className="text-base font-bold tabular-nums text-slate-900">{formatEuro(somma)}</span>
        </div>
      )}
    </div>
  )
}
