CREATE TYPE "public"."person_report_schedule_frequency" AS ENUM('weekly', 'semimonthly', 'monthly', 'monthDays');--> statement-breakpoint
CREATE TYPE "public"."person_report_schedule_period" AS ENUM('previous', 'current');--> statement-breakpoint
CREATE TABLE "person_report_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"frequency" "person_report_schedule_frequency" NOT NULL,
	"weekday" integer,
	"month_days" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"report_period" "person_report_schedule_period" NOT NULL,
	"include_spreadsheet" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "person_report_schedules_weekday_check" CHECK ("person_report_schedules"."weekday" IS NULL OR "person_report_schedules"."weekday" BETWEEN 0 AND 6),
	CONSTRAINT "person_report_schedules_rule_check" CHECK (("person_report_schedules"."frequency" = 'weekly' AND "person_report_schedules"."weekday" IS NOT NULL) OR ("person_report_schedules"."frequency" <> 'weekly' AND cardinality("person_report_schedules"."month_days") >= 1))
);
--> statement-breakpoint
ALTER TABLE "person_report_deliveries" ADD COLUMN "scheduled_for" date;--> statement-breakpoint
ALTER TABLE "person_report_schedules" ADD CONSTRAINT "person_report_schedules_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_report_schedules" ADD CONSTRAINT "person_report_schedules_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_report_schedules" ADD CONSTRAINT "person_report_schedules_person_user_fk" FOREIGN KEY ("person_id","user_id") REFERENCES "public"."people"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "person_report_schedules_person_id_unique" ON "person_report_schedules" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "person_report_schedules_enabled_idx" ON "person_report_schedules" USING btree ("enabled") WHERE "person_report_schedules"."enabled";--> statement-breakpoint
CREATE UNIQUE INDEX "person_report_deliveries_person_scheduled_for_unique" ON "person_report_deliveries" USING btree ("person_id","scheduled_for") WHERE "person_report_deliveries"."scheduled_for" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "person_report_deliveries" ADD CONSTRAINT "person_report_deliveries_scheduled_for_check" CHECK (("person_report_deliveries"."trigger" = 'scheduled') = ("person_report_deliveries"."scheduled_for" IS NOT NULL));