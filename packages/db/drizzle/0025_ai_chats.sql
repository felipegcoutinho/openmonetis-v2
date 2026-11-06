CREATE TYPE "public"."ai_chat_failure_code" AS ENUM('providerDisconnected', 'providerLimitReached', 'providerBusy', 'serviceUnavailable', 'runFailed', 'timedOut', 'interrupted');--> statement-breakpoint
CREATE TYPE "public"."ai_chat_message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."ai_chat_message_status" AS ENUM('streaming', 'completed', 'failed', 'canceled');--> statement-breakpoint
CREATE TABLE "ai_chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "ai_chat_message_role" NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"reasoning" text,
	"status" "ai_chat_message_status" NOT NULL,
	"failure_code" "ai_chat_failure_code",
	"provider" "ai_provider",
	"model_id" varchar(120),
	"model_name" varchar(120),
	"shared_scopes" "ai_data_scope"[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(120) NOT NULL,
	"period" varchar(7) NOT NULL,
	"provider" "ai_provider" NOT NULL,
	"model" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_chat_messages" ADD CONSTRAINT "ai_chat_messages_chat_id_ai_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."ai_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chat_messages" ADD CONSTRAINT "ai_chat_messages_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chats" ADD CONSTRAINT "ai_chats_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_chat_messages_chat_id_created_at_idx" ON "ai_chat_messages" USING btree ("chat_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_chat_messages_user_id_created_at_idx" ON "ai_chat_messages" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_chats_user_id_updated_at_idx" ON "ai_chats" USING btree ("user_id","updated_at" DESC NULLS LAST);