import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdsDashboard } from '@/components/admin/ads/AdsDashboard';
import { PlatformConnections } from '@/components/admin/ads/PlatformConnections';
import { CampaignsList } from '@/components/admin/ads/CampaignsList';

export default function AdsPage() {
  const [activeTab, setActiveTab] = useState('overview');

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
          <AdsDashboard />
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
