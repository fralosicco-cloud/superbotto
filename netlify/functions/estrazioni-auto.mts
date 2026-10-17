import type { Config } from '@netlify/functions'
import { eq, desc } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { estrazioni, impostazioni } from '../../db/schema.js'
import { romeNow, shiftISO } from './lib/tempo.mts'

const IMPOSTAZIONI_ID = 'giocate-automatiche'
// Ora limite italiana: fermare/riprendere prima delle 20:30 (quando l'estrazione è giocata)
// esclude il conteggio della giocata di quella sera.
const ORA_LIMITE = '20:30'

type Periodo = { da: string | null; al: string | null }

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

async function leggiStato() {
  const imp = await getImpostazioni()
  const righe = await db
    .select({
      data: estrazioni.data,
      numeri: estrazioni.numeri,
      superstar: estrazioni.superstar,
      jolly: estrazioni.jolly,
      fonte: estrazioni.fonte,
    })
    .from(estrazioni)
    .orderBy(desc(estrazioni.id))
    .limit(120)

  return {
    attiva: imp.attiva,
    periodi: imp.periodi,
    aggiornataIl: imp.aggiornataIl,
    estrazioni: righe,
  }
}

export default async (req: Request) => {
  if (req.method === 'GET') {
    return Response.json(await leggiStato(), { headers: { 'Cache-Control': 'no-store' } })
  }

  if (req.method === 'POST') {
    let body: { attiva?: unknown }
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: 'Corpo della richiesta non valido.' }, { status: 400 })
    }
    if (typeof body.attiva !== 'boolean') {
      return Response.json({ error: "Campo 'attiva' booleano richiesto." }, { status: 400 })
    }

    const imp = await getImpostazioni()
    if (body.attiva !== imp.attiva) {
      const { iso, hhmm } = romeNow()
      const oggi = iso
      const ieri = shiftISO(iso, -1)
      const domani = shiftISO(iso, 1)
      const dopoLimite = hhmm >= ORA_LIMITE

      // Chiude l'eventuale periodo ancora in corso
      const periodi: Periodo[] = imp.periodi.map((p) => (p.al ? p : { da: p.da, al: dopoLimite ? oggi : ieri }))

      if (body.attiva) {
        periodi.push({ da: dopoLimite ? domani : oggi, al: null })
      }

      await db
        .update(impostazioni)
        .set({ attiva: body.attiva, periodi, aggiornataIl: new Date() })
        .where(eq(impostazioni.id, IMPOSTAZIONI_ID))
    }

    return Response.json(await leggiStato(), { headers: { 'Cache-Control': 'no-store' } })
  }

  return new Response('Method not allowed', { status: 405 })
}

export const config: Config = {
  path: '/api/estrazioni-auto',
  method: ['GET', 'POST'],
}