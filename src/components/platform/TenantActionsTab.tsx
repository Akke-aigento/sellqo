import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Gift, Sparkles, Calendar, Shield, Clock, Wand2,
  Ticket, Check, X, History
} from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { 
  usePlatformQuickActions,
  useExecuteQuickAction,
  useTenantCouponRedemptions,
  usePlatformCoupons,
  useApplyCouponToTenant,
} from '@/hooks/usePlatformPromotions';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';

interface TenantActionsTabProps {
  tenantId: string;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Gift,
  Sparkles,
  Calendar,
  Shield,
  Clock,
  Wand2,
};

const colorMap: Record<string, string> = {
  green: 'bg-green-100 text-green-700 hover:bg-green-200',
  blue: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
  purple: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
  orange: 'bg-orange-100 text-orange-700 hover:bg-orange-200',
  cyan: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200',
  pink: 'bg-pink-100 text-pink-700 hover:bg-pink-200',
};

export function TenantActionsTab({ tenantId }: TenantActionsTabProps) {
  const [couponCode, setCouponCode] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ id: string; name: string } | null>(null);
  
  const { data: quickActions, isLoading: actionsLoading } = usePlatformQuickActions();
  const { data: redemptions, isLoading: redemptionsLoading } = useTenantCouponRedemptions(tenantId);
  const { data: allCoupons } = usePlatformCoupons();
  const { useTenantAdminActions } = usePlatformAdmin();
  const { data: adminActions } = useTenantAdminActions(tenantId);
  
  const executeAction = useExecuteQuickAction();
  const applyCoupon = useApplyCouponToTenant();
  
  const handleExecuteAction = (actionId: string, actionName: string) => {
    setConfirmAction({ id: actionId, name: actionName });
  };
  
  const confirmExecuteAction = async () => {
    if (!confirmAction) return;
    
    await executeAction.mutateAsync({
      actionId: confirmAction.id,
      tenantId,
    });
    
    setConfirmAction(null);
  };
  
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    
    // Find coupon by code
    const coupon = allCoupons?.find(c => 
      c.code.toUpperCase() === couponCode.toUpperCase() && c.is_active
    );
    
    if (!coupon) {
      return;
    }
    
    await applyCoupon.mutateAsync({
      couponId: coupon.id,
      tenantId,
    });
    
    setCouponCode('');
  };
  
  const formatDiscountValue = (type: string, value: number) => {
    switch (type) {
      case 'percentage':
        return `${value}%`;
      case 'fixed_amount':
        return `€${value.toFixed(2)}`;
      case 'free_months':
        return `${value} maand${value > 1 ? 'en' : ''} gratis`;
      default:
        return value.toString();
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Snelle Acties
          </CardTitle>
          <CardDescription>
            Voer voorgedefinieerde acties uit met één klik
          </CardDescription>
        </CardHeader>
        <CardContent>
          {actionsLoading ? (
            <div className="text-sm text-muted-foreground">Laden...</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {quickActions?.map((action) => {
                const Icon = iconMap[action.icon || 'Gift'] || Gift;
                const colorClass = colorMap[action.color || 'blue'] || colorMap.blue;
                
                return (
                  <Button
                    key={action.id}
                    variant="outline"
                    className={`h-auto py-4 flex flex-col items-center gap-2 ${colorClass}`}
                    onClick={() => handleExecuteAction(action.id, action.name)}
                    disabled={executeAction.isPending}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-sm font-medium">{action.name}</span>
                    {action.description && (
                      <span className="text-xs opacity-70 text-center line-clamp-2">
                        {action.description}
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Apply Coupon */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            Coupon Toepassen
          </CardTitle>
          <CardDescription>
            Pas een kortingscode toe op dit account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="Voer couponcode in..."
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              className="flex-1"
            />
            <Button 
              onClick={handleApplyCoupon}
              disabled={!couponCode.trim() || applyCoupon.isPending}
            >
              Toepassen
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active Discounts / Redemptions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Check className="h-5 w-5" />
            Toegepaste Kortingen
          </CardTitle>
          <CardDescription>
            Overzicht van kortingen die zijn toegepast op dit account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {redemptionsLoading ? (
            <div className="text-sm text-muted-foreground">Laden...</div>
          ) : redemptions && redemptions.length > 0 ? (
            <div className="space-y-3">
              {redemptions.map((redemption) => (
                <div 
                  key={redemption.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                      <Check className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <div className="font-medium">
                        {redemption.coupon?.name || redemption.coupon?.code}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {redemption.coupon && formatDiscountValue(
                          redemption.coupon.discount_type,
                          redemption.coupon.discount_value
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(redemption.redeemed_at), 'd MMM yyyy', { locale: nl })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Ticket className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Geen kortingen toegepast</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Actie Geschiedenis
          </CardTitle>
          <CardDescription>
            Recente admin acties op dit account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {adminActions && adminActions.length > 0 ? (
            <div className="space-y-2">
              {adminActions.slice(0, 10).map((action) => (
                <div 
                  key={action.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      {action.action_type.replace(/_/g, ' ')}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {(action.action_details as Record<string, unknown>)?.reason as string || 
                       (action.action_details as Record<string, unknown>)?.action_name as string ||
                       '-'}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(action.created_at), 'd MMM HH:mm', { locale: nl })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Geen recente acties</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Actie bevestigen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je de actie "{confirmAction?.name}" wilt uitvoeren voor deze tenant?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={confirmExecuteAction}>
              Uitvoeren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
