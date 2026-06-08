import { useCallback, useMemo, useReducer, useState } from 'react'
import { Calculator, SlidersHorizontal, LayoutDashboard, BarChart3, Calendar, FileText } from 'lucide-react'
import { InputPanel } from '@/components/InputPanel'
import { KpiStrip } from '@/components/KpiStrip'
import { RiepilogoPrecedente } from '@/components/RiepilogoPrecedente'
import { DettaglioRegimi } from '@/components/DettaglioRegimi'
import { CalendarioFiscale } from '@/components/CalendarioFiscale'
import { SaldiCrediti } from '@/components/SaldiCrediti'
import { Drawer, Tabs, Select, type TabItem } from '@/components/ui'
import { calcola } from '@/domain/calcolo'
import { regimeVuoto } from '@/domain/regimeFactory'
import type { CalcoloInput } from '@/domain/types'
import { anniDisponibili } from '@/data/taxData'
import { theme } from '@/theme'
import { useInputState } from '@/hooks/useInputState'

// Stato iniziale: tutto vuoto, un periodo vuoto per anno
function inputIniziale(): CalcoloInput {
  return {
    anno: anniDisponibili()[0],
    regimiCorrente: [regimeVuoto()],
    regimiPrecedente: [regimeVuoto()],
    contributiVersatiDuranteAnno: null,
    contributiVersatiDuranteAnnoPrecedente: null,
    accontiImposteVersatiPerAnnoCorrente: null,
    accontiImposteVersatiPerAnnoPrecedente: null,
    accontiContributiSeparataVersatiPerAnnoCorrente: null,
    accontiContributiEccedenzaArtCommVersatiPerAnnoCorrente: null,
  }
}

type TabId = 'riepilogo' | 'regimi' | 'calendario' | 'saldi'

const TABS: TabItem<TabId>[] = [
  { id: 'riepilogo', label: 'Riepilogo', icon: LayoutDashboard },
  { id: 'regimi', label: 'Dettaglio regimi', icon: BarChart3 },
  { id: 'calendario', label: 'Calendario', icon: Calendar },
  { id: 'saldi', label: 'Saldi e crediti', icon: FileText },
]

export default function App() {
  const [input, setInput] = useInputState(inputIniziale)
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [tab, setTab] = useState<TabId>('riepilogo')

  const calcoli = useMemo(() => calcola(input), [input])

  const handleAnniChanged = useCallback(() => {
    setInput((prev) => {
      const anni = anniDisponibili()
      return anni.includes(prev.anno) ? { ...prev } : { ...prev, anno: anni[0] }
    })
    forceUpdate()
  }, [setInput])

  // Mostra il riepilogo dell'anno precedente solo se sono stati inseriti dati
  const prev = calcoli.datiAnnoPrecedente
  const hasDatiPrecedente = prev.totaleFatturato > 0 || prev.totaleImponibileLordo > 0

  return (
    <div className={theme.appBg}>
      {/* ── Top bar ── */}
      <header className={theme.topbar}>
        <div className={theme.topbarInner}>
          <div className={theme.brand}>
            <span className={theme.brandMark}>
              <Calculator size={20} aria-hidden />
            </span>
            <div>
              <p className={theme.brandTitle}>Calcolatore forfettario</p>
              <p className={theme.brandTag}>Imposte e contributi INPS</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <span className="text-sm text-slate-500">Anno</span>
              <Select<number>
                value={input.anno}
                onChange={(v) => setInput((prev) => ({ ...prev, anno: v }))}
                options={anniDisponibili().map((a) => ({ value: a, label: String(a) }))}
              />
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className={theme.btnPrimary}
            >
              <SlidersHorizontal size={16} aria-hidden />
              Dati
            </button>
          </div>
        </div>
      </header>

      {/* ── Contenuto ── */}
      <main className={theme.shell}>
        <KpiStrip anno={input.anno} calcoli={calcoli} />

        <Tabs items={TABS} value={tab} onChange={setTab} />

        {tab === 'riepilogo' && (
          <div className="space-y-6">
            <DettaglioRegimi anno={input.anno} calcoli={calcoli} />
            {hasDatiPrecedente && (
              <RiepilogoPrecedente
                anno={input.anno}
                calcoli={calcoli}
                contributiVersatiDuranteAnnoPrecedente={input.contributiVersatiDuranteAnnoPrecedente}
              />
            )}
          </div>
        )}

        {tab === 'regimi' && <DettaglioRegimi anno={input.anno} calcoli={calcoli} />}
        {tab === 'calendario' && <CalendarioFiscale anno={input.anno} calcoli={calcoli} />}
        {tab === 'saldi' && <SaldiCrediti anno={input.anno} calcoli={calcoli} />}
      </main>

      {/* ── Drawer input dati ── */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Dati di calcolo"
        subtitle={`Anno ${input.anno}`}
      >
        <InputPanel
          input={input}
          calcoli={calcoli}
          onChange={(partial) => setInput((prev) => ({ ...prev, ...partial }))}
          onAnniChanged={handleAnniChanged}
        />
      </Drawer>
    </div>
  )
}
