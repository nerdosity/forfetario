import { useState } from 'react'
import { ChevronDown, ChevronUp, Trash2, TriangleAlert } from 'lucide-react'
import { Button, Modal as FbModal, ModalHeader, ModalBody, ModalFooter } from 'flowbite-react'
import { RegimeEditor } from '@/components/RegimeEditor'
import { GestoreAnni } from '@/components/GestoreAnni'
import { Field, MoneyInput, Select } from '@/components/ui'
import { anniDisponibili } from '@/data/taxData'
import type { CalcoloInput, RisultatoCalcolo } from '@/domain/types'
import { formatEuro } from '@/domain/labels'
import { theme } from '@/theme'

type InputState = Omit<CalcoloInput, 'anno'> & { anno: number }

interface InputPanelProps {
  input: InputState
  calcoli: RisultatoCalcolo | null
  onChange: (partial: Partial<InputState>) => void
  onAnniChanged: () => void
  /** Azzera i dati del solo anno di riferimento corrente. */
  onAzzeraAnnoCorrente: () => void
}

/** Pannello laterale di input: anno, contributi, regimi, opzioni avanzate. */
export function InputPanel({ input, calcoli, onChange, onAnniChanged, onAzzeraAnnoCorrente }: InputPanelProps) {
  const [showAvanzate, setShowAvanzate] = useState(false)
  const [confermaAzzera, setConfermaAzzera] = useState(false)

  const azzera = () => {
    onAzzeraAnnoCorrente()
    setConfermaAzzera(false)
  }

  return (
    <div>
      {/* ── Anno di riferimento ── */}
      <div className={theme.sidebarBlock}>
        <Field
          label="Anno di riferimento"
          info="Anno per cui si calcolano imposte e contributi. Determina anche quali costanti INPS vengono usate."
        >
          <Select<number>
            value={input.anno}
            onChange={(v) => onChange({ anno: v })}
            options={anniDisponibili().map((a) => ({ value: a, label: String(a) }))}
          />
        </Field>
        <GestoreAnni onAnniChanged={onAnniChanged} />
      </div>

      {/* ── Regimi anno corrente ── */}
      <div className={theme.sidebarBlock}>
        <RegimeEditor
          titolo={`Regimi anno ${input.anno}`}
          anno={input.anno}
          regimi={input.regimiCorrente}
          onChange={(r) => onChange({ regimiCorrente: r })}
          mostraDate
        />
      </div>

      {/* ── Contributi versati anno corrente ── */}
      <div className={theme.sidebarBlock}>
        <Field
          label={`Contributi INPS versati nel ${input.anno}`}
          info={`Somma di tutti i contributi INPS effettivamente versati durante il ${input.anno}: saldi dell'anno precedente, acconti, rate fisse. Questo importo è deducibile dall'imponibile prima del calcolo dell'imposta sostitutiva ${input.anno}.`}
        >
          <MoneyInput
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

      {/* ── Dati anno precedente ── */}
      <div className={theme.sidebarBlock}>
        <p className={theme.groupLabel}>Dati anno {input.anno - 1}</p>
        <p className={theme.helpText}>Usati per il calcolo degli acconti e per il riepilogo dell'anno precedente.</p>

        <Field
          label={`Contributi INPS versati nel ${input.anno - 1}`}
          info={`Contributi versati durante il ${input.anno - 1}: usati per la deducibilità dell'imposta sostitutiva ${input.anno - 1} mostrata nel riepilogo.`}
        >
          <MoneyInput
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

      {/* ── Acconti versati (avanzate) ── */}
      <div className={theme.sidebarBlock}>
        <button
          type="button"
          onClick={() => setShowAvanzate((v) => !v)}
          className="flex w-full items-center justify-between text-left"
          aria-expanded={showAvanzate}
        >
          <span className={theme.groupLabel}>Acconti già versati</span>
          {showAvanzate
            ? <ChevronUp size={16} className="text-slate-400" />
            : <ChevronDown size={16} className="text-slate-400" />}
        </button>

        {!showAvanzate && (
          <p className={theme.helpText}>
            Opzionale. Apri per inserire gli acconti già pagati e calcolare i saldi netti.
          </p>
        )}

        {showAvanzate && (
          <div className="space-y-5">
            {/* Acconti PER l'anno corrente */}
            <div className="space-y-3">
              <p className={`${theme.helpText} font-medium text-slate-500`}>
                Versati nel {input.anno}, a titolo di acconto per il {input.anno}
              </p>
              <Field
                label="Imposta sostitutiva"
                small
                info={`Acconti versati a giugno e novembre ${input.anno}, calcolati sulle imposte ${input.anno - 1}. Usati per determinare il saldo.`}
              >
                <MoneyInput
                  small
                  value={input.accontiImposteVersatiPerAnnoCorrente}
                  onChange={(v) => onChange({ accontiImposteVersatiPerAnnoCorrente: v })}
                  placeholder="0"
                  min={0}
                  step={0.01}
                  nullable
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Contributi G.S."
                  small
                  info={`Acconti Gestione Separata versati a giugno e novembre ${input.anno}, basati sui contributi G.S. ${input.anno - 1}.`}
                >
                  <MoneyInput
                    small
                    value={input.accontiContributiSeparataVersatiPerAnnoCorrente}
                    onChange={(v) => onChange({ accontiContributiSeparataVersatiPerAnnoCorrente: v })}
                    placeholder="0"
                    min={0}
                    step={0.01}
                    nullable
                  />
                </Field>
                <Field
                  label="Ecc. Art/Comm"
                  small
                  info={`Acconti contributi sull'eccedenza artigiani/commercianti versati a giugno e novembre ${input.anno}.`}
                >
                  <MoneyInput
                    small
                    value={input.accontiContributiEccedenzaArtCommVersatiPerAnnoCorrente}
                    onChange={(v) => onChange({ accontiContributiEccedenzaArtCommVersatiPerAnnoCorrente: v })}
                    placeholder="0"
                    min={0}
                    step={0.01}
                    nullable
                  />
                </Field>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Acconti PER l'anno precedente */}
            <div className="space-y-3">
              <p className={`${theme.helpText} font-medium text-slate-500`}>
                Versati nel {input.anno - 1}, a titolo di acconto per il {input.anno - 1}
              </p>
              <Field
                label="Imposta sostitutiva"
                small
                info={`Acconti versati a giugno e novembre ${input.anno - 1}. Usati per calcolare il saldo dell'anno precedente mostrato nel riepilogo.`}
              >
                <MoneyInput
                  small
                  value={input.accontiImposteVersatiPerAnnoPrecedente}
                  onChange={(v) => onChange({ accontiImposteVersatiPerAnnoPrecedente: v })}
                  placeholder="0 (es: primo anno)"
                  min={0}
                  step={0.01}
                  nullable
                />
              </Field>
            </div>
          </div>
        )}
      </div>

      {/* ── Azzera dati anno corrente ── */}
      <div className={theme.sidebarBlock}>
        <Button color="red" outline size="sm" onClick={() => setConfermaAzzera(true)}>
          <Trash2 size={15} className="mr-2" aria-hidden />
          Azzera dati {input.anno}
        </Button>
        <p className={`${theme.helpText} mt-2`}>
          Cancella regimi, contributi e acconti del {input.anno}. I dati del {input.anno - 1} restano.
        </p>
      </div>

      {/* Modal di conferma azzeramento */}
      <FbModal show={confermaAzzera} size="md" onClose={() => setConfermaAzzera(false)} popup>
        <ModalHeader />
        <ModalBody>
          <div className="text-center">
            <TriangleAlert className="mx-auto mb-4 h-12 w-12 text-red-500" aria-hidden />
            <h3 className="mb-2 text-lg font-semibold text-slate-800">
              Azzerare i dati del {input.anno}?
            </h3>
            <p className="mb-1 text-sm text-slate-500">
              Verranno cancellati regimi, contributi versati e acconti dell'anno {input.anno}.
            </p>
            <p className="text-sm text-slate-500">
              I dati dell'anno {input.anno - 1} non saranno toccati. L'operazione non è reversibile.
            </p>
          </div>
        </ModalBody>
        <ModalFooter className="justify-center">
          <Button color="red" onClick={azzera}>
            Sì, azzera
          </Button>
          <Button color="light" onClick={() => setConfermaAzzera(false)}>
            Annulla
          </Button>
        </ModalFooter>
      </FbModal>
    </div>
  )
}
