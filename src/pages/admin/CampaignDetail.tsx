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
import { nl } from 'date-fns/locale';

export default function CampaignDetailPage() {
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
        <h2 className="text-lg font-semibold">Campagne niet gevonden</h2>
        <Button variant="link" onClick={() => navigate('/admin/marketing')}>
          Terug naar Marketing
        </Button>
      </div>
    );
  }

  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
    draft: { label: 'Concept', variant: 'secondary' },
    scheduled: { label: 'Gepland', variant: 'outline' },
    sending: { label: 'Versturen...', variant: 'default' },
    sent: { label: 'Verzonden', variant: 'default' },
    paused: { label: 'Gepauzeerd', variant: 'secondary' },
    cancelled: { label: 'Geannuleerd', variant: 'destructive' },
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
                  • Verzonden op {format(new Date(campaign.sent_at), 'd MMMM yyyy HH:mm', { locale: nl })}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Vernieuwen
          </Button>
          {campaign.status === 'draft' && (
            <Button size="sm">
              <Send className="mr-2 h-4 w-4" />
              Verzenden
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verzonden</CardTitle>
            <Send className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <AnimatedCounter value={campaign.total_sent} className="text-3xl font-bold text-blue-700" />
            <p className="text-xs text-muted-foreground">aan {campaign.total_recipients} ontvangers</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Afgeleverd</CardTitle>
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
            <CardTitle className="text-sm font-medium">Geopend</CardTitle>
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
            <CardTitle className="text-sm font-medium">Geklikt</CardTitle>
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
            <CardTitle className="text-sm font-medium">Bounced</CardTitle>
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
          <TabsTrigger value="overview">Overzicht</TabsTrigger>
          <TabsTrigger value="recipients">Ontvangers ({sends.length})</TabsTrigger>
          <TabsTrigger value="links">Link Clicks</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Delivery Funnel */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Delivery Funnel</CardTitle>
                <CardDescription>Van verzending tot conversie</CardDescription>
              </CardHeader>
              <CardContent>
                <CampaignFunnel campaign={campaign} />
              </CardContent>
            </Card>

            {/* Performance Over Time */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Activiteit over tijd</CardTitle>
                <CardDescription>Opens en clicks per uur</CardDescription>
              </CardHeader>
              <CardContent>
                <CampaignPerformanceChart data={hourlyStats} isLoading={analyticsLoading} />
              </CardContent>
            </Card>
          </div>

          {/* Top Clicked Links */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Geklikte Links</CardTitle>
              <CardDescription>Welke links presteren het best</CardDescription>
            </CardHeader>
            <CardContent>
              {linkClicks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MousePointerClick className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nog geen link clicks geregistreerd</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Link URL</TableHead>
                      <TableHead className="text-right">Clicks</TableHead>
                      <TableHead className="text-right">% van totaal</TableHead>
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
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recipients" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ontvangers</CardTitle>
              <CardDescription>Alle ontvangers en hun status</CardDescription>
            </CardHeader>
            <CardContent>
              {sendsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : sends.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nog geen ontvangers</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Naam</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Geopend</TableHead>
                      <TableHead>Geklikt</TableHead>
                      <TableHead>Verzonden</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sends.map((send) => (
                      <TableRow key={send.id}>
                        <TableCell className="font-mono text-sm">{send.email}</TableCell>
                        <TableCell>{send.customer_name || '-'}</TableCell>
                        <TableCell>
                          <RecipientStatusBadge status={send.status} />
                        </TableCell>
                        <TableCell>
                          {send.opened_at ? (
                            <span className="text-green-600 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              {format(new Date(send.opened_at), 'dd/MM HH:mm')}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {send.clicked_at ? (
                            <span className="text-orange-600 flex items-center gap-1">
                              <MousePointerClick className="h-3 w-3" />
                              {format(new Date(send.clicked_at), 'dd/MM HH:mm')}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {send.sent_at ? format(new Date(send.sent_at), 'dd/MM HH:mm') : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="links" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Alle Link Clicks</CardTitle>
              <CardDescription>Gedetailleerd overzicht van alle clicks</CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : linkClicks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MousePointerClick className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nog geen link clicks geregistreerd</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Link URL</TableHead>
                      <TableHead className="text-right">Unieke Clicks</TableHead>
                      <TableHead className="text-right">Totaal Clicks</TableHead>
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
  const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: typeof Clock }> = {
    pending: { label: 'Wachten', variant: 'secondary', icon: Clock },
    sent: { label: 'Verzonden', variant: 'outline', icon: Send },
    delivered: { label: 'Afgeleverd', variant: 'default', icon: CheckCircle2 },
    opened: { label: 'Geopend', variant: 'default', icon: Mail },
    clicked: { label: 'Geklikt', variant: 'default', icon: MousePointerClick },
    bounced: { label: 'Bounced', variant: 'destructive', icon: XCircle },
    unsubscribed: { label: 'Uitgeschreven', variant: 'secondary', icon: XCircle },
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
