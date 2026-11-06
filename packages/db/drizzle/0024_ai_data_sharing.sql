CREATE TYPE "public"."ai_data_scope" AS ENUM('categoryNames', 'transactions', 'people', 'notes', 'accounts', 'budgetsAndGoals');--> statement-breakpoint
CREATE TABLE "ai_data_sharing" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"scopes" "ai_data_scope"[] DEFAULT '{}' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_diagnoses" ADD COLUMN "shared_scopes" "ai_data_scope"[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_data_sharing" ADD CONSTRAINT "ai_data_sharing_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;