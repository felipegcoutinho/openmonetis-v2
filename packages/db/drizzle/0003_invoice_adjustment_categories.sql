INSERT INTO "categories" ("user_id", "name", "type", "icon", "is_system")
SELECT
  "id",
  'Ajustes de fatura',
  category_types."type",
  'receipt-text',
  true
FROM "user"
CROSS JOIN (VALUES ('expense'::"public"."category_type")) AS category_types("type")
ON CONFLICT ("user_id", "name", "type") DO NOTHING;--> statement-breakpoint
UPDATE "categories"
SET "is_system" = true,
    "icon" = 'receipt-text',
    "updated_at" = now()
WHERE "name" = 'Ajustes de fatura'
  AND "type" = 'expense';--> statement-breakpoint
UPDATE "transactions" AS movement
SET "category_id" = adjustment_category."id",
    "type" = 'expense'
FROM "categories" AS adjustment_category
WHERE movement."origin" = 'invoiceAdjustment'
  AND adjustment_category."user_id" = movement."user_id"
  AND adjustment_category."name" = 'Ajustes de fatura'
  AND adjustment_category."type" = 'expense';--> statement-breakpoint
DELETE FROM "categories" AS income_adjustment_category
WHERE income_adjustment_category."name" = 'Ajustes de fatura'
  AND income_adjustment_category."type" = 'income'
  AND income_adjustment_category."is_system" = true
  AND NOT EXISTS (
    SELECT 1
    FROM "transactions" AS movement
    WHERE movement."category_id" = income_adjustment_category."id"
  );
