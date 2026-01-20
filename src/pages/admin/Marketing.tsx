import { useState } from 'react';
import { Plus, Mail, Users, FileText, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MarketingStatsCards } from '@/components/admin/marketing/MarketingStatsCards';
import { CampaignCard } from '@/components/admin/marketing/CampaignCard';
import { CampaignDialog } from '@/components/admin/marketing/CampaignDialog';
import { TemplateDialog } from '@/components/admin/marketing/TemplateDialog';
import { SegmentDialog } from '@/components/admin/marketing/SegmentDialog';
import { useMarketingStats, useEmailCampaigns } from '@/hooks/useEmailCampaigns';
import { useEmailTemplates } from '@/hooks/useEmailTemplates';
import { useCustomerSegments } from '@/hooks/useCustomerSegments';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

export default function MarketingPage() {
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [segmentDialogOpen, setSegmentDialogOpen] = useState(false);

  const { data: stats, isLoading: statsLoading } = useMarketingStats();
  const { campaigns, isLoading: campaignsLoading, createCampaign, deleteCampaign, sendCampaign } = useEmailCampaigns();
  const { templates, isLoading: templatesLoading, createTemplate, deleteTemplate } = useEmailTemplates();
  const { segments, isLoading: segmentsLoading, createSegment, deleteSegment } = useCustomerSegments();

  const defaultStats = {
    totalCampaigns: 0, totalSent: 0, totalOpened: 0, totalClicked: 0,
    avgOpenRate: 0, avgClickRate: 0, subscriberCount: 0, subscriberGrowth: 0, unsubscribeCount: 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="h-6 w-6" />
            Marketing
          </h1>
          <p className="text-muted-foreground">
            Email campagnes, templates en klantsegmenten beheren
          </p>
        </div>
        <Button onClick={() => setCampaignDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nieuwe campagne
        </Button>
      </div>

      <MarketingStatsCards stats={stats || defaultStats} isLoading={statsLoading} />

      <Tabs defaultValue="campaigns" className="space-y-4">
        <TabsList>
          <TabsTrigger value="campaigns" className="gap-2">
            <Mail className="h-4 w-4" />
            Campagnes
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="segments" className="gap-2">
            <Users className="h-4 w-4" />
            Segmenten
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-4">
          {campaignsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Laden...</div>
          ) : campaigns.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">Geen campagnes</h3>
                <p className="text-muted-foreground mb-4">Maak je eerste email campagne aan</p>
                <Button onClick={() => setCampaignDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nieuwe campagne
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {campaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  onDelete={(id) => deleteCampaign.mutate(id)}
                  onSend={(id) => sendCampaign.mutate(id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setTemplateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nieuwe template
            </Button>
          </div>
          {templatesLoading ? (
            <div className="text-center py-8 text-muted-foreground">Laden...</div>
          ) : templates.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">Geen templates</h3>
                <p className="text-muted-foreground mb-4">Maak herbruikbare email templates</p>
                <Button onClick={() => setTemplateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nieuwe template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => (
                <Card key={template.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <CardDescription>{template.subject}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="secondary">{template.category}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="segments" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setSegmentDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nieuw segment
            </Button>
          </div>
          {segmentsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Laden...</div>
          ) : segments.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">Geen segmenten</h3>
                <p className="text-muted-foreground mb-4">Maak klantsegmenten voor gerichte campagnes</p>
                <Button onClick={() => setSegmentDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nieuw segment
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {segments.map((segment) => (
                <Card key={segment.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{segment.name}</CardTitle>
                    <CardDescription>{segment.description || 'Geen beschrijving'}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{segment.member_count}</div>
                    <p className="text-xs text-muted-foreground">klanten</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CampaignDialog
        open={campaignDialogOpen}
        onOpenChange={setCampaignDialogOpen}
        onSave={(data) => {
          createCampaign.mutate(data as any, { onSuccess: () => setCampaignDialogOpen(false) });
        }}
        isLoading={createCampaign.isPending}
      />

      <TemplateDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        onSave={(data) => {
          createTemplate.mutate(data as any, { onSuccess: () => setTemplateDialogOpen(false) });
        }}
        isLoading={createTemplate.isPending}
      />

      <SegmentDialog
        open={segmentDialogOpen}
        onOpenChange={setSegmentDialogOpen}
        onSave={(data) => {
          createSegment.mutate(data as any, { onSuccess: () => setSegmentDialogOpen(false) });
        }}
        isLoading={createSegment.isPending}
      />
    </div>
  );
}
