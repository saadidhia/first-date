ALTER TABLE "secret_messages" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "secret_messages" ALTER COLUMN "instagram" DROP NOT NULL;