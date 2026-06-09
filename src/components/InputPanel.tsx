import { useState } from 'react'
import { Trash2, TriangleAlert, CalendarRange, Landmark, History, Wallet } from 'lucide-react'
import { Button, Modal as FbModal, ModalHeader, ModalBody, ModalFooter } from 'flowbite-react'
import { RegimeEditor } from '@/components/RegimeEditor'
import { GestoreAnni } from '@/components/GestoreAnni'
import { ContributiVersati } from '@/components/ContributiVersati'
import { Card, Field, MoneyInput, Select } from '@/components/ui'
import { anniDisponibili } from '@/data/taxData'
import type { CalcoloInput, RisultatoCalcolo, VersamentoContributo } from '@/domain/types'
import { theme } from '@/theme'

type InputState = Omit<CalcoloInput, 'anno'> & { anno: number }

/** Somma degli importi delle righe di dettaglio (null contano come 0). */
const sommaDettaglio = (righe: VersamentoContributo[]): number =>
  righe.reduce((s, r) => s + (r.importo ?? 0), 0)

interface InputPanelProps {
  input: InputState
  calcoli: RisultatoCalcolo | null
  onChange: (partial: Partial<InputState>) => void
  onAnniChanged: () => void
  /** Azzera i dati del solo anno di riferimento corrente. */
  onAzzeraAnnoCorrente: () => void
}

/** Tab "Dati": tutti gli input di calcolo disposti in card su griglia. */
export function InputPanel({ input, calcoli, onChange, onAnniChanged, onAzzeraAnnoCorrente }: InputPanelProps) {
  const [confermaAzzera, setConfermaAzzera] = useState(false)

  const azzera = () => {
    onAzzeraAnnoCorrente()
    setConfermaAzzera(false)
  }

  return (
    <div className="space-y-6">
      {/* Barra: anno di riferimento + azzera */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <Field
            label="Anno di riferimento"
            info="Anno per cui si calcolano imposte e contributi. Determina anche quali costanti INPS vengono usate."
          >
            <div className="w-40">
              <Select<number>
                value={input.anno}
                onChange={(v) => onChange({ anno: v })}
                options={anniDisponibili().map((a) => ({ value: a, label: String(a) }))}
              />
            </div>
          </Field>
          <div className="pb-0.5">
            <GestoreAnni onAnniChanged={onAnniChanged} />
          </div>
        </div>

        <Button color="red" outline size="sm" onClick={() => setConfermaAzzera(true)}>
          <Trash2 size={15} className="mr-2" aria-hidden />
          Azzera dati {input.anno}
        </Button>
      </div>

      {/* Griglia di card */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Regimi anno corrente */}
        <Card title={`Regimi anno ${input.anno}`} icon={CalendarRange} iconIntent="info">
          <RegimeEditor
            titolo=""
            anno={input.anno}
            regimi={input.regimiCorrente}
            onChange={(r) => onChange({ regimiCorrente: r })}
          />
        </Card>

        {/* Contributi versati anno corrente */}
        <Card title={`Contributi versati nel ${input.anno}`} icon={Landmark} iconIntent="warning">
          <ContributiVersati
            anno={input.anno}
            calcoli={calcoli}
            modalita={input.modalitaContributiVersati}
            totale={input.contributiVersatiDuranteAnno}
            dettaglio={input.contributiVersatiDettaglio}
            onChangeModalita={(m) =>
              onChange(
                m === 'dettaglio'
                  ? {
                      modalitaContributiVersati: 'dettaglio',
                      contributiVersatiDuranteAnno: sommaDettaglio(input.contributiVersatiDettaglio),
                    }
                  : { modalitaContributiVersati: 'totale' },
              )
            }
            onChangeTotale={(v) => onChange({ contributiVersatiDuranteAnno: v })}
            onChangeDettaglio={(righe) =>
              onChange({
                contributiVersatiDettaglio: righe,
                contributiVersatiDuranteAnno: sommaDettaglio(righe),
              })
            }
          />
        </Card>

        {/* Dati anno precedente */}
        <Card title={`Dati anno ${input.anno - 1}`} icon={History} iconIntent="neutral">
          <p className={`${theme.helpText} -mt-2 mb-4`}>
            Usati per il calcolo degli acconti e per il riepilogo dell'anno precedente.
          </p>
          <Field
            label="Contributi INPS versati"
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
          <div className="mt-4">
            <RegimeEditor
              titolo={`Regimi anno ${input.anno - 1}`}
              anno={input.anno - 1}
              regimi={input.regimiPrecedente}
              onChange={(r) => onChange({ regimiPrecedente: r })}
            />
          </div>
        </Card>

        {/* Acconti già versati */}
        <Card title="Acconti già versati" icon={Wallet} iconIntent="income">
          <p className={`${theme.helpText} -mt-2 mb-4`}>
            Opzionale. Inserisci gli acconti pagati per calcolare i saldi netti.
          </p>

          <div className="space-y-5">
            <div className="space-y-3">
              <p className={theme.groupLabel}>
                Versati nel {input.anno}, per il {input.anno}
              </p>
              <Field
                label="Imposta sostitutiva"
                small
                info={`Acconti versati a giugno e novembre ${input.anno}, calcolati sulle imposte ${input.anno - 1}. Usati per determinare il saldo.`}
              >
                <MoneyInput
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

            <div className="space-y-3">
              <p className={theme.groupLabel}>
                Versati nel {input.anno - 1}, per il {input.anno - 1}
              </p>
              <Field
                label="Imposta sostitutiva"
                small
                info={`Acconti versati a giugno e novembre ${input.anno - 1}. Usati per calcolare il saldo dell'anno precedente mostrato nel riepilogo.`}
              >
                <MoneyInput
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
        </Card>
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
