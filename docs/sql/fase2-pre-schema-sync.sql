-- =====================================================================
-- Pre-Fase 2 Schema-sync — generated 2026-06-03
-- Purpose: bring repo migrations in sync with production for 40 tables
-- that exist in the live DB but had no committed DDL.
-- Idempotent: all CREATE statements use IF NOT EXISTS guards; this file
-- is safe to (re-)apply against a fresh environment to recreate the
-- production schema state. Running against current production is a no-op.
-- =====================================================================


-- ---------------------------------------------------------------
-- Table: public.admin_actions_log
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_actions_log (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "admin_user_id" uuid NOT NULL,
  "target_tenant_id" uuid,
  "target_user_id" uuid,
  "action_type" text NOT NULL,
  "action_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='admin_actions_log_admin_user_id_fkey' AND conrelid='public.admin_actions_log'::regclass) THEN
    ALTER TABLE public.admin_actions_log ADD CONSTRAINT "admin_actions_log_admin_user_id_fkey" FOREIGN KEY (admin_user_id) REFERENCES auth.users(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='admin_actions_log_target_tenant_id_fkey' AND conrelid='public.admin_actions_log'::regclass) THEN
    ALTER TABLE public.admin_actions_log ADD CONSTRAINT "admin_actions_log_target_tenant_id_fkey" FOREIGN KEY (target_tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='admin_actions_log_target_user_id_fkey' AND conrelid='public.admin_actions_log'::regclass) THEN
    ALTER TABLE public.admin_actions_log ADD CONSTRAINT "admin_actions_log_target_user_id_fkey" FOREIGN KEY (target_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='admin_actions_log_pkey' AND conrelid='public.admin_actions_log'::regclass) THEN
    ALTER TABLE public.admin_actions_log ADD CONSTRAINT "admin_actions_log_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_admin_actions_type ON public.admin_actions_log USING btree (action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_tenant ON public.admin_actions_log USING btree (target_tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON public.admin_actions_log USING btree (admin_user_id, created_at DESC);

ALTER TABLE public.admin_actions_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='admin_actions_log' AND policyname='Platform admins can insert admin actions') THEN
    CREATE POLICY "Platform admins can insert admin actions" ON public.admin_actions_log FOR INSERT TO authenticated WITH CHECK (is_platform_admin(auth.uid()));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='admin_actions_log' AND policyname='Platform admins can view admin actions') THEN
    CREATE POLICY "Platform admins can view admin actions" ON public.admin_actions_log FOR SELECT TO authenticated USING (is_platform_admin(auth.uid()));
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.ai_coach_settings
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_coach_settings (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "coach_name" text DEFAULT 'Coach'::text,
  "personality" text DEFAULT 'friendly'::text,
  "proactive_level" text DEFAULT 'balanced'::text,
  "analysis_frequency_hours" integer DEFAULT 6,
  "enabled_analyses" text[] DEFAULT ARRAY['stock'::text, 'sales'::text, 'customers'::text, 'invoices'::text, 'quotes'::text, 'subscriptions'::text],
  "muted_suggestion_types" text[] DEFAULT '{}'::text[],
  "show_emoji" boolean DEFAULT true,
  "auto_dismiss_after_hours" integer DEFAULT 168,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ai_coach_settings_personality_check' AND conrelid='public.ai_coach_settings'::regclass) THEN
    ALTER TABLE public.ai_coach_settings ADD CONSTRAINT "ai_coach_settings_personality_check" CHECK ((personality = ANY (ARRAY['friendly'::text, 'professional'::text, 'casual'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ai_coach_settings_proactive_level_check' AND conrelid='public.ai_coach_settings'::regclass) THEN
    ALTER TABLE public.ai_coach_settings ADD CONSTRAINT "ai_coach_settings_proactive_level_check" CHECK ((proactive_level = ANY (ARRAY['aggressive'::text, 'balanced'::text, 'minimal'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ai_coach_settings_tenant_id_fkey' AND conrelid='public.ai_coach_settings'::regclass) THEN
    ALTER TABLE public.ai_coach_settings ADD CONSTRAINT "ai_coach_settings_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ai_coach_settings_pkey' AND conrelid='public.ai_coach_settings'::regclass) THEN
    ALTER TABLE public.ai_coach_settings ADD CONSTRAINT "ai_coach_settings_pkey" PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ai_coach_settings_tenant_id_key' AND conrelid='public.ai_coach_settings'::regclass) THEN
    ALTER TABLE public.ai_coach_settings ADD CONSTRAINT "ai_coach_settings_tenant_id_key" UNIQUE (tenant_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_coach_settings_tenant ON public.ai_coach_settings USING btree (tenant_id);

ALTER TABLE public.ai_coach_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_coach_settings' AND policyname='Admins can manage coach settings') THEN
    CREATE POLICY "Admins can manage coach settings" ON public.ai_coach_settings FOR ALL TO public USING ((EXISTS ( SELECT 1);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_coach_settings' AND policyname='   FROM user_roles') THEN
    CREATE POLICY "   FROM user_roles" ON public.ai_coach_settings FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_coach_settings' AND policyname='  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.tenant_id = ai_coach_settings.tenant_id) AND (user_roles.role = ANY (ARRAY['tenant_admin'::app_role, 'platform_admin'::app_role])))))') THEN
    CREATE POLICY "  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.tenant_id = ai_coach_settings.tenant_id) AND (user_roles.role = ANY (ARRAY['tenant_admin'::app_role, 'platform_admin'::app_role])))))" ON public.ai_coach_settings FOR  TO PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_coach_settings' AND policyname='Users can view their tenant's coach settings') THEN
    CREATE POLICY "Users can view their tenant's coach settings" ON public.ai_coach_settings FOR SELECT TO public USING ((tenant_id IN ( SELECT user_roles.tenant_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_coach_settings' AND policyname='   FROM user_roles') THEN
    CREATE POLICY "   FROM user_roles" ON public.ai_coach_settings FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_coach_settings' AND policyname='  WHERE (user_roles.user_id = auth.uid())))') THEN
    CREATE POLICY "  WHERE (user_roles.user_id = auth.uid())))" ON public.ai_coach_settings FOR  TO PERMISSIVE;
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.ai_credit_purchases
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_credit_purchases (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "stripe_session_id" text,
  "stripe_payment_intent_id" text,
  "credits_amount" integer NOT NULL,
  "price_paid" numeric(10,2) NOT NULL,
  "currency" text DEFAULT 'EUR'::text,
  "status" text DEFAULT 'pending'::text,
  "created_at" timestamp with time zone DEFAULT now(),
  "completed_at" timestamp with time zone
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ai_credit_purchases_tenant_id_fkey' AND conrelid='public.ai_credit_purchases'::regclass) THEN
    ALTER TABLE public.ai_credit_purchases ADD CONSTRAINT "ai_credit_purchases_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ai_credit_purchases_pkey' AND conrelid='public.ai_credit_purchases'::regclass) THEN
    ALTER TABLE public.ai_credit_purchases ADD CONSTRAINT "ai_credit_purchases_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_credit_purchases_tenant_id ON public.ai_credit_purchases USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_credit_purchases_stripe_session ON public.ai_credit_purchases USING btree (stripe_session_id);

ALTER TABLE public.ai_credit_purchases ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_credit_purchases' AND policyname='Users can view their own credit purchases') THEN
    CREATE POLICY "Users can view their own credit purchases" ON public.ai_credit_purchases FOR SELECT TO public USING ((tenant_id IN ( SELECT user_roles.tenant_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_credit_purchases' AND policyname='   FROM user_roles') THEN
    CREATE POLICY "   FROM user_roles" ON public.ai_credit_purchases FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_credit_purchases' AND policyname='  WHERE (user_roles.user_id = auth.uid())))') THEN
    CREATE POLICY "  WHERE (user_roles.user_id = auth.uid())))" ON public.ai_credit_purchases FOR  TO PERMISSIVE;
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.automatic_discounts
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.automatic_discounts (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "trigger_type" text NOT NULL,
  "trigger_value" numeric(10,2),
  "trigger_product_ids" uuid[],
  "discount_type" text NOT NULL,
  "discount_value" numeric(10,2),
  "free_product_id" uuid,
  "applies_to" text DEFAULT 'order'::text NOT NULL,
  "product_ids" uuid[],
  "priority" integer DEFAULT 0 NOT NULL,
  "max_discount_amount" numeric(10,2),
  "is_active" boolean DEFAULT true NOT NULL,
  "valid_from" timestamp with time zone,
  "valid_until" timestamp with time zone,
  "schedule" jsonb,
  "usage_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='automatic_discounts_applies_to_check' AND conrelid='public.automatic_discounts'::regclass) THEN
    ALTER TABLE public.automatic_discounts ADD CONSTRAINT "automatic_discounts_applies_to_check" CHECK ((applies_to = ANY (ARRAY['order'::text, 'specific_products'::text, 'shipping'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='automatic_discounts_discount_type_check' AND conrelid='public.automatic_discounts'::regclass) THEN
    ALTER TABLE public.automatic_discounts ADD CONSTRAINT "automatic_discounts_discount_type_check" CHECK ((discount_type = ANY (ARRAY['percentage'::text, 'fixed_amount'::text, 'free_shipping'::text, 'free_product'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='automatic_discounts_trigger_type_check' AND conrelid='public.automatic_discounts'::regclass) THEN
    ALTER TABLE public.automatic_discounts ADD CONSTRAINT "automatic_discounts_trigger_type_check" CHECK ((trigger_type = ANY (ARRAY['cart_total'::text, 'item_count'::text, 'specific_products'::text, 'time_based'::text, 'first_order'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='automatic_discounts_free_product_id_fkey' AND conrelid='public.automatic_discounts'::regclass) THEN
    ALTER TABLE public.automatic_discounts ADD CONSTRAINT "automatic_discounts_free_product_id_fkey" FOREIGN KEY (free_product_id) REFERENCES products(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='automatic_discounts_tenant_id_fkey' AND conrelid='public.automatic_discounts'::regclass) THEN
    ALTER TABLE public.automatic_discounts ADD CONSTRAINT "automatic_discounts_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='automatic_discounts_pkey' AND conrelid='public.automatic_discounts'::regclass) THEN
    ALTER TABLE public.automatic_discounts ADD CONSTRAINT "automatic_discounts_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_automatic_discounts_tenant ON public.automatic_discounts USING btree (tenant_id);

ALTER TABLE public.automatic_discounts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='automatic_discounts' AND policyname='Users can delete auto discounts for their tenant') THEN
    CREATE POLICY "Users can delete auto discounts for their tenant" ON public.automatic_discounts FOR DELETE TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='automatic_discounts' AND policyname='Users can insert auto discounts for their tenant') THEN
    CREATE POLICY "Users can insert auto discounts for their tenant" ON public.automatic_discounts FOR INSERT TO public WITH CHECK ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='automatic_discounts' AND policyname='Users can update auto discounts for their tenant') THEN
    CREATE POLICY "Users can update auto discounts for their tenant" ON public.automatic_discounts FOR UPDATE TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='automatic_discounts' AND policyname='Users can view auto discounts for their tenant') THEN
    CREATE POLICY "Users can view auto discounts for their tenant" ON public.automatic_discounts FOR SELECT TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.automation_runs
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.automation_runs (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "automation_id" uuid,
  "tenant_id" uuid NOT NULL,
  "trigger_entity_id" uuid,
  "trigger_entity_type" text NOT NULL,
  "current_step" integer DEFAULT 0,
  "status" text DEFAULT 'pending'::text,
  "scheduled_for" timestamp with time zone,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "error_message" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='automation_runs_automation_id_fkey' AND conrelid='public.automation_runs'::regclass) THEN
    ALTER TABLE public.automation_runs ADD CONSTRAINT "automation_runs_automation_id_fkey" FOREIGN KEY (automation_id) REFERENCES email_automations(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='automation_runs_tenant_id_fkey' AND conrelid='public.automation_runs'::regclass) THEN
    ALTER TABLE public.automation_runs ADD CONSTRAINT "automation_runs_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='automation_runs_pkey' AND conrelid='public.automation_runs'::regclass) THEN
    ALTER TABLE public.automation_runs ADD CONSTRAINT "automation_runs_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_automation_runs_status ON public.automation_runs USING btree (status);
CREATE INDEX IF NOT EXISTS idx_automation_runs_scheduled ON public.automation_runs USING btree (scheduled_for) WHERE (status = 'scheduled'::text);
CREATE INDEX IF NOT EXISTS idx_automation_runs_tenant ON public.automation_runs USING btree (tenant_id);

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='automation_runs' AND policyname='Users can delete automation runs for their tenant') THEN
    CREATE POLICY "Users can delete automation runs for their tenant" ON public.automation_runs FOR DELETE TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='automation_runs' AND policyname='Users can insert automation runs for their tenant') THEN
    CREATE POLICY "Users can insert automation runs for their tenant" ON public.automation_runs FOR INSERT TO public WITH CHECK ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='automation_runs' AND policyname='Users can update automation runs for their tenant') THEN
    CREATE POLICY "Users can update automation runs for their tenant" ON public.automation_runs FOR UPDATE TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='automation_runs' AND policyname='Users can view automation runs for their tenant') THEN
    CREATE POLICY "Users can view automation runs for their tenant" ON public.automation_runs FOR SELECT TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.automation_step_runs
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.automation_step_runs (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "automation_run_id" uuid NOT NULL,
  "step_id" uuid NOT NULL,
  "status" text DEFAULT 'pending'::text,
  "scheduled_for" timestamp with time zone,
  "executed_at" timestamp with time zone,
  "result" jsonb DEFAULT '{}'::jsonb,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='automation_step_runs_automation_run_id_fkey' AND conrelid='public.automation_step_runs'::regclass) THEN
    ALTER TABLE public.automation_step_runs ADD CONSTRAINT "automation_step_runs_automation_run_id_fkey" FOREIGN KEY (automation_run_id) REFERENCES automation_runs(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='automation_step_runs_step_id_fkey' AND conrelid='public.automation_step_runs'::regclass) THEN
    ALTER TABLE public.automation_step_runs ADD CONSTRAINT "automation_step_runs_step_id_fkey" FOREIGN KEY (step_id) REFERENCES automation_steps(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='automation_step_runs_pkey' AND conrelid='public.automation_step_runs'::regclass) THEN
    ALTER TABLE public.automation_step_runs ADD CONSTRAINT "automation_step_runs_pkey" PRIMARY KEY (id);
  END IF;
END $$;


ALTER TABLE public.automation_step_runs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='automation_step_runs' AND policyname='Users can view automation step runs for their tenant') THEN
    CREATE POLICY "Users can view automation step runs for their tenant" ON public.automation_step_runs FOR SELECT TO public USING ((automation_run_id IN ( SELECT automation_runs.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='automation_step_runs' AND policyname='   FROM automation_runs') THEN
    CREATE POLICY "   FROM automation_runs" ON public.automation_step_runs FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='automation_step_runs' AND policyname='  WHERE (automation_runs.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (automation_runs.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.automation_step_runs FOR  TO PERMISSIVE;
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.automation_steps
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.automation_steps (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "automation_id" uuid NOT NULL,
  "step_order" integer NOT NULL,
  "action_type" text NOT NULL,
  "template_id" uuid,
  "subject_override" text,
  "delay_hours" integer DEFAULT 0,
  "delay_minutes" integer DEFAULT 0,
  "condition_rules" jsonb DEFAULT '{}'::jsonb,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='automation_steps_automation_id_fkey' AND conrelid='public.automation_steps'::regclass) THEN
    ALTER TABLE public.automation_steps ADD CONSTRAINT "automation_steps_automation_id_fkey" FOREIGN KEY (automation_id) REFERENCES email_automations(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='automation_steps_template_id_fkey' AND conrelid='public.automation_steps'::regclass) THEN
    ALTER TABLE public.automation_steps ADD CONSTRAINT "automation_steps_template_id_fkey" FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='automation_steps_pkey' AND conrelid='public.automation_steps'::regclass) THEN
    ALTER TABLE public.automation_steps ADD CONSTRAINT "automation_steps_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_automation_steps_automation ON public.automation_steps USING btree (automation_id);

ALTER TABLE public.automation_steps ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='automation_steps' AND policyname='Users can delete automation steps for their tenant') THEN
    CREATE POLICY "Users can delete automation steps for their tenant" ON public.automation_steps FOR DELETE TO public USING ((automation_id IN ( SELECT email_automations.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='automation_steps' AND policyname='   FROM email_automations') THEN
    CREATE POLICY "   FROM email_automations" ON public.automation_steps FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='automation_steps' AND policyname='  WHERE (email_automations.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (email_automations.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.automation_steps FOR  TO PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='automation_steps' AND policyname='Users can insert automation steps for their tenant') THEN
    CREATE POLICY "Users can insert automation steps for their tenant" ON public.automation_steps FOR INSERT TO public WITH CHECK ((automation_id IN ( SELECT email_automations.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='automation_steps' AND policyname='   FROM email_automations') THEN
    CREATE POLICY "   FROM email_automations" ON public.automation_steps FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='automation_steps' AND policyname='  WHERE (email_automations.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (email_automations.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.automation_steps FOR PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='automation_steps' AND policyname='Users can update automation steps for their tenant') THEN
    CREATE POLICY "Users can update automation steps for their tenant" ON public.automation_steps FOR UPDATE TO public USING ((automation_id IN ( SELECT email_automations.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='automation_steps' AND policyname='   FROM email_automations') THEN
    CREATE POLICY "   FROM email_automations" ON public.automation_steps FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='automation_steps' AND policyname='  WHERE (email_automations.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (email_automations.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.automation_steps FOR  TO PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='automation_steps' AND policyname='Users can view automation steps for their tenant') THEN
    CREATE POLICY "Users can view automation steps for their tenant" ON public.automation_steps FOR SELECT TO public USING ((automation_id IN ( SELECT email_automations.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='automation_steps' AND policyname='   FROM email_automations') THEN
    CREATE POLICY "   FROM email_automations" ON public.automation_steps FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='automation_steps' AND policyname='  WHERE (email_automations.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (email_automations.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.automation_steps FOR  TO PERMISSIVE;
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.bogo_promotions
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bogo_promotions (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "promotion_type" text DEFAULT 'buy_x_get_y'::text NOT NULL,
  "buy_quantity" integer DEFAULT 1 NOT NULL,
  "get_quantity" integer DEFAULT 1 NOT NULL,
  "discount_type" text DEFAULT 'free'::text NOT NULL,
  "discount_value" numeric(10,2) DEFAULT 100 NOT NULL,
  "buy_product_ids" uuid[],
  "get_product_ids" uuid[],
  "buy_category_ids" uuid[],
  "get_category_ids" uuid[],
  "max_uses_per_order" integer,
  "is_active" boolean DEFAULT true NOT NULL,
  "valid_from" timestamp with time zone,
  "valid_until" timestamp with time zone,
  "usage_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bogo_promotions_discount_type_check' AND conrelid='public.bogo_promotions'::regclass) THEN
    ALTER TABLE public.bogo_promotions ADD CONSTRAINT "bogo_promotions_discount_type_check" CHECK ((discount_type = ANY (ARRAY['free'::text, 'percentage'::text, 'fixed_amount'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bogo_promotions_promotion_type_check' AND conrelid='public.bogo_promotions'::regclass) THEN
    ALTER TABLE public.bogo_promotions ADD CONSTRAINT "bogo_promotions_promotion_type_check" CHECK ((promotion_type = ANY (ARRAY['buy_x_get_y'::text, 'buy_x_get_cheapest_free'::text, 'buy_x_get_y_percent_off'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bogo_promotions_tenant_id_fkey' AND conrelid='public.bogo_promotions'::regclass) THEN
    ALTER TABLE public.bogo_promotions ADD CONSTRAINT "bogo_promotions_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bogo_promotions_pkey' AND conrelid='public.bogo_promotions'::regclass) THEN
    ALTER TABLE public.bogo_promotions ADD CONSTRAINT "bogo_promotions_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bogo_promotions_tenant ON public.bogo_promotions USING btree (tenant_id);

ALTER TABLE public.bogo_promotions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bogo_promotions' AND policyname='Users can delete bogo for their tenant') THEN
    CREATE POLICY "Users can delete bogo for their tenant" ON public.bogo_promotions FOR DELETE TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bogo_promotions' AND policyname='Users can insert bogo for their tenant') THEN
    CREATE POLICY "Users can insert bogo for their tenant" ON public.bogo_promotions FOR INSERT TO public WITH CHECK ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bogo_promotions' AND policyname='Users can update bogo for their tenant') THEN
    CREATE POLICY "Users can update bogo for their tenant" ON public.bogo_promotions FOR UPDATE TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bogo_promotions' AND policyname='Users can view bogo for their tenant') THEN
    CREATE POLICY "Users can view bogo for their tenant" ON public.bogo_promotions FOR SELECT TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.bundle_products
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bundle_products (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "bundle_id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL,
  "is_required" boolean DEFAULT false NOT NULL,
  "group_name" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "allow_quantity_change" boolean DEFAULT false NOT NULL
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bundle_products_bundle_id_fkey' AND conrelid='public.bundle_products'::regclass) THEN
    ALTER TABLE public.bundle_products ADD CONSTRAINT "bundle_products_bundle_id_fkey" FOREIGN KEY (bundle_id) REFERENCES product_bundles(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bundle_products_product_id_fkey' AND conrelid='public.bundle_products'::regclass) THEN
    ALTER TABLE public.bundle_products ADD CONSTRAINT "bundle_products_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bundle_products_pkey' AND conrelid='public.bundle_products'::regclass) THEN
    ALTER TABLE public.bundle_products ADD CONSTRAINT "bundle_products_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bundle_products_bundle ON public.bundle_products USING btree (bundle_id);

ALTER TABLE public.bundle_products ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bundle_products' AND policyname='Users can delete bundle products') THEN
    CREATE POLICY "Users can delete bundle products" ON public.bundle_products FOR DELETE TO public USING ((bundle_id IN ( SELECT product_bundles.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bundle_products' AND policyname='   FROM product_bundles') THEN
    CREATE POLICY "   FROM product_bundles" ON public.bundle_products FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bundle_products' AND policyname='  WHERE (product_bundles.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (product_bundles.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.bundle_products FOR  TO PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bundle_products' AND policyname='Users can insert bundle products') THEN
    CREATE POLICY "Users can insert bundle products" ON public.bundle_products FOR INSERT TO public WITH CHECK ((bundle_id IN ( SELECT product_bundles.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bundle_products' AND policyname='   FROM product_bundles') THEN
    CREATE POLICY "   FROM product_bundles" ON public.bundle_products FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bundle_products' AND policyname='  WHERE (product_bundles.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (product_bundles.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.bundle_products FOR PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bundle_products' AND policyname='Users can update bundle products') THEN
    CREATE POLICY "Users can update bundle products" ON public.bundle_products FOR UPDATE TO public USING ((bundle_id IN ( SELECT product_bundles.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bundle_products' AND policyname='   FROM product_bundles') THEN
    CREATE POLICY "   FROM product_bundles" ON public.bundle_products FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bundle_products' AND policyname='  WHERE (product_bundles.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (product_bundles.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.bundle_products FOR  TO PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bundle_products' AND policyname='Users can view bundle products') THEN
    CREATE POLICY "Users can view bundle products" ON public.bundle_products FOR SELECT TO public USING ((bundle_id IN ( SELECT product_bundles.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bundle_products' AND policyname='   FROM product_bundles') THEN
    CREATE POLICY "   FROM product_bundles" ON public.bundle_products FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bundle_products' AND policyname='  WHERE (product_bundles.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (product_bundles.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.bundle_products FOR  TO PERMISSIVE;
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.customer_group_members
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_group_members (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "customer_group_id" uuid NOT NULL,
  "customer_id" uuid NOT NULL,
  "joined_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='customer_group_members_customer_group_id_fkey' AND conrelid='public.customer_group_members'::regclass) THEN
    ALTER TABLE public.customer_group_members ADD CONSTRAINT "customer_group_members_customer_group_id_fkey" FOREIGN KEY (customer_group_id) REFERENCES customer_groups(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='customer_group_members_customer_id_fkey' AND conrelid='public.customer_group_members'::regclass) THEN
    ALTER TABLE public.customer_group_members ADD CONSTRAINT "customer_group_members_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='customer_group_members_pkey' AND conrelid='public.customer_group_members'::regclass) THEN
    ALTER TABLE public.customer_group_members ADD CONSTRAINT "customer_group_members_pkey" PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='customer_group_members_customer_group_id_customer_id_key' AND conrelid='public.customer_group_members'::regclass) THEN
    ALTER TABLE public.customer_group_members ADD CONSTRAINT "customer_group_members_customer_group_id_customer_id_key" UNIQUE (customer_group_id, customer_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_customer_group_members_customer ON public.customer_group_members USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_group_members_group ON public.customer_group_members USING btree (customer_group_id);

ALTER TABLE public.customer_group_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_group_members' AND policyname='Users can delete customer group members') THEN
    CREATE POLICY "Users can delete customer group members" ON public.customer_group_members FOR DELETE TO public USING ((customer_group_id IN ( SELECT customer_groups.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_group_members' AND policyname='   FROM customer_groups') THEN
    CREATE POLICY "   FROM customer_groups" ON public.customer_group_members FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_group_members' AND policyname='  WHERE (customer_groups.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (customer_groups.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.customer_group_members FOR  TO PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_group_members' AND policyname='Users can insert customer group members') THEN
    CREATE POLICY "Users can insert customer group members" ON public.customer_group_members FOR INSERT TO public WITH CHECK ((customer_group_id IN ( SELECT customer_groups.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_group_members' AND policyname='   FROM customer_groups') THEN
    CREATE POLICY "   FROM customer_groups" ON public.customer_group_members FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_group_members' AND policyname='  WHERE (customer_groups.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (customer_groups.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.customer_group_members FOR PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_group_members' AND policyname='Users can update customer group members') THEN
    CREATE POLICY "Users can update customer group members" ON public.customer_group_members FOR UPDATE TO public USING ((customer_group_id IN ( SELECT customer_groups.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_group_members' AND policyname='   FROM customer_groups') THEN
    CREATE POLICY "   FROM customer_groups" ON public.customer_group_members FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_group_members' AND policyname='  WHERE (customer_groups.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (customer_groups.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.customer_group_members FOR  TO PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_group_members' AND policyname='Users can view customer group members') THEN
    CREATE POLICY "Users can view customer group members" ON public.customer_group_members FOR SELECT TO public USING ((customer_group_id IN ( SELECT customer_groups.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_group_members' AND policyname='   FROM customer_groups') THEN
    CREATE POLICY "   FROM customer_groups" ON public.customer_group_members FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_group_members' AND policyname='  WHERE (customer_groups.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (customer_groups.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.customer_group_members FOR  TO PERMISSIVE;
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.customer_group_product_prices
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_group_product_prices (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "customer_group_id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "custom_price" numeric(10,2),
  "discount_percentage" numeric(5,2),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='customer_group_product_prices_customer_group_id_fkey' AND conrelid='public.customer_group_product_prices'::regclass) THEN
    ALTER TABLE public.customer_group_product_prices ADD CONSTRAINT "customer_group_product_prices_customer_group_id_fkey" FOREIGN KEY (customer_group_id) REFERENCES customer_groups(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='customer_group_product_prices_product_id_fkey' AND conrelid='public.customer_group_product_prices'::regclass) THEN
    ALTER TABLE public.customer_group_product_prices ADD CONSTRAINT "customer_group_product_prices_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='customer_group_product_prices_pkey' AND conrelid='public.customer_group_product_prices'::regclass) THEN
    ALTER TABLE public.customer_group_product_prices ADD CONSTRAINT "customer_group_product_prices_pkey" PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='customer_group_product_prices_customer_group_id_product_id_key' AND conrelid='public.customer_group_product_prices'::regclass) THEN
    ALTER TABLE public.customer_group_product_prices ADD CONSTRAINT "customer_group_product_prices_customer_group_id_product_id_key" UNIQUE (customer_group_id, product_id);
  END IF;
END $$;


ALTER TABLE public.customer_group_product_prices ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_group_product_prices' AND policyname='Users can delete customer group product prices') THEN
    CREATE POLICY "Users can delete customer group product prices" ON public.customer_group_product_prices FOR DELETE TO public USING ((customer_group_id IN ( SELECT customer_groups.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_group_product_prices' AND policyname='   FROM customer_groups') THEN
    CREATE POLICY "   FROM customer_groups" ON public.customer_group_product_prices FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_group_product_prices' AND policyname='  WHERE (customer_groups.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (customer_groups.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.customer_group_product_prices FOR  TO PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_group_product_prices' AND policyname='Users can insert customer group product prices') THEN
    CREATE POLICY "Users can insert customer group product prices" ON public.customer_group_product_prices FOR INSERT TO public WITH CHECK ((customer_group_id IN ( SELECT customer_groups.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_group_product_prices' AND policyname='   FROM customer_groups') THEN
    CREATE POLICY "   FROM customer_groups" ON public.customer_group_product_prices FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_group_product_prices' AND policyname='  WHERE (customer_groups.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (customer_groups.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.customer_group_product_prices FOR PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_group_product_prices' AND policyname='Users can update customer group product prices') THEN
    CREATE POLICY "Users can update customer group product prices" ON public.customer_group_product_prices FOR UPDATE TO public USING ((customer_group_id IN ( SELECT customer_groups.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_group_product_prices' AND policyname='   FROM customer_groups') THEN
    CREATE POLICY "   FROM customer_groups" ON public.customer_group_product_prices FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_group_product_prices' AND policyname='  WHERE (customer_groups.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (customer_groups.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.customer_group_product_prices FOR  TO PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_group_product_prices' AND policyname='Users can view customer group product prices') THEN
    CREATE POLICY "Users can view customer group product prices" ON public.customer_group_product_prices FOR SELECT TO public USING ((customer_group_id IN ( SELECT customer_groups.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_group_product_prices' AND policyname='   FROM customer_groups') THEN
    CREATE POLICY "   FROM customer_groups" ON public.customer_group_product_prices FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_group_product_prices' AND policyname='  WHERE (customer_groups.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (customer_groups.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.customer_group_product_prices FOR  TO PERMISSIVE;
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.customer_groups
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_groups (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "code" text NOT NULL,
  "description" text,
  "discount_type" text DEFAULT 'percentage'::text,
  "discount_value" numeric(10,2) DEFAULT 0,
  "tax_exempt" boolean DEFAULT false NOT NULL,
  "min_order_amount" numeric(10,2),
  "priority" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='customer_groups_discount_type_check' AND conrelid='public.customer_groups'::regclass) THEN
    ALTER TABLE public.customer_groups ADD CONSTRAINT "customer_groups_discount_type_check" CHECK ((discount_type = ANY (ARRAY['percentage'::text, 'fixed_amount'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='customer_groups_tenant_id_fkey' AND conrelid='public.customer_groups'::regclass) THEN
    ALTER TABLE public.customer_groups ADD CONSTRAINT "customer_groups_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='customer_groups_pkey' AND conrelid='public.customer_groups'::regclass) THEN
    ALTER TABLE public.customer_groups ADD CONSTRAINT "customer_groups_pkey" PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='customer_groups_tenant_id_code_key' AND conrelid='public.customer_groups'::regclass) THEN
    ALTER TABLE public.customer_groups ADD CONSTRAINT "customer_groups_tenant_id_code_key" UNIQUE (tenant_id, code);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_customer_groups_tenant ON public.customer_groups USING btree (tenant_id);

ALTER TABLE public.customer_groups ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_groups' AND policyname='Users can delete customer groups for their tenant') THEN
    CREATE POLICY "Users can delete customer groups for their tenant" ON public.customer_groups FOR DELETE TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_groups' AND policyname='Users can insert customer groups for their tenant') THEN
    CREATE POLICY "Users can insert customer groups for their tenant" ON public.customer_groups FOR INSERT TO public WITH CHECK ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_groups' AND policyname='Users can update customer groups for their tenant') THEN
    CREATE POLICY "Users can update customer groups for their tenant" ON public.customer_groups FOR UPDATE TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_groups' AND policyname='Users can view customer groups for their tenant') THEN
    CREATE POLICY "Users can view customer groups for their tenant" ON public.customer_groups FOR SELECT TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.customer_loyalty
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_loyalty (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL,
  "loyalty_program_id" uuid NOT NULL,
  "points_balance" integer DEFAULT 0 NOT NULL,
  "points_earned_total" integer DEFAULT 0 NOT NULL,
  "points_spent_total" integer DEFAULT 0 NOT NULL,
  "current_tier_id" uuid,
  "joined_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_activity_at" timestamp with time zone
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='customer_loyalty_current_tier_id_fkey' AND conrelid='public.customer_loyalty'::regclass) THEN
    ALTER TABLE public.customer_loyalty ADD CONSTRAINT "customer_loyalty_current_tier_id_fkey" FOREIGN KEY (current_tier_id) REFERENCES loyalty_tiers(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='customer_loyalty_customer_id_fkey' AND conrelid='public.customer_loyalty'::regclass) THEN
    ALTER TABLE public.customer_loyalty ADD CONSTRAINT "customer_loyalty_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='customer_loyalty_loyalty_program_id_fkey' AND conrelid='public.customer_loyalty'::regclass) THEN
    ALTER TABLE public.customer_loyalty ADD CONSTRAINT "customer_loyalty_loyalty_program_id_fkey" FOREIGN KEY (loyalty_program_id) REFERENCES loyalty_programs(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='customer_loyalty_pkey' AND conrelid='public.customer_loyalty'::regclass) THEN
    ALTER TABLE public.customer_loyalty ADD CONSTRAINT "customer_loyalty_pkey" PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='customer_loyalty_customer_id_loyalty_program_id_key' AND conrelid='public.customer_loyalty'::regclass) THEN
    ALTER TABLE public.customer_loyalty ADD CONSTRAINT "customer_loyalty_customer_id_loyalty_program_id_key" UNIQUE (customer_id, loyalty_program_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_customer_loyalty_customer ON public.customer_loyalty USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_loyalty_program ON public.customer_loyalty USING btree (loyalty_program_id);

ALTER TABLE public.customer_loyalty ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_loyalty' AND policyname='Users can delete customer loyalty') THEN
    CREATE POLICY "Users can delete customer loyalty" ON public.customer_loyalty FOR DELETE TO public USING ((loyalty_program_id IN ( SELECT loyalty_programs.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_loyalty' AND policyname='   FROM loyalty_programs') THEN
    CREATE POLICY "   FROM loyalty_programs" ON public.customer_loyalty FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_loyalty' AND policyname='  WHERE (loyalty_programs.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (loyalty_programs.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.customer_loyalty FOR  TO PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_loyalty' AND policyname='Users can insert customer loyalty') THEN
    CREATE POLICY "Users can insert customer loyalty" ON public.customer_loyalty FOR INSERT TO public WITH CHECK ((loyalty_program_id IN ( SELECT loyalty_programs.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_loyalty' AND policyname='   FROM loyalty_programs') THEN
    CREATE POLICY "   FROM loyalty_programs" ON public.customer_loyalty FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_loyalty' AND policyname='  WHERE (loyalty_programs.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (loyalty_programs.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.customer_loyalty FOR PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_loyalty' AND policyname='Users can update customer loyalty') THEN
    CREATE POLICY "Users can update customer loyalty" ON public.customer_loyalty FOR UPDATE TO public USING ((loyalty_program_id IN ( SELECT loyalty_programs.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_loyalty' AND policyname='   FROM loyalty_programs') THEN
    CREATE POLICY "   FROM loyalty_programs" ON public.customer_loyalty FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_loyalty' AND policyname='  WHERE (loyalty_programs.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (loyalty_programs.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.customer_loyalty FOR  TO PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_loyalty' AND policyname='Users can view customer loyalty') THEN
    CREATE POLICY "Users can view customer loyalty" ON public.customer_loyalty FOR SELECT TO public USING ((loyalty_program_id IN ( SELECT loyalty_programs.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_loyalty' AND policyname='   FROM loyalty_programs') THEN
    CREATE POLICY "   FROM loyalty_programs" ON public.customer_loyalty FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_loyalty' AND policyname='  WHERE (loyalty_programs.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (loyalty_programs.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.customer_loyalty FOR  TO PERMISSIVE;
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.discount_stacking_rules
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discount_stacking_rules (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "rule_type" text NOT NULL,
  "discount_types" text[],
  "max_stack_count" integer,
  "max_total_discount_percent" numeric(5,2),
  "priority_order" text[],
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='discount_stacking_rules_rule_type_check' AND conrelid='public.discount_stacking_rules'::regclass) THEN
    ALTER TABLE public.discount_stacking_rules ADD CONSTRAINT "discount_stacking_rules_rule_type_check" CHECK ((rule_type = ANY (ARRAY['allow_stacking'::text, 'prevent_stacking'::text, 'max_discounts'::text, 'priority_only'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='discount_stacking_rules_tenant_id_fkey' AND conrelid='public.discount_stacking_rules'::regclass) THEN
    ALTER TABLE public.discount_stacking_rules ADD CONSTRAINT "discount_stacking_rules_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='discount_stacking_rules_pkey' AND conrelid='public.discount_stacking_rules'::regclass) THEN
    ALTER TABLE public.discount_stacking_rules ADD CONSTRAINT "discount_stacking_rules_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_discount_stacking_rules_tenant ON public.discount_stacking_rules USING btree (tenant_id);

ALTER TABLE public.discount_stacking_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='discount_stacking_rules' AND policyname='Users can delete stacking rules for their tenant') THEN
    CREATE POLICY "Users can delete stacking rules for their tenant" ON public.discount_stacking_rules FOR DELETE TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='discount_stacking_rules' AND policyname='Users can insert stacking rules for their tenant') THEN
    CREATE POLICY "Users can insert stacking rules for their tenant" ON public.discount_stacking_rules FOR INSERT TO public WITH CHECK ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='discount_stacking_rules' AND policyname='Users can update stacking rules for their tenant') THEN
    CREATE POLICY "Users can update stacking rules for their tenant" ON public.discount_stacking_rules FOR UPDATE TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='discount_stacking_rules' AND policyname='Users can view stacking rules for their tenant') THEN
    CREATE POLICY "Users can view stacking rules for their tenant" ON public.discount_stacking_rules FOR SELECT TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.email_preferences
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_preferences (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "email" text NOT NULL,
  "customer_id" uuid,
  "newsletter" boolean DEFAULT true,
  "promotions" boolean DEFAULT true,
  "transactional" boolean DEFAULT true,
  "product_updates" boolean DEFAULT true,
  "frequency" text DEFAULT 'normal'::text,
  "preference_token" uuid DEFAULT gen_random_uuid(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "created_at" timestamp with time zone DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='email_preferences_customer_id_fkey' AND conrelid='public.email_preferences'::regclass) THEN
    ALTER TABLE public.email_preferences ADD CONSTRAINT "email_preferences_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='email_preferences_tenant_id_fkey' AND conrelid='public.email_preferences'::regclass) THEN
    ALTER TABLE public.email_preferences ADD CONSTRAINT "email_preferences_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='email_preferences_pkey' AND conrelid='public.email_preferences'::regclass) THEN
    ALTER TABLE public.email_preferences ADD CONSTRAINT "email_preferences_pkey" PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='email_preferences_tenant_id_email_key' AND conrelid='public.email_preferences'::regclass) THEN
    ALTER TABLE public.email_preferences ADD CONSTRAINT "email_preferences_tenant_id_email_key" UNIQUE (tenant_id, email);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_preferences_email ON public.email_preferences USING btree (email);

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_preferences' AND policyname='Users can insert email preferences for their tenant') THEN
    CREATE POLICY "Users can insert email preferences for their tenant" ON public.email_preferences FOR INSERT TO public WITH CHECK ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_preferences' AND policyname='Users can update email preferences for their tenant') THEN
    CREATE POLICY "Users can update email preferences for their tenant" ON public.email_preferences FOR UPDATE TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_preferences' AND policyname='Users can view email preferences for their tenant') THEN
    CREATE POLICY "Users can view email preferences for their tenant" ON public.email_preferences FOR SELECT TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.email_signatures
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_signatures (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "user_id" uuid,
  "name" text DEFAULT 'Standaard'::text NOT NULL,
  "body_html" text DEFAULT ''::text NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='email_signatures_tenant_id_fkey' AND conrelid='public.email_signatures'::regclass) THEN
    ALTER TABLE public.email_signatures ADD CONSTRAINT "email_signatures_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='email_signatures_user_id_fkey' AND conrelid='public.email_signatures'::regclass) THEN
    ALTER TABLE public.email_signatures ADD CONSTRAINT "email_signatures_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='email_signatures_pkey' AND conrelid='public.email_signatures'::regclass) THEN
    ALTER TABLE public.email_signatures ADD CONSTRAINT "email_signatures_pkey" PRIMARY KEY (id);
  END IF;
END $$;


ALTER TABLE public.email_signatures ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_signatures' AND policyname='Users can create signatures for their tenant') THEN
    CREATE POLICY "Users can create signatures for their tenant" ON public.email_signatures FOR INSERT TO public WITH CHECK ((tenant_id IN ( SELECT public.get_user_tenant_ids() AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_signatures' AND policyname='Users can delete signatures for their tenant') THEN
    CREATE POLICY "Users can delete signatures for their tenant" ON public.email_signatures FOR DELETE TO public USING ((tenant_id IN ( SELECT public.get_user_tenant_ids() AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_signatures' AND policyname='Users can update signatures for their tenant') THEN
    CREATE POLICY "Users can update signatures for their tenant" ON public.email_signatures FOR UPDATE TO public USING ((tenant_id IN ( SELECT public.get_user_tenant_ids() AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_signatures' AND policyname='Users can view signatures for their tenant') THEN
    CREATE POLICY "Users can view signatures for their tenant" ON public.email_signatures FOR SELECT TO public USING ((tenant_id IN ( SELECT public.get_user_tenant_ids() AS get_user_tenant_ids)));
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.email_template_blocks
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_template_blocks (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "template_id" uuid NOT NULL,
  "block_order" integer NOT NULL,
  "block_type" text NOT NULL,
  "content" jsonb DEFAULT '{}'::jsonb,
  "style" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='email_template_blocks_template_id_fkey' AND conrelid='public.email_template_blocks'::regclass) THEN
    ALTER TABLE public.email_template_blocks ADD CONSTRAINT "email_template_blocks_template_id_fkey" FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='email_template_blocks_pkey' AND conrelid='public.email_template_blocks'::regclass) THEN
    ALTER TABLE public.email_template_blocks ADD CONSTRAINT "email_template_blocks_pkey" PRIMARY KEY (id);
  END IF;
END $$;


ALTER TABLE public.email_template_blocks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_template_blocks' AND policyname='Users can delete template blocks for their tenant') THEN
    CREATE POLICY "Users can delete template blocks for their tenant" ON public.email_template_blocks FOR DELETE TO public USING ((template_id IN ( SELECT email_templates.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_template_blocks' AND policyname='   FROM email_templates') THEN
    CREATE POLICY "   FROM email_templates" ON public.email_template_blocks FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_template_blocks' AND policyname='  WHERE (email_templates.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (email_templates.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.email_template_blocks FOR  TO PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_template_blocks' AND policyname='Users can insert template blocks for their tenant') THEN
    CREATE POLICY "Users can insert template blocks for their tenant" ON public.email_template_blocks FOR INSERT TO public WITH CHECK ((template_id IN ( SELECT email_templates.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_template_blocks' AND policyname='   FROM email_templates') THEN
    CREATE POLICY "   FROM email_templates" ON public.email_template_blocks FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_template_blocks' AND policyname='  WHERE (email_templates.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (email_templates.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.email_template_blocks FOR PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_template_blocks' AND policyname='Users can update template blocks for their tenant') THEN
    CREATE POLICY "Users can update template blocks for their tenant" ON public.email_template_blocks FOR UPDATE TO public USING ((template_id IN ( SELECT email_templates.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_template_blocks' AND policyname='   FROM email_templates') THEN
    CREATE POLICY "   FROM email_templates" ON public.email_template_blocks FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_template_blocks' AND policyname='  WHERE (email_templates.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (email_templates.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.email_template_blocks FOR  TO PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_template_blocks' AND policyname='Users can view template blocks for their tenant') THEN
    CREATE POLICY "Users can view template blocks for their tenant" ON public.email_template_blocks FOR SELECT TO public USING ((template_id IN ( SELECT email_templates.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_template_blocks' AND policyname='   FROM email_templates') THEN
    CREATE POLICY "   FROM email_templates" ON public.email_template_blocks FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_template_blocks' AND policyname='  WHERE (email_templates.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (email_templates.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.email_template_blocks FOR  TO PERMISSIVE;
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.feature_usage_events
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feature_usage_events (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "user_id" uuid,
  "feature_name" text NOT NULL,
  "page_path" text NOT NULL,
  "action_type" text NOT NULL,
  "element_id" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "session_id" text,
  "created_at" timestamp with time zone DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='feature_usage_events_tenant_id_fkey' AND conrelid='public.feature_usage_events'::regclass) THEN
    ALTER TABLE public.feature_usage_events ADD CONSTRAINT "feature_usage_events_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='feature_usage_events_user_id_fkey' AND conrelid='public.feature_usage_events'::regclass) THEN
    ALTER TABLE public.feature_usage_events ADD CONSTRAINT "feature_usage_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='feature_usage_events_pkey' AND conrelid='public.feature_usage_events'::regclass) THEN
    ALTER TABLE public.feature_usage_events ADD CONSTRAINT "feature_usage_events_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_feature_usage_tenant ON public.feature_usage_events USING btree (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feature_usage_page ON public.feature_usage_events USING btree (page_path, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feature_usage_feature ON public.feature_usage_events USING btree (feature_name, created_at DESC);

ALTER TABLE public.feature_usage_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='feature_usage_events' AND policyname='Platform admins can view all feature usage') THEN
    CREATE POLICY "Platform admins can view all feature usage" ON public.feature_usage_events FOR SELECT TO authenticated USING (is_platform_admin(auth.uid()));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='feature_usage_events' AND policyname='Users can insert own feature usage') THEN
    CREATE POLICY "Users can insert own feature usage" ON public.feature_usage_events FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.gift_promotions
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gift_promotions (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "trigger_type" text NOT NULL,
  "trigger_value" numeric(10,2),
  "trigger_product_ids" uuid[],
  "trigger_category_ids" uuid[],
  "gift_product_id" uuid NOT NULL,
  "gift_quantity" integer DEFAULT 1 NOT NULL,
  "max_per_order" integer DEFAULT 1,
  "is_stackable" boolean DEFAULT false NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "valid_from" timestamp with time zone,
  "valid_until" timestamp with time zone,
  "stock_limit" integer,
  "stock_used" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='gift_promotions_trigger_type_check' AND conrelid='public.gift_promotions'::regclass) THEN
    ALTER TABLE public.gift_promotions ADD CONSTRAINT "gift_promotions_trigger_type_check" CHECK ((trigger_type = ANY (ARRAY['cart_total'::text, 'specific_product'::text, 'category'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='gift_promotions_gift_product_id_fkey' AND conrelid='public.gift_promotions'::regclass) THEN
    ALTER TABLE public.gift_promotions ADD CONSTRAINT "gift_promotions_gift_product_id_fkey" FOREIGN KEY (gift_product_id) REFERENCES products(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='gift_promotions_tenant_id_fkey' AND conrelid='public.gift_promotions'::regclass) THEN
    ALTER TABLE public.gift_promotions ADD CONSTRAINT "gift_promotions_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='gift_promotions_pkey' AND conrelid='public.gift_promotions'::regclass) THEN
    ALTER TABLE public.gift_promotions ADD CONSTRAINT "gift_promotions_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_gift_promotions_tenant ON public.gift_promotions USING btree (tenant_id);

ALTER TABLE public.gift_promotions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='gift_promotions' AND policyname='Users can delete gift promotions for their tenant') THEN
    CREATE POLICY "Users can delete gift promotions for their tenant" ON public.gift_promotions FOR DELETE TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='gift_promotions' AND policyname='Users can insert gift promotions for their tenant') THEN
    CREATE POLICY "Users can insert gift promotions for their tenant" ON public.gift_promotions FOR INSERT TO public WITH CHECK ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='gift_promotions' AND policyname='Users can update gift promotions for their tenant') THEN
    CREATE POLICY "Users can update gift promotions for their tenant" ON public.gift_promotions FOR UPDATE TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='gift_promotions' AND policyname='Users can view gift promotions for their tenant') THEN
    CREATE POLICY "Users can view gift promotions for their tenant" ON public.gift_promotions FOR SELECT TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.import_category_mappings
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.import_category_mappings (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "import_job_id" uuid,
  "original_value" character varying(500) NOT NULL,
  "source_field" character varying(100),
  "suggested_name" character varying(255) NOT NULL,
  "suggested_slug" character varying(255),
  "parent_category_id" uuid,
  "parent_mapping_id" uuid,
  "matched_existing_id" uuid,
  "confidence" numeric(3,2),
  "is_approved" boolean DEFAULT true,
  "user_modified_name" character varying(255),
  "user_assigned_parent" uuid,
  "product_count" integer DEFAULT 0,
  "created_category_id" uuid,
  "created_at" timestamp with time zone DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='import_category_mappings_created_category_id_fkey' AND conrelid='public.import_category_mappings'::regclass) THEN
    ALTER TABLE public.import_category_mappings ADD CONSTRAINT "import_category_mappings_created_category_id_fkey" FOREIGN KEY (created_category_id) REFERENCES categories(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='import_category_mappings_import_job_id_fkey' AND conrelid='public.import_category_mappings'::regclass) THEN
    ALTER TABLE public.import_category_mappings ADD CONSTRAINT "import_category_mappings_import_job_id_fkey" FOREIGN KEY (import_job_id) REFERENCES import_jobs(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='import_category_mappings_matched_existing_id_fkey' AND conrelid='public.import_category_mappings'::regclass) THEN
    ALTER TABLE public.import_category_mappings ADD CONSTRAINT "import_category_mappings_matched_existing_id_fkey" FOREIGN KEY (matched_existing_id) REFERENCES categories(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='import_category_mappings_parent_category_id_fkey' AND conrelid='public.import_category_mappings'::regclass) THEN
    ALTER TABLE public.import_category_mappings ADD CONSTRAINT "import_category_mappings_parent_category_id_fkey" FOREIGN KEY (parent_category_id) REFERENCES categories(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='import_category_mappings_user_assigned_parent_fkey' AND conrelid='public.import_category_mappings'::regclass) THEN
    ALTER TABLE public.import_category_mappings ADD CONSTRAINT "import_category_mappings_user_assigned_parent_fkey" FOREIGN KEY (user_assigned_parent) REFERENCES categories(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='import_category_mappings_pkey' AND conrelid='public.import_category_mappings'::regclass) THEN
    ALTER TABLE public.import_category_mappings ADD CONSTRAINT "import_category_mappings_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_import_cat_job ON public.import_category_mappings USING btree (import_job_id);

ALTER TABLE public.import_category_mappings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='import_category_mappings' AND policyname='Users can create import category mappings') THEN
    CREATE POLICY "Users can create import category mappings" ON public.import_category_mappings FOR INSERT TO public WITH CHECK ((import_job_id IN ( SELECT import_jobs.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='import_category_mappings' AND policyname='   FROM import_jobs') THEN
    CREATE POLICY "   FROM import_jobs" ON public.import_category_mappings FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='import_category_mappings' AND policyname='  WHERE (import_jobs.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (import_jobs.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.import_category_mappings FOR PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='import_category_mappings' AND policyname='Users can delete import category mappings') THEN
    CREATE POLICY "Users can delete import category mappings" ON public.import_category_mappings FOR DELETE TO public USING ((import_job_id IN ( SELECT import_jobs.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='import_category_mappings' AND policyname='   FROM import_jobs') THEN
    CREATE POLICY "   FROM import_jobs" ON public.import_category_mappings FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='import_category_mappings' AND policyname='  WHERE (import_jobs.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (import_jobs.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.import_category_mappings FOR  TO PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='import_category_mappings' AND policyname='Users can update import category mappings') THEN
    CREATE POLICY "Users can update import category mappings" ON public.import_category_mappings FOR UPDATE TO public USING ((import_job_id IN ( SELECT import_jobs.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='import_category_mappings' AND policyname='   FROM import_jobs') THEN
    CREATE POLICY "   FROM import_jobs" ON public.import_category_mappings FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='import_category_mappings' AND policyname='  WHERE (import_jobs.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (import_jobs.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.import_category_mappings FOR  TO PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='import_category_mappings' AND policyname='Users can view their import category mappings') THEN
    CREATE POLICY "Users can view their import category mappings" ON public.import_category_mappings FOR SELECT TO public USING ((import_job_id IN ( SELECT import_jobs.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='import_category_mappings' AND policyname='   FROM import_jobs') THEN
    CREATE POLICY "   FROM import_jobs" ON public.import_category_mappings FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='import_category_mappings' AND policyname='  WHERE (import_jobs.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (import_jobs.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.import_category_mappings FOR  TO PERMISSIVE;
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.import_jobs
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.import_jobs (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid,
  "source_platform" character varying(50) NOT NULL,
  "data_type" character varying(50) NOT NULL,
  "file_name" character varying(255),
  "status" character varying(20) DEFAULT 'pending'::character varying,
  "total_rows" integer,
  "success_count" integer DEFAULT 0,
  "skipped_count" integer DEFAULT 0,
  "failed_count" integer DEFAULT 0,
  "categories_created" integer DEFAULT 0,
  "categories_matched" integer DEFAULT 0,
  "mapping" jsonb,
  "options" jsonb,
  "errors" jsonb DEFAULT '[]'::jsonb,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "duration_ms" integer,
  "created_at" timestamp with time zone DEFAULT now(),
  "created_by" uuid
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='import_jobs_created_by_fkey' AND conrelid='public.import_jobs'::regclass) THEN
    ALTER TABLE public.import_jobs ADD CONSTRAINT "import_jobs_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='import_jobs_tenant_id_fkey' AND conrelid='public.import_jobs'::regclass) THEN
    ALTER TABLE public.import_jobs ADD CONSTRAINT "import_jobs_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='import_jobs_pkey' AND conrelid='public.import_jobs'::regclass) THEN
    ALTER TABLE public.import_jobs ADD CONSTRAINT "import_jobs_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_import_jobs_tenant ON public.import_jobs USING btree (tenant_id, created_at DESC);

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='import_jobs' AND policyname='Users can create import jobs for their tenant') THEN
    CREATE POLICY "Users can create import jobs for their tenant" ON public.import_jobs FOR INSERT TO public WITH CHECK ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='import_jobs' AND policyname='Users can delete their tenant import jobs') THEN
    CREATE POLICY "Users can delete their tenant import jobs" ON public.import_jobs FOR DELETE TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='import_jobs' AND policyname='Users can update their tenant import jobs') THEN
    CREATE POLICY "Users can update their tenant import jobs" ON public.import_jobs FOR UPDATE TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='import_jobs' AND policyname='Users can view their tenant import jobs') THEN
    CREATE POLICY "Users can view their tenant import jobs" ON public.import_jobs FOR SELECT TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.import_mappings
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.import_mappings (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid,
  "name" character varying(100) NOT NULL,
  "source_platform" character varying(50) NOT NULL,
  "data_type" character varying(50) NOT NULL,
  "mapping" jsonb NOT NULL,
  "category_mappings" jsonb,
  "is_default" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='import_mappings_tenant_id_fkey' AND conrelid='public.import_mappings'::regclass) THEN
    ALTER TABLE public.import_mappings ADD CONSTRAINT "import_mappings_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='import_mappings_pkey' AND conrelid='public.import_mappings'::regclass) THEN
    ALTER TABLE public.import_mappings ADD CONSTRAINT "import_mappings_pkey" PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='import_mappings_tenant_id_name_key' AND conrelid='public.import_mappings'::regclass) THEN
    ALTER TABLE public.import_mappings ADD CONSTRAINT "import_mappings_tenant_id_name_key" UNIQUE (tenant_id, name);
  END IF;
END $$;


ALTER TABLE public.import_mappings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='import_mappings' AND policyname='Users can create import mappings for their tenant') THEN
    CREATE POLICY "Users can create import mappings for their tenant" ON public.import_mappings FOR INSERT TO public WITH CHECK ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='import_mappings' AND policyname='Users can delete their tenant import mappings') THEN
    CREATE POLICY "Users can delete their tenant import mappings" ON public.import_mappings FOR DELETE TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='import_mappings' AND policyname='Users can update their tenant import mappings') THEN
    CREATE POLICY "Users can update their tenant import mappings" ON public.import_mappings FOR UPDATE TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='import_mappings' AND policyname='Users can view their tenant import mappings') THEN
    CREATE POLICY "Users can view their tenant import mappings" ON public.import_mappings FOR SELECT TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.inbox_folders
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inbox_folders (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "color" text DEFAULT '#6366f1'::text,
  "icon" text DEFAULT 'folder'::text,
  "is_system" boolean DEFAULT false,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='inbox_folders_tenant_id_fkey' AND conrelid='public.inbox_folders'::regclass) THEN
    ALTER TABLE public.inbox_folders ADD CONSTRAINT "inbox_folders_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='inbox_folders_pkey' AND conrelid='public.inbox_folders'::regclass) THEN
    ALTER TABLE public.inbox_folders ADD CONSTRAINT "inbox_folders_pkey" PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='inbox_folders_tenant_id_name_key' AND conrelid='public.inbox_folders'::regclass) THEN
    ALTER TABLE public.inbox_folders ADD CONSTRAINT "inbox_folders_tenant_id_name_key" UNIQUE (tenant_id, name);
  END IF;
END $$;


ALTER TABLE public.inbox_folders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='inbox_folders' AND policyname='Users can manage their tenant folders') THEN
    CREATE POLICY "Users can manage their tenant folders" ON public.inbox_folders FOR ALL TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.loyalty_programs
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loyalty_programs (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "points_per_euro" integer DEFAULT 1 NOT NULL,
  "point_value" numeric(10,4) DEFAULT 0.01 NOT NULL,
  "min_redemption_points" integer DEFAULT 100 NOT NULL,
  "points_expiry_days" integer,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='loyalty_programs_tenant_id_fkey' AND conrelid='public.loyalty_programs'::regclass) THEN
    ALTER TABLE public.loyalty_programs ADD CONSTRAINT "loyalty_programs_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='loyalty_programs_pkey' AND conrelid='public.loyalty_programs'::regclass) THEN
    ALTER TABLE public.loyalty_programs ADD CONSTRAINT "loyalty_programs_pkey" PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='loyalty_programs_tenant_id_key' AND conrelid='public.loyalty_programs'::regclass) THEN
    ALTER TABLE public.loyalty_programs ADD CONSTRAINT "loyalty_programs_tenant_id_key" UNIQUE (tenant_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_loyalty_programs_tenant ON public.loyalty_programs USING btree (tenant_id);

ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_programs' AND policyname='Users can delete loyalty programs for their tenant') THEN
    CREATE POLICY "Users can delete loyalty programs for their tenant" ON public.loyalty_programs FOR DELETE TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_programs' AND policyname='Users can insert loyalty programs for their tenant') THEN
    CREATE POLICY "Users can insert loyalty programs for their tenant" ON public.loyalty_programs FOR INSERT TO public WITH CHECK ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_programs' AND policyname='Users can update loyalty programs for their tenant') THEN
    CREATE POLICY "Users can update loyalty programs for their tenant" ON public.loyalty_programs FOR UPDATE TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_programs' AND policyname='Users can view loyalty programs for their tenant') THEN
    CREATE POLICY "Users can view loyalty programs for their tenant" ON public.loyalty_programs FOR SELECT TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.loyalty_tiers
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loyalty_tiers (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "loyalty_program_id" uuid NOT NULL,
  "name" text NOT NULL,
  "min_points" integer DEFAULT 0 NOT NULL,
  "points_multiplier" numeric(3,2) DEFAULT 1.00 NOT NULL,
  "benefits" jsonb,
  "icon" text,
  "color" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='loyalty_tiers_loyalty_program_id_fkey' AND conrelid='public.loyalty_tiers'::regclass) THEN
    ALTER TABLE public.loyalty_tiers ADD CONSTRAINT "loyalty_tiers_loyalty_program_id_fkey" FOREIGN KEY (loyalty_program_id) REFERENCES loyalty_programs(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='loyalty_tiers_pkey' AND conrelid='public.loyalty_tiers'::regclass) THEN
    ALTER TABLE public.loyalty_tiers ADD CONSTRAINT "loyalty_tiers_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_loyalty_tiers_program ON public.loyalty_tiers USING btree (loyalty_program_id);

ALTER TABLE public.loyalty_tiers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_tiers' AND policyname='Users can delete loyalty tiers') THEN
    CREATE POLICY "Users can delete loyalty tiers" ON public.loyalty_tiers FOR DELETE TO public USING ((loyalty_program_id IN ( SELECT loyalty_programs.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_tiers' AND policyname='   FROM loyalty_programs') THEN
    CREATE POLICY "   FROM loyalty_programs" ON public.loyalty_tiers FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_tiers' AND policyname='  WHERE (loyalty_programs.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (loyalty_programs.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.loyalty_tiers FOR  TO PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_tiers' AND policyname='Users can insert loyalty tiers') THEN
    CREATE POLICY "Users can insert loyalty tiers" ON public.loyalty_tiers FOR INSERT TO public WITH CHECK ((loyalty_program_id IN ( SELECT loyalty_programs.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_tiers' AND policyname='   FROM loyalty_programs') THEN
    CREATE POLICY "   FROM loyalty_programs" ON public.loyalty_tiers FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_tiers' AND policyname='  WHERE (loyalty_programs.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (loyalty_programs.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.loyalty_tiers FOR PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_tiers' AND policyname='Users can update loyalty tiers') THEN
    CREATE POLICY "Users can update loyalty tiers" ON public.loyalty_tiers FOR UPDATE TO public USING ((loyalty_program_id IN ( SELECT loyalty_programs.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_tiers' AND policyname='   FROM loyalty_programs') THEN
    CREATE POLICY "   FROM loyalty_programs" ON public.loyalty_tiers FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_tiers' AND policyname='  WHERE (loyalty_programs.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (loyalty_programs.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.loyalty_tiers FOR  TO PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_tiers' AND policyname='Users can view loyalty tiers') THEN
    CREATE POLICY "Users can view loyalty tiers" ON public.loyalty_tiers FOR SELECT TO public USING ((loyalty_program_id IN ( SELECT loyalty_programs.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_tiers' AND policyname='   FROM loyalty_programs') THEN
    CREATE POLICY "   FROM loyalty_programs" ON public.loyalty_tiers FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_tiers' AND policyname='  WHERE (loyalty_programs.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (loyalty_programs.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.loyalty_tiers FOR  TO PERMISSIVE;
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.loyalty_transactions
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "customer_loyalty_id" uuid NOT NULL,
  "order_id" uuid,
  "points" integer NOT NULL,
  "transaction_type" text NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='loyalty_transactions_transaction_type_check' AND conrelid='public.loyalty_transactions'::regclass) THEN
    ALTER TABLE public.loyalty_transactions ADD CONSTRAINT "loyalty_transactions_transaction_type_check" CHECK ((transaction_type = ANY (ARRAY['earn'::text, 'redeem'::text, 'expire'::text, 'bonus'::text, 'adjustment'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='loyalty_transactions_customer_loyalty_id_fkey' AND conrelid='public.loyalty_transactions'::regclass) THEN
    ALTER TABLE public.loyalty_transactions ADD CONSTRAINT "loyalty_transactions_customer_loyalty_id_fkey" FOREIGN KEY (customer_loyalty_id) REFERENCES customer_loyalty(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='loyalty_transactions_order_id_fkey' AND conrelid='public.loyalty_transactions'::regclass) THEN
    ALTER TABLE public.loyalty_transactions ADD CONSTRAINT "loyalty_transactions_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='loyalty_transactions_pkey' AND conrelid='public.loyalty_transactions'::regclass) THEN
    ALTER TABLE public.loyalty_transactions ADD CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_loyalty ON public.loyalty_transactions USING btree (customer_loyalty_id);

ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_transactions' AND policyname='Users can insert loyalty transactions') THEN
    CREATE POLICY "Users can insert loyalty transactions" ON public.loyalty_transactions FOR INSERT TO public WITH CHECK ((customer_loyalty_id IN ( SELECT cl.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_transactions' AND policyname='   FROM (customer_loyalty cl') THEN
    CREATE POLICY "   FROM (customer_loyalty cl" ON public.loyalty_transactions FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_transactions' AND policyname='     JOIN loyalty_programs lp ON ((cl.loyalty_program_id = lp.id)))') THEN
    CREATE POLICY "     JOIN loyalty_programs lp ON ((cl.loyalty_program_id = lp.id)))" ON public.loyalty_transactions FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_transactions' AND policyname='  WHERE (lp.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (lp.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.loyalty_transactions FOR PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_transactions' AND policyname='Users can view loyalty transactions') THEN
    CREATE POLICY "Users can view loyalty transactions" ON public.loyalty_transactions FOR SELECT TO public USING ((customer_loyalty_id IN ( SELECT cl.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_transactions' AND policyname='   FROM (customer_loyalty cl') THEN
    CREATE POLICY "   FROM (customer_loyalty cl" ON public.loyalty_transactions FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_transactions' AND policyname='     JOIN loyalty_programs lp ON ((cl.loyalty_program_id = lp.id)))') THEN
    CREATE POLICY "     JOIN loyalty_programs lp ON ((cl.loyalty_program_id = lp.id)))" ON public.loyalty_transactions FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_transactions' AND policyname='  WHERE (lp.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (lp.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.loyalty_transactions FOR  TO PERMISSIVE;
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.marketplace_listing_queue
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_listing_queue (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "marketplace_type" text NOT NULL,
  "action" text NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb,
  "status" text DEFAULT 'pending'::text,
  "attempts" integer DEFAULT 0,
  "max_attempts" integer DEFAULT 3,
  "error_message" text,
  "ai_optimized_content" jsonb,
  "scheduled_for" timestamp with time zone DEFAULT now(),
  "processed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='marketplace_listing_queue_product_id_fkey' AND conrelid='public.marketplace_listing_queue'::regclass) THEN
    ALTER TABLE public.marketplace_listing_queue ADD CONSTRAINT "marketplace_listing_queue_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='marketplace_listing_queue_tenant_id_fkey' AND conrelid='public.marketplace_listing_queue'::regclass) THEN
    ALTER TABLE public.marketplace_listing_queue ADD CONSTRAINT "marketplace_listing_queue_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='marketplace_listing_queue_pkey' AND conrelid='public.marketplace_listing_queue'::regclass) THEN
    ALTER TABLE public.marketplace_listing_queue ADD CONSTRAINT "marketplace_listing_queue_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_listing_queue_tenant ON public.marketplace_listing_queue USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_listing_queue_scheduled ON public.marketplace_listing_queue USING btree (scheduled_for) WHERE (status = 'pending'::text);
CREATE INDEX IF NOT EXISTS idx_listing_queue_status ON public.marketplace_listing_queue USING btree (status);

ALTER TABLE public.marketplace_listing_queue ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='marketplace_listing_queue' AND policyname='Users can delete from their tenant's listing queue') THEN
    CREATE POLICY "Users can delete from their tenant's listing queue" ON public.marketplace_listing_queue FOR DELETE TO public USING ((tenant_id IN ( SELECT user_roles.tenant_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='marketplace_listing_queue' AND policyname='   FROM user_roles') THEN
    CREATE POLICY "   FROM user_roles" ON public.marketplace_listing_queue FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='marketplace_listing_queue' AND policyname='  WHERE (user_roles.user_id = auth.uid())))') THEN
    CREATE POLICY "  WHERE (user_roles.user_id = auth.uid())))" ON public.marketplace_listing_queue FOR  TO PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='marketplace_listing_queue' AND policyname='Users can insert into their tenant's listing queue') THEN
    CREATE POLICY "Users can insert into their tenant's listing queue" ON public.marketplace_listing_queue FOR INSERT TO public WITH CHECK ((tenant_id IN ( SELECT user_roles.tenant_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='marketplace_listing_queue' AND policyname='   FROM user_roles') THEN
    CREATE POLICY "   FROM user_roles" ON public.marketplace_listing_queue FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='marketplace_listing_queue' AND policyname='  WHERE (user_roles.user_id = auth.uid())))') THEN
    CREATE POLICY "  WHERE (user_roles.user_id = auth.uid())))" ON public.marketplace_listing_queue FOR PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='marketplace_listing_queue' AND policyname='Users can update their tenant's listing queue') THEN
    CREATE POLICY "Users can update their tenant's listing queue" ON public.marketplace_listing_queue FOR UPDATE TO public USING ((tenant_id IN ( SELECT user_roles.tenant_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='marketplace_listing_queue' AND policyname='   FROM user_roles') THEN
    CREATE POLICY "   FROM user_roles" ON public.marketplace_listing_queue FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='marketplace_listing_queue' AND policyname='  WHERE (user_roles.user_id = auth.uid())))') THEN
    CREATE POLICY "  WHERE (user_roles.user_id = auth.uid())))" ON public.marketplace_listing_queue FOR  TO PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='marketplace_listing_queue' AND policyname='Users can view their tenant's listing queue') THEN
    CREATE POLICY "Users can view their tenant's listing queue" ON public.marketplace_listing_queue FOR SELECT TO public USING ((tenant_id IN ( SELECT user_roles.tenant_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='marketplace_listing_queue' AND policyname='   FROM user_roles') THEN
    CREATE POLICY "   FROM user_roles" ON public.marketplace_listing_queue FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='marketplace_listing_queue' AND policyname='  WHERE (user_roles.user_id = auth.uid())))') THEN
    CREATE POLICY "  WHERE (user_roles.user_id = auth.uid())))" ON public.marketplace_listing_queue FOR  TO PERMISSIVE;
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.message_templates
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_templates (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "body" text NOT NULL,
  "category" text DEFAULT 'general'::text,
  "channel" text DEFAULT 'all'::text,
  "shortcut" text,
  "usage_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='message_templates_tenant_id_fkey' AND conrelid='public.message_templates'::regclass) THEN
    ALTER TABLE public.message_templates ADD CONSTRAINT "message_templates_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='message_templates_pkey' AND conrelid='public.message_templates'::regclass) THEN
    ALTER TABLE public.message_templates ADD CONSTRAINT "message_templates_pkey" PRIMARY KEY (id);
  END IF;
END $$;


ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='message_templates' AND policyname='Users can create message templates for their tenants') THEN
    CREATE POLICY "Users can create message templates for their tenants" ON public.message_templates FOR INSERT TO authenticated WITH CHECK ((tenant_id IN ( SELECT public.get_user_tenant_ids() AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='message_templates' AND policyname='Users can delete message templates for their tenants') THEN
    CREATE POLICY "Users can delete message templates for their tenants" ON public.message_templates FOR DELETE TO authenticated USING ((tenant_id IN ( SELECT public.get_user_tenant_ids() AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='message_templates' AND policyname='Users can update message templates for their tenants') THEN
    CREATE POLICY "Users can update message templates for their tenants" ON public.message_templates FOR UPDATE TO authenticated USING ((tenant_id IN ( SELECT public.get_user_tenant_ids() AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='message_templates' AND policyname='Users can view message templates for their tenants') THEN
    CREATE POLICY "Users can view message templates for their tenants" ON public.message_templates FOR SELECT TO authenticated USING ((tenant_id IN ( SELECT public.get_user_tenant_ids() AS get_user_tenant_ids)));
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.pos_cashiers
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pos_cashiers (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "display_name" text NOT NULL,
  "pin_hash" text NOT NULL,
  "avatar_color" text DEFAULT '#3b82f6'::text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pos_cashiers_tenant_id_fkey' AND conrelid='public.pos_cashiers'::regclass) THEN
    ALTER TABLE public.pos_cashiers ADD CONSTRAINT "pos_cashiers_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pos_cashiers_pkey' AND conrelid='public.pos_cashiers'::regclass) THEN
    ALTER TABLE public.pos_cashiers ADD CONSTRAINT "pos_cashiers_pkey" PRIMARY KEY (id);
  END IF;
END $$;


ALTER TABLE public.pos_cashiers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pos_cashiers' AND policyname='Tenant admins can manage cashiers') THEN
    CREATE POLICY "Tenant admins can manage cashiers" ON public.pos_cashiers FOR ALL TO authenticated USING ((tenant_id IN ( SELECT public.get_user_tenant_ids() AS get_user_tenant_ids))) WITH CHECK ((tenant_id IN ( SELECT public.get_user_tenant_ids() AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pos_cashiers' AND policyname='Tenant members can view cashiers') THEN
    CREATE POLICY "Tenant members can view cashiers" ON public.pos_cashiers FOR SELECT TO authenticated USING ((tenant_id IN ( SELECT public.get_user_tenant_ids() AS get_user_tenant_ids)));
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.product_bundles
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_bundles (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "bundle_type" text DEFAULT 'fixed'::text NOT NULL,
  "discount_type" text DEFAULT 'percentage'::text NOT NULL,
  "discount_value" numeric(10,2) DEFAULT 0 NOT NULL,
  "min_items" integer DEFAULT 1,
  "max_items" integer,
  "image_url" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "valid_from" timestamp with time zone,
  "valid_until" timestamp with time zone,
  "usage_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='product_bundles_bundle_type_check' AND conrelid='public.product_bundles'::regclass) THEN
    ALTER TABLE public.product_bundles ADD CONSTRAINT "product_bundles_bundle_type_check" CHECK ((bundle_type = ANY (ARRAY['fixed'::text, 'mix_match'::text, 'build_your_own'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='product_bundles_discount_type_check' AND conrelid='public.product_bundles'::regclass) THEN
    ALTER TABLE public.product_bundles ADD CONSTRAINT "product_bundles_discount_type_check" CHECK ((discount_type = ANY (ARRAY['percentage'::text, 'fixed_amount'::text, 'fixed_price'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='product_bundles_tenant_id_fkey' AND conrelid='public.product_bundles'::regclass) THEN
    ALTER TABLE public.product_bundles ADD CONSTRAINT "product_bundles_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='product_bundles_pkey' AND conrelid='public.product_bundles'::regclass) THEN
    ALTER TABLE public.product_bundles ADD CONSTRAINT "product_bundles_pkey" PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='product_bundles_tenant_id_slug_key' AND conrelid='public.product_bundles'::regclass) THEN
    ALTER TABLE public.product_bundles ADD CONSTRAINT "product_bundles_tenant_id_slug_key" UNIQUE (tenant_id, slug);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_bundles_tenant ON public.product_bundles USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_bundles_active ON public.product_bundles USING btree (tenant_id, is_active) WHERE (is_active = true);

ALTER TABLE public.product_bundles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_bundles' AND policyname='Users can delete bundles for their tenant') THEN
    CREATE POLICY "Users can delete bundles for their tenant" ON public.product_bundles FOR DELETE TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_bundles' AND policyname='Users can insert bundles for their tenant') THEN
    CREATE POLICY "Users can insert bundles for their tenant" ON public.product_bundles FOR INSERT TO public WITH CHECK ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_bundles' AND policyname='Users can update bundles for their tenant') THEN
    CREATE POLICY "Users can update bundles for their tenant" ON public.product_bundles FOR UPDATE TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_bundles' AND policyname='Users can view bundles for their tenant') THEN
    CREATE POLICY "Users can view bundles for their tenant" ON public.product_bundles FOR SELECT TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.product_categories
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_categories (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL,
  "category_id" uuid NOT NULL,
  "is_primary" boolean DEFAULT false NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='product_categories_category_id_fkey' AND conrelid='public.product_categories'::regclass) THEN
    ALTER TABLE public.product_categories ADD CONSTRAINT "product_categories_category_id_fkey" FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='product_categories_product_id_fkey' AND conrelid='public.product_categories'::regclass) THEN
    ALTER TABLE public.product_categories ADD CONSTRAINT "product_categories_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='product_categories_pkey' AND conrelid='public.product_categories'::regclass) THEN
    ALTER TABLE public.product_categories ADD CONSTRAINT "product_categories_pkey" PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='product_categories_product_id_category_id_key' AND conrelid='public.product_categories'::regclass) THEN
    ALTER TABLE public.product_categories ADD CONSTRAINT "product_categories_product_id_category_id_key" UNIQUE (product_id, category_id);
  END IF;
END $$;


ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_categories' AND policyname='Platform admins can manage product categories') THEN
    CREATE POLICY "Platform admins can manage product categories" ON public.product_categories FOR ALL TO public USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_categories' AND policyname='Platform admins can view all product categories') THEN
    CREATE POLICY "Platform admins can view all product categories" ON public.product_categories FOR SELECT TO public USING (is_platform_admin(auth.uid()));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_categories' AND policyname='Public read for active products') THEN
    CREATE POLICY "Public read for active products" ON public.product_categories FOR SELECT TO public USING ((EXISTS ( SELECT 1);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_categories' AND policyname='   FROM products p') THEN
    CREATE POLICY "   FROM products p" ON public.product_categories FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_categories' AND policyname='  WHERE ((p.id = product_categories.product_id) AND (p.is_active = true))))') THEN
    CREATE POLICY "  WHERE ((p.id = product_categories.product_id) AND (p.is_active = true))))" ON public.product_categories FOR  TO PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_categories' AND policyname='Tenant users can manage product categories') THEN
    CREATE POLICY "Tenant users can manage product categories" ON public.product_categories FOR ALL TO public USING ((EXISTS ( SELECT 1);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_categories' AND policyname='   FROM (products p') THEN
    CREATE POLICY "   FROM (products p" ON public.product_categories FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_categories' AND policyname='     JOIN user_roles ur ON ((ur.tenant_id = p.tenant_id)))') THEN
    CREATE POLICY "     JOIN user_roles ur ON ((ur.tenant_id = p.tenant_id)))" ON public.product_categories FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_categories' AND policyname='  WHERE ((p.id = product_categories.product_id) AND (ur.user_id = auth.uid()))))') THEN
    CREATE POLICY "  WHERE ((p.id = product_categories.product_id) AND (ur.user_id = auth.uid()))))" ON public.product_categories FOR (EXISTS ( SELECT 1;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_categories' AND policyname='   FROM (products p') THEN
    CREATE POLICY "   FROM (products p" ON public.product_categories FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_categories' AND policyname='     JOIN user_roles ur ON ((ur.tenant_id = p.tenant_id)))') THEN
    CREATE POLICY "     JOIN user_roles ur ON ((ur.tenant_id = p.tenant_id)))" ON public.product_categories FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_categories' AND policyname='  WHERE ((p.id = product_categories.product_id) AND (ur.user_id = auth.uid()))))') THEN
    CREATE POLICY "  WHERE ((p.id = product_categories.product_id) AND (ur.user_id = auth.uid()))))" ON public.product_categories FOR PERMISSIVE;
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.returns
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.returns (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "order_id" uuid,
  "marketplace_connection_id" uuid,
  "marketplace_return_id" character varying,
  "marketplace_order_id" character varying,
  "status" return_status DEFAULT 'registered'::return_status NOT NULL,
  "return_reason" text,
  "return_reason_code" character varying,
  "customer_name" text,
  "items" jsonb DEFAULT '[]'::jsonb,
  "handling_result" character varying,
  "registration_date" timestamp with time zone,
  "raw_marketplace_data" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "internal_notes" text,
  "refund_amount" numeric(10,2),
  "refund_status" refund_status_enum DEFAULT 'pending'::refund_status_enum,
  "refund_method" character varying,
  "stripe_refund_id" text,
  "source" character varying DEFAULT 'marketplace'::character varying,
  "refund_notes" text,
  "customer_id" uuid,
  "rma_number" text,
  "subtotal" numeric(12,2),
  "restocking_fees_total" numeric(12,2) DEFAULT 0,
  "shipping_refund" numeric(12,2) DEFAULT 0,
  "expected_arrival_date" date,
  "received_at" timestamp with time zone,
  "approved_by" uuid,
  "approved_at" timestamp with time zone,
  "refund_approved_at" timestamp with time zone,
  "refund_approved_by" uuid,
  "refund_initiated_at" timestamp with time zone,
  "refund_initiated_by" uuid,
  "refund_completed_at" timestamp with time zone,
  "refund_failed_at" timestamp with time zone,
  "refund_failure_reason" text,
  "label_url" text,
  "label_tracking_number" text,
  "label_carrier" text,
  "label_sent_at" timestamp with time zone
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='returns_customer_id_fkey' AND conrelid='public.returns'::regclass) THEN
    ALTER TABLE public.returns ADD CONSTRAINT "returns_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='returns_marketplace_connection_id_fkey' AND conrelid='public.returns'::regclass) THEN
    ALTER TABLE public.returns ADD CONSTRAINT "returns_marketplace_connection_id_fkey" FOREIGN KEY (marketplace_connection_id) REFERENCES marketplace_connections(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='returns_order_id_fkey' AND conrelid='public.returns'::regclass) THEN
    ALTER TABLE public.returns ADD CONSTRAINT "returns_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='returns_refund_approved_by_fkey' AND conrelid='public.returns'::regclass) THEN
    ALTER TABLE public.returns ADD CONSTRAINT "returns_refund_approved_by_fkey" FOREIGN KEY (refund_approved_by) REFERENCES auth.users(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='returns_refund_initiated_by_fkey' AND conrelid='public.returns'::regclass) THEN
    ALTER TABLE public.returns ADD CONSTRAINT "returns_refund_initiated_by_fkey" FOREIGN KEY (refund_initiated_by) REFERENCES auth.users(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='returns_tenant_id_fkey' AND conrelid='public.returns'::regclass) THEN
    ALTER TABLE public.returns ADD CONSTRAINT "returns_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='returns_pkey' AND conrelid='public.returns'::regclass) THEN
    ALTER TABLE public.returns ADD CONSTRAINT "returns_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_returns_status ON public.returns USING btree (status);
CREATE INDEX IF NOT EXISTS idx_returns_connection_id ON public.returns USING btree (marketplace_connection_id);
CREATE UNIQUE INDEX IF NOT EXISTS returns_marketplace_unique ON public.returns USING btree (marketplace_connection_id, marketplace_return_id) WHERE ((marketplace_connection_id IS NOT NULL) AND (marketplace_return_id IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_returns_customer_id ON public.returns USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_returns_tenant_id ON public.returns USING btree (tenant_id);

ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='returns' AND policyname='Service role full access returns') THEN
    CREATE POLICY "Service role full access returns" ON public.returns FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='returns' AND policyname='Tenants can insert own returns') THEN
    CREATE POLICY "Tenants can insert own returns" ON public.returns FOR INSERT TO authenticated WITH CHECK ((tenant_id IN ( SELECT public.get_user_tenant_ids() AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='returns' AND policyname='Tenants can update own returns') THEN
    CREATE POLICY "Tenants can update own returns" ON public.returns FOR UPDATE TO authenticated USING ((tenant_id IN ( SELECT public.get_user_tenant_ids() AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='returns' AND policyname='Tenants can view own returns') THEN
    CREATE POLICY "Tenants can view own returns" ON public.returns FOR SELECT TO authenticated USING ((tenant_id IN ( SELECT public.get_user_tenant_ids() AS get_user_tenant_ids)));
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.storefront_api_keys
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.storefront_api_keys (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "key_hash" text NOT NULL,
  "key_prefix" text NOT NULL,
  "name" text DEFAULT 'Storefront API Key'::text,
  "created_at" timestamp with time zone DEFAULT now(),
  "last_used_at" timestamp with time zone,
  "is_active" boolean DEFAULT true
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='storefront_api_keys_tenant_id_fkey' AND conrelid='public.storefront_api_keys'::regclass) THEN
    ALTER TABLE public.storefront_api_keys ADD CONSTRAINT "storefront_api_keys_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='storefront_api_keys_pkey' AND conrelid='public.storefront_api_keys'::regclass) THEN
    ALTER TABLE public.storefront_api_keys ADD CONSTRAINT "storefront_api_keys_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_storefront_api_keys_tenant ON public.storefront_api_keys USING btree (tenant_id);

ALTER TABLE public.storefront_api_keys ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='storefront_api_keys' AND policyname='Tenant admins can delete API keys') THEN
    CREATE POLICY "Tenant admins can delete API keys" ON public.storefront_api_keys FOR DELETE TO public USING ((tenant_id IN ( SELECT ur.tenant_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='storefront_api_keys' AND policyname='   FROM user_roles ur') THEN
    CREATE POLICY "   FROM user_roles ur" ON public.storefront_api_keys FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='storefront_api_keys' AND policyname='  WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['platform_admin'::app_role, 'tenant_admin'::app_role])))))') THEN
    CREATE POLICY "  WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['platform_admin'::app_role, 'tenant_admin'::app_role])))))" ON public.storefront_api_keys FOR  TO PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='storefront_api_keys' AND policyname='Tenant admins can insert API keys') THEN
    CREATE POLICY "Tenant admins can insert API keys" ON public.storefront_api_keys FOR INSERT TO public WITH CHECK ((tenant_id IN ( SELECT ur.tenant_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='storefront_api_keys' AND policyname='   FROM user_roles ur') THEN
    CREATE POLICY "   FROM user_roles ur" ON public.storefront_api_keys FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='storefront_api_keys' AND policyname='  WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['platform_admin'::app_role, 'tenant_admin'::app_role])))))') THEN
    CREATE POLICY "  WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['platform_admin'::app_role, 'tenant_admin'::app_role])))))" ON public.storefront_api_keys FOR PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='storefront_api_keys' AND policyname='Tenant admins can update API keys') THEN
    CREATE POLICY "Tenant admins can update API keys" ON public.storefront_api_keys FOR UPDATE TO public USING ((tenant_id IN ( SELECT ur.tenant_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='storefront_api_keys' AND policyname='   FROM user_roles ur') THEN
    CREATE POLICY "   FROM user_roles ur" ON public.storefront_api_keys FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='storefront_api_keys' AND policyname='  WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['platform_admin'::app_role, 'tenant_admin'::app_role])))))') THEN
    CREATE POLICY "  WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['platform_admin'::app_role, 'tenant_admin'::app_role])))))" ON public.storefront_api_keys FOR  TO PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='storefront_api_keys' AND policyname='Tenant members can view API keys') THEN
    CREATE POLICY "Tenant members can view API keys" ON public.storefront_api_keys FOR SELECT TO public USING ((tenant_id IN ( SELECT ur.tenant_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='storefront_api_keys' AND policyname='   FROM user_roles ur') THEN
    CREATE POLICY "   FROM user_roles ur" ON public.storefront_api_keys FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='storefront_api_keys' AND policyname='  WHERE (ur.user_id = auth.uid())))') THEN
    CREATE POLICY "  WHERE (ur.user_id = auth.uid())))" ON public.storefront_api_keys FOR  TO PERMISSIVE;
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.storefront_webhooks
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.storefront_webhooks (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "url" text NOT NULL,
  "events" text[] DEFAULT '{}'::text[],
  "secret" text,
  "is_active" boolean DEFAULT true,
  "last_delivery_at" timestamp with time zone,
  "last_delivery_status" integer,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='storefront_webhooks_tenant_id_fkey' AND conrelid='public.storefront_webhooks'::regclass) THEN
    ALTER TABLE public.storefront_webhooks ADD CONSTRAINT "storefront_webhooks_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='storefront_webhooks_pkey' AND conrelid='public.storefront_webhooks'::regclass) THEN
    ALTER TABLE public.storefront_webhooks ADD CONSTRAINT "storefront_webhooks_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_storefront_webhooks_tenant ON public.storefront_webhooks USING btree (tenant_id);

ALTER TABLE public.storefront_webhooks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='storefront_webhooks' AND policyname='Tenant admins can manage webhooks') THEN
    CREATE POLICY "Tenant admins can manage webhooks" ON public.storefront_webhooks FOR ALL TO public USING ((tenant_id IN ( SELECT ur.tenant_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='storefront_webhooks' AND policyname='   FROM user_roles ur') THEN
    CREATE POLICY "   FROM user_roles ur" ON public.storefront_webhooks FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='storefront_webhooks' AND policyname='  WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['platform_admin'::app_role, 'tenant_admin'::app_role])))))') THEN
    CREATE POLICY "  WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['platform_admin'::app_role, 'tenant_admin'::app_role])))))" ON public.storefront_webhooks FOR  TO PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='storefront_webhooks' AND policyname='Tenant members can view webhooks') THEN
    CREATE POLICY "Tenant members can view webhooks" ON public.storefront_webhooks FOR SELECT TO public USING ((tenant_id IN ( SELECT ur.tenant_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='storefront_webhooks' AND policyname='   FROM user_roles ur') THEN
    CREATE POLICY "   FROM user_roles ur" ON public.storefront_webhooks FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='storefront_webhooks' AND policyname='  WHERE (ur.user_id = auth.uid())))') THEN
    CREATE POLICY "  WHERE (ur.user_id = auth.uid())))" ON public.storefront_webhooks FOR  TO PERMISSIVE;
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.sync_conflicts
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sync_conflicts (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "connection_id" uuid NOT NULL,
  "data_type" text NOT NULL,
  "record_id" text NOT NULL,
  "sellqo_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "platform_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "conflict_fields" text[] DEFAULT '{}'::text[],
  "detected_at" timestamp with time zone DEFAULT now(),
  "resolved_at" timestamp with time zone,
  "resolved_by" uuid,
  "resolution" text,
  "resolution_data" jsonb,
  "created_at" timestamp with time zone DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='sync_conflicts_resolution_check' AND conrelid='public.sync_conflicts'::regclass) THEN
    ALTER TABLE public.sync_conflicts ADD CONSTRAINT "sync_conflicts_resolution_check" CHECK ((resolution = ANY (ARRAY['sellqo'::text, 'platform'::text, 'merged'::text, 'dismissed'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='sync_conflicts_connection_id_fkey' AND conrelid='public.sync_conflicts'::regclass) THEN
    ALTER TABLE public.sync_conflicts ADD CONSTRAINT "sync_conflicts_connection_id_fkey" FOREIGN KEY (connection_id) REFERENCES marketplace_connections(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='sync_conflicts_tenant_id_fkey' AND conrelid='public.sync_conflicts'::regclass) THEN
    ALTER TABLE public.sync_conflicts ADD CONSTRAINT "sync_conflicts_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='sync_conflicts_pkey' AND conrelid='public.sync_conflicts'::regclass) THEN
    ALTER TABLE public.sync_conflicts ADD CONSTRAINT "sync_conflicts_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sync_conflicts_tenant_unresolved ON public.sync_conflicts USING btree (tenant_id, connection_id) WHERE (resolved_at IS NULL);

ALTER TABLE public.sync_conflicts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sync_conflicts' AND policyname='Users can manage their tenant sync conflicts') THEN
    CREATE POLICY "Users can manage their tenant sync conflicts" ON public.sync_conflicts FOR ALL TO public USING ((tenant_id IN ( SELECT user_roles.tenant_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sync_conflicts' AND policyname='   FROM user_roles') THEN
    CREATE POLICY "   FROM user_roles" ON public.sync_conflicts FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sync_conflicts' AND policyname='  WHERE (user_roles.user_id = auth.uid())))') THEN
    CREATE POLICY "  WHERE (user_roles.user_id = auth.uid())))" ON public.sync_conflicts FOR  TO PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sync_conflicts' AND policyname='Users can view their tenant sync conflicts') THEN
    CREATE POLICY "Users can view their tenant sync conflicts" ON public.sync_conflicts FOR SELECT TO public USING ((tenant_id IN ( SELECT user_roles.tenant_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sync_conflicts' AND policyname='   FROM user_roles') THEN
    CREATE POLICY "   FROM user_roles" ON public.sync_conflicts FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sync_conflicts' AND policyname='  WHERE (user_roles.user_id = auth.uid())))') THEN
    CREATE POLICY "  WHERE (user_roles.user_id = auth.uid())))" ON public.sync_conflicts FOR  TO PERMISSIVE;
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.tenant_feature_overrides
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_feature_overrides (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "module_ai_marketing" boolean,
  "module_peppol" boolean,
  "module_multi_currency" boolean,
  "module_advanced_analytics" boolean,
  "module_api_access" boolean,
  "module_webhooks" boolean,
  "module_white_label" boolean,
  "module_facturx" boolean,
  "limit_products_override" integer,
  "limit_orders_override" integer,
  "limit_customers_override" integer,
  "limit_users_override" integer,
  "limit_storage_gb_override" integer,
  "limit_api_calls_override" integer,
  "extended_trial_until" date,
  "admin_notes" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "hidden_pages" text[] DEFAULT '{}'::text[] NOT NULL,
  "granted_features" text[] DEFAULT '{}'::text[]
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='tenant_feature_overrides_tenant_id_fkey' AND conrelid='public.tenant_feature_overrides'::regclass) THEN
    ALTER TABLE public.tenant_feature_overrides ADD CONSTRAINT "tenant_feature_overrides_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='tenant_feature_overrides_pkey' AND conrelid='public.tenant_feature_overrides'::regclass) THEN
    ALTER TABLE public.tenant_feature_overrides ADD CONSTRAINT "tenant_feature_overrides_pkey" PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='tenant_feature_overrides_tenant_id_key' AND conrelid='public.tenant_feature_overrides'::regclass) THEN
    ALTER TABLE public.tenant_feature_overrides ADD CONSTRAINT "tenant_feature_overrides_tenant_id_key" UNIQUE (tenant_id);
  END IF;
END $$;


ALTER TABLE public.tenant_feature_overrides ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tenant_feature_overrides' AND policyname='Platform admins can manage feature overrides') THEN
    CREATE POLICY "Platform admins can manage feature overrides" ON public.tenant_feature_overrides FOR ALL TO authenticated USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.tenant_transaction_usage
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_transaction_usage (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "month_year" text NOT NULL,
  "stripe_transactions" integer DEFAULT 0,
  "bank_transfer_transactions" integer DEFAULT 0,
  "pos_cash_transactions" integer DEFAULT 0,
  "pos_card_transactions" integer DEFAULT 0,
  "overage_fee_total" numeric(10,2) DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='tenant_transaction_usage_tenant_id_fkey' AND conrelid='public.tenant_transaction_usage'::regclass) THEN
    ALTER TABLE public.tenant_transaction_usage ADD CONSTRAINT "tenant_transaction_usage_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='tenant_transaction_usage_pkey' AND conrelid='public.tenant_transaction_usage'::regclass) THEN
    ALTER TABLE public.tenant_transaction_usage ADD CONSTRAINT "tenant_transaction_usage_pkey" PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='tenant_transaction_usage_tenant_id_month_year_key' AND conrelid='public.tenant_transaction_usage'::regclass) THEN
    ALTER TABLE public.tenant_transaction_usage ADD CONSTRAINT "tenant_transaction_usage_tenant_id_month_year_key" UNIQUE (tenant_id, month_year);
  END IF;
END $$;


ALTER TABLE public.tenant_transaction_usage ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tenant_transaction_usage' AND policyname='Platform admins can view all transaction usage') THEN
    CREATE POLICY "Platform admins can view all transaction usage" ON public.tenant_transaction_usage FOR SELECT TO public USING (is_platform_admin(auth.uid()));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tenant_transaction_usage' AND policyname='Tenants can view their own transaction usage') THEN
    CREATE POLICY "Tenants can view their own transaction usage" ON public.tenant_transaction_usage FOR SELECT TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.volume_discount_tiers
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.volume_discount_tiers (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "volume_discount_id" uuid NOT NULL,
  "min_quantity" integer NOT NULL,
  "max_quantity" integer,
  "discount_type" text DEFAULT 'percentage'::text NOT NULL,
  "discount_value" numeric(10,2) NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='volume_discount_tiers_discount_type_check' AND conrelid='public.volume_discount_tiers'::regclass) THEN
    ALTER TABLE public.volume_discount_tiers ADD CONSTRAINT "volume_discount_tiers_discount_type_check" CHECK ((discount_type = ANY (ARRAY['percentage'::text, 'fixed_per_item'::text, 'fixed_price'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='volume_discount_tiers_volume_discount_id_fkey' AND conrelid='public.volume_discount_tiers'::regclass) THEN
    ALTER TABLE public.volume_discount_tiers ADD CONSTRAINT "volume_discount_tiers_volume_discount_id_fkey" FOREIGN KEY (volume_discount_id) REFERENCES volume_discounts(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='volume_discount_tiers_pkey' AND conrelid='public.volume_discount_tiers'::regclass) THEN
    ALTER TABLE public.volume_discount_tiers ADD CONSTRAINT "volume_discount_tiers_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_volume_discount_tiers_discount ON public.volume_discount_tiers USING btree (volume_discount_id);

ALTER TABLE public.volume_discount_tiers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='volume_discount_tiers' AND policyname='Users can delete volume discount tiers') THEN
    CREATE POLICY "Users can delete volume discount tiers" ON public.volume_discount_tiers FOR DELETE TO public USING ((volume_discount_id IN ( SELECT volume_discounts.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='volume_discount_tiers' AND policyname='   FROM volume_discounts') THEN
    CREATE POLICY "   FROM volume_discounts" ON public.volume_discount_tiers FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='volume_discount_tiers' AND policyname='  WHERE (volume_discounts.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (volume_discounts.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.volume_discount_tiers FOR  TO PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='volume_discount_tiers' AND policyname='Users can insert volume discount tiers') THEN
    CREATE POLICY "Users can insert volume discount tiers" ON public.volume_discount_tiers FOR INSERT TO public WITH CHECK ((volume_discount_id IN ( SELECT volume_discounts.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='volume_discount_tiers' AND policyname='   FROM volume_discounts') THEN
    CREATE POLICY "   FROM volume_discounts" ON public.volume_discount_tiers FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='volume_discount_tiers' AND policyname='  WHERE (volume_discounts.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (volume_discounts.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.volume_discount_tiers FOR PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='volume_discount_tiers' AND policyname='Users can update volume discount tiers') THEN
    CREATE POLICY "Users can update volume discount tiers" ON public.volume_discount_tiers FOR UPDATE TO public USING ((volume_discount_id IN ( SELECT volume_discounts.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='volume_discount_tiers' AND policyname='   FROM volume_discounts') THEN
    CREATE POLICY "   FROM volume_discounts" ON public.volume_discount_tiers FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='volume_discount_tiers' AND policyname='  WHERE (volume_discounts.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (volume_discounts.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.volume_discount_tiers FOR  TO PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='volume_discount_tiers' AND policyname='Users can view volume discount tiers') THEN
    CREATE POLICY "Users can view volume discount tiers" ON public.volume_discount_tiers FOR SELECT TO public USING ((volume_discount_id IN ( SELECT volume_discounts.id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='volume_discount_tiers' AND policyname='   FROM volume_discounts') THEN
    CREATE POLICY "   FROM volume_discounts" ON public.volume_discount_tiers FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='volume_discount_tiers' AND policyname='  WHERE (volume_discounts.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))') THEN
    CREATE POLICY "  WHERE (volume_discounts.tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids))))" ON public.volume_discount_tiers FOR  TO PERMISSIVE;
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.volume_discounts
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.volume_discounts (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "applies_to" text DEFAULT 'all'::text NOT NULL,
  "product_ids" uuid[],
  "category_ids" uuid[],
  "is_active" boolean DEFAULT true NOT NULL,
  "valid_from" timestamp with time zone,
  "valid_until" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='volume_discounts_applies_to_check' AND conrelid='public.volume_discounts'::regclass) THEN
    ALTER TABLE public.volume_discounts ADD CONSTRAINT "volume_discounts_applies_to_check" CHECK ((applies_to = ANY (ARRAY['all'::text, 'specific_products'::text, 'specific_categories'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='volume_discounts_tenant_id_fkey' AND conrelid='public.volume_discounts'::regclass) THEN
    ALTER TABLE public.volume_discounts ADD CONSTRAINT "volume_discounts_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='volume_discounts_pkey' AND conrelid='public.volume_discounts'::regclass) THEN
    ALTER TABLE public.volume_discounts ADD CONSTRAINT "volume_discounts_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_volume_discounts_tenant ON public.volume_discounts USING btree (tenant_id);

ALTER TABLE public.volume_discounts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='volume_discounts' AND policyname='Users can delete volume discounts for their tenant') THEN
    CREATE POLICY "Users can delete volume discounts for their tenant" ON public.volume_discounts FOR DELETE TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='volume_discounts' AND policyname='Users can insert volume discounts for their tenant') THEN
    CREATE POLICY "Users can insert volume discounts for their tenant" ON public.volume_discounts FOR INSERT TO public WITH CHECK ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='volume_discounts' AND policyname='Users can update volume discounts for their tenant') THEN
    CREATE POLICY "Users can update volume discounts for their tenant" ON public.volume_discounts FOR UPDATE TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='volume_discounts' AND policyname='Users can view volume discounts for their tenant') THEN
    CREATE POLICY "Users can view volume discounts for their tenant" ON public.volume_discounts FOR SELECT TO public USING ((tenant_id IN ( SELECT get_user_tenant_ids(auth.uid()) AS get_user_tenant_ids)));
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Table: public.webhook_deliveries
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "webhook_id" uuid NOT NULL,
  "tenant_id" uuid NOT NULL,
  "event" text NOT NULL,
  "payload" jsonb,
  "response_status" integer,
  "response_body" text,
  "delivered_at" timestamp with time zone DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='webhook_deliveries_tenant_id_fkey' AND conrelid='public.webhook_deliveries'::regclass) THEN
    ALTER TABLE public.webhook_deliveries ADD CONSTRAINT "webhook_deliveries_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='webhook_deliveries_webhook_id_fkey' AND conrelid='public.webhook_deliveries'::regclass) THEN
    ALTER TABLE public.webhook_deliveries ADD CONSTRAINT "webhook_deliveries_webhook_id_fkey" FOREIGN KEY (webhook_id) REFERENCES storefront_webhooks(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='webhook_deliveries_pkey' AND conrelid='public.webhook_deliveries'::regclass) THEN
    ALTER TABLE public.webhook_deliveries ADD CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_tenant ON public.webhook_deliveries USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON public.webhook_deliveries USING btree (webhook_id);

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='webhook_deliveries' AND policyname='System can insert deliveries') THEN
    CREATE POLICY "System can insert deliveries" ON public.webhook_deliveries FOR INSERT TO public WITH CHECK ((tenant_id IN ( SELECT ur.tenant_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='webhook_deliveries' AND policyname='   FROM user_roles ur') THEN
    CREATE POLICY "   FROM user_roles ur" ON public.webhook_deliveries FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='webhook_deliveries' AND policyname='  WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['platform_admin'::app_role, 'tenant_admin'::app_role])))))') THEN
    CREATE POLICY "  WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['platform_admin'::app_role, 'tenant_admin'::app_role])))))" ON public.webhook_deliveries FOR PERMISSIVE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='webhook_deliveries' AND policyname='Tenant members can view deliveries') THEN
    CREATE POLICY "Tenant members can view deliveries" ON public.webhook_deliveries FOR SELECT TO public USING ((tenant_id IN ( SELECT ur.tenant_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='webhook_deliveries' AND policyname='   FROM user_roles ur') THEN
    CREATE POLICY "   FROM user_roles ur" ON public.webhook_deliveries FOR ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='webhook_deliveries' AND policyname='  WHERE (ur.user_id = auth.uid())))') THEN
    CREATE POLICY "  WHERE (ur.user_id = auth.uid())))" ON public.webhook_deliveries FOR  TO PERMISSIVE;
  END IF;
END $$;
