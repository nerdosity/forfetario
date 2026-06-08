import type { Regime, Scadenza } from '@/domain/types'
import { datiAnno, contributoFissoAnno } from '@/data/taxData'
import { calcolaRateContributiFissi, applicaRiduzioneIVS } from '@/domain/contributi'
import { formattaScadenza } from '@/domain/dates'
import { labelTipo } from '@/domain/labels'

const SOGLIA_ACCONTO = 257 // soglia minima per generare acconti
const QUOTA_ACCONTO_IMPOSTE = 0.5
const QUOTA_ACCONTO_GS = 0.8
const QUOTA_ACCONTO_ECC = 0.5

const regimiConFissi = (regimi: Regime[]) =>
  regimi.filter((r) => r.tipo === 'artigiani' || r.tipo === 'commercianti')

const regimiSeparata = (regimi: Regime[]) =>
  regimi.filter((r) => r.tipo === 'separata')

const attivoADicembre = (regimi: Regime[]) =>
  regimi.some((r) => r.meseFine === 12)

interface ParamsScadenze {
  anno: number
  regimiCorrente: Regime[]
  // saldi anno corrente
  saldoImposteDaVersare: number
  saldoContributiGS: number
  saldoContributiEccArtComm: number
  // imposte/contributi anno corrente (base per gli acconti anno+1)
  totaleImposteCorrente: number
  totaleContributiSeparataCorrente: number
  totaleContributiEccedenzaArtCommCorrente: number
  // imposte anno precedente (base per gli acconti anno corrente)
  totaleImpostePrecedente: number
  accontiImposteVersatiPerAnnoPrecedente: number
}

export interface RisultatoScadenze {
  scadenzeAnnoCorrente: Scadenza[]
  scadenzeAnnoSuccessivo: Scadenza[]
}

/**
 * Costruisce il calendario fiscale completo:
 * - Scadenze nell'anno di riferimento (rate fissi correnti + saldo/acconti basati sull'anno precedente)
 * - Scadenze nell'anno successivo (ultima rata fissi correnti + saldo/acconti basati sull'anno corrente
 *   + prime 3 rate fissi dell'anno successivo se il regime continua)
 */
