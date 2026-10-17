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