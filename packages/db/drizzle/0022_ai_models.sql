ALTER TABLE "ai_diagnoses" ADD COLUMN "requested_model" varchar(80);--> statement-breakpoint
ALTER TABLE "ai_diagnoses" ADD COLUMN "model_id" varchar(120);--> statement-breakpoint
ALTER TABLE "ai_diagnoses" ADD COLUMN "model_name" varchar(120);--> statement-breakpoint
ALTER TABLE "ai_provider_connections" ADD COLUMN "preferred_model" varchar(80);