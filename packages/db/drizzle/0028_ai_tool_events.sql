CREATE TYPE "public"."ai_tool_event_action" AS ENUM('install', 'activate', 'restoreBundled');--> statement-breakpoint
CREATE TYPE "public"."ai_tool_event_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ai_tool_failure_code" AS ENUM('tooRecent', 'notNewer', 'unknownVersion', 'downloadFailed', 'integrityMismatch', 'signatureInvalid', 'smokeTestFailed', 'canaryFailed', 'busy', 'installFailed');--> statement-breakpoint
CREATE TABLE "ai_tool_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "ai_provider" NOT NULL,
	"action" "ai_tool_event_action" NOT NULL,
	"from_version" varchar(32),
	"to_version" varchar(32),
	"status" "ai_tool_event_status" NOT NULL,
	"failure_code" "ai_tool_failure_code",
	"job_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "ai_tool_events_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
ALTER TABLE "ai_tool_events" ADD CONSTRAINT "ai_tool_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_tool_events_created_at_idx" ON "ai_tool_events" USING btree ("created_at");