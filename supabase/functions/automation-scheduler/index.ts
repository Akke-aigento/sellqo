import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AutomationRun {
  id: string;
  automation_id: string;
  tenant_id: string;
  trigger_entity_id: string;
  trigger_entity_type: string;
  current_step: number;
  metadata: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find scheduled runs that are due
    const { data: dueRuns, error: runsError } = await supabase
      .from("automation_runs")
      .select(`
        *,
        automation:email_automations(*),
        tenant:tenants(name, email, street, city, postal_code)
      `)
      .eq("status", "scheduled")
      .lte("scheduled_for", new Date().toISOString())
      .limit(50);

    if (runsError) {
      throw runsError;
    }

    if (!dueRuns?.length) {
      return new Response(JSON.stringify({ processed: 0, message: "No runs due" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let errors = 0;

    for (const run of dueRuns) {
      try {
        // Mark as in progress
        await supabase
          .from("automation_runs")
          .update({ status: "in_progress", started_at: new Date().toISOString() })
          .eq("id", run.id);

        // Get current step
        const { data: steps } = await supabase
          .from("automation_steps")
          .select("*")
          .eq("automation_id", run.automation_id)
          .eq("is_active", true)
          .order("step_order")
          .range(run.current_step, run.current_step);

        const currentStep = steps?.[0];

        if (!currentStep) {
          // No more steps, mark as completed
          await supabase
            .from("automation_runs")
            .update({ 
              status: "completed", 
              completed_at: new Date().toISOString() 
            })
            .eq("id", run.id);

          await supabase
            .from("email_automations")
            .update({ total_completed: run.automation.total_completed + 1 })
            .eq("id", run.automation_id);

          processed++;
          continue;
        }

        // Get recipient info based on trigger type
        let recipient: { email: string; name: string } | null = null;

        if (run.trigger_entity_type === "subscriber") {
          const { data: subscriber } = await supabase
            .from("newsletter_subscribers")
            .select("email, first_name")
            .eq("id", run.trigger_entity_id)
            .single();

          if (subscriber) {
            recipient = { email: subscriber.email, name: subscriber.first_name || "Klant" };
          }
        } else if (run.trigger_entity_type === "customer") {
          const { data: customer } = await supabase
            .from("customers")
            .select("email, first_name, last_name, company_name")
            .eq("id", run.trigger_entity_id)
            .single();

          if (customer) {
            recipient = { 
              email: customer.email, 
              name: customer.first_name || customer.company_name || "Klant" 
            };
          }
        } else if (run.trigger_entity_type === "order") {
          const { data: order } = await supabase
            .from("orders")
            .select("customer_email, customer:customers(first_name, company_name)")
            .eq("id", run.trigger_entity_id)
            .single();

          if (order) {
            const customerData = order.customer as { first_name?: string; company_name?: string } | null;
            recipient = { 
              email: order.customer_email, 
              name: customerData?.first_name || customerData?.company_name || "Klant"
            };
          }
        }

        if (!recipient) {
          await supabase
            .from("automation_runs")
            .update({ 
              status: "failed", 
              error_message: "Recipient not found",
              completed_at: new Date().toISOString()
            })
            .eq("id", run.id);
          errors++;
          continue;
        }

        // Check if recipient is unsubscribed
        const { data: unsubscribe } = await supabase
          .from("email_unsubscribes")
          .select("id")
          .eq("tenant_id", run.tenant_id)
          .ilike("email", recipient.email)
          .maybeSingle();

        if (unsubscribe) {
          await supabase
            .from("automation_runs")
            .update({ 
              status: "cancelled", 
              error_message: "Recipient unsubscribed",
              completed_at: new Date().toISOString()
            })
            .eq("id", run.id);
          continue;
        }

        // Execute step based on action type
        if (currentStep.action_type === "send_email" && resendApiKey) {
          // Get template if specified
          let htmlContent = "";
          let subject = currentStep.subject_override || "";

          if (currentStep.template_id) {
            const { data: template } = await supabase
              .from("email_templates")
              .select("*")
              .eq("id", currentStep.template_id)
              .single();

            if (template) {
              htmlContent = template.html_content;
              subject = subject || template.subject;
            }
          }

          if (!htmlContent) {
            // Use automation's template
            if (run.automation.template_id) {
              const { data: template } = await supabase
                .from("email_templates")
                .select("*")
                .eq("id", run.automation.template_id)
                .single();

              if (template) {
                htmlContent = template.html_content;
                subject = subject || template.subject;
              }
            }
          }

          if (htmlContent && subject) {
            const tenant = run.tenant;
            const companyAddress = tenant ? `${tenant.street || ""}, ${tenant.postal_code || ""} ${tenant.city || ""}` : "";

            // Replace variables
            htmlContent = htmlContent
              .replace(/\{\{customer_name\}\}/g, recipient.name)
              .replace(/\{\{customer_email\}\}/g, recipient.email)
              .replace(/\{\{company_name\}\}/g, tenant?.name || "")
              .replace(/\{\{company_address\}\}/g, companyAddress)
              .replace(/\{\{unsubscribe_url\}\}/g, `${supabaseUrl}/functions/v1/unsubscribe?email=${encodeURIComponent(recipient.email)}&tenant=${run.tenant_id}`);

            subject = subject
              .replace(/\{\{customer_name\}\}/g, recipient.name)
              .replace(/\{\{company_name\}\}/g, tenant?.name || "");

            const resend = new Resend(resendApiKey);
            await resend.emails.send({
              from: `${tenant?.name || 'Sellqo'} <noreply@sellqo.app>`,
              to: [recipient.email],
              subject,
              html: htmlContent,
            });

            // Log step run
            await supabase.from("automation_step_runs").insert({
              automation_run_id: run.id,
              step_id: currentStep.id,
              status: "sent",
              executed_at: new Date().toISOString(),
              result: { email: recipient.email, subject },
            });

            // Update automation stats
            await supabase
              .from("email_automations")
              .update({ total_sent: run.automation.total_sent + 1 })
              .eq("id", run.automation_id);
          }
        }

        // Check for next step
        const { data: nextSteps } = await supabase
          .from("automation_steps")
          .select("*")
          .eq("automation_id", run.automation_id)
          .eq("is_active", true)
          .gt("step_order", currentStep.step_order)
          .order("step_order")
          .limit(1);

        const nextStep = nextSteps?.[0];

        if (nextStep) {
          // Schedule next step
          const nextSchedule = new Date();
          nextSchedule.setHours(nextSchedule.getHours() + (nextStep.delay_hours || 0));
          nextSchedule.setMinutes(nextSchedule.getMinutes() + (nextStep.delay_minutes || 0));

          await supabase
            .from("automation_runs")
            .update({ 
              status: "scheduled",
              current_step: run.current_step + 1,
              scheduled_for: nextSchedule.toISOString()
            })
            .eq("id", run.id);
        } else {
          // Automation complete
          await supabase
            .from("automation_runs")
            .update({ 
              status: "completed",
              completed_at: new Date().toISOString()
            })
            .eq("id", run.id);

          await supabase
            .from("email_automations")
            .update({ total_completed: run.automation.total_completed + 1 })
            .eq("id", run.automation_id);
        }

        processed++;
      } catch (runError) {
        console.error(`Error processing run ${run.id}:`, runError);
        
        await supabase
          .from("automation_runs")
          .update({ 
            status: "failed",
            error_message: runError instanceof Error ? runError.message : String(runError),
            completed_at: new Date().toISOString()
          })
          .eq("id", run.id);

        errors++;
      }
    }

    return new Response(JSON.stringify({ 
      processed, 
      errors,
      total: dueRuns.length 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Automation scheduler error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : String(error) 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
