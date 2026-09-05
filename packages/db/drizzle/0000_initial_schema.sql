CREATE TYPE "public"."account_type" AS ENUM('checking', 'savings', 'investment', 'cash', 'benefits', 'other');--> statement-breakpoint
CREATE TYPE "public"."application_theme" AS ENUM('system', 'light', 'dark');--> statement-breakpoint
CREATE TYPE "public"."card_brand" AS ENUM('visa', 'mastercard', 'elo', 'amex', 'hipercard', 'other');--> statement-breakpoint
CREATE TYPE "public"."card_closing_offset_mode" AS ENUM('calendarDays', 'weekdays');--> statement-breakpoint
CREATE TYPE "public"."card_closing_rule_type" AS ENUM('fixedDay', 'daysBeforeDue');--> statement-breakpoint
CREATE TYPE "public"."card_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."category_type" AS ENUM('income', 'expense');--> statement-breakpoint
CREATE TYPE "public"."external_expense_source_kind" AS ENUM('transaction', 'installmentSeries', 'recurringOccurrence');--> statement-breakpoint
CREATE TYPE "public"."external_expense_status" AS ENUM('pending', 'imported');--> statement-breakpoint
CREATE TYPE "public"."inbox_item_status" AS ENUM('pending', 'processed', 'discarded');--> statement-breakpoint
CREATE TYPE "public"."inbox_rule_match_mode" AS ENUM('all', 'any');--> statement-breakpoint
CREATE TYPE "public"."invoice_payment_status" AS ENUM('pending', 'paid');--> statement-breakpoint
CREATE TYPE "public"."note_kind" AS ENUM('text', 'checklist');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('credit_card', 'debit_card', 'pix', 'cash', 'boleto', 'benefits', 'bank_transfer');--> statement-breakpoint
CREATE TYPE "public"."person_connection_invitation_status" AS ENUM('pending', 'claimed', 'confirmed', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."person_connection_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."person_role" AS ENUM('admin', 'external');--> statement-breakpoint
CREATE TYPE "public"."person_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."recurrence_frequency" AS ENUM('weekly', 'monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual');--> statement-breakpoint
CREATE TYPE "public"."recurring_rule_status" AS ENUM('active', 'paused', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."transaction_condition" AS ENUM('single', 'installment', 'recurring');--> statement-breakpoint
CREATE TYPE "public"."transaction_origin" AS ENUM('regular', 'invoicePayment', 'refund', 'accountBalanceAdjustment', 'invoiceAdjustment', 'personSettlement');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('income', 'expense', 'transfer');--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"issuer" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"file_key" text NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "attachments_file_key_unique" UNIQUE("file_key")
);
--> statement-breakpoint
CREATE TABLE "background_job_checkpoints" (
	"job_name" varchar(120) PRIMARY KEY NOT NULL,
	"last_completed_date" date NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"period" varchar(7) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "budgets_amount_positive_check" CHECK ("budgets"."amount" > 0),
	CONSTRAINT "budgets_period_format_check" CHECK ("budgets"."period" ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"brand" "card_brand" DEFAULT 'other' NOT NULL,
	"status" "card_status" DEFAULT 'active' NOT NULL,
	"closing_day" integer,
	"closing_rule_type" "card_closing_rule_type" DEFAULT 'fixedDay' NOT NULL,
	"closing_offset_days" integer,
	"closing_offset_mode" "card_closing_offset_mode",
	"due_day" integer NOT NULL,
	"limit" numeric(12, 2) DEFAULT '0' NOT NULL,
	"logo" varchar(255),
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cards_name_not_blank_check" CHECK (btrim("cards"."name") <> ''),
	CONSTRAINT "cards_limit_nonnegative_check" CHECK ("cards"."limit" >= 0),
	CONSTRAINT "cards_due_day_check" CHECK ("cards"."due_day" BETWEEN 1 AND 31),
	CONSTRAINT "cards_closing_rule_check" CHECK ((
        "cards"."closing_rule_type" = 'fixedDay'
        AND "cards"."closing_day" BETWEEN 1 AND 31
        AND "cards"."closing_offset_days" IS NULL
        AND "cards"."closing_offset_mode" IS NULL
      ) OR (
        "cards"."closing_rule_type" = 'daysBeforeDue'
        AND "cards"."closing_day" IS NULL
        AND "cards"."closing_offset_days" BETWEEN 1 AND 31
        AND "cards"."closing_offset_mode" IS NOT NULL
      ))
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"type" "category_type" NOT NULL,
	"icon" varchar(100),
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_not_blank_check" CHECK (btrim("categories"."name") <> '')
);
--> statement-breakpoint
CREATE TABLE "dashboard_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"widget_order" jsonb NOT NULL,
	"hidden_widgets" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"token_digest" varchar(64) NOT NULL,
	"token_prefix" varchar(12) NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_tokens_name_not_blank_check" CHECK (btrim("device_tokens"."name") <> ''),
	CONSTRAINT "device_tokens_expiration_check" CHECK ("device_tokens"."expires_at" > "device_tokens"."created_at")
);
--> statement-breakpoint
CREATE TABLE "establishment_logos" (
	"user_id" uuid NOT NULL,
	"name_key" varchar(180) NOT NULL,
	"domain" varchar(253) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "establishment_logos_user_id_name_key_pk" PRIMARY KEY("user_id","name_key")
);
--> statement-breakpoint
CREATE TABLE "external_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"source_kind" "external_expense_source_kind" DEFAULT 'transaction' NOT NULL,
	"source_transaction_id" uuid,
	"source_series_id" uuid,
	"source_recurring_series_id" uuid,
	"source_recurring_rule_id" uuid,
	"source_occurrence_date" date,
	"source_person_id" uuid NOT NULL,
	"imported_transaction_id" uuid,
	"status" "external_expense_status" DEFAULT 'pending' NOT NULL,
	"source_version" integer DEFAULT 1 NOT NULL,
	"name" varchar(160) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"purchase_date" date NOT NULL,
	"period" varchar(7) NOT NULL,
	"due_date" date,
	"source_payment_method" "payment_method" NOT NULL,
	"source_condition" "transaction_condition" NOT NULL,
	"installment_count" integer,
	"current_installment" integer,
	"source_label" varchar(120),
	"imported_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_expenses_source_version_positive_check" CHECK ("external_expenses"."source_version" > 0),
	CONSTRAINT "external_expenses_amount_positive_check" CHECK ("external_expenses"."amount" > 0),
	CONSTRAINT "external_expenses_name_not_blank_check" CHECK (btrim("external_expenses"."name") <> ''),
	CONSTRAINT "external_expenses_period_format_check" CHECK ("external_expenses"."period" ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "external_expenses_condition_check" CHECK ((
        "external_expenses"."source_condition" in ('single', 'recurring')
        AND "external_expenses"."installment_count" IS NULL
        AND "external_expenses"."current_installment" IS NULL
      ) OR (
        "external_expenses"."source_condition" = 'installment'
        AND "external_expenses"."installment_count" BETWEEN 2 AND 60
        AND "external_expenses"."current_installment" BETWEEN 1 AND "external_expenses"."installment_count"
      )),
	CONSTRAINT "external_expenses_source_kind_check" CHECK ((
        "external_expenses"."source_kind" = 'transaction'
        AND ("external_expenses"."source_transaction_id" IS NOT NULL OR "external_expenses"."status" = 'imported')
        AND "external_expenses"."source_series_id" IS NULL
        AND "external_expenses"."source_recurring_series_id" IS NULL
        AND "external_expenses"."source_recurring_rule_id" IS NULL
        AND "external_expenses"."source_occurrence_date" IS NULL
      ) OR (
        "external_expenses"."source_kind" = 'installmentSeries'
        AND ("external_expenses"."source_series_id" IS NOT NULL OR "external_expenses"."status" = 'imported')
        AND "external_expenses"."source_recurring_series_id" IS NULL
        AND "external_expenses"."source_recurring_rule_id" IS NULL
        AND "external_expenses"."source_occurrence_date" IS NULL
      ) OR (
        "external_expenses"."source_kind" = 'recurringOccurrence'
        AND "external_expenses"."source_transaction_id" IS NULL
        AND "external_expenses"."source_series_id" IS NULL
        AND (
          ("external_expenses"."source_recurring_series_id" IS NOT NULL AND "external_expenses"."source_recurring_rule_id" IS NOT NULL)
          OR "external_expenses"."status" = 'imported'
        )
        AND "external_expenses"."source_occurrence_date" IS NOT NULL
        AND "external_expenses"."source_condition" = 'recurring'
      ))
);
--> statement-breakpoint
CREATE TABLE "financial_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"type" "account_type" NOT NULL,
	"logo" varchar(255),
	"note" text,
	"exclude_from_balance" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "financial_accounts_name_not_blank_check" CHECK (btrim("financial_accounts"."name") <> '')
);
--> statement-breakpoint
CREATE TABLE "import_category_mappings" (
	"user_id" uuid NOT NULL,
	"description_key" varchar(160) NOT NULL,
	"category_id" uuid NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "import_category_mappings_user_id_description_key_pk" PRIMARY KEY("user_id","description_key")
);
--> statement-breakpoint
CREATE TABLE "inbox_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_token_id" uuid,
	"source_app" varchar(255) NOT NULL,
	"source_app_name" varchar(255),
	"original_title" varchar(500),
	"original_text" text NOT NULL,
	"notification_timestamp" timestamp with time zone NOT NULL,
	"parsed_name" varchar(160),
	"parsed_amount" numeric(12, 2),
	"client_id" varchar(255) NOT NULL,
	"payload_fingerprint" varchar(64) NOT NULL,
	"status" "inbox_item_status" DEFAULT 'pending' NOT NULL,
	"transaction_id" uuid,
	"processed_at" timestamp with time zone,
	"discarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_items_source_app_not_blank_check" CHECK (btrim("inbox_items"."source_app") <> ''),
	CONSTRAINT "inbox_items_original_text_not_blank_check" CHECK (btrim("inbox_items"."original_text") <> ''),
	CONSTRAINT "inbox_items_client_id_not_blank_check" CHECK (btrim("inbox_items"."client_id") <> ''),
	CONSTRAINT "inbox_items_parsed_amount_positive_check" CHECK ("inbox_items"."parsed_amount" IS NULL OR "inbox_items"."parsed_amount" > 0),
	CONSTRAINT "inbox_items_status_metadata_check" CHECK ((
        "inbox_items"."status" = 'pending'
        AND "inbox_items"."transaction_id" IS NULL
        AND "inbox_items"."processed_at" IS NULL
        AND "inbox_items"."discarded_at" IS NULL
      ) OR (
        "inbox_items"."status" = 'processed'
        AND "inbox_items"."processed_at" IS NOT NULL
        AND "inbox_items"."discarded_at" IS NULL
      ) OR (
        "inbox_items"."status" = 'discarded'
        AND "inbox_items"."transaction_id" IS NULL
        AND "inbox_items"."processed_at" IS NULL
        AND "inbox_items"."discarded_at" IS NOT NULL
      ))
);
--> statement-breakpoint
CREATE TABLE "inbox_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"match_mode" "inbox_rule_match_mode" DEFAULT 'all' NOT NULL,
	"conditions" jsonb NOT NULL,
	"category_id" uuid,
	"person_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_rules_name_not_blank_check" CHECK (btrim("inbox_rules"."name") <> ''),
	CONSTRAINT "inbox_rules_priority_range_check" CHECK ("inbox_rules"."priority" between 0 and 9999),
	CONSTRAINT "inbox_rules_version_positive_check" CHECK ("inbox_rules"."version" > 0),
	CONSTRAINT "inbox_rules_actions_required_check" CHECK ("inbox_rules"."category_id" is not null or "inbox_rules"."person_id" is not null),
	CONSTRAINT "inbox_rules_conditions_array_check" CHECK (jsonb_typeof("inbox_rules"."conditions") = 'array' and jsonb_array_length("inbox_rules"."conditions") between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "installment_anticipation_items" (
	"anticipation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	"original_period" varchar(7) NOT NULL,
	CONSTRAINT "installment_anticipation_items_anticipation_id_transaction_id_pk" PRIMARY KEY("anticipation_id","transaction_id"),
	CONSTRAINT "installment_anticipation_items_original_period_format_check" CHECK ("installment_anticipation_items"."original_period" ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
CREATE TABLE "installment_anticipations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"series_id" uuid NOT NULL,
	"target_period" varchar(7) NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"adjustment_transaction_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "installment_anticipations_discount_nonnegative" CHECK ("installment_anticipations"."discount" >= 0),
	CONSTRAINT "installment_anticipations_target_period_format_check" CHECK ("installment_anticipations"."target_period" ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
CREATE TABLE "installment_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"total_installments" integer NOT NULL,
	"tracked_from_installment" integer NOT NULL,
	"original_amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "installment_series_total_installments_check" CHECK ("installment_series"."total_installments" BETWEEN 2 AND 60),
	CONSTRAINT "installment_series_tracked_from_installment_check" CHECK ("installment_series"."tracked_from_installment" BETWEEN 1 AND "installment_series"."total_installments"),
	CONSTRAINT "installment_series_original_amount_positive_check" CHECK ("installment_series"."original_amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "invoice_payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_payment_allocations_amount_positive" CHECK ("invoice_payment_allocations"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "invoice_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"period" varchar(7) NOT NULL,
	"account_id" uuid,
	"transaction_id" uuid,
	"amount" numeric(12, 2) NOT NULL,
	"paid_at" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_payments_period_format_check" CHECK ("invoice_payments"."period" ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "invoice_payments_amount_positive" CHECK ("invoice_payments"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"period" varchar(7) NOT NULL,
	"payment_status" "invoice_payment_status" DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp,
	"payment_account_id" uuid,
	"closing_date" date,
	"due_date" date,
	"dates_customized" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_period_format_check" CHECK ("invoices"."period" ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "invoices_payment_status_metadata_check" CHECK ((
        "invoices"."payment_status" = 'pending'
        AND "invoices"."paid_at" IS NULL
        AND "invoices"."payment_account_id" IS NULL
      ) OR (
        "invoices"."payment_status" = 'paid'
        AND "invoices"."paid_at" IS NOT NULL
      ))
);
--> statement-breakpoint
CREATE TABLE "note_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"note_id" uuid NOT NULL,
	"text" varchar(300) NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "note_items_text_not_blank_check" CHECK (btrim("note_items"."text") <> ''),
	CONSTRAINT "note_items_position_nonnegative_check" CHECK ("note_items"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(120) NOT NULL,
	"kind" "note_kind" NOT NULL,
	"content" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notes_title_not_blank_check" CHECK (btrim("notes"."title") <> ''),
	CONSTRAINT "notes_content_matches_kind_check" CHECK (("notes"."kind" = 'text' AND "notes"."content" IS NOT NULL AND btrim("notes"."content") <> '') OR ("notes"."kind" = 'checklist' AND "notes"."content" IS NULL)),
	CONSTRAINT "notes_version_positive_check" CHECK ("notes"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "notification_states" (
	"user_id" uuid NOT NULL,
	"notification_key" varchar(220) NOT NULL,
	"fingerprint" varchar(180) NOT NULL,
	"read_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_states_user_id_notification_key_pk" PRIMARY KEY("user_id","notification_key")
);
--> statement-breakpoint
CREATE TABLE "passkey" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"name" varchar(120),
	"public_key" text NOT NULL,
	"user_id" uuid NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"aaguid" text
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"email" varchar(320),
	"avatar_url" text,
	"provider_avatar_url" text,
	"role" "person_role" DEFAULT 'external' NOT NULL,
	"status" "person_status" DEFAULT 'active' NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "people_name_not_blank_check" CHECK (btrim("people"."name") <> '')
);
--> statement-breakpoint
CREATE TABLE "person_connection_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"claimed_by_user_id" uuid,
	"token_digest" varchar(64) NOT NULL,
	"confirmation_code_digest" varchar(64),
	"confirmation_attempts" integer DEFAULT 0 NOT NULL,
	"status" "person_connection_invitation_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"confirmation_expires_at" timestamp with time zone,
	"claimed_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "person_connection_invitations_claim_check" CHECK ((
        "person_connection_invitations"."status" = 'pending'
        AND "person_connection_invitations"."claimed_by_user_id" IS NULL
        AND "person_connection_invitations"."confirmation_code_digest" IS NULL
        AND "person_connection_invitations"."claimed_at" IS NULL
        AND "person_connection_invitations"."confirmation_expires_at" IS NULL
      ) OR "person_connection_invitations"."status" <> 'pending'),
	CONSTRAINT "person_connection_invitations_attempts_nonnegative_check" CHECK ("person_connection_invitations"."confirmation_attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "person_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitation_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"status" "person_connection_status" DEFAULT 'active' NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "person_connections_invitation_id_unique" UNIQUE("invitation_id"),
	CONSTRAINT "person_connections_distinct_users_check" CHECK ("person_connections"."owner_user_id" <> "person_connections"."recipient_user_id"),
	CONSTRAINT "person_connections_revoked_at_check" CHECK (("person_connections"."status" = 'active' AND "person_connections"."revoked_at" IS NULL AND "person_connections"."revoked_by_user_id" IS NULL) OR ("person_connections"."status" = 'revoked' AND "person_connections"."revoked_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "person_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"invoice_payment_allocation_id" uuid,
	"amount" numeric(12, 2) NOT NULL,
	"received_at" date NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "person_settlements_amount_positive_check" CHECK ("person_settlements"."amount" > 0),
	CONSTRAINT "person_settlements_note_not_blank_check" CHECK ("person_settlements"."note" IS NULL OR btrim("person_settlements"."note") <> '')
);
--> statement-breakpoint
CREATE TABLE "recurring_transaction_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"recurring_rule_id" uuid NOT NULL,
	"purchase_date" date NOT NULL,
	"is_settled" boolean NOT NULL,
	"account_id" uuid,
	"boleto_payment_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_transaction_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"series_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"type" "transaction_type" NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"name" varchar(160) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"frequency" "recurrence_frequency" NOT NULL,
	"account_id" uuid,
	"card_id" uuid,
	"category_id" uuid,
	"source_account_id" uuid,
	"destination_account_id" uuid,
	"due_date" date,
	"is_settled" boolean,
	"note" text,
	"status" "recurring_rule_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_transaction_rules_name_not_blank_check" CHECK (btrim("recurring_transaction_rules"."name") <> ''),
	CONSTRAINT "recurring_transaction_rules_amount_nonzero_check" CHECK ("recurring_transaction_rules"."amount" <> 0)
);
--> statement-breakpoint
CREATE TABLE "recurring_transaction_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_transaction_splits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"recurring_rule_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_transaction_splits_amount_nonzero_check" CHECK ("recurring_transaction_splits"."amount" <> 0)
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "transaction_attachments" (
	"user_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	"attachment_id" uuid NOT NULL,
	CONSTRAINT "transaction_attachments_transaction_id_attachment_id_pk" PRIMARY KEY("transaction_id","attachment_id")
);
--> statement-breakpoint
CREATE TABLE "transaction_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_transaction_id" uuid NOT NULL,
	"refund_transaction_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transaction_refunds_amount_positive" CHECK ("transaction_refunds"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "transaction_splits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transaction_splits_amount_nonzero_check" CHECK ("transaction_splits"."amount" <> 0)
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"type" "transaction_type" NOT NULL,
	"origin" "transaction_origin" DEFAULT 'regular' NOT NULL,
	"condition" "transaction_condition" DEFAULT 'single' NOT NULL,
	"payment_method" "payment_method",
	"name" varchar(160) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"purchase_date" date NOT NULL,
	"period" varchar(7) NOT NULL,
	"account_id" uuid,
	"card_id" uuid,
	"category_id" uuid,
	"source_account_id" uuid,
	"destination_account_id" uuid,
	"due_date" date,
	"boleto_payment_date" date,
	"installment_count" integer,
	"current_installment" integer,
	"series_id" uuid,
	"transfer_id" uuid,
	"recurring_rule_id" uuid,
	"is_settled" boolean,
	"note" text,
	"import_source_fingerprint" varchar(64),
	"import_external_id" varchar(255),
	"import_batch_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_name_not_blank_check" CHECK (btrim("transactions"."name") <> ''),
	CONSTRAINT "transactions_amount_nonzero_check" CHECK ("transactions"."amount" <> 0),
	CONSTRAINT "transactions_period_format_check" CHECK ("transactions"."period" ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "transactions_installment_metadata_check" CHECK ((
        "transactions"."condition" = 'installment'
        AND "transactions"."installment_count" IS NOT NULL
        AND "transactions"."installment_count" BETWEEN 2 AND 60
        AND "transactions"."current_installment" IS NOT NULL
        AND "transactions"."current_installment" BETWEEN 1 AND "transactions"."installment_count"
        AND "transactions"."series_id" IS NOT NULL
      ) OR (
        "transactions"."condition" <> 'installment'
        AND "transactions"."installment_count" IS NULL
        AND "transactions"."current_installment" IS NULL
        AND "transactions"."series_id" IS NULL
      )),
	CONSTRAINT "transactions_payment_method_origin_check" CHECK ((
        "transactions"."origin" = 'accountBalanceAdjustment'
        AND "transactions"."payment_method" IS NULL
      ) OR (
        "transactions"."origin" <> 'accountBalanceAdjustment'
        AND "transactions"."payment_method" IS NOT NULL
      ))
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_name_not_blank_check" CHECK (btrim("user"."name") <> '')
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"theme" "application_theme" DEFAULT 'system' NOT NULL,
	"hide_values_on_start" boolean DEFAULT false NOT NULL,
	"default_payment_method" "payment_method" DEFAULT 'credit_card' NOT NULL,
	"default_account_id" uuid,
	"default_card_id" uuid,
	"notification_due_soon_days" integer DEFAULT 5 NOT NULL,
	"transactions_page_size" integer DEFAULT 30 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_notification_due_soon_days_check" CHECK ("user_preferences"."notification_due_soon_days" in (1, 3, 5, 7)),
	CONSTRAINT "user_preferences_transactions_page_size_check" CHECK ("user_preferences"."transactions_page_size" in (20, 30, 50))
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "attachments_id_user_id_unique" ON "attachments" USING btree ("id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cards_id_user_id_unique" ON "cards" USING btree ("id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_id_user_id_unique" ON "categories" USING btree ("id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_accounts_id_user_id_unique" ON "financial_accounts" USING btree ("id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "installment_series_id_user_id_unique" ON "installment_series" USING btree ("id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_payment_allocations_id_user_unique" ON "invoice_payment_allocations" USING btree ("id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_payments_id_user_id_unique" ON "invoice_payments" USING btree ("id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notes_id_user_id_unique" ON "notes" USING btree ("id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "people_id_user_id_unique" ON "people" USING btree ("id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "person_connection_invitations_id_participants_unique" ON "person_connection_invitations" USING btree ("id","owner_user_id","person_id","claimed_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "person_connections_id_participants_unique" ON "person_connections" USING btree ("id","owner_user_id","recipient_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recurring_transaction_rules_id_user_id_unique" ON "recurring_transaction_rules" USING btree ("id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recurring_transaction_series_id_user_id_unique" ON "recurring_transaction_series" USING btree ("id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_id_user_id_unique" ON "transactions" USING btree ("id","user_id");--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_user_id_categories_fk" FOREIGN KEY ("category_id","user_id") REFERENCES "public"."categories"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_account_id_user_id_financial_accounts_fk" FOREIGN KEY ("account_id","user_id") REFERENCES "public"."financial_accounts"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_preferences" ADD CONSTRAINT "dashboard_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "establishment_logos" ADD CONSTRAINT "establishment_logos_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_expenses" ADD CONSTRAINT "external_expenses_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_expenses" ADD CONSTRAINT "external_expenses_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_expenses" ADD CONSTRAINT "external_expenses_source_transaction_id_transactions_id_fk" FOREIGN KEY ("source_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_expenses" ADD CONSTRAINT "external_expenses_source_series_id_installment_series_id_fk" FOREIGN KEY ("source_series_id") REFERENCES "public"."installment_series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_expenses" ADD CONSTRAINT "external_expenses_source_recurring_series_id_recurring_transaction_series_id_fk" FOREIGN KEY ("source_recurring_series_id") REFERENCES "public"."recurring_transaction_series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_expenses" ADD CONSTRAINT "external_expenses_source_recurring_rule_id_recurring_transaction_rules_id_fk" FOREIGN KEY ("source_recurring_rule_id") REFERENCES "public"."recurring_transaction_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_expenses" ADD CONSTRAINT "external_expenses_imported_transaction_id_transactions_id_fk" FOREIGN KEY ("imported_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_expenses" ADD CONSTRAINT "external_expenses_connection_participants_fk" FOREIGN KEY ("connection_id","owner_user_id","recipient_user_id") REFERENCES "public"."person_connections"("id","owner_user_id","recipient_user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_expenses" ADD CONSTRAINT "external_expenses_source_person_owner_fk" FOREIGN KEY ("source_person_id","owner_user_id") REFERENCES "public"."people"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_category_mappings" ADD CONSTRAINT "import_category_mappings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_category_mappings" ADD CONSTRAINT "import_category_mappings_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_category_mappings" ADD CONSTRAINT "import_category_mappings_category_user_fk" FOREIGN KEY ("category_id","user_id") REFERENCES "public"."categories"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_items_device_token_id_device_tokens_id_fk" FOREIGN KEY ("device_token_id") REFERENCES "public"."device_tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_items_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_rules" ADD CONSTRAINT "inbox_rules_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_rules" ADD CONSTRAINT "inbox_rules_category_user_fk" FOREIGN KEY ("category_id","user_id") REFERENCES "public"."categories"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_rules" ADD CONSTRAINT "inbox_rules_person_user_fk" FOREIGN KEY ("person_id","user_id") REFERENCES "public"."people"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installment_anticipation_items" ADD CONSTRAINT "installment_anticipation_items_anticipation_id_installment_anticipations_id_fk" FOREIGN KEY ("anticipation_id") REFERENCES "public"."installment_anticipations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installment_anticipation_items" ADD CONSTRAINT "installment_anticipation_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installment_anticipation_items" ADD CONSTRAINT "installment_anticipation_items_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installment_anticipations" ADD CONSTRAINT "installment_anticipations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installment_anticipations" ADD CONSTRAINT "installment_anticipations_adjustment_transaction_id_transactions_id_fk" FOREIGN KEY ("adjustment_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installment_anticipations" ADD CONSTRAINT "installment_anticipations_series_user_id_fk" FOREIGN KEY ("series_id","user_id") REFERENCES "public"."installment_series"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installment_series" ADD CONSTRAINT "installment_series_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payment_allocations" ADD CONSTRAINT "invoice_payment_allocations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payment_allocations" ADD CONSTRAINT "invoice_payment_allocations_payment_id_invoice_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."invoice_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payment_allocations" ADD CONSTRAINT "invoice_payment_allocations_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payment_allocations" ADD CONSTRAINT "invoice_payment_allocations_payment_user_fk" FOREIGN KEY ("payment_id","user_id") REFERENCES "public"."invoice_payments"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payment_allocations" ADD CONSTRAINT "invoice_payment_allocations_person_user_fk" FOREIGN KEY ("person_id","user_id") REFERENCES "public"."people"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_card_user_fk" FOREIGN KEY ("card_id","user_id") REFERENCES "public"."cards"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_account_user_fk" FOREIGN KEY ("account_id","user_id") REFERENCES "public"."financial_accounts"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_transaction_user_fk" FOREIGN KEY ("transaction_id","user_id") REFERENCES "public"."transactions"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_account_id_financial_accounts_id_fk" FOREIGN KEY ("payment_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_card_id_user_id_cards_fk" FOREIGN KEY ("card_id","user_id") REFERENCES "public"."cards"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_items" ADD CONSTRAINT "note_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_items" ADD CONSTRAINT "note_items_note_id_user_id_notes_fk" FOREIGN KEY ("note_id","user_id") REFERENCES "public"."notes"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_states" ADD CONSTRAINT "notification_states_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_connection_invitations" ADD CONSTRAINT "person_connection_invitations_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_connection_invitations" ADD CONSTRAINT "person_connection_invitations_claimed_by_user_id_user_id_fk" FOREIGN KEY ("claimed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_connection_invitations" ADD CONSTRAINT "person_connection_invitations_person_owner_fk" FOREIGN KEY ("person_id","owner_user_id") REFERENCES "public"."people"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_connections" ADD CONSTRAINT "person_connections_invitation_id_person_connection_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."person_connection_invitations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_connections" ADD CONSTRAINT "person_connections_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_connections" ADD CONSTRAINT "person_connections_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_connections" ADD CONSTRAINT "person_connections_revoked_by_user_id_user_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_connections" ADD CONSTRAINT "person_connections_person_owner_fk" FOREIGN KEY ("person_id","owner_user_id") REFERENCES "public"."people"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_connections" ADD CONSTRAINT "person_connections_invitation_participants_fk" FOREIGN KEY ("invitation_id","owner_user_id","person_id","recipient_user_id") REFERENCES "public"."person_connection_invitations"("id","owner_user_id","person_id","claimed_by_user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_settlements" ADD CONSTRAINT "person_settlements_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_settlements" ADD CONSTRAINT "person_settlements_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_settlements" ADD CONSTRAINT "person_settlements_invoice_payment_allocation_id_invoice_payment_allocations_id_fk" FOREIGN KEY ("invoice_payment_allocation_id") REFERENCES "public"."invoice_payment_allocations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_settlements" ADD CONSTRAINT "person_settlements_person_user_fk" FOREIGN KEY ("person_id","user_id") REFERENCES "public"."people"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_settlements" ADD CONSTRAINT "person_settlements_invoice_allocation_user_fk" FOREIGN KEY ("invoice_payment_allocation_id","user_id") REFERENCES "public"."invoice_payment_allocations"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_occurrences" ADD CONSTRAINT "recurring_transaction_occurrences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_occurrences" ADD CONSTRAINT "recurring_transaction_occurrences_recurring_rule_id_recurring_transaction_rules_id_fk" FOREIGN KEY ("recurring_rule_id") REFERENCES "public"."recurring_transaction_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_occurrences" ADD CONSTRAINT "recurring_transaction_occurrences_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_occurrences" ADD CONSTRAINT "recurring_transaction_occurrences_rule_user_fk" FOREIGN KEY ("recurring_rule_id","user_id") REFERENCES "public"."recurring_transaction_rules"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_occurrences" ADD CONSTRAINT "recurring_transaction_occurrences_account_user_fk" FOREIGN KEY ("account_id","user_id") REFERENCES "public"."financial_accounts"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_rules" ADD CONSTRAINT "recurring_transaction_rules_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_rules" ADD CONSTRAINT "recurring_transaction_rules_series_id_recurring_transaction_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."recurring_transaction_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_rules" ADD CONSTRAINT "recurring_transaction_rules_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_rules" ADD CONSTRAINT "recurring_transaction_rules_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_rules" ADD CONSTRAINT "recurring_transaction_rules_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_rules" ADD CONSTRAINT "recurring_transaction_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_rules" ADD CONSTRAINT "recurring_transaction_rules_source_account_id_financial_accounts_id_fk" FOREIGN KEY ("source_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_rules" ADD CONSTRAINT "recurring_transaction_rules_destination_account_id_financial_accounts_id_fk" FOREIGN KEY ("destination_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_rules" ADD CONSTRAINT "recurring_transaction_rules_series_user_fk" FOREIGN KEY ("series_id","user_id") REFERENCES "public"."recurring_transaction_series"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_rules" ADD CONSTRAINT "recurring_transaction_rules_person_user_fk" FOREIGN KEY ("person_id","user_id") REFERENCES "public"."people"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_rules" ADD CONSTRAINT "recurring_transaction_rules_account_user_fk" FOREIGN KEY ("account_id","user_id") REFERENCES "public"."financial_accounts"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_rules" ADD CONSTRAINT "recurring_transaction_rules_card_user_fk" FOREIGN KEY ("card_id","user_id") REFERENCES "public"."cards"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_rules" ADD CONSTRAINT "recurring_transaction_rules_category_user_fk" FOREIGN KEY ("category_id","user_id") REFERENCES "public"."categories"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_rules" ADD CONSTRAINT "recurring_transaction_rules_source_account_user_fk" FOREIGN KEY ("source_account_id","user_id") REFERENCES "public"."financial_accounts"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_rules" ADD CONSTRAINT "recurring_transaction_rules_destination_account_user_fk" FOREIGN KEY ("destination_account_id","user_id") REFERENCES "public"."financial_accounts"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_series" ADD CONSTRAINT "recurring_transaction_series_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_splits" ADD CONSTRAINT "recurring_transaction_splits_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_splits" ADD CONSTRAINT "recurring_transaction_splits_recurring_rule_id_recurring_transaction_rules_id_fk" FOREIGN KEY ("recurring_rule_id") REFERENCES "public"."recurring_transaction_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_splits" ADD CONSTRAINT "recurring_transaction_splits_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_splits" ADD CONSTRAINT "recurring_transaction_splits_rule_user_fk" FOREIGN KEY ("recurring_rule_id","user_id") REFERENCES "public"."recurring_transaction_rules"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_splits" ADD CONSTRAINT "recurring_transaction_splits_person_user_fk" FOREIGN KEY ("person_id","user_id") REFERENCES "public"."people"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_attachments" ADD CONSTRAINT "transaction_attachments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_attachments" ADD CONSTRAINT "transaction_attachments_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_attachments" ADD CONSTRAINT "transaction_attachments_attachment_id_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."attachments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_attachments" ADD CONSTRAINT "transaction_attachments_transaction_user_fk" FOREIGN KEY ("transaction_id","user_id") REFERENCES "public"."transactions"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_attachments" ADD CONSTRAINT "transaction_attachments_attachment_user_fk" FOREIGN KEY ("attachment_id","user_id") REFERENCES "public"."attachments"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_refunds" ADD CONSTRAINT "transaction_refunds_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_refunds" ADD CONSTRAINT "transaction_refunds_source_transaction_id_transactions_id_fk" FOREIGN KEY ("source_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_refunds" ADD CONSTRAINT "transaction_refunds_refund_transaction_id_transactions_id_fk" FOREIGN KEY ("refund_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_refunds" ADD CONSTRAINT "transaction_refunds_source_transaction_user_fk" FOREIGN KEY ("source_transaction_id","user_id") REFERENCES "public"."transactions"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_refunds" ADD CONSTRAINT "transaction_refunds_refund_transaction_user_fk" FOREIGN KEY ("refund_transaction_id","user_id") REFERENCES "public"."transactions"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_splits" ADD CONSTRAINT "transaction_splits_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_splits" ADD CONSTRAINT "transaction_splits_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_splits" ADD CONSTRAINT "transaction_splits_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_splits" ADD CONSTRAINT "transaction_splits_transaction_user_fk" FOREIGN KEY ("transaction_id","user_id") REFERENCES "public"."transactions"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_splits" ADD CONSTRAINT "transaction_splits_person_user_fk" FOREIGN KEY ("person_id","user_id") REFERENCES "public"."people"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_source_account_id_financial_accounts_id_fk" FOREIGN KEY ("source_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_destination_account_id_financial_accounts_id_fk" FOREIGN KEY ("destination_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurring_rule_id_recurring_transaction_rules_id_fk" FOREIGN KEY ("recurring_rule_id") REFERENCES "public"."recurring_transaction_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_person_id_user_id_people_fk" FOREIGN KEY ("person_id","user_id") REFERENCES "public"."people"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_user_id_financial_accounts_fk" FOREIGN KEY ("account_id","user_id") REFERENCES "public"."financial_accounts"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_card_id_user_id_cards_fk" FOREIGN KEY ("card_id","user_id") REFERENCES "public"."cards"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_user_id_categories_fk" FOREIGN KEY ("category_id","user_id") REFERENCES "public"."categories"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_source_account_id_user_id_accounts_fk" FOREIGN KEY ("source_account_id","user_id") REFERENCES "public"."financial_accounts"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_destination_account_id_user_id_accounts_fk" FOREIGN KEY ("destination_account_id","user_id") REFERENCES "public"."financial_accounts"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_series_id_user_id_installment_series_fk" FOREIGN KEY ("series_id","user_id") REFERENCES "public"."installment_series"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_default_account_id_financial_accounts_id_fk" FOREIGN KEY ("default_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_default_card_id_cards_id_fk" FOREIGN KEY ("default_card_id") REFERENCES "public"."cards"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_account_unique" ON "account" USING btree ("issuer","account_id");--> statement-breakpoint
CREATE INDEX "attachments_user_id_idx" ON "attachments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "budgets_user_id_period_idx" ON "budgets" USING btree ("user_id","period");--> statement-breakpoint
CREATE INDEX "budgets_category_id_idx" ON "budgets" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "budgets_user_id_category_id_period_unique" ON "budgets" USING btree ("user_id","category_id","period");--> statement-breakpoint
CREATE INDEX "cards_account_id_idx" ON "cards" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "cards_user_id_status_idx" ON "cards" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "categories_user_id_type_idx" ON "categories" USING btree ("user_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_user_id_name_type_unique" ON "categories" USING btree ("user_id","name","type");--> statement-breakpoint
CREATE UNIQUE INDEX "device_tokens_token_digest_unique" ON "device_tokens" USING btree ("token_digest");--> statement-breakpoint
CREATE INDEX "device_tokens_user_id_created_at_idx" ON "device_tokens" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "external_expenses_recipient_status_updated_idx" ON "external_expenses" USING btree ("recipient_user_id","status","updated_at" DESC NULLS LAST,"created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "external_expenses_recipient_updated_idx" ON "external_expenses" USING btree ("recipient_user_id","updated_at" DESC NULLS LAST,"created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "external_expenses_source_transaction_idx" ON "external_expenses" USING btree ("source_transaction_id");--> statement-breakpoint
CREATE INDEX "external_expenses_source_series_idx" ON "external_expenses" USING btree ("source_series_id");--> statement-breakpoint
CREATE INDEX "external_expenses_source_recurring_series_idx" ON "external_expenses" USING btree ("source_recurring_series_id");--> statement-breakpoint
CREATE INDEX "external_expenses_imported_transaction_idx" ON "external_expenses" USING btree ("imported_transaction_id");--> statement-breakpoint
CREATE INDEX "external_expenses_connection_idx" ON "external_expenses" USING btree ("connection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_expenses_source_transaction_allocation_unique" ON "external_expenses" USING btree ("owner_user_id","source_transaction_id","source_person_id") WHERE "external_expenses"."source_transaction_id" IS NOT NULL AND "external_expenses"."source_series_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "external_expenses_source_series_allocation_unique" ON "external_expenses" USING btree ("owner_user_id","source_series_id","source_person_id") WHERE "external_expenses"."source_series_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "external_expenses_source_recurring_occurrence_allocation_unique" ON "external_expenses" USING btree ("owner_user_id","source_recurring_series_id","source_occurrence_date","source_person_id") WHERE "external_expenses"."source_recurring_series_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "financial_accounts_user_id_archived_idx" ON "financial_accounts" USING btree ("user_id","is_archived");--> statement-breakpoint
CREATE INDEX "import_category_mappings_category_id_idx" ON "import_category_mappings" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inbox_items_user_id_client_id_unique" ON "inbox_items" USING btree ("user_id","client_id");--> statement-breakpoint
CREATE INDEX "inbox_items_user_id_status_notification_idx" ON "inbox_items" USING btree ("user_id","status","notification_timestamp" DESC NULLS LAST,"created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "inbox_items_user_id_status_source_notification_idx" ON "inbox_items" USING btree ("user_id","status","source_app_name","notification_timestamp" DESC NULLS LAST,"created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "inbox_items_device_token_id_idx" ON "inbox_items" USING btree ("device_token_id");--> statement-breakpoint
CREATE INDEX "inbox_items_transaction_id_idx" ON "inbox_items" USING btree ("transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inbox_rules_user_id_name_unique" ON "inbox_rules" USING btree ("user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "inbox_rules_id_user_id_unique" ON "inbox_rules" USING btree ("id","user_id");--> statement-breakpoint
CREATE INDEX "inbox_rules_user_id_active_priority_idx" ON "inbox_rules" USING btree ("user_id","is_active","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "installment_anticipation_items_transaction_unique" ON "installment_anticipation_items" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "installment_anticipation_items_user_id_idx" ON "installment_anticipation_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "installment_anticipations_user_series_idx" ON "installment_anticipations" USING btree ("user_id","series_id");--> statement-breakpoint
CREATE INDEX "installment_anticipations_adjustment_transaction_idx" ON "installment_anticipations" USING btree ("adjustment_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "installment_anticipations_id_user_id_unique" ON "installment_anticipations" USING btree ("id","user_id");--> statement-breakpoint
CREATE INDEX "installment_series_user_id_idx" ON "installment_series" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invoice_payment_allocations_payment_idx" ON "invoice_payment_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "invoice_payment_allocations_person_user_idx" ON "invoice_payment_allocations" USING btree ("person_id","user_id");--> statement-breakpoint
CREATE INDEX "invoice_payments_user_period_created_idx" ON "invoice_payments" USING btree ("user_id","period","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "invoice_payments_user_card_period_idx" ON "invoice_payments" USING btree ("user_id","card_id","period");--> statement-breakpoint
CREATE INDEX "invoice_payments_card_user_idx" ON "invoice_payments" USING btree ("card_id","user_id");--> statement-breakpoint
CREATE INDEX "invoice_payments_account_user_idx" ON "invoice_payments" USING btree ("account_id","user_id");--> statement-breakpoint
CREATE INDEX "invoice_payments_transaction_user_idx" ON "invoice_payments" USING btree ("transaction_id","user_id");--> statement-breakpoint
CREATE INDEX "invoices_user_id_period_idx" ON "invoices" USING btree ("user_id","period");--> statement-breakpoint
CREATE INDEX "invoices_card_id_period_idx" ON "invoices" USING btree ("card_id","period");--> statement-breakpoint
CREATE INDEX "invoices_payment_account_idx" ON "invoices" USING btree ("payment_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_user_id_card_id_period_unique" ON "invoices" USING btree ("user_id","card_id","period");--> statement-breakpoint
CREATE INDEX "note_items_user_id_note_id_position_idx" ON "note_items" USING btree ("user_id","note_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "note_items_note_id_position_unique" ON "note_items" USING btree ("note_id","position");--> statement-breakpoint
CREATE INDEX "notes_user_id_archived_updated_at_idx" ON "notes" USING btree ("user_id","is_archived","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notification_states_user_archived_idx" ON "notification_states" USING btree ("user_id","archived_at");--> statement-breakpoint
CREATE INDEX "passkey_user_id_idx" ON "passkey" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "passkey_credential_id_unique" ON "passkey" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "people_user_id_status_idx" ON "people" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "people_user_id_admin_unique" ON "people" USING btree ("user_id") WHERE "people"."role" = 'admin';--> statement-breakpoint
CREATE UNIQUE INDEX "person_connection_invitations_token_digest_unique" ON "person_connection_invitations" USING btree ("token_digest");--> statement-breakpoint
CREATE UNIQUE INDEX "person_connection_invitations_active_person_unique" ON "person_connection_invitations" USING btree ("owner_user_id","person_id") WHERE "person_connection_invitations"."status" in ('pending', 'claimed');--> statement-breakpoint
CREATE INDEX "person_connection_invitations_owner_status_idx" ON "person_connection_invitations" USING btree ("owner_user_id","status");--> statement-breakpoint
CREATE INDEX "person_connection_invitations_claimed_status_idx" ON "person_connection_invitations" USING btree ("claimed_by_user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "person_connections_active_person_unique" ON "person_connections" USING btree ("owner_user_id","person_id") WHERE "person_connections"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "person_connections_active_pair_unique" ON "person_connections" USING btree ("owner_user_id","recipient_user_id") WHERE "person_connections"."status" = 'active';--> statement-breakpoint
CREATE INDEX "person_connections_owner_status_idx" ON "person_connections" USING btree ("owner_user_id","status");--> statement-breakpoint
CREATE INDEX "person_connections_recipient_status_idx" ON "person_connections" USING btree ("recipient_user_id","status");--> statement-breakpoint
CREATE INDEX "person_settlements_user_person_received_idx" ON "person_settlements" USING btree ("user_id","person_id","received_at" DESC NULLS LAST,"created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "person_settlements_invoice_allocation_unique" ON "person_settlements" USING btree ("invoice_payment_allocation_id");--> statement-breakpoint
CREATE INDEX "recurring_transaction_occurrences_user_purchase_rule_idx" ON "recurring_transaction_occurrences" USING btree ("user_id","purchase_date","recurring_rule_id");--> statement-breakpoint
CREATE INDEX "recurring_transaction_occurrences_account_id_idx" ON "recurring_transaction_occurrences" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recurring_transaction_occurrences_rule_date_unique" ON "recurring_transaction_occurrences" USING btree ("recurring_rule_id","purchase_date");--> statement-breakpoint
CREATE INDEX "recurring_transaction_rules_user_status_start_idx" ON "recurring_transaction_rules" USING btree ("user_id","status","start_date");--> statement-breakpoint
CREATE INDEX "recurring_transaction_rules_person_id_idx" ON "recurring_transaction_rules" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "recurring_transaction_rules_series_id_idx" ON "recurring_transaction_rules" USING btree ("series_id");--> statement-breakpoint
CREATE INDEX "recurring_transaction_rules_account_id_idx" ON "recurring_transaction_rules" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "recurring_transaction_rules_card_id_idx" ON "recurring_transaction_rules" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "recurring_transaction_rules_category_id_idx" ON "recurring_transaction_rules" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "recurring_transaction_rules_source_account_id_idx" ON "recurring_transaction_rules" USING btree ("source_account_id");--> statement-breakpoint
CREATE INDEX "recurring_transaction_rules_destination_account_id_idx" ON "recurring_transaction_rules" USING btree ("destination_account_id");--> statement-breakpoint
CREATE INDEX "recurring_transaction_series_user_id_idx" ON "recurring_transaction_series" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recurring_transaction_splits_user_id_idx" ON "recurring_transaction_splits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recurring_transaction_splits_person_user_idx" ON "recurring_transaction_splits" USING btree ("person_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recurring_transaction_splits_rule_person_unique" ON "recurring_transaction_splits" USING btree ("recurring_rule_id","person_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transaction_attachments_user_id_idx" ON "transaction_attachments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transaction_attachments_attachment_id_idx" ON "transaction_attachments" USING btree ("attachment_id");--> statement-breakpoint
CREATE INDEX "transaction_refunds_source_user_idx" ON "transaction_refunds" USING btree ("source_transaction_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transaction_refunds_refund_transaction_unique" ON "transaction_refunds" USING btree ("refund_transaction_id");--> statement-breakpoint
CREATE INDEX "transaction_splits_user_id_idx" ON "transaction_splits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transaction_splits_person_id_user_id_idx" ON "transaction_splits" USING btree ("person_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transaction_splits_transaction_person_unique" ON "transaction_splits" USING btree ("transaction_id","person_id");--> statement-breakpoint
CREATE INDEX "transactions_user_period_order_idx" ON "transactions" USING btree ("user_id","period","purchase_date" DESC NULLS LAST,"created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "transactions_user_purchase_order_idx" ON "transactions" USING btree ("user_id","purchase_date" DESC NULLS LAST,"created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "transactions_user_id_type_period_idx" ON "transactions" USING btree ("user_id","type","period");--> statement-breakpoint
CREATE INDEX "transactions_person_id_idx" ON "transactions" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "transactions_account_id_idx" ON "transactions" USING btree ("account_id") WHERE "transactions"."account_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "transactions_card_id_idx" ON "transactions" USING btree ("card_id") WHERE "transactions"."card_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "transactions_category_id_idx" ON "transactions" USING btree ("category_id") WHERE "transactions"."category_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "transactions_source_account_id_idx" ON "transactions" USING btree ("source_account_id") WHERE "transactions"."source_account_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "transactions_destination_account_id_idx" ON "transactions" USING btree ("destination_account_id") WHERE "transactions"."destination_account_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "transactions_transfer_id_user_id_idx" ON "transactions" USING btree ("transfer_id","user_id") WHERE "transactions"."transfer_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "transactions_import_batch_user_id_idx" ON "transactions" USING btree ("import_batch_id","user_id") WHERE "transactions"."import_batch_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_import_source_external_user_unique" ON "transactions" USING btree ("user_id","import_source_fingerprint","import_external_id") WHERE "transactions"."import_external_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_user_id_series_current_installment_unique" ON "transactions" USING btree ("user_id","series_id","current_installment") WHERE "transactions"."series_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "transactions_recurring_rule_id_idx" ON "transactions" USING btree ("recurring_rule_id") WHERE "transactions"."recurring_rule_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_lower_unique" ON "user" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "user_preferences_default_account_id_idx" ON "user_preferences" USING btree ("default_account_id");--> statement-breakpoint
CREATE INDEX "user_preferences_default_card_id_idx" ON "user_preferences" USING btree ("default_card_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");
