import { useRef, useState } from 'react'
import { Trash2, TriangleAlert, CalendarRange, Download, Upload } from 'lucide-react'
import { Button, Modal as FbModal, ModalHeader, ModalBody, ModalFooter } from 'flowbite-react'
import { RegimeEditor } from '@/components/RegimeEditor'
import { GestoreAnni } from '@/components/GestoreAnni'
import { ContributiVersati } from '@/components/ContributiVersati'
import { AnagraficaPanel } from '@/components/AnagraficaPanel'
import { Card, Field, MoneyInput, Select } from '@/components/ui'
import { anniDisponibili } from '@/data/taxData'
import type { CalcoloInput, DatiAnno, OpzioniRateazione, RisultatoCalcolo, Scadenza } from '@/domain/types'
import { datiDellAnno } from '@/domain/types'
import { regimeVuoto } from '@/domain/regimeFactory'
import { chiaveRateazioneImposta, numeroRatePerChiave } from '@/domain/rateazione'
import { esportaInput, importaInput } from '@/data/inputStorage'
import type { AnagraficaContribuente } from '@/data/anagraficaStorage'
import { formatEuro } from '@/domain/labels'
import { theme } from '@/theme'

interface InputPanelProps {
  input: CalcoloInput
  calcoli: RisultatoCalcolo | null
  anagrafica: AnagraficaContribuente
  onChangeAnagrafica: (a: AnagraficaContribuente) => void
  onChange: (partial: Partial<CalcoloInput>) => void
  onAnniChanged: () => void
  /** Azzera i dati del solo anno di riferimento corrente. */
  onAzzeraAnnoCorrente: () => void
}

/**
 * Sezione di un singolo anno solare: regimi + contributi versati + imposte
 * versate durante quell'anno. Tutte e tre le sezioni (anno-1, riferimento,
 * anno+1) usano questo componente, leggendo/scrivendo su input.anni[anno].
 */
