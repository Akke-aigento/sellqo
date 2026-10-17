import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { authenticateRequest, AuthError, authErrorResponse } from "../_shared/auth.ts";
import { renderSellqoEmail, htmlToPlainText } from "../_shared/sellqoEmail.ts";
import { EMAIL_SENDERS } from "../_shared/emailSenders.ts";
import { INVITE_ROLE_ERROR, isInviteRole } from "../_shared/inviteRoles.ts";

// SEC-INVITE-1 — GET-versiestempel om de deploy te bewijzen (geen auth, geen bijwerking).
const VERSION = "SEC-INVITE-1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  email: string;
  role: unknown;
  tenantId: string;
}

const roleLabels: Record<string, { nl: string; description: string }> = {
  tenant_admin: { nl: 'Admin', description: 'Volledige toegang tot alle functies' },
  staff: { nl: 'Medewerker', description: 'Kan producten, orders en klanten beheren' },
  accountant: { nl: 'Boekhouder', description: 'Toegang tot financiële gegevens en facturatie' },
  warehouse: { nl: 'Magazijn', description: 'Kan voorraad beheren, verzendingen verwerken' },
  marketing: { nl: 'Marketing', description: 'Campagnes, kortingen, ads, CMS en SEO' },
  viewer: { nl: 'Kijker', description: 'Alleen lezen. Kan alles bekijken maar niets wijzigen' },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true, version: VERSION }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const auth = await authenticateRequest(req);
    const user = { id: auth.user_id };

    const { email, role, tenantId }: InvitationRequest = await req.json();

    // SEC-INVITE-1 — alleen de rollen die de team-UI aanbiedt; platform_admin nooit.
    // De role komt ongecontroleerd uit de body en gaat met service_role de tabel in,
    // dus RLS beschermt hier niets: deze check wel.
    if (!isInviteRole(role)) {
      return new Response(
        JSON.stringify({ error: INVITE_ROLE_ERROR }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }
    if (typeof email !== "string" || !email.trim() || typeof tenantId !== "string" || !tenantId) {
      return new Response(
        JSON.stringify({ error: "E-mailadres en winkel zijn verplicht" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Check if user is platform admin (can invite to any tenant)
    const { data: platformAdminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "platform_admin")
      .is("tenant_id", null)
      .maybeSingle();

    // If not platform admin, check if tenant admin for this specific tenant
    let isAuthorized = !!platformAdminRole;

    if (!isAuthorized) {
      const { data: tenantRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId)
        .eq("role", "tenant_admin")
        .maybeSingle();
        
      isAuthorized = !!tenantRole;
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: "Alleen een beheerder van deze winkel kan teamleden uitnodigen" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Get tenant info
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", tenantId)
      .single();

    if (tenantError || !tenant) {
      throw new Error("Tenant not found");
    }

    // Check if already a member - first find the user by email
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (existingProfile) {
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("user_id", existingProfile.id)
        .maybeSingle();

      if (existingRole) {
        throw new Error("Deze gebruiker is al lid van dit team");
      }
    }

    // LIMITS-1: niet meer uitnodigen dan het plan toelaat (leden + openstaande uitnodigingen).
    // Zelfde uitzonderingen als de databanktrigger: vrijgesteld, intern, demo, in afwachting, proef.
    {
      const { data: tFlags } = await supabase
        .from("tenants")
        .select("billing_exempt, is_internal_tenant, is_demo, billing_on_hold")
        .eq("id", tenantId)
        .maybeSingle();
      const unlimited = !tFlags || tFlags.billing_exempt || tFlags.is_internal_tenant || tFlags.is_demo || tFlags.billing_on_hold;
      if (!unlimited) {
        const { data: sub } = await supabase
          .from("tenant_subscriptions")
          .select("status, trial_end, pricing_plans!plan_id(limit_users)")
          .eq("tenant_id", tenantId)
          .maybeSingle();
        const limit = (sub as { pricing_plans?: { limit_users?: number | null } | null } | null)?.pricing_plans?.limit_users ?? null;
        const trialRunning = sub?.status === "trialing" && (!sub?.trial_end || new Date(sub.trial_end as string).getTime() > Date.now());
        if (limit != null && !trialRunning) {
          // Teamgrootte uit dezelfde databankfunctie als de trigger (zonder platformbeheerders).
          const { data: teamSize } = await supabase.rpc("platform_team_size", { p_tenant_id: tenantId });
          const members = Number(teamSize ?? 0);
          // Openstaande uitnodigingen: niet aanvaard, niet verlopen, niet ingetrokken of geweigerd;
          // een nieuwe uitnodiging voor hetzelfde adres vervangt de oude (hieronder).
          const { count: pending } = await supabase
            .from("team_invitations")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId)
            .is("accepted_at", null)
            .gt("expires_at", new Date().toISOString())
            .not("status", "in", "(revoked,rejected)")
            .neq("email", email.toLowerCase());
          if (members + (pending ?? 0) >= limit) {
            return new Response(
              JSON.stringify({ error: "Je team zit op het maximum van je plan (leden en openstaande uitnodigingen). Upgrade om iemand extra uit te nodigen.", code: "PLAN_LIMIT_USERS" }),
              { status: 409, headers: { "Content-Type": "application/json", ...corsHeaders } },
            );
          }
        }
      }
    }

    // Auto-replace any existing pending invitation
    await supabase
      .from("team_invitations")
      .delete()
      .eq("tenant_id", tenantId)
      .ilike("email", email)
      .is("accepted_at", null);

    // Create invitation
    const { data: invitation, error: insertError } = await supabase
      .from("team_invitations")
      .insert({
        tenant_id: tenantId,
        email: email.toLowerCase(),
        role,
        invited_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      throw new Error("Kon uitnodiging niet aanmaken: " + insertError.message);
    }

    // NB: we DO NOT delete tenant_access_revocations here anymore. The row
    // is our signal to fetch-invitation that this user was previously in
    // this tenant, so the UI must show the "kies nieuw wachtwoord" flow
    // instead of asking for their old (forgotten) password.
    // accept-team-invitation opruimt de rij na een succesvolle acceptatie.

    // Fetch inviter display name for email + audit metadata
    let invitedByName: string | null = null;
    try {
      const { data: inviterProfile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .maybeSingle();
      invitedByName = inviterProfile?.full_name || inviterProfile?.email || null;
    } catch (_e) {
      // non-fatal
    }

    // Audit log: 'sent'
    try {
      await supabase.from("invite_audit_log").insert({
        invitation_id: invitation.id,
        tenant_id: tenantId,
        event_type: "sent",
        actor_user_id: user.id,
        actor_email: invitedByName,
        metadata: { email: email.toLowerCase(), role, invited_by_name: invitedByName },
      });
    } catch (auditErr) {
      console.warn("audit log insert failed (sent)", auditErr);
    }

    // Send email
    const resend = new Resend(resendApiKey);
    const inviteUrl = `${Deno.env.get("PUBLIC_APP_URL") || "https://sellqo.app"}/invite/${invitation.token}`;
    const roleInfo = roleLabels[role] || { nl: role, description: '' };
    const expiresDate = new Date(invitation.expires_at).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const tenantName = tenant.name || 'een team';
    const inviterLine = invitedByName
      ? `<strong>${invitedByName}</strong> heeft je uitgenodigd om als `
      : `Je werd uitgenodigd om als `;
    const html = renderSellqoEmail({
      preheader: `Je bent uitgenodigd om deel te nemen aan ${tenantName} op SellQo.`,
      heading: `Je bent uitgenodigd voor ${tenantName}`,
      intro: `
        <p style="margin:0 0 12px;">Hallo,</p>
        <p style="margin:0;">${inviterLine}<strong>${roleInfo.nl.toLowerCase()}</strong> deel te nemen aan het team van <strong>${tenantName}</strong> op SellQo. Klik op de knop hieronder om de uitnodiging te accepteren en aan de slag te gaan.</p>
      `,
      infoBox: {
        title: `Jouw rol: ${roleInfo.nl}`,
        subtitle: roleInfo.description,
      },
      cta: { label: 'Uitnodiging accepteren', url: inviteUrl },
      ctaNote: `Deze uitnodiging is geldig tot <strong>${expiresDate}</strong>.<br/>Werkt de knop niet? Kopieer en plak deze link in je browser:<br/><a href="${inviteUrl}" style="color:#1d3a5f;word-break:break-all;">${inviteUrl}</a>`,
      footerNote: 'Heb je deze uitnodiging niet verwacht? Je mag deze e-mail veilig negeren — er gebeurt niets met je gegevens.',
    });

    const text = [
      `Je bent uitgenodigd voor ${tenantName}`,
      ``,
      `Hallo,`,
      ``,
      `Je werd uitgenodigd om als ${roleInfo.nl.toLowerCase()} deel te nemen aan het team van ${tenantName} op SellQo.`,
      ``,
      `Jouw rol: ${roleInfo.nl}`,
      roleInfo.description ? `(${roleInfo.description})` : '',
      ``,
      `Accepteer de uitnodiging:`,
      inviteUrl,
      ``,
      `Deze uitnodiging is geldig tot ${expiresDate}.`,
      ``,
      `Heb je deze uitnodiging niet verwacht? Dan mag je deze e-mail negeren.`,
      ``,
      `— SellQo · https://sellqo.app`,
    ].filter(Boolean).join('\n');

    const emailResponse = await resend.emails.send({
      from: EMAIL_SENDERS.invite.from,
      reply_to: EMAIL_SENDERS.invite.replyTo,
      to: [email],
      subject: `Je bent uitgenodigd voor ${tenantName}`,
      html,
      text: htmlToPlainText(text),
    });

    console.log("Invitation email sent:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, invitationId: invitation.id }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending invitation:", error);
    if (error instanceof AuthError) {
      return authErrorResponse(error, corsHeaders);
    }
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
