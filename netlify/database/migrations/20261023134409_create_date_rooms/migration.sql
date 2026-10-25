CREATE TABLE "answers" (
	"id" serial PRIMARY KEY,
	"room_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"question_index" integer NOT NULL,
	"option_index" integer,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY,
	"room_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" serial PRIMARY KEY,
	"room_id" integer NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"token" text NOT NULL UNIQUE,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" serial PRIMARY KEY,
	"code" text NOT NULL UNIQUE,
	"phase" text DEFAULT 'waiting' NOT NULL,
	"current_index" integer DEFAULT 0 NOT NULL,
	"phase_ends_at" timestamp with time zone,
	"question_ids" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "answers_player_question_idx" ON "answers" ("player_id","question_index");--> statement-breakpoint
CREATE INDEX "events_room_idx" ON "events" ("room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "players_room_role_idx" ON "players" ("room_id","role");--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_room_id_rooms_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_player_id_players_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_room_id_rooms_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_player_id_players_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_room_id_rooms_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE;