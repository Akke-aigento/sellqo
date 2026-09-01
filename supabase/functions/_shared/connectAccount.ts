// TENANT-ACTION-1: single source of truth for minting a Stripe Connect Express
// account for a tenant. Extracted verbatim from create-connect-account so that
// both that function and the public resolve-tenant-action resolver mint accounts
// with identical capabilities, business_type, metadata and error messages.
//
// Behaviour is intentionally unchanged: error strings are the exact strings
// create-connect-account returned before the extraction.

import { getStripeForTenant } from "./stripe.ts";
import type Stripe from "https://esm.sh/stripe@18.5.0";

export interface ConnectTenantRow {
  id: string;
  name: string;
  owner_email: string | null;
  stripe_account_id: string | null;
  country: string | null;
}

export interface EnsureConnectAccountResult {
  stripe: Stripe;
  keyMode: "live" | "test";
  tenant: ConnectTenantRow;
  accountId: string;
  /** true when a new Stripe account was created during this call */
  created: boolean;
}

type Logger = (step: string, details?: unknown) => void;

/**
 * Loads the tenant, resolves the correct Stripe client (test key for demo
 * tenants) and guarantees the tenant has a Stripe Connect Express account.
 *
 * Creates the account (and persists stripe_account_id on the tenant) only when
 * the tenant has none yet. Throws with the original, user-facing Dutch error
 * messages on the known Connect misconfiguration cases.
 */
export async function ensureConnectAccount(
  // deno-lint-ignore no-explicit-any
  supabaseClient: any,
  tenantId: string,
  log: Logger = () => {},
): Promise<EnsureConnectAccountResult> {
  const { data: tenantData, error: tenantError } = await supabaseClient
    .from("tenants")
    .select("id, name, owner_email, stripe_account_id, country")
    .eq("id", tenantId)
    .single();

  if (tenantError || !tenantData) {
    throw new Error("Tenant not found or access denied");
  }
  log("Tenant found", { tenantName: tenantData.name });

  const { stripe, keyMode } = await getStripeForTenant(supabaseClient, tenantId);
  log("Stripe client initialised", { keyMode });

  const tenant = tenantData as ConnectTenantRow;

  if (tenant.stripe_account_id) {
    return { stripe, keyMode, tenant, accountId: tenant.stripe_account_id, created: false };
  }

  // Create new Stripe Express account
  const country = tenant.country || "NL";
  log("Creating new Stripe Express account", { country });

  // Build capabilities based on country
  // deno-lint-ignore no-explicit-any
  const capabilities: any = {
    card_payments: { requested: true },
    transfers: { requested: true },
  };

  // Add country-specific payment methods
  if (country === "NL") {
    capabilities.ideal_payments = { requested: true };
  }
  if (country === "BE") {
    capabilities.bancontact_payments = { requested: true };
  }
  // SEPA Direct Debit for all EU countries
  capabilities.sepa_debit_payments = { requested: true };

  let account;
  try {
    account = await stripe.accounts.create({
      type: "express",
      country: country,
      email: tenant.owner_email ?? undefined,
      capabilities,
      business_type: "individual",
      metadata: {
        tenant_id: tenantId,
        tenant_name: tenant.name,
      },
    });
    log("Stripe account created", { accountId: account.id });
    // deno-lint-ignore no-explicit-any
  } catch (stripeError: any) {
    log("Stripe account creation failed", { error: stripeError.message });
    // Provide helpful error messages for common Connect issues
    if (stripeError.message?.includes("signed up for Connect")) {
      throw new Error("Stripe Connect is niet geactiveerd. Ga naar je Stripe Dashboard > Settings > Connect om dit te activeren.");
    }
    if (stripeError.message?.includes("responsibilities") || stripeError.message?.includes("platform-profile") || stripeError.message?.includes("managing losses")) {
      throw new Error("Stripe Connect platform-profiel is nog niet afgerond. Ga naar Stripe Dashboard > Settings > Connect > Platform profile en bevestig de verantwoordelijkheden. Probeer daarna opnieuw.");
    }
    throw new Error(`Stripe fout: ${stripeError.message}`);
  }

  // Update tenant with Stripe account ID
  const { error: updateError } = await supabaseClient
    .from("tenants")
    .update({
      stripe_account_id: account.id,
      stripe_onboarding_complete: false,
      stripe_charges_enabled: false,
      stripe_payouts_enabled: false,
    })
    .eq("id", tenantId);

  if (updateError) {
    log("Error updating tenant", { error: updateError.message });
    throw new Error(`Failed to update tenant: ${updateError.message}`);
  }
  log("Tenant updated with Stripe account ID");

  return {
    stripe,
    keyMode,
    tenant: { ...tenant, stripe_account_id: account.id },
    accountId: account.id,
    created: true,
  };
}
