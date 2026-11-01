CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY,
	"username" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"birthday" text NOT NULL,
	"gender" text,
	"password_hash" text NOT NULL,
	"password_salt" text NOT NULL,
	"coins" integer DEFAULT 3000 NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY,
	"from_id" integer NOT NULL,
	"to_id" integer NOT NULL,
	"body" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"id" serial PRIMARY KEY,
	"account_id" integer NOT NULL,
	"friend_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_invites" (
	"id" serial PRIMARY KEY,
	"room_id" integer NOT NULL,
	"from_id" integer NOT NULL,
	"to_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" serial PRIMARY KEY,
	"room_id" integer NOT NULL UNIQUE,
	"starter_id" integer NOT NULL,
	"other_id" integer NOT NULL,
	"score_pct" integer NOT NULL,
	"matched" boolean NOT NULL,
	"coins_charged" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_tx" (
	"id" serial PRIMARY KEY,
	"account_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"room_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "account_id" integer;--> statement-breakpoint
CREATE INDEX "accounts_last_seen_idx" ON "accounts" ("last_seen_at");--> statement-breakpoint
CREATE INDEX "chat_messages_from_to_idx" ON "chat_messages" ("from_id","to_id","id");--> statement-breakpoint
CREATE INDEX "chat_messages_to_idx" ON "chat_messages" ("to_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "friendship_pair_idx" ON "friendships" ("account_id","friend_id");--> statement-breakpoint
CREATE INDEX "match_invites_to_idx" ON "match_invites" ("to_id","status");--> statement-breakpoint
CREATE INDEX "match_invites_from_idx" ON "match_invites" ("from_id","status");--> statement-breakpoint
CREATE INDEX "wallet_tx_account_idx" ON "wallet_tx" ("account_id","id");--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_from_id_accounts_id_fkey" FOREIGN KEY ("from_id") REFERENCES "accounts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_to_id_accounts_id_fkey" FOREIGN KEY ("to_id") REFERENCES "accounts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_friend_id_accounts_id_fkey" FOREIGN KEY ("friend_id") REFERENCES "accounts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "match_invites" ADD CONSTRAINT "match_invites_room_id_rooms_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "match_invites" ADD CONSTRAINT "match_invites_from_id_accounts_id_fkey" FOREIGN KEY ("from_id") REFERENCES "accounts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "match_invites" ADD CONSTRAINT "match_invites_to_id_accounts_id_fkey" FOREIGN KEY ("to_id") REFERENCES "accounts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_room_id_rooms_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_starter_id_accounts_id_fkey" FOREIGN KEY ("starter_id") REFERENCES "accounts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_other_id_accounts_id_fkey" FOREIGN KEY ("other_id") REFERENCES "accounts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "wallet_tx" ADD CONSTRAINT "wallet_tx_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "wallet_tx" ADD CONSTRAINT "wallet_tx_room_id_rooms_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL;