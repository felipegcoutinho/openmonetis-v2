CREATE TYPE "public"."ai_diagnosis_failure_code" AS ENUM('providerDisconnected', 'providerLimitReached', 'providerBusy', 'invalidOutput', 'serviceUnavailable', 'runFailed', 'timedOut', 'interrupted');--> statement-breakpoint
CREATE TYPE "public"."ai_diagnosis_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ai_provider" AS ENUM('claude', 'codex');--> statement-breakpoint
CREATE TABLE "ai_diagnoses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"period" varchar(7) NOT NULL,
	"provider" "ai_provider" NOT NULL,
	"status" "ai_diagnosis_status" DEFAULT 'pending' NOT NULL,
	"failure_code" "ai_diagnosis_failure_code",
	"health" jsonb NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "ai_diagnoses_status_payload_check" CHECK (("ai_diagnoses"."status" = 'pending' AND "ai_diagnoses"."result" IS NULL AND "ai_diagnoses"."failure_code" IS NULL AND "ai_diagnoses"."completed_at" IS NULL) OR ("ai_diagnoses"."status" = 'completed' AND "ai_diagnoses"."result" IS NOT NULL AND "ai_diagnoses"."failure_code" IS NULL AND "ai_diagnoses"."completed_at" IS NOT NULL) OR ("ai_diagnoses"."status" = 'failed' AND "ai_diagnoses"."result" IS NULL AND "ai_diagnoses"."failure_code" IS NOT NULL AND "ai_diagnoses"."completed_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "ai_provider_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "ai_provider" NOT NULL,
	"consented_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_diagnoses" ADD CONSTRAINT "ai_diagnoses_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_provider_connections" ADD CONSTRAINT "ai_provider_connections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_diagnoses_user_id_created_at_idx" ON "ai_diagnoses" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "ai_provider_connections_user_id_provider_unique" ON "ai_provider_connections" USING btree ("user_id","provider");