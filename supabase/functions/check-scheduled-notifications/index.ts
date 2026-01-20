import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationToSend {
  tenant_id: string;
  category: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  action_url: string;
  data: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const notifications: NotificationToSend[] = [];
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    console.log(`[${today}] Starting scheduled notification check...`);

    // =============================================
    // 1. OVERDUE INVOICES
    // =============================================
    
    // Get invoices with due dates that have passed
    const { data: overdueInvoices, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        id, tenant_id, invoice_number, total, due_date, customer_id,
        customers (first_name, last_name, company_name, email)
      `)
      .eq("status", "sent")
      .not("due_date", "is", null)
      .lt("due_date", today);

    if (invoiceError) {
      console.error("Error fetching overdue invoices:", invoiceError);
    } else if (overdueInvoices) {
      for (const invoice of overdueInvoices) {
        const dueDate = new Date(invoice.due_date);
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Determine notification type based on days overdue
        let type: string;
        let priority: string;
        let shouldNotify = false;

        if (daysOverdue === 1) {
          type = "invoice_overdue";
          priority = "high";
          shouldNotify = true;
        } else if (daysOverdue === 7) {
          type = "invoice_overdue_7days";
          priority = "high";
          shouldNotify = true;
        } else if (daysOverdue === 30) {
          type = "invoice_overdue_30days";
          priority = "urgent";
          shouldNotify = true;
        }

        if (shouldNotify) {
          const customer = invoice.customers as { first_name?: string; last_name?: string; company_name?: string; email?: string } | null;
          const customerName = customer 
            ? (customer.first_name && customer.last_name 
                ? `${customer.first_name} ${customer.last_name}`.trim() 
                : customer.company_name || customer.email || "Onbekende klant")
            : "Onbekende klant";

          notifications.push({
            tenant_id: invoice.tenant_id,
            category: "invoices",
            type: type!,
            title: `Factuur ${daysOverdue} ${daysOverdue === 1 ? 'dag' : 'dagen'} te laat: ${invoice.invoice_number}`,
            message: `Factuur ${invoice.invoice_number} van €${invoice.total.toFixed(2)} voor ${customerName} is ${daysOverdue} ${daysOverdue === 1 ? 'dag' : 'dagen'} over de vervaldatum`,
            priority: priority!,
            action_url: `/admin/invoices?invoice=${invoice.id}`,
            data: {
              invoice_id: invoice.id,
              invoice_number: invoice.invoice_number,
              customer_name: customerName,
              total: invoice.total,
              due_date: invoice.due_date,
              days_overdue: daysOverdue
            }
          });
        }
      }
    }

    // =============================================
    // 2. EXPIRING SUBSCRIPTIONS (7 days before)
    // =============================================
    
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const expiringDate = sevenDaysFromNow.toISOString().split('T')[0];

    const { data: expiringSubscriptions, error: subError } = await supabase
      .from("subscriptions")
      .select(`
        id, tenant_id, name, total, interval, end_date, customer_id,
        customers (first_name, last_name, company_name, email)
      `)
      .eq("status", "active")
      .eq("auto_renew", false)
      .not("end_date", "is", null)
      .eq("end_date", expiringDate);

    if (subError) {
      console.error("Error fetching expiring subscriptions:", subError);
    } else if (expiringSubscriptions) {
      for (const sub of expiringSubscriptions) {
        const customer = sub.customers as { first_name?: string; last_name?: string; company_name?: string; email?: string } | null;
        const customerName = customer 
          ? (customer.first_name && customer.last_name 
              ? `${customer.first_name} ${customer.last_name}`.trim() 
              : customer.company_name || customer.email || "Onbekende klant")
          : "Onbekende klant";

        notifications.push({
          tenant_id: sub.tenant_id,
          category: "subscriptions",
          type: "subscription_expiring",
          title: `Abonnement verloopt binnenkort: ${sub.name}`,
          message: `Abonnement "${sub.name}" van ${customerName} verloopt over 7 dagen (${new Date(sub.end_date).toLocaleDateString('nl-NL')})`,
          priority: "medium",
          action_url: `/admin/subscriptions`,
          data: {
            subscription_id: sub.id,
            subscription_name: sub.name,
            customer_name: customerName,
            total: sub.total,
            end_date: sub.end_date
          }
        });
      }
    }

    // =============================================
    // 3. EXPIRING QUOTES (1 day before)
    // =============================================
    
    const tomorrowDate = new Date(now);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const expiringQuoteDate = tomorrowDate.toISOString().split('T')[0];

    const { data: expiringQuotes, error: quoteError } = await supabase
      .from("quotes")
      .select(`
        id, tenant_id, quote_number, total, valid_until, customer_id,
        customers (first_name, last_name, company_name, email)
      `)
      .in("status", ["draft", "sent"])
      .not("valid_until", "is", null)
      .eq("valid_until", expiringQuoteDate);

    if (quoteError) {
      console.error("Error fetching expiring quotes:", quoteError);
    } else if (expiringQuotes) {
      for (const quote of expiringQuotes) {
        const customer = quote.customers as { first_name?: string; last_name?: string; company_name?: string; email?: string } | null;
        const customerName = customer 
          ? (customer.first_name && customer.last_name 
              ? `${customer.first_name} ${customer.last_name}`.trim() 
              : customer.company_name || customer.email || "Onbekende klant")
          : "Onbekende klant";

        notifications.push({
          tenant_id: quote.tenant_id,
          category: "quotes",
          type: "quote_expiring_soon",
          title: `Offerte verloopt morgen: ${quote.quote_number}`,
          message: `Offerte ${quote.quote_number} voor ${customerName} (€${quote.total.toFixed(2)}) verloopt morgen`,
          priority: "medium",
          action_url: `/admin/quotes/${quote.id}`,
          data: {
            quote_id: quote.id,
            quote_number: quote.quote_number,
            customer_name: customerName,
            total: quote.total,
            valid_until: quote.valid_until
          }
        });
      }
    }

    // =============================================
    // 4. LOW AI CREDITS WARNING
    // =============================================
    
    const { data: lowCredits, error: creditsError } = await supabase
      .from("tenant_ai_credits")
      .select("tenant_id, credits_total, credits_used, credits_purchased")
      .gt("credits_total", 0); // Only check tenants that have credits

    if (creditsError) {
      console.error("Error fetching AI credits:", creditsError);
    } else if (lowCredits) {
      for (const credit of lowCredits) {
        const available = credit.credits_total + credit.credits_purchased - credit.credits_used;
        const threshold = Math.max(5, Math.floor(credit.credits_total * 0.1)); // 10% or 5, whichever is higher
        
        if (available > 0 && available <= threshold) {
          notifications.push({
            tenant_id: credit.tenant_id,
            category: "system",
            type: "ai_credits_low",
            title: "AI-credits bijna op",
            message: `Je hebt nog ${available} AI-credits over. Koop extra credits om AI-functies te blijven gebruiken.`,
            priority: "medium",
            action_url: "/admin/settings?tab=billing",
            data: {
              credits_remaining: available,
              credits_total: credit.credits_total
            }
          });
        }
      }
    }

    // =============================================
    // INSERT ALL NOTIFICATIONS
    // =============================================
    
    console.log(`Found ${notifications.length} scheduled notifications to send`);

    if (notifications.length > 0) {
      // Check for duplicate notifications (same type + tenant in last 24 hours)
      const uniqueNotifications: NotificationToSend[] = [];
      
      for (const notif of notifications) {
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("tenant_id", notif.tenant_id)
          .eq("type", notif.type)
          .eq("data->>invoice_id", notif.data.invoice_id || null)
          .eq("data->>subscription_id", notif.data.subscription_id || null)
          .eq("data->>quote_id", notif.data.quote_id || null)
          .gte("created_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
          .limit(1);

        if (!existing || existing.length === 0) {
          uniqueNotifications.push(notif);
        }
      }

      console.log(`Sending ${uniqueNotifications.length} unique notifications (filtered ${notifications.length - uniqueNotifications.length} duplicates)`);

      if (uniqueNotifications.length > 0) {
        const { error: insertError } = await supabase
          .from("notifications")
          .insert(uniqueNotifications.map(n => ({
            tenant_id: n.tenant_id,
            category: n.category,
            type: n.type,
            title: n.title,
            message: n.message,
            priority: n.priority,
            action_url: n.action_url,
            data: n.data
          })));

        if (insertError) {
          console.error("Error inserting notifications:", insertError);
          throw insertError;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        notifications_checked: notifications.length,
        message: `Scheduled notification check completed`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in scheduled notification check:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
