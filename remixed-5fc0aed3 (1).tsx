import React, { useState, useMemo } from 'react'
import {
  Calculator,
  Euro,
  Calendar,
  AlertCircle,
  Settings,
  Plus,
  Trash2,
  Info,
  History
} from 'lucide-react'

const ForfettarioCalculator = () => {
  const [annoRiferimento, setAnnoRiferimento] = useState(2024)
  const [regimiPrecedente, setRegimiPrecedente] = useState([
    {
      id: 1,
      tipo: 'separata',
      aliquota: 15,
      coefficiente: 67,
      meseInizio: 1,
      giornoInizio: 1,
      meseFine: 12,
      giornoFine: 31,
      fatturato: 36381,
      riduzioneContributi: 'nessuna' // 'nessuna', '35', '50'
    }
  ])

  const [regimiCorrente, setRegimiCorrente] = useState([
    {
      id: 1,
      tipo: 'separata',
      aliquota: 15,
      coefficiente: 67,
      meseInizio: 1,
      giornoInizio: 1,
      meseFine: 2,
      giornoFine: 28,
      fatturato: 5278,
      riduzioneContributi: 'nessuna'
    },
    {
      id: 2,
      tipo: 'artigiani',
      aliquota: 15,
      coefficiente: 67,
      meseInizio: 3,
      giornoInizio: 1,
      meseFine: 12,
      giornoFine: 31,
      fatturato: 36108,
      riduzioneContributi: 'nessuna'
    }
  ])

  // Acconti versati PER l'anno di riferimento (annoRiferimento), basati sull'anno precedente (annoRiferimento - 1)
  const [
    accontiImposteVersatiPerAnnoCorrente,
    setAccontiImposteVersatiPerAnnoCorrente
  ] = useState(2904)

  // Contributi INPS versati DURANTE l'anno di riferimento (annoRiferimento). Sono deducibili per le imposte dell'annoRiferimento.
  const [
    contributiVersatiDuranteAnnoRiferimento,
    setContributiVersatiDuranteAnnoRiferimento
  ] = useState(7281)

  // Acconti contributi specifici versati PER l'annoRiferimento (basati su annoRiferimento-1)
  const [
    accontiContributiSeparataVersatiPerAnnoRiferimento,
    setAccontiContributiSeparataVersatiPerAnnoRiferimento
  ] = useState(0)
  const [
    accontiContributiEccedenzaArtCommVersatiPerAnnoRiferimento,
    setAccontiContributiEccedenzaArtCommVersatiPerAnnoRiferimento
  ] = useState(0)

  // Dati per quadratura anno precedente (annoRiferimento - 1)
  const [
    contributiVersatiDuranteAnnoPrecedente,
    setContributiVersatiDuranteAnnoPrecedente
  ] = useState(5017)
  const [
    accontiImposteVersatiPerAnnoPrecedente,
    setAccontiImposteVersatiPerAnnoPrecedente
  ] = useState(0)

  const [showAdvanced, setShowAdvanced] = useState(false)

  const aliquoteOpzioni = [5, 15]
  const coefficientiOpzioni = [40, 54, 62, 67, 78, 86]
  const riduzioniContributiOpzioni = [
    { value: 'nessuna', label: 'Nessuna riduzione' },
    { value: '35', label: 'Riduzione 35% (Forfettari)' },
    { value: '50', label: 'Riduzione 50% (Altri casi)' }
  ]

  const formatEuro = value =>
    new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(value || 0)
  
  const nomiMesi = [
    'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
    'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'
  ]

  const getGiorniInAnno = anno =>
    anno % 4 === 0 && (anno % 100 !== 0 || anno % 400 === 0) ? 366 : 365
  
  const getGiorniInMese = (mese, anno) => {
    const giorniMese = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    if (mese === 2 && getGiorniInAnno(anno) === 366) return 29
    return giorniMese[mese - 1]
  }
  
  const calcolaGiorniPermanenza = (
    meseInizio,
    giornoInizio,
    meseFine,
    giornoFine,
    anno
  ) => {
    if (meseInizio < 1 || meseFine > 12 || meseInizio > meseFine) return 0
    if (
      giornoInizio < 1 ||
      giornoFine < 1 ||
      giornoInizio > getGiorniInMese(meseInizio, anno) ||
      giornoFine > getGiorniInMese(meseFine, anno)
    )
      return 0
    if (meseInizio === meseFine) return giornoFine - giornoInizio + 1
    let giorni = 0
    giorni += getGiorniInMese(meseInizio, anno) - giornoInizio + 1
    for (let mese = meseInizio + 1; mese < meseFine; mese++) {
      giorni += getGiorniInMese(mese, anno)
    }
    if (meseFine !== meseInizio) giorni += giornoFine
    return giorni
  }
  
  const getMesiInPeriodo = (meseInizio, giornoInizio, meseFine, giornoFine) => {
    if (meseInizio < 1 || meseFine > 12 || meseInizio > meseFine) return 0
    if (giornoInizio < 1 || giornoFine < 1) return 0
    let count = 0
    if (meseFine >= meseInizio) {
      count = meseFine - meseInizio + 1
    } else {
      count = 12 - meseInizio + 1 + meseFine
    }
    return count
  }
  
  const getAliquotaContributi = (anno, tipo) => {
    if (tipo === 'separata') return anno >= 2024 ? 26.07 : 26.23
    if (tipo === 'artigiani') return 24
    if (tipo === 'commercianti') return 24.48
    return 26.07
  }
  
  const getMinimaleReddito = anno =>
    ({ 2025: 18555, 2024: 18415, 2023: 17504, 2022: 16243 }[anno] || 18555)
  
  const getSogliaPrimaFascia = anno =>
    ({ 2025: 55448, 2024: 55008, 2023: 52500, 2022: 48000 }[anno] || 55448)
  
  const getContributoFisso = (anno, tipo) => {
    const data = {
      artigiani: {
        2025: { ivs: 4453.2, mat: 0.62 },
        2024: { ivs: 4419.6, mat: 0.62 },
        2023: { ivs: 4190.0, mat: 0.62 },
        2022: { ivs: 3990.0, mat: 0.62 }
      },
      commercianti: {
        2025: { ivs: 4542.26, mat: 0.62 },
        2024: { ivs: 4515.6, mat: 0.62 },
        2023: { ivs: 4270.0, mat: 0.62 },
        2022: { ivs: 4070.0, mat: 0.62 }
      }
    }
    const fallback =
      tipo === 'artigiani' ? data.artigiani[2025] : data.commercianti[2025]
    const d = data[tipo] && data[tipo][anno] ? data[tipo][anno] : fallback
    return { ivsAnnuale: d.ivs, maternitaMensile: d.mat }
  }

  const applicaRiduzioneContributi = (
    importoIVS,
    importoMaternitaNonRiducibile,
    riduzione
  ) => {
    let ivsRidotto = importoIVS
    if (riduzione === '35') {
      ivsRidotto *= 0.65
    } else if (riduzione === '50') {
      ivsRidotto *= 0.5
    }
    return ivsRidotto + importoMaternitaNonRiducibile
  }

  const calcolaRateContributiFissi = (regime, anno) => {
    const { ivsAnnuale, maternitaMensile } = getContributoFisso(
      anno,
      regime.tipo
    )
    const contributoIVSAnnualeDaRipartire = ivsAnnuale

    const ivsMensileRidotto = applicaRiduzioneContributi(
      contributoIVSAnnualeDaRipartire / 12,
      0,
      regime.riduzioneContributi
    )
    const contributoTotaleMensileEffettivo =
      ivsMensileRidotto + maternitaMensile

    const rate = []
    const scadenze = [
      {
        data: '16 Maggio',
        meseCopertoInizio: 1,
        meseCopertoFine: 3,
        annoOffset: 0
      },
      {
        data: '20 Agosto',
        meseCopertoInizio: 4,
        meseCopertoFine: 6,
        annoOffset: 0
      },
      {
        data: '18 Novembre',
        meseCopertoInizio: 7,
        meseCopertoFine: 9,
        annoOffset: 0
      },
      {
        data: '17 Febbraio',
        meseCopertoInizio: 10,
        meseCopertoFine: 12,
        annoOffset: 1
      }
    ]
    scadenze.forEach((scadenza, index) => {
      let mesiDaPagareInQuestaRata = 0
      for (
        let m = scadenza.meseCopertoInizio;
        m <= scadenza.meseCopertoFine;
        m++
      ) {
        if (m >= regime.meseInizio && m <= regime.meseFine) {
          mesiDaPagareInQuestaRata++
        }
      }
      if (mesiDaPagareInQuestaRata > 0) {
        const importoRata =
          contributoTotaleMensileEffettivo * mesiDaPagareInQuestaRata
        rate.push({
          data: scadenza.data,
          descrizione: `Contributi fissi ${getTipoLabel(
            regime.tipo
          )} ${anno} (${mesiDaPagareInQuestaRata} mes${
            mesiDaPagareInQuestaRata > 1 ? 'i' : 'o'
          } trim. ${index + 1})`,
          importo: importoRata,
          anno: anno + scadenza.annoOffset
        })
      }
    })
    const mesiAttivitaEffettivi = getMesiInPeriodo(
      regime.meseInizio,
      regime.giornoInizio,
      regime.meseFine,
      regime.giornoFine
    )
    const contributiFissiDovuti =
      contributoTotaleMensileEffettivo * mesiAttivitaEffettivi
    return { rate, totaleContributi: contributiFissiDovuti }
  }
  
  const getTipoLabel = tipo =>
    ({
      separata: 'Gestione Separata',
      artigiani: 'Artigiani',
      commercianti: 'Commercianti'
    }[tipo] || 'N/D')

  const aggiungiRegimePrecedente = () =>
    setRegimiPrecedente([
      ...regimiPrecedente,
      {
        id: Math.random(),
        tipo: 'separata',
        aliquota: 15,
        coefficiente: 67,
        meseInizio: 1,
        giornoInizio: 1,
        meseFine: 12,
        giornoFine: 31,
        fatturato: 0,
        riduzioneContributi: 'nessuna'
      }
    ])
  
  const rimuoviRegimePrecedente = id =>
    regimiPrecedente.length > 1 &&
    setRegimiPrecedente(regimiPrecedente.filter(r => r.id !== id))
  
  const aggiornaRegimePrecedente = (id, campo, valore) =>
    setRegimiPrecedente(
      regimiPrecedente.map(r =>
        r.id === id
          ? {
              ...r,
              [campo]:
                typeof valore === 'string' &&
                [
                  'aliquota',
                  'coefficiente',
                  'fatturato',
                  'meseInizio',
                  'giornoInizio',
                  'meseFine',
                  'giornoFine'
                ].includes(campo)
                  ? Number(valore)
                  : valore
            }
          : r
      )
    )
  
  const aggiungiRegime = () =>
    setRegimiCorrente([
      ...regimiCorrente,
      {
        id: Math.random(),
        tipo: 'separata',
        aliquota: 15,
        coefficiente: 67,
        meseInizio: 1,
        giornoInizio: 1,
        meseFine: 12,
        giornoFine: 31,
        fatturato: 0,
        riduzioneContributi: 'nessuna'
      }
    ])
  
  const rimuoviRegime = id =>
    regimiCorrente.length > 1 &&
    setRegimiCorrente(regimiCorrente.filter(r => r.id !== id))
  
  const aggiornaRegime = (id, campo, valore) =>
    setRegimiCorrente(
      regimiCorrente.map(r =>
        r.id === id
          ? {
              ...r,
              [campo]:
                typeof valore === 'string' &&
                [
                  'aliquota',
                  'coefficiente',
                  'fatturato',
                  'meseInizio',
                  'giornoInizio',
                  'meseFine',
                  'giornoFine'
                ].includes(campo)
                  ? Number(valore)
                  : valore
            }
          : r
      )
    )

  const calcolaScadenzeDettagliate = (
    dettagliCalcoliCorrenti,
    datiAnnoPrecedenteConContributi,
    annoRiferimento
  ) => {
    const scadenzeGlobali = []
    const {
      totaleImposte: totaleImposteCorrente,
      totaleContributiSeparata: totaleContributiSeparataCorrente,
      totaleContributiEccedenzaArtComm:
        totaleContributiEccedenzaArtCommCorrente,
      regimiCorrentePerTipo
    } = dettagliCalcoliCorrenti
    
    const { totaleImposte: impostaPrecedenteNetta } =
      datiAnnoPrecedenteConContributi

    ;(regimiCorrentePerTipo.artigiani || [])
      .concat(regimiCorrentePerTipo.commercianti || [])
      .forEach(regime => {
        const { rate } = calcolaRateContributiFissi(regime, annoRiferimento)
        rate
          .filter(r => r.anno === annoRiferimento)
          .forEach(rata =>
            scadenzeGlobali.push({
              data: `${rata.data} ${annoRiferimento}`,
              descrizione: rata.descrizione,
              importo: rata.importo,
              componenti: [
                {
                  tipo: `Rata contributi fissi ${getTipoLabel(
                    regime.tipo
                  )} ${annoRiferimento}`,
                  importo: rata.importo
                }
              ],
              annoScadenza: annoRiferimento
            })
          )
      })

    const accontoImposteAnnoCorrenteSingolaRata =
      impostaPrecedenteNetta > 257 ? (impostaPrecedenteNetta * 1.0) / 2 : 0
    const saldoImposteAnnoPrecedenteDaVersare = Math.max(
      0,
      impostaPrecedenteNetta - (accontiImposteVersatiPerAnnoPrecedente || 0)
    )

    if (
      saldoImposteAnnoPrecedenteDaVersare > 0 ||
      accontoImposteAnnoCorrenteSingolaRata > 0
    ) {
      scadenzeGlobali.push({
        data: `30 Giugno ${annoRiferimento}`,
        descrizione: `Saldo Imposte ${
          annoRiferimento - 1
        } + 1° Acconto Imposte ${annoRiferimento}`,
        importo:
          saldoImposteAnnoPrecedenteDaVersare +
          accontoImposteAnnoCorrenteSingolaRata,
        componenti: [
          ...(saldoImposteAnnoPrecedenteDaVersare > 0
            ? [
                {
                  tipo: `Saldo Imposte ${annoRiferimento - 1}`,
                  importo: saldoImposteAnnoPrecedenteDaVersare
                }
              ]
            : []),
          ...(accontoImposteAnnoCorrenteSingolaRata > 0
            ? [
                {
                  tipo: `1° Acconto Imposte ${annoRiferimento} (su tax netta ${
                    annoRiferimento - 1
                  })`,
                  importo: accontoImposteAnnoCorrenteSingolaRata
                }
              ]
            : [])
        ],
        annoScadenza: annoRiferimento
      })
    }
    if (accontoImposteAnnoCorrenteSingolaRata > 0) {
      scadenzeGlobali.push({
        data: `30 Novembre ${annoRiferimento}`,
        descrizione: `2° Acconto Imposte ${annoRiferimento}`,
        importo: accontoImposteAnnoCorrenteSingolaRata,
        componenti: [
          {
            tipo: `2° Acconto Imposte ${annoRiferimento} (su tax netta ${
              annoRiferimento - 1
            })`,
            importo: accontoImposteAnnoCorrenteSingolaRata
          }
        ],
        annoScadenza: annoRiferimento
      })
    }

    const annoSuccessivo = annoRiferimento + 1
    ;(regimiCorrentePerTipo.artigiani || [])
      .concat(regimiCorrentePerTipo.commercianti || [])
      .forEach(regime => {
        const { rate } = calcolaRateContributiFissi(regime, annoRiferimento)
        rate
          .filter(r => r.anno === annoSuccessivo)
          .forEach(rata =>
            scadenzeGlobali.push({
              data: `${rata.data} ${annoSuccessivo}`,
              descrizione: rata.descrizione,
              importo: rata.importo,
              componenti: [
                {
                  tipo: `Rata contributi fissi ${getTipoLabel(
                    regime.tipo
                  )} ${annoRiferimento}`,
                  importo: rata.importo
                }
              ],
              annoScadenza: annoSuccessivo
            })
          )
      })

    const regimiArtCommAttiviFineAnno = (regimiCorrentePerTipo.artigiani || [])
      .concat(regimiCorrentePerTipo.commercianti || [])
      .filter(r => r.meseFine === 12)
    regimiArtCommAttiviFineAnno.forEach(regime => {
      const regimeAnnoSuccessivoSimulato = {
        ...regime,
        meseInizio: 1,
        giornoInizio: 1,
        meseFine: 12,
        giornoFine: 31
      }
      const { rate: rateAnnoSuccessivo } = calcolaRateContributiFissi(
        regimeAnnoSuccessivoSimulato,
        annoSuccessivo
      )
      rateAnnoSuccessivo
        .filter(r => r.anno === annoSuccessivo && r.data !== `17 Febbraio`)
        .forEach(rata =>
          scadenzeGlobali.push({
            data: `${rata.data} ${annoSuccessivo}`,
            descrizione: rata.descrizione.replace(
              `${annoRiferimento}`,
              `${annoSuccessivo}`
            ),
            importo: rata.importo,
            componenti: [
              {
                tipo: `Rata contributi fissi ${getTipoLabel(
                  regime.tipo
                )} ${annoSuccessivo}`,
                importo: rata.importo
              }
            ],
            annoScadenza: annoSuccessivo
          })
        )
    })

    const saldoImposteAnnoCorrente = Math.max(
      0,
      totaleImposteCorrente - (accontiImposteVersatiPerAnnoCorrente || 0)
    )
    const accontoImposteAnnoSuccessivoSingolaRata =
      totaleImposteCorrente > 257 ? (totaleImposteCorrente * 1.0) / 2 : 0
    if (
      saldoImposteAnnoCorrente > 0 ||
      accontoImposteAnnoSuccessivoSingolaRata > 0
    ) {
      let desc =
        saldoImposteAnnoCorrente > 0 ? `Saldo Imposte ${annoRiferimento}` : ''
      if (accontoImposteAnnoSuccessivoSingolaRata > 0) {
        desc += (desc ? ' + ' : '') + `1° Acconto Imposte ${annoSuccessivo}`
      }
      scadenzeGlobali.push({
        data: `30 Giugno ${annoSuccessivo}`,
        descrizione: desc,
        importo:
          saldoImposteAnnoCorrente + accontoImposteAnnoSuccessivoSingolaRata,
        componenti: [
          ...(saldoImposteAnnoCorrente > 0
            ? [
                {
                  tipo: `Saldo Imposte ${annoRiferimento}`,
                  importo: saldoImposteAnnoCorrente
                }
              ]
            : []),
          ...(accontoImposteAnnoSuccessivoSingolaRata > 0
            ? [
                {
                  tipo: `1° Acconto Imposte ${annoSuccessivo} (su tax ${annoRiferimento})`,
                  importo: accontoImposteAnnoSuccessivoSingolaRata
                }
              ]
            : [])
        ],
        annoScadenza: annoSuccessivo
      })
    }
    if (accontoImposteAnnoSuccessivoSingolaRata > 0) {
      scadenzeGlobali.push({
        data: `30 Novembre ${annoSuccessivo}`,
        descrizione: `2° Acconto Imposte ${annoSuccessivo}`,
        importo: accontoImposteAnnoSuccessivoSingolaRata,
        componenti: [
          {
            tipo: `2° Acconto Imposte ${annoSuccessivo} (su tax ${annoRiferimento})`,
            importo: accontoImposteAnnoSuccessivoSingolaRata
          }
        ],
        annoScadenza: annoSuccessivo
      })
    }

    const saldoContributiGSAnnoCorrente = Math.max(
      0,
      totaleContributiSeparataCorrente -
        (accontiContributiSeparataVersatiPerAnnoRiferimento || 0)
    )
    let gestioneSeparataAttivaFineAnnoCorrente = false
    if (
      regimiCorrentePerTipo.separata &&
      regimiCorrentePerTipo.separata.length > 0
    ) {
      gestioneSeparataAttivaFineAnnoCorrente =
        regimiCorrentePerTipo.separata.some(regime => regime.meseFine === 12)
    }
    const accontoContributiGSAnnoSuccessivoSingolaRata =
      gestioneSeparataAttivaFineAnnoCorrente &&
      totaleContributiSeparataCorrente > 0
        ? (totaleContributiSeparataCorrente * 0.8) / 2
        : 0
    if (
      saldoContributiGSAnnoCorrente > 0 ||
      accontoContributiGSAnnoSuccessivoSingolaRata > 0
    ) {
      let descGS =
        saldoContributiGSAnnoCorrente > 0
          ? `Saldo Contributi G.S. ${annoRiferimento}`
          : ''
      if (accontoContributiGSAnnoSuccessivoSingolaRata > 0) {
        descGS +=
          (descGS ? ' + ' : '') + `1° Acconto Contributi G.S. ${annoSuccessivo}`
      }
      scadenzeGlobali.push({
        data: `30 Giugno ${annoSuccessivo}`,
        descrizione: descGS,
        importo:
          saldoContributiGSAnnoCorrente +
          accontoContributiGSAnnoSuccessivoSingolaRata,
        componenti: [
          ...(saldoContributiGSAnnoCorrente > 0
            ? [
                {
                  tipo: `Saldo Contributi G.S. ${annoRiferimento}`,
                  importo: saldoContributiGSAnnoCorrente
                }
              ]
            : []),
          ...(accontoContributiGSAnnoSuccessivoSingolaRata > 0
            ? [
                {
                  tipo: `1° Acconto Contributi G.S. ${annoSuccessivo} (su contr. G.S. ${annoRiferimento})`,
                  importo: accontoContributiGSAnnoSuccessivoSingolaRata
                }
              ]
            : [])
        ],
        annoScadenza: annoSuccessivo
      })
    }
    if (accontoContributiGSAnnoSuccessivoSingolaRata > 0) {
      scadenzeGlobali.push({
        data: `30 Novembre ${annoSuccessivo}`,
        descrizione: `2° Acconto Contributi G.S. ${annoSuccessivo}`,
        importo: accontoContributiGSAnnoSuccessivoSingolaRata,
        componenti: [
          {
            tipo: `2° Acconto Contributi G.S. ${annoSuccessivo} (su contr. G.S. ${annoRiferimento})`,
            importo: accontoContributiGSAnnoSuccessivoSingolaRata
          }
        ],
        annoScadenza: annoSuccessivo
      })
    }

    const saldoContributiEccArtCommAnnoCorrente = Math.max(
      0,
      totaleContributiEccedenzaArtCommCorrente -
        (accontiContributiEccedenzaArtCommVersatiPerAnnoRiferimento || 0)
    )
    let artCommAttiviFineAnnoCorrente = false
    const regimiArtCommCorrenti = (
      regimiCorrentePerTipo.artigiani || []
    ).concat(regimiCorrentePerTipo.commercianti || [])
    if (regimiArtCommCorrenti.length > 0) {
      artCommAttiviFineAnnoCorrente = regimiArtCommCorrenti.some(
        regime => regime.meseFine === 12
      )
    }
    const accontoContributiEccArtCommAnnoSuccessivoSingolaRata =
      artCommAttiviFineAnnoCorrente &&
      totaleContributiEccedenzaArtCommCorrente > 0
        ? (totaleContributiEccedenzaArtCommCorrente * 1.0) / 2
        : 0
    if (
      saldoContributiEccArtCommAnnoCorrente > 0 ||
      accontoContributiEccArtCommAnnoSuccessivoSingolaRata > 0
    ) {
      let descEcc =
        saldoContributiEccArtCommAnnoCorrente > 0
          ? `Saldo Contributi Ecc. Art/Comm ${annoRiferimento}`
          : ''
      if (accontoContributiEccArtCommAnnoSuccessivoSingolaRata > 0) {
        descEcc +=
          (descEcc ? ' + ' : '') +
          `1° Acconto Contributi Ecc. Art/Comm ${annoSuccessivo}`
      }
      scadenzeGlobali.push({
        data: `30 Giugno ${annoSuccessivo}`,
        descrizione: descEcc,
        importo:
          saldoContributiEccArtCommAnnoCorrente +
          accontoContributiEccArtCommAnnoSuccessivoSingolaRata,
        componenti: [
          ...(saldoContributiEccArtCommAnnoCorrente > 0
            ? [
                {
                  tipo: `Saldo Contributi Ecc. Art/Comm ${annoRiferimento}`,
                  importo: saldoContributiEccArtCommAnnoCorrente
                }
              ]
            : []),
          ...(accontoContributiEccArtCommAnnoSuccessivoSingolaRata > 0
            ? [
                {
                  tipo: `1° Acconto Contributi Ecc. Art/Comm ${annoSuccessivo} (su ecc. ${annoRiferimento})`,
                  importo: accontoContributiEccArtCommAnnoSuccessivoSingolaRata
                }
              ]
            : [])
        ],
        annoScadenza: annoSuccessivo
      })
    }
    if (accontoContributiEccArtCommAnnoSuccessivoSingolaRata > 0) {
      scadenzeGlobali.push({
        data: `30 Novembre ${annoSuccessivo}`,
        descrizione: `2° Acconto Contributi Ecc. Art/Comm ${annoSuccessivo}`,
        importo: accontoContributiEccArtCommAnnoSuccessivoSingolaRata,
        componenti: [
          {
            tipo: `2° Acconto Contributi Ecc. Art/Comm ${annoSuccessivo} (su ecc. ${annoRiferimento})`,
            importo: accontoContributiEccArtCommAnnoSuccessivoSingolaRata
          }
        ],
        annoScadenza: annoSuccessivo
      })
    }

    const parseDate = dataStr => {
      const [giorno, meseStr, anno] = dataStr.split(' ')
      const mesiMap = {
        Gennaio: 0, Gen: 0, Febbraio: 1, Feb: 1, Marzo: 2, Mar: 2,
        Aprile: 3, Apr: 3, Maggio: 4, Mag: 4, Giugno: 5, Giu: 5,
        Luglio: 6, Lug: 6, Agosto: 7, Ago: 7, Settembre: 8, Set: 8,
        Ottobre: 9, Ott: 9, Novembre: 10, Nov: 10, Dicembre: 11, Dic: 11
      }
      if (!mesiMap.hasOwnProperty(meseStr)) {
        console.warn('Mese non riconosciuto in parseDate:', meseStr, 'da stringa:', dataStr)
        return new Date(parseInt(anno), 0, parseInt(giorno))
      }
      return new Date(parseInt(anno), mesiMap[meseStr], parseInt(giorno))
    }
    scadenzeGlobali.sort((a, b) => {
      const dateA = parseDate(a.data)
      const dateB = parseDate(b.data)
      if (dateA.getTime() === dateB.getTime()) return b.importo - a.importo
      return dateA - dateB
    })
    return {
      scadenze2024: scadenzeGlobali.filter(
        s => s.annoScadenza === annoRiferimento
      ),
      scadenze2025: scadenzeGlobali.filter(
        s => s.annoScadenza === annoSuccessivo
      )
    }
  }

  const calcolaDatiPerAnno = (
    regimiAnno,
    annoCalc,
    contributiVersatiInAnnoPerDeducibilita = 0
  ) => {
    let totaleImponibileLordo = 0,
      totaleContributiINPSDovuti = 0,
      totaleContributiSeparata = 0,
      totaleContributiFissiArtComm = 0,
      totaleContributiEccedenzaArtComm = 0,
      totaleFatturato = 0
    let dettagliRegimiCalcolati = []
    const regimiPerTipo = { separata: [], artigiani: [], commercianti: [] }

    regimiAnno.forEach(regime => {
      if (regime.tipo === 'separata') regimiPerTipo.separata.push(regime)
      else if (regime.tipo === 'artigiani') regimiPerTipo.artigiani.push(regime)
      else if (regime.tipo === 'commercianti')
        regimiPerTipo.commercianti.push(regime)

      const giorniRegime = calcolaGiorniPermanenza(
        regime.meseInizio,
        regime.giornoInizio,
        regime.meseFine,
        regime.giornoFine,
        annoCalc
      )
      const mesiRegime = getMesiInPeriodo(
        regime.meseInizio,
        regime.giornoInizio,
        regime.meseFine,
        regime.giornoFine
      )
      const imponibileLordoRegime =
        (regime.fatturato * Number(regime.coefficiente)) / 100
      let contributiRegimeINPS = 0,
        contributiFissiRegime = 0,
        contributiEccedenzaRegime = 0
      let dettaglioCalcoloContributi = ''
      
      if (regime.tipo === 'separata') {
        const aliquotaContributi = getAliquotaContributi(annoCalc, regime.tipo)
        contributiRegimeINPS =
          (imponibileLordoRegime * aliquotaContributi) / 100
        totaleContributiSeparata += contributiRegimeINPS
        dettaglioCalcoloContributi = `Separata: ${formatEuro(
          imponibileLordoRegime
        )} × ${aliquotaContributi}% = ${formatEuro(contributiRegimeINPS)}`
      } else {
        const aliquotaContributiEccedenza = getAliquotaContributi(
          annoCalc,
          regime.tipo
        )
        const minimaleRedditoAnnuo = getMinimaleReddito(annoCalc)
        const sogliaPrimaFasciaAnnua = getSogliaPrimaFascia(annoCalc)
        const { ivsAnnuale, maternitaMensile } = getContributoFisso(
          annoCalc,
          regime.tipo
        )
        const contributoIVSAnnualeFisso = ivsAnnuale
        const contributoMaternitaAnnualeFisso = maternitaMensile * 12
        const ivsMensileRidotto = applicaRiduzioneContributi(
          contributoIVSAnnualeFisso / 12,
          0,
          regime.riduzioneContributi
        )
        const maternitaMensileEffettiva = contributoMaternitaAnnualeFisso / 12
        contributiFissiRegime =
          (ivsMensileRidotto + maternitaMensileEffettiva) * mesiRegime
        totaleContributiFissiArtComm += contributiFissiRegime
        dettaglioCalcoloContributi = `Fissi (${mesiRegime} mes${
          mesiRegime > 1 ? 'i' : 'e'
        }): ${formatEuro(contributiFissiRegime)}`
        if (regime.riduzioneContributi !== 'nessuna')
          dettaglioCalcoloContributi += ` (rid. ${regime.riduzioneContributi}%)`

        const minimaleRedditoProporzionato =
          (minimaleRedditoAnnuo * mesiRegime) / 12
        if (imponibileLordoRegime > minimaleRedditoProporzionato) {
          const eccedenzaImponibile =
            imponibileLordoRegime - minimaleRedditoProporzionato
          const sogliaPrimaFasciaProporzionata =
            (sogliaPrimaFasciaAnnua * mesiRegime) / 12
          let contributiEccedenzaIVSBrutiCalc
          if (imponibileLordoRegime <= sogliaPrimaFasciaProporzionata) {
            contributiEccedenzaIVSBrutiCalc =
              (eccedenzaImponibile * aliquotaContributiEccedenza) / 100
            dettaglioCalcoloContributi += `\nEccedenza IVS: (${formatEuro(
              imponibileLordoRegime
            )} - ${formatEuro(
              minimaleRedditoProporzionato
            )}) × ${aliquotaContributiEccedenza}% = ${formatEuro(
              contributiEccedenzaIVSBrutiCalc
            )}`
          } else {
            const eccedenzaPrimaFascia =
              sogliaPrimaFasciaProporzionata - minimaleRedditoProporzionato
            const eccedenzaSecondaFascia =
              imponibileLordoRegime - sogliaPrimaFasciaProporzionata
            const contributiSuPrimaFascia =
              (eccedenzaPrimaFascia * aliquotaContributiEccedenza) / 100
            const contributiSuSecondaFascia =
              (eccedenzaSecondaFascia * (aliquotaContributiEccedenza + 1)) / 100
            contributiEccedenzaIVSBrutiCalc =
              contributiSuPrimaFascia + contributiSuSecondaFascia
            dettaglioCalcoloContributi += `\nEcc. IVS 1ª fascia: ${formatEuro(
              eccedenzaPrimaFascia
            )} × ${aliquotaContributiEccedenza}% = ${formatEuro(
              contributiSuPrimaFascia
            )}`
            dettaglioCalcoloContributi += `\nEcc. IVS 2ª fascia: ${formatEuro(
              eccedenzaSecondaFascia
            )} × ${aliquotaContributiEccedenza + 1}% = ${formatEuro(
              contributiSuSecondaFascia
            )}`
          }
          contributiEccedenzaRegime = applicaRiduzioneContributi(
            contributiEccedenzaIVSBrutiCalc,
            0,
            regime.riduzioneContributi
          )
          if (
            regime.riduzioneContributi !== 'nessuna' &&
            contributiEccedenzaIVSBrutiCalc > 0
          )
            dettaglioCalcoloContributi += ` -> rid. ${
              regime.riduzioneContributi
            }% = ${formatEuro(contributiEccedenzaRegime)}`
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
        dettaglioCalcoloContributi,
        contributiVersatiQuotaParte: 0,
        imponibileNettoRegime: 0,
        imposteRegime: 0
      })
      totaleImponibileLordo += imponibileLordoRegime
      totaleContributiINPSDovuti += contributiRegimeINPS
      totaleFatturato += regime.fatturato
    })
    const imponibileNettoTotalePerImposte = Math.max(
      0,
      totaleImponibileLordo - contributiVersatiInAnnoPerDeducibilita
    )
    let totaleImposte = 0
    dettagliRegimiCalcolati.forEach(regime => {
      const pesoImponibileRegime =
        totaleImponibileLordo > 0
          ? regime.imponibileLordoRegime / totaleImponibileLordo
          : 0
      regime.contributiVersatiQuotaParte =
        contributiVersatiInAnnoPerDeducibilita * pesoImponibileRegime
      regime.imponibileNettoRegime = Math.max(
        0,
        regime.imponibileLordoRegime - regime.contributiVersatiQuotaParte
      )
      regime.imposteRegime =
        (regime.imponibileNettoRegime * Number(regime.aliquota)) / 100
      totaleImposte += regime.imposteRegime
    })
    return {
      dettagliRegimiCalcolati,
      totaleImponibileLordo,
      totaleContributiINPS: totaleContributiINPSDovuti,
      totaleContributiSeparata,
      totaleContributiFissiArtComm,
      totaleContributiEccedenzaArtComm,
      totaleImposte,
      totaleFatturato,
      imponibileNettoTotalePerImposte,
      regimiCorrentePerTipo: regimiPerTipo
    }
  }

  const calcoli = useMemo(() => {
    const contributiDeducibiliAnnoRiferimento =
      contributiVersatiDuranteAnnoRiferimento === null ||
      contributiVersatiDuranteAnnoRiferimento === undefined
        ? 0
        : contributiVersatiDuranteAnnoRiferimento
    const datiAnnoCorrente = calcolaDatiPerAnno(
      regimiCorrente,
      annoRiferimento,
      contributiDeducibiliAnnoRiferimento
    )

    const contributiDeducibiliAnnoPrecedente =
      contributiVersatiDuranteAnnoPrecedente === null ||
      contributiVersatiDuranteAnnoPrecedente === undefined
        ? 0
        : contributiVersatiDuranteAnnoPrecedente
    const datiAnnoPrecedenteConDeducibilita = calcolaDatiPerAnno(
      regimiPrecedente,
      annoRiferimento - 1,
      contributiDeducibiliAnnoPrecedente
    )

    const scadenze = calcolaScadenzeDettagliate(
      datiAnnoCorrente,
      datiAnnoPrecedenteConDeducibilita,
      annoRiferimento
    )

    const saldoImposteDaVersareAnnoCorrente = Math.max(
      0,
      datiAnnoCorrente.totaleImposte -
        (accontiImposteVersatiPerAnnoCorrente || 0)
    )
    const creditoImposteAnnoCorrente = Math.max(
      0,
      (accontiImposteVersatiPerAnnoCorrente || 0) -
        datiAnnoCorrente.totaleImposte
    )

    const saldoContributiGSAnnoCorrente = Math.max(
      0,
      datiAnnoCorrente.totaleContributiSeparata -
        (accontiContributiSeparataVersatiPerAnnoRiferimento || 0)
    )
    const saldoContributiEccArtCommAnnoCorrente = Math.max(
      0,
      datiAnnoCorrente.totaleContributiEccedenzaArtComm -
        (accontiContributiEccedenzaArtCommVersatiPerAnnoRiferimento || 0)
    )

    return {
      ...datiAnnoCorrente,
      datiAnnoPrecedente: datiAnnoPrecedenteConDeducibilita,
      scadenze2024: scadenze.scadenze2024,
      scadenze2025: scadenze.scadenze2025,
      contributiVersatiAnnoImpostaPerDeducibilita:
        contributiDeducibiliAnnoRiferimento,
      accontiImposteEffettivamenteVersatiPerAnnoCorrente:
        accontiImposteVersatiPerAnnoCorrente || 0,
      saldoImposteDaVersareAnnoCorrente,
      creditoImposteAnnoCorrente,
      accontiGSVersatiPerAnnoRif:
        accontiContributiSeparataVersatiPerAnnoRiferimento || 0,
      saldoContributiGSAnnoCorrente,
      accontiEccArtCommVersatiPerAnnoRif:
        accontiContributiEccedenzaArtCommVersatiPerAnnoRiferimento || 0,
      saldoContributiEccArtCommAnnoCorrente
    }
  }, [
    regimiCorrente,
    regimiPrecedente,
    annoRiferimento,
    accontiImposteVersatiPerAnnoCorrente,
    contributiVersatiDuranteAnnoRiferimento,
    accontiContributiSeparataVersatiPerAnnoRiferimento,
    accontiContributiEccedenzaArtCommVersatiPerAnnoRiferimento,
    contributiVersatiDuranteAnnoPrecedente,
    accontiImposteVersatiPerAnnoPrecedente
  ])

  return (
    <div className='max-w-7xl mx-auto p-6 bg-white'>
      <div className='text-center mb-8'>
        <Calculator className='mx-auto mb-4 text-blue-600' size={48} />
        <h1 className='text-3xl font-bold text-gray-800 mb-2'>
          Calcolatore Forfettario Dettagliato
        </h1>
        <p className='text-gray-600'>
          Calcoli precisi e calendario fiscale completo - Anno {annoRiferimento}
        </p>
      </div>

      <div className='grid lg:grid-cols-3 gap-6'>
        {/* Input Panel */}
        <div className='lg:col-span-1'>
          <div className='bg-gray-50 p-6 rounded-lg sticky top-6 space-y-6'>
            {/* Configurazione Base */}
            <div>
              <h2 className='text-xl font-semibold mb-4 text-gray-800'>Configurazione Base</h2>
              <div className='space-y-4'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>Anno di riferimento</label>
                  <select
                    value={annoRiferimento}
                    onChange={e => setAnnoRiferimento(Number(e.target.value))}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500'
                  >
                    <option value={2025}>2025</option>
                    <option value={2024}>2024</option>
                    <option value={2023}>2023</option>
                    <option value={2022}>2022</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Contributi Versati Anno Imposta */}
            <div className='bg-orange-50 p-4 rounded-lg border-2 border-orange-300'>
              <h3 className='text-lg font-semibold text-orange-800 mb-3'>💰 Contributi INPS Versati DURANTE {annoRiferimento}</h3>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>Importo totale versato (€)</label>
                <input
                  type='number'
                  value={contributiVersatiDuranteAnnoRiferimento !== null ? contributiVersatiDuranteAnnoRiferimento : ''}
                  placeholder={`Stima automatica: ${formatEuro(calcoli?.totaleContributiINPS || 0)}`}
                  onChange={e => {
                    const value = e.target.value
                    setContributiVersatiDuranteAnnoRiferimento(value === '' ? null : Number(value))
                  }}
                  className='w-full px-3 py-2 border-2 border-orange-400 rounded-md focus:ring-2 focus:ring-orange-500 text-lg font-medium'
                  min='0'
                  step='0.01'
                />
                <div className='bg-orange-100 p-3 rounded mt-2 text-sm text-orange-800'>
                  <strong>🎯 Contributi deducibili per imposte {annoRiferimento}!</strong><br/>
                  Include: saldi anno precedente, acconti anno corrente, rate fisse durante l'anno<br/>
                  <strong>Valore usato: {formatEuro(calcoli?.contributiVersatiAnnoImpostaPerDeducibilita || 0)}</strong>
                </div>
              </div>
            </div>

            {/* Dati Anno Precedente per Quadratura */}
            <div className='bg-teal-50 p-4 rounded-lg border border-teal-200'>
              <div className='flex items-center mb-3'>
                <History className='mr-2 text-teal-600' size={20} />
                <h3 className='text-lg font-semibold text-teal-800'>Dati Anno {annoRiferimento - 1}</h3>
              </div>
              <p className='text-sm text-teal-700 mb-3'>(Per quadratura e calcolo acconti {annoRiferimento})</p>
              
              <div className='space-y-3'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>
                    Contributi INPS versati DURANTE {annoRiferimento - 1} (€)
                  </label>
                  <input
                    type='number'
                    value={contributiVersatiDuranteAnnoPrecedente !== null ? contributiVersatiDuranteAnnoPrecedente : ''}
                    onChange={e => {
                      const value = e.target.value
                      setContributiVersatiDuranteAnnoPrecedente(value === '' ? null : Number(value))
                    }}
                    className='w-full px-3 py-2 border border-teal-300 rounded-md focus:ring-2 focus:ring-teal-500'
                    min='0'
                    step='0.01'
                    placeholder='Es: 5017'
                  />
                  <p className='text-xs text-teal-600 mt-1'>Per deducibilità imposte {annoRiferimento - 1}</p>
                </div>
              </div>
            </div>

            {/* Regimi Anno Precedente */}
            <div className='bg-blue-50 p-4 rounded-lg border border-blue-200'>
              <div className='flex justify-between items-center mb-3'>
                <h3 className='text-lg font-semibold text-blue-800'>Regimi Anno {annoRiferimento - 1}</h3>
                <button
                  onClick={aggiungiRegimePrecedente}
                  className='text-blue-600 hover:text-blue-800 transition-colors'
                  title='Aggiungi periodo'
                >
                  <Plus size={20} />
                </button>
              </div>
              <p className='text-sm text-blue-700 mb-3'>(Per calcolo acconti {annoRiferimento} e riepilogo {annoRiferimento - 1})</p>

              {regimiPrecedente.map((regime, index) => (
                <div key={regime.id} className='bg-white p-3 rounded border mb-3 last:mb-0'>
                  <div className='flex justify-between items-center mb-2'>
                    <span className='text-sm font-medium text-gray-700'>Periodo {index + 1} (Anno {annoRiferimento - 1})</span>
                    {regimiPrecedente.length > 1 && (
                      <button
                        onClick={() => rimuoviRegimePrecedente(regime.id)}
                        className='text-red-500 hover:text-red-700 transition-colors'
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className='space-y-2'>
                    <div>
                      <label className='block text-xs font-medium text-gray-700 mb-1'>Tipo regime</label>
                      <select
                        value={regime.tipo}
                        onChange={e => aggiornaRegimePrecedente(regime.id, 'tipo', e.target.value)}
                        className='w-full px-2 py-1 text-sm border border-gray-300 rounded-md'
                      >
                        <option value='separata'>Gestione Separata</option>
                        <option value='artigiani'>Artigiani</option>
                        <option value='commercianti'>Commercianti</option>
                      </select>
                    </div>

                    {regime.tipo !== 'separata' && (
                      <div>
                        <label className='block text-xs font-medium text-gray-700 mb-1'>Riduzione contributi</label>
                        <select
                          value={regime.riduzioneContributi}
                          onChange={e => aggiornaRegimePrecedente(regime.id, 'riduzioneContributi', e.target.value)}
                          className='w-full px-2 py-1 text-sm border border-gray-300 rounded-md'
                        >
                          {riduzioniContributiOpzioni.map(op => (
                            <option key={op.value} value={op.value}>
                              {op.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className='grid grid-cols-2 gap-1'>
                      <div>
                        <label className='block text-xs font-medium text-gray-700 mb-1'>Aliquota (%)</label>
                        <select
                          value={regime.aliquota}
                          onChange={e => aggiornaRegimePrecedente(regime.id, 'aliquota', e.target.value)}
                          className='w-full px-1 py-1 text-xs border border-gray-300 rounded-md'
                        >
                          {aliquoteOpzioni.map(op => (
                            <option key={op} value={op}>{op}%</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className='block text-xs font-medium text-gray-700 mb-1'>Coeffic.</label>
                        <select
                          value={regime.coefficiente}
                          onChange={e => aggiornaRegimePrecedente(regime.id, 'coefficiente', e.target.value)}
                          className='w-full px-1 py-1 text-xs border border-gray-300 rounded-md'
                        >
                          {coefficientiOpzioni.map(op => (
                            <option key={op} value={op}>{op}%</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className='block text-xs font-medium text-gray-700 mb-1'>Fatturato periodo (€)</label>
                      <input
                        type='number'
                        value={regime.fatturato}
                        onChange={e => aggiornaRegimePrecedente(regime.id, 'fatturato', e.target.value)}
                        className='w-full px-2 py-1 text-sm border border-gray-300 rounded-md'
                        min='0'
                        step='1000'
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Regimi Anno Corrente */}
            <div className='bg-green-50 p-4 rounded-lg border border-green-200'>
              <div className='flex justify-between items-center mb-3'>
                <h3 className='text-lg font-semibold text-green-800'>Regimi Anno {annoRiferimento}</h3>
                <button
                  onClick={aggiungiRegime}
                  className='text-green-600 hover:text-green-800 transition-colors'
                >
                  <Plus size={20} />
                </button>
              </div>

              {regimiCorrente.map((regime, index) => (
                <div key={regime.id} className='bg-white p-3 rounded border mb-3 last:mb-0'>
                  <div className='flex justify-between items-center mb-2'>
                    <span className='text-sm font-medium text-gray-700'>Periodo {index + 1} (Anno {annoRiferimento})</span>
                    {regimiCorrente.length > 1 && (
                      <button
                        onClick={() => rimuoviRegime(regime.id)}
                        className='text-red-500 hover:text-red-700 transition-colors'
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className='space-y-2'>
                    <div>
                      <label className='block text-xs font-medium text-gray-700 mb-1'>Tipo regime</label>
                      <select
                        value={regime.tipo}
                        onChange={e => aggiornaRegime(regime.id, 'tipo', e.target.value)}
                        className='w-full px-2 py-1 text-sm border border-gray-300 rounded-md'
                      >
                        <option value='separata'>Gestione Separata</option>
                        <option value='artigiani'>Artigiani</option>
                        <option value='commercianti'>Commercianti</option>
                      </select>
                    </div>

                    {regime.tipo !== 'separata' && (
                      <div>
                        <label className='block text-xs font-medium text-gray-700 mb-1'>Riduzione contributi</label>
                        <select
                          value={regime.riduzioneContributi}
                          onChange={e => aggiornaRegime(regime.id, 'riduzioneContributi', e.target.value)}
                          className='w-full px-2 py-1 text-sm border border-gray-300 rounded-md'
                        >
                          {riduzioniContributiOpzioni.map(op => (
                            <option key={op.value} value={op.value}>
                              {op.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className='grid grid-cols-2 gap-1'>
                      <div>
                        <label className='block text-xs font-medium text-gray-700 mb-1'>Aliquota (%)</label>
                        <select
                          value={regime.aliquota}
                          onChange={e => aggiornaRegime(regime.id, 'aliquota', e.target.value)}
                          className='w-full px-1 py-1 text-xs border border-gray-300 rounded-md'
                        >
                          {aliquoteOpzioni.map(op => (
                            <option key={op} value={op}>{op}%</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className='block text-xs font-medium text-gray-700 mb-1'>Coeffic.</label>
                        <select
                          value={regime.coefficiente}
                          onChange={e => aggiornaRegime(regime.id, 'coefficiente', e.target.value)}
                          className='w-full px-1 py-1 text-xs border border-gray-300 rounded-md'
                        >
                          {coefficientiOpzioni.map(op => (
                            <option key={op} value={op}>{op}%</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className='grid grid-cols-4 gap-1'>
                      <div>
                        <label className='block text-xs font-medium text-gray-700 mb-1'>Da mese</label>
                        <select
                          value={regime.meseInizio}
                          onChange={e => aggiornaRegime(regime.id, 'meseInizio', e.target.value)}
                          className='w-full px-1 py-1 text-xs border border-gray-300 rounded-md'
                        >
                          {nomiMesi.map((mese, i) => (
                            <option key={i} value={i + 1}>{mese}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className='block text-xs font-medium text-gray-700 mb-1'>Giorno</label>
                        <input
                          type='number'
                          value={regime.giornoInizio}
                          onChange={e => aggiornaRegime(regime.id, 'giornoInizio', e.target.value)}
                          className='w-full px-1 py-1 text-xs border border-gray-300 rounded-md'
                          min='1'
                          max='31'
                        />
                      </div>
                      <div>
                        <label className='block text-xs font-medium text-gray-700 mb-1'>A mese</label>
                        <select
                          value={regime.meseFine}
                          onChange={e => aggiornaRegime(regime.id, 'meseFine', e.target.value)}
                          className='w-full px-1 py-1 text-xs border border-gray-300 rounded-md'
                        >
                          {nomiMesi.map((mese, i) => (
                            <option key={i} value={i + 1}>{mese}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className='block text-xs font-medium text-gray-700 mb-1'>Giorno</label>
                        <input
                          type='number'
                          value={regime.giornoFine}
                          onChange={e => aggiornaRegime(regime.id, 'giornoFine', e.target.value)}
                          className='w-full px-1 py-1 text-xs border border-gray-300 rounded-md'
                          min='1'
                          max='31'
                        />
                      </div>
                    </div>

                    <div>
                      <label className='block text-xs font-medium text-gray-700 mb-1'>Fatturato periodo (€)</label>
                      <input
                        type='number'
                        value={regime.fatturato}
                        onChange={e => aggiornaRegime(regime.id, 'fatturato', e.target.value)}
                        className='w-full px-2 py-1 text-sm border border-gray-300 rounded-md'
                        min='0'
                        step='1000'
                      />
                    </div>

                    <div className='text-xs text-gray-600 bg-gray-50 p-2 rounded'>
                      <div>{getTipoLabel(regime.tipo)} - {regime.aliquota}%</div>
                      <div>Giorni: {calcolaGiorniPermanenza(regime.meseInizio, regime.giornoInizio, regime.meseFine, regime.giornoFine, annoRiferimento)} ({getMesiInPeriodo(regime.meseInizio, regime.giornoInizio, regime.meseFine, regime.giornoFine)} mesi)</div>
                      <div>Imponibile: {formatEuro((regime.fatturato * regime.coefficiente) / 100)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Opzioni Avanzate */}
            <div>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className='flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors mb-3'
              >
                <Settings size={16} className='mr-1' />
                Opzioni Avanzate (Acconti Versati)
              </button>

              {showAdvanced && (
                <div className='space-y-4 bg-gray-100 p-4 rounded-lg'>
                  <p className='text-sm font-medium text-gray-700 mb-3'>
                    Dati relativi all'anno {annoRiferimento} (versati DURANTE {annoRiferimento}):
                  </p>
                  
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-2'>
                      Acconti Imposte versati PER {annoRiferimento} (€)
                    </label>
                    <input
                      type='number'
                      value={accontiImposteVersatiPerAnnoCorrente !== null ? accontiImposteVersatiPerAnnoCorrente : ''}
                      onChange={e => setAccontiImposteVersatiPerAnnoCorrente(e.target.value === '' ? null : Number(e.target.value))}
                      className='w-full px-3 py-2 border border-gray-300 rounded-md'
                      min='0'
                      step='0.01'
                      placeholder='Es: 2904'
                    />
                    <p className='text-xs text-gray-600 mt-1'>
                      Acconti imposta sostitutiva versati nel {annoRiferimento} (giu/nov), basati sulle imposte {annoRiferimento - 1}
                    </p>
                  </div>

                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-2'>
                      Acconti Contr. G.S. versati PER {annoRiferimento} (€)
                    </label>
                    <input
                      type='number'
                      value={accontiContributiSeparataVersatiPerAnnoRiferimento}
                      onChange={e => setAccontiContributiSeparataVersatiPerAnnoRiferimento(Number(e.target.value))}
                      className='w-full px-3 py-2 border border-gray-300 rounded-md'
                      min='0'
                      step='0.01'
                    />
                    <p className='text-xs text-gray-600 mt-1'>
                      Acconti Gestione Separata versati nel {annoRiferimento} (giu/nov), basati sui contributi G.S. {annoRiferimento - 1}
                    </p>
                  </div>

                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-2'>
                      Acconti Contr. Ecc. Art/Comm versati PER {annoRiferimento} (€)
                    </label>
                    <input
                      type='number'
                      value={accontiContributiEccedenzaArtCommVersatiPerAnnoRiferimento}
                      onChange={e => setAccontiContributiEccedenzaArtCommVersatiPerAnnoRiferimento(Number(e.target.value))}
                      className='w-full px-3 py-2 border border-gray-300 rounded-md'
                      min='0'
                      step='0.01'
                    />
                    <p className='text-xs text-gray-600 mt-1'>
                      Acconti contributi su eccedenza Art/Comm versati nel {annoRiferimento} (giu/nov), basati sull'eccedenza {annoRiferimento - 1}
                    </p>
                  </div>

                  <hr className='my-4' />
                  
                  <p className='text-sm font-medium text-gray-700 mb-3'>
                    Dati relativi all'anno {annoRiferimento - 1} (versati DURANTE {annoRiferimento - 1}):
                  </p>

                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-2'>
                      Acconti Imposte versati PER {annoRiferimento - 1} (€)
                    </label>
                    <input
                      type='number'
                      value={accontiImposteVersatiPerAnnoPrecedente !== null ? accontiImposteVersatiPerAnnoPrecedente : ''}
                      onChange={e => setAccontiImposteVersatiPerAnnoPrecedente(e.target.value === '' ? null : Number(e.target.value))}
                      className='w-full px-3 py-2 border border-gray-300 rounded-md'
                      min='0'
                      step='0.01'
                      placeholder='Es: 0 se primo anno'
                    />
                    <p className='text-xs text-gray-600 mt-1'>
                      Acconti imposta sostitutiva versati nel {annoRiferimento - 1} (giu/nov), basati sulle imposte {annoRiferimento - 2}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className='lg:col-span-2 space-y-6'>
          {/* Riepilogo Anno Precedente */}
          {calcoli.datiAnnoPrecedente && (
            <div className='bg-teal-50 p-6 rounded-lg border border-teal-200'>
              <h2 className='text-xl font-semibold mb-4 text-teal-800 flex items-center'>
                <History className='mr-2' size={24} />
                Riepilogo Anno {annoRiferimento - 1} (Simulazione)
              </h2>

              <div className='grid md:grid-cols-2 gap-6'>
                <div className='space-y-2 text-sm'>
                  <div className='flex justify-between'>
                    <span>Fatturato Totale:</span>
                    <span className='font-medium'>{formatEuro(calcoli.datiAnnoPrecedente.totaleFatturato)}</span>
                  </div>
                  <div className='flex justify-between'>
                    <span>Imponibile Lordo Totale:</span>
                    <span className='font-medium'>{formatEuro(calcoli.datiAnnoPrecedente.totaleImponibileLordo)}</span>
                  </div>
                  <div className='flex justify-between text-orange-600'>
                    <span>Contributi Versati NEL {annoRiferimento - 1} (deducibili):</span>
                    <span className='font-medium'>-{formatEuro(contributiVersatiDuranteAnnoPrecedente)}</span>
                  </div>
                  <div className='flex justify-between'>
                    <span>Imponibile Netto per Imposte:</span>
                    <span className='font-medium'>{formatEuro(calcoli.datiAnnoPrecedente.imponibileNettoTotalePerImposte)}</span>
                  </div>
                  <div className='flex justify-between text-red-600'>
                    <span>Imposta Sostitutiva {annoRiferimento - 1} Dovuta:</span>
                    <span className='font-bold'>{formatEuro(calcoli.datiAnnoPrecedente.totaleImposte)}</span>
                  </div>
                </div>
                
                <div className='space-y-2 text-sm'>
                  <div className='flex justify-between text-red-600'>
                    <span>Contributi INPS {annoRiferimento - 1} Dovuti:</span>
                    <span className='font-medium'>{formatEuro(calcoli.datiAnnoPrecedente.totaleContributiINPS)}</span>
                  </div>
                  <div className='flex justify-between text-gray-600 pl-4'>
                    <span>G.S.:</span>
                    <span>{formatEuro(calcoli.datiAnnoPrecedente.totaleContributiSeparata)}</span>
                  </div>
                  <div className='flex justify-between text-gray-600 pl-4'>
                    <span>Art/Comm Fissi:</span>
                    <span>{formatEuro(calcoli.datiAnnoPrecedente.totaleContributiFissiArtComm)}</span>
                  </div>
                  <div className='flex justify-between text-gray-600 pl-4'>
                    <span>Art/Comm Ecc.:</span>
                    <span>{formatEuro(calcoli.datiAnnoPrecedente.totaleContributiEccedenzaArtComm)}</span>
                  </div>
                </div>
              </div>
              
              <div className='mt-4 text-xs text-teal-700 bg-teal-100 p-3 rounded'>
                * Questo è un riepilogo basato sui dati inseriti per l'anno {annoRiferimento - 1}. L'imposta sostitutiva è calcolata deducendo i contributi che hai indicato come versati DURANTE il {annoRiferimento - 1}.
              </div>
            </div>
          )}

          {/* Dettaglio Calcoli per Regime */}
          <div className='bg-blue-50 p-6 rounded-lg border border-blue-200'>
            <h2 className='text-xl font-semibold mb-4 text-blue-800 flex items-center'>
              <Info className='mr-2' size={24} />
              📊 Dettaglio Calcoli per Regime ({annoRiferimento})
            </h2>

            {calcoli.dettagliRegimiCalcolati.map((regime, index) => (
              <div key={regime.id} className='bg-white p-4 rounded border mb-4'>
                <div className='flex justify-between items-center mb-3'>
                  <h3 className='font-medium text-gray-800'>
                    Periodo {index + 1}: {getTipoLabel(regime.tipo)} - {regime.aliquota}%
                    {regime.riduzioneContributi !== 'nessuna' && ` (Rid. Contr. ${regime.riduzioneContributi}%)`}
                  </h3>
                  <span className='text-sm text-gray-600'>
                    {regime.giorniRegime} giorni ({regime.mesiRegime} mes{regime.mesiRegime > 1 ? 'i' : 'e'})
                  </span>
                </div>

                <div className='grid md:grid-cols-2 gap-4'>
                  <div className='space-y-2 text-sm'>
                    <div className='flex justify-between'>
                      <span>Fatturato:</span>
                      <span className='font-medium'>{formatEuro(regime.fatturato)}</span>
                    </div>
                    <div className='flex justify-between'>
                      <span>Imponibile Lordo ({regime.coefficiente}%):</span>
                      <span className='font-medium'>{formatEuro(regime.imponibileLordoRegime)}</span>
                    </div>
                    <div className='flex justify-between text-red-600'>
                      <span>Contributi INPS Dovuti:</span>
                      <span className='font-medium'>{formatEuro(regime.contributiRegimeINPS)}</span>
                    </div>
                    <div className='flex justify-between text-orange-600'>
                      <span>Quota Contr. Versati {annoRiferimento} (deduc.):</span>
                      <span className='font-medium'>-{formatEuro(regime.contributiVersatiQuotaParte)}</span>
                    </div>
                    <div className='flex justify-between'>
                      <span>Imponibile Netto per Imposte:</span>
                      <span className='font-medium'>{formatEuro(regime.imponibileNettoRegime)}</span>
                    </div>
                    <div className='flex justify-between text-red-600'>
                      <span>Imposta Sostitutiva:</span>
                      <span className='font-bold'>{formatEuro(regime.imposteRegime)}</span>
                    </div>
                  </div>

                  <div className='bg-gray-50 p-3 rounded'>
                    <h4 className='text-sm font-medium text-gray-700 mb-2'>Dettaglio calcolo contributi:</h4>
                    <pre className='text-xs text-gray-600 whitespace-pre-wrap font-mono'>
                      {regime.dettaglioCalcoloContributi}
                    </pre>
                  </div>
                </div>
              </div>
            ))}

            {/* Totali */}
            <div className='bg-blue-100 p-4 rounded border border-blue-300'>
              <h4 className='font-semibold text-blue-800 mb-3'>Riepilogo Totali Anno {annoRiferimento}</h4>
              <div className='grid md:grid-cols-3 gap-4 text-sm'>
                <div className='text-center'>
                  <div className='text-lg font-bold text-blue-700'>{formatEuro(calcoli.totaleFatturato)}</div>
                  <div className='text-blue-600'>Fatturato Totale</div>
                </div>
                <div className='text-center'>
                  <div className='text-lg font-bold text-red-700'>{formatEuro(calcoli.totaleContributiINPS)}</div>
                  <div className='text-red-600'>Contributi INPS Dovuti</div>
                  <div className='text-xs text-gray-600 mt-1'>
                    • G.S.: {formatEuro(calcoli.totaleContributiSeparata)}<br/>
                    • Art/Comm Fissi: {formatEuro(calcoli.totaleContributiFissiArtComm)}<br/>
                    • Art/Comm Ecc.: {formatEuro(calcoli.totaleContributiEccedenzaArtComm)}
                  </div>
                </div>
                <div className='text-center'>
                  <div className='text-lg font-bold text-red-700'>{formatEuro(calcoli.totaleImposte)}</div>
                  <div className='text-red-600'>Imposte Sostit.</div>
                  <div className='text-xs text-gray-600 mt-1'>
                    Su {formatEuro(calcoli.imponibileNettoTotalePerImposte)} imponibile netto
                  </div>
                </div>
              </div>
              
              <div className='mt-4 text-xs text-blue-700 bg-blue-50 p-3 rounded'>
                <strong>ℹ️ Nota:</strong> Il calcolo dei contributi INPS sull'eccedenza del minimale per Artigiani/Commercianti si basa sul reddito d'impresa derivante dall'attività in regime forfettario qui inserita. La normativa prevede il calcolo sulla "totalità dei redditi d'impresa". Eventuali altri redditi d'impresa non forfettari non sono considerati in questo strumento.
              </div>
            </div>
          </div>

          {/* Scadenze Dettagliate */}
          <div className='bg-orange-50 p-6 rounded-lg border border-orange-200'>
            <div className='flex items-center mb-4'>
              <Calendar className='mr-2 text-orange-600' size={24} />
              <h2 className='text-xl font-semibold text-orange-800'>📅 Calendario Fiscale Dettagliato</h2>
            </div>
            
            <p className='text-sm text-gray-600 mb-4'>
              Le date indicate sono quelle nominali. Le scadenze effettive potrebbero variare se cadono in giorni festivi o prefestivi, slittando al primo giorno lavorativo utile.
            </p>

            {/* Scadenze Anno Corrente */}
            <div className='mb-6'>
              <h3 className='text-lg font-semibold text-red-700 mb-3'>
                📅 Scadenze {annoRiferimento} 
                <span className='text-sm font-normal text-gray-600 ml-2'>
                  (Include pagamenti basati su {annoRiferimento - 1})
                </span>
              </h3>
              <div className='space-y-3'>
                {calcoli.scadenze2024
                  .filter(scadenza => scadenza.importo > 0.005)
                  .map((scadenza, index) => (
                    <div key={index} className='bg-red-100 p-4 rounded border border-red-300'>
                      <div className='flex justify-between items-start mb-3'>
                        <div>
                          <div className='font-medium text-red-800 text-lg'>{scadenza.data} ⏰</div>
                          <div className='text-sm text-red-700'>{scadenza.descrizione}</div>
                        </div>
                        <div className='text-xl font-bold text-red-700'>{formatEuro(scadenza.importo)}</div>
                      </div>
                      
                      {scadenza.componenti && (
                        <div className='bg-red-50 p-3 rounded'>
                          <div className='text-sm font-medium text-red-700 mb-2'>Componenti:</div>
                          <div className='space-y-1'>
                            {scadenza.componenti.map((componente, i) => (
                              <div key={i} className='flex justify-between text-sm'>
                                <span className='text-red-600'>• {componente.tipo}:</span>
                                <span className='font-medium'>{formatEuro(componente.importo)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                {calcoli.scadenze2024.filter(s => s.importo > 0.005).length === 0 && (
                  <p className='text-sm text-gray-600'>Nessuna scadenza rilevante calcolata per quest'anno.</p>
                )}
              </div>
            </div>

            {/* Scadenze Anno Successivo */}
            <div>
              <h3 className='text-lg font-semibold text-green-700 mb-3'>
                📅 Scadenze {annoRiferimento + 1} 
                <span className='text-sm font-normal text-gray-600 ml-2'>
                  (Include pagamenti basati su {annoRiferimento})
                </span>
              </h3>
              <div className='space-y-4'>
                {calcoli.scadenze2025
                  .filter(scadenza => scadenza.importo > 0.005)
                  .map((scadenza, index) => (
                    <div key={index} className='bg-white p-4 rounded border'>
                      <div className='flex justify-between items-start mb-3'>
                        <div>
                          <div className='font-medium text-gray-800 text-lg'>{scadenza.data}</div>
                          <div className='text-sm text-gray-600'>{scadenza.descrizione}</div>
                        </div>
                        <div className='text-xl font-bold text-orange-700'>{formatEuro(scadenza.importo)}</div>
                      </div>
                      
                      {scadenza.componenti && (
                        <div className='bg-gray-50 p-3 rounded'>
                          <div className='text-sm font-medium text-gray-700 mb-2'>Componenti:</div>
                          <div className='space-y-1'>
                            {scadenza.componenti.map((componente, i) => (
                              <div key={i} className='flex justify-between text-sm'>
                                <span className='text-gray-600'>• {componente.tipo}:</span>
                                <span className='font-medium'>{formatEuro(componente.importo)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                {calcoli.scadenze2025.filter(s => s.importo > 0.005).length === 0 && (
                  <p className='text-sm text-gray-600'>Nessuna scadenza rilevante calcolata per quest'anno.</p>
                )}
              </div>
            </div>
          </div>

          {/* Saldi e Crediti */}
          <div className='bg-indigo-50 p-6 rounded-lg border border-indigo-200'>
            <h2 className='text-xl font-semibold mb-4 text-indigo-800'>🧾 Saldi e Crediti Anno {annoRiferimento}</h2>
            <p className='text-sm text-gray-600 mb-4'>(Da versare/usare nel {annoRiferimento + 1})</p>

            <div className='grid md:grid-cols-2 gap-6'>
              <div className='space-y-4'>
                {/* Imposte Sostitutive */}
                <div className='bg-white p-4 rounded border'>
                  <h3 className='font-medium text-gray-800 mb-3'>Imposte Sostitutive {annoRiferimento}</h3>
                  <div className='space-y-2 text-sm'>
                    <div className='flex justify-between'>
                      <span>Dovute per {annoRiferimento}:</span>
                      <span className='font-medium'>{formatEuro(calcoli.totaleImposte)}</span>
                    </div>
                    <div className='flex justify-between'>
                      <span>Acconti versati (PER {annoRiferimento}):</span>
                      <span className='font-medium text-green-600'>-{formatEuro(calcoli.accontiImposteEffettivamenteVersatiPerAnnoCorrente)}</span>
                    </div>
                    {calcoli.saldoImposteDaVersareAnnoCorrente > 0.005 && (
                      <>
                        <div className='border-t pt-2'>
                          <div className='flex justify-between font-medium'>
                            <span>Saldo da versare (a Giu {annoRiferimento + 1}):</span>
                            <span className='text-red-600'>{formatEuro(calcoli.saldoImposteDaVersareAnnoCorrente)}</span>
                          </div>
                        </div>
                      </>
                    )}
                    {calcoli.creditoImposteAnnoCorrente > 0.005 && (
                      <>
                        <div className='border-t pt-2'>
                          <div className='flex justify-between font-medium'>
                            <span>Credito Imposte {annoRiferimento}:</span>
                            <span className='text-green-600'>{formatEuro(calcoli.creditoImposteAnnoCorrente)}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Contributi Gestione Separata */}
                <div className='bg-white p-4 rounded border'>
                  <h3 className='font-medium text-gray-800 mb-3'>Contributi Gestione Separata {annoRiferimento}</h3>
                  <div className='space-y-2 text-sm'>
                    <div className='flex justify-between'>
                      <span>Dovuti per {annoRiferimento}:</span>
                      <span className='font-medium'>{formatEuro(calcoli.totaleContributiSeparata)}</span>
                    </div>
                    <div className='flex justify-between'>
                      <span>Acconti versati PER {annoRiferimento}:</span>
                      <span className='font-medium text-green-600'>-{formatEuro(calcoli.accontiGSVersatiPerAnnoRif)}</span>
                    </div>
                    {calcoli.saldoContributiGSAnnoCorrente > 0.005 && (
                      <>
                        <div className='border-t pt-2'>
                          <div className='flex justify-between font-medium'>
                            <span>Saldo da versare (a Giu {annoRiferimento + 1}):</span>
                            <span className='text-red-600'>{formatEuro(calcoli.saldoContributiGSAnnoCorrente)}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Contributi Eccedenza Art/Comm */}
                <div className='bg-white p-4 rounded border'>
                  <h3 className='font-medium text-gray-800 mb-3'>Contributi Eccedenza Art/Comm {annoRiferimento}</h3>
                  <div className='space-y-2 text-sm'>
                    <div className='flex justify-between'>
                      <span>Dovuti per {annoRiferimento}:</span>
                      <span className='font-medium'>{formatEuro(calcoli.totaleContributiEccedenzaArtComm)}</span>
                    </div>
                    <div className='flex justify-between'>
                      <span>Acconti versati PER {annoRiferimento}:</span>
                      <span className='font-medium text-green-600'>-{formatEuro(calcoli.accontiEccArtCommVersatiPerAnnoRif)}</span>
                    </div>
                    {calcoli.saldoContributiEccArtCommAnnoCorrente > 0.005 && (
                      <>
                        <div className='border-t pt-2'>
                          <div className='flex justify-between font-medium'>
                            <span>Saldo da versare (a Giu {annoRiferimento + 1}):</span>
                            <span className='text-red-600'>{formatEuro(calcoli.saldoContributiEccArtCommAnnoCorrente)}</span>
                          </div>
                        </div>
                      </>
                    )}
                    <div className='text-xs text-gray-600 mt-3 bg-gray-50 p-2 rounded'>
                      I contributi fissi Art/Comm ({formatEuro(calcoli.totaleContributiFissiArtComm)}) si pagano in rate trimestrali durante l'anno {annoRiferimento}.
                    </div>
                  </div>
                </div>
              </div>

              <div className='bg-indigo-100 p-4 rounded text-center'>
                <div className='mb-4'>
                  <AlertCircle className='mx-auto mb-2 text-indigo-600' size={48} />
                  <h4 className='text-lg font-semibold text-indigo-800 mb-2'>Informazioni sui Saldi</h4>
                </div>
                <div className='text-sm text-indigo-700 text-left space-y-3'>
                  <p>
                    <strong>📋 I "Saldi" si riferiscono agli importi dovuti per l'anno {annoRiferimento} al netto degli acconti già versati PER tale anno.</strong>
                  </p>
                  <p>
                    Questi saldi sono tipicamente pagati nel Giugno dell'anno {annoRiferimento + 1}.
                  </p>
                  <p>
                    <strong>🔄 Gli "Acconti" per l'anno {annoRiferimento + 1}</strong> (calcolati sulle imposte/contributi dell'anno {annoRiferimento}) verranno anch'essi pagati nel corso del {annoRiferimento + 1} (Giugno e Novembre), solo se l'attività corrispondente è presunta continuare.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ForfettarioCalculator