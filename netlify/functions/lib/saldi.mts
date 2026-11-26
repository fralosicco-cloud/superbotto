import { romeNow } from './tempo.mts'

// Replica lato server del calcolo dei saldi dell'app (vedi calculateMetrics in index.html)
const COSTO_SCHEDINA = 1.5
const GIORNI_ESTRAZIONE = [2, 4, 5, 6] // Martedì, Giovedì, Venerdì, Sabato

export interface StatoGruppo {
  users?: string[]
  startDate?: string
  versamenti?: { user?: string; importo?: unknown }[]
  estrazioniManual?: { id?: unknown; data?: string; vincita?: unknown }[]
  schedinaStoria?: { da: string | null; num?: number }[]
  bacheca?: { id?: unknown; user?: string; testo?: string; data?: string }[]
}

type Periodo = { da: string | null; al: string | null }

function itToISO(data: string): string | null {
  const m = String(data || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

function numSchedineA(stato: StatoGruppo, iso: string): number {
  const storia = Array.isArray(stato.schedinaStoria) ? stato.schedinaStoria : []
  let cfg = storia.find((e) => e.da === null) || storia[0]
  for (const e of storia) if (e.da !== null && e.da <= iso) cfg = e
  return (cfg && cfg.num) || 2
}

export function calcolaSaldi(stato: StatoGruppo, periodi: Periodo[]): { user: string; saldo: number }[] {
  const users = Array.isArray(stato.users) ? stato.users : []
  const numUsers = users.length || 1
  const startISO = stato.startDate || '2026-10-01'
  const oggiISO = romeNow().iso

  const segmenti: { da: string; al: string }[] = []
  const fonte = periodi.length > 0 ? periodi : [{ da: null, al: null }]
  for (const p of fonte) {
    const da = p.da || startISO
    const al = p.al || oggiISO
    if (da <= al) segmenti.push({ da, al })
  }

  const visti = new Set<string>()
  let totalSpesi = 0
  let numEstrazioni = 0
  for (const seg of segmenti) {
    const t = new Date(`${seg.da}T12:00:00Z`)
    const end = new Date(`${seg.al}T12:00:00Z`)
    while (t <= end) {
      const iso = t.toISOString().slice(0, 10)
      if (GIORNI_ESTRAZIONE.includes(t.getUTCDay()) && !visti.has(iso)) {
        visti.add(iso)
        numEstrazioni++
        totalSpesi += numSchedineA(stato, iso) * COSTO_SCHEDINA
      }
      t.setUTCDate(t.getUTCDate() + 1)
    }
  }

  // Le vincite vengono conteggiate solo se esiste almeno un'estrazione giocata (come nell'app)
  const totalVincite =
    numEstrazioni === 0
      ? 0
      : (stato.estrazioniManual || []).reduce((s, v) => {
          const imp = parseFloat(String(v && v.vincita)) || 0
          return imp > 0 ? s + imp : s
        }, 0)

  const costoPerUtente = totalSpesi / numUsers
  const vincitaPerUtente = totalVincite / numUsers
  const versamenti = Array.isArray(stato.versamenti) ? stato.versamenti : []

  return users.map((user) => {
    const versato = versamenti
      .filter((v) => v.user === user)
      .reduce((s, v) => s + (parseFloat(String(v.importo)) || 0), 0)
    return { user, saldo: Math.round((versato - costoPerUtente + vincitaPerUtente) * 100) / 100 }
  })
}

export { itToISO }
