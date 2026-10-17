// LIMITS-1 — fouten van enforce_plan_limit (databanktrigger) als nette tekst voor de winkel.
// De trigger gooit "PLAN_LIMIT_PRODUCTS: limiet van N bereikt" of "PLAN_LIMIT_USERS: …".

export type PlanLimitKind = "PRODUCTS" | "USERS";

export function planLimitKind(err: unknown): PlanLimitKind | null {
  const msg = String((err as { message?: unknown } | null)?.message ?? err ?? "");
  const m = msg.match(/PLAN_LIMIT_(PRODUCTS|USERS)/);
  return m ? (m[1] as PlanLimitKind) : null;
}

export const PLAN_LIMIT_MESSAGES: Record<PlanLimitKind, string> = {
  PRODUCTS: "Het maximum aantal producten van je plan is bereikt. Upgrade om meer producten toe te voegen.",
  USERS: "Je team zit op het maximum van je plan. Upgrade om iemand extra toe te voegen.",
};

/** Nette tekst bij een limietfout, anders de oorspronkelijke foutmelding. */
export function planLimitText(err: unknown): string {
  const k = planLimitKind(err);
  if (k) return PLAN_LIMIT_MESSAGES[k];
  return String((err as { message?: unknown } | null)?.message ?? err ?? "");
}
