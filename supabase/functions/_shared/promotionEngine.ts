// PROMO-ENGINE-1 (13-10-2026) — één promotiemotor voor mandje, checkout én betaling.
//
// Vroeger rekende de webshop-API korting op drie plaatsen uit (computeCartTotals,
// buildCartResponse, checkout_apply/remove_discount), en betaalde de klant een vierde
// waarde: storefront_carts.discount_amount. Daardoor verscheen een staffelkorting wel in
// het mandje maar niet in de betaling, en telde een in het mandje toegepaste code pas
// mee als de checkout ze opnieuw toepaste. Een tweede motor (calculate_promotions) kende
// 1+1, bundels, automatische kortingen en klantgroepen, maar niemand riep hem aan.
//
// Deze module is nu de enige bron. evaluatePromotions() is puur (geen databank) en dus
// testbaar; loadPromotionContext() haalt de gegevens op.
//
// Volgorde en afronding zijn bewust gelijk aan de oude computeCartTotals: eerst
// staffelkortingen, dan de nieuwe soorten, dan kortingscodes; elk bedrag afgerond op
// 2 decimalen, en de totale korting nooit hoger dan het subtotaal. Zonder actieve
// 1+1/bundel/automatische/klantgroep-acties en zonder stapelregel is de uitkomst
// identiek aan vroeger (zie promotionEngine.test.ts).
//
// Bewust NIET in deze batch: cadeau-acties (gift_promotions) — die vragen een gratis
// orderregel, en geen winkel gebruikt ze. Puntenkorting komt in een volgende batch.

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function isPromotionActive(isActive: boolean, validFrom: string | null, validUntil: string | null, now: Date = new Date()): boolean {
  if (!isActive) return false;
  if (validFrom && now < new Date(validFrom)) return false;
  if (validUntil && now > new Date(validUntil)) return false;
  return true;
}

export function checkSchedule(schedule: { days?: number[]; start_time?: string; end_time?: string } | null, now: Date = new Date()): boolean {
  if (!schedule) return true;
  const currentDay = now.getDay();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  if (schedule.days?.length && !schedule.days.includes(currentDay)) return false;
  if (schedule.start_time && currentTime < schedule.start_time) return false;
  if (schedule.end_time && currentTime > schedule.end_time) return false;
  return true;
}

export function calculateDiscountValue(originalAmount: number, discountType: string, discountValue: number, maxDiscountAmount?: number | null): number {
  let discount = discountType === 'percentage' ? originalAmount * (discountValue / 100) : discountValue;
  if (maxDiscountAmount && discount > maxDiscountAmount) discount = maxDiscountAmount;
  return Math.min(discount, originalAmount);
}

// Rijen uit de databank: de vorm verschilt per tabel en komt ongetypeerd uit supabase-js.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbRow = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any;

export interface PromoItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  /** Categorieën van het product: product_categories ∪ products.category_id. */
  category_ids: string[];
}

/** Uitkomst van validateDiscountCode() in storefront-api (alleen de velden die we lezen). */
export interface ValidatedCode {
  valid: boolean;
  code?: string;
  discount_type?: string;
  discount_value?: number;
  applies_to?: string;
  product_ids?: string[] | null;
  category_ids?: string[] | null;
  description?: string | null;
  max_discount_amount?: number | null;
}

export interface PromotionData {
  volume: DbRow[];
  bogo: DbRow[];
  bundles: DbRow[];
  automatic: DbRow[];
  stacking: DbRow[];
  /** Klantgroepen waar de klant lid van is (actief lidmaatschap). */
  groups: DbRow[];
}

export interface AppliedDiscount {
  code: string | null;
  description: string;
  amount: number;
  type?: string;
}

export interface PromotionResult {
  discount_total: number;
  applied_discounts: AppliedDiscount[];
  free_shipping: boolean;
  /** Eerste geldige code, canoniek gespeld. */
  canonical_code: string | null;
}

export interface EvaluateInput {
  items: PromoItem[];
  subtotal: number;
  data: PromotionData;
  /** Codes in volgorde van de cart, met hun validatie-uitkomst. */
  codes: { raw: string; result: ValidatedCode }[];
  /** true/false als het e-mailadres bekend is, null als het niet bekend is. */
  isFirstOrder: boolean | null;
  now?: Date;
}

