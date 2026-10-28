CREATE TABLE "voice_listeners" (
	"id" serial PRIMARY KEY,
	"room_id" integer NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "voice_signals" DROP CONSTRAINT "voice_signals_from_id_players_id_fkey";--> statement-breakpoint
ALTER TABLE "voice_signals" DROP CONSTRAINT "voice_signals_to_id_players_id_fkey";--> statement-breakpoint
CREATE INDEX "voice_listeners_room_idx" ON "voice_listeners" ("room_id");--> statement-breakpoint
ALTER TABLE "voice_listeners" ADD CONSTRAINT "voice_listeners_room_id_rooms_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE;