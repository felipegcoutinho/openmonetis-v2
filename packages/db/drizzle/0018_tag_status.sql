CREATE TYPE "public"."tag_status" AS ENUM('active', 'inactive');--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "status" "tag_status" DEFAULT 'active' NOT NULL;