import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

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

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { email, role, tenantId }: InvitationRequest = await req.json();

    // Verify user is admin of this tenant
    const { data: userRole, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .single();

    if (roleError || !userRole || !['tenant_admin', 'platform_admin'].includes(userRole.role)) {
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

    // Check if already a member
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("tenant_id", tenantId)
      .in("user_id", 
        supabase.from("profiles").select("id").eq("email", email.toLowerCase())
      )
      .maybeSingle();

    if (existingRole) {
      throw new Error("Deze gebruiker is al lid van dit team");
    }

    // Check for existing pending invitation
    const { data: existingInvitation } = await supabase
      .from("team_invitations")
      .select("id")
      .eq("tenant_id", tenantId)
      .ilike("email", email)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (existingInvitation) {
      throw new Error("Er is al een openstaande uitnodiging voor dit e-mailadres");
    }

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

    const emailResponse = await resend.emails.send({
      from: "Sellqo <onboarding@resend.dev>",
      to: [email],
      subject: `Je bent uitgenodigd voor ${tenant.name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #16a34a; margin-bottom: 5px;">Sellqo</h1>
          </div>
          
          <div style="background: #f8f9fa; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
            <h2 style="margin-top: 0;">Je bent uitgenodigd!</h2>
            <p>Je bent uitgenodigd om deel te nemen aan het team van <strong>${tenant.name}</strong> op Sellqo.</p>
            
            <div style="background: white; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; font-weight: 600;">Je rol: ${roleInfo.nl}</p>
              <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">${roleInfo.description}</p>
            </div>
            
            <a href="${inviteUrl}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 10px;">
              Uitnodiging accepteren
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; text-align: center;">
            Deze uitnodiging is geldig tot ${expiresDate}.<br>
            Als je deze uitnodiging niet verwachtte, kun je deze e-mail negeren.
          </p>
        </body>
        </html>
      `,
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
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
