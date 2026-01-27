import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Activity,
  Clock,
  XCircle
} from "lucide-react";
import { 
  usePlatformHealth, 
  COMPONENT_LABELS, 
  STATUS_COLORS,
  SEVERITY_COLORS,
  HealthComponent,
  IncidentSeverity,
  IncidentStatus
} from "@/hooks/usePlatformHealth";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  detected: 'Gedetecteerd',
  investigating: 'Onderzoeken',
  identified: 'Geïdentificeerd',
  monitoring: 'Monitoring',
  resolved: 'Opgelost',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  healthy: <CheckCircle className="h-5 w-5 text-green-600" />,
  warning: <AlertTriangle className="h-5 w-5 text-yellow-600" />,
  critical: <XCircle className="h-5 w-5 text-red-600" />,
  unknown: <AlertCircle className="h-5 w-5 text-gray-600" />,
};

export default function PlatformHealth() {
  const { 
    metrics, 
    incidents, 
    isLoading, 
    createIncident, 
    updateIncident,
    resolveIncident,
    getOverallStatus,
    getActiveIncidents,
    getStats,
    isCreating 
  } = usePlatformHealth();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [resolutionText, setResolutionText] = useState("");
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  
  const [newIncident, setNewIncident] = useState({
    title: "",
    description: "",
    severity: 'medium' as IncidentSeverity,
    affected_components: [] as HealthComponent[],
  });

  const overallStatus = getOverallStatus();
  const activeIncidents = getActiveIncidents();
  const stats = getStats();

  // Group metrics by component
  const latestMetricsByComponent = metrics.reduce((acc, metric) => {
    if (!acc[metric.component] || new Date(metric.recorded_at) > new Date(acc[metric.component].recorded_at)) {
      acc[metric.component] = metric;
    }
    return acc;
  }, {} as Record<string, typeof metrics[0]>);

  const handleCreateIncident = async () => {
    await createIncident({
      ...newIncident,
      affected_components: newIncident.affected_components,
    });
    setNewIncident({
      title: "",
      description: "",
      severity: 'medium',
      affected_components: [],
    });
    setIsCreateOpen(false);
  };

  const handleResolve = async (id: string) => {
    if (resolutionText.trim()) {
      await resolveIncident(id, resolutionText);
      setResolutionText("");
      setSelectedIncidentId(null);
    }
  };

  const statusLabel = {
    healthy: 'Alle Systemen Operationeel',
    warning: 'Verminderde Prestaties',
    critical: 'Grote Storing',
    unknown: 'Status Onbekend',
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Laden...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Platform Health</h1>
          <p className="text-muted-foreground">Monitor systeemstatus en incidenten</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive"><Plus className="h-4 w-4 mr-2" /> Incident Melden</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nieuw Incident Melden</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Titel *</Label>
                <Input
                  value={newIncident.title}
                  onChange={(e) => setNewIncident({ ...newIncident, title: e.target.value })}
                  placeholder="Kort beschrijving van het incident"
                />
              </div>
              <div className="space-y-2">
                <Label>Beschrijving</Label>
                <Textarea
                  value={newIncident.description}
                  onChange={(e) => setNewIncident({ ...newIncident, description: e.target.value })}
                  placeholder="Details over het incident..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Ernst</Label>
                <Select value={newIncident.severity} onValueChange={(v: IncidentSeverity) => setNewIncident({ ...newIncident, severity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Laag</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">Hoog</SelectItem>
                    <SelectItem value="critical">Kritiek</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Getroffen Componenten</Label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(COMPONENT_LABELS).map(([key, label]) => (
                    <Badge
                      key={key}
                      variant={newIncident.affected_components.includes(key as HealthComponent) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        const comps = newIncident.affected_components.includes(key as HealthComponent)
                          ? newIncident.affected_components.filter(c => c !== key)
                          : [...newIncident.affected_components, key as HealthComponent];
                        setNewIncident({ ...newIncident, affected_components: comps });
                      }}
                    >
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button onClick={handleCreateIncident} disabled={isCreating || !newIncident.title}>
                Incident Melden
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Overall Status Banner */}
      <Card className={
        overallStatus === 'critical' ? 'border-red-500 bg-red-50' : 
        overallStatus === 'warning' ? 'border-yellow-500 bg-yellow-50' : 
        'border-green-500 bg-green-50'
      }>
        <CardContent className="flex items-center gap-4 p-6">
          <div className={`p-3 rounded-full ${STATUS_COLORS[overallStatus]}`}>
            {STATUS_ICONS[overallStatus]}
          </div>
          <div>
            <h2 className="text-xl font-semibold">{statusLabel[overallStatus]}</h2>
            <p className="text-sm text-muted-foreground">
              {activeIncidents.length > 0 
                ? `${activeIncidents.length} actieve incident(en)` 
                : 'Geen actieve incidenten'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium">Actieve Incidenten</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.activeIncidents}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium">Kritieke Incidenten</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.criticalIncidents}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">Waarschuwingen</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.warningMetrics}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium">Kritieke Metrics</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.criticalMetrics}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="components">
        <TabsList>
          <TabsTrigger value="components">Component Status</TabsTrigger>
          <TabsTrigger value="incidents">Incidenten</TabsTrigger>
        </TabsList>

        <TabsContent value="components" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(COMPONENT_LABELS).map(([key, label]) => {
              const metric = latestMetricsByComponent[key];
              const status = metric?.status || 'unknown';
              
              return (
                <Card key={key}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {STATUS_ICONS[status]}
                        <span className="font-medium">{label}</span>
                      </div>
                      <Badge className={STATUS_COLORS[status]}>
                        {status === 'healthy' ? 'OK' : status === 'warning' ? 'Waarschuwing' : status === 'critical' ? 'Kritiek' : 'Onbekend'}
                      </Badge>
                    </div>
                    {metric && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        <p>Waarde: {metric.current_value ?? 'N/A'}</p>
                        <p>Laatste check: {format(new Date(metric.recorded_at), 'HH:mm, d MMM', { locale: nl })}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="incidents">
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {incidents.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Geen incidenten geregistreerd</p>
              ) : (
                incidents.map((incident) => (
                  <Card key={incident.id} className={incident.status !== 'resolved' ? 'border-red-300' : ''}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={SEVERITY_COLORS[incident.severity]}>
                              {incident.severity.toUpperCase()}
                            </Badge>
                            <Badge variant="outline">
                              {INCIDENT_STATUS_LABELS[incident.status]}
                            </Badge>
                            {incident.affected_components.map((comp) => (
                              <Badge key={comp} variant="secondary">
                                {COMPONENT_LABELS[comp]}
                              </Badge>
                            ))}
                          </div>
                          <h3 className="font-semibold mt-2">{incident.title}</h3>
                          {incident.description && (
                            <p className="text-sm text-muted-foreground mt-1">{incident.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Gedetecteerd: {format(new Date(incident.detected_at), 'd MMM HH:mm', { locale: nl })}
                            </span>
                            {incident.resolved_at && (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-3 w-3" />
                                Opgelost: {format(new Date(incident.resolved_at), 'd MMM HH:mm', { locale: nl })}
                              </span>
                            )}
                          </div>
                          {incident.root_cause && (
                            <div className="mt-2 p-2 bg-muted rounded text-sm">
                              <span className="font-medium">Root cause:</span> {incident.root_cause}
                            </div>
                          )}
                          {incident.resolution && (
                            <div className="mt-2 p-2 bg-green-50 rounded text-sm">
                              <span className="font-medium">Oplossing:</span> {incident.resolution}
                            </div>
                          )}
                        </div>
                        {incident.status !== 'resolved' && (
                          <div className="flex flex-col gap-2">
                            <Select 
                              value={incident.status} 
                              onValueChange={(v: IncidentStatus) => updateIncident({ id: incident.id, status: v })}
                            >
                              <SelectTrigger className="w-36">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="detected">Gedetecteerd</SelectItem>
                                <SelectItem value="investigating">Onderzoeken</SelectItem>
                                <SelectItem value="identified">Geïdentificeerd</SelectItem>
                                <SelectItem value="monitoring">Monitoring</SelectItem>
                              </SelectContent>
                            </Select>
                            <Dialog open={selectedIncidentId === incident.id} onOpenChange={(open) => setSelectedIncidentId(open ? incident.id : null)}>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="default">Oplossen</Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Incident Oplossen</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label>Oplossing</Label>
                                    <Textarea
                                      value={resolutionText}
                                      onChange={(e) => setResolutionText(e.target.value)}
                                      placeholder="Beschrijf hoe het incident is opgelost..."
                                      rows={3}
                                    />
                                  </div>
                                  <Button onClick={() => handleResolve(incident.id)} disabled={!resolutionText.trim()}>
                                    Markeer als Opgelost
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
