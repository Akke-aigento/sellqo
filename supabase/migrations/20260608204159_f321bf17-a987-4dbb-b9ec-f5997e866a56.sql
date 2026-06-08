-- Batch 2C2a-i — Email marketing engine RLS-aanscherping
-- Cluster 1 (recon §1). Beslispunten §7-1, §7-3, §7-4, §7-5 bevestigd.

-- =============================================================
-- email_campaigns
-- =============================================================
DROP POLICY IF EXISTS "Users can view campaigns for their tenants" ON public.email_campaigns;
DROP POLICY IF EXISTS "Users can insert campaigns for their tenants" ON public.email_campaigns;
DROP POLICY IF EXISTS "Users can update campaigns for their tenants" ON public.email_campaigns;
DROP POLICY IF EXISTS "Users can delete campaigns for their tenants" ON public.email_campaigns;

CREATE POLICY "Tenant users can view campaigns"
ON public.email_campaigns FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Marketing roles can insert campaigns"
ON public.email_campaigns FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can update campaigns"
ON public.email_campaigns FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can delete campaigns"
ON public.email_campaigns FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

-- =============================================================
-- email_templates
-- =============================================================
DROP POLICY IF EXISTS "Users can view templates for their tenants" ON public.email_templates;
DROP POLICY IF EXISTS "Users can insert templates for their tenants" ON public.email_templates;
DROP POLICY IF EXISTS "Users can update templates for their tenants" ON public.email_templates;
DROP POLICY IF EXISTS "Users can delete templates for their tenants" ON public.email_templates;

CREATE POLICY "Tenant users can view email templates"
ON public.email_templates FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Marketing roles can insert email templates"
ON public.email_templates FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can update email templates"
ON public.email_templates FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can delete email templates"
ON public.email_templates FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

-- =============================================================
-- email_template_blocks — scoped via template_id → email_templates.tenant_id
-- (table has GEEN tenant_id kolom)
-- =============================================================
DROP POLICY IF EXISTS "Users can view template blocks for their tenant" ON public.email_template_blocks;
DROP POLICY IF EXISTS "Users can insert template blocks for their tenant" ON public.email_template_blocks;
DROP POLICY IF EXISTS "Users can update template blocks for their tenant" ON public.email_template_blocks;
DROP POLICY IF EXISTS "Users can delete template blocks for their tenant" ON public.email_template_blocks;

CREATE POLICY "Tenant users can view template blocks"
ON public.email_template_blocks FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.email_templates t
    WHERE t.id = email_template_blocks.template_id
      AND t.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  )
);

CREATE POLICY "Marketing roles can insert template blocks"
ON public.email_template_blocks FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.email_templates t
    WHERE t.id = email_template_blocks.template_id
      AND public.has_tenant_role(t.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
);

CREATE POLICY "Marketing roles can update template blocks"
ON public.email_template_blocks FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.email_templates t
    WHERE t.id = email_template_blocks.template_id
      AND public.has_tenant_role(t.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.email_templates t
    WHERE t.id = email_template_blocks.template_id
      AND public.has_tenant_role(t.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
);

CREATE POLICY "Marketing roles can delete template blocks"
ON public.email_template_blocks FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.email_templates t
    WHERE t.id = email_template_blocks.template_id
      AND public.has_tenant_role(t.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
);

-- =============================================================
-- email_signatures
-- =============================================================
DROP POLICY IF EXISTS "Users can view signatures for their tenant" ON public.email_signatures;
DROP POLICY IF EXISTS "Users can create signatures for their tenant" ON public.email_signatures;
DROP POLICY IF EXISTS "Users can update signatures for their tenant" ON public.email_signatures;
DROP POLICY IF EXISTS "Users can delete signatures for their tenant" ON public.email_signatures;

CREATE POLICY "Tenant users can view email signatures"
ON public.email_signatures FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Marketing roles can insert email signatures"
ON public.email_signatures FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can update email signatures"
ON public.email_signatures FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can delete email signatures"
ON public.email_signatures FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

-- =============================================================
-- customer_segments
-- =============================================================
DROP POLICY IF EXISTS "Users can view segments for their tenants" ON public.customer_segments;
DROP POLICY IF EXISTS "Users can insert segments for their tenants" ON public.customer_segments;
DROP POLICY IF EXISTS "Users can update segments for their tenants" ON public.customer_segments;
DROP POLICY IF EXISTS "Users can delete segments for their tenants" ON public.customer_segments;

CREATE POLICY "Tenant users can view customer segments"
ON public.customer_segments FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Marketing roles can insert customer segments"
ON public.customer_segments FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can update customer segments"
ON public.customer_segments FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can delete customer segments"
ON public.customer_segments FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

-- =============================================================
-- segment_members (junction)
-- =============================================================
DROP POLICY IF EXISTS "Users can view segment members for their tenants" ON public.segment_members;
DROP POLICY IF EXISTS "Users can insert segment members for their tenants" ON public.segment_members;
DROP POLICY IF EXISTS "Users can delete segment members for their tenants" ON public.segment_members;

CREATE POLICY "Tenant users can view segment members"
ON public.segment_members FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.customer_segments s
    WHERE s.id = segment_members.segment_id
      AND s.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  )
);

