CREATE TABLE "reactions" (
	"id" serial PRIMARY KEY,
	"room_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"question_index" integer NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "reactions_player_question_idx" ON "reactions" ("player_id","question_index");--> statement-breakpoint
CREATE INDEX "reactions_room_idx" ON "reactions" ("room_id");--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_room_id_rooms_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_player_id_players_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE;
