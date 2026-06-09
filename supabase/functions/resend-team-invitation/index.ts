import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";
import { renderSellqoEmail, htmlToPlainText } from "../_shared/sellqoEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const roleLabels: Record<string, { nl: string; description: string }> = {
  tenant_admin: { nl: "Admin", description: "Volledige toegang tot alle functies" },
  staff: { nl: "Medewerker", description: "Kan producten, orders en klanten beheren" },
  accountant: { nl: "Boekhouder", description: "Toegang tot financiële gegevens en facturatie" },
  warehouse: { nl: "Magazijn", description: "Kan voorraad beheren, verzendingen verwerken" },
  viewer: { nl: "Kijker", description: "Alleen lezen. Kan alles bekijken maar niets wijzigen" },
  marketing: { nl: "Marketing", description: "Campagnes, kortingen, ads, CMS en SEO" },
};

interface ResendBody {
  invitation_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const auth = await authenticateRequest(req);
    const { invitation_id }: ResendBody = await req.json();
    if (!invitation_id) {
      return new Response(JSON.stringify({ error: "invitation_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: invitation, error: fetchErr } = await supabase
      .from("team_invitations")
      .select("id, tenant_id, email, role, status, expires_at, token, invited_by, tenants(name)")
      .eq("id", invitation_id)
      .maybeSingle();

    if (fetchErr || !invitation) {
      return new Response(JSON.stringify({ error: "Uitnodiging niet gevonden" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    requireRole(auth, invitation.tenant_id, ["tenant_admin"]);

    if (invitation.status === "accepted") {
      return new Response(JSON.stringify({ error: "Uitnodiging is reeds geaccepteerd" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Revoked, expired, rejected en pending mogen allemaal worden gereactiveerd:
    // we resetten status naar 'pending' en verlengen expires_at.

    const previousExpires = invitation.expires_at;
    const newExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: updErr } = await supabase
      .from("team_invitations")
      .update({
        status: "pending",
        expires_at: newExpires,
        last_reminder_sent_at: null,
      })
      .eq("id", invitation.id);
    if (updErr) throw updErr;

    // Inviter display name
    let invitedByName: string | null = null;
    if (invitation.invited_by) {
      try {
        const { data: inviter } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", invitation.invited_by)
          .maybeSingle();
        invitedByName = inviter?.full_name || inviter?.email || null;
      } catch (_e) {}
    }

    // Build + send email (mirrors send-team-invitation)
    const resend = new Resend(resendApiKey);
    const inviteUrl = `https://sellqo.lovable.app/invite/${invitation.token}`;
    const roleInfo = roleLabels[invitation.role] || { nl: invitation.role, description: "" };
    const expiresDate = new Date(newExpires).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const tenantName = (invitation.tenants as any)?.name || "een team";
    const inviterLine = invitedByName
      ? `<strong>${invitedByName}</strong> heeft je opnieuw uitgenodigd om als `
      : `Herinnering: je werd uitgenodigd om als `;

    const html = renderSellqoEmail({
      preheader: `Herinnering: je uitnodiging voor ${tenantName} op SellQo is verlengd.`,
      heading: `Je uitnodiging voor ${tenantName}`,
      intro: `
        <p style="margin:0 0 12px;">Hallo,</p>
        <p style="margin:0;">${inviterLine}<strong>${roleInfo.nl.toLowerCase()}</strong> deel te nemen aan het team van <strong>${tenantName}</strong> op SellQo. We hebben de uitnodiging zojuist opnieuw verstuurd en verlengd.</p>
      `,
      infoBox: { title: `Jouw rol: ${roleInfo.nl}`, subtitle: roleInfo.description },
      cta: { label: "Uitnodiging accepteren", url: inviteUrl },
      ctaNote: `Deze uitnodiging is geldig tot <strong>${expiresDate}</strong>.<br/>Werkt de knop niet? Kopieer en plak deze link in je browser:<br/><a href="${inviteUrl}" style="color:#1d3a5f;word-break:break-all;">${inviteUrl}</a>`,
      footerNote: "Heb je deze uitnodiging niet verwacht? Je mag deze e-mail veilig negeren.",
    });

    const text = htmlToPlainText(
      [
        `Je uitnodiging voor ${tenantName}`,
        ``,
        `Hallo,`,
        ``,
        invitedByName
          ? `${invitedByName} heeft je opnieuw uitgenodigd om als ${roleInfo.nl.toLowerCase()} deel te nemen aan ${tenantName} op SellQo.`
          : `Herinnering: je werd uitgenodigd om als ${roleInfo.nl.toLowerCase()} deel te nemen aan ${tenantName} op SellQo.`,
        ``,
        `Accepteer de uitnodiging: ${inviteUrl}`,
        ``,
        `Geldig tot ${expiresDate}.`,
      ].join("\n")
    );

    await resend.emails.send({
      from: `SellQo <noreply@sellqo.app>`,
      reply_to: "support@sellqo.app",
      to: [invitation.email],
      subject: `Herinnering: je uitnodiging voor ${tenantName}`,
      html,
      text,
    });

    try {
      await supabase.from("invite_audit_log").insert({
        invitation_id: invitation.id,
        tenant_id: invitation.tenant_id,
        event_type: "resent",
        actor_user_id: auth.user_id === "service_role" ? null : auth.user_id,
        actor_email: auth.email ?? null,
        metadata: {
          email: invitation.email,
          role: invitation.role,
          previous_expires_at: previousExpires,
          new_expires_at: newExpires,
        },
      });
    } catch (auditErr) {
      console.warn("audit log insert failed (resent)", auditErr);
    }

    return new Response(
      JSON.stringify({ success: true, expiresAt: newExpires }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders);
    console.error("resend-team-invitation error", error);
    return new Response(JSON.stringify({ error: error.message || "Onbekende fout" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});