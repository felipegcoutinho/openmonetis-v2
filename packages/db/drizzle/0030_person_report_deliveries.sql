CREATE TYPE "public"."person_report_delivery_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."person_report_delivery_trigger" AS ENUM('manual', 'scheduled');--> statement-breakpoint
CREATE TABLE "person_report_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"period" varchar(7) NOT NULL,
	"trigger" "person_report_delivery_trigger" NOT NULL,
	"status" "person_report_delivery_status" DEFAULT 'pending' NOT NULL,
	"recipient_email" varchar(320) NOT NULL,
	"includes_spreadsheet" boolean DEFAULT false NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"provider_message_id" varchar(255),
	"error_code" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "person_report_deliveries_period_check" CHECK ("person_report_deliveries"."period" ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "person_report_deliveries_attempts_check" CHECK ("person_report_deliveries"."attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "person_report_deliveries" ADD CONSTRAINT "person_report_deliveries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_report_deliveries" ADD CONSTRAINT "person_report_deliveries_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_report_deliveries" ADD CONSTRAINT "person_report_deliveries_person_user_fk" FOREIGN KEY ("person_id","user_id") REFERENCES "public"."people"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "person_report_deliveries_user_person_created_idx" ON "person_report_deliveries" USING btree ("user_id","person_id","created_at" DESC NULLS LAST);