-- TEST-ONLY: deadline in het verleden
UPDATE public.event_details SET early_bird_deadline = '2026-08-01T00:00:00Z' WHERE id = '17efe0cc-e8ec-45b8-b2c6-6d72122249bd';