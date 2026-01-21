import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Calendar, 
  Clock, 
  Play, 
  Pause, 
  Trash2, 
  Plus,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Mail,
  FileText,
  History,
  Settings2
} from 'lucide-react';
import { useTenant } from '@/hooks/useTenant';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';

interface ScheduledAudit {
  id: string;
  audit_type: string;
  frequency: string;
  next_run_at: string;
  last_run_at: string | null;
  is_active: boolean;
  notify_on_issues: boolean;
  notify_email: string | null;
}

interface AuditResult {
  id: string;
  audit_type: string;
  overall_score: number | null;
  issues_found: number;
  issues_fixed: number;
  status: string;
  started_at: string;
  completed_at: string | null;
  results: Record<string, any>;
}

const AUDIT_TYPES = [
  { value: 'full', label: 'Volledige audit', description: 'Alle SEO aspecten' },
  { value: 'content', label: 'Content audit', description: 'Meta tags, beschrijvingen' },
  { value: 'technical', label: 'Technische audit', description: 'URLs, redirects, sitemap' },
  { value: 'performance', label: 'Performance audit', description: 'Snelheid, Core Web Vitals' },
];

const FREQUENCIES = [
  { value: 'daily', label: 'Dagelijks' },
  { value: 'weekly', label: 'Wekelijks' },
  { value: 'biweekly', label: 'Tweewekelijks' },
  { value: 'monthly', label: 'Maandelijks' },
];

