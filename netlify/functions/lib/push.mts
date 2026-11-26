import * as webpush from 'web-push'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { chiaviVapid, iscrizioniPush, notificheInviate } from '../../../db/schema.js'

const VAPID_ID = 'main'
const VAPID_SUBJECT = 'mailto:notifiche@superbotto.app'

export interface Notifica {
  titolo: string
  testo: string
  // Pagina dell'app da aprire al tocco della notifica
  pagina?: 'bacheca' | 'cassa' | 'schedina' | 'versamenti'
  // Notifiche con lo stesso tag si sostituiscono invece di accumularsi
  tag?: string
}

let chiaviInCache: { pubblica: string; privata: string } | null = null

// Restituisce le chiavi VAPID, generandole e salvandole al primo utilizzo.
export async function getChiaviVapid(): Promise<{ pubblica: string; privata: string }> {
  if (chiaviInCache) return chiaviInCache

  let righe = await db.select().from(chiaviVapid).where(eq(chiaviVapid.id, VAPID_ID)).limit(1)
  if (righe.length === 0) {
    const nuove = webpush.generateVAPIDKeys()
    await db
      .insert(chiaviVapid)
      .values({ id: VAPID_ID, pubblica: nuove.publicKey, privata: nuove.privateKey })
      .onConflictDoNothing()
    righe = await db.select().from(chiaviVapid).where(eq(chiaviVapid.id, VAPID_ID)).limit(1)
  }

  chiaviInCache = { pubblica: righe[0].pubblica, privata: righe[0].privata }
  return chiaviInCache
}

// Registra una notifica come inviata. Restituisce true solo la prima volta per una data chiave.
export async function primaVolta(chiave: string): Promise<boolean> {
  const inserite = await db
    .insert(notificheInviate)
    .values({ chiave })
    .onConflictDoNothing()
    .returning({ chiave: notificheInviate.chiave })
  return inserite.length > 0
}

type Destinatari = { tutti: true; escludi?: string } | { nomi: string[] } | { endpoint: string }

// Invia una notifica push ai dispositivi iscritti. Rimuove le iscrizioni scadute.
export async function inviaNotifica(dest: Destinatari, notifica: Notifica): Promise<number> {
  let iscrizioni
  if ('endpoint' in dest) {
    iscrizioni = await db.select().from(iscrizioniPush).where(eq(iscrizioniPush.endpoint, dest.endpoint))
  } else if ('nomi' in dest) {
    if (dest.nomi.length === 0) return 0
    iscrizioni = await db.select().from(iscrizioniPush).where(inArray(iscrizioniPush.nome, dest.nomi))
  } else {
    iscrizioni = (await db.select().from(iscrizioniPush)).filter((i) => !dest.escludi || i.nome !== dest.escludi)
  }
  if (iscrizioni.length === 0) return 0

  const chiavi = await getChiaviVapid()
  const payload = JSON.stringify(notifica)
  const scadute: string[] = []
  let inviate = 0

  await Promise.all(
    iscrizioni.map(async (i) => {
      try {
        await webpush.sendNotification(
          { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
          payload,
          {
            vapidDetails: { subject: VAPID_SUBJECT, publicKey: chiavi.pubblica, privateKey: chiavi.privata },
            TTL: 60 * 60 * 24,
            urgency: 'normal',
          },
        )
        inviate++
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) scadute.push(i.endpoint)
        else console.error('[notifiche] Invio non riuscito:', status ?? err)
      }
    }),
  )

  if (scadute.length > 0) {
    await db.delete(iscrizioniPush).where(inArray(iscrizioniPush.endpoint, scadute))
  }
  return inviate
}