interface Entry extends AppliedDiscount { kind: string }

function itemsFor(items: PromoItem[], productIds?: string[] | null, categoryIds?: string[] | null): PromoItem[] {
  const pids = productIds || [];
  const cids = categoryIds || [];
  return items.filter((i) => pids.includes(i.product_id) || i.category_ids.some((c) => cids.includes(c)));
}

const sumLines = (items: PromoItem[]) => round2(items.reduce((s, i) => s + Number(i.line_total || 0), 0));
const sumQty = (items: PromoItem[]) => items.reduce((s, i) => s + Number(i.quantity || 0), 0);

export function evaluatePromotions(input: EvaluateInput): PromotionResult {
  const { items, data, codes } = input;
  const now = input.now ?? new Date();
  const subtotal = round2(input.subtotal);
  const entries: Entry[] = [];
  let freeShipping = false;
  let canonicalCode: string | null = null;

  const push = (kind: string, e: AppliedDiscount) => entries.push({ ...e, kind });

  if (items.length > 0) {
    // 1. Staffelkorting (identiek aan VOLUME-CART-1).
    for (const vd of data.volume) {
      if (!isPromotionActive(true, vd.valid_from, vd.valid_until, now)) continue;
      let eligible: PromoItem[] = [];
      if (vd.applies_to === 'all') eligible = items;
      else if (vd.applies_to === 'specific_products' || vd.applies_to === 'product') eligible = itemsFor(items, vd.product_ids, null);
      else if (vd.applies_to === 'specific_categories' || vd.applies_to === 'category') eligible = itemsFor(items, null, vd.category_ids);
      if (eligible.length === 0) continue;
      const qty = sumQty(eligible);
      const tier = (vd.volume_discount_tiers || [])
        .filter((t: DbRow) => qty >= t.min_quantity && (!t.max_quantity || qty <= t.max_quantity))
        .sort((a: DbRow, b: DbRow) => b.min_quantity - a.min_quantity)[0];
      if (!tier) continue;
      const base = sumLines(eligible);
      if (base <= 0) continue;
      const amt = round2(calculateDiscountValue(base, tier.discount_type, Number(tier.discount_value)));
      if (amt <= 0) continue;
      push('volume', { code: null, description: vd.name || 'Staffelkorting', amount: amt, type: 'volume' });
    }

    // 2. X kopen, Y gratis/korting.
    for (const promo of data.bogo) {
      if (!isPromotionActive(true, promo.valid_from, promo.valid_until, now)) continue;
      const hasBuyFilter = (promo.buy_product_ids?.length || 0) + (promo.buy_category_ids?.length || 0) > 0;
      const buyItems = hasBuyFilter ? itemsFor(items, promo.buy_product_ids, promo.buy_category_ids)
        : (promo.promotion_type === 'buy_x_get_y_same' ? items : []);
      const buyQty = sumQty(buyItems);
      if (!promo.buy_quantity || buyQty < promo.buy_quantity) continue;
      let times = Math.floor(buyQty / promo.buy_quantity);
      if (promo.max_uses_per_order) times = Math.min(times, promo.max_uses_per_order);
      const getItems = promo.promotion_type === 'buy_x_get_y_same' ? buyItems
        : itemsFor(items, promo.get_product_ids, promo.get_category_ids);
      let remaining = times * Number(promo.get_quantity || 0);
      let total = 0;
      for (const item of [...getItems].sort((a, b) => a.unit_price - b.unit_price)) {
        if (remaining <= 0) break;
        const qty = Math.min(item.quantity, remaining);
        remaining -= qty;
        const lineValue = item.unit_price * qty;
        total += promo.discount_type === 'free' || Number(promo.discount_value) === 100
          ? lineValue
          : calculateDiscountValue(lineValue, promo.discount_type, Number(promo.discount_value));
      }
      const amt = round2(total);
      if (amt > 0) push('bogo', { code: null, description: promo.name, amount: amt, type: 'bogo' });
    }

    // 3. Combinatiekorting (product_bundles; niet te verwarren met bundelproducten).
    for (const bundle of data.bundles) {
      if (!isPromotionActive(true, bundle.valid_from, bundle.valid_until, now)) continue;
      if (bundle.bundle_type !== 'fixed' || !bundle.bundle_products?.length) continue;
      const required = bundle.bundle_products.filter((bp: DbRow) => bp.is_required);
      if (required.length === 0) continue;
      let sets = Infinity;
      let setPrice = 0;
      for (const bp of required) {
        const lines = items.filter((i) => i.product_id === bp.product_id);
        const qty = sumQty(lines);
        const need = Math.max(1, Number(bp.quantity || 1));
        if (qty < need) { sets = 0; break; }
        sets = Math.min(sets, Math.floor(qty / need));
        const unit = Number(bp.products?.price ?? lines[0]?.unit_price ?? 0);
        setPrice += unit * need;
      }
      if (!sets || sets === Infinity || setPrice <= 0) continue;
      const v = Number(bundle.discount_value || 0);
      let perSet = bundle.discount_type === 'fixed_price' ? setPrice - v
        : bundle.discount_type === 'percentage' ? setPrice * (v / 100) : v;
      perSet = Math.min(Math.max(perSet, 0), setPrice);
      const amt = round2(perSet * sets);
      if (amt > 0) push('bundle', { code: null, description: bundle.name, amount: amt, type: 'bundle' });
    }

    // 4. Automatische korting.
    const totalQty = sumQty(items);
    const productIds = items.map((i) => i.product_id);
    for (const ad of data.automatic) {
      if (!isPromotionActive(true, ad.valid_from, ad.valid_until, now)) continue;
      if (!checkSchedule(ad.schedule, now)) continue;
      let triggered = false;
      switch (ad.trigger_type) {
        case 'cart_total': triggered = ad.trigger_value ? subtotal >= Number(ad.trigger_value) : false; break;
        case 'item_count': triggered = ad.trigger_value ? totalQty >= Number(ad.trigger_value) : false; break;
        case 'specific_products': triggered = (ad.trigger_product_ids || []).some((id: string) => productIds.includes(id)); break;
        case 'schedule': triggered = true; break;
        // Eerste bestelling: alleen als het e-mailadres bekend is én er nog geen betaalde
        // bestelling is. Onbekend = geen korting (PROMO-FIX-1 faalt dicht).
        case 'first_order': triggered = input.isFirstOrder === true; break;
        default: triggered = false;
      }
      if (!triggered) continue;
      if (ad.discount_type === 'free_shipping') {
        freeShipping = true;
        push('automatic', { code: null, description: ad.name || 'Gratis verzending', amount: 0, type: 'automatic' });
        continue;
      }
      if (ad.discount_type === 'free_product') continue; // cadeau-regel: nog niet ondersteund
      const base = ad.applies_to === 'specific_products' && ad.product_ids?.length
        ? sumLines(itemsFor(items, ad.product_ids, null)) : subtotal;
      if (base <= 0) continue;
      const amt = round2(calculateDiscountValue(base, ad.discount_type, Number(ad.discount_value || 0), ad.max_discount_amount));
      if (amt > 0) push('automatic', { code: null, description: ad.name, amount: amt, type: 'automatic' });
    }

    // 5. Klantgroep (de groep met de laagste prioriteit wint, zoals in calculate_promotions).
    const group = [...data.groups].filter(Boolean).sort((a: DbRow, b: DbRow) => (a.priority ?? 0) - (b.priority ?? 0))[0];
    if (group?.is_active && group.discount_type && Number(group.discount_value) > 0
        && (!group.min_order_amount || subtotal >= Number(group.min_order_amount))) {
      const amt = round2(calculateDiscountValue(subtotal, group.discount_type, Number(group.discount_value)));
      if (amt > 0) push('customer_group', { code: null, description: group.name, amount: amt, type: 'customer_group' });
    }
  }

  // 6. Kortingscodes (identiek aan CART-DISCOUNT-TOTALS-1). Een code geeft geen
  // 'type'-veld mee, zodat de bestaande respons van eigen frontends gelijk blijft.
  for (const { raw, result: v } of codes) {
    if (!v.valid) continue;
    const code = v.code || String(raw ?? '').trim().toUpperCase();
    if (!canonicalCode) canonicalCode = code;
    if (v.discount_type === 'free_shipping') {
      freeShipping = true;
      push('discount_code', { code, description: 'Gratis verzending', amount: 0 });
      continue;
    }
    let base = subtotal;
    if (v.applies_to === 'specific_products') base = sumLines(itemsFor(items, v.product_ids, null));
    else if (v.applies_to === 'specific_categories' || v.applies_to === 'category') {
      base = (v.category_ids || []).length > 0 ? sumLines(itemsFor(items, null, v.category_ids)) : 0;
    }
    if (base <= 0) continue;
    const amt = round2(calculateDiscountValue(base, v.discount_type || 'percentage', Number(v.discount_value || 0), v.max_discount_amount));
    if (amt <= 0) continue;
    push('discount_code', {
      code,
      description: v.description || `${v.discount_value}${v.discount_type === 'percentage' ? '%' : '€'} korting`,
      amount: amt,
    });
  }

  // 7. Stapelregel — alleen als de winkel er een heeft ingesteld.
  let final = entries;
  const rule = data.stacking[0];
  if (rule?.rule_type === 'no_stacking') {
    const best = [...entries].sort((a, b) => b.amount - a.amount)[0];
    // Gratis verzending (bedrag 0) blijft altijd gelden naast de beste korting.
    final = entries.filter((e) => e === best || e.amount === 0);
  } else if (rule) {
    if (rule.priority_order?.length) {
      const idx = (k: string) => { const i = rule.priority_order.indexOf(k); return i === -1 ? 999 : i; };
      final = [...final].sort((a, b) => idx(a.kind) - idx(b.kind));
    }
    if (rule.max_stack_count) {
      let n = 0;
      final = final.filter((e) => e.amount === 0 || ++n <= rule.max_stack_count);
    }
    if (rule.max_total_discount_percent) {
      const cap = subtotal * (Number(rule.max_total_discount_percent) / 100);
      let running = 0;
      final = final.filter((e) => { if (running + e.amount <= cap + 1e-9) { running += e.amount; return true; } return false; });
    }
  }
  if (rule && !final.some((e) => e.amount === 0 && (e.kind === 'discount_code' || e.kind === 'automatic'))) {
    freeShipping = false;
  }

  const discountTotal = Math.min(round2(final.reduce((s, e) => s + e.amount, 0)), subtotal);
  return {
    discount_total: discountTotal,
    applied_discounts: final.map(({ kind: _k, ...rest }) => rest),
    free_shipping: freeShipping,
    canonical_code: canonicalCode,
  };
}

