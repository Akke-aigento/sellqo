import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  CheckCircle2, 
  Clock, 
  Send, 
  Store,
  ExternalLink,
} from 'lucide-react';
import { useShopifyRequests } from '@/hooks/useShopifyRequests';

interface ShopifyRequestConnectionProps {
  onSuccess?: () => void;
}

export function ShopifyRequestConnection({ onSuccess }: ShopifyRequestConnectionProps) {
  const [storeName, setStoreName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  
  const { createRequest, pendingRequests, approvedRequests } = useShopifyRequests();

  const validateStoreName = (name: string) => {
    // Only alphanumeric and hyphens, no spaces
    return /^[a-z0-9-]+$/i.test(name);
  };

  const handleSubmit = async () => {
    if (!storeName.trim()) return;
    
    const normalizedName = storeName.toLowerCase().trim().replace(/\.myshopify\.com$/, '');
    
    if (!validateStoreName(normalizedName)) {
      return;
    }
    
    try {
      await createRequest.mutateAsync({
        store_name: normalizedName,
        notes: notes.trim() || undefined,
      });
      setSubmitted(true);
      onSuccess?.();
    } catch {
      // Error handled by mutation
    }
  };

  // Show existing pending request
  if (pendingRequests.length > 0 || submitted) {
    const request = pendingRequests[0];
    return (
      <div className="space-y-6">
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Verzoek in behandeling</h3>
          <p className="text-muted-foreground">
            We hebben je verzoek ontvangen en nemen binnen 1-2 werkdagen contact op.
          </p>
        </div>

        {request && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Store:</span>
              <span className="font-medium">{request.store_url}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status:</span>
              <Badge variant="secondary">
                {request.status === 'pending' ? 'In afwachting' : 'In behandeling'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Ingediend:</span>
              <span className="text-sm">
                {new Date(request.requested_at).toLocaleDateString('nl-NL')}
              </span>
            </div>
          </div>
        )}

        <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900">
          <CheckCircle2 className="w-4 h-4 text-blue-600" />
          <AlertTitle className="text-blue-900 dark:text-blue-100">Wat gebeurt er nu?</AlertTitle>
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            <ol className="list-decimal list-inside space-y-1 mt-2 text-sm">
              <li>Wij maken een app aan in jouw Shopify winkel</li>
              <li>Je ontvangt een email met een activatie link</li>
              <li>Klik op de link om de koppeling te voltooien</li>
            </ol>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Show approved request with activation
  if (approvedRequests.length > 0) {
    const request = approvedRequests[0];
    return (
      <div className="space-y-6">
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Koppeling klaar om te activeren!</h3>
          <p className="text-muted-foreground">
            Je Shopify koppeling voor {request.store_url} is goedgekeurd.
          </p>
        </div>

        {request.install_link && (
          <Button 
            className="w-full bg-[#96bf48] hover:bg-[#7ea83d]" 
            size="lg"
            asChild
          >
            <a href={request.install_link} target="_blank" rel="noopener noreferrer">
              <Store className="w-4 h-4 mr-2" />
              Activeer Nu
              <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </Button>
        )}

        {request.admin_notes && (
          <Alert>
            <AlertDescription>{request.admin_notes}</AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  const normalizedName = storeName.toLowerCase().trim().replace(/\.myshopify\.com$/, '');
  const isValid = normalizedName && validateStoreName(normalizedName);

  return (
    <div className="space-y-6">
      <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900">
        <Clock className="w-4 h-4 text-blue-600" />
        <AlertTitle className="text-blue-900 dark:text-blue-100">Managed Setup</AlertTitle>
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          Wij regelen de technische koppeling voor je. Je krijgt binnen 1-2 werkdagen 
          een email met een simpele activatie link.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <div>
          <Label htmlFor="store-name">Je Shopify winkel naam</Label>
          <div className="flex gap-2 mt-1">
            <Input
              id="store-name"
              type="text"
              placeholder="mijn-winkel"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              className="flex-1"
            />
            <span className="flex items-center text-muted-foreground text-sm px-3 bg-muted rounded-md whitespace-nowrap">
              .myshopify.com
            </span>
          </div>
          {storeName && !isValid && (
            <p className="text-xs text-destructive mt-1">
              Alleen letters, cijfers en streepjes toegestaan
            </p>
          )}
          {isValid && (
            <p className="text-xs text-muted-foreground mt-1">
              Volledige URL: <span className="font-medium">{normalizedName}.myshopify.com</span>
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="notes">Opmerkingen (optioneel)</Label>
          <Textarea
            id="notes"
            placeholder="Bijv. specifieke wensen, contact persoon, etc."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1"
          />
        </div>
      </div>

      <Button 
        onClick={handleSubmit} 
        disabled={!isValid || createRequest.isPending}
        className="w-full"
      >
        {createRequest.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Verzoek indienen...
          </>
        ) : (
          <>
            <Send className="w-4 h-4 mr-2" />
            Dien Koppelverzoek In
          </>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        Na goedkeuring ontvang je een email met verdere instructies.
        Je hoeft zelf geen technische stappen te ondernemen.
      </p>
    </div>
  );
}
