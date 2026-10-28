import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useTracks } from '@/hooks/useBusinessModules';
import { 
  ArrowLeft, 
  Monitor, 
  Save, 
  Printer, 
  ScanBarcode, 
  Wallet,
  Settings2,
  Trash2,
  CreditCard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { usePOSTerminals } from '@/hooks/usePOS';
import { toast } from 'sonner';
import type { POSTerminalStatus } from '@/types/pos';
import { FloatingSaveBar } from '@/components/admin/FloatingSaveBar';
import { useTranslation } from 'react-i18next';

export default function POSTerminalSettingsPage() {
  const { t } = useTranslation();
  const { terminalId } = useParams<{ terminalId: string }>();
  const navigate = useNavigate();
  const { terminals, updateTerminal, deleteTerminal, isLoading } = usePOSTerminals();
  const { hasTrack, ready: tracksReady } = useTracks();
  const classicPos = hasTrack('webshop');
  
  const terminal = terminals.find(t => t.id === terminalId);
  
  // Form state
  const [name, setName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [status, setStatus] = useState<POSTerminalStatus>('active');
  const [hasPrinter, setHasPrinter] = useState(false);
  const [hasScanner, setHasScanner] = useState(false);
  const [hasCashDrawer, setHasCashDrawer] = useState(false);
  const [autoPrint, setAutoPrint] = useState(false);
  const [requireCustomer, setRequireCustomer] = useState(false);
  const [defaultTaxRate, setDefaultTaxRate] = useState('21');
  const [receiptFooter, setReceiptFooter] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Load terminal data
  useEffect(() => {
    if (terminal) {
      setName(terminal.name);
      setLocationName(terminal.location_name || '');
      setStatus(terminal.status);
      setHasPrinter(terminal.capabilities?.printer || false);
      setHasScanner(terminal.capabilities?.scanner || false);
      setHasCashDrawer(terminal.capabilities?.cash_drawer || false);
      setAutoPrint(terminal.settings?.auto_print || false);
      setRequireCustomer(terminal.settings?.require_customer || false);
      setDefaultTaxRate(String(terminal.settings?.default_tax_rate ?? 21));
      setReceiptFooter(terminal.settings?.receipt_footer || '');
    }
  }, [terminal]);
  
  const handleSave = async () => {
    if (!terminalId || !name.trim()) return;
    
    setIsSaving(true);
    try {
      await updateTerminal.mutateAsync({
        id: terminalId,
        data: {
          name: name.trim(),
          location_name: locationName.trim() || undefined,
          status,
          capabilities: {
            printer: hasPrinter,
            scanner: hasScanner,
            cash_drawer: hasCashDrawer,
          },
          settings: {
            auto_print: autoPrint,
            require_customer: requireCustomer,
            default_tax_rate: Number.isFinite(parseFloat(defaultTaxRate)) ? parseFloat(defaultTaxRate) : 21, // 0 % (vrijgesteld) mag; || zette dat op 21
            receipt_footer: receiptFooter.trim() || undefined,
          },
        },
      });
      toast.success(t('admin.pos.msg.terminal_saved'));
    } catch (error) {
      toast.error(t('admin.pos.msg.terminal_save_failed'));
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDelete = async () => {
    if (!terminalId) return;
    
    try {
      await deleteTerminal.mutateAsync(terminalId);
      toast.success(t('admin.pos.msg.terminal_deleted'));
      navigate('/admin/pos');
    } catch (error) {
      toast.error(t('admin.pos.msg.terminal_delete_failed'));
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  
  if (!terminal) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/admin/pos')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('common.back')}
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Monitor className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('admin.pOSTerminal.terminal_niet_gevonden')}</h3>
            <p className="text-muted-foreground">
              {t('admin.pOSTerminalSettings.deze_terminal_bestaat_niet_of_is')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      {/* Op mobiel zakt de knoppengroep onder de titel in plaats van ernaast
          geperst te worden; flex-wrap omdat het er meerdere zijn. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/pos')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('admin.pOSTerminalSettings.terminal_instellingen')}</h1>
            <p className="text-muted-foreground">{terminal.name}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                {t('common.delete')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('admin.pOSTerminalSettings.terminal_verwijderen')}</AlertDialogTitle>
                <AlertDialogDescription>
                  Weet je zeker dat je "{terminal.name}" wilt verwijderen? 
                  Alle gekoppelde sessies en transacties blijven bewaard.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                  {t('common.delete')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              {t('admin.ads.bolCampaignEditForm.algemeen')}
            </CardTitle>
            <CardDescription>{t('admin.pOSTerminalSettings.basisinstellingen_voor_deze_terminal')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('admin.productForm.naam')}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('admin.pos.stripeReaderDialog.bijv_kassa_1')}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="location">{t('admin.storefront.schema.icon.map')}</Label>
              <Input
                id="location"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder={t('admin.pOS.bijv_winkel_amsterdam')}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">{t('common.status')}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as POSTerminalStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t('admin.marketing.aBTestingPanel.actief')}</SelectItem>
                  <SelectItem value="inactive">{t('admin.products.inactief')}</SelectItem>
                  <SelectItem value="maintenance">{t('admin.pOS.onderhoud')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {terminal.stripe_reader_id && (
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-sm">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{t('admin.pOSTerminalSettings.stripe_reader')}</span>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {terminal.stripe_reader_id.slice(0, 20)}...
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* WANDELING: hardware, bonnen en afrekenen hieronder gelden enkel voor de klassieke kassa (winkel).
            SellQo Kassa (horeca) regelt dat op één plek: Kassa › Betalen en Kassa › Bon & printers. */}
        {!tracksReady ? null : classicPos ? (
          <>
        {/* Capabilities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              {t('admin.pOSTerminalSettings.hardware')}
            </CardTitle>
            <CardDescription>{t('admin.pOSTerminalSettings.aangesloten_apparatuur')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Printer className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label className="text-base">{t('admin.pOSTerminalSettings.bonprinter')}</Label>
                  <p className="text-sm text-muted-foreground">{t('admin.pOSTerminalSettings.80mm_thermische_printer')}</p>
                </div>
              </div>
              <Switch checked={hasPrinter} onCheckedChange={setHasPrinter} />
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ScanBarcode className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label className="text-base">{t('admin.pOSTerminalSettings.barcode_scanner')}</Label>
                  <p className="text-sm text-muted-foreground">{t('admin.pOSTerminalSettings.usb_of_bluetooth_scanner')}</p>
                </div>
              </div>
              <Switch checked={hasScanner} onCheckedChange={setHasScanner} />
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wallet className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label className="text-base">{t('admin.pOS.kassalade')}</Label>
                  <p className="text-sm text-muted-foreground">{t('admin.pOSTerminalSettings.automatisch_openen_bij_contant')}</p>
                </div>
              </div>
              <Switch checked={hasCashDrawer} onCheckedChange={setHasCashDrawer} />
            </div>
          </CardContent>
        </Card>
        
        {/* Receipt Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              {t('admin.pOSTerminalSettings.bonnen')}
            </CardTitle>
            <CardDescription>{t('admin.pOSTerminalSettings.instellingen_voor_kassabonnen')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">{t('admin.pOSTerminalSettings.automatisch_printen')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('admin.pOSTerminalSettings.print_automatisch_een_bon_na_elke')}
                </p>
              </div>
              <Switch 
                checked={autoPrint} 
                onCheckedChange={setAutoPrint}
                disabled={!hasPrinter}
              />
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <Label htmlFor="footer">{t('admin.pOSTerminalSettings.voettekst_bon')}</Label>
              <Textarea
                id="footer"
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
                placeholder={t('admin.pOSTerminalSettings.bijv_bedankt_voor_uw_aankoop')}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                {t('admin.pOSTerminalSettings.deze_tekst_verschijnt_onderaan_elke_kassabon')}
              </p>
            </div>
          </CardContent>
        </Card>
        
        {/* Checkout Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              {t('admin.marketing.creditPurchaseDialog.afrekenen')}
            </CardTitle>
            <CardDescription>{t('admin.pOSTerminalSettings.instellingen_voor_het_afrekenproces')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">{t('admin.pOSTerminalSettings.klant_verplicht')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('admin.pOSTerminalSettings.vereis_klantgegevens_bij_elke_verkoop')}
                </p>
              </div>
              <Switch checked={requireCustomer} onCheckedChange={setRequireCustomer} />
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <Label htmlFor="tax-rate">{t('admin.pOSTerminalSettings.standaard_btw_tarief')}</Label>
              <Select value={defaultTaxRate} onValueChange={setDefaultTaxRate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{t('admin.pOSTerminalSettings.0_vrijgesteld')}</SelectItem>
                  {/* België: 6 % (o.a. voeding, afhaal) en 12 % (o.a. eten ter plaatse); 9 % is het Nederlandse lage tarief. */}
                  <SelectItem value="6">{t('admin.pOSTerminalSettings.vat_6')}</SelectItem>
                  <SelectItem value="9">{t('admin.pOSTerminalSettings.9_laag_tarief')}</SelectItem>
                  <SelectItem value="12">{t('admin.pOSTerminalSettings.vat_12')}</SelectItem>
                  <SelectItem value="21">{t('admin.pOSTerminalSettings.21_standaard')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t('admin.pOSTerminalSettings.wordt_toegepast_op_producten_zonder_btw')}
              </p>
            </div>
          </CardContent>
        </Card>
          </>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.pOSTerminalSettings.horeca_title')}</CardTitle>
              <CardDescription>{t('admin.pOSTerminalSettings.horeca_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild variant="outline"><Link to="/admin/pos?tab=betalen">{t('admin.pOS.tabs.pay')}</Link></Button>
              <Button asChild variant="outline"><Link to="/admin/pos?tab=printers">{t('admin.pOS.tabs.printers')}</Link></Button>
            </CardContent>
          </Card>
        )}
      </div>
      <FloatingSaveBar
        isDirty={
          terminal ? (
            name !== terminal.name ||
            locationName !== (terminal.location_name || '') ||
            status !== terminal.status ||
            hasPrinter !== (terminal.capabilities?.printer || false) ||
            hasScanner !== (terminal.capabilities?.scanner || false) ||
            hasCashDrawer !== (terminal.capabilities?.cash_drawer || false) ||
            autoPrint !== (terminal.settings?.auto_print || false) ||
            requireCustomer !== (terminal.settings?.require_customer || false) ||
            defaultTaxRate !== String(terminal.settings?.default_tax_rate ?? 21) ||
            receiptFooter !== (terminal.settings?.receipt_footer || '')
          ) : false
        }
        isSaving={isSaving}
        onSave={handleSave}
        onCancel={() => {
          if (terminal) {
            setName(terminal.name);
            setLocationName(terminal.location_name || '');
            setStatus(terminal.status);
            setHasPrinter(terminal.capabilities?.printer || false);
            setHasScanner(terminal.capabilities?.scanner || false);
            setHasCashDrawer(terminal.capabilities?.cash_drawer || false);
            setAutoPrint(terminal.settings?.auto_print || false);
            setRequireCustomer(terminal.settings?.require_customer || false);
            setDefaultTaxRate(String(terminal.settings?.default_tax_rate ?? 21));
            setReceiptFooter(terminal.settings?.receipt_footer || '');
          }
        }}
      />
    </div>
  );
}
