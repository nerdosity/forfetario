import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import {
  Calculator,
  SlidersHorizontal,
  LayoutDashboard,
  BarChart3,
  Calendar,
  FileText,
  History,
  ChevronRight,
} from 'lucide-react'
import { Button, Drawer, DrawerHeader, DrawerItems } from 'flowbite-react'
import { InputPanel } from '@/components/InputPanel'
import { KpiStrip } from '@/components/KpiStrip'
import { RiepilogoPrecedente } from '@/components/RiepilogoPrecedente'
import { DettaglioRegimi } from '@/components/DettaglioRegimi'
import { CalendarioFiscale } from '@/components/CalendarioFiscale'
import { SaldiCrediti } from '@/components/SaldiCrediti'
import { Select } from '@/components/ui'
import { calcola } from '@/domain/calcolo'
import { regimeVuoto } from '@/domain/regimeFactory'
import type { CalcoloInput } from '@/domain/types'
import { anniDisponibili } from '@/data/taxData'
import { caricaInput, salvaInput } from '@/data/inputStorage'
import { theme } from '@/theme'
import { useInputState } from '@/hooks/useInputState'

// Stato di default: tutto vuoto, un periodo vuoto per anno
function inputDefault(): CalcoloInput {
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

// Stato iniziale: riprende l'input salvato in localStorage, altrimenti il default
function inputIniziale(): CalcoloInput {
  const def = inputDefault()
  return caricaInput(def) ?? def
}

type TabId = 'riepilogo' | 'regimi' | 'calendario' | 'saldi' | 'precedente'

const NAV: { id: TabId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'riepilogo', label: 'Riepilogo', icon: LayoutDashboard },
  { id: 'regimi', label: 'Dettaglio regimi', icon: BarChart3 },
  { id: 'calendario', label: 'Calendario', icon: Calendar },
  { id: 'saldi', label: 'Saldi e crediti', icon: FileText },
  { id: 'precedente', label: 'Anno precedente', icon: History },
]

const TITOLO: Record<TabId, string> = {
  riepilogo: 'Riepilogo',
  regimi: 'Dettaglio regimi',
  calendario: 'Calendario fiscale',
  saldi: 'Saldi e crediti',
  precedente: 'Riepilogo anno precedente',
}

export default function App() {
  const [input, setInput] = useInputState(inputIniziale)
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [tab, setTab] = useState<TabId>('riepilogo')

  const calcoli = useMemo(() => calcola(input), [input])

  // Persisti l'input in localStorage a ogni modifica (debounce per non scrivere ad ogni tasto)
  useEffect(() => {
    const t = setTimeout(() => salvaInput(input), 300)
    return () => clearTimeout(t)
  }, [input])

  const handleAnniChanged = useCallback(() => {
    setInput((prev) => {
      const anni = anniDisponibili()
      return anni.includes(prev.anno) ? { ...prev } : { ...prev, anno: anni[0] }
    })
    forceUpdate()
  }, [setInput])

  // Azzera SOLO i dati dell'anno di riferimento corrente (regimi e contributi/acconti
  // dell'anno corrente). Anno selezionato e dati dell'anno precedente restano intatti.
  const handleAzzeraAnnoCorrente = useCallback(() => {
    setInput((prev) => ({
      ...prev,
      regimiCorrente: [regimeVuoto()],
      contributiVersatiDuranteAnno: null,
      accontiImposteVersatiPerAnnoCorrente: null,
      accontiContributiSeparataVersatiPerAnnoCorrente: null,
      accontiContributiEccedenzaArtCommVersatiPerAnnoCorrente: null,
    }))
  }, [setInput])

  const prev = calcoli.datiAnnoPrecedente
  const hasDatiPrecedente = prev.totaleFatturato > 0 || prev.totaleImponibileLordo > 0

  // Se il tab "anno precedente" è attivo ma i dati vengono rimossi, torna al riepilogo
  useEffect(() => {
    if (tab === 'precedente' && !hasDatiPrecedente) setTab('riepilogo')
  }, [tab, hasDatiPrecedente])

  return (
    <div className={theme.appBg}>
      {/* ── Barra marchio (tinta piena) ── */}
      <div className={theme.topbar}>
        <div className={theme.topbarInner}>
          <div className={theme.brand}>
            <span className={theme.brandMark}>
              <Calculator size={18} aria-hidden />
            </span>
            <span className={theme.brandTitle}>Forfettario</span>
          </div>
          <div className={theme.topbarYear}>
            <span className="hidden sm:inline">Anno di riferimento</span>
            <div className="w-28">
              <Select<number>
                value={input.anno}
                onChange={(v) => setInput((p) => ({ ...p, anno: v }))}
                options={anniDisponibili().map((a) => ({ value: a, label: String(a) }))}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigazione orizzontale ── */}
      <nav className={theme.navbar}>
        <div className={theme.navbarInner}>
          {NAV.map(({ id, label, icon: Icon }) => {
            const disabled = id === 'precedente' && !hasDatiPrecedente
            return (
              <button
                key={id}
                type="button"
                onClick={() => !disabled && setTab(id)}
                disabled={disabled}
                title={disabled ? `Inserisci i dati del ${input.anno - 1} per abilitare questa sezione` : undefined}
                className={`${theme.navItem} ${tab === id ? theme.navItemActive : ''} ${
                  disabled ? 'cursor-not-allowed opacity-40 hover:text-slate-500' : ''
                }`}
                aria-current={tab === id ? 'page' : undefined}
              >
                <Icon size={16} aria-hidden />
                {label}
              </button>
            )
          })}
        </div>
      </nav>

      {/* ── Contenuto ── */}
      <main className={theme.shell}>
        {/* Intestazione pagina: breadcrumb + titolo + azione */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className={theme.breadcrumb}>
              <span>Forfettario</span>
              <ChevronRight size={14} aria-hidden />
              <span className={theme.breadcrumbCurrent}>{TITOLO[tab]}</span>
            </div>
            <h1 className={`${theme.pageTitle} mt-1`}>{TITOLO[tab]}</h1>
          </div>
          <Button color="blue" onClick={() => setDrawerOpen(true)}>
            <SlidersHorizontal size={16} className="mr-2" aria-hidden />
            Modifica dati
          </Button>
        </div>

        <KpiStrip anno={input.anno} calcoli={calcoli} />

        {tab === 'riepilogo' && <DettaglioRegimi anno={input.anno} calcoli={calcoli} />}
        {tab === 'regimi' && <DettaglioRegimi anno={input.anno} calcoli={calcoli} />}
        {tab === 'calendario' && <CalendarioFiscale anno={input.anno} calcoli={calcoli} />}
        {tab === 'saldi' && <SaldiCrediti anno={input.anno} calcoli={calcoli} />}
        {tab === 'precedente' && hasDatiPrecedente && (
          <RiepilogoPrecedente
            anno={input.anno}
            calcoli={calcoli}
            contributiVersatiDuranteAnnoPrecedente={input.contributiVersatiDuranteAnnoPrecedente}
          />
        )}
      </main>

      {/* ── Drawer input dati (componente Flowbite) ── */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} position="right" className="w-full max-w-md">
        <DrawerHeader title="Dati di calcolo" titleIcon={SlidersHorizontal} />
        <DrawerItems>
          <InputPanel
            input={input}
            calcoli={calcoli}
            onChange={(partial) => setInput((p) => ({ ...p, ...partial }))}
            onAnniChanged={handleAnniChanged}
            onAzzeraAnnoCorrente={handleAzzeraAnnoCorrente}
          />
        </DrawerItems>
      </Drawer>
    </div>
  )
}
