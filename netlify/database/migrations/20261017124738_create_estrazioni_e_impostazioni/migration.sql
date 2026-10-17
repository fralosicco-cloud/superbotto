CREATE TABLE "estrazioni" (
	"id" serial PRIMARY KEY,
	"data" text NOT NULL UNIQUE,
	"numeri" jsonb NOT NULL,
	"superstar" integer,
	"jolly" integer,
	"fonte" text DEFAULT 'automatica' NOT NULL,
	"creata_il" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "impostazioni" (
	"id" text PRIMARY KEY,
	"attiva" boolean DEFAULT true NOT NULL,
	"periodi" jsonb NOT NULL,
	"aggiornata_il" timestamp with time zone DEFAULT now() NOT NULL
);
