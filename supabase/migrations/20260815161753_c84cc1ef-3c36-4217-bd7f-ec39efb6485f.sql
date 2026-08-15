-- TEST-ONLY cleanup: early-bird terug naar NULL + testcart verwijderen
UPDATE public.event_details SET early_bird_price = NULL, early_bird_deadline = NULL, early_bird_quantity = NULL WHERE id = '17efe0cc-e8ec-45b8-b2c6-6d72122249bd';
DELETE FROM public.storefront_cart_items WHERE cart_id = '223eb391-297a-40aa-b0c3-3a3d581a1540';
DELETE FROM public.storefront_carts WHERE id = '223eb391-297a-40aa-b0c3-3a3d581a1540';