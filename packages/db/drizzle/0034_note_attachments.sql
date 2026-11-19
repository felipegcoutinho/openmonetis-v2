CREATE TABLE "note_attachments" (
	"user_id" uuid NOT NULL,
	"note_id" uuid NOT NULL,
	"attachment_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "note_attachments_note_id_attachment_id_pk" PRIMARY KEY("note_id","attachment_id")
);
--> statement-breakpoint
ALTER TABLE "note_attachments" ADD CONSTRAINT "note_attachments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_attachments" ADD CONSTRAINT "note_attachments_note_user_fk" FOREIGN KEY ("note_id","user_id") REFERENCES "public"."notes"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_attachments" ADD CONSTRAINT "note_attachments_attachment_user_fk" FOREIGN KEY ("attachment_id","user_id") REFERENCES "public"."attachments"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "note_attachments_user_id_idx" ON "note_attachments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "note_attachments_attachment_id_idx" ON "note_attachments" USING btree ("attachment_id");