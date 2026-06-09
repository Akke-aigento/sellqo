import { Link, useSearchParams } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/hooks/useTenant";

/**
 * Human-readable label voor bekende admin-routes (H4a).
 * Onbekende paden vallen terug op de raw pathname.
 */
const ROUTE_LABELS: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/messages": "Inbox",
  "/admin/orders": "Bestellingen",
  "/admin/fulfillment": "Fulfillment",
  "/admin/returns": "Retouren",
  "/admin/orders/invoices": "Facturen",
  "/admin/orders/quotes": "Offertes",
  "/admin/orders/creditnotes": "Creditnota's",
  "/admin/products": "Producten",
  "/admin/customers": "Klanten",
  "/admin/categories": "Categorieën",
  "/admin/shipping": "Verzending",
  "/admin/payments": "Betalingen",
  "/admin/billing": "Abonnement",
  "/admin/settings": "Instellingen",
  "/admin/connect": "SellQo Connect",
  "/admin/marketing": "Marketing",
  "/admin/marketing/ai": "AI Tools",
  "/admin/marketing/seo": "SEO",
  "/admin/marketing/translations": "Vertalingen",
  "/admin/notifications": "Notificaties",
  "/admin/reports": "Rapporten",
  "/admin/analytics": "Analytics",
  "/admin/suppliers": "Leveranciers",
  "/admin/ads": "Ads",
  "/admin/promotions": "Promoties",
  "/admin/pos": "Kassa",
  "/admin/storefront": "Webshop",
};

function humanizePath(p: string): string {
  if (ROUTE_LABELS[p]) return ROUTE_LABELS[p];
  // Fallback: pak laatste segment, vervang scheidingstekens.
  const segs = p.split("/").filter(Boolean);
  const last = segs[segs.length - 1] ?? p;
  return last.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function NoAccess() {
  const [params] = useSearchParams();
  const from = params.get("from");
  const label = from ? humanizePath(from) : null;
  // Optionele mailto naar tenant-admin (owner_email).
  let mailtoHref: string | null = null;
  try {
    const { currentTenant } = useTenant();
    if (currentTenant?.owner_email) {
      const subject = encodeURIComponent(
        `Toegang aanvragen${label ? ` — ${label}` : ""}`
      );
      const body = encodeURIComponent(
        `Hoi,\n\nIk heb toegang nodig tot${label ? ` ${label}` : " een pagina"} in ${currentTenant.name}. Kun je mijn rechten aanpassen?\n\nBedankt!`
      );
      mailtoHref = `mailto:${currentTenant.owner_email}?subject=${subject}&body=${body}`;
    }
  } catch {
    // /no-access wordt ook buiten TenantProvider geserveerd — negeer.
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md text-center space-y-6">
        <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldAlert className="h-8 w-8 text-destructive" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {label ? `Geen toegang tot ${label}` : "Geen toegang"}
          </h1>
          <p className="text-muted-foreground">
            Je rol mist de juiste rechten voor deze pagina. Vraag je
            tenant-admin om je rechten aan te passen.
          </p>
        </div>
        <div className="flex gap-3 justify-center flex-wrap">
          <Button asChild variant="outline">
            <Link to="/admin">Naar dashboard</Link>
          </Button>
          {mailtoHref && (
            <Button asChild>
              <a href={mailtoHref}>Vraag toegang aan</a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
