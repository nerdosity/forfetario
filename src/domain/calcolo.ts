import type {
  CalcoloInput,
  DettaglioRegime,
  Regime,
  RisultatoAnno,
  RisultatoCalcolo,
} from '@/domain/types'
import { datiDellAnno } from '@/domain/types'
import { aliquotaContributi, datiAnno, datiEnpap, datiSpettacolo } from '@/data/taxData'
import type { DatiEnpap } from '@/data/taxData'
import { giorniPermanenza } from '@/domain/dates'
import { getMesiInPeriodo, applicaRiduzioneIVS, contributiVersatiEffettivi, rateFissePerTrimestre, baseEccedenzaAcconto, accontoVersatoDaLista } from '@/domain/contributi'
import { calcolaScadenze } from '@/domain/scadenze'
import { contributoFissoAnno } from '@/data/taxData'

// ---------------------------------------------------------------------------
// Calcolo di un singolo anno
// ---------------------------------------------------------------------------

interface EnpapAnno {
  imponibileTotale: number
  soggettivo: number
  integrativo: number
  maternita: number
  /** Vero se il soggettivo coincide col minimo (non l'aliquota sul reddito). */
  sulMinimo: boolean
}

/**
 * Contributi ENPAP aggregati su tutti i periodi enpap dell'anno. Minimo
 * (secondo la riduzione del primo periodo) e maternità una sola volta; il
 * massimale cappa l'imponibile complessivo, ripartito proporzionalmente.
 */
function calcolaEnpapAnno(regimiEnpap: Regime[], c: DatiEnpap | undefined): EnpapAnno {
  const zero: EnpapAnno = { imponibileTotale: 0, soggettivo: 0, integrativo: 0, maternita: 0, sulMinimo: false }
  if (regimiEnpap.length === 0 || !c) {
    return { ...zero, imponibileTotale: regimiEnpap.reduce((s, r) => s + (r.fatturato * r.coefficiente) / 100, 0) }
  }
  const imponibili = regimiEnpap.map((r) => (r.fatturato * r.coefficiente) / 100)
  const imponibileTotale = imponibili.reduce((s, x) => s + x, 0)
  const fatturato = regimiEnpap.reduce((s, r) => s + r.fatturato, 0)
  const fattoreMassimale = imponibileTotale > c.massimale ? c.massimale / imponibileTotale : 1
  const percentuale = regimiEnpap.reduce(
    (s, r, i) => s + (imponibili[i] * fattoreMassimale * (r.aliquotaSoggettivoEnpap ?? c.aliquotaSoggettivoMin)) / 100,
    0,
  )
  const minimo = {
    nessuna: c.minimoSoggettivo,
    meta: c.minimoMeta,
    terzo: c.minimoTerzo,
    quinto: c.minimoQuinto,
  }[regimiEnpap[0].riduzioneMinimoEnpap ?? 'nessuna']
  return {
    imponibileTotale,
    soggettivo: Math.max(minimo, percentuale),
    integrativo: fatturato <= c.sogliaMinimoIntegrativo ? c.minimoIntegrativo : (fatturato * c.aliquotaIntegrativo) / 100,
    maternita: c.maternita,
    sulMinimo: minimo >= percentuale,
  }
}

/**
 * Calcola imponibili, contributi e imposte per tutti i regimi di un anno.
 * Il parametro `contributiDeducibili` è la somma dei contributi INPS
 * effettivamente versati DURANTE quell'anno, che si deducono dall'imponibile
 * prima di applicare l'aliquota.
 */
function calcolaDatiAnno(
  regimi: Regime[],
  anno: number,
  contributiDeducibili: number,
): RisultatoAnno {
  let totaleImponibileLordo = 0
  let totaleContributiINPS = 0
  let totaleContributiSeparata = 0
  let totaleContributiFissiArtComm = 0
  let totaleContributiEccedenzaArtComm = 0
  let totaleFatturato = 0

  const dettagliRegimiCalcolati: DettaglioRegime[] = []

  // ENPAP: minimi e maternità sono dovuti UNA volta per anno (anche con più
  // periodi enpap) e per intero, senza proporzione ai giorni (regolamento
  // ENPAP art. 5). Il soggettivo si calcola quindi sull'aggregato dell'anno e
  // poi si ripartisce sui periodi in proporzione all'imponibile.
  const regimiEnpap = regimi.filter((r) => r.tipo === 'enpap')
  const costantiEnpap = regimiEnpap.length > 0 ? datiEnpap(anno) : undefined
  const enpap = calcolaEnpapAnno(regimiEnpap, costantiEnpap)
  let totaleContributiEnpapSoggettivo = 0
  let totaleContributiEnpapIntegrativo = 0
  let totaleContributiEnpapMaternita = 0
  let totaleContributiSpettacoloTrattenute = 0
  const costantiSpettacolo = regimi.some((r) => r.tipo === 'spettacolo') ? datiSpettacolo(anno) : undefined
  // Spettacolo: soglia aggiuntiva e massimale valgono sul fatturato aggregato
  // dell'anno; il risultato è ripartito sui periodi in proporzione al fatturato.
  const fatturatoSpettacolo = regimi.filter((r) => r.tipo === 'spettacolo').reduce((s, r) => s + r.fatturato, 0)

  for (const regime of regimi) {
    const giorniRegime = giorniPermanenza(
      regime.meseInizio, regime.giornoInizio,
      regime.meseFine, regime.giornoFine,
      anno,
    )
    const mesiRegime = getMesiInPeriodo(
      regime.meseInizio, regime.giornoInizio,
      regime.meseFine, regime.giornoFine,
    )
    const imponibileLordoRegime = (regime.fatturato * regime.coefficiente) / 100
    const aliquota = aliquotaContributi(anno, regime.tipo)

    let contributiRegimeINPS = 0
    let contributiFissiRegime = 0
    let contributiEccedenzaRegime = 0
    let dettaglioCalcoloContributi = ''

    if (regime.tipo === 'separata') {
      contributiRegimeINPS = (imponibileLordoRegime * aliquota) / 100
      totaleContributiSeparata += contributiRegimeINPS
      dettaglioCalcoloContributi = `Separata: ${imponibileLordoRegime.toFixed(2)} € × ${aliquota}% = ${contributiRegimeINPS.toFixed(2)} €`
    } else if (regime.tipo === 'enpap') {
      const primo = regime.id === regimiEnpap[0].id
      const quota = enpap.imponibileTotale > 0
        ? imponibileLordoRegime / enpap.imponibileTotale
        : primo ? 1 : 0
      const soggettivo = enpap.soggettivo * quota
      const maternita = primo ? enpap.maternita : 0
      contributiRegimeINPS = soggettivo + maternita
      totaleContributiEnpapSoggettivo += soggettivo
      totaleContributiEnpapMaternita += maternita
      if (primo) totaleContributiEnpapIntegrativo += enpap.integrativo
      dettaglioCalcoloContributi = costantiEnpap
        ? `ENPAP soggettivo (periodo): ${soggettivo.toFixed(2)} € (totale anno ${enpap.soggettivo.toFixed(2)} €, ${enpap.sulMinimo ? 'minimo' : 'aliquota sul reddito'})` +
          (primo
            ? `
Integrativo (rivalsa sul cliente): ${enpap.integrativo.toFixed(2)} €
Maternità: ${enpap.maternita.toFixed(2)} €`
            : '')
        : 'ENPAP: costanti non disponibili per questo anno'
    } else if (regime.tipo === 'spettacolo') {
      // Trattenute alla fattura: dipendono dai compensi, non dal tempo, quindi
      // nessuna proporzione ai giorni. Soglia e massimale si applicano al fatturato aggregato dell'anno.
      if (costantiSpettacolo) {
        const base = Math.min(fatturatoSpettacolo, costantiSpettacolo.massimale)
        const quotaAnno = (base * costantiSpettacolo.quotaLavoratore) / 100
        const aggiuntivaAnno =
          (Math.max(0, base - costantiSpettacolo.sogliaAggiuntiva) * costantiSpettacolo.aliquotaAggiuntiva) / 100
        const quotaPeriodo = fatturatoSpettacolo > 0 ? regime.fatturato / fatturatoSpettacolo : 0
        const quota = quotaAnno * quotaPeriodo
        const aggiuntiva = aggiuntivaAnno * quotaPeriodo
        contributiRegimeINPS = quota + aggiuntiva
        dettaglioCalcoloContributi =
          `FPLS quota lavoratore: ${base.toFixed(2)} € × ${costantiSpettacolo.quotaLavoratore}% = ${quota.toFixed(2)} €` +
          `
Aliquota aggiuntiva ${costantiSpettacolo.aliquotaAggiuntiva}% oltre ${costantiSpettacolo.sogliaAggiuntiva} €: ${aggiuntiva.toFixed(2)} €` +
          `
Trattenute dal committente in fattura: nessun acconto, saldo o scadenza`
      } else {
        dettaglioCalcoloContributi = 'Spettacolo FPLS: costanti non disponibili per questo anno'
      }
      totaleContributiSpettacoloTrattenute += contributiRegimeINPS
    } else {
      // Artigiani / commercianti: contributi fissi (mensili) + eccedenza
      const { minimaleReddito, sogliaPrimaFascia } = datiAnno(anno)
      const { ivsAnnuale, maternitaMensile } = contributoFissoAnno(anno, regime.tipo)

      const ivsMensile = ivsAnnuale / 12
      const ivsMensileRidotto = applicaRiduzioneIVS(ivsMensile, 0, regime.riduzioneContributi)
      const mensileEffettivo = ivsMensileRidotto + maternitaMensile
      contributiFissiRegime = mensileEffettivo * mesiRegime
      totaleContributiFissiArtComm += contributiFissiRegime

      dettaglioCalcoloContributi =
        `Fissi (${mesiRegime} mes${mesiRegime > 1 ? 'i' : 'e'}): ${contributiFissiRegime.toFixed(2)} €` +
        (regime.riduzioneContributi !== 'nessuna'
          ? ` (rid. ${regime.riduzioneContributi}%)`
          : '')

      // Contributi sull'eccedenza (proporzionati ai mesi). INPS calcola sul
      // reddito imponibile arrotondato all'euro (il calcolatore non usa decimali);
      // l'imposta sostitutiva invece resta sul reddito con i decimali.
      const imponibileContributi = Math.round(imponibileLordoRegime)
      const minimaleProporz = (minimaleReddito * mesiRegime) / 12
      if (imponibileContributi > minimaleProporz) {
        const eccedenza = imponibileContributi - minimaleProporz
        const sogliaProporz = (sogliaPrimaFascia * mesiRegime) / 12
        let eccedenzaIVSBruti: number

        if (imponibileContributi <= sogliaProporz) {
          eccedenzaIVSBruti = (eccedenza * aliquota) / 100
          dettaglioCalcoloContributi +=
            `\nEccedenza IVS: (${imponibileContributi.toFixed(2)} - ${minimaleProporz.toFixed(2)}) € × ${aliquota}% = ${eccedenzaIVSBruti.toFixed(2)} €`
        } else {
          const primaFascia = sogliaProporz - minimaleProporz
          const secondaFascia = imponibileContributi - sogliaProporz
          const su1 = (primaFascia * aliquota) / 100
          const su2 = (secondaFascia * (aliquota + 1)) / 100
          eccedenzaIVSBruti = su1 + su2
          dettaglioCalcoloContributi +=
            `\nEcc. IVS 1ª fascia: ${primaFascia.toFixed(2)} € × ${aliquota}% = ${su1.toFixed(2)} €` +
            `\nEcc. IVS 2ª fascia: ${secondaFascia.toFixed(2)} € × ${(aliquota + 1)}% = ${su2.toFixed(2)} €`
        }

        contributiEccedenzaRegime = applicaRiduzioneIVS(eccedenzaIVSBruti, 0, regime.riduzioneContributi)
        if (regime.riduzioneContributi !== 'nessuna') {
          dettaglioCalcoloContributi += ` → rid. ${regime.riduzioneContributi}% = ${contributiEccedenzaRegime.toFixed(2)} €`
        }
        totaleContributiEccedenzaArtComm += contributiEccedenzaRegime
      }

      contributiRegimeINPS = contributiFissiRegime + contributiEccedenzaRegime
    }

    dettagliRegimiCalcolati.push({
      ...regime,
      giorniRegime,
      mesiRegime,
      imponibileLordoRegime,
      contributiRegimeINPS,
      contributiFissiRegime,
      contributiEccedenzaRegime,
      contributiVersatiQuotaParte: 0,
      imponibileNettoRegime: 0,
      imposteRegime: 0,
      aliquotaContributi: aliquota,
      dettaglioCalcoloContributi,
    })

    totaleImponibileLordo += imponibileLordoRegime
    totaleContributiINPS += contributiRegimeINPS
    totaleFatturato += regime.fatturato
  }

  // Imposta sostitutiva: si applica all'imponibile netto (lordo - contributi versati)
  const imponibileNettoTotalePerImposte = Math.max(0, totaleImponibileLordo - contributiDeducibili)
  let totaleImposte = 0

  for (const regime of dettagliRegimiCalcolati) {
    const peso = totaleImponibileLordo > 0 ? regime.imponibileLordoRegime / totaleImponibileLordo : 0
    regime.contributiVersatiQuotaParte = contributiDeducibili * peso
    regime.imponibileNettoRegime = Math.max(0, regime.imponibileLordoRegime - regime.contributiVersatiQuotaParte)
    regime.imposteRegime = (regime.imponibileNettoRegime * regime.aliquota) / 100
    totaleImposte += regime.imposteRegime
  }

  // Rate fisse trimestrali aggregate su tutti i regimi (per i suggerimenti UI)
  const rateFisse: [number, number, number, number] = [0, 0, 0, 0]
  for (const regime of regimi) {
    const rate = rateFissePerTrimestre(regime, anno)
    for (let i = 0; i < 4; i++) rateFisse[i] += rate[i]
  }

  return {
    dettagliRegimiCalcolati,
    totaleImponibileLordo,
    totaleContributiINPS,
    totaleContributiSeparata,
    totaleContributiFissiArtComm,
    totaleContributiEccedenzaArtComm,
    totaleImposte,
    totaleFatturato,
    imponibileNettoTotalePerImposte,
    totaleContributiEnpapSoggettivo,
    totaleContributiEnpapIntegrativo,
    totaleContributiEnpapMaternita,
    totaleContributiSpettacoloTrattenute,
    rateFisse,
  }
}

