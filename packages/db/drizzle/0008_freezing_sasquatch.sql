CREATE TYPE "public"."goal_status" AS ENUM('active', 'paused', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."goal_tracking_type" AS ENUM('manual', 'account');--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"target_amount" numeric(12, 2) NOT NULL,
	"current_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"target_date" date,
	"tracking_type" "goal_tracking_type" DEFAULT 'manual' NOT NULL,
	"account_id" uuid,
	"status" "goal_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goals_name_not_blank_check" CHECK (btrim("goals"."name") <> ''),
	CONSTRAINT "goals_target_positive_check" CHECK ("goals"."target_amount" > 0),
	CONSTRAINT "goals_current_nonnegative_check" CHECK ("goals"."current_amount" >= 0),
	CONSTRAINT "goals_tracking_account_check" CHECK (("goals"."tracking_type" = 'manual' AND "goals"."account_id" IS NULL) OR ("goals"."tracking_type" = 'account' AND "goals"."account_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_account_user_fk" FOREIGN KEY ("account_id","user_id") REFERENCES "public"."financial_accounts"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goals_user_id_status_idx" ON "goals" USING btree ("user_id","status");