CREATE TABLE "budget_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"start_period" varchar(7) NOT NULL,
	"end_period" varchar(7),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "budget_rules_amount_positive_check" CHECK ("budget_rules"."amount" > 0),
	CONSTRAINT "budget_rules_start_period_format_check" CHECK ("budget_rules"."start_period" ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "budget_rules_end_period_check" CHECK ("budget_rules"."end_period" IS NULL OR ("budget_rules"."end_period" ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$' AND "budget_rules"."end_period" >= "budget_rules"."start_period"))
);
--> statement-breakpoint
ALTER TABLE "budget_rules" ADD CONSTRAINT "budget_rules_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_rules" ADD CONSTRAINT "budget_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "budget_rules" ADD CONSTRAINT "budget_rules_category_id_user_id_categories_fk" FOREIGN KEY ("category_id","user_id") REFERENCES "public"."categories"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_rules_user_id_start_period_idx" ON "budget_rules" USING btree ("user_id","start_period");--> statement-breakpoint
CREATE UNIQUE INDEX "budget_rules_user_id_category_id_start_period_unique" ON "budget_rules" USING btree ("user_id","category_id","start_period");