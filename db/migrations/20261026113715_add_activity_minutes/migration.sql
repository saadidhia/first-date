CREATE TABLE "activity_minutes" (
	"minute" timestamp with time zone PRIMARY KEY
);
--> statement-breakpoint
CREATE INDEX "players_created_idx" ON "players" ("created_at");--> statement-breakpoint
CREATE INDEX "players_last_seen_idx" ON "players" ("last_seen_at");