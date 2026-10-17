// PLANS-2 — prijzen in teksten komen uit de database, nooit uit de vertaalbestanden.
// buildPriceVars maakt van pricing_plans + platform_addons de variabelen die elke tekst
// kan gebruiken ({{starter_price}}, {{flex_fee}}, …). PriceVarsSync zet ze als globale
// i18next-variabelen, zodat FAQ, sectorpagina's en de prijzenpagina altijd de echte
// bedragen tonen. Een prijs wijzigen = één rij in de database aanpassen.
import { eur } from '@/lib/planLines';

/** Opstartpakket horeca: een dienst van Studio Akke, geen SellQo-plan. */
export const SETUP_PRICE = 149;

interface PlanLike { id: string; monthly_price: number | string; yearly_price?: number | string; ticket_fee?: number | string | null; min_term_months?: number | null; limit_products?: number | null; limit_orders?: number | null; overage_fee_percent?: number | string | null }
interface AddonLike { id: string; monthly_price: number | string; ticket_fee?: number | string | null }

export const PRICE_VAR_NAMES = [
  'starter_price', 'pro_price', 'enterprise_price', 'horeca_price', 'horeca_big_price',
  'flex_fee', 'vast_price', 'vast_fee', 'vast_term', 'addon_webshop_price', 'addon_horeca_price', 'setup_price',
  // LIMITS-1: wat Free inbevat en wat je daarboven betaalt.
  'free_products', 'free_orders', 'free_overage_pct',
] as const;
export type PriceVars = Record<(typeof PRICE_VAR_NAMES)[number], string>;

export function buildPriceVars(plans: PlanLike[], addons: AddonLike[], lng: string): Partial<PriceVars> {
  const plan = (id: string) => plans.find((p) => p.id === id);
  const addon = (id: string) => addons.find((a) => a.id === id);
  const money = (n: unknown) => (n == null || n === '' ? undefined : eur(Number(n), lng));
  const out: Partial<PriceVars> = {
    starter_price: money(plan('starter')?.monthly_price),
    pro_price: money(plan('pro')?.monthly_price),
    enterprise_price: money(plan('enterprise')?.monthly_price),
    horeca_price: money(plan('horeca')?.monthly_price),
    horeca_big_price: money(plan('horeca_big')?.monthly_price),
    flex_fee: money(plan('events_flex')?.ticket_fee),
    vast_price: money(plan('events_vast')?.monthly_price),
    vast_fee: money(plan('events_vast')?.ticket_fee),
    vast_term: plan('events_vast')?.min_term_months != null ? String(plan('events_vast')?.min_term_months) : undefined,
    addon_webshop_price: money(addon('addon_webshop')?.monthly_price),
    addon_horeca_price: money(addon('addon_horeca')?.monthly_price),
    setup_price: money(SETUP_PRICE),
    free_products: plan('free')?.limit_products != null ? String(plan('free')?.limit_products) : undefined,
    free_orders: plan('free')?.limit_orders != null ? String(plan('free')?.limit_orders) : undefined,
    free_overage_pct: plan('free')?.overage_fee_percent != null ? Number(plan('free')?.overage_fee_percent).toLocaleString(lng) : undefined,
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as Partial<PriceVars>;
}
