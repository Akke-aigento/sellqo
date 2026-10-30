// AI-AGENT-2 — extra tools voor de hulpassistent: cijfers (alleen lezen) en meer acties
// (altijd een voorstel dat de gebruiker bevestigt). Zie aiActions.ts voor de basis.
import { LIST_FILTERS, brusselsMidnightUtc, brusselsYmd } from "./aiInsights.ts";

/** Einde van een dag in Brussel (23:59:59 lokale tijd, zomer- en wintertijd). */
export function brusselsEndOfDayIso(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return new Date(brusselsMidnightUtc(next).getTime() - 1000).toISOString();
}

const date = { type: "string", description: "YYYY-MM-DD (Europe/Brussels)" };

export const AI_READ_TOOLS = [
  {
    type: "function",
    function: {
      name: "sales_summary",
      description: "Revenue (incl. VAT), number of sales, average ticket, split per channel and per day, for a date range. Same numbers as the dashboard. Use for questions like 'revenue last Saturday', 'how did October go', comparisons (call twice).",
      parameters: { type: "object", properties: { from: date, to: date }, required: ["from", "to"] },
    },
  },
  {
    type: "function",
    function: {
      name: "profit_estimate",
      description: "Estimated gross profit for a date range: sales excl. VAT minus current cost price × quantity, only for products that have a cost price. Always tell the user it is an estimate and mention the coverage and products without a cost price.",
      parameters: { type: "object", properties: { from: date, to: date }, required: ["from", "to"] },
    },
  },
  {
    type: "function",
    function: {
      name: "top_products",
      description: "Best (or worst, by reading the end of a longer list) selling products in a date range, by revenue or by quantity. Shows a table the user can download as CSV.",
      parameters: {
        type: "object",
        properties: { from: date, to: date, by: { type: "string", enum: ["revenue", "quantity"] }, limit: { type: "integer" } },
        required: ["from", "to"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_products",
      description: "List the shop's products with an optional filter (low stock, out of stock, no image, no cost price, inactive, no description) and optional name search. Shows a table the user can download as CSV. Use for 'make a list of …'.",
      parameters: {
        type: "object",
        properties: { filter: { type: "string", enum: [...LIST_FILTERS] }, query: { type: "string" }, limit: { type: "integer" } },
        required: ["filter"],
      },
    },
  },
] as const;

export const AI_EXTRA_ACTION_TOOLS = [
  {
    type: "function",
    function: {
      name: "propose_set_active",
      description: "Propose switching a product on (visible/for sale) or off. Nothing changes until the user confirms.",
      parameters: { type: "object", properties: { product_id: { type: "string" }, active: { type: "boolean" } }, required: ["product_id", "active"] },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_create_product",
      description: "Propose creating a new product. It is created as a draft (inactive) so the user can add photos and check it before it goes live. Write a short, appealing description in the shop's language if the user gave enough info. Nothing is created until the user confirms.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          price: { type: "number", description: "Selling price in euro incl. VAT" },
          description: { type: "string" },
          category_name: { type: "string", description: "Existing category name, optional" },
          is_food: { type: "boolean", description: "True for food or drink" },
        },
        required: ["name", "price"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_bulk_price",
      description: "Propose a price change for several products at once (max 50), selected by category name or name search. mode 'percent' (e.g. 10 = +10%, -20 = 20% off), 'amount' (e.g. 1 = +€1) or 'set' (exact price). The user sees every product with old and new price and confirms once.",
      parameters: {
        type: "object",
        properties: {
          category_name: { type: "string" },
          query: { type: "string" },
          mode: { type: "string", enum: ["percent", "amount", "set"] },
          value: { type: "number" },
        },
        required: ["mode", "value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_discount_code",
      description: "Propose a new discount code for the whole shop. Nothing is created until the user confirms.",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "Letters/digits, e.g. WELKOM10" },
          discount_type: { type: "string", enum: ["percentage", "fixed_amount", "free_shipping"] },
          value: { type: "number", description: "Percentage or euro amount (0 for free shipping)" },
          valid_until: { type: "string", description: "YYYY-MM-DD, optional" },
          minimum_order_amount: { type: "number" },
          usage_limit: { type: "integer" },
        },
        required: ["code", "discount_type", "value"],
      },
    },
  },
] as const;

/** Kortingscode valideren (puur). */
export function checkDiscount(args: Record<string, unknown>): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const code = typeof args.code === "string" ? args.code.trim().toUpperCase().replace(/\s+/g, "") : "";
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return { ok: false, error: "invalid_code" };
  const type = args.discount_type;
  if (type !== "percentage" && type !== "fixed_amount" && type !== "free_shipping") return { ok: false, error: "invalid_type" };
  const v = typeof args.value === "number" && Number.isFinite(args.value) ? Math.round(args.value * 100) / 100 : NaN;
  if (type === "percentage" && !(v > 0 && v <= 100)) return { ok: false, error: "invalid_value" };
  if (type === "fixed_amount" && !(v > 0 && v <= 10000)) return { ok: false, error: "invalid_value" };
  const until = typeof args.valid_until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.valid_until) ? args.valid_until : null;
  if (until && until < brusselsYmd(new Date())) return { ok: false, error: "date_in_past" };
  const min = typeof args.minimum_order_amount === "number" && args.minimum_order_amount > 0 ? Math.round(args.minimum_order_amount * 100) / 100 : null;
  const limit = Number.isInteger(args.usage_limit) && (args.usage_limit as number) > 0 ? args.usage_limit as number : null;
  return { ok: true, value: { code, discount_type: type, discount_value: type === "free_shipping" ? 0 : v, valid_until: until, minimum_order_amount: min, usage_limit: limit } };
}
