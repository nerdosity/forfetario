import { type ChangeEvent, useState } from 'react'
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

  const setNum = (campo: keyof FormAnno) => (v: number | null) =>
    setForm((prev) => ({ ...prev, [campo]: v ?? 0 }))

  const setRata = (i: number) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => {
      const nuove = [...prev.rateContributiFissi] as [string, string, string, string]
      nuove[i] = e.target.value
      return { ...prev, rateContributiFissi: nuove }
    })

  const setData = (campo: 'saldoAccontoImposte' | 'secondoAccontoImposte') =>
    (e: ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [campo]: e.target.value }))

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
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-4">
          <p className={theme.h3}>Configura anno</p>

          {/* Anno */}
          <Field label="Anno">
            <NumberInput
              value={form.anno}
              onChange={(v) => setForm((prev) => ({ ...prev, anno: v ?? new Date().getFullYear() + 1 }))}
              min={2020}
              max={2099}
            />
          </Field>

          {/* Contributi — due colonne */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Contributi INPS</p>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Minimale reddito (€)" small info="Reddito minimale annuo per i contributi fissi proporzionali (circolare IVS INPS).">
                  <NumberInput value={form.minimaleReddito} onChange={setNum('minimaleReddito')} min={0} step={0.01} small />
                </Field>
                <Field label="Soglia prima fascia (€)" small info="Oltre questa soglia si applica l'aliquota maggiorata (+1%) sull'eccedenza.">
                  <NumberInput value={form.sogliaPrimaFascia} onChange={setNum('sogliaPrimaFascia')} min={0} step={0.01} small />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="IVS artigiani annuale (€)" small info="Contributo IVS fisso annuo per artigiani, da ripartire nei trimestri.">
                  <NumberInput value={form.ivsArtigiani} onChange={setNum('ivsArtigiani')} min={0} step={0.01} small />
                </Field>
                <Field label="IVS commercianti annuale (€)" small>
                  <NumberInput value={form.ivsCommercianti} onChange={setNum('ivsCommercianti')} min={0} step={0.01} small />
                </Field>
              </div>
            </div>
          </div>

          {/* Scadenze */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Scadenze <span className="font-normal normal-case">(formato MM-GG)</span>
            </p>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Field label="1ª rata contributi fissi" small info="Solitamente maggio.">
                  <input
                    type="text"
                    className={theme.inputSmall}
                    value={form.rateContributiFissi[0]}
                    onChange={setRata(0)}
                    placeholder="05-16"
                    maxLength={5}
                  />
                </Field>
                <Field label="2ª rata" small info="Solitamente agosto.">
                  <input
                    type="text"
                    className={theme.inputSmall}
                    value={form.rateContributiFissi[1]}
                    onChange={setRata(1)}
                    placeholder="08-20"
                    maxLength={5}
                  />
                </Field>
                <Field label="3ª rata" small info="Solitamente novembre.">
                  <input
                    type="text"
                    className={theme.inputSmall}
                    value={form.rateContributiFissi[2]}
                    onChange={setRata(2)}
                    placeholder="11-18"
                    maxLength={5}
                  />
                </Field>
                <Field label="4ª rata (anno+1)" small info="Scade a febbraio dell'anno successivo.">
                  <input
                    type="text"
                    className={theme.inputSmall}
                    value={form.rateContributiFissi[3]}
                    onChange={setRata(3)}
                    placeholder="02-17"
                    maxLength={5}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Saldo + 1° acconto imposte" small info="Data del saldo imposte anno precedente e primo acconto anno corrente. Solitamente giugno.">
                  <input
                    type="text"
                    className={theme.inputSmall}
                    value={form.saldoAccontoImposte}
                    onChange={setData('saldoAccontoImposte')}
                    placeholder="06-30"
                    maxLength={5}
                  />
                </Field>
                <Field label="2° acconto imposte" small info="Data del secondo acconto. Solitamente novembre.">
                  <input
                    type="text"
                    className={theme.inputSmall}
                    value={form.secondoAccontoImposte}
                    onChange={setData('secondoAccontoImposte')}
                    placeholder="11-30"
                    maxLength={5}
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* Sezione avanzata: aliquote e maternità */}
          <div>
            <button
              type="button"
              onClick={() => setAvanzato((v) => !v)}
              className={`${theme.btnGhost} text-xs`}
              aria-expanded={avanzato}
            >
              {avanzato ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              Aliquote e maternità (raramente cambiano)
            </button>

            {avanzato && (
              <div className="mt-3 space-y-2 border-l-2 border-amber-200 pl-3">
                <p className={theme.helpText}>
                  Pre-compilate con i valori dell'anno precedente. Verificare sul sito INPS prima di confermare.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="G.S. (%)" small>
                    <NumberInput value={form.aliquotaSeparata} onChange={setNum('aliquotaSeparata')} min={0} max={100} step={0.01} small />
                  </Field>
                  <Field label="Artigiani (%)" small>
                    <NumberInput value={form.aliquotaArtigiani} onChange={setNum('aliquotaArtigiani')} min={0} max={100} step={0.01} small />
                  </Field>
                  <Field label="Commercianti (%)" small>
                    <NumberInput value={form.aliquotaCommercianti} onChange={setNum('aliquotaCommercianti')} min={0} max={100} step={0.01} small />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Maternità artigiani/mese (€)" small info="Quota maternità mensile. Non soggetta a riduzione.">
                    <NumberInput value={form.maternitaArtigiani} onChange={setNum('maternitaArtigiani')} min={0} step={0.01} small />
                  </Field>
                  <Field label="Maternità commercianti/mese (€)" small>
                    <NumberInput value={form.maternitaCommercianti} onChange={setNum('maternitaCommercianti')} min={0} step={0.01} small />
                  </Field>
                </div>
              </div>
            )}
          </div>

          {errore && (
            <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{errore}</p>
          )}

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
