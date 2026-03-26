import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Mail, Users, FileText, Megaphone, TrendingUp, Zap, Bot, Sparkles, X, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MarketingStatsCards } from '@/components/admin/marketing/MarketingStatsCards';
import { CampaignCard } from '@/components/admin/marketing/CampaignCard';
import { CampaignDialog } from '@/components/admin/marketing/CampaignDialog';
import { TemplateDialog } from '@/components/admin/marketing/TemplateDialog';
import { SegmentDialog } from '@/components/admin/marketing/SegmentDialog';
import { RealtimeActivityFeed } from '@/components/admin/marketing/RealtimeActivityFeed';
import { MarketingOverviewChart } from '@/components/admin/marketing/MarketingOverviewChart';
import { useMarketingStats, useEmailCampaigns } from '@/hooks/useEmailCampaigns';
import { useEmailTemplates } from '@/hooks/useEmailTemplates';
import { useCustomerSegments } from '@/hooks/useCustomerSegments';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function MarketingPage() {
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [segmentDialogOpen, setSegmentDialogOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<any>(null);
  const [chartPeriod, setChartPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  const { data: stats, isLoading: statsLoading } = useMarketingStats();
  const { campaigns, isLoading: campaignsLoading, createCampaign, deleteCampaign, sendCampaign } = useEmailCampaigns();
  const { templates, isLoading: templatesLoading, createTemplate, deleteTemplate } = useEmailTemplates();
  const { segments, isLoading: segmentsLoading, createSegment, updateSegment, deleteSegment } = useCustomerSegments();

  const defaultStats = {
    totalCampaigns: 0, totalSent: 0, totalOpened: 0, totalClicked: 0,
    avgOpenRate: 0, avgClickRate: 0, subscriberCount: 0, subscriberGrowth: 0, unsubscribeCount: 0,
  };

  const recentCampaigns = campaigns.slice(0, 5);
  const draftCampaigns = campaigns.filter(c => c.status === 'draft');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="h-6 w-6" />
            Marketing Command Center
          </h1>
          <p className="text-muted-foreground">
            Email campagnes, analytics en klant engagement
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/marketing/ai">
            <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0">
              <Sparkles className="mr-2 h-4 w-4" />
              AI Marketing Hub
            </Button>
          </Link>
          <Button variant="outline" onClick={() => setSegmentDialogOpen(true)}>
            <Users className="mr-2 h-4 w-4" />
            Nieuw segment
          </Button>
          <Button onClick={() => setCampaignDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nieuwe campagne
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <MarketingStatsCards stats={stats || defaultStats} isLoading={statsLoading} />

      {/* Main Dashboard Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Chart - takes 2 columns */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">Performance Over Tijd</CardTitle>
              <CardDescription>Verzonden, geopend en geklikt emails</CardDescription>
            </div>
            <Select value={chartPeriod} onValueChange={(v) => setChartPeriod(v as '7d' | '30d' | '90d')}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 dagen</SelectItem>
                <SelectItem value="30d">30 dagen</SelectItem>
                <SelectItem value="90d">90 dagen</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <MarketingOverviewChart period={chartPeriod} />
          </CardContent>
        </Card>

        {/* Realtime Activity Feed */}
        <RealtimeActivityFeed />
      </div>

      {/* Quick Actions + Recent Campaigns */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Snelle Acties
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => setCampaignDialogOpen(true)}
            >
              <Mail className="mr-2 h-4 w-4" />
              Nieuwe campagne starten
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => setTemplateDialogOpen(true)}
            >
              <FileText className="mr-2 h-4 w-4" />
              Template maken
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => setSegmentDialogOpen(true)}
            >
              <Users className="mr-2 h-4 w-4" />
              Segment aanmaken
            </Button>
            
            {draftCampaigns.length > 0 && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">Concept campagnes</p>
                {draftCampaigns.slice(0, 3).map(c => (
                  <Badge key={c.id} variant="secondary" className="mr-1 mb-1">
                    {c.name}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Campaigns */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Recente Campagnes
              </CardTitle>
              <CardDescription>Je laatste email campagnes</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {campaignsLoading ? (
              <div className="text-center py-4 text-muted-foreground">Laden...</div>
            ) : recentCampaigns.length === 0 ? (
              <div className="text-center py-8">
                <Mail className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">Nog geen campagnes</p>
                <Button size="sm" className="mt-2" onClick={() => setCampaignDialogOpen(true)}>
                  Eerste campagne maken
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentCampaigns.map((campaign) => (
                  <CampaignCard
                    key={campaign.id}
                    campaign={campaign}
                    onDelete={(id) => deleteCampaign.mutate(id)}
                    onSend={(id) => sendCampaign.mutate(id)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Full Tab Section */}
      <Tabs defaultValue="campaigns" className="space-y-4">
        <TabsList>
          <TabsTrigger value="campaigns" className="gap-2">
            <Mail className="h-4 w-4" />
            Alle Campagnes ({campaigns.length})
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="h-4 w-4" />
            Templates ({templates.length})
          </TabsTrigger>
          <TabsTrigger value="segments" className="gap-2">
            <Users className="h-4 w-4" />
            Segmenten ({segments.length})
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
                <Card key={template.id} className="hover:shadow-md transition-shadow">
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
                <Card key={segment.id} className="hover:shadow-md transition-shadow group">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{segment.name}</CardTitle>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditingSegment(segment);
                            setSegmentDialogOpen(true);
                          }}
                        >
                          <Plus className="h-3.5 w-3.5 rotate-45" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => {
                            if (confirm('Weet je zeker dat je dit segment wilt verwijderen?')) {
                              deleteSegment.mutate(segment.id);
                            }
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <CardDescription>{segment.description || 'Geen beschrijving'}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{segment.member_count}</div>
                    <p className="text-xs text-muted-foreground">klanten in dit segment</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
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
        onOpenChange={(open) => {
          setSegmentDialogOpen(open);
          if (!open) setEditingSegment(null);
        }}
        segment={editingSegment}
        onSave={(data) => {
          if (editingSegment) {
            updateSegment.mutate({ id: editingSegment.id, ...data } as any, {
              onSuccess: () => {
                setSegmentDialogOpen(false);
                setEditingSegment(null);
              },
            });
          } else {
            createSegment.mutate(data as any, { onSuccess: () => setSegmentDialogOpen(false) });
          }
        }}
        isLoading={editingSegment ? updateSegment.isPending : createSegment.isPending}
      />
    </div>
  );
}
