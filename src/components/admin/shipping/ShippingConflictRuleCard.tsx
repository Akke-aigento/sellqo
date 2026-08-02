import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Scale } from "lucide-react";
import { useCan } from "@/hooks/useCan";
import type { ShippingConflictRule } from "@/types/shipping";

/**
 * SHIP-CLASS-2 — voorrangsregel bij gemengde bestellingen.
 */
export function ShippingConflictRuleCard() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canWrite = useCan("write", "settings_general");
  const tenantId = currentTenant?.id;

  const { data: rule, isLoading } = useQuery({
    queryKey: ["shipping-conflict-rule", tenantId],
    queryFn: async (): Promise<ShippingConflictRule> => {
      if (!tenantId) return "highest_price";
      const { data, error } = await supabase
        .from("tenants")
        .select("shipping_conflict_rule")
        .eq("id", tenantId)
        .maybeSingle();
      if (error) throw error;
      return (data?.shipping_conflict_rule as ShippingConflictRule) ?? "highest_price";
    },
    enabled: !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: async (value: ShippingConflictRule) => {
      if (!tenantId) throw new Error("Geen tenant geselecteerd");
      const { data, error } = await supabase
        .from("tenants")
        .update({ shipping_conflict_rule: value })
        .eq("id", tenantId)
        .select("id, shipping_conflict_rule");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Wijziging niet opgeslagen — geen rechten op deze winkel.");
      }
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-conflict-rule"] });
      toast({ title: "Voorrangsregel opgeslagen" });
    },
    onError: (error: Error) => {
      toast({
        title: "Fout bij opslaan",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="h-4 w-4" />
          Gemengde bestellingen
        </CardTitle>
        <CardDescription>
          Wat gebeurt er als producten met verschillende verzendklassen samen
          besteld worden?
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <RadioGroup
            value={rule}
            onValueChange={(v) => mutation.mutate(v as ShippingConflictRule)}
            disabled={!canWrite || mutation.isPending}
            className="space-y-3"
          >
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <RadioGroupItem value="highest_price" id="rule-highest" />
              <div className="space-y-0.5">
                <Label htmlFor="rule-highest" className="cursor-pointer">
                  Duurste levering telt (aanbevolen)
                </Label>
                <p className="text-sm text-muted-foreground">
                  Zitten er producten met verschillende verzendklassen in één
                  bestelling, dan geldt de duurste leveringsmethode voor de hele
                  bestelling.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <RadioGroupItem value="sum" id="rule-sum" />
              <div className="space-y-0.5">
                <Label htmlFor="rule-sum" className="cursor-pointer">
                  Kosten optellen
                </Label>
                <p className="text-sm text-muted-foreground">
                  Elke verzendklasse rekent zijn eigen kosten, die bij elkaar
                  worden opgeteld.
                </p>
              </div>
            </div>
          </RadioGroup>
        )}
      </CardContent>
    </Card>
  );
}