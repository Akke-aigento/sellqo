import { useState } from 'react';
import { Loader2, Package, Search, CheckCircle, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
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
}

interface BolProductImportDialogProps {
  connectionId: string;
  onImportComplete?: () => void;
}

export function BolProductImportDialog({ connectionId, onImportComplete }: BolProductImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [offers, setOffers] = useState<BolOffer[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [fetched, setFetched] = useState(false);

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-bol-products', {
        body: { connectionId, mode: 'list' },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Ophalen mislukt');

      setOffers(data.offers || []);
      setFetched(true);
      toast.success(`${data.totalOffers} producten opgehaald van Bol.com`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Onbekende fout';
      toast.error('Ophalen mislukt: ' + msg);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) {
      toast.warning('Selecteer minimaal één product');
      return;
    }

    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-bol-products', {
        body: {
          connectionId,
          mode: 'import',
          selectedOfferIds: Array.from(selectedIds),
        },
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
      const msg = err instanceof Error ? err.message : 'Onbekende fout';
      toast.error('Import mislukt: ' + msg);
    } finally {
      setImporting(false);
    }
  };

  const toggleSelect = (offerId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(offerId)) next.delete(offerId);
      else next.add(offerId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const unlinked = filteredOffers.filter(o => !o.alreadyLinked);
    if (selectedIds.size === unlinked.length && unlinked.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unlinked.map(o => o.offerId)));
    }
  };

  const filteredOffers = offers.filter(o => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return o.title.toLowerCase().includes(q) || o.ean.includes(q);
  });

  const unlinkedFiltered = filteredOffers.filter(o => !o.alreadyLinked);
  const allSelected = unlinkedFiltered.length > 0 && unlinkedFiltered.every(o => selectedIds.has(o.offerId));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Package className="w-4 h-4 mr-2" />
          Importeer Producten
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Producten importeren van Bol.com</DialogTitle>
          <DialogDescription>
            Selecteer welke producten je wilt importeren of koppelen aan bestaande SellQo producten.
          </DialogDescription>
        </DialogHeader>

        {!fetched ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Package className="w-12 h-12 text-muted-foreground" />
            <p className="text-muted-foreground text-center">
              Haal je productaanbod op van Bol.com om te kiezen welke je wilt importeren.
            </p>
            <Button onClick={fetchOffers} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Ophalen...
                </>
              ) : (
                'Producten ophalen'
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
              <Badge variant="secondary">
                {selectedIds.size} geselecteerd
              </Badge>
            </div>

            <ScrollArea className="flex-1 min-h-0 max-h-[calc(85vh-16rem)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>EAN</TableHead>
                    <TableHead className="text-right">Prijs</TableHead>
                    <TableHead className="text-right">Voorraad</TableHead>
                    <TableHead>Fulfillment</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOffers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                        <TableCell className="font-medium max-w-[250px] truncate">
                          {offer.title}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {offer.ean}
                        </TableCell>
                        <TableCell className="text-right">
                          €{offer.price.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {offer.stock}
                        </TableCell>
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
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </>
        )}

        {fetched && (
          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {offers.length} producten op Bol.com • {offers.filter(o => o.alreadyLinked).length} al gekoppeld
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={fetchOffers} disabled={loading}>
                <Loader2 className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : 'hidden'}`} />
                Vernieuwen
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing || selectedIds.size === 0}
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importeren...
                  </>
                ) : (
                  `Importeer ${selectedIds.size} product${selectedIds.size !== 1 ? 'en' : ''}`
                )}
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
