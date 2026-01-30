import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Clock, 
  CheckCircle2, 
  ExternalLink, 
  Store,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import { useShopifyRequests } from '@/hooks/useShopifyRequests';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';

export function ShopifyRequestStatus() {
  const { requests, isLoading } = useShopifyRequests();

  if (isLoading || requests.length === 0) {
    return null;
  }

  // Get the most recent active request
  const activeRequest = requests.find(r => 
    r.status === 'pending' || r.status === 'in_review' || r.status === 'approved'
  );

  if (!activeRequest) {
    return null;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">In afwachting</Badge>;
      case 'in_review':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">In behandeling</Badge>;
      case 'approved':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Goedgekeurd</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Voltooid</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Afgewezen</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
      case 'in_review':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'approved':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-destructive" />;
      default:
        return <AlertCircle className="w-5 h-5" />;
    }
  };

  return (
    <Alert className={
      activeRequest.status === 'approved' 
        ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900'
        : activeRequest.status === 'rejected'
        ? 'bg-destructive/10 border-destructive/20'
        : 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900'
    }>
      {getStatusIcon(activeRequest.status)}
      <AlertTitle className="flex items-center gap-2">
        <span>Shopify Koppelverzoek</span>
        {getStatusBadge(activeRequest.status)}
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Store className="w-4 h-4" />
          <span className="font-medium">{activeRequest.store_url}</span>
        </div>
        
        <p className="text-sm text-muted-foreground">
          Aangevraagd {formatDistanceToNow(new Date(activeRequest.requested_at), { 
            addSuffix: true, 
            locale: nl 
          })}
        </p>

        {activeRequest.status === 'pending' && (
          <p className="text-sm">
            We nemen binnen 1-2 werkdagen contact op met verdere instructies.
          </p>
        )}

        {activeRequest.status === 'in_review' && (
          <p className="text-sm">
            Je verzoek wordt momenteel beoordeeld. Je ontvangt binnenkort bericht.
          </p>
        )}

        {activeRequest.status === 'approved' && activeRequest.install_link && (
          <Button 
            className="mt-2 bg-[#96bf48] hover:bg-[#7ea83d]" 
            size="sm"
            asChild
          >
            <a href={activeRequest.install_link} target="_blank" rel="noopener noreferrer">
              <Store className="w-4 h-4 mr-2" />
              Activeer Koppeling
              <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </Button>
        )}

        {activeRequest.status === 'rejected' && activeRequest.admin_notes && (
          <p className="text-sm text-destructive">
            {activeRequest.admin_notes}
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
