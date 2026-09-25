DROP INDEX "recurring_transaction_occurrences_rule_date_unique";--> statement-breakpoint
ALTER TABLE "recurring_transaction_occurrences" ADD COLUMN "recurring_series_id" uuid;--> statement-breakpoint
ALTER TABLE "recurring_transaction_rules" ADD COLUMN "anchor_date" date;--> statement-breakpoint
UPDATE "recurring_transaction_rules"
SET "anchor_date" = "start_date";--> statement-breakpoint
UPDATE "recurring_transaction_occurrences" AS "occurrence"
SET "recurring_series_id" = "rule"."series_id"
FROM "recurring_transaction_rules" AS "rule"
WHERE "rule"."id" = "occurrence"."recurring_rule_id";--> statement-breakpoint
WITH "ranked_occurrences" AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "recurring_series_id", "purchase_date"
      ORDER BY "is_settled" DESC, "updated_at" DESC, "created_at" DESC, "id" DESC
    ) AS "position"
  FROM "recurring_transaction_occurrences"
)
DELETE FROM "recurring_transaction_occurrences"
WHERE "id" IN (
  SELECT "id"
  FROM "ranked_occurrences"
  WHERE "position" > 1
);--> statement-breakpoint
ALTER TABLE "recurring_transaction_occurrences" ALTER COLUMN "recurring_series_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_transaction_rules" ALTER COLUMN "anchor_date" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_transaction_occurrences" ADD CONSTRAINT "recurring_transaction_occurrences_recurring_series_id_recurring_transaction_series_id_fk" FOREIGN KEY ("recurring_series_id") REFERENCES "public"."recurring_transaction_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_occurrences" ADD CONSTRAINT "recurring_transaction_occurrences_series_user_fk" FOREIGN KEY ("recurring_series_id","user_id") REFERENCES "public"."recurring_transaction_series"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recurring_transaction_occurrences_user_purchase_series_idx" ON "recurring_transaction_occurrences" USING btree ("user_id","purchase_date","recurring_series_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recurring_transaction_occurrences_series_date_unique" ON "recurring_transaction_occurrences" USING btree ("recurring_series_id","purchase_date");
