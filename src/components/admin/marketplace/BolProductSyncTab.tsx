import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import {
  Loader2, Package, Search, CheckCircle, Link2, RefreshCw,
  ChevronDown, ChevronRight, Settings2, Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTenant } from '@/hooks/useTenant';
import { SyncDirectionSelector } from './SyncDirectionSelector';
import { SyncFrequencySelector } from './SyncFrequencySelector';
import { ConflictStrategySelector } from './ConflictStrategySelector';
import type { SyncDirection, ConflictStrategy, SyncFrequency, SupportedDirections } from '@/types/syncRules';

// --- Types ---
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

const BOL_CAPABILITIES: SupportedDirections = {
  import: true,
  export: true,
  bidirectional: true,
};

interface BolProductSyncTabProps {
  connectionId: string;
  platformName: string;
  onSyncNow?: () => void;
  syncing?: boolean;
}

export function BolProductSyncTab({ connectionId, platformName, onSyncNow, syncing }: BolProductSyncTabProps) {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  // Sync settings state
  const [direction, setDirection] = useState<SyncDirection>('import');
  const [conflictStrategy, setConflictStrategy] = useState<ConflictStrategy>('sellqo_wins');
  const [syncFrequency, setSyncFrequency] = useState<SyncFrequency>('15min');
  const [autoSync, setAutoSync] = useState(true);

  // Product state
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [offers, setOffers] = useState<BolOffer[]>([]);
  const [sellqoProducts, setSellqoProducts] = useState<SellQoProduct[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [fetched, setFetched] = useState(false);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  // Linked products from DB
  const { data: linkedProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: ['marketplace-products', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, name, images, bol_ean, stock, sync_inventory, last_inventory_sync, marketplace_mappings')
        .eq('tenant_id', currentTenant.id)
        .eq('sync_inventory', true)
        .not('bol_ean', 'is', null)
        .order('name')
        .limit(50);
      if (error) { console.error('Error:', error); return []; }
      return data || [];
    },
    enabled: !!currentTenant?.id,
  });

  // --- Direction change resets fetched data ---
  const handleDirectionChange = (newDirection: SyncDirection) => {
    setDirection(newDirection);
    setOffers([]);
    setSellqoProducts([]);
    setSelectedIds(new Set());
    setSearchQuery('');
    setFetched(false);
  };

  // --- Fetch products ---
  const fetchBolOffers = async () => {
    const { data, error } = await supabase.functions.invoke('sync-bol-products', {
      body: { connectionId, mode: 'list' },
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Ophalen mislukt');
    setOffers(data.offers || []);
    return data.totalOffers || 0;
  };

  const fetchSellqoProducts = async () => {
    const { data, error } = await supabase.functions.invoke('sync-bol-products', {
      body: { connectionId, mode: 'list-sellqo' },
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Ophalen mislukt');
    setSellqoProducts(data.products || []);
    return data.totalProducts || 0;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      if (direction === 'import') {
        const count = await fetchBolOffers();
        toast.success(`${count} producten opgehaald van Bol.com`);
      } else if (direction === 'export') {
        const count = await fetchSellqoProducts();
        toast.success(`${count} producten opgehaald`);
      } else {
        await Promise.all([fetchBolOffers(), fetchSellqoProducts()]);
        toast.success('Producten opgehaald');
      }
      setFetched(true);
    } catch (err) {
      toast.error('Ophalen mislukt: ' + (err instanceof Error ? err.message : 'Onbekende fout'));
    } finally {
      setLoading(false);
    }
  };

  // --- Import / Export ---
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
      queryClient.invalidateQueries({ queryKey: ['marketplace-products', currentTenant?.id] });
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
      queryClient.invalidateQueries({ queryKey: ['marketplace-products', currentTenant?.id] });
    } catch (err) {
      toast.error('Export mislukt: ' + (err instanceof Error ? err.message : 'Onbekende fout'));
    } finally {
      setProcessing(false);
    }
  };

  const handleAction = () => {
    if (direction === 'export') handleExport();
    else handleImport();
  };

  // --- Sync toggles ---
  const handleSyncToggle = async (productId: string, enabled: boolean) => {
    try {
      const { data, error } = await supabase.functions.invoke('sync-bol-products', {
        body: { connectionId, mode: 'sync-settings', productSyncSettings: [{ productId, syncEnabled: enabled }] },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Opslaan mislukt');
      setSellqoProducts(prev => prev.map(p => p.productId === productId ? { ...p, syncEnabled: enabled } : p));
      setOffers(prev => prev.map(o => o.existingProductId === productId ? { ...o, syncEnabled: enabled } : o));
      toast.success(enabled ? 'Sync ingeschakeld' : 'Sync uitgeschakeld');
    } catch (err) {
      toast.error('Opslaan mislukt: ' + (err instanceof Error ? err.message : 'Onbekende fout'));
    }
  };

  const handleSyncFieldToggle = async (productId: string, field: keyof SyncFields, enabled: boolean) => {
    const product = sellqoProducts.find(p => p.productId === productId);
    const offer = offers.find(o => o.existingProductId === productId);
    const currentFields = product?.syncFields || offer?.syncFields || { ...DEFAULT_SYNC_FIELDS };
    const updatedFields = { ...currentFields, [field]: enabled };

    try {
      const { data, error } = await supabase.functions.invoke('sync-bol-products', {
        body: { connectionId, mode: 'sync-settings', productSyncSettings: [{ productId, syncFields: updatedFields }] },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Opslaan mislukt');
      setSellqoProducts(prev => prev.map(p => p.productId === productId ? { ...p, syncFields: updatedFields } : p));
      setOffers(prev => prev.map(o => o.existingProductId === productId ? { ...o, syncFields: updatedFields } : o));
    } catch (err) {
      toast.error('Opslaan mislukt: ' + (err instanceof Error ? err.message : 'Onbekende fout'));
    }
  };

  // --- Selection helpers ---
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredOffers = offers.filter(o => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!o.title.toLowerCase().includes(q) && !o.ean.includes(q)) return false;
    }
    if (statusFilter === 'linked') return o.alreadyLinked;
    if (statusFilter === 'new') return !o.alreadyLinked;
    return true;
  });

  const filteredProducts = sellqoProducts.filter(p => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.ean.includes(q)) return false;
    }
    if (statusFilter === 'linked') return p.alreadyOnBol;
    if (statusFilter === 'new') return !p.alreadyOnBol;
    return true;
  });

  // --- Render sync field toggles row ---
  const renderSyncFieldsRow = (productId: string, syncFields: SyncFields | undefined, colSpan: number) => {
    const fields = syncFields || { ...DEFAULT_SYNC_FIELDS };
    return (
      <TableRow className="bg-muted/30 border-b">
        <TableCell colSpan={colSpan}>
          <div className="py-2 px-4">
            <div className="flex items-center gap-2 mb-3">
              <Settings2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Sync velden</span>
            </div>
            <div className="flex flex-wrap gap-4">
              {(Object.keys(SYNC_FIELD_LABELS) as Array<keyof SyncFields>).map((field) => (
                <div key={field} className="flex items-center gap-2">
                  <Switch
                    id={`${productId}-${field}`}
                    checked={fields[field]}
                    onCheckedChange={(checked) => handleSyncFieldToggle(productId, field, checked)}
                  />
                  <Label htmlFor={`${productId}-${field}`} className="text-sm cursor-pointer">
                    {SYNC_FIELD_LABELS[field].label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  // --- Render combined product table ---
  const renderProductTable = () => {
    if (direction === 'import' || direction === 'bidirectional') {
      return renderImportTable();
    }
    return renderExportTable();
  };

  const renderImportTable = () => {
    const unlinked = filteredOffers.filter(o => !o.alreadyLinked);
    const allSelected = unlinked.length > 0 && unlinked.every(o => selectedIds.has(o.offerId));
    const colSpan = 8;

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                onCheckedChange={() => {
                  if (allSelected) setSelectedIds(new Set());
                  else setSelectedIds(new Set(unlinked.map(o => o.offerId)));
                }}
              />
            </TableHead>
            <TableHead>Product</TableHead>
            <TableHead>EAN</TableHead>
            <TableHead className="text-right">Prijs</TableHead>
            <TableHead className="text-right">Voorraad</TableHead>
            <TableHead>Fulfillment</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Sync</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredOffers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colSpan} className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'Geen producten gevonden' : 'Geen aanbiedingen gevonden'}
              </TableCell>
            </TableRow>
          ) : (
            filteredOffers.map(offer => {
              const isExpanded = expandedProductId === (offer.existingProductId || offer.offerId);
              return (
                <span key={offer.offerId}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => {
                      if (offer.alreadyLinked && offer.existingProductId) {
                        setExpandedProductId(isExpanded ? null : offer.existingProductId);
                      } else {
                        toggleSelect(offer.offerId);
                      }
                    }}
                  >
                    <TableCell>
                      {offer.alreadyLinked ? (
                        isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Checkbox
                          checked={selectedIds.has(offer.offerId)}
                          onCheckedChange={() => toggleSelect(offer.offerId)}
                          onClick={e => e.stopPropagation()}
                        />
                      )}
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
                      ) : (
                        <span className="text-xs text-muted-foreground">Nieuw</span>
                      )}
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      {offer.alreadyLinked && offer.existingProductId ? (
                        <Switch
                          checked={offer.syncEnabled ?? false}
                          onCheckedChange={(checked) => handleSyncToggle(offer.existingProductId!, checked)}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                  {isExpanded && offer.existingProductId && renderSyncFieldsRow(offer.existingProductId, offer.syncFields, colSpan)}
                </span>
              );
            })
          )}
        </TableBody>
      </Table>
    );
  };

  const renderExportTable = () => {
    const notOnBol = filteredProducts.filter(p => !p.alreadyOnBol);
    const allSelected = notOnBol.length > 0 && notOnBol.every(p => selectedIds.has(p.productId));
    const colSpan = 7;

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                onCheckedChange={() => {
                  if (allSelected) setSelectedIds(new Set());
                  else setSelectedIds(new Set(notOnBol.map(p => p.productId)));
                }}
              />
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
              <TableCell colSpan={colSpan} className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'Geen producten gevonden' : 'Geen producten in SellQo'}
              </TableCell>
            </TableRow>
          ) : (
            filteredProducts.map(product => {
              const isExpanded = expandedProductId === product.productId;
              return (
                <span key={product.productId}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => {
                      if (product.alreadyOnBol) {
                        setExpandedProductId(isExpanded ? null : product.productId);
                      } else {
                        toggleSelect(product.productId);
                      }
                    }}
                  >
                    <TableCell>
                      {product.alreadyOnBol ? (
                        isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Checkbox
                          checked={selectedIds.has(product.productId)}
                          onCheckedChange={() => toggleSelect(product.productId)}
                          onClick={e => e.stopPropagation()}
                        />
                      )}
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
                  {isExpanded && product.alreadyOnBol && renderSyncFieldsRow(product.productId, product.syncFields, colSpan)}
                </span>
              );
            })
          )}
        </TableBody>
      </Table>
    );
  };

  // --- Linked products (always visible) ---
  const renderLinkedProductsSection = () => {
    if (productsLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (linkedProducts.length === 0) return null;

    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Gekoppelde Producten</CardTitle>
              <CardDescription>{linkedProducts.length} producten actief gesynchroniseerd</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={onSyncNow} disabled={syncing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              Sync Alles
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>EAN</TableHead>
                <TableHead className="text-right">Voorraad</TableHead>
                <TableHead>Sync Status</TableHead>
                <TableHead>Laatste Sync</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linkedProducts.map(product => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <img
                        src={product.images?.[0] || '/placeholder.svg'}
                        alt={product.name}
                        className="w-8 h-8 rounded object-cover"
                      />
                      <span className="font-medium text-sm">{product.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{product.bol_ean}</TableCell>
                  <TableCell className="text-right">
                    <span className={(product.stock || 0) < 5 ? 'text-destructive font-semibold' : ''}>
                      {product.stock || 0}
                    </span>
                  </TableCell>
                  <TableCell>
                    {product.sync_inventory ? (
                      <Badge variant="default" className="flex items-center gap-1 w-fit">
                        <CheckCircle className="w-3 h-3" />
                        Actief
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Gepauzeerd</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {product.last_inventory_sync
                      ? formatDistanceToNow(new Date(product.last_inventory_sync), { addSuffix: true, locale: nl })
                      : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  const actionLabel = direction === 'import'
    ? `Importeer ${selectedIds.size} product${selectedIds.size !== 1 ? 'en' : ''}`
    : direction === 'export'
    ? `Exporteer ${selectedIds.size} product${selectedIds.size !== 1 ? 'en' : ''}`
    : `Synchroniseer ${selectedIds.size} product${selectedIds.size !== 1 ? 'en' : ''}`;

  const fetchLabel = direction === 'import'
    ? 'Bol.com producten ophalen'
    : direction === 'export'
    ? 'SellQo producten ophalen'
    : 'Producten ophalen';

  return (
    <div className="space-y-6">
      {/* Compact sync settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sync Instellingen</CardTitle>
          <CardDescription>Configureer hoe producten worden gesynchroniseerd met {platformName}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <SyncDirectionSelector
              value={direction}
              onChange={handleDirectionChange}
              capabilities={BOL_CAPABILITIES}
            />
            <div className="space-y-4">
              <SyncFrequencySelector
                value={syncFrequency}
                onChange={setSyncFrequency}
              />
              <div className="flex items-center justify-between">
                <Label className="text-sm">Auto-sync</Label>
                <Switch checked={autoSync} onCheckedChange={setAutoSync} />
              </div>
            </div>
          </div>
          {direction === 'bidirectional' && (
            <div className="mt-4 pt-4 border-t">
              <ConflictStrategySelector
                value={conflictStrategy}
                onChange={setConflictStrategy}
                platformName={platformName}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Linked products overview */}
      {renderLinkedProductsSection()}

      {/* Product import/export section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">
                {direction === 'import' ? 'Producten Importeren' : direction === 'export' ? 'Producten Exporteren' : 'Producten Synchroniseren'}
              </CardTitle>
              <CardDescription>
                {direction === 'import'
                  ? `Haal producten op van ${platformName} en importeer ze naar SellQo`
                  : direction === 'export'
                  ? `Exporteer SellQo producten naar ${platformName}`
                  : `Synchroniseer producten in beide richtingen met ${platformName}`}
              </CardDescription>
            </div>
            {fetched && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{selectedIds.size} geselecteerd</Badge>
                <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Vernieuwen
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!fetched ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Package className="w-12 h-12 text-muted-foreground" />
              <p className="text-muted-foreground text-center max-w-md">
                {direction === 'import'
                  ? `Haal je productaanbod op van ${platformName} om te kiezen welke je wilt importeren.`
                  : direction === 'export'
                  ? 'Haal je SellQo producten op om te kiezen welke je wilt exporteren.'
                  : 'Haal producten op van beide bronnen om de synchronisatie in te stellen.'}
              </p>
              <Button onClick={fetchData} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Ophalen...
                  </>
                ) : (
                  fetchLabel
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Search & filter bar */}
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
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="linked">Gekoppeld</SelectItem>
                    <SelectItem value="new">Nieuw</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Product table */}
              {direction === 'bidirectional' ? (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-muted-foreground">{platformName} → SellQo</h4>
                    {renderImportTable()}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-muted-foreground">SellQo → {platformName}</h4>
                    {renderExportTable()}
                  </div>
                </div>
              ) : (
                renderProductTable()
              )}

              {/* Action bar */}
              {selectedIds.size > 0 && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    {direction === 'import'
                      ? `${offers.length} producten op ${platformName} • ${offers.filter(o => o.alreadyLinked).length} al gekoppeld`
                      : `${sellqoProducts.length} producten in SellQo • ${sellqoProducts.filter(p => p.alreadyOnBol).length} al op ${platformName}`}
                  </p>
                  <Button onClick={handleAction} disabled={processing || selectedIds.size === 0}>
                    {processing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Bezig...
                      </>
                    ) : (
                      actionLabel
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
