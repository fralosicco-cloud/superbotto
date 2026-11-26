CREATE TABLE "schedine_mensili" (
	"mese" text PRIMARY KEY,
	"superenalotto" jsonb NOT NULL,
	"eurojackpot" jsonb NOT NULL,
	"creata_il" timestamp with time zone DEFAULT now() NOT NULL
);
