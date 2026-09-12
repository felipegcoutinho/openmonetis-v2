ALTER TABLE "notes" DROP CONSTRAINT "notes_content_matches_kind_check";--> statement-breakpoint
ALTER TYPE "public"."note_kind" RENAME TO "note_kind_legacy";--> statement-breakpoint
CREATE TYPE "public"."note_kind" AS ENUM('text', 'checklist', 'task');--> statement-breakpoint
ALTER TABLE "notes" ALTER COLUMN "kind" TYPE "public"."note_kind" USING "kind"::text::"public"."note_kind";--> statement-breakpoint
DROP TYPE "public"."note_kind_legacy";--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "due_date" date;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "is_completed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "notes_user_id_task_due_date_idx" ON "notes" USING btree ("user_id","kind","is_archived","is_completed","due_date");--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_content_matches_kind_check" CHECK (("notes"."kind" = 'text' AND "notes"."content" IS NOT NULL AND btrim("notes"."content") <> '' AND "notes"."due_date" IS NULL AND "notes"."is_completed" = false) OR ("notes"."kind" = 'checklist' AND "notes"."content" IS NULL AND "notes"."due_date" IS NULL AND "notes"."is_completed" = false) OR ("notes"."kind" = 'task' AND ("notes"."content" IS NULL OR btrim("notes"."content") <> '') AND "notes"."due_date" IS NOT NULL));
