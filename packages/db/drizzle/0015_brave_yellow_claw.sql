CREATE TABLE "tutor_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"classroom_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"level" integer DEFAULT 0 NOT NULL,
	"response" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"content" jsonb,
	"prompt_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "tutor_requests" ADD CONSTRAINT "tutor_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_requests" ADD CONSTRAINT "tutor_requests_classroom_id_classrooms_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_requests" ADD CONSTRAINT "tutor_requests_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tutor_requests_classroom_user_idx" ON "tutor_requests" USING btree ("classroom_id","user_id","created_at");