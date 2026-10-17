import type { Config } from '@netlify/functions'
import { createHash } from 'node:crypto'

// Verifica l'accesso dei partecipanti: nome + password condivisa del gruppo.
// Nel codice è presente solo l'hash SHA-256 della password, mai la password in chiaro.
const HASH_PASSWORD = 'd21d00c19e67d9584f370fa517aa1132c69355faf59325b6db4f488dadf81cb2'

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let body: { nome?: unknown; password?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Richiesta non valida.' }, { status: 400 })
  }

  const nome = typeof body.nome === 'string' ? body.nome.trim() : ''
  if (!nome) {
    return Response.json({ error: 'Seleziona il tuo nome per entrare.' }, { status: 400 })
  }

  if (typeof body.password !== 'string' || body.password.length === 0 ||
      createHash('sha256').update(body.password).digest('hex') !== HASH_PASSWORD) {
    return Response.json({ error: 'Password errata.' }, { status: 401 })
  }

  return Response.json({ ok: true, nome })
}

export const config: Config = {
  path: '/api/login',
  method: ['POST'],
}