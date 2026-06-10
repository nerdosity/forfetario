import { useState } from 'react'
import { Plus, Trash2, Pencil, CalendarDays, Coins, Percent, Baby } from 'lucide-react'
import {
  DATI_FISCALI,
  anniDisponibili,
  validaAnno,
  datiAnno,
  type DatiAnno,
} from '@/data/taxData'
import {
  salvaAnnoPersonalizzato,
  rimuoviAnnoPersonalizzato,
  anniPersonalizzatiSalvati,
} from '@/data/customYears'
import { Button } from 'flowbite-react'
import { Field, NumberInput, MoneyInput, DateInput, Modal } from '@/components/ui'
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
  saldoImposte: string
  primoAccontoImposte: string
  secondoAccontoImposte: string
  primoAccontoContributi: string
  secondoAccontoContributi: string
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
      saldoImposte: f.saldoImposte,
      primoAccontoImposte: f.primoAccontoImposte,
      secondoAccontoImposte: f.secondoAccontoImposte,
      primoAccontoContributi: f.primoAccontoContributi,
      secondoAccontoContributi: f.secondoAccontoContributi,
    },
  }
}

function datiAnnoToForm(anno: number, d: DatiAnno): FormAnno {
  return {
    anno,
    minimaleReddito: d.minimaleReddito,
    sogliaPrimaFascia: d.sogliaPrimaFascia,
    aliquotaSeparata: d.aliquotaSeparata,
    aliquotaArtigiani: d.aliquotaArtigiani,
    aliquotaCommercianti: d.aliquotaCommercianti,
    ivsArtigiani: d.contributoFisso.artigiani.ivsAnnuale,
    maternitaArtigiani: d.contributoFisso.artigiani.maternitaMensile,
    ivsCommercianti: d.contributoFisso.commercianti.ivsAnnuale,
    maternitaCommercianti: d.contributoFisso.commercianti.maternitaMensile,
    rateContributiFissi: [...d.scadenze.rateContributiFissi] as [string, string, string, string],
    saldoImposte: d.scadenze.saldoImposte,
    primoAccontoImposte: d.scadenze.primoAccontoImposte,
    secondoAccontoImposte: d.scadenze.secondoAccontoImposte,
    primoAccontoContributi: d.scadenze.primoAccontoContributi,
    secondoAccontoContributi: d.scadenze.secondoAccontoContributi,
  }
}

/** Form pre-compilato dall'anno più recente disponibile, con anno suggerito = max+1. */
function templateNuovoAnno(): FormAnno {
  const recente = anniDisponibili()[0]
  const base = datiAnno(recente)
  return { ...datiAnnoToForm(recente, base), anno: recente + 1 }
}

