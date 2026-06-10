import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { Badge, Button, Label, Radio, Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from 'flowbite-react'
import type { InizioRateazione, OpzioniRateazione, Scadenza } from '@/domain/types'
import { calcolaPianoRateazione, numeroRateMax, rateazioneNeutra } from '@/domain/rateazione'
import { formattaScadenza } from '@/domain/dates'
import { formatEuro } from '@/domain/labels'
import { Modal, Select, Tooltip } from '@/components/ui'
import { theme } from '@/theme'

/** Voce della scadenza senza l'eventuale suffisso di rata (per titoli e PDF). */
const voceBase = (s: Scadenza): string =>
  (s.voce ?? '').replace(/ · rata \d+ di \d+$/, '').replace(/ · differito al 30 luglio$/, '')

/**
 * Ricava tipo di versamento e anno di competenza dalla chiave di rateazione
 * (es. "saldo-2025", "acconto1-2026"). Null se la chiave non è riconosciuta.
 */
function parseChiave(chiave?: string): { tipo: 'saldo' | 'acconto1'; annoCompetenza: number } | null {
  const m = chiave?.match(/^(saldo|acconto1)-(\d{4})$/)
  return m ? { tipo: m[1] as 'saldo' | 'acconto1', annoCompetenza: Number(m[2]) } : null
}

interface Props {
  /** Scadenza da rateizzare (anche una riga-rata: si risale all'importo originario). */
  scadenza: Scadenza
  /** Scelta attuale per questa scadenza, se già configurata. */
  opzioniAttuali?: OpzioniRateazione
  onClose: () => void
  /** Salva la scelta (null = torna al versamento unico ordinario). */
  onSave: (opzioni: OpzioniRateazione | null) => void
}

const aliquotaTesto = (aliquota: number) =>
  `${(aliquota * 100).toFixed(2).replace('.', ',')}%`

/**
 * Popup di rateazione di un versamento d'imposta: scelta della prima scadenza
 * (giugno ordinaria o luglio con maggiorazione 0,4%) e del numero di rate,
 * con anteprima del piano calcolato secondo le regole del modello Redditi.
 */
export function RateazioneModal({ scadenza, opzioniAttuali, onClose, onSave }: Props) {
  const [inizio, setInizio] = useState<InizioRateazione>(opzioniAttuali?.inizio ?? 'giugno')
  const [numeroRate, setNumeroRate] = useState(opzioniAttuali?.numeroRate ?? 1)

  // Passando a luglio il massimo scende a 6: riallinea la scelta se eccede.
  useEffect(() => {
    setNumeroRate((n) => Math.min(n, numeroRateMax(inizio)))
  }, [inizio])

  const anno = scadenza.annoScadenza
  const importoBase = scadenza.importoRateazioneBase ?? scadenza.importo
  const opzioni: OpzioniRateazione = { inizio, numeroRate }
  const piano = calcolaPianoRateazione(importoBase, opzioni)
  const neutra = rateazioneNeutra(opzioni)
  const datiChiave = parseChiave(scadenza.chiaveRateazione)

  // jsPDF è caricato solo alla prima richiesta (chunk separato).
  const scaricaPdf = async () => {
    if (!datiChiave) return
    const { generaPdfRateazione } = await import('@/pdf/rateazionePdf')
    generaPdfRateazione({
      intestazione: `${scadenza.categoria ?? scadenza.descrizione} · ${voceBase(scadenza)} · ${formatEuro(importoBase)}`,
      tipoVersamento: datiChiave.tipo,
      annoCompetenza: datiChiave.annoCompetenza,
      annoScadenza: anno,
      piano,
    })
  }

  const opzioniRate = Array.from({ length: numeroRateMax(inizio) }, (_, i) => ({
    value: i + 1,
    label: i === 0 ? 'Versamento unico' : `${i + 1} rate`,
  }))

  return (
    <Modal
      open
      onClose={onClose}
      size="4xl"
      title="Rateazione del versamento"
      subtitle={`${scadenza.categoria ?? scadenza.descrizione} · ${voceBase(scadenza)} · ${formatEuro(importoBase)}`}
      footer={
        <>
          <span className="mr-auto flex items-center gap-2">
            {datiChiave && (
              <Button color="light" onClick={scaricaPdf}>
                <Download size={16} className="mr-2" aria-hidden />
                Scarica PDF
              </Button>
            )}
            {opzioniAttuali && (
              <Button color="light" onClick={() => onSave(null)}>
                Rimuovi rateazione
              </Button>
            )}
          </span>
          <Button color="light" onClick={onClose}>
            Annulla
          </Button>
          <Button onClick={() => onSave(neutra ? null : { inizio, numeroRate })}>
            Applica
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset className="space-y-2">
          <legend className={`${theme.labelSmall} mb-2 flex items-center gap-1.5`}>
            Prima scadenza
            <Tooltip
              content="Il versamento può essere differito di 30 giorni rispetto alla scadenza ordinaria applicando la maggiorazione dello 0,4% sull'intero importo."
              label="Informazioni sulla prima scadenza"
              posizione="sotto"
              allinea="sinistra"
            />
          </legend>
          <div className="flex items-center gap-2">
            <Radio
              id="rateazione-giugno"
              name="rateazione-inizio"
              checked={inizio === 'giugno'}
              onChange={() => setInizio('giugno')}
            />
            <Label htmlFor="rateazione-giugno" className="font-normal">
              {formattaScadenza('06-30', anno)} — ordinaria, fino a 7 rate
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Radio
              id="rateazione-luglio"
              name="rateazione-inizio"
              checked={inizio === 'luglio'}
              onChange={() => setInizio('luglio')}
            />
            <Label htmlFor="rateazione-luglio" className="font-normal">
              {formattaScadenza('07-30', anno)} — maggiorazione 0,4%, fino a 6 rate
            </Label>
          </div>
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor="rateazione-numero" className={`${theme.labelSmall} flex items-center gap-1.5`}>
            Numero di rate
            <Tooltip
              content="Le rate successive alla prima scadono il giorno 16 di ciascun mese (il 20 ad agosto) e maturano interessi di rateazione del 4% annuo (0,33% al mese), come nel software ufficiale dell'Agenzia delle Entrate. L'ultima rata cade entro il 16 dicembre."
              label="Informazioni sul numero di rate"
              posizione="sotto"
              allinea="sinistra"
            />
          </Label>
          <Select id="rateazione-numero" value={numeroRate} options={opzioniRate} onChange={setNumeroRate} />
        </div>
      </div>

      <div>
        <p className={`${theme.groupLabel} mb-2`}>Piano dei versamenti</p>
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeadCell>Rata</TableHeadCell>
                <TableHeadCell>Scadenza</TableHeadCell>
                <TableHeadCell className="text-right">Quota</TableHeadCell>
                <TableHeadCell className="text-right">Interessi</TableHeadCell>
                <TableHeadCell className="text-right">Importo</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody className="divide-y">
              {piano.rate.map((rata) => (
                <TableRow key={rata.numero} className="bg-white">
                  <TableCell>{numeroRate === 1 ? 'Unica' : `${rata.numero} di ${numeroRate}`}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formattaScadenza(rata.dataMMGG, anno)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatEuro(rata.quota)}</TableCell>
                  <TableCell className="text-right tabular-nums text-slate-500">
                    {rata.interessi > 0 ? `${formatEuro(rata.interessi)} (${aliquotaTesto(rata.aliquotaInteressi)})` : '—'}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatEuro(rata.importo)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-sm">
          {piano.maggiorazione > 0 && (
            <span className="text-slate-500">
              Maggiorazione 0,4%: <span className="font-medium tabular-nums">{formatEuro(piano.maggiorazione)}</span>
            </span>
          )}
          {piano.totaleInteressi > 0 && (
            <span className="text-slate-500">
              Interessi: <span className="font-medium tabular-nums">{formatEuro(piano.totaleInteressi)}</span>
            </span>
          )}
          <Badge color="info" className="w-fit text-sm">
            Totale {formatEuro(piano.totale)}
          </Badge>
        </div>
        <p className={`${theme.helpText} mt-2`}>
          Date nominali: se festive slittano al primo giorno lavorativo utile. Con più di una rata
          la voce non viene più confrontata con i versamenti inseriti.
        </p>
      </div>
    </Modal>
  )
}
