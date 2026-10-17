import type { Config } from '@netlify/functions'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { estrazioni, impostazioni } from '../../db/schema.js'
import { fetchEstrazioni } from './lib/scraping.mts'
import { romeNow, itToISO } from './lib/tempo.mts'

const IMPOSTAZIONI_ID = 'giocate-automatiche'

type Impostazioni = typeof impostazioni.$inferSelect

async function getImpostazioni(): Promise<Impostazioni> {
  const rows = await db.select().from(impostazioni).where(eq(impostazioni.id, IMPOSTAZIONI_ID)).limit(1)
  if (rows.length > 0) return rows[0]

  await db
    .insert(impostazioni)
    .values({ id: IMPOSTAZIONI_ID, attiva: true, periodi: [{ da: null, al: null }] })
    .onConflictDoNothing()

  const ricreate = await db.select().from(impostazioni).where(eq(impostazioni.id, IMPOSTAZIONI_ID)).limit(1)
  return ricreate[0]
}

export default async (req: Request) => {
  const imp = await getImpostazioni()

  if (!imp.attiva) {
    console.log('[giocate-automatiche] Giocate automatiche fermate: nessun aggiornamento eseguito.')
    return
  }

  const risultati = await fetchEstrazioni()
  if (risultati.length === 0) {
    console.log('[giocate-automatiche] Nessun risultato disponibile dal sito delle estrazioni.')
    return
  }

  const esistenti = new Set(
    (await db.select({ data: estrazioni.data }).from(estrazioni)).map((r) => r.data),
  )
  const oggi = romeNow().iso

  let inserite = 0
  for (const e of risultati) {
    if (esistenti.has(e.data)) continue
    const iso = itToISO(e.data)
    if (!iso || iso > oggi) continue
    await db
      .insert(estrazioni)
      .values({ data: e.data, numeri: e.numeri, superstar: e.superstar, jolly: e.jolly, fonte: 'automatica' })
      .onConflictDoNothing()
    inserite++
  }

  console.log(
    `[giocate-automatiche] Aggiornamento completato: ${inserite} nuovi risultati registrati. Ultima estrazione: ${risultati[0]?.data ?? '-'}`,
  )
}

// Esegue alle 21:00 circa (ora italiana) di martedì, giovedì, venerdì e sabato.
// Il cron è in UTC: 19:05/20:05/21:05 UTC coprono le 21:00 italiane sia con CET (UTC+1) che con CEST (UTC+2),
// con tentativi aggiuntivi nel caso il sito delle estrazioni pubblichi i risultati in ritardo.
export const config: Config = {
  schedule: '5 19,20,21 * * 2,4,5,6',
}