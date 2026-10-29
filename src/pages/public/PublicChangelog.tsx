import { useState } from 'react';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Sparkles, Bug, Zap, Shield, ChevronDown, ChevronUp, Link as LinkIcon, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';

// Structural changelog. Titles/descriptions and dates are localized via i18n.
const changelogEntries: Array<{
  version: string;
  dateKey: string;
  changes: Array<{ id: string; type: 'feature' | 'improvement' | 'bugfix' | 'security' }>;
}> = [
  { version: '2026.14f', dateKey: 'oct_2026', changes: [
    { id: 'bottom_nav_choice', type: 'feature' },
  ]},
  { version: '2026.14e', dateKey: 'oct_2026', changes: [
    { id: 'horeca_walkthrough', type: 'improvement' },
  ]},
  { version: '2026.14d', dateKey: 'oct_2026', changes: [
    { id: 'horeca_printers_receipts', type: 'feature' },
  ]},
  { version: '2026.14c', dateKey: 'oct_2026', changes: [
    { id: 'horeca_menu_layout', type: 'improvement' },
  ]},
  { version: '2026.14b', dateKey: 'oct_2026', changes: [
    { id: 'horeca_device_alerts', type: 'feature' },
  ]},
  { version: '2026.14a', dateKey: 'oct_2026', changes: [
    { id: 'horeca_check_online_pay', type: 'feature' },
  ]},
  { version: '2026.13z', dateKey: 'oct_2026', changes: [
    { id: 'horeca_qr_tab', type: 'feature' },
    { id: 'horeca_qr_menu_visible', type: 'improvement' },
  ]},
  { version: '2026.13y', dateKey: 'oct_2026', changes: [
    { id: 'horeca_payments_transfer', type: 'feature' },
  ]},
  { version: '2026.13x', dateKey: 'oct_2026', changes: [
    { id: 'horeca_workspace', type: 'improvement' },
  ]},
  { version: '2026.13w', dateKey: 'oct_2026', changes: [
    { id: 'order_tickets_status_resend', type: 'improvement' },
  ]},
  { version: '2026.13v', dateKey: 'oct_2026', changes: [
    { id: 'horeca_menu_add_fix', type: 'bugfix' },
    { id: 'horeca_menu_first', type: 'improvement' },
  ]},
  { version: '2026.13u', dateKey: 'oct_2026', changes: [
    { id: 'horeca_menu_panel', type: 'improvement' },
  ]},
  { version: '2026.13t', dateKey: 'oct_2026', changes: [
    { id: 'kassa_product_quick_edit', type: 'improvement' },
  ]},
  { version: '2026.13s', dateKey: 'oct_2026', changes: [
    { id: 'horeca_menu_editor', type: 'feature' },
  ]},
  { version: '2026.13r', dateKey: 'oct_2026', changes: [
    { id: 'kassa_counter_reports', type: 'feature' },
  ]},
  { version: '2026.13q', dateKey: 'oct_2026', changes: [
    { id: 'kassa_device_status', type: 'improvement' },
  ]},
  { version: '2026.13p', dateKey: 'oct_2026', changes: [
    { id: 'table_payment', type: 'feature' },
  ]},
  { version: '2026.13o', dateKey: 'oct_2026', changes: [
    { id: 'table_checks', type: 'feature' },
  ]},
  { version: '2026.13n', dateKey: 'oct_2026', changes: [
    { id: 'kassa_staff_pin', type: 'feature' },
  ]},
  { version: '2026.13m', dateKey: 'oct_2026', changes: [
    { id: 'floor_plan_tables', type: 'feature' },
  ]},
  { version: '2026.13l', dateKey: 'oct_2026', changes: [
    { id: 'horeca_table_order_clean', type: 'bugfix' },
    { id: 'kitchen_screen_responsive', type: 'improvement' },
    { id: 'no_white_screen', type: 'improvement' },
    { id: 'pos_offline_queue_safe', type: 'bugfix' },
  ]},
  { version: '2026.13k', dateKey: 'oct_2026', changes: [
    { id: 'event_reminder_whatsapp', type: 'feature' },
  ]},
  { version: '2026.13j', dateKey: 'oct_2026', changes: [
    { id: 'cockpit_dashboard', type: 'feature' },
  ]},
  { version: '2026.13i', dateKey: 'oct_2026', changes: [
    { id: 'events_door_honest', type: 'improvement' },
    { id: 'product_vat_margin', type: 'feature' },
    { id: 'discount_dates_scope', type: 'bugfix' },
    { id: 'exports_all_rows', type: 'bugfix' },
    { id: 'save_no_permission', type: 'bugfix' },
    { id: 'settings_translated', type: 'improvement' },
    { id: 'seo_generator_fixed', type: 'bugfix' },
    { id: 'shipping_providers_clear', type: 'improvement' },
    { id: 'admin_small_fixes', type: 'bugfix' },
    { id: 'access_hardening', type: 'security' },
  ] },
  { version: '2026.13h', dateKey: 'oct_2026', changes: [
    { id: 'size_chart_standard', type: 'feature' },
  ] },
  { version: '2026.13g', dateKey: 'oct_2026', changes: [
    { id: 'cart_current_price', type: 'bugfix' },
  ] },
  { version: '2026.13f', dateKey: 'oct_2026', changes: [
    { id: 'inbox_mobile_list', type: 'bugfix' },
    { id: 'product_view_readonly', type: 'bugfix' },
  ] },
  { version: '2026.13e', dateKey: 'oct_2026', changes: [
    { id: 'pdf_special_characters', type: 'bugfix' },
  ] },
  { version: '2026.13d', dateKey: 'oct_2026', changes: [
    { id: 'email_page_tabs', type: 'improvement' },
    { id: 'email_logo_existing', type: 'improvement' },
  ] },
  { version: '2026.13c', dateKey: 'oct_2026', changes: [
    { id: 'email_signup_cleanup', type: 'improvement' },
  ] },
  { version: '2026.13b', dateKey: 'oct_2026', changes: [
    { id: 'email_logo_header', type: 'improvement' },
  ] },
  { version: '2026.13a', dateKey: 'oct_2026', changes: [
    { id: 'email_cart_restore', type: 'feature' },
  ] },
  { version: '2026.12z', dateKey: 'oct_2026', changes: [
    { id: 'email_limit_visible', type: 'improvement' },
  ] },
  { version: '2026.12y', dateKey: 'oct_2026', changes: [
    { id: 'email_product_blocks', type: 'feature' },
    { id: 'email_ab_subject', type: 'feature' },
  ] },
  { version: '2026.12x', dateKey: 'oct_2026', changes: [
    { id: 'email_automations', type: 'feature' },
  ] },
  { version: '2026.12w', dateKey: 'oct_2026', changes: [
    { id: 'email_subscribers_tab', type: 'feature' },
    { id: 'email_editor_improvements', type: 'improvement' },
    { id: 'mail_pages_fixed', type: 'bugfix' },
  ] },
  { version: '2026.12v', dateKey: 'oct_2026', changes: [
    { id: 'email_campaigns_reliable', type: 'bugfix' },
    { id: 'newsletter_double_optin', type: 'security' },
  ] },
  { version: '2026.12u', dateKey: 'oct_2026', changes: [
    { id: 'social_reminder_on_time', type: 'improvement' },
  ] },
  { version: '2026.12t', dateKey: 'oct_2026', changes: [
    { id: 'plan_limits', type: 'improvement' },
  ] },
  { version: '2026.12s', dateKey: 'oct_2026', changes: [
    { id: 'addon_billing', type: 'improvement' },
  ] },
  { version: '2026.12r', dateKey: 'oct_2026', changes: [
    { id: 'horeca_channels', type: 'feature' },
  ] },
  { version: '2026.12q', dateKey: 'oct_2026', changes: [
    { id: 'plans_tracks', type: 'feature' },
  ] },
  { version: '2026.12p', dateKey: 'oct_2026', changes: [
    { id: 'sidebar_cleanup', type: 'improvement' },
  ] },
  { version: '2026.12o', dateKey: 'oct_2026', changes: [
    { id: 'social_ai_one_button', type: 'improvement' },
  ] },
  { version: '2026.12n', dateKey: 'oct_2026', changes: [
    { id: 'marketing_one_whole', type: 'improvement' },
    { id: 'social_ai_needs_approval', type: 'bugfix' },
  ] },
  { version: '2026.12m', dateKey: 'oct_2026', changes: [
    { id: 'social_results_content', type: 'improvement' },
  ] },
  { version: '2026.12l', dateKey: 'oct_2026', changes: [
    { id: 'social_results', type: 'feature' },
  ] },
  { version: '2026.12k', dateKey: 'oct_2026', changes: [
    { id: 'media_library_ai_social', type: 'improvement' },
  ] },
  { version: '2026.12j', dateKey: 'oct_2026', changes: [
    { id: 'media_library_all_photos', type: 'feature' },
    { id: 'photo_standard', type: 'feature' },
    { id: 'photo_editor_frame', type: 'improvement' },
  ] },
  { version: '2026.12i', dateKey: 'oct_2026', changes: [
    { id: 'token_wallet_cancel_order', type: 'improvement' },
  ] },
  { version: '2026.12h', dateKey: 'oct_2026', changes: [
    { id: 'subscription_cancel_period_end', type: 'bugfix' },
    { id: 'subscription_cancel_undo', type: 'feature' },
  ] },
  { version: '2026.12g', dateKey: 'oct_2026', changes: [
    { id: 'image_picker_media_library', type: 'feature' },
  ] },
  { version: '2026.12f', dateKey: 'oct_2026', changes: [
    { id: 'homepage_sections_slideshow_logos_columns', type: 'feature' },
  ] },
  { version: '2026.12e', dateKey: 'oct_2026', changes: [
    { id: 'admin_dead_controls_cleanup', type: 'improvement' },
  ] },
  { version: '2026.12d', dateKey: 'oct_2026', changes: [
    { id: 'ticket_order_cancel_delivered', type: 'improvement' },
    { id: 'free_checkout_faster', type: 'improvement' },
  ] },
  { version: '2026.12c', dateKey: 'oct_2026', changes: [
    { id: 'door_scanner_bad_network', type: 'improvement' },
  ] },
  { version: '2026.12b', dateKey: 'oct_2026', changes: [
    { id: 'event_admin_tickets', type: 'improvement' },
    { id: 'ticket_cancel_ordernumbers', type: 'bugfix' },
  ] },
  { version: '2026.12a', dateKey: 'oct_2026', changes: [
    { id: 'social_post_now', type: 'feature' },
  ] },
  { version: '2026.11z', dateKey: 'oct_2026', changes: [
    { id: 'social_media_language', type: 'improvement' },
  ] },
  { version: '2026.11y', dateKey: 'oct_2026', changes: [
    { id: 'social_image_text', type: 'feature' },
  ] },
  { version: '2026.11x', dateKey: 'oct_2026', changes: [
    { id: 'social_songs_language', type: 'improvement' },
  ] },
  { version: '2026.11w', dateKey: 'oct_2026', changes: [
    { id: 'social_reels_reminders', type: 'feature' },
  ] },
  { version: '2026.11v', dateKey: 'oct_2026', changes: [
    { id: 'social_planning_approval', type: 'feature' },
  ] },
  { version: '2026.11u', dateKey: 'oct_2026', changes: [
    { id: 'social_posts_published', type: 'feature' },
  ] },
  { version: '2026.11t', dateKey: 'oct_2026', changes: [
    { id: 'door_scanner_auto', type: 'feature' },
  ] },
  { version: '2026.11s', dateKey: 'oct_2026', changes: [
    { id: 'ticket_orders_auto_complete', type: 'improvement' },
  ] },
  { version: '2026.11r', dateKey: 'oct_2026', changes: [
    { id: 'shipping_health_dashboard_translated', type: 'improvement' },
  ] },
  { version: '2026.11q', dateKey: 'oct_2026', changes: [
    { id: 'discount_once_per_customer', type: 'bugfix' },
  ] },
  { version: '2026.11p', dateKey: 'oct_2026', changes: [
    { id: 'translated_labels_and_event_menu', type: 'improvement' },
  ] },
  { version: '2026.11o', dateKey: 'oct_2026', changes: [
    { id: 'ticket_mail_after_manual_payment', type: 'bugfix' },
  ] },
  { version: '2026.11n', dateKey: 'oct_2026', changes: [
    { id: 'festival_combos_and_tokens', type: 'feature' },
  ] },
  { version: '2026.11m', dateKey: 'oct_2026', changes: [
    { id: 'themes_and_examples', type: 'feature' },
  ] },
  { version: '2026.11l', dateKey: 'oct_2026', changes: [
    { id: 'seating_plans', type: 'feature' },
  ] },
  { version: '2026.11k', dateKey: 'oct_2026', changes: [
    { id: 'event_workspace', type: 'improvement' },
  ] },
  { version: '2026.11j', dateKey: 'oct_2026', changes: [
    { id: 'event_wizard_and_door_scanner', type: 'feature' },
  ] },
  { version: '2026.11i', dateKey: 'oct_2026', changes: [
    { id: 'event_dates_ready_to_sell', type: 'improvement' },
  ] },
  { version: '2026.11h', dateKey: 'oct_2026', changes: [
    { id: 'shipping_email_customer_language', type: 'improvement' },
  ] },
  { version: '2026.11g', dateKey: 'sep_2026', changes: [
    { id: 'web_app_push', type: 'feature' },
  ] },
  { version: '2026.11f', dateKey: 'sep_2026', changes: [
    { id: 'all_messages_in_inbox', type: 'improvement' },
  ] },
  { version: '2026.11e', dateKey: 'sep_2026', changes: [
    { id: 'notification_opens_item', type: 'improvement' },
  ] },
  { version: '2026.11d', dateKey: 'sep_2026', changes: [
    { id: 'notifications_on_by_default', type: 'improvement' },
  ] },
  { version: '2026.11c', dateKey: 'sep_2026', changes: [
    { id: 'contact_form_notification', type: 'improvement' },
  ] },
  { version: '2026.11b', dateKey: 'sep_2026', changes: [
    { id: 'customer_replies_inbox', type: 'feature' },
  ] },
  { version: '2026.11a', dateKey: 'sep_2026', changes: [
    { id: 'customer_contact_email', type: 'feature' },
  ] },
  { version: '2026.10z', dateKey: 'sep_2026', changes: [
    { id: 'notifications_follow_role', type: 'security' },
  ] },
  { version: '2026.10y', dateKey: 'sep_2026', changes: [
    { id: 'push_per_user', type: 'improvement' },
  ] },
  { version: '2026.10x', dateKey: 'sep_2026', changes: [
    { id: 'push_notifications_live', type: 'feature' },
    { id: 'push_notifications_multi_shop', type: 'improvement' },
  ] },
  { version: '2026.10w', dateKey: 'sep_2026', changes: [
    { id: 'admin_bottom_nav_permissions', type: 'security' },
    { id: 'admin_floating_bottom_nav', type: 'improvement' },
  ] },
  { version: '2026.10v', dateKey: 'sep_2026', changes: [
    { id: 'return_emails_delivered', type: 'bugfix' },
    { id: 'merchant_payout_pages', type: 'bugfix' },
    { id: 'app_shop_preview_stays', type: 'bugfix' },
    { id: 'bol_ads_period_filter', type: 'bugfix' },
  ] },
  { version: '2026.10u', dateKey: 'sep_2026', changes: [
    { id: 'subscription_invoice_vat_regime', type: 'bugfix' },
  ] },
  { version: '2026.10t', dateKey: 'sep_2026', changes: [
    { id: 'storefront_customer_email_verification', type: 'security' },
  ] },
  { version: '2026.10s', dateKey: 'sep_2026', changes: [
    { id: 'marketing_role_multilingual', type: 'improvement' },
    { id: 'admin_dates_follow_language', type: 'improvement' },
  ] },
  { version: '2026.10r', dateKey: 'sep_2026', changes: [
    { id: 'ai_daily_menu_generator', type: 'feature' },
    { id: 'ai_image_tenant_check', type: 'security' },
  ] },
  { version: '2026.10q', dateKey: 'sep_2026', changes: [
    { id: 'ai_content_menu_brand_dna', type: 'feature' },
  ] },
  { version: '2026.10p', dateKey: 'sep_2026', changes: [
    { id: 'event_quick_actions_and_dashboard_filter', type: 'feature' },
  ] },
  { version: '2026.10o', dateKey: 'sep_2026', changes: [
    { id: 'event_checkin_double_scan_and_menu', type: 'bugfix' },
  ] },
  { version: '2026.10n', dateKey: 'sep_2026', changes: [
    { id: 'cart_discount_totals', type: 'improvement' },
  ] },
  { version: '2026.10m', dateKey: 'sep_2026', changes: [
    { id: 'discount_code_case_insensitive', type: 'bugfix' },
  ] },
  { version: '2026.10l', dateKey: 'sep_2026', changes: [
    { id: 'event_core_fields_and_live_counter', type: 'feature' },
  ] },
  { version: '2026.10k', dateKey: 'sep_2026', changes: [
    { id: 'event_scanner_access_management', type: 'feature' },
  ] },
  { version: '2026.10j', dateKey: 'sep_2026', changes: [
    { id: 'event_ticket_types_management', type: 'feature' },
  ] },
  { version: '2026.10i', dateKey: 'sep_2026', changes: [
    { id: 'event_detail_page', type: 'feature' },
  ] },
  { version: '2026.10h', dateKey: 'sep_2026', changes: [
    { id: 'settings_multilingual', type: 'improvement' },
  ] },
  { version: '2026.10g', dateKey: 'sep_2026', changes: [
    { id: 'auth_navigation_multilingual', type: 'improvement' },
  ] },
  { version: '2026.10f', dateKey: 'sep_2026', changes: [
    { id: 'ukrainian_language', type: 'feature' },
  ] },
  { version: '2026.10e', dateKey: 'sep_2026', changes: [
    { id: 'interface_label_display', type: 'bugfix' },
  ] },
  { version: '2026.10d', dateKey: 'sep_2026', changes: [
    { id: 'marketing_product_editing', type: 'improvement' },
  ] },
  { version: '2026.10c', dateKey: 'sep_2026', changes: [
    { id: 'personal_settings_and_reports', type: 'improvement' },
  ] },
  { version: '2026.10b', dateKey: 'sep_2026', changes: [
    { id: 'promotion_permission_scope', type: 'security' },
  ] },
  { version: '2026.10a', dateKey: 'sep_2026', changes: [
    { id: 'sepa_mandate_context', type: 'improvement' },
  ] },
  { version: '2026.09z', dateKey: 'sep_2026', changes: [
    { id: 'ticket_signup_counter', type: 'improvement' },
  ] },
  { version: '2026.09y', dateKey: 'sep_2026', changes: [
    { id: 'ticket_smart_date_actions', type: 'feature' },
  ] },
  { version: '2026.09x', dateKey: 'sep_2026', changes: [
    { id: 'ticket_product_dates', type: 'feature' },
  ] },
  { version: '2026.09w', dateKey: 'sep_2026', changes: [
    { id: 'odoo_oss_credit_note_tax', type: 'bugfix' },
  ] },
  { version: '2026.09v', dateKey: 'sep_2026', changes: [
    { id: 'odoo_oss_tax_selection', type: 'bugfix' },
  ] },
  { version: '2026.09u', dateKey: 'sep_2026', changes: [
    { id: 'guest_checkout_vat_classification', type: 'bugfix' },
  ] },
  { version: '2026.09t', dateKey: 'sep_2026', changes: [
    { id: 'storefront_section_buttons', type: 'bugfix' },
  ] },
  { version: '2026.09s', dateKey: 'sep_2026', changes: [
    { id: 'checkout_country_list', type: 'improvement' },
  ] },
  { version: '2026.09r', dateKey: 'sep_2026', changes: [
    { id: 'vat_checkout_parity', type: 'bugfix' },
  ] },
  { version: '2026.09q', dateKey: 'sep_2026', changes: [
    { id: 'shipping_countries', type: 'feature' },
  ] },
  { version: '2026.09p', dateKey: 'sep_2026', changes: [
    { id: 'pos_vat_calculation_fix', type: 'bugfix' },
  ] },
  { version: '2026.09o', dateKey: 'sep_2026', changes: [
    { id: 'admin_headers_mobile', type: 'improvement' },
  ] },
  { version: '2026.09n', dateKey: 'sep_2026', changes: [
    { id: 'pos_mobile_layout', type: 'improvement' },
  ] },
  { version: '2026.09m', dateKey: 'sep_2026', changes: [
    { id: 'product_page_mobile_fix', type: 'bugfix' },
  ] },
  { version: '2026.09l', dateKey: 'sep_2026', changes: [
    { id: 'wide_table_scroll_fix', type: 'bugfix' },
  ] },
  { version: '2026.09k', dateKey: 'sep_2026', changes: [
    { id: 'dialog_viewport_fix', type: 'bugfix' },
  ] },
  { version: '2026.09j', dateKey: 'sep_2026', changes: [
    { id: 'printful_product_import', type: 'feature' },
  ] },
  { version: '2026.09i', dateKey: 'sep_2026', changes: [
    { id: 'printful_shipping_updates', type: 'feature' },
  ] },
  { version: '2026.09h', dateKey: 'sep_2026', changes: [
    { id: 'printful_order_forwarding', type: 'feature' },
  ] },
  { version: '2026.09g', dateKey: 'sep_2026', changes: [
    { id: 'printful_pod', type: 'feature' },
    { id: 'connect_availability', type: 'improvement' },
  ] },
  { version: '2026.09f', dateKey: 'sep_2026', changes: [{ id: 'legal_pages_fix', type: 'bugfix' }] },
  { version: '2026.09e', dateKey: 'sep_2026', changes: [{ id: 'security_compliance_docs', type: 'improvement' }] },
  { version: '2026.09d', dateKey: 'sep_2026', changes: [{ id: 'app_notification_settings', type: 'improvement' }] },
  { version: '2026.09c', dateKey: 'sep_2026', changes: [{ id: 'sellqo_blog', type: 'feature' }] },
  { version: '2026.09b', dateKey: 'sep_2026', changes: [{ id: 'platform_newsletter_preference', type: 'improvement' }] },
  { version: '2026.09a', dateKey: 'sep_2026', changes: [{ id: 'customer_invoice_email_fix', type: 'bugfix' }] },
  { version: '2026.08aj', dateKey: 'aug_2026', changes: [{ id: 'onboarding_existing_customer_fix', type: 'bugfix' }] },
  { version: '2026.08ai', dateKey: 'aug_2026', changes: [{ id: 'onboarding_stays_on_track', type: 'bugfix' }] },
  { version: '2026.08ah', dateKey: 'aug_2026', changes: [{ id: 'onboarding_no_double_create', type: 'bugfix' }] },
  { version: '2026.08ag', dateKey: 'aug_2026', changes: [{ id: 'tenant_delete_cascade', type: 'improvement' }] },
  { version: '2026.08af', dateKey: 'aug_2026', changes: [{ id: 'onboarding_full_flow', type: 'bugfix' }] },
  { version: '2026.08ae', dateKey: 'aug_2026', changes: [{ id: 'onboarding_nav_ready', type: 'bugfix' }] },
  { version: '2026.08ad', dateKey: 'aug_2026', changes: [{ id: 'auth_session_stability', type: 'bugfix' }] },
  { version: '2026.08ac', dateKey: 'aug_2026', changes: [{ id: 'login_setup_polish', type: 'improvement' }] },
  { version: '2026.08ab', dateKey: 'aug_2026', changes: [{ id: 'b2b_checkout_custom_frontends', type: 'feature' }] },
  { version: '2026.08aa', dateKey: 'aug_2026', changes: [{ id: 'b2b_vat_reverse_charge_fix', type: 'security' }] },
  { version: '2026.08z', dateKey: 'aug_2026', changes: [{ id: 'billing_engine_migration', type: 'improvement' }] },
  { version: '2026.08y', dateKey: 'aug_2026', changes: [{ id: 'payment_return_experience', type: 'improvement' }] },
  { version: '2026.08x', dateKey: 'aug_2026', changes: [{ id: 'vat_display_consistency', type: 'bugfix' }] },
  { version: '2026.08w', dateKey: 'aug_2026', changes: [{ id: 'billing_document_polish', type: 'bugfix' }] },
  { version: '2026.08v', dateKey: 'aug_2026', changes: [{ id: 'billing_documents', type: 'improvement' }] },
  { version: '2026.08u', dateKey: 'aug_2026', changes: [{ id: 'pay_first_upgrades', type: 'improvement' }] },
  { version: '2026.08t', dateKey: 'aug_2026', changes: [{ id: 'payment_landing_pages', type: 'bugfix' }] },
  { version: '2026.08s', dateKey: 'aug_2026', changes: [{ id: 'direct_mandate_redirect', type: 'improvement' }] },
  { version: '2026.08r', dateKey: 'aug_2026', changes: [{ id: 'trial_pro_features', type: 'improvement' }] },
  { version: '2026.08q', dateKey: 'aug_2026', changes: [{ id: 'unified_plan_activation', type: 'improvement' }] },
  { version: '2026.08p', dateKey: 'aug_2026', changes: [{ id: 'self_service_billing', type: 'feature' }] },
  { version: '2026.08o', dateKey: 'aug_2026', changes: [{ id: 'subscription_payment_requests', type: 'feature' }] },
  { version: '2026.08n', dateKey: 'aug_2026', changes: [{ id: 'plan_changes_via_team', type: 'improvement' }] },
  { version: '2026.08m', dateKey: 'aug_2026', changes: [{ id: 'subscription_instant_payment_invoice', type: 'feature' }] },
  { version: '2026.08l', dateKey: 'aug_2026', changes: [{ id: 'subscription_payment_options_foundation', type: 'feature' }] },
  { version: '2026.08k', dateKey: 'aug_2026', changes: [{ id: 'upgrade_invoice_docs_email', type: 'bugfix' }] },
  { version: '2026.08j', dateKey: 'aug_2026', changes: [{ id: 'plan_interval_switch_billing', type: 'bugfix' }] },
  { version: '2026.08i', dateKey: 'aug_2026', changes: [{ id: 'stock_ledger', type: 'feature' }] },
  { version: '2026.08h', dateKey: 'aug_2026', changes: [{ id: 'stock_report', type: 'feature' }] },
  { version: '2026.08g', dateKey: 'aug_2026', changes: [{ id: 'refund_button_states', type: 'bugfix' }] },
  { version: '2026.08f', dateKey: 'aug_2026', changes: [{ id: 'refund_cn_fix', type: 'bugfix' }] },
  { version: '2026.08e', dateKey: 'aug_2026', changes: [{ id: 'shipping_classes_entity', type: 'feature' }] },
  { version: '2026.08d', dateKey: 'aug_2026', changes: [{ id: 'shipping_cost_preview', type: 'improvement' }] },
  { version: '2026.08c', dateKey: 'aug_2026', changes: [{ id: 'variant_photo_gallery', type: 'feature' }] },
  { version: '2026.08b', dateKey: 'aug_2026', changes: [{ id: 'credit_note_button_fix', type: 'bugfix' }] },
  { version: '2026.08a', dateKey: 'aug_2026', changes: [{ id: 'invoice_refund', type: 'feature' }] },
  { version: '2026.07al', dateKey: 'jul_2026', changes: [{ id: 'sec_rpc_authorization_guards', type: 'security' }] },
  { version: '2026.07ak', dateKey: 'jul_2026', changes: [{ id: 'per_user_discount_rights', type: 'feature' }] },
  { version: '2026.07aj', dateKey: 'jul_2026', changes: [{ id: 'shipping_label_downloads', type: 'bugfix' }] },
  { version: '2026.07ai', dateKey: 'jul_2026', changes: [{ id: 'sec_role_scoped_reads', type: 'security' }] },
  { version: '2026.07ah', dateKey: 'jul_2026', changes: [{ id: 'sec_marketing_role_scope', type: 'security' }] },
  { version: '2026.07ag', dateKey: 'jul_2026', changes: [{ id: 'sec_tenant_scoped_files', type: 'security' }] },
  { version: '2026.07af', dateKey: 'jul_2026', changes: [{ id: 'sec_internal_rpc_hardening', type: 'security' }] },
  { version: '2026.07ae', dateKey: 'jul_2026', changes: [{ id: 'password_reset', type: 'feature' }] },
  { version: '2026.07ad', dateKey: 'jul_2026', changes: [{ id: 'shipping_classes', type: 'feature' }] },
  { version: '2026.07ac', dateKey: 'jul_2026', changes: [{ id: 'sec_signed_documents', type: 'security' }] },
  { version: '2026.07ab', dateKey: 'jul_2026', changes: [{ id: 'sec_internal_endpoints', type: 'security' }] },
  { version: '2026.07aa', dateKey: 'jul_2026', changes: [{ id: 'help_assistant_links', type: 'bugfix' }] },
  { version: '2026.07z', dateKey: 'jul_2026', changes: [{ id: 'help_assistant_free', type: 'improvement' }] },
  { version: '2026.07y', dateKey: 'jul_2026', changes: [{ id: 'bol_label_integrity', type: 'bugfix' }] },
  { version: '2026.07x', dateKey: 'jul_2026', changes: [{ id: 'auth_refresh_fix', type: 'bugfix' }] },
  { version: '2026.07k', dateKey: 'jul_2026', changes: [{ id: 'import_guide', type: 'improvement' }] },
  { version: '2026.07j', dateKey: 'jul_2026', changes: [{ id: 'reliable_notifications', type: 'bugfix' }] },
  { version: '2026.07i', dateKey: 'jul_2026', changes: [{ id: 'reliable_import', type: 'improvement' }] },
  { version: '2026.07h', dateKey: 'jul_2026', changes: [{ id: 'connect_overview', type: 'improvement' }] },
  { version: '2026.07g', dateKey: 'jul_2026', changes: [{ id: 'accurate_stats', type: 'improvement' }] },
  { version: '2026.07f', dateKey: 'jul_2026', changes: [{ id: 'odoo_draft_mode', type: 'improvement' }] },
  { version: '2026.07e', dateKey: 'jul_2026', changes: [{ id: 'channel_visibility', type: 'feature' }] },
  { version: '2026.07d', dateKey: 'jul_2026', changes: [{ id: 'language_switcher', type: 'improvement' }] },
  { version: '2026.07c', dateKey: 'jul_2026', changes: [{ id: 'odoo_accounting', type: 'feature' }] },
  { version: '2026.07b', dateKey: 'jul_2026', changes: [{ id: 'peppol_status', type: 'improvement' }] },
  { version: '2026.07a', dateKey: 'jul_2026', changes: [{ id: 'billing_sepa', type: 'feature' }] },
  { version: '2026.q2', dateKey: 'q2_2026', changes: [{ id: 'sec_role_aware_rls', type: 'security' }] },
  { version: '2025.q1', dateKey: 'q1_2025', changes: [
    { id: 'shop_health', type: 'feature' },
    { id: 'visual_editor', type: 'feature' },
    { id: 'ai_coach', type: 'feature' },
    { id: 'unified_inbox', type: 'feature' },
  ]},
  { version: '2024.q4', dateKey: 'q4_2024', changes: [
    { id: 'bol_vvb', type: 'feature' },
    { id: 'pos', type: 'feature' },
  ]},
];

