import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bot, ArrowLeft, Library } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AICreditsBadge } from '@/components/admin/marketing/AICreditsBadge';
import { AIInsightsCard } from '@/components/admin/marketing/AIInsightsCard';
import { AIContentLibrary } from '@/components/admin/marketing/AIContentLibrary';
import { CreditPurchaseDialog } from '@/components/admin/marketing/CreditPurchaseDialog';
import { InlinePromoWizard } from '@/components/admin/marketing/InlinePromoWizard';
import { AdvancedToolsGrid } from '@/components/admin/marketing/AdvancedToolsGrid';
import { RecentContentStrip } from '@/components/admin/marketing/RecentContentStrip';
import { FeatureGate } from '@/components/FeatureGate';
import { useAIMarketing } from '@/hooks/useAIMarketing';
import { useAICredits } from '@/hooks/useAICredits';
import { toast } from 'sonner';

export default function AIMarketingHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('create');
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  
  const { registerCreditCallback } = useAIMarketing();
  const { refetch: refetchCredits } = useAICredits();

  // Register credit callback to open purchase dialog on credit errors
  useEffect(() => {
    registerCreditCallback(() => setPurchaseDialogOpen(true));
  }, [registerCreditCallback]);

  // Handle URL params for tab navigation and purchase dialog
  useEffect(() => {
    const tab = searchParams.get('tab');
    const purchaseStatus = searchParams.get('purchase');
    const creditsAdded = searchParams.get('credits');
    
    if (tab === 'library') {
      setActiveTab('library');
    }
    
    if (purchaseStatus === 'success' && creditsAdded) {
      toast.success(`${creditsAdded} AI credits toegevoegd!`, {
        description: 'Je credits zijn nu beschikbaar.'
      });
      refetchCredits();
      // Clean up URL params
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('purchase');
      newParams.delete('credits');
      setSearchParams(newParams, { replace: true });
    } else if (purchaseStatus === 'cancelled') {
      toast.info('Aankoop geannuleerd');
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('purchase');
      setSearchParams(newParams, { replace: true });
    } else if (purchaseStatus === 'open') {
      setPurchaseDialogOpen(true);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('purchase');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, refetchCredits, setSearchParams]);

  return (
    <FeatureGate feature="ai_marketing">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin/marketing">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                Sellqo AI
              </h1>
              <p className="text-muted-foreground">
                Genereer marketing content met één klik
              </p>
            </div>
          </div>
          <AICreditsBadge 
            variant="full" 
            onUpgrade={() => setPurchaseDialogOpen(true)} 
          />
        </div>

        {/* Minimal Tabs: Create | Library */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full max-w-xs">
            <TabsTrigger value="create" className="flex-1">
              Creëren
            </TabsTrigger>
            <TabsTrigger value="library" className="flex-1 gap-2">
              <Library className="h-4 w-4" />
              Bibliotheek
            </TabsTrigger>
          </TabsList>

          {/* Create Tab - Main Content */}
          <TabsContent value="create" className="space-y-8">
            {/* Hero: Inline Promo Wizard */}
            <InlinePromoWizard onNeedCredits={() => setPurchaseDialogOpen(true)} />

            {/* Two Column Layout: Insights + Advanced Tools */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left: AI Insights */}
              <AIInsightsCard />

              {/* Right: Recent Content */}
              <RecentContentStrip />
            </div>

            {/* Advanced Tools - Collapsible */}
            <AdvancedToolsGrid />
          </TabsContent>

          {/* Library Tab */}
          <TabsContent value="library">
            <AIContentLibrary />
          </TabsContent>
        </Tabs>

        {/* Credit Purchase Dialog */}
        <CreditPurchaseDialog
          open={purchaseDialogOpen}
          onOpenChange={setPurchaseDialogOpen}
        />
      </div>
    </FeatureGate>
  );
}
