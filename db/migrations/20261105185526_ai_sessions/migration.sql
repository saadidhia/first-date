CREATE TABLE "ai_sessions" (
	"id" serial PRIMARY KEY,
	"token" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"gender" text,
	"question_ids" jsonb NOT NULL,
	"answers" jsonb DEFAULT '{}' NOT NULL,
	"open_id" text,
	"open_answer" text,
	"source" text,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ai_sessions_created_idx" ON "ai_sessions" ("created_at");