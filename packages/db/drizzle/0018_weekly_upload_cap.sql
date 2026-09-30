-- Free notes uploads are now counted per week. Admin overrides keep their number as a weekly limit.
ALTER TABLE "user_limit_overrides" RENAME COLUMN "notes_uploads_per_month" TO "notes_uploads_per_week";
