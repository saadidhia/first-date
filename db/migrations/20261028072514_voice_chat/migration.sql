CREATE TABLE "voice_members" (
	"player_id" integer PRIMARY KEY,
	"room_id" integer NOT NULL,
	"muted" boolean DEFAULT false NOT NULL,
	"speaking" boolean DEFAULT false NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_signals" (
	"id" serial PRIMARY KEY,
	"room_id" integer NOT NULL,
	"from_id" integer NOT NULL,
	"to_id" integer NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "ended_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "voice_members_room_idx" ON "voice_members" ("room_id");--> statement-breakpoint
CREATE INDEX "voice_signals_to_idx" ON "voice_signals" ("to_id","id");--> statement-breakpoint
CREATE INDEX "voice_signals_room_idx" ON "voice_signals" ("room_id");--> statement-breakpoint
ALTER TABLE "voice_members" ADD CONSTRAINT "voice_members_player_id_players_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "voice_members" ADD CONSTRAINT "voice_members_room_id_rooms_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "voice_signals" ADD CONSTRAINT "voice_signals_room_id_rooms_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "voice_signals" ADD CONSTRAINT "voice_signals_from_id_players_id_fkey" FOREIGN KEY ("from_id") REFERENCES "players"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "voice_signals" ADD CONSTRAINT "voice_signals_to_id_players_id_fkey" FOREIGN KEY ("to_id") REFERENCES "players"("id") ON DELETE CASCADE;