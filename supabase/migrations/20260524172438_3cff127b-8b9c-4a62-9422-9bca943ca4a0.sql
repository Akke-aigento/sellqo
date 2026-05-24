ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS oss_activation_date date;

UPDATE public.tenants
   SET oss_activation_date = oss_registration_date
 WHERE oss_activation_date IS NULL
   AND oss_registration_date IS NOT NULL;

UPDATE public.tenants
   SET oss_enabled = true,
       oss_activation_date = COALESCE(oss_activation_date, '2025-10-22'::date)
 WHERE id = '54f6b480-280b-42e1-b843-d5beb2831acd';

ALTER TABLE public.invoices DISABLE TRIGGER trigger_invoice_notification;
ALTER TABLE public.orders   DISABLE TRIGGER trigger_order_notification;
ALTER TABLE public.orders   DISABLE TRIGGER trigger_auto_tracking_email;
ALTER TABLE public.orders   DISABLE TRIGGER trigger_payment_notification;

WITH eu(code) AS (
  VALUES ('NL'),('DE'),('FR'),('IT'),('ES'),('LU'),('AT'),('PT'),('IE'),
         ('DK'),('SE'),('FI'),('EL'),('GR'),('CY'),('MT'),('SK'),('SI'),
         ('EE'),('LV'),('LT'),('PL'),('CZ'),('HU'),('RO'),('BG'),('HR')
)
UPDATE public.orders o
   SET vat_type    = 'oss_b2c_eu',
       vat_country = upper(o.shipping_address->>'country'),
       updated_at  = now()
 WHERE o.tenant_id = '54f6b480-280b-42e1-b843-d5beb2831acd'
   AND o.created_at >= '2025-10-22'
   AND lower(coalesce(o.customer_type::text,'b2c')) = 'b2c'
   AND upper(o.shipping_address->>'country') IN (SELECT code FROM eu)
   AND (o.status IS NULL OR o.status::text <> 'cancelled');

UPDATE public.invoices i
   SET vat_regime        = 'oss_b2c_eu',
       reporting_country = o.vat_country,
       updated_at        = now()
  FROM public.orders o
 WHERE i.order_id = o.id
   AND i.tenant_id = '54f6b480-280b-42e1-b843-d5beb2831acd'
   AND o.created_at >= '2025-10-22'
   AND o.vat_type = 'oss_b2c_eu';

ALTER TABLE public.invoices ENABLE TRIGGER trigger_invoice_notification;
ALTER TABLE public.orders   ENABLE TRIGGER trigger_order_notification;
ALTER TABLE public.orders   ENABLE TRIGGER trigger_auto_tracking_email;
ALTER TABLE public.orders   ENABLE TRIGGER trigger_payment_notification;