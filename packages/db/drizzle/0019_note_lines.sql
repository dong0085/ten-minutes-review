-- Typed notes are stored as lines, and points and passages link to the lines they came from, so an edit to a note updates only the points on the lines it changed.
CREATE TABLE "knowledge_point_lines" (
	"knowledge_point_id" uuid NOT NULL,
	"note_line_id" uuid NOT NULL,
	CONSTRAINT "knowledge_point_lines_knowledge_point_id_note_line_id_pk" PRIMARY KEY("knowledge_point_id","note_line_id")
);
--> statement-breakpoint
CREATE TABLE "note_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"upload_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passage_lines" (
	"passage_id" uuid NOT NULL,
	"note_line_id" uuid NOT NULL,
	CONSTRAINT "passage_lines_passage_id_note_line_id_pk" PRIMARY KEY("passage_id","note_line_id")
);
--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "reread_id" uuid;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "reread_status" text;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "pending_text" text;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "reread_error" text;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "reread_result" jsonb;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "reread_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "knowledge_points" ADD COLUMN "superseded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "knowledge_points" ADD COLUMN "user_edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "passages" ADD COLUMN "superseded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "knowledge_point_lines" ADD CONSTRAINT "knowledge_point_lines_knowledge_point_id_knowledge_points_id_fk" FOREIGN KEY ("knowledge_point_id") REFERENCES "public"."knowledge_points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_point_lines" ADD CONSTRAINT "knowledge_point_lines_note_line_id_note_lines_id_fk" FOREIGN KEY ("note_line_id") REFERENCES "public"."note_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_lines" ADD CONSTRAINT "note_lines_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passage_lines" ADD CONSTRAINT "passage_lines_passage_id_passages_id_fk" FOREIGN KEY ("passage_id") REFERENCES "public"."passages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passage_lines" ADD CONSTRAINT "passage_lines_note_line_id_note_lines_id_fk" FOREIGN KEY ("note_line_id") REFERENCES "public"."note_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "knowledge_point_lines_line_idx" ON "knowledge_point_lines" USING btree ("note_line_id");--> statement-breakpoint
CREATE INDEX "note_lines_upload_position_idx" ON "note_lines" USING btree ("upload_id","position");--> statement-breakpoint
CREATE INDEX "passage_lines_line_idx" ON "passage_lines" USING btree ("note_line_id");
