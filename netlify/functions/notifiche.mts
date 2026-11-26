import type { Config, Context } from '@netlify/functions'
import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { iscrizioniPush, statoGruppo } from '../../db/schema.js'
import { getChiaviVapid, inviaNotifica, primaVolta } from './lib/push.mts'
import type { StatoGruppo } from './lib/saldi.mts'

const STATO_ID = 'main'
const MAX_STATO_BYTES = 512 * 1024

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } })

async function leggiBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const b = await req.json()
    return b && typeof b === 'object' ? (b as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function euro(n: number): string {
  return n.toFixed(2).replace('.', ',')
}

function accorcia(testo: string, max = 140): string {
  const t = testo.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  return t.length > max ? t.slice(0, max - 1) + '…' : t
}

function chiaveMessaggio(b: { id?: unknown; user?: string; testo?: string; data?: string }): string {
  if (b.id != null && String(b.id).length > 0) return `bacheca:${String(b.id)}`
  const h = createHash('sha256').update(`${b.user}|${b.data}|${b.testo}`).digest('hex').slice(0, 24)
  return `bacheca:h:${h}`
}

// Aggiorna la copia server dello stato del gruppo e notifica le novità (messaggi in bacheca e vincite)
async function sincronizza(body: Record<string, unknown>) {
  const stato = body.stato as StatoGruppo & { pin?: unknown }
  if (!stato || typeof stato !== 'object' || !Array.isArray(stato.users)) {
    return json({ error: 'Stato non valido.' }, 400)
  }
  const versione = typeof body.versione === 'string' ? body.versione : ''

  const { pin: _pin, ...pulito } = stato
  if (JSON.stringify(pulito).length > MAX_STATO_BYTES) return json({ error: 'Stato troppo grande.' }, 413)

  const precedente = (await db.select().from(statoGruppo).where(eq(statoGruppo.id, STATO_ID)).limit(1))[0]
  const primaSincronizzazione = !precedente
  const versionePrecedente = (precedente?.dati as { versione?: string } | undefined)?.versione || ''

  // Non sovrascrive la copia con uno stato più vecchio (es. un dispositivo rimasto indietro)
  if (!versione || !versionePrecedente || versione >= versionePrecedente) {
    await db
      .insert(statoGruppo)
      .values({ id: STATO_ID, dati: { versione, stato: pulito } })
      .onConflictDoUpdate({ target: statoGruppo.id, set: { dati: { versione, stato: pulito }, aggiornatoIl: new Date() } })
  }

  let notificate = 0

  // Nuovi messaggi in bacheca (i più recenti sono in testa)
  const messaggi = (Array.isArray(pulito.bacheca) ? pulito.bacheca : []).slice(0, 20)
  for (const b of messaggi.slice().reverse()) {
    if (!b || typeof b.testo !== 'string') continue
    const nuovo = await primaVolta(chiaveMessaggio(b))
    if (!nuovo || primaSincronizzazione) continue
    notificate += await inviaNotifica(
      { tutti: true, escludi: b.user },
      {
        titolo: `💬 ${b.user || 'Qualcuno'} ha scritto in bacheca`,
        testo: accorcia(b.testo) || 'Nuovo messaggio nel gruppo',
        pagina: 'bacheca',
        tag: 'bacheca',
      },
    )
  }

  // Nuove vincite registrate in cassa
  const numUtenti = pulito.users!.length || 1
  for (const v of Array.isArray(pulito.estrazioniManual) ? pulito.estrazioniManual : []) {
    const importo = parseFloat(String(v && v.vincita)) || 0
    if (importo <= 0 || v.id == null) continue
    const nuovo = await primaVolta(`vincita:${String(v.id)}`)
    if (!nuovo || primaSincronizzazione) continue
    notificate += await inviaNotifica(
      { tutti: true },
      {
        titolo: '🏆 Abbiamo vinto!',
        testo: `Vincita di € ${euro(importo)}${v.data ? ` sull'estrazione del ${v.data}` : ''}. Quota a testa: € ${euro(importo / numUtenti)} 🎉`,
        pagina: 'schedina',
        tag: `vincita-${String(v.id)}`,
      },
    )
  }

  return json({ ok: true, notificate })
}

export default async (req: Request, context: Context) => {
  const azione = context.params.azione

  if (azione === 'chiave' && req.method === 'GET') {
    const { pubblica } = await getChiaviVapid()
    return json({ chiave: pubblica })
  }

  if (azione === 'iscrizione' && req.method === 'POST') {
    const body = await leggiBody(req)
    const nome = typeof body?.nome === 'string' ? body.nome.trim().slice(0, 60) : ''
    const sub = body?.iscrizione as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | undefined
    const endpoint = typeof sub?.endpoint === 'string' ? sub.endpoint : ''
    const p256dh = typeof sub?.keys?.p256dh === 'string' ? sub.keys.p256dh : ''
    const auth = typeof sub?.keys?.auth === 'string' ? sub.keys.auth : ''
    if (!nome || !/^https:\/\//.test(endpoint) || !p256dh || !auth) {
      return json({ error: 'Iscrizione non valida.' }, 400)
    }
    await db
      .insert(iscrizioniPush)
      .values({ endpoint, nome, p256dh, auth })
      .onConflictDoUpdate({ target: iscrizioniPush.endpoint, set: { nome, p256dh, auth, aggiornataIl: new Date() } })
    return json({ ok: true })
  }

  if (azione === 'iscrizione' && req.method === 'DELETE') {
    const body = await leggiBody(req)
    const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : ''
    if (endpoint) await db.delete(iscrizioniPush).where(eq(iscrizioniPush.endpoint, endpoint))
    return json({ ok: true })
  }

  if (azione === 'prova' && req.method === 'POST') {
    const body = await leggiBody(req)
    const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : ''
    if (!endpoint) return json({ error: 'Endpoint mancante.' }, 400)
    const inviate = await inviaNotifica(
      { endpoint },
      { titolo: '🍀 Notifiche attive!', testo: 'Riceverai gli avvisi di SuperBotto su questo dispositivo.', tag: 'prova' },
    )
    return json({ ok: inviate > 0 })
  }

  if (azione === 'sincronizza' && req.method === 'POST') {
    const body = await leggiBody(req)
    if (!body) return json({ error: 'Richiesta non valida.' }, 400)
    return sincronizza(body)
  }

  return new Response('Not found', { status: 404 })
}

export const config: Config = {
  path: '/api/notifiche/:azione',
  method: ['GET', 'POST', 'DELETE'],
}
