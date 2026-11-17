CREATE TYPE "public"."goal_contribution_kind" AS ENUM('deposit', 'withdrawal', 'adjustment');--> statement-breakpoint
CREATE TABLE "goal_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	"kind" "goal_contribution_kind" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"date" date NOT NULL,
	"note" varchar(240),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goal_contributions_amount_sign_check" CHECK (("goal_contributions"."kind" = 'deposit' AND "goal_contributions"."amount" > 0) OR ("goal_contributions"."kind" = 'withdrawal' AND "goal_contributions"."amount" < 0) OR ("goal_contributions"."kind" = 'adjustment' AND "goal_contributions"."amount" <> 0)),
	CONSTRAINT "goal_contributions_note_not_blank_check" CHECK ("goal_contributions"."note" IS NULL OR btrim("goal_contributions"."note") <> '')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "goals_id_user_id_unique" ON "goals" USING btree ("id","user_id");--> statement-breakpoint
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_goal_user_fk" FOREIGN KEY ("goal_id","user_id") REFERENCES "public"."goals"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goal_contributions_goal_id_date_idx" ON "goal_contributions" USING btree ("user_id","goal_id","date" DESC NULLS LAST,"created_at" DESC NULLS LAST);--> statement-breakpoint
-- Keeps the saved progress of manual goals as their opening history entry.
INSERT INTO "goal_contributions" ("user_id", "goal_id", "kind", "amount", "date", "created_at")
SELECT "user_id", "id", 'adjustment', "current_amount", ("created_at" AT TIME ZONE 'America/Sao_Paulo')::date, "created_at"
FROM "goals"
WHERE "tracking_type" = 'manual' AND "current_amount" > 0;