CREATE POLICY "Marketing roles can insert segment members"
ON public.segment_members FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.customer_segments s
    WHERE s.id = segment_members.segment_id
      AND public.has_tenant_role(s.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
);

CREATE POLICY "Marketing roles can delete segment members"
ON public.segment_members FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.customer_segments s
    WHERE s.id = segment_members.segment_id
      AND public.has_tenant_role(s.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
);

-- =============================================================
-- email_automations
-- =============================================================
DROP POLICY IF EXISTS "Users can view automations for their tenants" ON public.email_automations;
DROP POLICY IF EXISTS "Users can insert automations for their tenants" ON public.email_automations;
DROP POLICY IF EXISTS "Users can update automations for their tenants" ON public.email_automations;
DROP POLICY IF EXISTS "Users can delete automations for their tenants" ON public.email_automations;

CREATE POLICY "Tenant users can view email automations"
ON public.email_automations FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Marketing roles can insert email automations"
ON public.email_automations FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can update email automations"
ON public.email_automations FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can delete email automations"
ON public.email_automations FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

-- =============================================================
-- automation_steps (scoped via automation_id → email_automations.tenant_id)
-- =============================================================
DROP POLICY IF EXISTS "Users can view automation steps for their tenant" ON public.automation_steps;
DROP POLICY IF EXISTS "Users can insert automation steps for their tenant" ON public.automation_steps;
DROP POLICY IF EXISTS "Users can update automation steps for their tenant" ON public.automation_steps;
DROP POLICY IF EXISTS "Users can delete automation steps for their tenant" ON public.automation_steps;

CREATE POLICY "Tenant users can view automation steps"
ON public.automation_steps FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.email_automations a
    WHERE a.id = automation_steps.automation_id
      AND a.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  )
);

CREATE POLICY "Marketing roles can insert automation steps"
ON public.automation_steps FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.email_automations a
    WHERE a.id = automation_steps.automation_id
      AND public.has_tenant_role(a.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
);

CREATE POLICY "Marketing roles can update automation steps"
ON public.automation_steps FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.email_automations a
    WHERE a.id = automation_steps.automation_id
      AND public.has_tenant_role(a.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.email_automations a
    WHERE a.id = automation_steps.automation_id
      AND public.has_tenant_role(a.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
);

CREATE POLICY "Marketing roles can delete automation steps"
ON public.automation_steps FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.email_automations a
    WHERE a.id = automation_steps.automation_id
      AND public.has_tenant_role(a.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
);

-- =============================================================
-- automation_runs
-- =============================================================
DROP POLICY IF EXISTS "Users can view automation runs for their tenant" ON public.automation_runs;
DROP POLICY IF EXISTS "Users can insert automation runs for their tenant" ON public.automation_runs;
DROP POLICY IF EXISTS "Users can update automation runs for their tenant" ON public.automation_runs;
DROP POLICY IF EXISTS "Users can delete automation runs for their tenant" ON public.automation_runs;

CREATE POLICY "Tenant users can view automation runs"
ON public.automation_runs FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Marketing roles can insert automation runs"
ON public.automation_runs FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can update automation runs"
ON public.automation_runs FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can delete automation runs"
ON public.automation_runs FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

-- automation_step_runs: bestaande SELECT-policy is tenant-scoped via automation_runs;
-- writes blijven service-role only (geen auth-policy). Geen wijziging.

-- =============================================================
-- campaign_sends — viewer UITGESLOTEN (§7-1); INSERT service-role only
-- =============================================================
DROP POLICY IF EXISTS "Users can view campaign sends for their tenants" ON public.campaign_sends;
DROP POLICY IF EXISTS "Users can insert campaign sends for their tenants" ON public.campaign_sends;
DROP POLICY IF EXISTS "Users can update campaign sends for their tenants" ON public.campaign_sends;
DROP POLICY IF EXISTS "Users can delete campaign sends for their tenants" ON public.campaign_sends;

CREATE POLICY "Marketing roles can view campaign sends"
ON public.campaign_sends FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.email_campaigns c
    WHERE c.id = campaign_sends.campaign_id
      AND c.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      AND public.has_tenant_role(c.tenant_id, ARRAY['tenant_admin','staff','marketing','accountant']::app_role[])
  )
);

