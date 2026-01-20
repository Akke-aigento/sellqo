import { useState } from 'react';
import { 
  FlaskConical, Plus, Trophy, BarChart3, 
  Loader2, ArrowRight, CheckCircle2, XCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useABTests, type ABTestConfig } from '@/hooks/useABTests';
import { useEmailCampaigns } from '@/hooks/useEmailCampaigns';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export function ABTestingPanel() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [campaignAId, setCampaignAId] = useState('');
  const [campaignBId, setCampaignBId] = useState('');
  const [testPercentage, setTestPercentage] = useState(50);
  const [testMetric, setTestMetric] = useState<'open_rate' | 'click_rate'>('open_rate');
  const [autoSelectWinner, setAutoSelectWinner] = useState(true);
  const [winnerThreshold, setWinnerThreshold] = useState(5);

  const { abTests: tests, isLoading, createABTest: createTest, selectWinner } = useABTests();
  const { campaigns } = useEmailCampaigns();

  // Filter campaigns that can be used for A/B testing (draft status)
  const availableCampaigns = campaigns?.filter(c => c.status === 'draft') || [];

  const handleCreateTest = async () => {
    if (!campaignAId || !campaignBId) return;

    await createTest.mutateAsync({
      campaign_a_id: campaignAId,
      campaign_b_id: campaignBId,
      test_percentage: testPercentage,
      test_metric: testMetric,
      auto_select_winner: autoSelectWinner,
      winner_threshold: winnerThreshold,
    });

    setCreateDialogOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setCampaignAId('');
    setCampaignBId('');
    setTestPercentage(50);
    setTestMetric('open_rate');
    setAutoSelectWinner(true);
    setWinnerThreshold(5);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      pending: { variant: 'outline', label: 'In afwachting' },
      running: { variant: 'default', label: 'Actief' },
      completed: { variant: 'secondary', label: 'Voltooid' },
      cancelled: { variant: 'destructive', label: 'Geannuleerd' },
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const calculateWinnerStats = (test: ABTestConfig) => {
    // Mock data - in real implementation this would come from campaign stats
    const aRate = 24.5;
    const bRate = 28.2;
    const winner = bRate > aRate ? 'B' : 'A';
    const improvement = Math.abs(((bRate - aRate) / aRate) * 100);
    
    return { aRate, bRate, winner, improvement };
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600">
                  <FlaskConical className="h-4 w-4 text-white" />
                </div>
                A/B Testing
              </CardTitle>
              <CardDescription>
                Test verschillende versies van je campagnes
              </CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nieuwe Test
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : tests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FlaskConical className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nog geen A/B tests</p>
              <p className="text-sm">Maak een test om campagne varianten te vergelijken</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tests.map((test) => {
                const stats = calculateWinnerStats(test);
                
                return (
                  <div
                    key={test.id}
                    className="p-4 rounded-lg border bg-muted/30 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FlaskConical className="h-5 w-5" />
                        <div>
                          <p className="font-medium">A/B Test</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(test.created_at), 'PPp', { locale: nl })}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(test.status)}
                    </div>

                    {/* Comparison */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className={cn(
                        'p-3 rounded-lg border',
                        test.winner_id === test.campaign_a_id && 'border-green-500 bg-green-500/10'
                      )}>
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline">Versie A</Badge>
                          {test.winner_id === test.campaign_a_id && (
                            <Trophy className="h-4 w-4 text-green-500" />
                          )}
                        </div>
                        <p className="text-2xl font-bold">{stats.aRate}%</p>
                        <p className="text-xs text-muted-foreground">
                          {test.test_metric === 'open_rate' ? 'Open rate' : 'Click rate'}
                        </p>
                      </div>

                      <div className={cn(
                        'p-3 rounded-lg border',
                        test.winner_id === test.campaign_b_id && 'border-green-500 bg-green-500/10'
                      )}>
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline">Versie B</Badge>
                          {test.winner_id === test.campaign_b_id && (
                            <Trophy className="h-4 w-4 text-green-500" />
                          )}
                        </div>
                        <p className="text-2xl font-bold">{stats.bRate}%</p>
                        <p className="text-xs text-muted-foreground">
                          {test.test_metric === 'open_rate' ? 'Open rate' : 'Click rate'}
                        </p>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Test verdeling</span>
                        <span>{test.test_percentage}% / {100 - test.test_percentage}%</span>
                      </div>
                      <Progress value={test.test_percentage} />
                    </div>

                    {/* Actions */}
                    {test.status === 'running' && !test.winner_id && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => selectWinner.mutate({ testId: test.id, winnerId: test.campaign_a_id })}
                          disabled={selectWinner.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Kies A als winnaar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => selectWinner.mutate({ testId: test.id, winnerId: test.campaign_b_id })}
                          disabled={selectWinner.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Kies B als winnaar
                        </Button>
                      </div>
                    )}

                    {test.winner_id && (
                      <div className="flex items-center gap-2 p-2 rounded bg-green-500/10 text-green-700 dark:text-green-400 text-sm">
                        <Trophy className="h-4 w-4" />
                        <span>
                          Versie {test.winner_id === test.campaign_a_id ? 'A' : 'B'} wint met +{stats.improvement.toFixed(1)}% verbetering
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Test Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nieuwe A/B Test</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Campaign A */}
            <div className="space-y-2">
              <Label>Campagne A (Controle)</Label>
              <Select value={campaignAId} onValueChange={setCampaignAId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer campagne A" />
                </SelectTrigger>
                <SelectContent>
                  {availableCampaigns
                    .filter(c => c.id !== campaignBId)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Campaign B */}
            <div className="space-y-2">
              <Label>Campagne B (Variant)</Label>
              <Select value={campaignBId} onValueChange={setCampaignBId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer campagne B" />
                </SelectTrigger>
                <SelectContent>
                  {availableCampaigns
                    .filter(c => c.id !== campaignAId)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Test Metric */}
            <div className="space-y-2">
              <Label>Test metriek</Label>
              <Select value={testMetric} onValueChange={(v) => setTestMetric(v as 'open_rate' | 'click_rate')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open_rate">Open rate</SelectItem>
                  <SelectItem value="click_rate">Click rate</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Test Percentage */}
            <div className="space-y-2">
              <Label>Verdeling (% naar variant B)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={10}
                  max={90}
                  value={testPercentage}
                  onChange={(e) => setTestPercentage(Number(e.target.value))}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">
                  {100 - testPercentage}% A / {testPercentage}% B
                </span>
              </div>
            </div>

            {/* Auto Select Winner */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label>Automatisch winnaar kiezen</Label>
                <p className="text-xs text-muted-foreground">
                  Na voldoende data automatisch de beste selecteren
                </p>
              </div>
              <Switch
                checked={autoSelectWinner}
                onCheckedChange={setAutoSelectWinner}
              />
            </div>

            {autoSelectWinner && (
              <div className="space-y-2">
                <Label>Minimum verschil (%)</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={winnerThreshold}
                  onChange={(e) => setWinnerThreshold(Number(e.target.value))}
                  className="w-20"
                />
                <p className="text-xs text-muted-foreground">
                  Winnaar wordt gekozen bij minimaal {winnerThreshold}% verschil
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Annuleren
            </Button>
            <Button
              onClick={handleCreateTest}
              disabled={!campaignAId || !campaignBId || createTest.isPending}
            >
              {createTest.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FlaskConical className="h-4 w-4 mr-2" />
              )}
              Test Starten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
