import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { 
  MessageSquare, 
  AlertTriangle, 
  Bell, 
  FileText, 
  TrendingUp, 
  Users,
  Activity,
  CheckCircle,
  Clock,
  AlertCircle,
  Building2,
  Sparkles,
  DollarSign,
  ArrowRight
} from "lucide-react";
import { useSupportTickets } from "@/hooks/useSupportTickets";
import { usePlatformChangelogs } from "@/hooks/usePlatformChangelogs";
import { usePlatformHealth, STATUS_COLORS } from "@/hooks/usePlatformHealth";
import { usePlatformFeedback } from "@/hooks/usePlatformFeedback";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { usePlatformBilling } from "@/hooks/usePlatformBilling";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

export default function PlatformDashboard() {
  const { getTicketStats } = useSupportTickets();
  const { getStats: getChangelogStats, changelogs } = usePlatformChangelogs();
  const { getOverallStatus, getActiveIncidents, getStats: getHealthStats } = usePlatformHealth();
  const { getStats: getFeedbackStats } = usePlatformFeedback();
  const { useTenantStats } = usePlatformAdmin();
  const { data: tenantStats, isLoading: tenantStatsLoading } = useTenantStats();
  const { metrics, isLoading: metricsLoading } = usePlatformBilling();

  const ticketStats = getTicketStats();
  const changelogStats = getChangelogStats();
  const healthStats = getHealthStats();
  const feedbackStats = getFeedbackStats();
  const overallStatus = getOverallStatus();
  const activeIncidents = getActiveIncidents();

  const statusLabel = {
    healthy: 'Operationeel',
    warning: 'Waarschuwing',
    critical: 'Kritiek',
    unknown: 'Onbekend',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platform Dashboard</h1>
        <p className="text-muted-foreground">Overzicht van alle platform activiteiten</p>
      </div>

      {/* System Status Banner */}
      <Card className={overallStatus === 'critical' ? 'border-red-500 bg-red-50' : overallStatus === 'warning' ? 'border-yellow-500 bg-yellow-50' : 'border-green-500 bg-green-50'}>
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${STATUS_COLORS[overallStatus]}`}>
              {overallStatus === 'healthy' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            </div>
            <div>
              <p className="font-semibold">Systeemstatus: {statusLabel[overallStatus]}</p>
              <p className="text-sm text-muted-foreground">
                {activeIncidents.length > 0 
                  ? `${activeIncidents.length} actieve incident(en)` 
                  : 'Alle systemen operationeel'}
              </p>
            </div>
          </div>
          <Button variant="outline" asChild>
            <Link to="/admin/platform/health">Bekijk Details</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Tenant Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Tenant Overzicht
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-3xl font-bold">{tenantStatsLoading ? '-' : tenantStats?.total || 0}</p>
              <p className="text-sm text-muted-foreground">Totaal Tenants</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-3xl font-bold text-green-700">{tenantStatsLoading ? '-' : tenantStats?.active || 0}</p>
              <p className="text-sm text-muted-foreground">Actief</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <p className="text-3xl font-bold text-yellow-700">{tenantStatsLoading ? '-' : tenantStats?.trialing || 0}</p>
              <p className="text-sm text-muted-foreground">Trial</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-3xl font-bold text-blue-700">{tenantStatsLoading ? '-' : tenantStats?.internal || 0}</p>
              <p className="text-sm text-muted-foreground">Intern</p>
            </div>
          </div>
          <Button variant="link" className="p-0 h-auto mt-4" asChild>
            <Link to="/admin/platform">Alle tenants bekijken →</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Revenue Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Omzet Overzicht
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-emerald-50 rounded-lg">
              <p className="text-3xl font-bold text-emerald-700">
                {metricsLoading ? '-' : `€${Math.round(metrics?.mrr || 0).toLocaleString()}`}
              </p>
              <p className="text-sm text-muted-foreground">MRR</p>
            </div>
            <div className="text-center p-4 bg-emerald-50 rounded-lg">
              <p className="text-3xl font-bold text-emerald-700">
                {metricsLoading ? '-' : `€${Math.round(metrics?.arr || 0).toLocaleString()}`}
              </p>
              <p className="text-sm text-muted-foreground">ARR</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-3xl font-bold">{metricsLoading ? '-' : metrics?.payingCustomers || 0}</p>
              <p className="text-sm text-muted-foreground">Betalende Klanten</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-3xl font-bold">
                {metricsLoading ? '-' : `${(metrics?.churnRate || 0).toFixed(1)}%`}
              </p>
              <p className="text-sm text-muted-foreground">Churn Rate</p>
            </div>
          </div>
          <Button variant="link" className="p-0 h-auto mt-4" asChild>
            <Link to="/admin/platform/billing">Bekijk facturatie →</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ticketStats.open}</div>
            {ticketStats.urgent > 0 && (
              <Badge variant="destructive" className="mt-1">{ticketStats.urgent} urgent</Badge>
            )}
            <Button variant="link" className="p-0 h-auto mt-2" asChild>
              <Link to="/admin/platform/support">Bekijk tickets →</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Platform Updates</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{changelogStats.unacknowledged}</div>
            {changelogStats.breaking > 0 && (
              <Badge variant="destructive" className="mt-1">{changelogStats.breaking} breaking</Badge>
            )}
            <Button variant="link" className="p-0 h-auto mt-2" asChild>
              <Link to="/admin/platform/changelog">Bekijk updates →</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Feedback Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{feedbackStats.averageRating}/5</div>
            <p className="text-xs text-muted-foreground">NPS: {feedbackStats.nps}</p>
            <Button variant="link" className="p-0 h-auto mt-2" asChild>
              <Link to="/admin/platform/feedback">Bekijk feedback →</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Health Alerts</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{healthStats.warningMetrics + healthStats.criticalMetrics}</div>
            {healthStats.criticalMetrics > 0 && (
              <Badge variant="destructive" className="mt-1">{healthStats.criticalMetrics} kritiek</Badge>
            )}
            <Button variant="link" className="p-0 h-auto mt-2" asChild>
              <Link to="/admin/platform/health">Bekijk health →</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Changelogs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Recente Platform Updates
            </CardTitle>
          </CardHeader>
          <CardContent>
            {changelogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Geen recente updates</p>
            ) : (
              <div className="space-y-3">
                {changelogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="flex items-start justify-between border-b pb-2 last:border-0">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={log.change_type === 'breaking' ? 'destructive' : 'secondary'} className="text-xs">
                          {log.platform.replace('_', '.')}
                        </Badge>
                        {!log.acknowledged_at && (
                          <Badge variant="outline" className="text-xs">Nieuw</Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium mt-1">{log.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(log.detected_at), 'd MMM yyyy', { locale: nl })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Snelle Acties
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/admin/platform">
                <Users className="h-4 w-4 mr-2" />
                Tenants beheren
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/admin/platform/billing">
                <TrendingUp className="h-4 w-4 mr-2" />
                Platform facturatie
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/admin/platform/coupons">
                <Sparkles className="h-4 w-4 mr-2" />
                Platform coupons
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/admin/platform/legal">
                <FileText className="h-4 w-4 mr-2" />
                Juridische pagina's
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/admin/platform/support">
                <MessageSquare className="h-4 w-4 mr-2" />
                Support inbox
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/admin/platform/field-mappings">
                <ArrowRight className="h-4 w-4 mr-2" />
                Channel Field Mappings
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