// ============== DATA LOADER ==============

type Validator = (code: string, subtotal: number, email: string | null) => Promise<ValidatedCode>;

export interface CartLine { product_id: string; quantity: number; unit_price: number; line_total: number }

/**
 * Laadt alle promotiegegevens voor een cart en evalueert ze. Elke lees-fout valt
 * terug op "geen actie van dat soort" — een promotie mag een bestelling nooit blokkeren.
 */
export async function computeCartPromotions(
  supabase: SupabaseLike,
  tenantId: string,
  cart: { discount_codes?: string[] | null; customer_email?: string | null },
  lines: CartLine[],
  validate: Validator,
): Promise<PromotionResult> {
  const subtotal = round2(lines.reduce((s, l) => s + Number(l.line_total || 0), 0));
  const email = cart.customer_email ? String(cart.customer_email).trim().toLowerCase() : null;
  const empty = { data: [] as DbRow[] };
  const safe = async (p: PromiseLike<{ data: DbRow[] | null }>): Promise<{ data: DbRow[] }> => { try { const r = await p; return r?.data ? { data: r.data } : empty; } catch { return empty; } };

  const hasItems = lines.length > 0;
  const [volume, bogo, bundles, automatic, stacking] = hasItems ? await Promise.all([
    safe(supabase.from('volume_discounts').select('*, volume_discount_tiers(*)').eq('tenant_id', tenantId).eq('is_active', true)),
    safe(supabase.from('bogo_promotions').select('*').eq('tenant_id', tenantId).eq('is_active', true)),
    safe(supabase.from('product_bundles').select('*, bundle_products(*, products(id, price))').eq('tenant_id', tenantId).eq('is_active', true)),
    safe(supabase.from('automatic_discounts').select('*').eq('tenant_id', tenantId).eq('is_active', true).order('priority', { ascending: true })),
    safe(supabase.from('discount_stacking_rules').select('*').eq('tenant_id', tenantId).eq('is_active', true)),
  ]) : [empty, empty, empty, empty, empty];

  // Categorieën alleen ophalen als een actie of code ze nodig heeft.
  const productIds = [...new Set(lines.map((l) => l.product_id).filter(Boolean))];
  const codes = (cart.discount_codes || []).filter(Boolean);
  const codeResults: { raw: string; result: ValidatedCode }[] = [];
  for (const raw of codes) {
    let result: ValidatedCode = { valid: false };
    try { result = await validate(raw, subtotal, email); } catch { result = { valid: false }; }
    codeResults.push({ raw, result });
  }
  const needsCategories = hasItems && (
    volume.data.some((v: DbRow) => (v.category_ids || []).length > 0)
    || bogo.data.some((b: DbRow) => (b.buy_category_ids || []).length + (b.get_category_ids || []).length > 0)
    || codeResults.some((c) => c.result.valid && (c.result.category_ids || []).length > 0)
  );
  const cats = new Map<string, Set<string>>();
  if (needsCategories && productIds.length > 0) {
    const [links, prods] = await Promise.all([
      safe(supabase.from('product_categories').select('product_id, category_id').in('product_id', productIds)),
      safe(supabase.from('products').select('id, category_id').in('id', productIds)),
    ]);
    for (const l of links.data) { if (!cats.has(l.product_id)) cats.set(l.product_id, new Set()); cats.get(l.product_id)!.add(l.category_id); }
    for (const p of prods.data) { if (p.category_id) { if (!cats.has(p.id)) cats.set(p.id, new Set()); cats.get(p.id)!.add(p.category_id); } }
  }

  // Eerste bestelling: alleen opzoeken als er een actieve 'first_order'-actie is.
  let isFirstOrder: boolean | null = null;
  if (automatic.data.some((a: DbRow) => a.trigger_type === 'first_order')) {
    if (email) {
      try {
        const { count, error } = await supabase.from('orders').select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).ilike('customer_email', email.replace(/[%_\\]/g, '\\$&')).eq('payment_status', 'paid');
        isFirstOrder = error ? false : !count;
      } catch { isFirstOrder = false; }
    } else {
      isFirstOrder = null;
    }
  }

  // Klantgroep via het e-mailadres van de klant (customers ↔ customer_group_members).
  let groups: DbRow[] = [];
  if (hasItems && email) {
    const { data: anyGroup } = await safe(supabase.from('customer_groups').select('id').eq('tenant_id', tenantId).eq('is_active', true).gt('discount_value', 0).limit(1));
    if (anyGroup.length > 0) {
      const { data: custs } = await safe(supabase.from('customers').select('id').eq('tenant_id', tenantId).ilike('email', email.replace(/[%_\\]/g, '\\$&')));
      const ids = custs.map((c: DbRow) => c.id);
      if (ids.length > 0) {
        const { data: members } = await safe(supabase.from('customer_group_members').select('expires_at, customer_groups(*)').in('customer_id', ids));
        const nowIso = new Date().toISOString();
        groups = members
          .filter((m: DbRow) => !m.expires_at || m.expires_at > nowIso)
          .map((m: DbRow) => m.customer_groups)
          .filter((g: DbRow) => g && g.tenant_id === tenantId);
      }
    }
  }

  const items: PromoItem[] = lines.map((l) => ({
    product_id: l.product_id,
    quantity: Number(l.quantity || 0),
    unit_price: Number(l.unit_price || 0),
    line_total: Number(l.line_total || 0),
    category_ids: [...(cats.get(l.product_id) || [])],
  }));

  return evaluatePromotions({
    items,
    subtotal,
    data: { volume: volume.data, bogo: bogo.data, bundles: bundles.data, automatic: automatic.data, stacking: stacking.data, groups },
    codes: codeResults,
    isFirstOrder,
  });
}
