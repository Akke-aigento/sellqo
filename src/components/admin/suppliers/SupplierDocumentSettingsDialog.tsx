// INKOOP-6 — instellingen van de facturen-inbox, op één plek bij de documenten:
// facturenadres, afzenders controleren, doorsturen naar Odoo, meldingen en de bronnen.
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Bell, Copy, ExternalLink, ShieldCheck, ShieldX, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTenantOdooSettings } from "@/hooks/useTenantOdooSettings";
import { useOdooConnection } from "@/hooks/useOdooConnection";
import { useMarketplaceConnections } from "@/hooks/useMarketplaceConnections";
import { useCanManageInbox, useInboxSources, useSupplierInbox } from "@/hooks/useSupplierInbox";

export function SupplierDocumentSettingsDialog({
  open,
  onOpenChange,
  tenantId,
  inboxAddress,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string | undefined;
  inboxAddress: string | null;
}) {
  const { t } = useTranslation();
  const canManage = useCanManageInbox(tenantId);
  const { settings: odooSettings, upsert } = useTenantOdooSettings(tenantId);
  const { status } = useOdooConnection(tenantId);
  const { connections } = useMarketplaceConnections();
  const { settings, saveSettings, senders, removeSender } = useSupplierInbox(tenantId);
  const sources = useInboxSources(tenantId, open);
  const odooConfigured = !!status.data?.configured;
  const bolActive = (connections ?? []).some((c) => c.marketplace_type === "bol_com" && c.is_active);
  const requireApproval = settings.data?.require_sender_approval ?? true;

  const copy = async () => {
    if (!inboxAddress) return;
    try {
      await navigator.clipboard.writeText(inboxAddress);
      toast.success(t("admin.supplierDocuments.inbox_copied"));
    } catch {
      toast.error(inboxAddress);
    }
  };

  const sourceNote = (source: string) => {
    if (source === "email") return inboxAddress ? t("admin.supplierDocuments.settings_src_email_on") : t("admin.supplierDocuments.settings_no_inbox");
    if (source === "bol") return bolActive ? t("admin.supplierDocuments.settings_bol_on") : t("admin.supplierDocuments.settings_bol_off");
    if (source === "upload") return t("admin.supplierDocuments.settings_src_upload");
    return t("admin.supplierDocuments.settings_src_archive");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("admin.supplierDocuments.settings_title")}</DialogTitle>
          <DialogDescription>{t("admin.supplierDocuments.settings_desc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Facturenadres */}
          <section className="space-y-1">
            <p className="text-sm font-medium">{t("admin.supplierDocuments.inbox_title")}</p>
            {inboxAddress ? (
              <div className="flex items-center gap-2">
                <code className="text-sm break-all flex-1">{inboxAddress}</code>
                <Button variant="outline" size="sm" onClick={copy}>
                  <Copy className="h-4 w-4 mr-2" />
                  {t("admin.supplierDocuments.inbox_copy")}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("admin.supplierDocuments.settings_no_inbox")}</p>
            )}
          </section>

          {/* Afzenders controleren */}
          <section className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="require-approval">{t("admin.supplierDocuments.settings_approval")}</Label>
                <p className="text-xs text-muted-foreground">{t("admin.supplierDocuments.settings_approval_desc")}</p>
              </div>
              <Switch
                id="require-approval"
                checked={requireApproval}
                disabled={!canManage || saveSettings.isPending || settings.isLoading}
                onCheckedChange={(v) => saveSettings.mutate({ require_sender_approval: v })}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{t("admin.supplierDocuments.settings_senders")}</p>
              {(senders.data ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("admin.supplierDocuments.settings_senders_empty")}</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {(senders.data ?? []).map((s) => (
                    <li key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      {s.status === "approved"
                        ? <ShieldCheck className="h-4 w-4 text-green-600 shrink-0" />
                        : <ShieldX className="h-4 w-4 text-destructive shrink-0" />}
                      <span className="break-all flex-1">{s.email}</span>
                      <Badge variant={s.status === "approved" ? "outline" : "destructive"}>
                        {t(`admin.supplierDocuments.sender_${s.status}`)}
                      </Badge>
                      {canManage && (
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          aria-label={t("admin.supplierDocuments.sender_remove")}
                          title={t("admin.supplierDocuments.sender_remove")}
                          disabled={removeSender.isPending}
                          onClick={() => removeSender.mutate(s.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <Separator />

          {/* Odoo */}
          <section className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="push-odoo">{t("admin.supplierDocuments.settings_push")}</Label>
              <p className="text-xs text-muted-foreground">
                {odooConfigured
                  ? t("admin.supplierDocuments.settings_push_desc")
                  : t("admin.supplierDocuments.settings_push_no_odoo")}
              </p>
            </div>
            <Switch
              id="push-odoo"
              checked={!!odooSettings?.push_supplier_documents}
              disabled={!canManage || !odooConfigured || upsert.isPending}
              onCheckedChange={(v) => upsert.mutate({ push_supplier_documents: v })}
            />
          </section>

          {/* Meldingen: één plek voor alle meldingsvoorkeuren */}
          <section className="space-y-1">
            <p className="text-sm font-medium">{t("admin.supplierDocuments.settings_notify")}</p>
            <p className="text-xs text-muted-foreground">{t("admin.supplierDocuments.settings_notify_desc")}</p>
            <Button variant="link" className="px-0 h-auto" asChild>
              <Link to="/admin/settings?section=shop-notifications" onClick={() => onOpenChange(false)}>
                <Bell className="h-4 w-4 mr-2" />
                {t("admin.supplierDocuments.settings_notify_link")}
              </Link>
            </Button>
          </section>

          <Separator />

          {/* Bronnen */}
          <section className="space-y-2">
            <p className="text-sm font-medium">{t("admin.supplierDocuments.settings_sources")}</p>
            <ul className="divide-y rounded-md border">
              {(sources.data ?? []).map((s) => (
                <li key={s.source} className="px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{t(`admin.supplierDocuments.source.${s.source}`)}</span>
                    <span className="text-xs text-muted-foreground">
                      {s.count} · {s.last
                        ? t("admin.supplierDocuments.settings_src_last", { date: format(new Date(s.last), "d MMM yyyy HH:mm", { locale: nl }) })
                        : t("admin.supplierDocuments.settings_src_never")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{sourceNote(s.source)}</p>
                </li>
              ))}
              {sources.isLoading && <li className="px-3 py-2 text-xs text-muted-foreground">…</li>}
            </ul>
          </section>

          <Button variant="link" className="px-0" asChild>
            <Link to="/admin/marketplaces?tab=accounting" onClick={() => onOpenChange(false)}>
              <ExternalLink className="h-4 w-4 mr-2" />
              {t("admin.supplierDocuments.settings_more")}
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
