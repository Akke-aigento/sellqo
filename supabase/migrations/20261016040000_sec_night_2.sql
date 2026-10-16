-- SEC-NIGHT-2 — 16 oktober 2026
-- De publiek leesbare view tenant_theme_public (anon SELECT) gaf in custom_frontend_config
-- de sleutels api_key_hash, api_key_prefix en webhook_url van custom-frontend-tenants prijs.
-- Geen enkele lezer gebruikt die sleutels (rg op src + supabase/functions: 0 hits; de custom
-- frontends lezen de view niet, ze gaan via storefront-api). Fix: de drie sleutels uit de
-- jsonb filteren in de view. Zelfde kolommen, zelfde types, zelfde volgorde; de tabel
-- tenant_theme_settings blijft byte-voor-byte gelijk (eerste wet).
--
-- Idempotent. Terugdraaien: de vorige definitie staat in ops.sec_night_2_prev_view.

create schema if not exists ops;
create table if not exists ops.sec_night_2_prev_view (
  viewname text primary key,
  definition text not null,
  saved_at timestamptz not null default now()
);
insert into ops.sec_night_2_prev_view (viewname, definition)
values ('tenant_theme_public', pg_get_viewdef('public.tenant_theme_public'::regclass))
on conflict (viewname) do nothing;

create or replace view public.tenant_theme_public with (security_invoker = false) as
 select id, tenant_id, theme_id, use_custom_frontend, custom_frontend_url, logo_url, favicon_url, primary_color, secondary_color, accent_color, background_color, text_color, heading_font, body_font, header_style, show_announcement_bar, announcement_text, announcement_link, show_breadcrumbs, show_wishlist, product_card_style, products_per_row, footer_text, social_links, custom_css, is_published, published_at, created_at, updated_at, newsletter_enabled, newsletter_provider, newsletter_popup_enabled, newsletter_popup_delay_seconds, newsletter_incentive_text, checkout_guest_enabled, checkout_phone_required, checkout_company_field, checkout_address_autocomplete, product_image_zoom, product_variant_style, product_reviews_display, product_stock_indicator, product_related_mode, cookie_banner_enabled, cookie_banner_style, trust_badges, nav_style, header_sticky, search_display, mobile_bottom_nav, show_stock_count, show_viewers_count, show_recent_purchases, exit_intent_popup, storefront_multilingual_enabled, storefront_languages, storefront_default_language, storefront_language_selector_style, reviews_hub_enabled, reviews_display_platforms, reviews_aggregate_display, reviews_widget_position, reviews_floating_style, reviews_min_rating_filter, reviews_homepage_section, reviews_trust_bar_enabled, reviews_auto_feature_threshold, brand_color, theme_mode, theme_style, storefront_status,
    (custom_frontend_config - 'api_key_hash' - 'api_key_prefix' - 'webhook_url') as custom_frontend_config
   from tenant_theme_settings
  where (is_published = true);
