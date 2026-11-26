CREATE TABLE "chiavi_vapid" (
	"id" text PRIMARY KEY,
	"pubblica" text NOT NULL,
	"privata" text NOT NULL,
	"creata_il" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iscrizioni_push" (
	"endpoint" text PRIMARY KEY,
	"nome" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"creata_il" timestamp with time zone DEFAULT now() NOT NULL,
	"aggiornata_il" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifiche_inviate" (
	"chiave" text PRIMARY KEY,
	"creata_il" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stato_gruppo" (
	"id" text PRIMARY KEY,
	"dati" jsonb NOT NULL,
	"aggiornato_il" timestamp with time zone DEFAULT now() NOT NULL
);
