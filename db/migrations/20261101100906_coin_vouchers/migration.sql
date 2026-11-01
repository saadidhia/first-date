CREATE TABLE "coin_vouchers" (
	"id" serial PRIMARY KEY,
	"code" text NOT NULL UNIQUE,
	"coins" integer NOT NULL,
	"redeemed_by" integer,
	"redeemed_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "coin_vouchers_redeemed_idx" ON "coin_vouchers" ("redeemed_by");--> statement-breakpoint
ALTER TABLE "coin_vouchers" ADD CONSTRAINT "coin_vouchers_redeemed_by_accounts_id_fkey" FOREIGN KEY ("redeemed_by") REFERENCES "accounts"("id") ON DELETE SET NULL;