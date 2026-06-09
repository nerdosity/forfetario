import type {
  CalcoloInput,
  DettaglioRegime,
  Regime,
  RisultatoAnno,
  RisultatoCalcolo,
} from '@/domain/types'
import { aliquotaContributi, datiAnno } from '@/data/taxData'
import { giorniPermanenza } from '@/domain/dates'
import { getMesiInPeriodo, applicaRiduzioneIVS, contributiVersatiEffettivi, rateFissePerTrimestre } from '@/domain/contributi'
import { calcolaScadenze } from '@/domain/scadenze'
import { contributoFissoAnno } from '@/data/taxData'

// ---------------------------------------------------------------------------
// Calcolo di un singolo anno
// ---------------------------------------------------------------------------

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

      // Contributi sull'eccedenza (proporzionati ai mesi)
      const minimaleProporz = (minimaleReddito * mesiRegime) / 12
      if (imponibileLordoRegime > minimaleProporz) {
        const eccedenza = imponibileLordoRegime - minimaleProporz
        const sogliaProporz = (sogliaPrimaFascia * mesiRegime) / 12
        let eccedenzaIVSBruti: number

        if (imponibileLordoRegime <= sogliaProporz) {
          eccedenzaIVSBruti = (eccedenza * aliquota) / 100
          dettaglioCalcoloContributi +=
            `\nEccedenza IVS: (${imponibileLordoRegime.toFixed(2)} - ${minimaleProporz.toFixed(2)}) € × ${aliquota}% = ${eccedenzaIVSBruti.toFixed(2)} €`
        } else {
          const primaFascia = sogliaProporz - minimaleProporz
          const secondaFascia = imponibileLordoRegime - sogliaProporz
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

  // Imposta sostitutiva: si applica all'imponibile netto (lordo − contributi versati)
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
    rateFisse,
  }
}

// ---------------------------------------------------------------------------
// Motore principale
// ---------------------------------------------------------------------------

/** Calcola tutto: anno corrente + anno precedente + saldi + scadenze. */
export function calcola(input: CalcoloInput): RisultatoCalcolo {
  const {
    anno,
    regimiCorrente,
    regimiPrecedente,
    contributiVersatiDuranteAnnoPrecedente,
    accontiImposteVersatiPerAnnoCorrente,
    accontiImposteVersatiPerAnnoPrecedente,
    accontiContributiSeparataVersatiPerAnnoCorrente,
    accontiContributiEccedenzaArtCommVersatiPerAnnoCorrente,
  } = input

  const deducibiliAnnoCorrente = contributiVersatiEffettivi(input)
  const deducibiliAnnoPrecedente = contributiVersatiDuranteAnnoPrecedente ?? 0

  const datiCorrente = calcolaDatiAnno(regimiCorrente, anno, deducibiliAnnoCorrente)

  // Anno precedente potrebbe non essere nel database (es. primo anno disponibile).
  // In quel caso si usano zero ovunque: nessun saldo/acconto basato sull'anno prima.
  let datiPrecedente: ReturnType<typeof calcolaDatiAnno>
  try {
    datiPrecedente = calcolaDatiAnno(regimiPrecedente, anno - 1, deducibiliAnnoPrecedente)
  } catch {
    datiPrecedente = {
      dettagliRegimiCalcolati: [],
      totaleImponibileLordo: 0,
      totaleContributiINPS: 0,
      totaleContributiSeparata: 0,
      totaleContributiFissiArtComm: 0,
      totaleContributiEccedenzaArtComm: 0,
      totaleImposte: 0,
      totaleFatturato: 0,
      imponibileNettoTotalePerImposte: 0,
      rateFisse: [0, 0, 0, 0],
    }
  }

  // ─── Saldi anno corrente ──────────────────────────────────────────────────
  const accontiImposteEff = accontiImposteVersatiPerAnnoCorrente ?? 0
  const accontiGSEff = accontiContributiSeparataVersatiPerAnnoCorrente ?? 0
  const accontiEccEff = accontiContributiEccedenzaArtCommVersatiPerAnnoCorrente ?? 0

  const saldoImposteDaVersare = Math.max(0, datiCorrente.totaleImposte - accontiImposteEff)
  const creditoImposte = Math.max(0, accontiImposteEff - datiCorrente.totaleImposte)

  const saldoContributiGS = Math.max(0, datiCorrente.totaleContributiSeparata - accontiGSEff)
  const saldoContributiEccArtComm = Math.max(0, datiCorrente.totaleContributiEccedenzaArtComm - accontiEccEff)

  // ─── Scadenze ─────────────────────────────────────────────────────────────
  const { scadenzeAnnoCorrente, scadenzeAnnoSuccessivo } = calcolaScadenze({
    anno,
    regimiCorrente,
    saldoImposteDaVersare,
    saldoContributiGS,
    saldoContributiEccArtComm,
    totaleImposteCorrente: datiCorrente.totaleImposte,
    totaleContributiSeparataCorrente: datiCorrente.totaleContributiSeparata,
    totaleContributiEccedenzaArtCommCorrente: datiCorrente.totaleContributiEccedenzaArtComm,
    totaleImpostePrecedente: datiPrecedente.totaleImposte,
    accontiImposteVersatiPerAnnoPrecedente: accontiImposteVersatiPerAnnoPrecedente ?? 0,
  })

  return {
    ...datiCorrente,
    datiAnnoPrecedente: datiPrecedente,
    contributiVersatiAnnoImpostaPerDeducibilita: deducibiliAnnoCorrente,
    accontiImposteEffettivamenteVersatiPerAnnoCorrente: accontiImposteEff,
    saldoImposteDaVersareAnnoCorrente: saldoImposteDaVersare,
    creditoImposteAnnoCorrente: creditoImposte,
    accontiGSVersatiPerAnnoRif: accontiGSEff,
    saldoContributiGSAnnoCorrente: saldoContributiGS,
    accontiEccArtCommVersatiPerAnnoRif: accontiEccEff,
    saldoContributiEccArtCommAnnoCorrente: saldoContributiEccArtComm,
    scadenzeAnnoCorrente,
    scadenzeAnnoSuccessivo,
  }
}
