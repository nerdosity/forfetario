import { useState } from 'react'
import { Trash2, TriangleAlert, CalendarRange, Landmark, History, Wallet, CalendarClock } from 'lucide-react'
import { Button, Modal as FbModal, ModalHeader, ModalBody, ModalFooter } from 'flowbite-react'
import { RegimeEditor } from '@/components/RegimeEditor'
import { GestoreAnni } from '@/components/GestoreAnni'
import { ContributiVersati } from '@/components/ContributiVersati'
import { PagamentiAnnoSuccessivo } from '@/components/PagamentiAnnoSuccessivo'
import { Card, Field, MoneyInput, Select } from '@/components/ui'
import { anniDisponibili } from '@/data/taxData'
import type { CalcoloInput, RisultatoCalcolo } from '@/domain/types'
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

/** Tab "Dati": tutti gli input di calcolo disposti in card su griglia. */
export function InputPanel({ input, calcoli, onChange, onAnniChanged, onAzzeraAnnoCorrente }: InputPanelProps) {
  const [confermaAzzera, setConfermaAzzera] = useState(false)

  const azzera = () => {
    onAzzeraAnnoCorrente()
    setConfermaAzzera(false)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Barra: anno di riferimento + azzera */}
      <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4">
        <div className="flex flex-wrap items-end gap-3 sm:gap-4">
          <Field
            label="Anno di riferimento"
            info="Anno per cui si calcolano imposte e contributi. Determina anche quali costanti INPS vengono usate."
          >
            <div className="w-32 sm:w-40">
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
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
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
            hasGSCorrente={input.regimiCorrente.some((r) => r.tipo === 'separata')}
            modalita={input.modalitaContributiVersati}
            totale={input.contributiVersatiDuranteAnno}
            dettaglio={input.contributiVersatiDettaglio}
            onChangeModalita={(m) => onChange({ modalitaContributiVersati: m })}
            onChangeTotale={(v) => onChange({ contributiVersatiDuranteAnno: v })}
            onChangeDettaglio={(righe) => onChange({ contributiVersatiDettaglio: righe })}
          />
        </Card>

        {/* Pagamenti effettuati nell'anno successivo (saldo anno rif. + acconti anno succ.) */}
        <Card title={`Pagamenti fatti nel ${input.anno + 1}`} icon={CalendarClock} iconIntent="info">
          <PagamentiAnnoSuccessivo
            anno={input.anno}
            dettaglio={input.versamentiAnnoSuccessivo}
            onChange={(righe) => onChange({ versamentiAnnoSuccessivo: righe })}
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

        {/* Imposte versate (acconti imposta sostitutiva) */}
        <Card title="Imposte versate" icon={Wallet} iconIntent="income">
          <p className={`${theme.helpText} -mt-2 mb-4`}>
            Acconti d'imposta sostitutiva già pagati, usati per calcolare i saldi netti.
            I contributi versati vanno nell'apposita sezione qui sopra.
          </p>

          <div className="space-y-5">
            <div className="space-y-3">
              <p className={theme.groupLabel}>Versati nel {input.anno}</p>
              <Field
                label="Saldo imposta (anno prec.)"
                small
                info={`Saldo dell'imposta sostitutiva ${input.anno - 1}, versato a giugno ${input.anno}.`}
              >
                <MoneyInput
                  value={input.impostaSaldoVersatoAnnoCorrente}
                  onChange={(v) => onChange({ impostaSaldoVersatoAnnoCorrente: v })}
                  placeholder="0"
                  min={0}
                  step={0.01}
                  nullable
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="1° acconto"
                  small
                  info={`1° acconto d'imposta sostitutiva, versato a giugno ${input.anno} (sulle imposte ${input.anno - 1}).`}
                >
                  <MoneyInput
                    value={input.impostaAcconto1VersatoAnnoCorrente}
                    onChange={(v) => onChange({ impostaAcconto1VersatoAnnoCorrente: v })}
                    placeholder="0"
                    min={0}
                    step={0.01}
                    nullable
                  />
                </Field>
                <Field
                  label="2° acconto"
                  small
                  info={`2° acconto d'imposta sostitutiva, versato a novembre ${input.anno}.`}
                >
                  <MoneyInput
                    value={input.impostaAcconto2VersatoAnnoCorrente}
                    onChange={(v) => onChange({ impostaAcconto2VersatoAnnoCorrente: v })}
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
                Acconti versati nel {input.anno - 1}, per il {input.anno - 1}
              </p>
              <Field
                label="Imposta sostitutiva"
                small
                info={`Acconti d'imposta sostitutiva versati a giugno e novembre ${input.anno - 1}. Usati per calcolare il saldo dell'anno precedente mostrato nel riepilogo.`}
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
