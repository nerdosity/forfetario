import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { RegimeEditor } from '@/components/RegimeEditor'
import { Field, NumberInput, Select } from '@/components/ui'
import { ANNI_DISPONIBILI } from '@/data/taxData'
import type { CalcoloInput, RisultatoCalcolo } from '@/domain/types'
import { formatEuro } from '@/domain/labels'
import { theme } from '@/theme'

type InputState = Omit<CalcoloInput, 'anno'> & { anno: number }

interface InputPanelProps {
  input: InputState
  calcoli: RisultatoCalcolo | null
  onChange: (partial: Partial<InputState>) => void
}

/** Pannello laterale di input: anno, contributi, regimi, opzioni avanzate. */
export function InputPanel({ input, calcoli, onChange }: InputPanelProps) {
  const [showAvanzate, setShowAvanzate] = useState(false)

  return (
    <div className={theme.sidebar}>
      {/* Anno di riferimento */}
      <Field
        label="Anno di riferimento"
        info="Anno per cui si calcolano imposte e contributi. Determina anche quali costanti INPS vengono usate."
      >
        <Select<number>
          value={input.anno}
          onChange={(v) => onChange({ anno: v })}
          options={ANNI_DISPONIBILI.map((a) => ({ value: a, label: String(a) }))}
        />
      </Field>

      {/* Contributi versati anno corrente */}
      <div className={theme.section}>
        <Field
          label={`Contributi INPS versati durante il ${input.anno} (€)`}
          info={`Somma di tutti i contributi INPS effettivamente versati durante il ${input.anno}: saldi dell'anno precedente, acconti, rate fisse. Questo importo è deducibile dall'imponibile prima del calcolo dell'imposta sostitutiva ${input.anno}.`}
        >
          <NumberInput
            value={input.contributiVersatiDuranteAnno}
            onChange={(v) => onChange({ contributiVersatiDuranteAnno: v })}
            placeholder={`Stima: ${formatEuro(calcoli?.totaleContributiINPS ?? 0)}`}
            min={0}
            step={0.01}
            nullable
          />
        </Field>
        {calcoli && (
          <p className={theme.helpText}>
            Valore usato per la deducibilità: {formatEuro(calcoli.contributiVersatiAnnoImpostaPerDeducibilita)}
          </p>
        )}
      </div>

      {/* Dati anno precedente */}
      <div className={theme.section}>
        <h3 className={theme.h3}>Dati anno {input.anno - 1}</h3>
        <p className={theme.helpText}>Usati per il calcolo degli acconti e per il riepilogo dell'anno precedente.</p>

        <Field
          label={`Contributi INPS versati durante il ${input.anno - 1} (€)`}
          info={`Contributi versati durante il ${input.anno - 1}: usati per la deducibilità dell'imposta sostitutiva ${input.anno - 1} mostrata nel riepilogo.`}
        >
          <NumberInput
            value={input.contributiVersatiDuranteAnnoPrecedente}
            onChange={(v) => onChange({ contributiVersatiDuranteAnnoPrecedente: v })}
            placeholder="0"
            min={0}
            step={0.01}
            nullable
          />
        </Field>

        <RegimeEditor
          titolo={`Regimi anno ${input.anno - 1}`}
          anno={input.anno - 1}
          regimi={input.regimiPrecedente}
          onChange={(r) => onChange({ regimiPrecedente: r })}
          mostraDate={false}
        />
      </div>

      {/* Regimi anno corrente */}
      <RegimeEditor
        titolo={`Regimi anno ${input.anno}`}
        anno={input.anno}
        regimi={input.regimiCorrente}
        onChange={(r) => onChange({ regimiCorrente: r })}
        mostraDate
      />

      {/* Opzioni avanzate */}
      <div>
        <button
          type="button"
          onClick={() => setShowAvanzate((v) => !v)}
          className={theme.btnGhost}
          aria-expanded={showAvanzate}
        >
          {showAvanzate ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          Opzioni avanzate (acconti versati)
        </button>

        {showAvanzate && (
          <div className="mt-3 space-y-3">
            <p className={theme.helpText}>
              Acconti versati durante il {input.anno}, basati sui dati {input.anno - 1}:
            </p>

            <Field
              label={`Acconti imposta sostitutiva PER il ${input.anno} (€)`}
              info={`Acconti versati a giugno e novembre ${input.anno}, calcolati sulle imposte ${input.anno - 1}. Usati per determinare il saldo.`}
            >
              <NumberInput
                value={input.accontiImposteVersatiPerAnnoCorrente}
                onChange={(v) => onChange({ accontiImposteVersatiPerAnnoCorrente: v })}
                placeholder="0"
                min={0}
                step={0.01}
                nullable
              />
            </Field>

            <Field
              label={`Acconti contributi G.S. PER il ${input.anno} (€)`}
              info={`Acconti Gestione Separata versati a giugno e novembre ${input.anno}, basati sui contributi G.S. ${input.anno - 1}.`}
            >
              <NumberInput
                value={input.accontiContributiSeparataVersatiPerAnnoCorrente}
                onChange={(v) => onChange({ accontiContributiSeparataVersatiPerAnnoCorrente: v })}
                placeholder="0"
                min={0}
                step={0.01}
                nullable
              />
            </Field>

            <Field
              label={`Acconti contributi eccedenza Art/Comm PER il ${input.anno} (€)`}
              info={`Acconti contributi sull'eccedenza artigiani/commercianti versati a giugno e novembre ${input.anno}.`}
            >
              <NumberInput
                value={input.accontiContributiEccedenzaArtCommVersatiPerAnnoCorrente}
                onChange={(v) => onChange({ accontiContributiEccedenzaArtCommVersatiPerAnnoCorrente: v })}
                placeholder="0"
                min={0}
                step={0.01}
                nullable
              />
            </Field>

            <hr className="border-slate-200" />

            <p className={theme.helpText}>
              Acconti versati durante il {input.anno - 1}, basati sui dati {input.anno - 2}:
            </p>

            <Field
              label={`Acconti imposta sostitutiva PER il ${input.anno - 1} (€)`}
              info={`Acconti versati a giugno e novembre ${input.anno - 1}. Usati per calcolare il saldo dell'anno precedente mostrato nel riepilogo.`}
            >
              <NumberInput
                value={input.accontiImposteVersatiPerAnnoPrecedente}
                onChange={(v) => onChange({ accontiImposteVersatiPerAnnoPrecedente: v })}
                placeholder="0 (es: primo anno)"
                min={0}
                step={0.01}
                nullable
              />
            </Field>
          </div>
        )}
      </div>
    </div>
  )
}
