import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown, Coins, Bell, Download, Trash2 } from 'lucide-react';
import { Tenant } from '@/hooks/useTenants';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TenantBulkActionsProps {
  selectedTenants: Tenant[];
  onComplete: () => void;
  onClearSelection: () => void;
}

type BulkAction = 'credits' | 'notification' | 'export' | null;

export function TenantBulkActions({
  selectedTenants,
  onComplete,
  onClearSelection,
}: TenantBulkActionsProps) {
  const [activeAction, setActiveAction] = useState<BulkAction>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [creditsAmount, setCreditsAmount] = useState(10);
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');

  const handleBulkCredits = async () => {
    if (creditsAmount <= 0) return;
    setIsLoading(true);
    
    try {
      let successCount = 0;
      for (const tenant of selectedTenants) {
        const { error } = await supabase.rpc('add_ai_credits', {
          p_tenant_id: tenant.id,
          p_credits: creditsAmount,
        });
        if (!error) successCount++;
      }
      
      toast.success(`${successCount}/${selectedTenants.length} tenants hebben ${creditsAmount} credits ontvangen`);
      setActiveAction(null);
      onComplete();
      onClearSelection();
    } catch (error) {
      toast.error('Fout bij toevoegen credits');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkNotification = async () => {
    if (!notificationTitle || !notificationMessage) return;
    setIsLoading(true);
    
    try {
      const notifications = selectedTenants.map((tenant) => ({
        tenant_id: tenant.id,
        category: 'system' as const,
        type: 'admin_announcement',
        title: notificationTitle,
        message: notificationMessage,
        priority: 'medium' as const,
      }));
      
      const { error } = await supabase.from('notifications').insert(notifications);
      
      if (error) throw error;
      
      toast.success(`Notificatie verzonden naar ${selectedTenants.length} tenants`);
      setActiveAction(null);
      setNotificationTitle('');
      setNotificationMessage('');
      onClearSelection();
    } catch (error) {
      toast.error('Fout bij verzenden notificaties');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    const headers = ['Naam', 'Slug', 'Email', 'Plan', 'Status', 'Aangemaakt'];
    const rows = selectedTenants.map((t) => [
      t.name,
      t.slug,
      t.owner_email,
      t.subscription_plan || '-',
      t.subscription_status || '-',
      t.created_at ? new Date(t.created_at).toLocaleDateString('nl-NL') : '-',
    ]);
    
    const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tenants-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success(`${selectedTenants.length} tenants geëxporteerd`);
    onClearSelection();
  };

  if (selectedTenants.length === 0) return null;

  return (
    <>
      <div className="relative flex items-center gap-2 p-3 pr-10 bg-primary/10 rounded-lg border border-primary/20">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClearSelection}
          className="absolute top-1 right-1 h-7 w-7 rounded-full"
        >
          <X className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {selectedTenants.length} geselecteerd
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="default">
              Bulk acties <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="bg-background">
            <DropdownMenuItem onClick={() => setActiveAction('credits')}>
              <Coins className="mr-2 h-4 w-4" />
              Credits toevoegen
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActiveAction('notification')}>
              <Bell className="mr-2 h-4 w-4" />
              Notificatie versturen
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Exporteren naar CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Bulk Credits Dialog */}
      <Dialog open={activeAction === 'credits'} onOpenChange={() => setActiveAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Credits Toevoegen</DialogTitle>
            <DialogDescription>
              Voeg AI credits toe aan {selectedTenants.length} tenants.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Aantal credits per tenant</Label>
              <Input
                type="number"
                min={1}
                value={creditsAmount}
                onChange={(e) => setCreditsAmount(parseInt(e.target.value) || 0)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Totaal: {creditsAmount * selectedTenants.length} credits
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveAction(null)}>
              Annuleren
            </Button>
            <Button onClick={handleBulkCredits} disabled={isLoading || creditsAmount <= 0}>
              {isLoading ? 'Bezig...' : 'Toevoegen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Notification Dialog */}
      <Dialog open={activeAction === 'notification'} onOpenChange={() => setActiveAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notificatie Versturen</DialogTitle>
            <DialogDescription>
              Stuur een bericht naar {selectedTenants.length} tenants.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Titel</Label>
              <Input
                value={notificationTitle}
                onChange={(e) => setNotificationTitle(e.target.value)}
                placeholder="Onderwerp van de notificatie"
              />
            </div>
            <div className="space-y-2">
              <Label>Bericht</Label>
              <Textarea
                value={notificationMessage}
                onChange={(e) => setNotificationMessage(e.target.value)}
                placeholder="Inhoud van de notificatie..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveAction(null)}>
              Annuleren
            </Button>
            <Button
              onClick={handleBulkNotification}
              disabled={isLoading || !notificationTitle || !notificationMessage}
            >
              {isLoading ? 'Verzenden...' : 'Versturen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
