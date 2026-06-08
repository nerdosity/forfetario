import { useMemo } from 'react'
import { Calculator } from 'lucide-react'
import { InputPanel } from '@/components/InputPanel'
import { RiepilogoPrecedente } from '@/components/RiepilogoPrecedente'
import { DettaglioRegimi } from '@/components/DettaglioRegimi'
import { CalendarioFiscale } from '@/components/CalendarioFiscale'
import { SaldiCrediti } from '@/components/SaldiCrediti'
import { calcola } from '@/domain/calcolo'
import { regimeVuoto } from '@/domain/regimeFactory'
import type { CalcoloInput } from '@/domain/types'
import { ANNI_DISPONIBILI } from '@/data/taxData'
import { theme } from '@/theme'
import { useInputState } from '@/hooks/useInputState'

// Stato iniziale: tutto vuoto, un periodo vuoto per anno
function inputIniziale(): CalcoloInput {
  return {
    anno: ANNI_DISPONIBILI[0],
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

export default function App() {
  const [input, setInput] = useInputState(inputIniziale)

  const calcoli = useMemo(() => calcola(input), [input])

  return (
    <div className={theme.page}>
      {/* Intestazione */}
      <header className="text-center mb-10">
        <Calculator className="mx-auto mb-3 text-blue-600" size={44} aria-hidden />
        <h1 className={theme.h1}>Calcolatore forfettario</h1>
        <p className={`${theme.subtitle} mt-2`}>
          Calcoli precisi e calendario fiscale completo · Anno {input.anno}
        </p>
      </header>

      <div className={theme.grid}>
        {/* Pannello input */}
        <div className={theme.colInput}>
          <InputPanel
            input={input}
            calcoli={calcoli}
            onChange={(partial) => setInput((prev) => ({ ...prev, ...partial }))}
          />
        </div>

        {/* Pannello risultati */}
        <div className={theme.colResults}>
          <RiepilogoPrecedente
            anno={input.anno}
            calcoli={calcoli}
            contributiVersatiDuranteAnnoPrecedente={input.contributiVersatiDuranteAnnoPrecedente}
          />
          <DettaglioRegimi anno={input.anno} calcoli={calcoli} />
          <CalendarioFiscale anno={input.anno} calcoli={calcoli} />
          <SaldiCrediti anno={input.anno} calcoli={calcoli} />
        </div>
      </div>
    </div>
  )
}