function SezioneAnno({
  anno,
  evidenzia,
  sottotitolo,
  dati,
  calcoli,
  scadenzeAnno,
  rateazioniImposta,
  onChange,
}: {
  anno: number
  evidenzia?: boolean
  sottotitolo: string
  dati: DatiAnno
  calcoli: RisultatoCalcolo | null
  /** Scadenze che cadono in quest'anno (calcoli.scadenzeAnnoCorrente/Successivo), per mostrare il dovuto di ogni rata. */
  scadenzeAnno: Scadenza[]
  rateazioniImposta: Record<string, OpzioniRateazione>
  onChange: (d: DatiAnno) => void
}) {
  const set = (patch: Partial<DatiAnno>) => onChange({ ...dati, ...patch })
  const hasGS = dati.regimi.some((r) => r.tipo === 'separata')

  // Numero di rate attive per saldo/1° acconto imposta (1 = nessuna rateazione).
  const nRateSaldo = numeroRatePerChiave(rateazioniImposta, chiaveRateazioneImposta('saldo', anno))
  const nRateAcconto1 = numeroRatePerChiave(rateazioniImposta, chiaveRateazioneImposta('acconto1', anno))

  // Importo dovuto di ogni rata (per chiave), da mostrare accanto al campo:
  // evita di scambiare per errore l'importo di una rata di Saldo con quello
  // della stessa rata di 1° acconto (voci diverse, stesse date/numerazione).
  const dovutoRata = (chiave: string, numeroRata: number): number | undefined =>
    scadenzeAnno.find((s) => s.chiaveRateazione === chiave && s.numeroRata === numeroRata)?.importo

  // Aggiorna l'importo di una rata dell'array corrispondente, creandolo se assente.
  const setRata = (campo: 'impostaSaldoVersatoRate' | 'impostaAcconto1VersatoRate', n: number) =>
    (indice: number, valore: number | null) => {
      const attuale = dati[campo] ?? Array(n).fill(null)
      const rate = [...attuale]
      rate[indice] = valore
      set({ [campo]: rate })
    }

  return (
    <Card
      title={`Anno ${anno}`}
      icon={CalendarRange}
      iconIntent={evidenzia ? 'info' : 'neutral'}
    >
      <p className={`${theme.helpText} -mt-2 mb-4`}>{sottotitolo}</p>

      <RegimeEditor titolo="Regimi" anno={anno} regimi={dati.regimi} onChange={(r) => set({ regimi: r })} />

      <div className="mt-5">
        <p className={`${theme.groupLabel} mb-2`}>Contributi INPS versati nel {anno}</p>
        <ContributiVersati
          anno={anno}
          calcoli={calcoli}
          hasGSCorrente={hasGS}
          modalita={dati.modalitaContributi}
          totale={dati.contributiVersatiTotale}
          dettaglio={dati.contributiVersati}
          rateazioniImposta={rateazioniImposta}
          scadenzeAnno={scadenzeAnno}
          onChangeModalita={(m) => set({ modalitaContributi: m })}
          onChangeTotale={(v) => set({ contributiVersatiTotale: v })}
          onChangeDettaglio={(righe) => set({ contributiVersati: righe })}
        />
      </div>

      <div className="mt-5">
        <p className={`${theme.groupLabel} mb-2`}>Imposta sostitutiva versata nel {anno}</p>
        <div className="space-y-3">
          {nRateSaldo <= 1 ? (
            <Field
              label="Saldo imposta (competenza anno prec.)"
              small
              info={`Saldo dell'imposta sostitutiva ${anno - 1}, versato a giugno ${anno}.`}
            >
              <MoneyInput
                value={dati.impostaSaldoVersato}
                onChange={(v) => set({ impostaSaldoVersato: v })}
                placeholder="0"
                min={0}
                step={0.01}
                nullable
              />
            </Field>
          ) : (
            <div className="space-y-2">
              <p className={theme.labelSmall}>
                Saldo imposta (competenza {anno - 1}) — rateizzato in {nRateSaldo} rate
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Array.from({ length: nRateSaldo }, (_, i) => {
                  const dovuto = dovutoRata(chiaveRateazioneImposta('saldo', anno), i + 1)
                  return (
                    <Field
                      key={i}
                      label={`Rata ${i + 1} di ${nRateSaldo}`}
                      small
                      info={dovuto != null ? `Dovuto per questa rata: ${formatEuro(dovuto)}.` : undefined}
                    >
                      <MoneyInput
                        small
                        value={dati.impostaSaldoVersatoRate?.[i] ?? null}
                        onChange={(v) => setRata('impostaSaldoVersatoRate', nRateSaldo)(i, v)}
                        placeholder={dovuto != null ? `Dovuto: ${formatEuro(dovuto)}` : '0'}
                        min={0}
                        step={0.01}
                        nullable
                      />
                    </Field>
                  )
                })}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {nRateAcconto1 <= 1 ? (
              <Field label="1° acconto" small info={`1° acconto imposta versato a giugno ${anno}.`}>
                <MoneyInput
                  value={dati.impostaAcconto1Versato}
                  onChange={(v) => set({ impostaAcconto1Versato: v })}
                  placeholder="0"
                  min={0}
                  step={0.01}
                  nullable
                />
              </Field>
            ) : (
              <div className="col-span-2 space-y-2">
                <p className={theme.labelSmall}>1° acconto — rateizzato in {nRateAcconto1} rate</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {Array.from({ length: nRateAcconto1 }, (_, i) => {
                    const dovuto = dovutoRata(chiaveRateazioneImposta('acconto1', anno), i + 1)
                    return (
                      <Field
                        key={i}
                        label={`Rata ${i + 1} di ${nRateAcconto1}`}
                        small
                        info={dovuto != null ? `Dovuto per questa rata: ${formatEuro(dovuto)}.` : undefined}
                      >
                        <MoneyInput
                          small
                          value={dati.impostaAcconto1VersatoRate?.[i] ?? null}
                          onChange={(v) => setRata('impostaAcconto1VersatoRate', nRateAcconto1)(i, v)}
                          placeholder={dovuto != null ? `Dovuto: ${formatEuro(dovuto)}` : '0'}
                          min={0}
                          step={0.01}
                          nullable
                        />
                      </Field>
                    )
                  })}
                </div>
              </div>
            )}
            <Field label="2° acconto" small info={`2° acconto imposta versato a novembre ${anno}.`}>
              <MoneyInput
                value={dati.impostaAcconto2Versato}
                onChange={(v) => set({ impostaAcconto2Versato: v })}
                placeholder="0"
                min={0}
                step={0.01}
                nullable
              />
            </Field>
          </div>
        </div>
      </div>
    </Card>
  )
}

/** Tab "Dati": le 3 sezioni per anno (anno-1, riferimento, anno+1). */
export function InputPanel({ input, calcoli, anagrafica, onChangeAnagrafica, onChange, onAnniChanged, onAzzeraAnnoCorrente }: InputPanelProps) {
  const [confermaAzzera, setConfermaAzzera] = useState(false)
  const [esitoImport, setEsitoImport] = useState<{ ok: boolean; msg: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const anno = input.anno

  const azzera = () => {
    onAzzeraAnnoCorrente()
    setConfermaAzzera(false)
  }

  // Esporta i dati come file JSON scaricabile.
  const esporta = () => {
    const blob = new Blob([esportaInput(input)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `forfettario-dati-${anno}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Importa i dati da un file JSON: sostituisce tutto lo stato.
  const importa = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const nuovo = importaInput(String(reader.result), input)
        onChange(nuovo)
        setEsitoImport({ ok: true, msg: 'Dati importati correttamente.' })
      } catch {
        setEsitoImport({ ok: false, msg: 'File non valido: deve essere un JSON esportato da questa app.' })
      }
    }
    reader.readAsText(file)
  }

  // Aggiorna i dati di un anno specifico nella mappa.
  const setAnno = (a: number, dati: DatiAnno) => {
    onChange({ anni: { ...input.anni, [a]: dati } })
  }

  // Dati dei tre anni (con default vuoto se l'anno non è ancora presente).
  const datiPrec = datiDellAnno(input, anno - 1)
  const datiRif = datiDellAnno(input, anno)
  const datiSucc = datiDellAnno(input, anno + 1)
  // Garantisce almeno un regime vuoto da editare per le sezioni mai toccate.
  const conRegime = (d: DatiAnno): DatiAnno => (d.regimi.length ? d : { ...d, regimi: [regimeVuoto()] })

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Anagrafica: dati unici del contribuente, comuni a tutti gli anni */}
      <AnagraficaPanel anagrafica={anagrafica} onChange={onChangeAnagrafica} />

      {/* Barra: anno di riferimento + azzera */}
      <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4">
        <div className="flex flex-wrap items-end gap-3 sm:gap-4">
          <Field
            label="Anno di riferimento"
            info="Anno per cui si calcolano imposte e contributi. Le tre sezioni mostrano l'anno precedente, quello di riferimento e il successivo: i dati di ogni anno si conservano navigando."
          >
            <div className="w-32 sm:w-40">
              <Select<number>
                value={anno}
                onChange={(v) => onChange({ anno: v })}
                options={anniDisponibili().map((a) => ({ value: a, label: String(a) }))}
              />
            </div>
          </Field>
          <div className="pb-0.5">
            <GestoreAnni onAnniChanged={onAnniChanged} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button color="light" size="sm" onClick={esporta} title="Scarica tutti i dati come file JSON">
            <Download size={15} className="mr-2" aria-hidden />
            Esporta
          </Button>
          <Button color="light" size="sm" onClick={() => fileRef.current?.click()} title="Carica i dati da un file JSON">
            <Upload size={15} className="mr-2" aria-hidden />
            Importa
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) importa(f)
              e.target.value = '' // permette di re-importare lo stesso file
            }}
          />
          <Button color="red" outline size="sm" onClick={() => setConfermaAzzera(true)}>
            <Trash2 size={15} className="mr-2" aria-hidden />
            Azzera dati {anno}
          </Button>
        </div>
      </div>

      {esitoImport && (
        <p className={`text-sm ${esitoImport.ok ? 'text-emerald-700' : 'text-red-700'}`}>
          {esitoImport.msg}
        </p>
      )}

      {/* Tre sezioni: anno-1, riferimento, anno+1. A 3 colonne da md (768px):
          con xl (1280) i desktop scendevano a 1 colonna sembrando "mobile". */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
        <SezioneAnno
          anno={anno - 1}
          sottotitolo={`Anno precedente: usato per acconti e saldi del ${anno}.`}
          dati={conRegime(datiPrec)}
          calcoli={null}
          scadenzeAnno={[]}
          rateazioniImposta={input.rateazioniImposta}
          onChange={(d) => setAnno(anno - 1, d)}
        />
        <SezioneAnno
          anno={anno}
          evidenzia
          sottotitolo="Anno di riferimento: la dichiarazione e i contributi che stai calcolando."
          dati={conRegime(datiRif)}
          calcoli={calcoli}
          scadenzeAnno={calcoli?.scadenzeAnnoCorrente ?? []}
          rateazioniImposta={input.rateazioniImposta}
          onChange={(d) => setAnno(anno, d)}
        />
        <SezioneAnno
          anno={anno + 1}
          sottotitolo={`Anno successivo: i pagamenti fatti nel ${anno + 1} (saldo ${anno}, acconti ${anno + 1}, 4ª rata ${anno}).`}
          dati={conRegime(datiSucc)}
          calcoli={calcoli}
          scadenzeAnno={calcoli?.scadenzeAnnoSuccessivo ?? []}
          rateazioniImposta={input.rateazioniImposta}
          onChange={(d) => setAnno(anno + 1, d)}
        />
      </div>

      {/* Modal di conferma azzeramento */}
      <FbModal show={confermaAzzera} size="md" onClose={() => setConfermaAzzera(false)} popup>
        <ModalHeader />
        <ModalBody>
          <div className="text-center">
            <TriangleAlert className="mx-auto mb-4 h-12 w-12 text-red-500" aria-hidden />
            <h3 className="mb-2 text-lg font-semibold text-slate-800">
              Azzerare i dati del {anno}?
            </h3>
            <p className="mb-1 text-sm text-slate-500">
              Verranno cancellati regimi, contributi e imposte versate dell'anno {anno}.
            </p>
            <p className="text-sm text-slate-500">
              I dati degli altri anni non saranno toccati. L'operazione non è reversibile.
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
