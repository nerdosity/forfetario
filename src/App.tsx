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
import { InputPanel } from '@/components/InputPanel'
import { KpiStrip } from '@/components/KpiStrip'
import { RiepilogoPrecedente } from '@/components/RiepilogoPrecedente'
import { DettaglioRegimi } from '@/components/DettaglioRegimi'
import { CalendarioFiscale } from '@/components/CalendarioFiscale'
import { SaldiCrediti } from '@/components/SaldiCrediti'
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
    modalitaContributiVersati: 'totale',
    contributiVersatiDettaglio: [],
    contributiVersatiDuranteAnnoPrecedente: null,
    impostaSaldoVersatoAnnoCorrente: null,
    impostaAcconto1VersatoAnnoCorrente: null,
    impostaAcconto2VersatoAnnoCorrente: null,
    accontiImposteVersatiPerAnnoPrecedente: null,
  }
}

// Stato iniziale: riprende l'input salvato in localStorage, altrimenti il default
function inputIniziale(): CalcoloInput {
  const def = inputDefault()
  return caricaInput(def) ?? def
}

type TabId = 'dati' | 'riepilogo' | 'regimi' | 'calendario' | 'saldi' | 'precedente'

const NAV: { id: TabId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'riepilogo', label: 'Riepilogo', icon: LayoutDashboard },
  { id: 'regimi', label: 'Dettaglio regimi', icon: BarChart3 },
  { id: 'calendario', label: 'Calendario', icon: Calendar },
  { id: 'saldi', label: 'Saldi e crediti', icon: FileText },
  { id: 'precedente', label: 'Anno precedente', icon: History },
  // "Dati" resta in fondo: viene spinto all'estrema destra della navbar
  { id: 'dati', label: 'Dati', icon: SlidersHorizontal },
]

const TITOLO: Record<TabId, string> = {
  dati: 'Dati di calcolo',
  riepilogo: 'Riepilogo',
  regimi: 'Dettaglio regimi',
  calendario: 'Calendario fiscale',
  saldi: 'Saldi e crediti',
  precedente: 'Riepilogo anno precedente',
}

export default function App() {
  const [input, setInput] = useInputState(inputIniziale)
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0)
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
  // Con un solo periodo, "Dettaglio regimi" coincide con "Riepilogo": è ridondante.
  const hasPiuRegimi = input.regimiCorrente.length > 1

  const tabDisabilitato = (id: TabId): boolean =>
    (id === 'precedente' && !hasDatiPrecedente) || (id === 'regimi' && !hasPiuRegimi)

  // Se il tab attivo viene disabilitato (dati rimossi o periodo eliminato), torna al riepilogo
  useEffect(() => {
    if (tabDisabilitato(tab)) setTab('riepilogo')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, hasDatiPrecedente, hasPiuRegimi])

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
            <span className="hidden sm:inline">Anno</span>
            <span className="rounded-md bg-white/15 px-2.5 py-1 font-semibold tabular-nums">
              {input.anno}
            </span>
          </div>
        </div>
      </div>

      {/* ── Navigazione orizzontale ── */}
      <nav className={theme.navbar}>
        <div className={theme.navbarInner}>
          {NAV.map(({ id, label, icon: Icon }) => {
            const disabled = tabDisabilitato(id)
            const motivo =
              id === 'precedente'
                ? `Inserisci i dati del ${input.anno - 1} per abilitare questa sezione`
                : 'Disponibile con più di un periodo nello stesso anno'
            return (
              <button
                key={id}
                type="button"
                onClick={() => !disabled && setTab(id)}
                disabled={disabled}
                title={disabled ? motivo : undefined}
                className={`${theme.navItem} ${tab === id ? theme.navItemActive : ''} ${
                  id === 'dati' ? 'ml-auto' : ''
                } ${disabled ? 'cursor-not-allowed opacity-40 hover:text-slate-500' : ''}`}
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
        {/* Intestazione pagina: breadcrumb + titolo */}
        <div>
          <div className={theme.breadcrumb}>
            <span>Forfettario</span>
            <ChevronRight size={14} aria-hidden />
            <span className={theme.breadcrumbCurrent}>{TITOLO[tab]}</span>
          </div>
          <h1 className={`${theme.pageTitle} mt-1`}>{TITOLO[tab]}</h1>
        </div>

        {/* La striscia KPI ha senso solo sulle viste di risultato, non sul form */}
        {tab !== 'dati' && <KpiStrip anno={input.anno} calcoli={calcoli} />}

        {tab === 'dati' && (
          <InputPanel
            input={input}
            calcoli={calcoli}
            onChange={(partial) => setInput((p) => ({ ...p, ...partial }))}
            onAnniChanged={handleAnniChanged}
            onAzzeraAnnoCorrente={handleAzzeraAnnoCorrente}
          />
        )}
        {tab === 'riepilogo' && <DettaglioRegimi anno={input.anno} calcoli={calcoli} />}
        {tab === 'regimi' && <DettaglioRegimi anno={input.anno} calcoli={calcoli} />}
        {tab === 'calendario' && <CalendarioFiscale anno={input.anno} calcoli={calcoli} input={input} />}
        {tab === 'saldi' && <SaldiCrediti anno={input.anno} calcoli={calcoli} />}
        {tab === 'precedente' && hasDatiPrecedente && (
          <RiepilogoPrecedente anno={input.anno} calcoli={calcoli} />
        )}
      </main>
    </div>
  )
}
