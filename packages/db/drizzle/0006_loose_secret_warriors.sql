ALTER TABLE "classrooms" ADD COLUMN "paused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "classrooms" ADD COLUMN "daily_resumed_at" timestamp with time zone;