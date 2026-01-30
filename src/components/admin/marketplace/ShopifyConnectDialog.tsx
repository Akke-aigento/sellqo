import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Store, Clock, Key, Upload } from 'lucide-react';
import { ShopifyRequestConnection } from './shopify/ShopifyRequestConnection';
import { ShopifyInstantConnect } from './shopify/ShopifyInstantConnect';
import { ShopifyManualImport } from './shopify/ShopifyManualImport';
import { ShopifyOAuthConnect } from './ShopifyOAuthConnect';

interface ShopifyConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type ConnectionMethod = 'oauth' | 'token' | 'request' | 'import';

export function ShopifyConnectDialog({
  open,
  onOpenChange,
  onSuccess,
}: ShopifyConnectDialogProps) {
  const [activeTab, setActiveTab] = useState<ConnectionMethod>('oauth');

  const handleSuccess = () => {
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#96bf48] rounded-xl flex items-center justify-center">
              <Store className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl">Verbind met Shopify</DialogTitle>
              <DialogDescription>
                Kies hoe je je Shopify winkel wilt koppelen
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ConnectionMethod)} className="mt-4">
          <TabsList className="grid grid-cols-4 w-full h-auto p-1">
            <TabsTrigger 
              value="oauth" 
              className="flex flex-col items-center gap-1 py-3 data-[state=active]:bg-green-50 dark:data-[state=active]:bg-green-950/30"
            >
              <Store className="w-5 h-5" />
              <span className="text-xs font-medium">OAuth</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-green-100 text-green-700">
                Aanbevolen
              </Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="token" 
              className="flex flex-col items-center gap-1 py-3 data-[state=active]:bg-slate-50 dark:data-[state=active]:bg-slate-950/30"
            >
              <Key className="w-5 h-5" />
              <span className="text-xs font-medium">Token</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-slate-100 text-slate-700">
                Advanced
              </Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="request" 
              className="flex flex-col items-center gap-1 py-3 data-[state=active]:bg-blue-50 dark:data-[state=active]:bg-blue-950/30"
            >
              <Clock className="w-5 h-5" />
              <span className="text-xs font-medium">Aanvraag</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-blue-100 text-blue-700">
                1-2 dagen
              </Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="import" 
              className="flex flex-col items-center gap-1 py-3 data-[state=active]:bg-orange-50 dark:data-[state=active]:bg-orange-950/30"
            >
              <Upload className="w-5 h-5" />
              <span className="text-xs font-medium">Import</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-orange-100 text-orange-700">
                Eenmalig
              </Badge>
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="oauth" className="m-0">
              <ShopifyOAuthConnect onSuccess={handleSuccess} onCancel={() => onOpenChange(false)} />
            </TabsContent>

            <TabsContent value="token" className="m-0">
              <ShopifyInstantConnect onSuccess={handleSuccess} />
            </TabsContent>

            <TabsContent value="request" className="m-0">
              <ShopifyRequestConnection onSuccess={handleSuccess} />
            </TabsContent>

            <TabsContent value="import" className="m-0">
              <ShopifyManualImport />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
