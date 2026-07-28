DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.read_email_batch(text, integer, integer)',
    'public.enqueue_email(text, jsonb)',
    'public.delete_email(text, bigint)',
    'public.move_to_dlq(text, text, bigint, jsonb)',
    'public.email_queue_dispatch()',
    'public.create_pos_cashier(uuid, text, text, text)',
    'public.update_cashier_pin(uuid, text)',
    'public.verify_cashier_pin(uuid, text)',
    'public.hash_cashier_pin(text)',
    'public.redeem_gift_card(uuid, numeric, uuid)',
    'public.create_credit_note_from_return(uuid)',
    'public.decrement_stock(uuid, integer)',
    'public.decrement_variant_stock(uuid, integer)',
    'public.use_ai_credits(uuid, integer, text, text, jsonb)',
    'public.use_ai_credits(uuid, integer)',
    'public.reset_monthly_ai_credits()',
    'public.reset_monthly_ai_credits(uuid, integer)',
    'public.use_ai_help_credit(uuid)',
    'public.send_notification(uuid, text, text, text, text, text, text, jsonb)',
    'public.increment_campaign_bounced(uuid)',
    'public.increment_campaign_clicked(uuid)',
    'public.increment_campaign_delivered(uuid)',
    'public.increment_campaign_opened(uuid)',
    'public.increment_discount_usage(text, uuid)',
    'public.expire_unpaid_orders()',
    'public.downgrade_expired_trials()',
    'public.start_sync_activity(uuid, uuid, text, text)',
    'public.complete_sync_activity(uuid, text, integer, integer, integer, integer, jsonb)',
    'public.create_sync_conflict(uuid, uuid, text, text, jsonb, jsonb, text[])',
    'public.bulk_update_specifications(uuid[], jsonb)',
    'public.schedule_automation_run(uuid, uuid, text, jsonb)',
    'public.get_already_returned_quantity(uuid)',
    'public.get_user_highest_role(uuid)',
    'public.is_warehouse_user(uuid)',
    'public.has_addon(uuid, text)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;