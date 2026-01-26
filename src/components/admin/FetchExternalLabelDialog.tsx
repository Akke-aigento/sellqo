import { useState } from 'react';
import { Download, Loader2, AlertCircle, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useShippingIntegrations } from '@/hooks/useShippingIntegrations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FetchExternalLabelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  onLabelFetched?: () => void;
}

type SearchType = 'order_number' | 'tracking_number';
type Provider = 'sendcloud' | 'myparcel';

export function FetchExternalLabelDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  onLabelFetched,
}: FetchExternalLabelDialogProps) {
  const { integrations } = useShippingIntegrations();
  const [provider, setProvider] = useState<Provider>('sendcloud');
  const [searchType, setSearchType] = useState<SearchType>('order_number');
  const [searchValue, setSearchValue] = useState(orderNumber);
  const [isFetching, setIsFetching] = useState(false);

  // Get available providers that are active
  const activeProviders = integrations.filter(
    i => i.is_active && (i.provider === 'sendcloud' || i.provider === 'myparcel')
  );

  const handleFetch = async () => {
    if (!searchValue.trim()) {
      toast.error('Vul een zoekwaarde in');
      return;
    }

    setIsFetching(true);

    try {
      const { data, error } = await supabase.functions.invoke('fetch-external-label', {
        body: {
          order_id: orderId,
          provider,
          search_type: searchType,
          search_value: searchValue.trim(),
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Label ophalen mislukt');

      toast.success('Label opgehaald', {
        description: `Label van ${provider === 'sendcloud' ? 'Sendcloud' : 'MyParcel'} is gekoppeld aan de order.`,
      });

      onLabelFetched?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error fetching external label:', error);
      toast.error('Label ophalen mislukt', {
        description: (error as Error).message,
      });
    } finally {
      setIsFetching(false);
    }
  };

  const hasActiveProviders = activeProviders.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Label ophalen van externe provider
          </DialogTitle>
          <DialogDescription>
            Haal een bestaand label op dat al is aangemaakt in Sendcloud of MyParcel
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!hasActiveProviders ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Geen actieve Sendcloud of MyParcel integratie gevonden. 
                Configureer eerst een verzendintegratie via Instellingen → Verzending.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Provider Selection */}
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select 
                  value={provider} 
                  onValueChange={(value: Provider) => setProvider(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activeProviders.some(i => i.provider === 'sendcloud') && (
                      <SelectItem value="sendcloud">Sendcloud</SelectItem>
                    )}
                    {activeProviders.some(i => i.provider === 'myparcel') && (
                      <SelectItem value="myparcel">MyParcel</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Search Type */}
              <div className="space-y-2">
                <Label>Zoeken op</Label>
                <RadioGroup
                  value={searchType}
                  onValueChange={(value: SearchType) => setSearchType(value)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="order_number" id="search-order" />
                    <Label htmlFor="search-order" className="cursor-pointer">
                      Ordernummer
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="tracking_number" id="search-tracking" />
                    <Label htmlFor="search-tracking" className="cursor-pointer">
                      Trackingnummer
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Search Value */}
              <div className="space-y-2">
                <Label>
                  {searchType === 'order_number' ? 'Ordernummer' : 'Trackingnummer'}
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    placeholder={
                      searchType === 'order_number' 
                        ? 'Bijv. #0042' 
                        : 'Bijv. 3STEST123456'
                    }
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Warning */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Dit haalt een bestaand label op dat al is aangemaakt in {provider === 'sendcloud' ? 'Sendcloud' : 'MyParcel'}. 
                  Het label wordt niet opnieuw gegenereerd.
                </AlertDescription>
              </Alert>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Annuleren
          </Button>
          <Button
            onClick={handleFetch}
            disabled={isFetching || !hasActiveProviders || !searchValue.trim()}
          >
            {isFetching ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Label Ophalen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
