import { useState } from 'react';
import { Loader2, Package, Search, CheckCircle, Link2, ArrowUpDown, RefreshCw, ChevronDown, ChevronRight, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SyncDirectionSelector } from './SyncDirectionSelector';
import { ConflictStrategySelector } from './ConflictStrategySelector';
import type { SyncDirection, ConflictStrategy, SupportedDirections } from '@/types/syncRules';

export interface SyncFields {
  price: boolean;
  stock: boolean;
  title: boolean;
  fulfillment: boolean;
  shipping: boolean;
}

const DEFAULT_SYNC_FIELDS: SyncFields = {
  price: true,
  stock: true,
  title: false,
  fulfillment: false,
  shipping: true,
};

const SYNC_FIELD_LABELS: Record<keyof SyncFields, { label: string; description: string }> = {
  price: { label: 'Prijs', description: 'Verkoopprijs synchroniseren' },
  stock: { label: 'Voorraad', description: 'Stock levels bijwerken' },
  title: { label: 'Titel', description: 'Productnaam en omschrijving' },
  fulfillment: { label: 'Fulfillment', description: 'FBR/FBB methode' },
  shipping: { label: 'Verzendinfo', description: 'Leveringscode meesturen' },
};

interface BolOffer {
  offerId: string;
  ean: string;
  title: string;
  price: number;
  stock: number;
  fulfilmentMethod: string;
  alreadyLinked: boolean;
  existingProductId: string | null;
  existingProductName: string | null;
  syncEnabled?: boolean;
  syncFields?: SyncFields;
}

interface SellQoProduct {
  productId: string;
  name: string;
  ean: string;
  price: number;
  stock: number;
  alreadyOnBol: boolean;
  bolOfferId: string | null;
  syncEnabled: boolean;
  syncFields?: SyncFields;
}

interface BolProductImportDialogProps {
  connectionId: string;
  onImportComplete?: () => void;
}

const BOL_CAPABILITIES: SupportedDirections = {
  import: true,
  export: true,
  bidirectional: true,
};