/** RisultatoAnno tutto a zero: anno assente dal database o senza regimi. */
const annoVuoto = (): RisultatoAnno => ({
  dettagliRegimiCalcolati: [],
  totaleImponibileLordo: 0,
  totaleContributiINPS: 0,
  totaleContributiSeparata: 0,
  totaleContributiFissiArtComm: 0,
  totaleContributiEccedenzaArtComm: 0,
  totaleImposte: 0,
  totaleFatturato: 0,
  imponibileNettoTotalePerImposte: 0,
  totaleContributiEnpapSoggettivo: 0,
  totaleContributiEnpapIntegrativo: 0,
  totaleContributiEnpapMaternita: 0,
  totaleContributiSpettacoloTrattenute: 0,
  rateFisse: [0, 0, 0, 0],
})

/**
 * Come `calcolaDatiAnno`, ma senza lanciare se l'anno non è nel database
 * fiscale (es. anni prima del primo disponibile): in quel caso restituisce
 * tutti zero, così i saldi/acconti che vi si appoggiano valgono zero.
 */
function calcolaDatiAnnoSicuro(
  regimi: Regime[],
  anno: number,
  contributiDeducibili = 0,
): RisultatoAnno {
  try {
    return calcolaDatiAnno(regimi, anno, contributiDeducibili)
  } catch {
    return annoVuoto()
  }
}

