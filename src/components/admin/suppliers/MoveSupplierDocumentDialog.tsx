import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useMoveTargets } from "@/hooks/useMoveTargets";
import type { SupplierDocument } from "@/types/supplier";

export function MoveSupplierDocumentDialog({
  document,
  onOpenChange,
}: {
  document: SupplierDocument | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const targets = useMoveTargets();
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const move = async () => {
    if (!document || !target) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("move-supplier-document", {
        body: { documentId: document.id, targetTenantId: target },
      });
      if (error) {
        const body = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.().catch(() => null);
        throw new Error(body?.error || error.message);
      }
      if (data?.success === false) throw new Error(data.error);
      toast.success(t("admin.supplierDocuments.move_done", { shop: targets.find((x) => x.id === target)?.name ?? "" }));
      queryClient.invalidateQueries({ queryKey: ["supplier-documents"] });
      setTarget("");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!document} onOpenChange={(o) => { if (!o) setTarget(""); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("admin.supplierDocuments.move_title")}</DialogTitle>
          <DialogDescription>{t("admin.supplierDocuments.move_desc")}</DialogDescription>
        </DialogHeader>
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger>
            <SelectValue placeholder={t("admin.supplierDocuments.move_pick")} />
          </SelectTrigger>
          <SelectContent>
            {targets.map((x) => (
              <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel", "Annuleren")}</Button>
          <Button onClick={move} disabled={!target || busy}>{t("admin.supplierDocuments.move_button")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
