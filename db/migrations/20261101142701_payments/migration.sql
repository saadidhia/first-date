CREATE TABLE "payments" (
	"id" serial PRIMARY KEY,
	"account_id" integer NOT NULL,
	"provider" text DEFAULT 'flouci' NOT NULL,
	"tracking_id" text NOT NULL UNIQUE,
	"provider_ref" text,
	"pack_id" text NOT NULL,
	"coins" integer NOT NULL,
	"amount_millimes" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "payments_account_idx" ON "payments" ("account_id","id");--> statement-breakpoint
CREATE INDEX "payments_provider_ref_idx" ON "payments" ("provider_ref");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE;