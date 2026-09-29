ALTER TABLE "users" ADD COLUMN "onboarded_at" timestamp with time zone;--> statement-breakpoint
-- Onboarding is for new users; everyone who signed up before it counts as onboarded.
UPDATE "users" SET "onboarded_at" = now();
