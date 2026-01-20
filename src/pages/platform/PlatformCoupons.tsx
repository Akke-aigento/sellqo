import React, { useState } from 'react';
import { Plus, Search, MoreHorizontal, Copy, Trash2, Pencil, TicketPercent } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { toast } from 'sonner';
import { 
  usePlatformCoupons, 
  useDeletePlatformCoupon,
  useCouponRedemptions,
} from '@/hooks/usePlatformPromotions';
import { PlatformCouponFormDialog } from '@/components/platform/PlatformCouponFormDialog';
import type { PlatformCoupon } from '@/types/platformPromotion';

export default function PlatformCoupons() {
  const [search, setSearch] = useState('');
  const [editCoupon, setEditCoupon] = useState<PlatformCoupon | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const { data: coupons, isLoading } = usePlatformCoupons();
  const { data: redemptions } = useCouponRedemptions();
  const deleteCoupon = useDeletePlatformCoupon();

  const filteredCoupons = coupons?.filter(coupon => 
    coupon.code.toLowerCase().includes(search.toLowerCase()) ||
    coupon.name.toLowerCase().includes(search.toLowerCase())
  );

  const getStatus = (coupon: PlatformCoupon) => {
    if (!coupon.is_active) return { label: 'Inactief', variant: 'secondary' as const };
    if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) {
      return { label: 'Verlopen', variant: 'destructive' as const };
    }
    if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
      return { label: 'Uitgeput', variant: 'outline' as const };
    }
    return { label: 'Actief', variant: 'default' as const };
  };

  const formatDiscountValue = (coupon: PlatformCoupon) => {
    switch (coupon.discount_type) {
      case 'percentage':
        return `${coupon.discount_value}%`;
      case 'fixed_amount':
        return `€${coupon.discount_value.toFixed(2)}`;
      case 'free_months':
        return `${coupon.discount_value} maand${coupon.discount_value > 1 ? 'en' : ''} gratis`;
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code gekopieerd');
  };

  const handleEdit = (coupon: PlatformCoupon) => {
    setEditCoupon(coupon);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditCoupon(null);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteCoupon.mutateAsync(deleteId);
    setDeleteId(null);
  };

  // Calculate stats
  const activeCoupons = coupons?.filter(c => getStatus(c).label === 'Actief').length || 0;
  const totalRedemptions = redemptions?.length || 0;
  const thisMonthRedemptions = redemptions?.filter(r => {
    const date = new Date(r.redeemed_at);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Platform Coupons</h1>
          <p className="text-muted-foreground">
            Beheer kortingscodes voor tenant abonnementen
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nieuwe Coupon
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Actieve Coupons
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCoupons}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Totaal Ingewisseld
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRedemptions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Deze Maand
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{thisMonthRedemptions}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Alle Coupons</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoeken..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Laden...</div>
          ) : filteredCoupons && filteredCoupons.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Naam</TableHead>
                  <TableHead>Korting</TableHead>
                  <TableHead>Geldigheid</TableHead>
                  <TableHead>Gebruik</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCoupons.map((coupon) => {
                  const status = getStatus(coupon);
                  return (
                    <TableRow key={coupon.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                            {coupon.code}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyCode(coupon.code)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{coupon.name}</TableCell>
                      <TableCell>{formatDiscountValue(coupon)}</TableCell>
                      <TableCell>
                        {coupon.valid_until ? (
                          <span className="text-sm">
                            t/m {format(new Date(coupon.valid_until), 'd MMM yyyy', { locale: nl })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Onbeperkt</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {coupon.used_count}
                          {coupon.max_uses && ` / ${coupon.max_uses}`}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(coupon)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Bewerken
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => setDeleteId(coupon.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Verwijderen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <TicketPercent className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-1">Geen coupons</h3>
              <p className="text-muted-foreground mb-4">
                Maak je eerste coupon aan om kortingen te geven
              </p>
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Nieuwe Coupon
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <PlatformCouponFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        coupon={editCoupon}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Coupon verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze coupon wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
