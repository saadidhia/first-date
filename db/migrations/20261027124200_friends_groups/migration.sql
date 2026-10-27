DROP INDEX "players_room_role_idx";--> statement-breakpoint
CREATE INDEX "players_room_idx" ON "players" ("room_id");