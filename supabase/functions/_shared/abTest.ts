/**
 * MAIL-2d — pure logica van de A/B-test van de onderwerpregel. Geen databank, geen netwerk:
 * gebruikt door campaignQueue.ts (verdelen bij het versturen, winnaar na de wachttijd) en getest in
 * abTest.test.ts. De databank (enqueue_campaign_sends, campaign_ab_release) controleert dezelfde
 * regels nog eens.
 */

export const AB_MIN_PER_VARIANT = 100;
export const AB_DEFAULT_PERCENT = 20;
export const AB_DEFAULT_WAIT_HOURS = 4;

export type AbVariant = "A" | "B";
export type AbReason = "off" | "automation" | "multi_language" | "too_small";

export interface AbPlan {
  /** Doet deze campagne een test? */
  enabled: boolean;
  /** Waarom niet (enkel als `enabled` false is en er wel een onderwerp B is, of "off"). */
  reason: AbReason | null;
  percent: number;
  waitHours: number;
  perVariant: number;
  testSize: number;
  remainder: number;
  /** Kleinste doelgroep waarbij een test kan met dit percentage. */
  minAudience: number;
}

export interface AbCampaign {
  kind?: string | null;
  subject_b?: string | null;
  ab_test_percent?: number | null;
  ab_wait_hours?: number | null;
  available_languages?: unknown;
}

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** Plan voor een doelgroep van `audience` adressen. */
export function planAbTest(campaign: AbCampaign, audience: number): AbPlan {
  const percent = clampInt(campaign.ab_test_percent, 10, 50, AB_DEFAULT_PERCENT);
  const waitHours = clampInt(campaign.ab_wait_hours, 1, 24, AB_DEFAULT_WAIT_HOURS);
  const minAudience = Math.ceil((2 * AB_MIN_PER_VARIANT * 100) / percent);
  const off = (reason: AbReason): AbPlan => ({
    enabled: false, reason, percent, waitHours, perVariant: 0, testSize: 0, remainder: Math.max(0, audience), minAudience,
  });
  if (!String(campaign.subject_b ?? "").trim()) return off("off");
  if (campaign.kind === "automation") return off("automation");
  const langs = Array.isArray(campaign.available_languages) ? campaign.available_languages : [];
  if (langs.length > 1) return off("multi_language");
  const perVariant = Math.floor((Math.max(0, audience) * percent) / 200);
  if (perVariant < AB_MIN_PER_VARIANT) return off("too_small");
  const testSize = perVariant * 2;
  return { enabled: true, reason: null, percent, waitHours, perVariant, testSize, remainder: audience - testSize, minAudience };
}

/** Fisher-Yates met een meegegeven random (testbaar). */
function shuffled<T>(list: T[], random: () => number): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Verdeelt de rijen willekeurig: `perVariant` krijgen A, `perVariant` krijgen B, de rest "hold".
 * De rijen moeten al ontdubbeld zijn (één per adres).
 */
export function assignVariants<T extends object>(
  rows: T[],
  plan: AbPlan,
  random: () => number = Math.random,
): Array<T & { variant: AbVariant | "hold" }> {
  if (!plan.enabled) throw new Error("A/B-plan staat niet aan");
  return shuffled(rows, random).map((r, i) => ({
    ...r,
    variant: i < plan.perVariant ? "A" : i < plan.perVariant * 2 ? "B" : "hold",
  }));
}

export interface AbVariantStats {
  sent: number;
  opened: number;
  clicked: number;
}

/** a/b vs c/d zonder afrondingsfouten; 0 verzonden = ratio 0. */
function compareRates(numA: number, denA: number, numB: number, denB: number): number {
  const [na, da] = denA > 0 ? [numA, denA] : [0, 1];
  const [nb, db] = denB > 0 ? [numB, denB] : [0, 1];
  return na * db - nb * da;
}

/** Winnaar: hoogste klikratio, bij gelijkstand hoogste openratio, anders A. */
export function pickAbWinner(a: AbVariantStats, b: AbVariantStats): AbVariant {
  const clicks = compareRates(a.clicked, a.sent, b.clicked, b.sent);
  if (clicks !== 0) return clicks > 0 ? "A" : "B";
  const opens = compareRates(a.opened, a.sent, b.opened, b.sent);
  if (opens !== 0) return opens > 0 ? "A" : "B";
  return "A";
}

/** Is de wachttijd voorbij? */
export function abDecisionDue(startedAt: string | null | undefined, waitHours: number | null | undefined, now: Date): boolean {
  if (!startedAt) return false;
  const start = new Date(startedAt).getTime();
  if (!Number.isFinite(start)) return false;
  return now.getTime() >= start + clampInt(waitHours, 1, 24, AB_DEFAULT_WAIT_HOURS) * 3_600_000;
}

/** Onderwerp voor één verzendrij: B voor de B-groep, en voor de rest als B won. */
export function subjectForRow(
  campaign: { subject?: string | null; subject_b?: string | null; ab_winner?: string | null; ab_started_at?: string | null },
  variant: string | null | undefined,
): string {
  const a = campaign.subject || "";
  const b = String(campaign.subject_b ?? "").trim();
  if (!b || !campaign.ab_started_at) return a;
  if (variant === "B") return b;
  if (variant === "A") return a;
  return campaign.ab_winner === "B" ? b : a;
}
