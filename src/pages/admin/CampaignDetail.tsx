import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Mail, MousePointerClick, Users, AlertCircle, CheckCircle2, Clock, XCircle, TrendingUp, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEmailCampaign, useCampaignSends } from '@/hooks/useEmailCampaigns';
import { useCampaignAnalytics } from '@/hooks/useCampaignAnalytics';
import { CampaignPerformanceChart } from '@/components/admin/marketing/CampaignPerformanceChart';
import { CampaignFunnel } from '@/components/admin/marketing/CampaignFunnel';
import { AnimatedCounter } from '@/components/admin/marketing/AnimatedCounter';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';

export default function CampaignDetailPage() {
  const { t } = useTranslation();
  const dateLocale = useDateFnsLocale();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { campaign, isLoading: campaignLoading } = useEmailCampaign(id);
  const { sends, isLoading: sendsLoading } = useCampaignSends(id);
  const { linkClicks, hourlyStats, isLoading: analyticsLoading } = useCampaignAnalytics(id);

  if (campaignLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold">{t('admin.adsBolcomCampaignDetail.campagne_niet_gevonden')}</h2>
        <Button variant="link" onClick={() => navigate('/admin/marketing')}>
          {t('admin.campaignDetail.terug_naar_marketing')}
        </Button>
      </div>
    );
  }

  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
    draft: { label: t('admin.marketing.campaignCard.status.concept'), variant: 'secondary' },
    scheduled: { label: t('admin.marketing.campaignCard.status.gepland'), variant: 'outline' },
    sending: { label: t('admin.campaignDetail.versturen'), variant: 'default' },
    sent: { label: t('admin.marketing.campaignCard.status.verzonden'), variant: 'default' },
    paused: { label: t('admin.marketing.campaignCard.status.gepauzeerd'), variant: 'secondary' },
    cancelled: { label: t('admin.marketing.aBTestingPanel.geannuleerd'), variant: 'destructive' },
  };

  const openRate = campaign.total_sent > 0 ? (campaign.total_opened / campaign.total_sent) * 100 : 0;
  const clickRate = campaign.total_sent > 0 ? (campaign.total_clicked / campaign.total_sent) * 100 : 0;
  const bounceRate = campaign.total_sent > 0 ? (campaign.total_bounced / campaign.total_sent) * 100 : 0;
  const deliveryRate = campaign.total_sent > 0 ? ((campaign.total_sent - campaign.total_bounced) / campaign.total_sent) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/marketing')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{campaign.name}</h1>
              <Badge variant={statusConfig[campaign.status]?.variant || 'secondary'}>
                {statusConfig[campaign.status]?.label || campaign.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {campaign.subject}
              {campaign.sent_at && (
                <span className="ml-2">
                  • Verzonden op {format(new Date(campaign.sent_at), 'd MMMM yyyy HH:mm', { locale: dateLocale })}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('admin.campaignDetail.vernieuwen')}
          </Button>
          {campaign.status === 'draft' && (
            <Button size="sm">
              <Send className="mr-2 h-4 w-4" />
              {t('admin.inbox.composeDialog.verzenden')}
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('admin.marketing.campaignCard.status.verzonden')}</CardTitle>
            <Send className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <AnimatedCounter value={campaign.total_sent} className="text-3xl font-bold text-blue-700" />
            <p className="text-xs text-muted-foreground">aan {campaign.total_recipients} ontvangers</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('admin.marketing.campaignFunnel.afgeleverd')}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <AnimatedCounter value={campaign.total_delivered} className="text-3xl font-bold text-green-700" />
            <div className="flex items-center gap-2 mt-1">
              <Progress value={deliveryRate} className="h-1.5 flex-1" />
              <span className="text-xs font-medium text-green-600">{deliveryRate.toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('admin.marketing.campaignFunnel.geopend')}</CardTitle>
            <Mail className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <AnimatedCounter value={campaign.total_opened} className="text-3xl font-bold text-purple-700" />
            <div className="flex items-center gap-2 mt-1">
              <Progress value={openRate} className="h-1.5 flex-1" />
              <span className="text-xs font-medium text-purple-600">{openRate.toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-200/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('admin.marketing.campaignFunnel.geklikt')}</CardTitle>
            <MousePointerClick className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <AnimatedCounter value={campaign.total_clicked} className="text-3xl font-bold text-orange-700" />
            <div className="flex items-center gap-2 mt-1">
              <Progress value={clickRate} className="h-1.5 flex-1" />
              <span className="text-xs font-medium text-orange-600">{clickRate.toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-200/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('admin.campaignDetail.bounced')}</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <AnimatedCounter value={campaign.total_bounced} className="text-3xl font-bold text-red-700" />
            <div className="flex items-center gap-2 mt-1">
              <Progress value={bounceRate} className="h-1.5 flex-1" />
              <span className="text-xs font-medium text-red-600">{bounceRate.toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{t('admin.giftCards.overzicht')}</TabsTrigger>
          <TabsTrigger value="recipients">Ontvangers ({sends.length})</TabsTrigger>
          <TabsTrigger value="links">{t('admin.campaignDetail.link_clicks')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Delivery Funnel */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('admin.campaignDetail.delivery_funnel')}</CardTitle>
                <CardDescription>{t('admin.campaignDetail.van_verzending_tot_conversie')}</CardDescription>
              </CardHeader>
              <CardContent>
                <CampaignFunnel campaign={campaign} />
              </CardContent>
            </Card>

            {/* Performance Over Time */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('admin.campaignDetail.activiteit_over_tijd')}</CardTitle>
                <CardDescription>{t('admin.campaignDetail.opens_en_clicks_per_uur')}</CardDescription>
              </CardHeader>
              <CardContent>
                <CampaignPerformanceChart data={hourlyStats} isLoading={analyticsLoading} />
              </CardContent>
            </Card>
          </div>

          {/* Top Clicked Links */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('admin.campaignDetail.top_geklikte_links')}</CardTitle>
              <CardDescription>{t('admin.campaignDetail.welke_links_presteren_het_best')}</CardDescription>
            </CardHeader>
            <CardContent>
              {linkClicks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MousePointerClick className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>{t('admin.campaignDetail.nog_geen_link_clicks_geregistreerd')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('admin.marketing.emailBlockProperties.link_url')}</TableHead>
                      <TableHead className="text-right">{t('admin.ads.campaignCard.clicks')}</TableHead>
                      <TableHead className="text-right">{t('admin.campaignDetail.van_totaal')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linkClicks.slice(0, 5).map((link, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-sm truncate max-w-[400px]">
                          <a href={link.link_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary">
                            {link.link_url}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </TableCell>
                        <TableCell className="text-right font-medium">{link.click_count}</TableCell>
                        <TableCell className="text-right">
                          {campaign.total_clicked > 0 
                            ? ((link.click_count / campaign.total_clicked) * 100).toFixed(1) 
                            : 0}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recipients" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('admin.campaignDetail.ontvangers')}</CardTitle>
              <CardDescription>{t('admin.campaignDetail.alle_ontvangers_en_hun_status')}</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto px-0 sm:px-6">
              {sendsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : sends.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>{t('admin.campaignDetail.nog_geen_ontvangers')}</p>
                </div>
              ) : (
                <div className="min-w-[650px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('admin.marketing.aIContentLibrary.email')}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t('common.name')}</TableHead>
                      <TableHead>{t('common.status')}</TableHead>
                      <TableHead className="hidden md:table-cell">{t('admin.marketing.campaignFunnel.geopend')}</TableHead>
                      <TableHead className="hidden md:table-cell">{t('admin.marketing.campaignFunnel.geklikt')}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t('admin.marketing.campaignCard.status.verzonden')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sends.map((send) => (
                      <TableRow key={send.id}>
                        <TableCell className="font-mono text-sm">{send.email}</TableCell>
                        <TableCell className="hidden sm:table-cell">{send.customer_name || '-'}</TableCell>
                        <TableCell>
                          <RecipientStatusBadge status={send.status} />
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {send.opened_at ? (
                            <span className="text-green-600 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              {format(new Date(send.opened_at), 'dd/MM HH:mm')}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {send.clicked_at ? (
                            <span className="text-orange-600 flex items-center gap-1">
                              <MousePointerClick className="h-3 w-3" />
                              {format(new Date(send.clicked_at), 'dd/MM HH:mm')}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                          {send.sent_at ? format(new Date(send.sent_at), 'dd/MM HH:mm') : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="links" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('admin.campaignDetail.alle_link_clicks')}</CardTitle>
              <CardDescription>{t('admin.campaignDetail.gedetailleerd_overzicht_van_alle_clicks')}</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto px-0 sm:px-6">
              {analyticsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : linkClicks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MousePointerClick className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>{t('admin.campaignDetail.nog_geen_link_clicks_geregistreerd_2')}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('admin.marketing.emailBlockProperties.link_url')}</TableHead>
                      <TableHead className="text-right">{t('admin.campaignDetail.unieke_clicks')}</TableHead>
                      <TableHead className="text-right">{t('admin.campaignDetail.totaal_clicks')}</TableHead>
                      <TableHead className="text-right">CTR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linkClicks.map((link, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-sm">
                          <a 
                            href={link.link_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="flex items-center gap-1 hover:text-primary truncate max-w-[500px]"
                          >
                            {link.link_url}
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        </TableCell>
                        <TableCell className="text-right">{link.unique_clicks || link.click_count}</TableCell>
                        <TableCell className="text-right font-medium">{link.click_count}</TableCell>
                        <TableCell className="text-right">
                          {campaign.total_sent > 0 
                            ? (((link.unique_clicks || link.click_count) / campaign.total_sent) * 100).toFixed(2) 
                            : 0}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RecipientStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: typeof Clock }> = {
    pending: { label: t('admin.campaignDetail.wachten'), variant: 'secondary', icon: Clock },
    sent: { label: t('admin.marketing.campaignCard.status.verzonden'), variant: 'outline', icon: Send },
    delivered: { label: t('admin.marketing.campaignFunnel.afgeleverd'), variant: 'default', icon: CheckCircle2 },
    opened: { label: t('admin.marketing.campaignFunnel.geopend'), variant: 'default', icon: Mail },
    clicked: { label: t('admin.marketing.campaignFunnel.geklikt'), variant: 'default', icon: MousePointerClick },
    bounced: { label: t('admin.campaignDetail.bounced'), variant: 'destructive', icon: XCircle },
    unsubscribed: { label: t('admin.campaignDetail.uitgeschreven'), variant: 'secondary', icon: XCircle },
  };

  const statusConfig = config[status] || config.pending;
  const Icon = statusConfig.icon;

  return (
    <Badge variant={statusConfig.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {statusConfig.label}
    </Badge>
  );
}
