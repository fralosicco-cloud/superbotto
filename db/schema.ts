import { pgTable, serial, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";

// Risultati delle estrazioni SuperEnalotto registrate automaticamente
export const estrazioni = pgTable("estrazioni", {
  id: serial().primaryKey(),
  // Data dell'estrazione in formato italiano 'dd/mm/yyyy' (Europe/Rome)
  data: text().notNull().unique(),
  // Sei numeri estratti
  numeri: jsonb().notNull().$type<number[]>(),
  superstar: integer("superstar"),
  jolly: integer("jolly"),
  // 'automatica' (funzione schedulata) oppure 'manuale' (verifica manuale dall'app)
  fonte: text().notNull().default("automatica"),
  creataIl: timestamp("creata_il", { withTimezone: true }).notNull().defaultNow(),
});

// Impostazioni delle giocate automatiche (unica riga id = 'giocate-automatiche')
export const impostazioni = pgTable("impostazioni", {
  id: text().primaryKey(),
  // Se false, la funzione schedulata non registra più estrazioni e le giocate si fermano
  attiva: boolean("attiva").notNull().default(true),
  // Periodi di gioco: [{ da: 'yyyy-mm-dd'|null, al: 'yyyy-mm-dd'|null }]
  // da=null => dall'inizio (startDate dell'app), al=null => periodo in corso
  periodi: jsonb().notNull().$type<{ da: string | null; al: string | null }[]>(),
  aggiornataIl: timestamp("aggiornata_il", { withTimezone: true }).notNull().defaultNow(),
});

// Iscrizioni alle notifiche push (una riga per dispositivo/browser)
export const iscrizioniPush = pgTable("iscrizioni_push", {
  endpoint: text().primaryKey(),
  // Nome del partecipante che ha attivato le notifiche su questo dispositivo
  nome: text().notNull(),
  p256dh: text().notNull(),
  auth: text().notNull(),
  creataIl: timestamp("creata_il", { withTimezone: true }).notNull().defaultNow(),
  aggiornataIl: timestamp("aggiornata_il", { withTimezone: true }).notNull().defaultNow(),
});

// Chiavi VAPID per firmare le notifiche push (generate automaticamente al primo utilizzo, riga id = 'main')
export const chiaviVapid = pgTable("chiavi_vapid", {
  id: text().primaryKey(),
  pubblica: text().notNull(),
  privata: text().notNull(),
  creataIl: timestamp("creata_il", { withTimezone: true }).notNull().defaultNow(),
});

// Copia dello stato del gruppo (bacheca, versamenti, vincite, schedine) usata dal server
// per calcolare i saldi e capire quali novità notificare (riga id = 'main')
export const statoGruppo = pgTable("stato_gruppo", {
  id: text().primaryKey(),
  dati: jsonb().notNull(),
  aggiornatoIl: timestamp("aggiornato_il", { withTimezone: true }).notNull().defaultNow(),
});

// Registro delle notifiche già inviate, per non inviarle due volte
export const notificheInviate = pgTable("notifiche_inviate", {
  chiave: text().primaryKey(),
  creataIl: timestamp("creata_il", { withTimezone: true }).notNull().defaultNow(),
});

// Schedine del mese (dal 1° dicembre 2026): una SuperEnalotto e una EuroJackpot, con numeri casuali
// generati il primo di ogni mese. mese = 'yyyy-mm'
export const schedineMensili = pgTable("schedine_mensili", {
  mese: text().primaryKey(),
  // { numeri: number[6] (1-90), superstar: number (1-90) }
  superenalotto: jsonb().notNull().$type<{ numeri: number[]; superstar: number }>(),
  // { numeri: number[5] (1-50), euronumeri: number[2] (1-12) }
  eurojackpot: jsonb().notNull().$type<{ numeri: number[]; euronumeri: number[] }>(),
  creataIl: timestamp("creata_il", { withTimezone: true }).notNull().defaultNow(),
});
