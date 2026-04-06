
-- Add 'refunded' to return_status enum
ALTER TYPE public.return_status ADD VALUE IF NOT EXISTS 'refunded';
