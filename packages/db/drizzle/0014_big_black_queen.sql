CREATE TABLE "mistake_practice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"classroom_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"response" jsonb,
	"is_correct" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mistake_practice" ADD CONSTRAINT "mistake_practice_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistake_practice" ADD CONSTRAINT "mistake_practice_classroom_id_classrooms_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistake_practice" ADD CONSTRAINT "mistake_practice_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mistake_practice_classroom_user_idx" ON "mistake_practice" USING btree ("classroom_id","user_id","created_at");