/** Gestione anni personalizzati: lista, aggiunta e modifica tramite modal. */
export function GestoreAnni({ onAnniChanged }: Props) {
  const [aperto, setAperto] = useState(false)
  const [form, setForm] = useState<FormAnno>(templateNuovoAnno)
  const [editing, setEditing] = useState<number | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [salvati, setSalvati] = useState<number[]>(() => anniPersonalizzatiSalvati())

  const builtIn = new Set(Object.keys(DATI_FISCALI).map(Number))

  const setNum = (campo: keyof FormAnno) => (v: number | null) =>
    setForm((prev) => ({ ...prev, [campo]: v ?? 0 }))

  const setRata = (i: number) => (mmgg: string) =>
    setForm((prev) => {
      const rate = [...prev.rateContributiFissi] as [string, string, string, string]
      rate[i] = mmgg
      return { ...prev, rateContributiFissi: rate }
    })

  const apriNuovo = () => {
    setForm(templateNuovoAnno())
    setEditing(null)
    setErrore(null)
    setAperto(true)
  }

  const apriModifica = (anno: number) => {
    setForm(datiAnnoToForm(anno, datiAnno(anno)))
    setEditing(anno)
    setErrore(null)
    setAperto(true)
  }

  const salva = () => {
    setErrore(null)
    try {
      const validated = validaAnno(String(form.anno), formToDatiAnno(form))
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

  const personalizzato = new Set(salvati)

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {/* Tutti gli anni disponibili: ognuno modificabile; cestino solo sui custom */}
        {anniDisponibili().map((a) => {
          const isCustom = personalizzato.has(a)
          return (
            <span
              key={a}
              className={`group inline-flex items-center gap-1.5 rounded-full border py-1 pl-3 pr-1.5 text-xs font-medium ${
                isCustom
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
              title={isCustom ? `Anno personalizzato ${a}` : `Anno predefinito ${a}`}
            >
              {a}
              <span className="inline-flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => apriModifica(a)}
                  className="rounded-full p-0.5 text-slate-400 transition-colors hover:bg-blue-100 hover:text-blue-600"
                  title={`Modifica anno ${a}`}
                >
                  <Pencil size={12} />
                </button>
                {isCustom && (
                  <button
                    type="button"
                    onClick={() => rimuovi(a)}
                    className="rounded-full p-0.5 text-amber-500 transition-colors hover:bg-red-100 hover:text-red-600"
                    title={`Rimuovi anno personalizzato ${a}`}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </span>
            </span>
          )
        })}

        <Button color="light" size="xs" onClick={apriNuovo}>
          <Plus size={13} className="mr-1" />
          Nuovo anno
        </Button>
      </div>

      <Modal
        open={aperto}
        onClose={() => setAperto(false)}
        title={editing !== null ? `Modifica anno ${editing}` : 'Nuovo anno fiscale'}
        subtitle={
          editing !== null
            ? builtIn.has(editing)
              ? 'Stai sovrascrivendo i valori di un anno predefinito con una versione personalizzata.'
              : 'Aggiorna le costanti INPS e le scadenze di questo anno.'
            : 'Inserisci le costanti INPS e le scadenze. I valori sono pre-compilati dall’anno più recente.'
        }
        footer={
          <>
            <Button color="light" onClick={() => setAperto(false)}>
              Annulla
            </Button>
            <Button color="blue" onClick={salva}>
              {editing !== null ? 'Salva modifiche' : 'Crea anno'}
            </Button>
          </>
        }
      >
        {/* Anno */}
        <div className="max-w-[10rem]">
          <Field label="Anno">
            <NumberInput
              value={form.anno}
              onChange={(v) => setForm((prev) => ({ ...prev, anno: v ?? prev.anno }))}
              min={2020}
              max={2099}
            />
          </Field>
        </div>

        {/* Imponibili e soglie */}
        <section className={theme.formSection}>
          <h3 className={theme.formSectionTitle}>
            <Coins size={16} className="text-emerald-600" aria-hidden />
            Imponibili e soglie
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Minimale reddito" info="Reddito minimale annuo per i contributi fissi proporzionali (circolare IVS INPS).">
              <MoneyInput value={form.minimaleReddito} onChange={setNum('minimaleReddito')} min={0} step={0.01} />
            </Field>
            <Field label="Soglia prima fascia" info="Oltre questa soglia si applica l’aliquota maggiorata (+1%) sull’eccedenza per artigiani e commercianti.">
              <MoneyInput value={form.sogliaPrimaFascia} onChange={setNum('sogliaPrimaFascia')} min={0} step={0.01} />
            </Field>
          </div>
        </section>

        {/* Contributi fissi IVS */}
        <section className={theme.formSection}>
          <h3 className={theme.formSectionTitle}>
            <Coins size={16} className="text-blue-600" aria-hidden />
            Contributi fissi IVS annui
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Artigiani" info="Contributo IVS fisso annuo per artigiani, ripartito nei trimestri di attività.">
              <MoneyInput value={form.ivsArtigiani} onChange={setNum('ivsArtigiani')} min={0} step={0.01} />
            </Field>
            <Field label="Commercianti" info="Contributo IVS fisso annuo per commercianti.">
              <MoneyInput value={form.ivsCommercianti} onChange={setNum('ivsCommercianti')} min={0} step={0.01} />
            </Field>
          </div>
        </section>

        {/* Scadenze */}
        <section className={theme.formSection}>
          <h3 className={theme.formSectionTitle}>
            <CalendarDays size={16} className="text-amber-600" aria-hidden />
            Scadenze
          </h3>
          <div>
            <p className={`${theme.labelSmall} mb-1.5`}>Rate trimestrali contributi fissi</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="1ª rata" small>
                <DateInput value={form.rateContributiFissi[0]} onChange={setRata(0)} anno={form.anno} small />
              </Field>
              <Field label="2ª rata" small>
                <DateInput value={form.rateContributiFissi[1]} onChange={setRata(1)} anno={form.anno} small />
              </Field>
              <Field label="3ª rata" small>
                <DateInput value={form.rateContributiFissi[2]} onChange={setRata(2)} anno={form.anno} small />
              </Field>
              <Field label="4ª rata" small info="Scade a febbraio dell’anno successivo.">
                <DateInput value={form.rateContributiFissi[3]} onChange={setRata(3)} anno={form.anno + 1} small />
              </Field>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Saldo imposte" info="Data del saldo imposte dell'anno precedente.">
              <DateInput
                value={form.saldoImposte}
                onChange={(v) => setForm((prev) => ({ ...prev, saldoImposte: v }))}
                anno={form.anno}
              />
            </Field>
            <Field label="1° acconto imposte" info="Data del primo acconto. Spesso coincide col saldo, ma non sempre.">
              <DateInput
                value={form.primoAccontoImposte}
                onChange={(v) => setForm((prev) => ({ ...prev, primoAccontoImposte: v }))}
                anno={form.anno}
              />
            </Field>
            <Field label="2° acconto imposte" info="Data del secondo acconto imposte.">
              <DateInput
                value={form.secondoAccontoImposte}
                onChange={(v) => setForm((prev) => ({ ...prev, secondoAccontoImposte: v }))}
                anno={form.anno}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="1° acconto contributi INPS" info="Data del primo acconto dei contributi INPS. Può differire da quella delle imposte.">
              <DateInput
                value={form.primoAccontoContributi}
                onChange={(v) => setForm((prev) => ({ ...prev, primoAccontoContributi: v }))}
                anno={form.anno}
              />
            </Field>
            <Field label="2° acconto contributi INPS" info="Data del secondo acconto dei contributi INPS.">
              <DateInput
                value={form.secondoAccontoContributi}
                onChange={(v) => setForm((prev) => ({ ...prev, secondoAccontoContributi: v }))}
                anno={form.anno}
              />
            </Field>
          </div>
        </section>

        {/* Aliquote */}
        <section className={theme.formSection}>
          <h3 className={theme.formSectionTitle}>
            <Percent size={16} className="text-indigo-600" aria-hidden />
            Aliquote contributive
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Gestione separata (%)">
              <NumberInput value={form.aliquotaSeparata} onChange={setNum('aliquotaSeparata')} min={0} max={100} step={0.01} />
            </Field>
            <Field label="Artigiani (%)">
              <NumberInput value={form.aliquotaArtigiani} onChange={setNum('aliquotaArtigiani')} min={0} max={100} step={0.01} />
            </Field>
            <Field label="Commercianti (%)">
              <NumberInput value={form.aliquotaCommercianti} onChange={setNum('aliquotaCommercianti')} min={0} max={100} step={0.01} />
            </Field>
          </div>
        </section>

        {/* Maternità */}
        <section className={theme.formSection}>
          <h3 className={theme.formSectionTitle}>
            <Baby size={16} className="text-rose-500" aria-hidden />
            Quota maternità mensile
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Artigiani (mese)" info="Quota maternità mensile. Non soggetta a riduzione.">
              <MoneyInput value={form.maternitaArtigiani} onChange={setNum('maternitaArtigiani')} min={0} step={0.01} />
            </Field>
            <Field label="Commercianti (mese)" info="Quota maternità mensile. Non soggetta a riduzione.">
              <MoneyInput value={form.maternitaCommercianti} onChange={setNum('maternitaCommercianti')} min={0} step={0.01} />
            </Field>
          </div>
        </section>

        {errore && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errore}</p>
        )}
      </Modal>
    </>
  )
}