// ---------------------------------------------------------------------------
// Motore principale
// ---------------------------------------------------------------------------

/** Calcola tutto: anno corrente + anno precedente + saldi + scadenze. */
export function calcola(input: CalcoloInput): RisultatoCalcolo {
  const { anno } = input
  const datiAnnoRif = datiDellAnno(input, anno)
  const datiAnnoPrec = datiDellAnno(input, anno - 1)
  const regimiCorrente = datiAnnoRif.regimi
  const regimiPrecedente = datiAnnoPrec.regimi

  // Acconti imposta versati PER l'anno di riferimento = i due acconti versati
  // DURANTE l'anno di riferimento (giugno + novembre di quell'anno solare).
  const accontiImposteVersatiPerAnnoCorrente =
    (datiAnnoRif.impostaAcconto1Versato ?? 0) + (datiAnnoRif.impostaAcconto2Versato ?? 0)

  const deducibiliAnnoCorrente = contributiVersatiEffettivi(datiAnnoRif)
  const deducibiliAnnoPrecedente = contributiVersatiEffettivi(datiAnnoPrec)

  const datiCorrente = calcolaDatiAnno(regimiCorrente, anno, deducibiliAnnoCorrente)

  // Anno precedente potrebbe non essere nel database (es. primo anno disponibile).
  // In quel caso si usano zero ovunque: nessun saldo/acconto basato sull'anno prima.
  const datiPrecedente = calcolaDatiAnnoSicuro(regimiPrecedente, anno - 1, deducibiliAnnoPrecedente)

  // ─── Saldi anno corrente ──────────────────────────────────────────────────
  // Gli acconti imposta restano un campo dedicato (l'imposta non è un contributo);
  // gli acconti contributi si ricavano dalle righe della lista versamenti.
  const accontiImposteEff = accontiImposteVersatiPerAnnoCorrente

  const saldoImposteDaVersare = Math.max(0, datiCorrente.totaleImposte - accontiImposteEff)
  const creditoImposte = Math.max(0, accontiImposteEff - datiCorrente.totaleImposte)

  // Il saldo contributi UFFICIALE (come il calcolatore INPS) = eccedenza/G.S.
  // dovuta dell'anno - acconti DOVUTI (non quelli effettivamente versati). Gli
  // acconti dovuti = base acconto sui redditi dell'anno precedente con le costanti
  // dell'anno corrente. Esistono SOLO se la gestione è ancora attiva nell'anno
  // corrente (regime attivo a dicembre): se la gestione è chiusa, niente acconti
  // dovuti (e quindi niente saldo). Quanto versato in più/meno è gestito a parte
  // come conguaglio (mostrato e suggerito), non incide sul saldo ufficiale.
  const gestioneAttiva = (regimi: Regime[], tipo: 'separata' | 'artComm'): boolean =>
    regimi.some((r) =>
      r.meseFine === 12 &&
      (tipo === 'separata' ? r.tipo === 'separata' : r.tipo === 'artigiani' || r.tipo === 'commercianti'),
    )

  const gsAttivaCorrente = gestioneAttiva(regimiCorrente, 'separata')
  const artCommAttivaCorrente = gestioneAttiva(regimiCorrente, 'artComm')
  // Acconti G.S. dovuti = 80% dei contributi G.S. dovuti dell'anno precedente
  // (due rate del 40%), come da software ADE: verificato su dichiarazione reale
  // (dovuto 2022 = 5.220 → acconti 2023 = 2.088,02 × 2 = 80%).
  const accontiGSDovuti = gsAttivaCorrente ? 0.8 * datiPrecedente.totaleContributiSeparata : 0
  const accontiEccDovuti = artCommAttivaCorrente ? baseEccedenzaAcconto(regimiPrecedente, anno) : 0

  const saldoContributiGS = Math.max(0, datiCorrente.totaleContributiSeparata - accontiGSDovuti)
  const saldoContributiEccArtComm = Math.max(0, datiCorrente.totaleContributiEccedenzaArtComm - accontiEccDovuti)

  // ─── Saldi contributi anno PRECEDENTE (si versano nell'anno corrente) ──────
  // Stessa regola del saldo dell'anno corrente, traslata di un anno: dovuto di
  // N-1 meno gli acconti DOVUTI per N-1 (base: redditi di N-2, costanti di N-1,
  // solo se la gestione era ancora attiva a dicembre di N-1). Senza questo
  // netting il calendario e gli F24 mostravano il dovuto PIENO, mentre la
  // sezione dichiarazione scalava già gli acconti: le due viste divergevano.
  const regimiDueAnniPrima = datiDellAnno(input, anno - 2).regimi
  const accontiGSDovutiPerPrecedente = gestioneAttiva(regimiPrecedente, 'separata')
    ? 0.8 * calcolaDatiAnnoSicuro(regimiDueAnniPrima, anno - 2).totaleContributiSeparata
    : 0
  const accontiEccDovutiPerPrecedente = gestioneAttiva(regimiPrecedente, 'artComm')
    ? baseEccedenzaAcconto(regimiDueAnniPrima, anno - 1)
    : 0

  const saldoContributiGSPrecedente = Math.max(
    0,
    datiPrecedente.totaleContributiSeparata - accontiGSDovutiPerPrecedente,
  )
  const saldoContributiEccArtCommPrecedente = Math.max(
    0,
    datiPrecedente.totaleContributiEccedenzaArtComm - accontiEccDovutiPerPrecedente,
  )

  // ─── ENPAP: acconto e saldo ────────────────────────────────────────────────
  // Acconto = percentuale di (soggettivo + integrativo) DOVUTI dell'anno
  // precedente, solo se in N-1 c'era enpap (primo anno: nessun acconto).
  const enpapPrecedente = regimiPrecedente.some((r) => r.tipo === 'enpap')
  const percentualeAccontoEnpap = datiEnpap(anno)?.percentualeAcconto ?? 0
  const accontoEnpapDovuto = enpapPrecedente
    ? (percentualeAccontoEnpap / 100) *
      (datiPrecedente.totaleContributiEnpapSoggettivo + datiPrecedente.totaleContributiEnpapIntegrativo)
    : 0
  // Maternità esclusa dal saldo: si versa per intero a marzo insieme all'acconto.
  const saldoEnpap = Math.max(
    0,
    datiCorrente.totaleContributiEnpapSoggettivo +
      datiCorrente.totaleContributiEnpapIntegrativo -
      accontoEnpapDovuto,
  )
  // Competenza N-1 (versata in N): stessa regola, acconto sulla base di N-2.
  const enpapDueAnniPrima = regimiDueAnniPrima.some((r) => r.tipo === 'enpap')
  let percentualeAccontoEnpapPrec = 0
  try {
    percentualeAccontoEnpapPrec = datiEnpap(anno - 1)?.percentualeAcconto ?? 0
  } catch {
    percentualeAccontoEnpapPrec = 0
  }
  const datiDueAnniPrima = calcolaDatiAnnoSicuro(regimiDueAnniPrima, anno - 2)
  const accontoEnpapPrec = enpapDueAnniPrima
    ? (percentualeAccontoEnpapPrec / 100) *
      (datiDueAnniPrima.totaleContributiEnpapSoggettivo + datiDueAnniPrima.totaleContributiEnpapIntegrativo)
    : 0
  const saldoEnpapPrec = Math.max(
    0,
    datiPrecedente.totaleContributiEnpapSoggettivo +
      datiPrecedente.totaleContributiEnpapIntegrativo -
      accontoEnpapPrec,
  )

  // ─── Scadenze ─────────────────────────────────────────────────────────────
  const { scadenzeAnnoCorrente, scadenzeAnnoSuccessivo } = calcolaScadenze({
    anno,
    regimiCorrente,
    regimiPrecedente,
    saldoImposteDaVersare,
    saldoContributiGS,
    saldoContributiEccArtComm,
    totaleImposteCorrente: datiCorrente.totaleImposte,
    totaleImpostePrecedente: datiPrecedente.totaleImposte,
    accontiImposteVersatiPerAnnoPrecedente:
      (datiAnnoPrec.impostaAcconto1Versato ?? 0) + (datiAnnoPrec.impostaAcconto2Versato ?? 0),
    // Dovuti PIENI di N-1: restano la base degli acconti dell'anno corrente
    // (metodo INPS/ADE), che NON si nettano degli acconti.
    totaleContributiSeparataPrecedente: datiPrecedente.totaleContributiSeparata,
    totaleContributiEccedenzaArtCommPrecedente: datiPrecedente.totaleContributiEccedenzaArtComm,
    // Saldi di N-1 al NETTO degli acconti dovuti per N-1: è questo che si versa
    // materialmente a giugno dell'anno corrente (calendario e F24).
    saldoContributiGSPrecedente,
    saldoContributiEccArtCommPrecedente,
    accontiGSDovutiPerPrecedente,
    accontiEccDovutiPerPrecedente,
    // Dettaglio per documentare i saldi (dovuto - acconti DOVUTI, come INPS).
    totaleContributiSeparataDovutoCorrente: datiCorrente.totaleContributiSeparata,
    accontiGSVersatiNelCorrente: accontiGSDovuti,
    totaleContributiEccArtCommDovutoCorrente: datiCorrente.totaleContributiEccedenzaArtComm,
    accontiEccVersatiNelCorrente: accontiEccDovuti,
    // Il conguaglio per gestione (di-più sulle rate obbligatorie da scontare sul
    // saldo) è calcolato dentro calcolaScadenze, che dispone dei dovuti di cassa.
    input,
    rateazioniImposta: input.rateazioniImposta,
    enpap: {
      precedente: { acconto: accontoEnpapPrec, maternita: datiPrecedente.totaleContributiEnpapMaternita, saldo: saldoEnpapPrec },
      corrente: { acconto: accontoEnpapDovuto, maternita: datiCorrente.totaleContributiEnpapMaternita, saldo: saldoEnpap },
    },
  })

  return {
    ...datiCorrente,
    datiAnnoPrecedente: datiPrecedente,
    contributiVersatiAnnoImpostaPerDeducibilita: deducibiliAnnoCorrente,
    accontiImposteEffettivamenteVersatiPerAnnoCorrente: accontiImposteEff,
    saldoImposteDaVersareAnnoCorrente: saldoImposteDaVersare,
    creditoImposteAnnoCorrente: creditoImposte,
    // Acconti DOVUTI (come INPS): coerenti col saldo ufficiale (dovuto - dovuti).
    accontiGSVersatiPerAnnoRif: accontiGSDovuti,
    // Acconti effettivamente VERSATI dall'utente nell'anno (rate gs/ecc acconto),
    // mostrati a fianco dei dovuti per orientarsi su quanto pagato davvero.
    accontiGSVersatiRealiPerAnnoRif: accontoVersatoDaLista(datiAnnoRif, 'gs'),
    saldoContributiGSAnnoCorrente: saldoContributiGS,
    accontiEccArtCommVersatiPerAnnoRif: accontiEccDovuti,
    accontiEccArtCommVersatiRealiPerAnnoRif: accontoVersatoDaLista(datiAnnoRif, 'ecc'),
    saldoContributiEccArtCommAnnoCorrente: saldoContributiEccArtComm,
    saldoContributiGSPrecedente,
    saldoContributiEccArtCommPrecedente,
    accontoEnpapDovutoPerAnnoRif: accontoEnpapDovuto,
    saldoEnpapAnnoCorrente: saldoEnpap,
    scadenzeAnnoCorrente,
    scadenzeAnnoSuccessivo,
  }
}
