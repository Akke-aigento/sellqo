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
import { Store, Clock, Zap, Upload } from 'lucide-react';
import { ShopifyRequestConnection } from './shopify/ShopifyRequestConnection';
import { ShopifyInstantConnect } from './shopify/ShopifyInstantConnect';
import { ShopifyManualImport } from './shopify/ShopifyManualImport';

interface ShopifyConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type ConnectionMethod = 'request' | 'instant' | 'import';

export function ShopifyConnectDialog({
  open,
  onOpenChange,
  onSuccess,
}: ShopifyConnectDialogProps) {
  const [activeTab, setActiveTab] = useState<ConnectionMethod>('instant');

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
          <TabsList className="grid grid-cols-3 w-full h-auto p-1">
            <TabsTrigger 
              value="instant" 
              className="flex flex-col items-center gap-1 py-3 data-[state=active]:bg-green-50 dark:data-[state=active]:bg-green-950/30"
            >
              <Zap className="w-5 h-5" />
              <span className="text-xs font-medium">Direct</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-green-100 text-green-700">
                Nu
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
            <TabsContent value="request" className="m-0">
              <ShopifyRequestConnection onSuccess={handleSuccess} />
            </TabsContent>

            <TabsContent value="instant" className="m-0">
              <ShopifyInstantConnect onSuccess={handleSuccess} />
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
