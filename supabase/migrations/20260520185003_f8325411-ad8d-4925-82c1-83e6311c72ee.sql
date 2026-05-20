ALTER TABLE public.vat_regimes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'vat_regimes'
      AND policyname = 'Anyone can read vat_regimes'
  ) THEN
    CREATE POLICY "Anyone can read vat_regimes"
      ON public.vat_regimes
      FOR SELECT
      USING (true);
  END IF;
END$$;