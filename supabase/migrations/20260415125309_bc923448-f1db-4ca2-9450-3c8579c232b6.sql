ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'partially_refunded';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'returned';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'partially_returned';