DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM pg_catalog.pg_constraint
		WHERE conrelid = 'public.external_expenses'::regclass
			AND conname = 'shared_expenses_pkey'
	) AND NOT EXISTS (
		SELECT 1
		FROM pg_catalog.pg_constraint
		WHERE conrelid = 'public.external_expenses'::regclass
			AND conname = 'external_expenses_pkey'
	) THEN
		ALTER TABLE "public"."external_expenses"
			RENAME CONSTRAINT "shared_expenses_pkey" TO "external_expenses_pkey";
	END IF;
END $$;