CREATE POLICY "Marketing roles can update campaign sends"
ON public.campaign_sends FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.email_campaigns c
    WHERE c.id = campaign_sends.campaign_id
      AND public.has_tenant_role(c.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.email_campaigns c
    WHERE c.id = campaign_sends.campaign_id
      AND public.has_tenant_role(c.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
);

CREATE POLICY "Marketing roles can delete campaign sends"
ON public.campaign_sends FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.email_campaigns c
    WHERE c.id = campaign_sends.campaign_id
      AND public.has_tenant_role(c.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
);

-- =============================================================
-- campaign_link_clicks — §7-3 KRITIEKE FIX: drop unbounded `true` INSERT
-- =============================================================
DROP POLICY IF EXISTS "Service role can insert link clicks" ON public.campaign_link_clicks;
DROP POLICY IF EXISTS "Tenant users can view own link clicks" ON public.campaign_link_clicks;

CREATE POLICY "Marketing roles can view link clicks"
ON public.campaign_link_clicks FOR SELECT TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing','accountant']::app_role[])
);

-- INSERT: GEEN auth-policy → impliciete deny. Service-role bypass RLS.

CREATE POLICY "Marketing roles can update link clicks"
ON public.campaign_link_clicks FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can delete link clicks"
ON public.campaign_link_clicks FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

-- =============================================================
-- newsletter_subscribers — drop anon "Public newsletter signup"
-- =============================================================
DROP POLICY IF EXISTS "Public newsletter signup" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Tenant users can view subscribers" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Tenant users can insert subscribers" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Tenant users can update subscribers" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Tenant users can delete subscribers" ON public.newsletter_subscribers;

CREATE POLICY "Tenant users can view newsletter subscribers"
ON public.newsletter_subscribers FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Marketing roles can insert newsletter subscribers"
ON public.newsletter_subscribers FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can update newsletter subscribers"
ON public.newsletter_subscribers FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Marketing roles can delete newsletter subscribers"
ON public.newsletter_subscribers FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

-- =============================================================
-- email_unsubscribes — §7-4: INSERT service-role only
-- =============================================================
DROP POLICY IF EXISTS "Users can view unsubscribes for their tenants" ON public.email_unsubscribes;
DROP POLICY IF EXISTS "Users can insert unsubscribes for their tenants" ON public.email_unsubscribes;

CREATE POLICY "Marketing roles can view email unsubscribes"
ON public.email_unsubscribes FOR SELECT TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing','accountant']::app_role[])
);

CREATE POLICY "Tenant admins can update email unsubscribes"
ON public.email_unsubscribes FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
);

CREATE POLICY "Tenant admins can delete email unsubscribes"
ON public.email_unsubscribes FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
);

-- =============================================================
-- tenant_newsletter_config — tenant_admin only voor writes
-- =============================================================
DROP POLICY IF EXISTS "Tenant users can view config" ON public.tenant_newsletter_config;
DROP POLICY IF EXISTS "Tenant users can insert config" ON public.tenant_newsletter_config;
DROP POLICY IF EXISTS "Tenant users can update config" ON public.tenant_newsletter_config;

CREATE POLICY "Tenant users can view newsletter config"
ON public.tenant_newsletter_config FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant admins can insert newsletter config"
ON public.tenant_newsletter_config FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
);

CREATE POLICY "Tenant admins can update newsletter config"
ON public.tenant_newsletter_config FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
);

CREATE POLICY "Tenant admins can delete newsletter config"
ON public.tenant_newsletter_config FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
);
