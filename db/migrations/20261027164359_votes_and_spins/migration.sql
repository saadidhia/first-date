ALTER TABLE "answers" ADD COLUMN "vote_for" integer;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "spins" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_vote_for_players_id_fkey" FOREIGN KEY ("vote_for") REFERENCES "players"("id") ON DELETE CASCADE;