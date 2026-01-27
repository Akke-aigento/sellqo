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
import { 
  Plus, 
  Search, 
  ExternalLink, 
  Check, 
  AlertTriangle,
  Calendar,
  Clock
} from "lucide-react";
import { 
  usePlatformChangelogs, 
  PLATFORM_LABELS, 
  CHANGE_TYPE_LABELS, 
  IMPACT_LABELS,
  ChangelogPlatform,
  ChangeType,
  ImpactLevel
} from "@/hooks/usePlatformChangelogs";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

const CHANGE_TYPE_COLORS: Record<ChangeType, string> = {
  breaking: 'bg-red-100 text-red-800',
  feature: 'bg-green-100 text-green-800',
  deprecation: 'bg-orange-100 text-orange-800',
  security: 'bg-purple-100 text-purple-800',
  bugfix: 'bg-blue-100 text-blue-800',
  enhancement: 'bg-cyan-100 text-cyan-800',
};

const IMPACT_COLORS: Record<ImpactLevel, string> = {
  none: 'bg-gray-100 text-gray-800',
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

export default function PlatformChangelog() {
  const { 
    changelogs, 
    isLoading, 
    createChangelog, 
    acknowledgeChangelog, 
    completeAction,
    getStats,
    isCreating 
  } = usePlatformChangelogs();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [actionText, setActionText] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  const [newChangelog, setNewChangelog] = useState({
    platform: 'bol_com' as ChangelogPlatform,
    title: "",
    description: "",
    version: "",
    change_type: 'feature' as ChangeType,
    impact_level: 'low' as ImpactLevel,
    source_url: "",
    action_required: false,
    deadline_date: "",
  });

  const stats = getStats();

  const filteredChangelogs = changelogs.filter(c => {
    const matchesSearch = !searchQuery || 
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesPlatform = platformFilter === "all" || c.platform === platformFilter;
    
    return matchesSearch && matchesPlatform;
  });

  const handleCreateChangelog = async () => {
    await createChangelog({
      ...newChangelog,
      deadline_date: newChangelog.deadline_date || null,
    });
    setNewChangelog({
      platform: 'bol_com',
      title: "",
      description: "",
      version: "",
      change_type: 'feature',
      impact_level: 'low',
      source_url: "",
      action_required: false,
      deadline_date: "",
    });
    setIsCreateOpen(false);
  };

  const handleCompleteAction = async (id: string) => {
    if (actionText.trim()) {
      await completeAction(id, actionText);
      setActionText("");
      setSelectedId(null);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Laden...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Platform Changelog</h1>
          <p className="text-muted-foreground">Volg updates van externe platforms</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Changelog Toevoegen</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nieuwe Platform Update</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Platform *</Label>
                  <Select value={newChangelog.platform} onValueChange={(v: ChangelogPlatform) => setNewChangelog({ ...newChangelog, platform: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Versie</Label>
                  <Input
                    value={newChangelog.version}
                    onChange={(e) => setNewChangelog({ ...newChangelog, version: e.target.value })}
                    placeholder="v2.0"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Titel *</Label>
                <Input
                  value={newChangelog.title}
                  onChange={(e) => setNewChangelog({ ...newChangelog, title: e.target.value })}
                  placeholder="Beschrijf de update"
                />
              </div>
              <div className="space-y-2">
                <Label>Beschrijving</Label>
                <Textarea
                  value={newChangelog.description}
                  onChange={(e) => setNewChangelog({ ...newChangelog, description: e.target.value })}
                  placeholder="Details over de wijziging..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={newChangelog.change_type} onValueChange={(v: ChangeType) => setNewChangelog({ ...newChangelog, change_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CHANGE_TYPE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Impact</Label>
                  <Select value={newChangelog.impact_level} onValueChange={(v: ImpactLevel) => setNewChangelog({ ...newChangelog, impact_level: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(IMPACT_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Bron URL</Label>
                <Input
                  value={newChangelog.source_url}
                  onChange={(e) => setNewChangelog({ ...newChangelog, source_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label>Deadline (optioneel)</Label>
                <Input
                  type="date"
                  value={newChangelog.deadline_date}
                  onChange={(e) => setNewChangelog({ ...newChangelog, deadline_date: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="action_required"
                  checked={newChangelog.action_required}
                  onChange={(e) => setNewChangelog({ ...newChangelog, action_required: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="action_required">Actie vereist</Label>
              </div>
              <Button onClick={handleCreateChangelog} disabled={isCreating || !newChangelog.title}>
                Toevoegen
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">Onbevestigd</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.unacknowledged}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Actie vereist</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.actionRequired}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium">Breaking</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.breaking}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium">Kritiek</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.critical}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoeken..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Alle platforms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle platforms</SelectItem>
            {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Changelog List */}
      <ScrollArea className="h-[600px]">
        <div className="space-y-4">
          {filteredChangelogs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Geen changelogs gevonden</p>
          ) : (
            filteredChangelogs.map((log) => (
              <Card key={log.id} className={!log.acknowledged_at ? 'border-yellow-400' : ''}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{PLATFORM_LABELS[log.platform]}</Badge>
                        {log.version && <Badge variant="secondary">{log.version}</Badge>}
                        <Badge className={CHANGE_TYPE_COLORS[log.change_type]}>
                          {CHANGE_TYPE_LABELS[log.change_type]}
                        </Badge>
                        <Badge className={IMPACT_COLORS[log.impact_level]}>
                          {IMPACT_LABELS[log.impact_level]}
                        </Badge>
                        {!log.acknowledged_at && <Badge variant="outline" className="text-yellow-600">Nieuw</Badge>}
                        {log.action_required && !log.action_completed_at && (
                          <Badge variant="destructive">Actie vereist</Badge>
                        )}
                        {log.action_completed_at && (
                          <Badge variant="default" className="bg-green-600">Afgehandeld</Badge>
                        )}
                      </div>
                      <h3 className="font-semibold mt-2">{log.title}</h3>
                      {log.description && (
                        <p className="text-sm text-muted-foreground mt-1">{log.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(log.detected_at), 'd MMM yyyy', { locale: nl })}
                        </span>
                        {log.deadline_date && (
                          <span className="flex items-center gap-1 text-red-600">
                            <Clock className="h-3 w-3" />
                            Deadline: {format(new Date(log.deadline_date), 'd MMM yyyy', { locale: nl })}
                          </span>
                        )}
                        {log.source_url && (
                          <a 
                            href={log.source_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Bron
                          </a>
                        )}
                      </div>
                      {log.action_taken && (
                        <div className="mt-2 p-2 bg-green-50 rounded text-sm">
                          <span className="font-medium">Actie:</span> {log.action_taken}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {!log.acknowledged_at && (
                        <Button size="sm" variant="outline" onClick={() => acknowledgeChangelog(log.id)}>
                          <Check className="h-4 w-4 mr-1" /> Bevestig
                        </Button>
                      )}
                      {log.action_required && !log.action_completed_at && (
                        <Dialog open={selectedId === log.id} onOpenChange={(open) => setSelectedId(open ? log.id : null)}>
                          <DialogTrigger asChild>
                            <Button size="sm">Actie afronden</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Actie afronden</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label>Wat heb je gedaan?</Label>
                                <Textarea
                                  value={actionText}
                                  onChange={(e) => setActionText(e.target.value)}
                                  placeholder="Beschrijf de ondernomen actie..."
                                  rows={3}
                                />
                              </div>
                              <Button onClick={() => handleCompleteAction(log.id)} disabled={!actionText.trim()}>
                                Afronden
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