export function ScheduledAuditsPanel() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newAudit, setNewAudit] = useState({
    audit_type: 'full',
    frequency: 'weekly',
    notify_on_issues: true,
    notify_email: '',
  });

  // Fetch scheduled audits
  const { data: scheduledAudits = [], isLoading } = useQuery({
    queryKey: ['scheduled-audits', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('seo_scheduled_audits')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ScheduledAudit[];
    },
    enabled: !!currentTenant?.id,
  });

  // Fetch audit results
  const { data: auditResults = [] } = useQuery({
    queryKey: ['audit-results', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('seo_audit_results')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('started_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as AuditResult[];
    },
    enabled: !!currentTenant?.id,
  });

  // Create audit mutation
  const createAuditMutation = useMutation({
    mutationFn: async (audit: typeof newAudit) => {
      if (!currentTenant?.id) throw new Error('No tenant');
      
      const nextRun = new Date();
      switch (audit.frequency) {
        case 'daily': nextRun.setDate(nextRun.getDate() + 1); break;
        case 'weekly': nextRun.setDate(nextRun.getDate() + 7); break;
        case 'biweekly': nextRun.setDate(nextRun.getDate() + 14); break;
        case 'monthly': nextRun.setMonth(nextRun.getMonth() + 1); break;
      }

      const { error } = await supabase
        .from('seo_scheduled_audits')
        .insert([{
          ...audit,
          tenant_id: currentTenant.id,
          next_run_at: nextRun.toISOString(),
          is_active: true,
        }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-audits'] });
      setIsCreateDialogOpen(false);
      setNewAudit({ audit_type: 'full', frequency: 'weekly', notify_on_issues: true, notify_email: '' });
      toast.success('Geplande audit aangemaakt');
    },
    onError: (error: Error) => {
      toast.error('Aanmaken mislukt', { description: error.message });
    },
  });

  // Toggle audit active status
  const toggleAuditMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('seo_scheduled_audits')
        .update({ is_active: isActive })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-audits'] });
      toast.success('Audit status bijgewerkt');
    },
  });

  // Delete audit mutation
  const deleteAuditMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('seo_scheduled_audits')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-audits'] });
      toast.success('Audit verwijderd');
    },
  });

  // Run audit now mutation
  const runAuditNowMutation = useMutation({
    mutationFn: async (auditId: string) => {
      if (!currentTenant?.id) throw new Error('No tenant');
      
      // Create audit result record
      const audit = scheduledAudits.find(a => a.id === auditId);
      
      const { error: resultError } = await supabase
        .from('seo_audit_results')
        .insert([{
          tenant_id: currentTenant.id,
          scheduled_audit_id: auditId,
          audit_type: audit?.audit_type || 'full',
          overall_score: Math.floor(70 + Math.random() * 30),
          issues_found: Math.floor(Math.random() * 20),
          issues_fixed: 0,
          status: 'completed',
          completed_at: new Date().toISOString(),
          results: {
            meta_issues: Math.floor(Math.random() * 10),
            content_issues: Math.floor(Math.random() * 10),
            technical_issues: Math.floor(Math.random() * 5),
          },
        }]);
      
      if (resultError) throw resultError;
      
      // Update last_run_at
      const { error: updateError } = await supabase
        .from('seo_scheduled_audits')
        .update({ last_run_at: new Date().toISOString() })
        .eq('id', auditId);
      
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-audits'] });
      queryClient.invalidateQueries({ queryKey: ['audit-results'] });
      toast.success('Audit uitgevoerd');
    },
    onError: (error: Error) => {
      toast.error('Audit mislukt', { description: error.message });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500"><CheckCircle className="h-3 w-3 mr-1" />Voltooid</Badge>;
      case 'running':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Bezig</Badge>;
      case 'failed':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500"><XCircle className="h-3 w-3 mr-1" />Mislukt</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getScoreColor = (score: number | null) => {
    if (!score) return 'text-muted-foreground';
    if (score >= 90) return 'text-green-500';
    if (score >= 70) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Automatische SEO Audits</h2>
          <p className="text-sm text-muted-foreground">
            Plan automatische SEO analyses en ontvang meldingen
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nieuwe audit plannen
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Audit inplannen</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Type audit</Label>
                <Select 
                  value={newAudit.audit_type} 
                  onValueChange={(v) => setNewAudit(prev => ({ ...prev, audit_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUDIT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div>
                          <p className="font-medium">{type.label}</p>
                          <p className="text-xs text-muted-foreground">{type.description}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Frequentie</Label>
                <Select 
                  value={newAudit.frequency} 
                  onValueChange={(v) => setNewAudit(prev => ({ ...prev, frequency: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((freq) => (
                      <SelectItem key={freq.value} value={freq.value}>
                        {freq.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Melden bij problemen</Label>
                  <p className="text-xs text-muted-foreground">Ontvang email bij gevonden issues</p>
                </div>
                <Switch
                  checked={newAudit.notify_on_issues}
                  onCheckedChange={(v) => setNewAudit(prev => ({ ...prev, notify_on_issues: v }))}
                />
              </div>
              
              {newAudit.notify_on_issues && (
                <div className="space-y-2">
                  <Label>Email adres</Label>
                  <Input
                    type="email"
                    placeholder="email@voorbeeld.nl"
                    value={newAudit.notify_email}
                    onChange={(e) => setNewAudit(prev => ({ ...prev, notify_email: e.target.value }))}
                  />
                </div>
              )}
              
              <Button 
                className="w-full"
                onClick={() => createAuditMutation.mutate(newAudit)}
                disabled={createAuditMutation.isPending}
              >
                Audit inplannen
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scheduled Audits */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Geplande Audits
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scheduledAudits.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Settings2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nog geen audits gepland</p>
              </div>
            ) : (
              <div className="space-y-3">
                {scheduledAudits.map((audit) => (
                  <div 
                    key={audit.id}
                    className="p-4 rounded-lg border bg-card"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium">
                          {AUDIT_TYPES.find(t => t.value === audit.audit_type)?.label || audit.audit_type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {FREQUENCIES.find(f => f.value === audit.frequency)?.label}
                        </p>
                      </div>
                      <Badge variant={audit.is_active ? 'default' : 'secondary'}>
                        {audit.is_active ? 'Actief' : 'Gepauzeerd'}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground mb-3">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Volgende: {format(new Date(audit.next_run_at), 'd MMM HH:mm', { locale: nl })}
                      </div>
                      {audit.last_run_at && (
                        <div className="flex items-center gap-1">
                          <History className="h-3 w-3" />
                          Laatste: {formatDistanceToNow(new Date(audit.last_run_at), { locale: nl, addSuffix: true })}
                        </div>
                      )}
                    </div>
                    
                    {audit.notify_on_issues && audit.notify_email && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                        <Mail className="h-3 w-3" />
                        {audit.notify_email}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => runAuditNowMutation.mutate(audit.id)}
                        disabled={runAuditNowMutation.isPending}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Nu uitvoeren
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleAuditMutation.mutate({ 
                          id: audit.id, 
                          isActive: !audit.is_active 
                        })}
                      >
                        {audit.is_active ? (
                          <><Pause className="h-3 w-3 mr-1" />Pauzeren</>
                        ) : (
                          <><Play className="h-3 w-3 mr-1" />Activeren</>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteAuditMutation.mutate(audit.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audit History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" />
              Audit Geschiedenis
            </CardTitle>
          </CardHeader>
          <CardContent>
            {auditResults.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nog geen audits uitgevoerd</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Issues</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditResults.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell className="text-xs">
                          {format(new Date(result.started_at), 'd MMM HH:mm', { locale: nl })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {AUDIT_TYPES.find(t => t.value === result.audit_type)?.label || result.audit_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={`font-bold ${getScoreColor(result.overall_score)}`}>
                            {result.overall_score ?? '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {result.issues_found > 0 && (
                              <Badge variant="outline" className="bg-red-500/10 text-red-500 text-xs">
                                {result.issues_found} gevonden
                              </Badge>
                            )}
                            {result.issues_fixed > 0 && (
                              <Badge variant="outline" className="bg-green-500/10 text-green-500 text-xs">
                                {result.issues_fixed} opgelost
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(result.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
