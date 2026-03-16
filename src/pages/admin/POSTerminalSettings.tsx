import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  HelpCircle,
  TestTube,
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
import { usePOSPrinter } from '@/hooks/usePOSPrinter';
import { toast } from 'sonner';
import type { POSTerminalStatus } from '@/types/pos';

export default function POSTerminalSettingsPage() {
  const { terminalId } = useParams<{ terminalId: string }>();
  const navigate = useNavigate();
  const { terminals, updateTerminal, deleteTerminal, isLoading } = usePOSTerminals();
  const { printReceipt, openCashDrawer } = usePOSPrinter();
  
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
      setDefaultTaxRate(String(terminal.settings?.default_tax_rate || 21));
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
            default_tax_rate: parseFloat(defaultTaxRate) || 21,
            receipt_footer: receiptFooter.trim() || undefined,
          },
        },
      });
      toast.success('Terminal instellingen opgeslagen');
    } catch (error) {
      toast.error('Fout bij opslaan instellingen');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDelete = async () => {
    if (!terminalId) return;
    
    try {
      await deleteTerminal.mutateAsync(terminalId);
      toast.success('Terminal verwijderd');
      navigate('/admin/pos');
    } catch (error) {
      toast.error('Fout bij verwijderen terminal');
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
          Terug
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Monitor className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Terminal niet gevonden</h3>
            <p className="text-muted-foreground">
              Deze terminal bestaat niet of is verwijderd.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/pos')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Terminal Instellingen</h1>
            <p className="text-muted-foreground">{terminal.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Verwijderen
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Terminal verwijderen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Weet je zeker dat je "{terminal.name}" wilt verwijderen? 
                  Alle gekoppelde sessies en transacties blijven bewaard.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuleren</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                  Verwijderen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? 'Opslaan...' : 'Opslaan'}
          </Button>
        </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Algemeen
            </CardTitle>
            <CardDescription>Basisinstellingen voor deze terminal</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Naam *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="bijv. Kassa 1"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="location">Locatie</Label>
              <Input
                id="location"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="bijv. Winkel Amsterdam"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as POSTerminalStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Actief</SelectItem>
                  <SelectItem value="inactive">Inactief</SelectItem>
                  <SelectItem value="maintenance">Onderhoud</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {terminal.stripe_reader_id && (
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-sm">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Stripe Reader:</span>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {terminal.stripe_reader_id.slice(0, 20)}...
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Capabilities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Hardware
            </CardTitle>
            <CardDescription>Aangesloten apparatuur</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Printer className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label className="text-base">Bonprinter</Label>
                  <p className="text-sm text-muted-foreground">80mm thermische printer</p>
                </div>
              </div>
              <Switch checked={hasPrinter} onCheckedChange={setHasPrinter} />
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ScanBarcode className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label className="text-base">Barcode Scanner</Label>
                  <p className="text-sm text-muted-foreground">USB of Bluetooth scanner</p>
                </div>
              </div>
              <Switch checked={hasScanner} onCheckedChange={setHasScanner} />
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wallet className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label className="text-base">Kassalade</Label>
                  <p className="text-sm text-muted-foreground">Automatisch openen bij contant</p>
                </div>
              </div>
              <Switch checked={hasCashDrawer} onCheckedChange={setHasCashDrawer} />
            </div>

            <Separator />

            {/* Hardware Help & Testing */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <HelpCircle className="h-4 w-4 text-primary" />
                Installatie & testen
              </div>

              {hasScanner && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">Barcode Scanner</p>
                  <p className="text-xs text-muted-foreground">
                    Sluit een USB of Bluetooth barcodescanner aan op dit apparaat. De scanner werkt automatisch als toetsenbordinvoer — 
                    geen extra software nodig. Scan een barcode in het POS-scherm en het product wordt direct toegevoegd.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ondersteunde types: alle HID-scanners (bijv. Honeywell, Zebra, Inateck).
                  </p>
                </div>
              )}

              {hasPrinter && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Bonprinter</p>
                  <p className="text-xs text-muted-foreground">
                    Gebruik een ESC/POS-compatibele thermische printer (bijv. Epson TM-T20, Star TSP143, Bixolon SRP-330). 
                    Stel de printer in als standaardprinter in je besturingssysteem. Bonnen worden via het printdialoogvenster afgedrukt.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      const testEl = document.createElement('div');
                      testEl.innerHTML = `
                        <div style="text-align:center;font-family:monospace;padding:8px;">
                          <p style="font-size:14px;font-weight:bold;margin-bottom:4px;">*** TESTPRINT ***</p>
                          <p style="font-size:11px;margin-bottom:8px;">${terminal?.name || 'Terminal'}</p>
                          <p style="font-size:10px;">${new Date().toLocaleString('nl-NL')}</p>
                          <p style="font-size:10px;margin-top:4px;">1234567890</p>
                          <p style="border-top:1px dashed #000;margin:8px 0;"></p>
                          <p style="font-size:10px;">Als u dit kunt lezen, werkt uw printer correct.</p>
                          <p style="font-size:14px;font-weight:bold;margin-top:8px;">✓ Printer OK</p>
                        </div>
                      `;
                      printReceipt(testEl);
                      toast.success('Testprint verzonden naar printer');
                    }}
                  >
                    <TestTube className="mr-1 h-3 w-3" />
                    Testprint
                  </Button>
                </div>
              )}

              {hasCashDrawer && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Kassalade</p>
                  <p className="text-xs text-muted-foreground">
                    De kassalade wordt automatisch geopend bij contante betalingen via de bonprinter (ESC/POS pulse-commando).
                    Zorg dat de kassalade is aangesloten op de RJ11-poort van uw bonprinter.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      openCashDrawer();
                      toast.success('Kaslade-commando verzonden');
                    }}
                  >
                    <TestTube className="mr-1 h-3 w-3" />
                    Kaslade testen
                  </Button>
                </div>
              )}

              {!hasScanner && !hasPrinter && !hasCashDrawer && (
                <p className="text-xs text-muted-foreground">
                  Activeer hardware hierboven om installatie-instructies en testknoppen te zien.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Receipt Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Bonnen
            </CardTitle>
            <CardDescription>Instellingen voor kassabonnen</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Automatisch printen</Label>
                <p className="text-sm text-muted-foreground">
                  Print automatisch een bon na elke verkoop
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
              <Label htmlFor="footer">Voettekst bon</Label>
              <Textarea
                id="footer"
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
                placeholder="bijv. Bedankt voor uw aankoop!"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Deze tekst verschijnt onderaan elke kassabon
              </p>
            </div>
          </CardContent>
        </Card>
        
        {/* Checkout Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Afrekenen
            </CardTitle>
            <CardDescription>Instellingen voor het afrekenproces</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Klant verplicht</Label>
                <p className="text-sm text-muted-foreground">
                  Vereis klantgegevens bij elke verkoop
                </p>
              </div>
              <Switch checked={requireCustomer} onCheckedChange={setRequireCustomer} />
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <Label htmlFor="tax-rate">Standaard BTW-tarief (%)</Label>
              <Select value={defaultTaxRate} onValueChange={setDefaultTaxRate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0% (Vrijgesteld)</SelectItem>
                  <SelectItem value="9">9% (Laag tarief)</SelectItem>
                  <SelectItem value="21">21% (Standaard)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Wordt toegepast op producten zonder BTW-instelling
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
