import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdsDashboard } from '@/components/admin/ads/AdsDashboard';
import { PlatformConnections } from '@/components/admin/ads/PlatformConnections';
import { CampaignsList } from '@/components/admin/ads/CampaignsList';

export default function AdsPage() {
  const [activeTab, setActiveTab] = useState('overview');

  const handleNewCampaignFromDashboard = () => {
    setActiveTab('campaigns');
    // CampaignsList will show the wizard when mounted fresh after tab switch
    // We use a small delay + key trick to trigger wizard
    setTimeout(() => {
      const btn = document.querySelector('[data-new-campaign]') as HTMLButtonElement;
      btn?.click();
    }, 100);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Advertenties</h1>
        <p className="text-muted-foreground">
          Beheer je betaalde advertenties op Bol.com, Meta, Google en Amazon
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overzicht</TabsTrigger>
          <TabsTrigger value="campaigns">Campagnes</TabsTrigger>
          <TabsTrigger value="platforms">Platforms</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <AdsDashboard onNewCampaign={() => setActiveTab('campaigns')} />
        </TabsContent>

        <TabsContent value="campaigns" className="mt-6">
          <CampaignsList />
        </TabsContent>

        <TabsContent value="platforms" className="mt-6">
          <PlatformConnections />
        </TabsContent>
      </Tabs>
    </div>
  );
}