export function BolProductImportDialog({ connectionId, onImportComplete }: BolProductImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<SyncDirection>('import');
  const [conflictStrategy, setConflictStrategy] = useState<ConflictStrategy>('sellqo_wins');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [offers, setOffers] = useState<BolOffer[]>([]);
  const [sellqoProducts, setSellqoProducts] = useState<SellQoProduct[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [fetched, setFetched] = useState(false);

  const resetState = () => {
    setOffers([]);
    setSellqoProducts([]);
    setSelectedIds(new Set());
    setSearchQuery('');
    setFetched(false);
  };

  const handleDirectionChange = (newDirection: SyncDirection) => {
    setDirection(newDirection);
    resetState();
  };

  // Fetch Bol.com offers (for import/bidirectional)
  const fetchBolOffers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-bol-products', {
        body: { connectionId, mode: 'list' },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Ophalen mislukt');
      setOffers(data.offers || []);
      toast.success(`${data.totalOffers} producten opgehaald van Bol.com`);
    } catch (err) {
      toast.error('Ophalen mislukt: ' + (err instanceof Error ? err.message : 'Onbekende fout'));
    } finally {
      setLoading(false);
    }
  };

  // Fetch SellQo products (for export/bidirectional)
  const fetchSellqoProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-bol-products', {
        body: { connectionId, mode: 'list-sellqo' },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Ophalen mislukt');
      setSellqoProducts(data.products || []);
      toast.success(`${data.totalProducts} producten opgehaald`);
    } catch (err) {
      toast.error('Ophalen mislukt: ' + (err instanceof Error ? err.message : 'Onbekende fout'));
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    if (direction === 'import') {
      await fetchBolOffers();
    } else if (direction === 'export') {
      await fetchSellqoProducts();
    } else {
      // Bidirectional: fetch both
      await Promise.all([fetchBolOffers(), fetchSellqoProducts()]);
    }
    setFetched(true);
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) { toast.warning('Selecteer minimaal één product'); return; }
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-bol-products', {
        body: { connectionId, mode: 'import', selectedOfferIds: Array.from(selectedIds) },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Import mislukt');
      const parts: string[] = [];
      if (data.imported > 0) parts.push(`${data.imported} nieuw aangemaakt`);
      if (data.linked > 0) parts.push(`${data.linked} gekoppeld`);
      if (data.errors > 0) parts.push(`${data.errors} fouten`);
      toast.success(`Import voltooid: ${parts.join(', ')}`);
      setSelectedIds(new Set());
      setOpen(false);
      onImportComplete?.();
    } catch (err) {
      toast.error('Import mislukt: ' + (err instanceof Error ? err.message : 'Onbekende fout'));
    } finally {
      setProcessing(false);
    }
  };

  const handleExport = async () => {
    if (selectedIds.size === 0) { toast.warning('Selecteer minimaal één product'); return; }
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-bol-products', {
        body: { connectionId, mode: 'export', selectedProductIds: Array.from(selectedIds) },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Export mislukt');
      const parts: string[] = [];
      if (data.exported > 0) parts.push(`${data.exported} geëxporteerd`);
      if (data.alreadyExists > 0) parts.push(`${data.alreadyExists} al op Bol.com`);
      if (data.errors > 0) parts.push(`${data.errors} fouten`);
      toast.success(`Export voltooid: ${parts.join(', ')}`);
      setSelectedIds(new Set());
      setOpen(false);
      onImportComplete?.();
    } catch (err) {
      toast.error('Export mislukt: ' + (err instanceof Error ? err.message : 'Onbekende fout'));
    } finally {
      setProcessing(false);
    }
  };

  const handleSyncToggle = async (productId: string, enabled: boolean) => {
    try {
      const { data, error } = await supabase.functions.invoke('sync-bol-products', {
        body: { connectionId, mode: 'sync-settings', productSyncSettings: [{ productId, syncEnabled: enabled }] },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Opslaan mislukt');
      
      // Update local state
      setSellqoProducts(prev => prev.map(p => p.productId === productId ? { ...p, syncEnabled: enabled } : p));
      setOffers(prev => prev.map(o => o.existingProductId === productId ? { ...o, syncEnabled: enabled } : o));
      toast.success(enabled ? 'Sync ingeschakeld' : 'Sync uitgeschakeld');
    } catch (err) {
      toast.error('Opslaan mislukt: ' + (err instanceof Error ? err.message : 'Onbekende fout'));
    }
  };

  const handleAction = () => {
    if (direction === 'import') handleImport();
    else if (direction === 'export') handleExport();
    else {
      // Bidirectional: import selected Bol offers + export selected SellQo products
      handleImport();
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Filter logic per direction
  const filteredOffers = offers.filter(o => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return o.title.toLowerCase().includes(q) || o.ean.includes(q);
  });

  const filteredProducts = sellqoProducts.filter(p => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.ean.includes(q);
  });

  const toggleSelectAllImport = () => {
    const unlinked = filteredOffers.filter(o => !o.alreadyLinked);
    if (selectedIds.size === unlinked.length && unlinked.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unlinked.map(o => o.offerId)));
    }
  };

  const toggleSelectAllExport = () => {
    const notOnBol = filteredProducts.filter(p => !p.alreadyOnBol);
    if (selectedIds.size === notOnBol.length && notOnBol.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notOnBol.map(p => p.productId)));
    }
  };

  const directionLabels: Record<SyncDirection, { title: string; description: string; fetchLabel: string; actionLabel: string }> = {
    import: {
      title: 'Producten importeren van Bol.com',
      description: 'Selecteer welke Bol.com producten je wilt importeren of koppelen aan SellQo.',
      fetchLabel: 'Bol.com producten ophalen',
      actionLabel: `Importeer ${selectedIds.size} product${selectedIds.size !== 1 ? 'en' : ''}`,
    },
    export: {
      title: 'Producten exporteren naar Bol.com',
      description: 'Selecteer welke SellQo producten je als aanbieding wilt plaatsen op Bol.com.',
      fetchLabel: 'SellQo producten ophalen',
      actionLabel: `Exporteer ${selectedIds.size} product${selectedIds.size !== 1 ? 'en' : ''}`,
    },
    bidirectional: {
      title: 'Bidirectionele product sync',
      description: 'Beheer de synchronisatie tussen SellQo en Bol.com in beide richtingen.',
      fetchLabel: 'Producten ophalen',
      actionLabel: `Synchroniseer ${selectedIds.size} product${selectedIds.size !== 1 ? 'en' : ''}`,
    },
  };

  const labels = directionLabels[direction];

  const renderImportTable = () => {
    const unlinked = filteredOffers.filter(o => !o.alreadyLinked);
    const allSelected = unlinked.length > 0 && unlinked.every(o => selectedIds.has(o.offerId));

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox checked={allSelected} onCheckedChange={toggleSelectAllImport} />
            </TableHead>
            <TableHead>Product</TableHead>
            <TableHead>EAN</TableHead>
            <TableHead className="text-right">Prijs</TableHead>
            <TableHead className="text-right">Voorraad</TableHead>
            <TableHead>Fulfillment</TableHead>
            <TableHead>Status</TableHead>
            {direction === 'bidirectional' && <TableHead>Sync</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredOffers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={direction === 'bidirectional' ? 8 : 7} className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'Geen producten gevonden' : 'Geen aanbiedingen op Bol.com'}
              </TableCell>
            </TableRow>
          ) : (
            filteredOffers.map(offer => (
              <TableRow
                key={offer.offerId}
                className={offer.alreadyLinked ? 'opacity-60' : 'cursor-pointer'}
                onClick={() => !offer.alreadyLinked && toggleSelect(offer.offerId)}
              >
                <TableCell>
                  <Checkbox
                    checked={offer.alreadyLinked || selectedIds.has(offer.offerId)}
                    disabled={offer.alreadyLinked}
                    onCheckedChange={() => toggleSelect(offer.offerId)}
                    onClick={e => e.stopPropagation()}
                  />
                </TableCell>
                <TableCell className="font-medium max-w-[250px] truncate">{offer.title}</TableCell>
                <TableCell className="font-mono text-xs">{offer.ean}</TableCell>
                <TableCell className="text-right">€{offer.price.toFixed(2)}</TableCell>
                <TableCell className="text-right">{offer.stock}</TableCell>
                <TableCell>
                  <Badge variant={offer.fulfilmentMethod === 'FBB' ? 'default' : 'secondary'}>
                    {offer.fulfilmentMethod}
                  </Badge>
                </TableCell>
                <TableCell>
                  {offer.alreadyLinked ? (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-xs">Gekoppeld</span>
                    </div>
                  ) : selectedIds.has(offer.offerId) ? (
                    <div className="flex items-center gap-1 text-primary">
                      <Link2 className="w-4 h-4" />
                      <span className="text-xs">Geselecteerd</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Nieuw</span>
                  )}
                </TableCell>
                {direction === 'bidirectional' && offer.alreadyLinked && offer.existingProductId && (
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Switch
                      checked={offer.syncEnabled ?? false}
                      onCheckedChange={(checked) => handleSyncToggle(offer.existingProductId!, checked)}
                    />
                  </TableCell>
                )}
                {direction === 'bidirectional' && !offer.alreadyLinked && (
                  <TableCell><span className="text-xs text-muted-foreground">—</span></TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    );
  };

  const renderExportTable = () => {
    const notOnBol = filteredProducts.filter(p => !p.alreadyOnBol);
    const allSelected = notOnBol.length > 0 && notOnBol.every(p => selectedIds.has(p.productId));

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox checked={allSelected} onCheckedChange={toggleSelectAllExport} />
            </TableHead>
            <TableHead>Product</TableHead>
            <TableHead>EAN</TableHead>
            <TableHead className="text-right">Prijs</TableHead>
            <TableHead className="text-right">Voorraad</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Sync</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredProducts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'Geen producten gevonden' : 'Geen producten in SellQo'}
              </TableCell>
            </TableRow>
          ) : (
            filteredProducts.map(product => (
              <TableRow
                key={product.productId}
                className={product.alreadyOnBol ? 'opacity-60' : 'cursor-pointer'}
                onClick={() => !product.alreadyOnBol && toggleSelect(product.productId)}
              >
                <TableCell>
                  <Checkbox
                    checked={product.alreadyOnBol || selectedIds.has(product.productId)}
                    disabled={product.alreadyOnBol}
                    onCheckedChange={() => toggleSelect(product.productId)}
                    onClick={e => e.stopPropagation()}
                  />
                </TableCell>
                <TableCell className="font-medium max-w-[250px] truncate">{product.name}</TableCell>
                <TableCell className="font-mono text-xs">{product.ean || <span className="text-muted-foreground italic">Geen EAN</span>}</TableCell>
                <TableCell className="text-right">€{product.price.toFixed(2)}</TableCell>
                <TableCell className="text-right">{product.stock}</TableCell>
                <TableCell>
                  {product.alreadyOnBol ? (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-xs">Op Bol.com</span>
                    </div>
                  ) : selectedIds.has(product.productId) ? (
                    <div className="flex items-center gap-1 text-primary">
                      <Link2 className="w-4 h-4" />
                      <span className="text-xs">Geselecteerd</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Niet op Bol</span>
                  )}
                </TableCell>
                <TableCell onClick={e => e.stopPropagation()}>
                  {product.alreadyOnBol ? (
                    <Switch
                      checked={product.syncEnabled}
                      onCheckedChange={(checked) => handleSyncToggle(product.productId, checked)}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    );
  };

  const getFooterStats = () => {
    if (direction === 'import') {
      return `${offers.length} producten op Bol.com • ${offers.filter(o => o.alreadyLinked).length} al gekoppeld`;
    } else if (direction === 'export') {
      return `${sellqoProducts.length} producten in SellQo • ${sellqoProducts.filter(p => p.alreadyOnBol).length} al op Bol.com`;
    }
    return `${offers.length} op Bol.com • ${sellqoProducts.length} in SellQo`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ArrowUpDown className="w-4 h-4 mr-2" />
          Producten Synchroniseren
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.description}</DialogDescription>
        </DialogHeader>

        <SyncDirectionSelector
          value={direction}
          onChange={handleDirectionChange}
          capabilities={BOL_CAPABILITIES}
        />

        {direction === 'bidirectional' && (
          <ConflictStrategySelector
            value={conflictStrategy}
            onChange={setConflictStrategy}
            platformName="Bol.com"
          />
        )}

        {!fetched ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Package className="w-12 h-12 text-muted-foreground" />
            <p className="text-muted-foreground text-center">
              {direction === 'import'
                ? 'Haal je productaanbod op van Bol.com om te kiezen welke je wilt importeren.'
                : direction === 'export'
                ? 'Haal je SellQo producten op om te kiezen welke je naar Bol.com wilt exporteren.'
                : 'Haal producten op van beide bronnen om de synchronisatie in te stellen.'}
            </p>
            <Button onClick={fetchData} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Ophalen...
                </>
              ) : (
                labels.fetchLabel
              )}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Zoek op naam of EAN..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Badge variant="secondary">{selectedIds.size} geselecteerd</Badge>
            </div>

            <ScrollArea className="flex-1 min-h-0 max-h-[calc(85vh-22rem)]">
              {direction === 'import' && renderImportTable()}
              {direction === 'export' && renderExportTable()}
              {direction === 'bidirectional' && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-muted-foreground">Bol.com → SellQo</h4>
                    {renderImportTable()}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-muted-foreground">SellQo → Bol.com</h4>
                    {renderExportTable()}
                  </div>
                </div>
              )}
            </ScrollArea>
          </>
        )}

        {fetched && (
          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <p className="text-sm text-muted-foreground">{getFooterStats()}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={fetchData} disabled={loading} size="sm">
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Vernieuwen
              </Button>
              <Button onClick={handleAction} disabled={processing || selectedIds.size === 0}>
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Bezig...
                  </>
                ) : (
                  labels.actionLabel
                )}
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
