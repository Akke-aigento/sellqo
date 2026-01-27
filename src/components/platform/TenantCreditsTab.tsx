import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Coins, Plus, Minus, History } from 'lucide-react';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface TenantCreditsTabProps {
  tenantId: string;
}

export function TenantCreditsTab({ tenantId }: TenantCreditsTabProps) {
  const [adjustment, setAdjustment] = useState(0);
  const [reason, setReason] = useState('');
  const { useTenantCredits, adjustCredits } = usePlatformAdmin();
  const { data: credits, isLoading } = useTenantCredits(tenantId);

  // Fetch credit purchases
  const { data: purchases } = useQuery({
    queryKey: ['tenant-credit-purchases', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_credit_purchases')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  // Fetch recent usage
  const { data: usage } = useQuery({
    queryKey: ['tenant-credit-usage', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_usage_log')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const handleAdjust = async () => {
    if (adjustment === 0 || !reason.trim()) return;
    await adjustCredits.mutateAsync({
      tenantId,
      adjustment,
      reason: reason.trim(),
    });
    setAdjustment(0);
    setReason('');
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const available = credits ? credits.credits_total + credits.credits_purchased - credits.credits_used : 0;
  const total = credits ? credits.credits_total + credits.credits_purchased : 0;
  const percentage = total > 0 ? (credits.credits_used / total) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Current Credits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5" />
              Huidige Balans
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-4xl font-bold">{available}</div>
            <p className="text-sm text-muted-foreground">beschikbare credits</p>
            <Progress value={percentage} className="h-2" />
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Totaal</p>
                <p className="font-semibold">{credits?.credits_total || 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Gebruikt</p>
                <p className="font-semibold">{credits?.credits_used || 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Gekocht</p>
                <p className="font-semibold">{credits?.credits_purchased || 0}</p>
              </div>
            </div>
            {credits?.credits_reset_at && (
              <p className="text-xs text-muted-foreground">
                Reset op: {format(new Date(credits.credits_reset_at), 'dd MMM yyyy', { locale: nl })}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Adjust Credits */}
        <Card>
          <CardHeader>
            <CardTitle>Credits Aanpassen</CardTitle>
            <CardDescription>
              Voeg credits toe of verwijder credits handmatig
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setAdjustment((a) => a - 10)}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                value={adjustment}
                onChange={(e) => setAdjustment(parseInt(e.target.value) || 0)}
                className="text-center"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setAdjustment((a) => a + 10)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reden</Label>
              <Textarea
                id="reason"
                placeholder="Bijv. Compensatie voor technisch probleem"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <Button
              onClick={handleAdjust}
              disabled={adjustment === 0 || !reason.trim() || adjustCredits.isPending}
              className="w-full"
              variant={adjustment < 0 ? 'destructive' : 'default'}
            >
              {adjustCredits.isPending
                ? 'Bezig...'
                : adjustment >= 0
                ? `+${adjustment} credits toevoegen`
                : `${adjustment} credits verwijderen`}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Purchase History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Aankoop Geschiedenis
          </CardTitle>
        </CardHeader>
        <CardContent>
          {purchases && purchases.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Credits</TableHead>
                  <TableHead>Bedrag</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell>
                      {format(new Date(purchase.created_at!), 'dd MMM yyyy HH:mm', { locale: nl })}
                    </TableCell>
                    <TableCell className="font-semibold">+{purchase.credits_amount}</TableCell>
                    <TableCell>€{(purchase.price_paid / 100).toFixed(2)}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                          purchase.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {purchase.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm">Geen aankopen gevonden</p>
          )}
        </CardContent>
      </Card>

      {/* Recent Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Gebruik</CardTitle>
        </CardHeader>
        <CardContent>
          {usage && usage.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Feature</TableHead>
                  <TableHead>Credits</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {format(new Date(log.created_at), 'dd MMM HH:mm', { locale: nl })}
                    </TableCell>
                    <TableCell>{log.feature}</TableCell>
                    <TableCell className="text-red-600">-{log.credits_used}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm">Geen recent gebruik gevonden</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
