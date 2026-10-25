CREATE TABLE "secret_messages" (
	"id" serial PRIMARY KEY,
	"instagram" text NOT NULL,
	"body" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "secret_messages_created_idx" ON "secret_messages" ("created_at");