const typeStyle = {
  feature: { icon: Sparkles, className: 'bg-green-500/10 text-green-600 border-green-500/20' },
  improvement: { icon: Zap, className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  bugfix: { icon: Bug, className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  security: { icon: Shield, className: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
} as const;

const filterIds = ['all', 'feature', 'improvement', 'bugfix', 'security'] as const;

export default function PublicChangelog() {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState('all');
  const [expandedVersions, setExpandedVersions] = useState<string[]>([changelogEntries[0].version]);
  const [email, setEmail] = useState('');
  const [isSubscribing, setIsSubscribing] = useState(false);

  const typeLabel = (type: string) => t(`public.changelog.types.${type}`);

  const toggleVersion = (version: string) => {
    setExpandedVersions(prev => 
      prev.includes(version) 
        ? prev.filter(v => v !== version)
        : [...prev, version]
    );
  };

  const copyLink = (version: string) => {
    const url = `${window.location.origin}/changelog#v${version}`;
    navigator.clipboard.writeText(url);
    toast.success(t('public.changelog.copySuccess'));
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke('changelog-subscribe', {
        body: { email: email.trim().toLowerCase() },
      });
      if (error || (data && data.success === false)) {
        throw new Error(error?.message ?? 'subscribe_failed');
      }
      toast.success(t('public.changelog.subscribeSuccess'));
      setEmail('');
    } catch (err) {
      console.error('changelog subscribe error:', err);
      toast.error(t('public.changelog.subscribeError'));
    } finally {
      setIsSubscribing(false);
    }
  };

  // Filter entries
  const filteredEntries = changelogEntries.map(entry => ({
    ...entry,
    changes: activeFilter === 'all' 
      ? entry.changes 
      : entry.changes.filter(c => c.type === activeFilter)
  })).filter(entry => entry.changes.length > 0);

  return (
    <PublicPageLayout 
      title={t('public.changelog.title')}
      subtitle={t('public.changelog.subtitle')}
    >
      {/* Filters */}
      <div className="max-w-3xl mx-auto mb-8">
        <div className="flex flex-wrap justify-center gap-2">
          {filterIds.map((filterId) => (
            <button
              key={filterId}
              onClick={() => setActiveFilter(filterId)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeFilter === filterId
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {t(`public.changelog.filters.${filterId}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto">
        {filteredEntries.map((entry, index) => {
          const isExpanded = expandedVersions.includes(entry.version);
          
          return (
            <div 
              key={index} 
              id={`v${entry.version}`}
              className="mb-8 relative scroll-mt-24"
            >
              {/* Timeline line */}
              {index < filteredEntries.length - 1 && (
                <div className="absolute left-4 top-12 bottom-0 w-0.5 bg-border" />
              )}
              
              {/* Version header */}
              <button
                onClick={() => toggleVersion(entry.version)}
                className="flex items-center gap-4 mb-4 w-full text-left group"
              >
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-bold text-sm z-10">
                  {entry.version.split('.')[1]}
                </div>
                <div className="flex-1 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-foreground group-hover:text-accent transition-colors">
                      {t('public.changelog.version', { version: entry.version })}
                    </h2>
                    <p className="text-sm text-muted-foreground">{t(`public.changelog.dates.${entry.dateKey}`)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyLink(entry.version);
                      }}
                      className="p-2 hover:bg-secondary rounded-lg transition-colors"
                      title={t('public.changelog.copyLink')}
                    >
                      <LinkIcon className="w-4 h-4 text-muted-foreground" />
                    </button>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </button>

              {/* Changes */}
              {isExpanded && (
                <div className="ml-12 space-y-3 animate-fade-in">
                  {entry.changes.map((change, i) => {
                    const style = typeStyle[change.type];
                    const Icon = style.icon;
                    return (
                      <div key={i} className="bg-card rounded-lg border border-border p-4">
                        <div className="flex items-start gap-3">
                          <Badge variant="outline" className={style.className}>
                            <Icon className="w-3 h-3 mr-1" />
                            {typeLabel(change.type)}
                          </Badge>
                          <div className="flex-1">
                            <h3 className="font-medium text-foreground">{t(`public.changelog.changes.${change.id}.title`)}</h3>
                            <p className="text-sm text-muted-foreground mt-1">{t(`public.changelog.changes.${change.id}.description`)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Collapsed summary */}
              {!isExpanded && (
                <div className="ml-12 flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{t('public.changelog.updatesCount', { count: entry.changes.length })}</span>
                  <span>•</span>
                  <div className="flex gap-1">
                    {Array.from(new Set(entry.changes.map(c => c.type))).map(type => {
                      const style = typeStyle[type as keyof typeof typeStyle];
                      return (
                        <Badge key={type} variant="outline" className={`${style.className} text-xs px-1.5 py-0`}>
                          {typeLabel(type)}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Newsletter Subscribe */}
        <div className="mt-16 pt-8 border-t border-border">
          <div className="bg-card rounded-2xl border border-border p-6 text-center">
            <Mail className="w-10 h-10 text-accent mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">{t('public.changelog.subscribeTitle')}</h2>
            <p className="text-muted-foreground mb-6">{t('public.changelog.subscribeText')}</p>
            <form onSubmit={handleSubscribe} className="flex gap-2 max-w-sm mx-auto">
              <Input 
                type="email"
                placeholder={t('public.changelog.subscribePlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1"
              />
              <Button type="submit" disabled={isSubscribing}>
                {isSubscribing ? t('public.changelog.subscribeSubmitting') : t('public.changelog.subscribeButton')}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-4">{t('public.changelog.subscribeNote')}</p>
          </div>
        </div>
      </div>
    </PublicPageLayout>
  );
}
