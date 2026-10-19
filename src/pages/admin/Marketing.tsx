import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Mail, Users, FileText, Megaphone, TrendingUp, Zap, Bot, Sparkles, Trash2, Contact } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MarketingStatsCards } from '@/components/admin/marketing/MarketingStatsCards';
import { CampaignCard } from '@/components/admin/marketing/CampaignCard';
import { CampaignDialog } from '@/components/admin/marketing/CampaignDialog';
import type { EmailCampaign, EmailTemplate } from '@/types/marketing';
import { TemplateDialog } from '@/components/admin/marketing/TemplateDialog';
import { SubscribersTab } from '@/components/admin/marketing/SubscribersTab';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SegmentDialog } from '@/components/admin/marketing/SegmentDialog';
import { SendCampaignConfirmDialog } from '@/components/admin/marketing/SendCampaignConfirmDialog';
import { RealtimeActivityFeed } from '@/components/admin/marketing/RealtimeActivityFeed';
import { MarketingOverviewChart } from '@/components/admin/marketing/MarketingOverviewChart';
import { useMarketingStats, useEmailCampaigns } from '@/hooks/useEmailCampaigns';
import { useEmailTemplates } from '@/hooks/useEmailTemplates';
import { useCustomerSegments } from '@/hooks/useCustomerSegments';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GatedButton } from '@/components/permissions/GatedButton';
import { ReadOnlyBadge } from '@/components/permissions/ReadOnlyBadge';
import { buildSeedTemplates } from '@/lib/seedEmailTemplates';
import { useTenant } from '@/hooks/useTenant';
import { useTenantBrand } from '@/hooks/useTenantBrand';
import { useToast } from '@/hooks/use-toast';
import { Sparkles as SparklesIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { FeatureGate } from '@/components/FeatureGate';
import { AIEmailPlanner } from '@/components/admin/marketing/AIEmailPlanner';
import { useCan } from '@/hooks/useCan';
import { useTenantPageOverrides } from '@/hooks/useTenantPageOverrides';

export default function MarketingPage() {
  const { t } = useTranslation();
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  // APP-CLEAN-2b: "Bewerken" op een conceptcampagne opent dezelfde dialoog.
  const [editingCampaign, setEditingCampaign] = useState<EmailCampaign | null>(null);
  // APP-CLEAN-2b: ?new=campaign (bv. vanuit AI-inzichten) opent meteen een nieuwe campagne.
  const [searchParams, setSearchParams] = useSearchParams();
  // MARKETING-2: de AI-e-mailtool zit hier (knop "Maak met AI"); ?ai=email opent hem meteen
  // (doorverwijzing vanuit de vroegere AI Content Hub). Zelfde rechten als die hub.
  const canAI = useCan('read', 'ai_assistant');
  const { isPageHidden } = useTenantPageOverrides();
  const showAI = canAI && !isPageHidden('ai-tools');
  const [aiEmailOpen, setAiEmailOpen] = useState(false);
  // MAIL-1a: "Nu verzenden" gaat eerst langs een bevestiging met ontvangertelling.
  const [confirmSendId, setConfirmSendId] = useState<string | null>(null);
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    let changed = false;
    if (searchParams.get('new') === 'campaign') {
      setCampaignDialogOpen(true);
      next.delete('new');
      changed = true;
    }
    if (searchParams.get('ai') === 'email') {
      if (showAI) setAiEmailOpen(true);
      next.delete('ai');
      changed = true;
    }
    if (changed) setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, showAI]);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  // MAIL-1b: templatekaarten openen de dialoog om te bewerken; verwijderen met bevestiging.
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<EmailTemplate | null>(null);
  const canWriteMarketing = useCan('write', 'marketing');
  const [segmentDialogOpen, setSegmentDialogOpen] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [seeding, setSeeding] = useState(false);
  const { currentTenant } = useTenant();
  const { data: brand } = useTenantBrand();
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading } = useMarketingStats();
  const { campaigns, isLoading: campaignsLoading, createCampaign, deleteCampaign, sendCampaign, updateCampaign } = useEmailCampaigns();
  const { templates, isLoading: templatesLoading, createTemplate, updateTemplate, deleteTemplate } = useEmailTemplates();

  const handleSeedTemplates = async () => {
    if (!currentTenant?.id) return;
    const language = brand?.defaultLocale || 'nl';
    setSeeding(true);
    try {
      const seeds = buildSeedTemplates(currentTenant.id, language);
      for (const s of seeds) {
        await createTemplate.mutateAsync(s as any);
      }
      toast({ title: t('admin.marketing.4_starterstemplates_aangemaakt') });
    } catch (e: any) {
      toast({ title: t('admin.marketing.kon_templates_niet_aanmaken'), description: e?.message, variant: 'destructive' });
    } finally {
      setSeeding(false);
    }
  };
  const { segments, isLoading: segmentsLoading, createSegment, deleteSegment } = useCustomerSegments();

  const defaultStats = {
    totalCampaigns: 0, totalSent: 0, totalOpened: 0, totalClicked: 0,
    avgOpenRate: 0, avgClickRate: 0, subscriberCount: 0, subscriberGrowth: 0, unsubscribeCount: 0,
  };

  const recentCampaigns = campaigns.slice(0, 5);
  const draftCampaigns = campaigns.filter(c => c.status === 'draft');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 flex-wrap">
            <Megaphone className="h-6 w-6" />
            {t('admin.marketing.marketing_command_center')}
            <ReadOnlyBadge resource="marketing" />
          </h1>
          <p className="text-muted-foreground">
            {t('admin.marketing.email_campagnes_analytics_en_klant_engagement')}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {showAI && (
            <Button
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0"
              onClick={() => setAiEmailOpen(true)}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {t('admin.marketing.aiEmail.button')}
            </Button>
          )}
          <GatedButton action="write" resource="marketing" variant="outline" onClick={() => setSegmentDialogOpen(true)}>
            <Users className="mr-2 h-4 w-4" />
            {t('admin.marketing.nieuw_segment')}
          </GatedButton>
          <GatedButton action="write" resource="marketing" onClick={() => setCampaignDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('admin.marketing.nieuwe_campagne')}
          </GatedButton>
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
              <CardTitle className="text-base">{t('admin.marketing.performance_over_tijd')}</CardTitle>
              <CardDescription>{t('admin.marketing.verzonden_geopend_en_geklikt_emails')}</CardDescription>
            </div>
            <Select value={chartPeriod} onValueChange={(v) => setChartPeriod(v as '7d' | '30d' | '90d')}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">{t('admin.marketing.7_dagen')}</SelectItem>
                <SelectItem value="30d">{t('admin.marketing.30_dagen')}</SelectItem>
                <SelectItem value="90d">{t('admin.marketing.90_dagen')}</SelectItem>
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
              {t('admin.marketing.snelle_acties')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => setCampaignDialogOpen(true)}
            >
              <Mail className="mr-2 h-4 w-4" />
              {t('admin.marketing.nieuwe_campagne_starten')}
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => setTemplateDialogOpen(true)}
            >
              <FileText className="mr-2 h-4 w-4" />
              {t('admin.marketing.template_maken')}
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => setSegmentDialogOpen(true)}
            >
              <Users className="mr-2 h-4 w-4" />
              {t('admin.marketing.segment_aanmaken')}
            </Button>
            
            {draftCampaigns.length > 0 && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">{t('admin.marketing.concept_campagnes')}</p>
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
                {t('admin.marketing.recente_campagnes')}
              </CardTitle>
              <CardDescription>{t('admin.marketing.je_laatste_email_campagnes')}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {campaignsLoading ? (
              <div className="text-center py-4 text-muted-foreground">{t('common.loading')}</div>
            ) : recentCampaigns.length === 0 ? (
              <div className="text-center py-8">
                <Mail className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">{t('admin.marketing.nog_geen_campagnes')}</p>
                <Button size="sm" className="mt-2" onClick={() => setCampaignDialogOpen(true)}>
                  {t('admin.marketing.eerste_campagne_maken')}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentCampaigns.map((campaign) => (
                  <CampaignCard
                    key={campaign.id}
                    campaign={campaign}
                    onDelete={(id) => deleteCampaign.mutate(id)}
                    onSend={(id) => setConfirmSendId(id)}
                    onEdit={(c) => setEditingCampaign(c)}
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
            {t('admin.marketing.tabs.campaigns', { count: campaigns.length })}
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="h-4 w-4" />
            {t('admin.marketing.tabs.templates', { count: templates.length })}
          </TabsTrigger>
          <TabsTrigger value="segments" className="gap-2">
            <Users className="h-4 w-4" />
            {t('admin.marketing.tabs.segments', { count: segments.length })}
          </TabsTrigger>
          <TabsTrigger value="subscribers" className="gap-2">
            <Contact className="h-4 w-4" />
            {t('admin.marketing.tabs.subscribers')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-4">
          {campaignsLoading ? (
            <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
          ) : campaigns.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">{t('admin.marketing.geen_campagnes')}</h3>
                <p className="text-muted-foreground mb-4">{t('admin.marketing.maak_je_eerste_email_campagne_aan')}</p>
                <Button onClick={() => setCampaignDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('admin.marketing.nieuwe_campagne')}
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
                  onSend={(id) => setConfirmSendId(id)}
                  onEdit={(c) => setEditingCampaign(c)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setTemplateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('admin.marketing.nieuwe_template')}
            </Button>
          </div>
          {templatesLoading ? (
            <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
          ) : templates.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">{t('admin.marketing.geen_templates')}</h3>
                <p className="text-muted-foreground mb-4">{t('admin.marketing.maak_herbruikbare_email_templates')}</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button onClick={() => setTemplateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('admin.marketing.nieuwe_template')}
                  </Button>
                  <Button variant="outline" onClick={handleSeedTemplates} disabled={seeding || !currentTenant?.id}>
                    <SparklesIcon className="mr-2 h-4 w-4" />
                    {seeding ? t('admin.marketing.creditPurchaseDialog.bezig') : t('admin.marketing.starterstemplates_genereren')}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-3 max-w-md text-center">
                  {t('admin.marketing.genereert_4_templates_nieuwsbrief_welkomstmail_promotie')}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => (
                <Card
                  key={template.id}
                  role={canWriteMarketing ? 'button' : undefined}
                  tabIndex={canWriteMarketing ? 0 : undefined}
                  onClick={canWriteMarketing ? () => setEditingTemplate(template) : undefined}
                  onKeyDown={canWriteMarketing ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditingTemplate(template); } } : undefined}
                  className={canWriteMarketing ? 'hover:shadow-md transition-shadow cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring' : undefined}
                >
                  <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                    <div className="min-w-0">
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <CardDescription className="mt-1.5">{template.subject}</CardDescription>
                    </div>
                    {canWriteMarketing && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={t('admin.marketing.templates.delete')}
                        title={t('admin.marketing.templates.delete')}
                        onClick={(e) => { e.stopPropagation(); setDeletingTemplate(template); }}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {t(`admin.marketing.templateDialog.category.${template.category || 'general'}`, { defaultValue: template.category || '' })}
                    </Badge>
                    {template.language && <Badge variant="outline">{template.language.toUpperCase()}</Badge>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="subscribers" className="space-y-4">
          <SubscribersTab />
        </TabsContent>

        <TabsContent value="segments" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setSegmentDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('admin.marketing.nieuw_segment')}
            </Button>
          </div>
          {segmentsLoading ? (
            <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
          ) : segments.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">{t('admin.marketing.geen_segmenten')}</h3>
                <p className="text-muted-foreground mb-4">{t('admin.marketing.maak_klantsegmenten_voor_gerichte_campagnes')}</p>
                <Button onClick={() => setSegmentDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('admin.marketing.nieuw_segment')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {segments.map((segment) => (
                <Card key={segment.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-base">{segment.name}</CardTitle>
                    <CardDescription>{segment.description || t('admin.marketing.geen_beschrijving')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{segment.member_count}</div>
                    <p className="text-xs text-muted-foreground">{t('admin.marketing.segmentBuilder.klanten_in_dit_segment')}</p>
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
      <CampaignDialog
        open={!!editingCampaign}
        onOpenChange={(open) => { if (!open) setEditingCampaign(null); }}
        campaign={editingCampaign ?? undefined}
        onSave={(data) => {
          if (!editingCampaign) return;
          const { tenant_id: _tenantId, ...updates } = data as Record<string, unknown>;
          updateCampaign.mutate(
            { id: editingCampaign.id, ...(updates as object) },
            { onSuccess: () => setEditingCampaign(null) },
          );
        }}
        isLoading={updateCampaign.isPending}
      />

      <TemplateDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        onSave={(data) => {
          createTemplate.mutate(data as any, { onSuccess: () => setTemplateDialogOpen(false) });
        }}
        isLoading={createTemplate.isPending}
      />

      <TemplateDialog
        open={!!editingTemplate}
        onOpenChange={(open) => { if (!open) setEditingTemplate(null); }}
        template={editingTemplate ?? undefined}
        onSave={(data) => {
          if (!editingTemplate) return;
          const { tenant_id: _tenantId, is_default: _isDefault, ...updates } = data;
          updateTemplate.mutate(
            { id: editingTemplate.id, ...updates },
            { onSuccess: () => setEditingTemplate(null) },
          );
        }}
        isLoading={updateTemplate.isPending}
      />

      <AlertDialog open={!!deletingTemplate} onOpenChange={(open) => { if (!open) setDeletingTemplate(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.marketing.templates.delete_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.marketing.templates.delete_body', { name: deletingTemplate?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteTemplate.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!deletingTemplate) return;
                deleteTemplate.mutate(deletingTemplate.id, { onSettled: () => setDeletingTemplate(null) });
              }}
            >
              {t('admin.marketing.templates.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SegmentDialog
        open={segmentDialogOpen}
        onOpenChange={setSegmentDialogOpen}
        onSave={(data) => {
          createSegment.mutate(data as any, { onSuccess: () => setSegmentDialogOpen(false) });
        }}
        isLoading={createSegment.isPending}
      />

      <SendCampaignConfirmDialog
        campaignId={confirmSendId}
        onOpenChange={(open) => { if (!open) setConfirmSendId(null); }}
        isSending={sendCampaign.isPending}
        onConfirm={(id) => sendCampaign.mutate(id, { onSettled: () => setConfirmSendId(null) })}
      />

      <ResponsiveDialog
        open={aiEmailOpen}
        onOpenChange={setAiEmailOpen}
        title={t('admin.marketing.aiEmail.title')}
        maxWidth="2xl"
      >
        <FeatureGate feature="ai_marketing">
          <AIEmailPlanner />
        </FeatureGate>
      </ResponsiveDialog>
    </div>
  );
}
