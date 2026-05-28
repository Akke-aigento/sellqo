import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { authenticateRequest, AuthError, authErrorResponse } from "../_shared/auth.ts";
import { renderSellqoEmail, htmlToPlainText } from "../_shared/sellqoEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  email: string;
  role: 'tenant_admin' | 'staff' | 'accountant' | 'warehouse' | 'viewer';
  tenantId: string;
}

const roleLabels: Record<string, { nl: string; description: string }> = {
  tenant_admin: { nl: 'Admin', description: 'Volledige toegang tot alle functies' },
  staff: { nl: 'Medewerker', description: 'Kan producten, orders en klanten beheren' },
  accountant: { nl: 'Boekhouder', description: 'Toegang tot facturen, rapporten en BTW-gegevens' },
  warehouse: { nl: 'Magazijn', description: 'Kan voorraad en verzending beheren' },
  viewer: { nl: 'Kijker', description: 'Alleen lezen, geen wijzigingen' },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
      throw new Error("Not authorized to invite users to this tenant");
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

    // Send email
    const resend = new Resend(resendApiKey);
    const inviteUrl = `https://sellqo.lovable.app/invite/${invitation.token}`;
    const roleInfo = roleLabels[role] || { nl: role, description: '' };
    const expiresDate = new Date(invitation.expires_at).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const tenantName = tenant.name || 'een team';
    const html = renderSellqoEmail({
      preheader: `Je bent uitgenodigd om deel te nemen aan ${tenantName} op SellQo.`,
      heading: `Je bent uitgenodigd voor ${tenantName}`,
      intro: `
        <p style="margin:0 0 12px;">Hallo,</p>
        <p style="margin:0;">Je werd uitgenodigd om als <strong>${roleInfo.nl.toLowerCase()}</strong> deel te nemen aan het team van <strong>${tenantName}</strong> op SellQo. Klik op de knop hieronder om de uitnodiging te accepteren en aan de slag te gaan.</p>
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
      from: `SellQo <noreply@sellqo.app>`,
      reply_to: 'support@sellqo.app',
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
