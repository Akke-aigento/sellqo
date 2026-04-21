UPDATE public.tenants
SET stripe_account_id = NULL,
    stripe_onboarding_complete = false,
    stripe_charges_enabled = false,
    stripe_payouts_enabled = false
WHERE is_demo = true;