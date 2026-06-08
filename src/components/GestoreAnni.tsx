import { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { DATI_FISCALI, anniDisponibili, validaAnno, type DatiAnno } from '@/data/taxData'
import { salvaAnnoPersonalizzato, rimuoviAnnoPersonalizzato, anniPersonalizzatiSalvati } from '@/data/customYears'
import { Field, NumberInput } from '@/components/ui'
import { theme } from '@/theme'

interface Props {
  onAnniChanged: () => void
}

interface FormAnno {
  anno: number
  minimaleReddito: number
  sogliaPrimaFascia: number
  aliquotaSeparata: number
  aliquotaArtigiani: number
  aliquotaCommercianti: number
  ivsArtigiani: number
  maternitaArtigiani: number
  ivsCommercianti: number
  maternitaCommercianti: number
  rateContributiFissi: [string, string, string, string]
  saldoAccontoImposte: string
  secondoAccontoImposte: string
}

function formToDatiAnno(f: FormAnno): DatiAnno {
  return {
    minimaleReddito: f.minimaleReddito,
    sogliaPrimaFascia: f.sogliaPrimaFascia,
    aliquotaSeparata: f.aliquotaSeparata,
    aliquotaArtigiani: f.aliquotaArtigiani,
    aliquotaCommercianti: f.aliquotaCommercianti,
    contributoFisso: {
      artigiani: { ivsAnnuale: f.ivsArtigiani, maternitaMensile: f.maternitaArtigiani },
      commercianti: { ivsAnnuale: f.ivsCommercianti, maternitaMensile: f.maternitaCommercianti },
    },
    scadenze: {
      rateContributiFissi: f.rateContributiFissi,
      saldoAccontoImposte: f.saldoAccontoImposte,
      secondoAccontoImposte: f.secondoAccontoImposte,
    },
  }
}

// Template pre-compilato dall'anno built-in più recente
function templateDaAnnoRecente(): FormAnno {
  const anniBuiltIn = Object.keys(DATI_FISCALI).map(Number).sort((a, b) => b - a)
  const base = DATI_FISCALI[anniBuiltIn[0]]
  return {
    anno: anniDisponibili()[0] + 1,
    minimaleReddito: base?.minimaleReddito ?? 18555,
    sogliaPrimaFascia: base?.sogliaPrimaFascia ?? 55448,
    aliquotaSeparata: base?.aliquotaSeparata ?? 26.07,
    aliquotaArtigiani: base?.aliquotaArtigiani ?? 24,
    aliquotaCommercianti: base?.aliquotaCommercianti ?? 24.48,
    ivsArtigiani: base?.contributoFisso.artigiani.ivsAnnuale ?? 4453.2,
    maternitaArtigiani: base?.contributoFisso.artigiani.maternitaMensile ?? 0.62,
    ivsCommercianti: base?.contributoFisso.commercianti.ivsAnnuale ?? 4542.26,
    maternitaCommercianti: base?.contributoFisso.commercianti.maternitaMensile ?? 0.62,
    rateContributiFissi: base?.scadenze.rateContributiFissi ?? ['05-16', '08-20', '11-18', '02-17'],
    saldoAccontoImposte: base?.scadenze.saldoAccontoImposte ?? '06-30',
    secondoAccontoImposte: base?.scadenze.secondoAccontoImposte ?? '11-30',
  }
}

/** Sezione per aggiungere e rimuovere anni personalizzati non presenti nel database built-in. */
export function GestoreAnni({ onAnniChanged }: Props) {
  const [aperto, setAperto] = useState(false)
  const [avanzato, setAvanzato] = useState(false)
  const [form, setForm] = useState<FormAnno>(templateDaAnnoRecente)
  const [errore, setErrore] = useState<string | null>(null)
  const [salvati, setSalvati] = useState<number[]>(() => anniPersonalizzatiSalvati())

  const set =
    (campo: keyof FormAnno) =>
    (v: number | null) =>
      setForm((prev) => ({ ...prev, [campo]: v ?? 0 }))

  const apriForm = () => {
    setForm(templateDaAnnoRecente())
    setErrore(null)
    setAvanzato(false)
    setAperto(true)
  }

  const salva = () => {
    setErrore(null)
    try {
      const datiRaw = formToDatiAnno(form)
      const validated = validaAnno(String(form.anno), datiRaw)
      salvaAnnoPersonalizzato(form.anno, validated)
      setSalvati(anniPersonalizzatiSalvati())
      onAnniChanged()
      setAperto(false)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Errore di validazione')
    }
  }

  const rimuovi = (anno: number) => {
    rimuoviAnnoPersonalizzato(anno)
    setSalvati(anniPersonalizzatiSalvati())
    onAnniChanged()
  }

  return (
    <div className="space-y-2">
      {/* Badge anni personalizzati salvati */}
      {salvati.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {salvati.map((a) => (
            <span
              key={a}
              className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-800"
            >
              {a}
              <button
                type="button"
                onClick={() => rimuovi(a)}
                className="text-amber-500 transition-colors hover:text-red-600"
                title={`Rimuovi anno ${a}`}
              >
                <Trash2 size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Bottone per aprire il form */}
      {!aperto && (
        <button type="button" onClick={apriForm} className={`${theme.btnGhost} text-xs`}>
          <Plus size={13} />
          Aggiungi anno
        </button>
      )}

      {/* Form aggiunta anno */}
      {aperto && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
          <p className={theme.h3}>Configura anno</p>

          <Field label="Anno">
            <NumberInput
              value={form.anno}
              onChange={(v) => setForm((prev) => ({ ...prev, anno: v ?? new Date().getFullYear() + 1 }))}
              min={2020}
              max={2099}
            />
          </Field>

          <Field
            label="Minimale reddito INPS (€)"
            info="Reddito minimale annuo per i contributi fissi proporzionali. Pubblicato da INPS ogni anno (circolare contributi IVS)."
          >
            <NumberInput
              value={form.minimaleReddito}
              onChange={set('minimaleReddito')}
              min={0}
              step={0.01}
            />
          </Field>

          <Field
            label="Soglia prima fascia (€)"
            info="Oltre questa soglia si applica l'aliquota maggiorata (+1%) sull'eccedenza per artigiani e commercianti."
          >
            <NumberInput
              value={form.sogliaPrimaFascia}
              onChange={set('sogliaPrimaFascia')}
              min={0}
              step={0.01}
            />
          </Field>

          <Field
            label="IVS artigiani annuale (€)"
            info="Contributo IVS fisso annuo per artigiani (quota da ripartire nei trimestri di attività)."
          >
            <NumberInput
              value={form.ivsArtigiani}
              onChange={set('ivsArtigiani')}
              min={0}
              step={0.01}
            />
          </Field>

          <Field
            label="IVS commercianti annuale (€)"
            info="Contributo IVS fisso annuo per commercianti."
          >
            <NumberInput
              value={form.ivsCommercianti}
              onChange={set('ivsCommercianti')}
              min={0}
              step={0.01}
            />
          </Field>

          {/* Sezione avanzata */}
          <button
            type="button"
            onClick={() => setAvanzato((v) => !v)}
            className={`${theme.btnGhost} text-xs`}
          >
            {avanzato ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            Parametri avanzati (aliquote e maternità)
          </button>

          {avanzato && (
            <div className="space-y-3 border-l-2 border-amber-200 pl-3">
              <p className={theme.helpText}>
                Le aliquote e la quota maternità cambiano raramente. Sono pre-compilate con i valori dell'anno precedente.
              </p>

              <Field label="Aliquota gestione separata (%)">
                <NumberInput
                  value={form.aliquotaSeparata}
                  onChange={set('aliquotaSeparata')}
                  min={0}
                  max={100}
                  step={0.01}
                />
              </Field>

              <Field label="Aliquota artigiani (%)">
                <NumberInput
                  value={form.aliquotaArtigiani}
                  onChange={set('aliquotaArtigiani')}
                  min={0}
                  max={100}
                  step={0.01}
                />
              </Field>

              <Field label="Aliquota commercianti (%)">
                <NumberInput
                  value={form.aliquotaCommercianti}
                  onChange={set('aliquotaCommercianti')}
                  min={0}
                  max={100}
                  step={0.01}
                />
              </Field>

              <Field
                label="Maternità artigiani mensile (€)"
                info="Quota maternità mensile per artigiani. Non soggetta a riduzione."
              >
                <NumberInput
                  value={form.maternitaArtigiani}
                  onChange={set('maternitaArtigiani')}
                  min={0}
                  step={0.01}
                />
              </Field>

              <Field
                label="Maternità commercianti mensile (€)"
                info="Quota maternità mensile per commercianti. Non soggetta a riduzione."
              >
                <NumberInput
                  value={form.maternitaCommercianti}
                  onChange={set('maternitaCommercianti')}
                  min={0}
                  step={0.01}
                />
              </Field>
            </div>
          )}

          {errore && <p className="text-xs text-red-600">{errore}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={salva} className={theme.btnPrimary}>
              Salva
            </button>
            <button
              type="button"
              onClick={() => { setAperto(false); setErrore(null) }}
              className={theme.btnGhost}
            >
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