export function calcolaScadenze({
  anno,
  regimiCorrente,
  saldoImposteDaVersare,
  saldoContributiGS,
  saldoContributiEccArtComm,
  totaleImposteCorrente,
  totaleContributiSeparataCorrente,
  totaleContributiEccedenzaArtCommCorrente,
  totaleImpostePrecedente,
  accontiImposteVersatiPerAnnoPrecedente,
}: ParamsScadenze): RisultatoScadenze {
  const globali: Scadenza[] = []
  const annoSucc = anno + 1
  const { saldoAccontoImposte, secondoAccontoImposte } = datiAnno(anno).scadenze
  const fissiCorrenti = regimiConFissi(regimiCorrente)

  // ─── Rate contributi fissi che cadono nell'anno corrente ───────────────────
  for (const regime of fissiCorrenti) {
    for (const rata of calcolaRateContributiFissi(regime, anno).rate) {
      if (rata.anno === anno) {
        globali.push({
          data: rata.data,
          descrizione: rata.descrizione,
          importo: rata.importo,
          componenti: [{ tipo: `Rata contributi fissi ${labelTipo(regime.tipo)} ${anno}`, importo: rata.importo }],
          annoScadenza: anno,
        })
      }
    }
  }

  // ─── Saldo imposte anno precedente + 1° acconto imposte anno corrente ──────
  const saldoImpostePrecedente = Math.max(
    0,
    totaleImpostePrecedente - (accontiImposteVersatiPerAnnoPrecedente ?? 0),
  )
  const accontoImposteAnnoCorrente =
    totaleImpostePrecedente > SOGLIA_ACCONTO ? totaleImpostePrecedente * QUOTA_ACCONTO_IMPOSTE : 0

  if (saldoImpostePrecedente > 0 || accontoImposteAnnoCorrente > 0) {
    globali.push({
      data: formattaScadenza(saldoAccontoImposte, anno),
      descrizione: `Saldo imposte ${anno - 1} + 1° acconto imposte ${anno}`,
      importo: saldoImpostePrecedente + accontoImposteAnnoCorrente,
      componenti: [
        ...(saldoImpostePrecedente > 0
          ? [{ tipo: `Saldo imposte ${anno - 1}`, importo: saldoImpostePrecedente }]
          : []),
        ...(accontoImposteAnnoCorrente > 0
          ? [{ tipo: `1° acconto imposte ${anno} (su tax netta ${anno - 1})`, importo: accontoImposteAnnoCorrente }]
          : []),
      ],
      annoScadenza: anno,
    })
  }
  if (accontoImposteAnnoCorrente > 0) {
    globali.push({
      data: formattaScadenza(secondoAccontoImposte, anno),
      descrizione: `2° acconto imposte ${anno}`,
      importo: accontoImposteAnnoCorrente,
      componenti: [{ tipo: `2° acconto imposte ${anno} (su tax netta ${anno - 1})`, importo: accontoImposteAnnoCorrente }],
      annoScadenza: anno,
    })
  }

  // ─── Ultima rata contributi fissi correnti (anno+1) ───────────────────────
  for (const regime of fissiCorrenti) {
    for (const rata of calcolaRateContributiFissi(regime, anno).rate) {
      if (rata.anno === annoSucc) {
        globali.push({
          data: rata.data,
          descrizione: rata.descrizione,
          importo: rata.importo,
          componenti: [{ tipo: `Rata contributi fissi ${labelTipo(regime.tipo)} ${anno}`, importo: rata.importo }],
          annoScadenza: annoSucc,
        })
      }
    }
  }

  // ─── Saldo imposte anno corrente + 1° acconto imposte anno+1 ──────────────
  const accontoImposteAnnoSucc =
    totaleImposteCorrente > SOGLIA_ACCONTO ? totaleImposteCorrente * QUOTA_ACCONTO_IMPOSTE : 0

  if (saldoImposteDaVersare > 0 || accontoImposteAnnoSucc > 0) {
    const desc =
      [
        saldoImposteDaVersare > 0 ? `Saldo imposte ${anno}` : '',
        accontoImposteAnnoSucc > 0 ? `1° acconto imposte ${annoSucc}` : '',
      ]
        .filter(Boolean)
        .join(' + ')
    globali.push({
      data: formattaScadenza(saldoAccontoImposte, annoSucc),
      descrizione: desc,
      importo: saldoImposteDaVersare + accontoImposteAnnoSucc,
      componenti: [
        ...(saldoImposteDaVersare > 0
          ? [{ tipo: `Saldo imposte ${anno}`, importo: saldoImposteDaVersare }]
          : []),
        ...(accontoImposteAnnoSucc > 0
          ? [{ tipo: `1° acconto imposte ${annoSucc} (su tax ${anno})`, importo: accontoImposteAnnoSucc }]
          : []),
      ],
      annoScadenza: annoSucc,
    })
  }
  if (accontoImposteAnnoSucc > 0) {
    globali.push({
      data: formattaScadenza(secondoAccontoImposte, annoSucc),
      descrizione: `2° acconto imposte ${annoSucc}`,
      importo: accontoImposteAnnoSucc,
      componenti: [{ tipo: `2° acconto imposte ${annoSucc} (su tax ${anno})`, importo: accontoImposteAnnoSucc }],
      annoScadenza: annoSucc,
    })
  }

  // ─── Saldo + acconti Gestione Separata ────────────────────────────────────
  const accontoGSAnnoSucc =
    attivoADicembre(regimiSeparata(regimiCorrente)) && totaleContributiSeparataCorrente > 0
      ? (totaleContributiSeparataCorrente * QUOTA_ACCONTO_GS) / 2
      : 0

  if (saldoContributiGS > 0 || accontoGSAnnoSucc > 0) {
    const desc =
      [
        saldoContributiGS > 0 ? `Saldo contributi G.S. ${anno}` : '',
        accontoGSAnnoSucc > 0 ? `1° acconto contributi G.S. ${annoSucc}` : '',
      ]
        .filter(Boolean)
        .join(' + ')
    globali.push({
      data: formattaScadenza(saldoAccontoImposte, annoSucc),
      descrizione: desc,
      importo: saldoContributiGS + accontoGSAnnoSucc,
      componenti: [
        ...(saldoContributiGS > 0
          ? [{ tipo: `Saldo contributi G.S. ${anno}`, importo: saldoContributiGS }]
          : []),
        ...(accontoGSAnnoSucc > 0
          ? [{ tipo: `1° acconto contributi G.S. ${annoSucc} (su contr. G.S. ${anno})`, importo: accontoGSAnnoSucc }]
          : []),
      ],
      annoScadenza: annoSucc,
    })
  }
  if (accontoGSAnnoSucc > 0) {
    globali.push({
      data: formattaScadenza(secondoAccontoImposte, annoSucc),
      descrizione: `2° acconto contributi G.S. ${annoSucc}`,
      importo: accontoGSAnnoSucc,
      componenti: [{ tipo: `2° acconto contributi G.S. ${annoSucc} (su contr. G.S. ${anno})`, importo: accontoGSAnnoSucc }],
      annoScadenza: annoSucc,
    })
  }

  // ─── Saldo + acconti eccedenza Art/Comm ───────────────────────────────────
  const accontoEccAnnoSucc =
    attivoADicembre(regimiConFissi(regimiCorrente)) && totaleContributiEccedenzaArtCommCorrente > 0
      ? totaleContributiEccedenzaArtCommCorrente * QUOTA_ACCONTO_ECC
      : 0

  if (saldoContributiEccArtComm > 0 || accontoEccAnnoSucc > 0) {
    const desc =
      [
        saldoContributiEccArtComm > 0 ? `Saldo contributi ecc. Art/Comm ${anno}` : '',
        accontoEccAnnoSucc > 0 ? `1° acconto contributi ecc. Art/Comm ${annoSucc}` : '',
      ]
        .filter(Boolean)
        .join(' + ')
    globali.push({
      data: formattaScadenza(saldoAccontoImposte, annoSucc),
      descrizione: desc,
      importo: saldoContributiEccArtComm + accontoEccAnnoSucc,
      componenti: [
        ...(saldoContributiEccArtComm > 0
          ? [{ tipo: `Saldo contributi ecc. Art/Comm ${anno}`, importo: saldoContributiEccArtComm }]
          : []),
        ...(accontoEccAnnoSucc > 0
          ? [{ tipo: `1° acconto contributi ecc. Art/Comm ${annoSucc} (su ecc. ${anno})`, importo: accontoEccAnnoSucc }]
          : []),
      ],
      annoScadenza: annoSucc,
    })
  }
  if (accontoEccAnnoSucc > 0) {
    globali.push({
      data: formattaScadenza(secondoAccontoImposte, annoSucc),
      descrizione: `2° acconto contributi ecc. Art/Comm ${annoSucc}`,
      importo: accontoEccAnnoSucc,
      componenti: [{ tipo: `2° acconto contributi ecc. Art/Comm ${annoSucc} (su ecc. ${anno})`, importo: accontoEccAnnoSucc }],
      annoScadenza: annoSucc,
    })
  }

  // ─── Prime 3 rate contributi fissi dell'anno successivo ───────────────────
  const fissiAttiviADicembre = fissiCorrenti.filter((r) => r.meseFine === 12)
  for (const regime of fissiAttiviADicembre) {
    const regimeSimulato: Regime = {
      ...regime,
      meseInizio: 1, giornoInizio: 1,
      meseFine: 12, giornoFine: 31,
    }
    // Tentiamo di avere i dati dell'anno successivo; se non esistono saltiamo
    try {
      const { rate } = calcolaRateContributiFissi(regimeSimulato, annoSucc)
      const { ivsAnnuale, maternitaMensile } = contributoFissoAnno(annoSucc, regime.tipo)
      const mensile = applicaRiduzioneIVS(ivsAnnuale / 12, maternitaMensile, regime.riduzioneContributi)
      for (const rata of rate) {
        if (rata.anno === annoSucc && !rata.data.includes('Febbraio')) {
          const rataAnnotata = { ...rata, importo: mensile * 3 }
          globali.push({
            data: rataAnnotata.data,
            descrizione: rata.descrizione.replace(String(anno), String(annoSucc)),
            importo: mensile * 3,
            componenti: [{ tipo: `Rata contributi fissi ${labelTipo(regime.tipo)} ${annoSucc}`, importo: mensile * 3 }],
            annoScadenza: annoSucc,
          })
        }
      }
    } catch {
      // Anno successivo non ancora nel database fiscale — nessuna proiezione
    }
  }

  const ordina = (s: Scadenza[]) =>
    [...s].sort((a, b) => {
      const diff = parseDataOrd(a.data) - parseDataOrd(b.data)
      return diff !== 0 ? diff : b.importo - a.importo
    })

  return {
    scadenzeAnnoCorrente: ordina(globali.filter((s) => s.annoScadenza === anno)),
    scadenzeAnnoSuccessivo: ordina(globali.filter((s) => s.annoScadenza === annoSucc)),
  }
}

// ---------------------------------------------------------------------------
// Helper di ordinamento date testuali "GG Mese AAAA"
// ---------------------------------------------------------------------------

const MESI: Record<string, number> = {
  Gennaio: 1, Febbraio: 2, Marzo: 3, Aprile: 4, Maggio: 5, Giugno: 6,
  Luglio: 7, Agosto: 8, Settembre: 9, Ottobre: 10, Novembre: 11, Dicembre: 12,
}

function parseDataOrd(data: string): number {
  const [gg, mese, anno] = data.split(' ')
  const mm = MESI[mese] ?? 1
  return new Date(Number(anno), mm - 1, Number(gg)).getTime()
}
