import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Monitor, 
  Plus, 
  Settings, 
  Play, 
  Pause, 
  MoreHorizontal,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HorecaNotifyDevices } from '@/components/admin/horeca/HorecaNotifyDevices';
import { KassaStaffTab } from '@/components/admin/pos/KassaStaffTab';
import { HorecaPaySettings } from '@/components/admin/pos/HorecaPaySettings';
import { HorecaPrinters } from '@/components/admin/pos/HorecaPrinters';
import { KassaDevicesStatus } from '@/components/admin/pos/KassaDevicesStatus';
import { useKassaDevices } from '@/hooks/useKassaDevices';
import { usePOSTerminals, usePOSSessions } from '@/hooks/usePOS';
import type { POSTerminal } from '@/types/pos';
import { useTranslation } from 'react-i18next';
import { useTracks } from '@/hooks/useBusinessModules';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { formatSessionOpenedAt, isStaleOpenSession } from '@/lib/posSessionTime';

export default function POSPage() {
  const { t, i18n } = useTranslation();
  const dateLocale = useDateFnsLocale();
  const navigate = useNavigate();
  // PERSONEEL-1 — tabs bovenaan, deeplinkbaar (?tab=terminals|personeel).
  const [searchParams, setSearchParams] = useSearchParams();
  // BETAAL-1: ?tab=betalen — betaalinstellingen van SellQo Kassa (enkel met het horecaspoor).
  const { hasTrack: hasTrackForTabs } = useTracks();
  const payTab = hasTrackForTabs('horeca');
  const rawTab = searchParams.get('tab');
  // PRINT-2: ?tab=printers — Bon & printers (horecaspoor).
  const tab = rawTab === 'personeel' ? 'personeel' : rawTab === 'betalen' && payTab ? 'betalen' : rawTab === 'printers' && payTab ? 'printers' : 'terminals';
  const setTab = (v: string) => {
    const next = new URLSearchParams(searchParams);
    if (v === 'terminals') next.delete('tab'); else next.set('tab', v);
    setSearchParams(next, { replace: true });
  };
  const { terminals, isLoading, createTerminal, deleteTerminal } = usePOSTerminals();
  const { sessions } = usePOSSessions();
  // LIVE-1 — hartslag van SellQo Kassa-toestellen per kassa.
  const { data: kassaDevices = [] } = useKassaDevices();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  // WANDELING: een kassa verwijderen gebeurde met één tik, zonder bevestiging.
  const [toDelete, setToDelete] = useState<POSTerminal | null>(null);
  const [newTerminalName, setNewTerminalName] = useState('');
  const [newTerminalLocation, setNewTerminalLocation] = useState('');

  const handleCreateTerminal = async () => {
    if (!newTerminalName.trim()) return;
    
    await createTerminal.mutateAsync({
      name: newTerminalName,
      location_name: newTerminalLocation || undefined,
    });
    
    setShowCreateDialog(false);
    setNewTerminalName('');
    setNewTerminalLocation('');
  };

  const getTerminalSession = (terminalId: string) => {
    return sessions.find(s => s.terminal_id === terminalId && s.status === 'open');
  };

  const getStatusBadge = (terminal: POSTerminal) => {
    const activeSession = getTerminalSession(terminal.id);
    
    if (terminal.status === 'maintenance') {
      return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">{t('admin.pOS.onderhoud')}</Badge>;
    }
    if (terminal.status === 'inactive') {
      return <Badge variant="outline" className="bg-muted text-muted-foreground">{t('admin.products.inactief')}</Badge>;
    }
    if (activeSession && isStaleOpenSession(activeSession)) {
      // NIGHT-QF-3: een sessie van dagen geleden is geen "Actief" van vandaag.
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300">
          {t('admin.pOS.nog_open_sinds', { date: formatSessionOpenedAt(activeSession.opened_at, dateLocale) })}
        </Badge>
      );
    }
    if (activeSession) {
      return <Badge className="bg-green-500 hover:bg-green-600">{t('admin.marketing.aBTestingPanel.actief')}</Badge>;
    }
    return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{t('admin.productForm.beschikbaar')}</Badge>;
  };

  // WERKPLEK-1 — zonder webshopspoor opent een kassa altijd SellQo Kassa, nooit de klassieke kassa.
  const classicPos = hasTrackForTabs('webshop');
  const handleOpenPOS = (terminal: POSTerminal) => {
    navigate(classicPos ? `/admin/pos/${terminal.id}` : '/kassa');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('admin.pOS.kassa_pos')}</h1>
          <p className="text-muted-foreground">
            {t('admin.pOS.beheer_je_kassaterminals_en_start_een')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/kassa">
              <Monitor className="mr-2 h-4 w-4" />
              {t('admin.pOS.openKassaApp')}
            </Link>
          </Button>
          {tab === 'terminals' && (
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('admin.pOS.nieuwe_terminal')}
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="terminals">{t('admin.pOS.tabs.terminals')}</TabsTrigger>
          <TabsTrigger value="personeel">{t('admin.pOS.tabs.staff')}</TabsTrigger>
          {payTab ? <TabsTrigger value="betalen">{t('admin.pOS.tabs.pay')}</TabsTrigger> : null}
          {payTab ? <TabsTrigger value="printers">{t('admin.pOS.tabs.printers')}</TabsTrigger> : null}
        </TabsList>
        {payTab ? (
          <TabsContent value="betalen" className="mt-4 max-w-3xl">
            <HorecaPaySettings />
          </TabsContent>
        ) : null}
        {payTab ? (
          <TabsContent value="printers" className="mt-4 max-w-3xl">
            <HorecaPrinters />
          </TabsContent>
        ) : null}
        <TabsContent value="personeel" className="mt-4">
          <KassaStaffTab />
        </TabsContent>
        <TabsContent value="terminals" className="mt-4 space-y-6">
      {/* Terminals Grid */}
      {terminals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Monitor className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('admin.pOS.geen_terminals')}</h3>
            <p className="text-muted-foreground text-center mb-4">
              {t('admin.pOS.maak_je_eerste_kassaterminal_aan_om')}
              {/* WANDELING: voor een horecazaak de volgorde — eerst een kassa, dan de kassa-app op het toestel. */}
              {payTab ? <span className="mt-1 block text-sm">{t('admin.pOS.empty_horeca_hint')}</span> : null}
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('admin.pOS.terminal_aanmaken')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {terminals.map((terminal) => {
            const activeSession = getTerminalSession(terminal.id);
            
            return (
              <Card key={terminal.id} className="relative overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Monitor className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{terminal.name}</CardTitle>
                        {terminal.location_name && (
                          <CardDescription className="flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" />
                            {terminal.location_name}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/admin/pos/terminals/${terminal.id}`)}>
                          <Settings className="mr-2 h-4 w-4" />
                          {t('admin.translationHub.instellingen')}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setToDelete(terminal)}
                          className="text-destructive"
                        >
                          {t('common.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    {getStatusBadge(terminal)}
                    {activeSession && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatSessionOpenedAt(activeSession.opened_at, dateLocale)}
                      </span>
                    )}
                  </div>

                  <KassaDevicesStatus devices={kassaDevices.filter((d) => d.terminal_id === terminal.id)} />

                  {/* Capabilities */}
                  <div className="flex gap-2">
                    {terminal.capabilities.scanner && (
                      <Badge variant="secondary" className="text-xs">{t('admin.pOS.scanner')}</Badge>
                    )}
                    {terminal.capabilities.printer && (
                      <Badge variant="secondary" className="text-xs">{t('admin.pOS.printer')}</Badge>
                    )}
                    {terminal.capabilities.cash_drawer && (
                      <Badge variant="secondary" className="text-xs">{t('admin.pOS.kassalade')}</Badge>
                    )}
                  </div>

                  {/* Action Button */}
                  <Button 
                    className="w-full" 
                    onClick={() => handleOpenPOS(terminal)}
                    variant={activeSession ? "default" : "outline"}
                  >
                    {activeSession ? (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        {t('admin.pOS.kassa_openen')}
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        {t('admin.pOS.dag_starten')}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Recent Sessions Summary */}
      {sessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.pOS.recente_sessies')}</CardTitle>
            <CardDescription>{t('admin.pOS.overzicht_van_de_laatste_kassadagen')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sessions.slice(0, 5).map((session) => (
                <div 
                  key={session.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    {isStaleOpenSession(session) ? (
                      <AlertCircle className="h-5 w-5 text-amber-500" />
                    ) : session.status === 'open' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : session.cash_difference && session.cash_difference !== 0 ? (
                      <AlertCircle className="h-5 w-5 text-orange-500" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium">
                        {session.terminal?.name || 'Terminal'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(session.opened_at).toLocaleDateString(i18n.language, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {isStaleOpenSession(session) ? (
                      <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300">
                        {t('admin.pOS.nog_open_sinds', { date: formatSessionOpenedAt(session.opened_at, dateLocale) })}
                      </Badge>
                    ) : (
                      <Badge variant={session.status === 'open' ? 'default' : 'secondary'}>
                        {session.status === 'open' ? t('admin.marketing.aBTestingPanel.actief') : t('admin.storefront.food.fulfillmentSettings.gesloten')}
                      </Badge>
                    )}
                    {session.status === 'closed' && session.cash_difference !== null && (
                      <p className={`text-sm mt-1 ${
                        session.cash_difference === 0 
                          ? 'text-green-600' 
                          : session.cash_difference > 0 
                            ? 'text-blue-600' 
                            : 'text-red-600'
                      }`}>
                        {session.cash_difference === 0 
                          ? 'Kloppend' 
                          : session.cash_difference > 0 
                            ? `+€${session.cash_difference.toFixed(2)}` 
                            : `-€${Math.abs(session.cash_difference).toFixed(2)}`
                        }
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

          {/* MELDING-1: toestellen die horeca-meldingen krijgen (enkel met het horecaspoor). */}
          {payTab ? <HorecaNotifyDevices /> : null}
        </TabsContent>
      </Tabs>

      {/* Create Terminal Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.pOS.nieuwe_terminal_aanmaken')}</DialogTitle>
            <DialogDescription>
              {t('admin.pOS.geef_je_kassaterminal_een_naam_en')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('admin.productForm.naam')}</Label>
              <Input
                id="name"
                placeholder={t('admin.pos.stripeReaderDialog.bijv_kassa_1')}
                value={newTerminalName}
                onChange={(e) => setNewTerminalName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">{t('admin.storefront.schema.icon.map')}</Label>
              <Input
                id="location"
                placeholder={t('admin.pOS.bijv_winkel_amsterdam')}
                value={newTerminalLocation}
                onChange={(e) => setNewTerminalLocation(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handleCreateTerminal}
              disabled={!newTerminalName.trim() || createTerminal.isPending}
            >
              {createTerminal.isPending ? t('admin.promotions.giftCardFormDialog.aanmaken') : t('admin.adsAiRules.aanmaken')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!toDelete} onOpenChange={(o) => { if (!o) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.posToasts.delete_title', { name: toDelete?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('admin.posToasts.delete_body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.posToasts.cancel')}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (toDelete) deleteTerminal.mutate(toDelete.id); setToDelete(null); }}>
              {t('admin.posToasts.delete_confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
