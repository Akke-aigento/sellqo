DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ticket_scans'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_scans;
  END IF;
END $$;
-- DOWN (handmatig): ALTER PUBLICATION supabase_realtime DROP TABLE public.ticket_scans;