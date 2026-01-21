import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Plus, 
  Trash2, 
  Globe, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Search,
  ExternalLink,
  BarChart3,
  Target,
  Users
} from 'lucide-react';
import { useTenant } from '@/hooks/useTenant';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Competitor {
  id: string;
  name: string;
  domain: string;
  keywords: string[];
  tracked_at: string;
}

interface KeywordComparison {
  id: string;
  keyword: string;
  our_position: number | null;
  competitor_position: number | null;
  search_volume: number | null;
  difficulty_score: number | null;
}

export function CompetitorAnalysisPanel() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newCompetitor, setNewCompetitor] = useState({ name: '', domain: '' });
  const [selectedCompetitor, setSelectedCompetitor] = useState<string | null>(null);
  const [newKeyword, setNewKeyword] = useState('');

  // Fetch competitors
  const { data: competitors = [], isLoading } = useQuery({
    queryKey: ['seo-competitors', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('seo_competitors')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Competitor[];
    },
    enabled: !!currentTenant?.id,
  });

  // Fetch keyword comparisons for selected competitor
  const { data: keywordComparisons = [] } = useQuery({
    queryKey: ['seo-competitor-keywords', selectedCompetitor],
    queryFn: async () => {
      if (!selectedCompetitor || !currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('seo_competitor_keywords')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('competitor_id', selectedCompetitor)
        .order('search_volume', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as KeywordComparison[];
    },
    enabled: !!selectedCompetitor && !!currentTenant?.id,
  });

  // Add competitor mutation
  const addCompetitorMutation = useMutation({
    mutationFn: async (competitor: { name: string; domain: string }) => {
      if (!currentTenant?.id) throw new Error('No tenant');
      const { error } = await supabase
        .from('seo_competitors')
        .insert([{ 
          ...competitor, 
          tenant_id: currentTenant.id,
          keywords: []
        }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo-competitors'] });
      setIsAddDialogOpen(false);
      setNewCompetitor({ name: '', domain: '' });
      toast.success('Concurrent toegevoegd');
    },
    onError: (error: Error) => {
      toast.error('Toevoegen mislukt', { description: error.message });
    },
  });

  // Delete competitor mutation
  const deleteCompetitorMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('seo_competitors')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo-competitors'] });
      if (selectedCompetitor) setSelectedCompetitor(null);
      toast.success('Concurrent verwijderd');
    },
  });

  // Add keyword comparison mutation
  const addKeywordMutation = useMutation({
    mutationFn: async ({ competitorId, keyword }: { competitorId: string; keyword: string }) => {
      if (!currentTenant?.id) throw new Error('No tenant');
      
      // Simulate keyword data (in real app, would fetch from SEO API)
      const simulatedData = {
        tenant_id: currentTenant.id,
        competitor_id: competitorId,
        keyword,
        our_position: Math.floor(Math.random() * 50) + 1,
        competitor_position: Math.floor(Math.random() * 50) + 1,
        search_volume: Math.floor(Math.random() * 10000) + 100,
        difficulty_score: Math.floor(Math.random() * 100),
      };

      const { error } = await supabase
        .from('seo_competitor_keywords')
        .insert([simulatedData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo-competitor-keywords'] });
      setNewKeyword('');
      toast.success('Keyword toegevoegd');
    },
    onError: (error: Error) => {
      toast.error('Toevoegen mislukt', { description: error.message });
    },
  });

  // Delete keyword mutation
  const deleteKeywordMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('seo_competitor_keywords')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo-competitor-keywords'] });
      toast.success('Keyword verwijderd');
    },
  });

  const getPositionBadge = (ourPos: number | null, theirPos: number | null) => {
    if (!ourPos || !theirPos) return null;
    
    if (ourPos < theirPos) {
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
          <TrendingUp className="h-3 w-3 mr-1" />
          +{theirPos - ourPos}
        </Badge>
      );
    } else if (ourPos > theirPos) {
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
          <TrendingDown className="h-3 w-3 mr-1" />
          -{ourPos - theirPos}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-muted">
        <Minus className="h-3 w-3 mr-1" />
        Gelijk
      </Badge>
    );
  };

  const getDifficultyColor = (score: number | null) => {
    if (!score) return 'text-muted-foreground';
    if (score < 30) return 'text-green-500';
    if (score < 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Calculate summary stats
  const keywordsWinning = keywordComparisons.filter(k => 
    k.our_position && k.competitor_position && k.our_position < k.competitor_position
  ).length;
  
  const keywordsLosing = keywordComparisons.filter(k => 
    k.our_position && k.competitor_position && k.our_position > k.competitor_position
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Concurrent Analyse</h2>
          <p className="text-sm text-muted-foreground">
            Vergelijk je SEO prestaties met concurrenten
          </p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Concurrent toevoegen
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nieuwe concurrent</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Naam</Label>
                <Input
                  placeholder="Concurrent naam"
                  value={newCompetitor.name}
                  onChange={(e) => setNewCompetitor(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Domein</Label>
                <Input
                  placeholder="example.com"
                  value={newCompetitor.domain}
                  onChange={(e) => setNewCompetitor(prev => ({ ...prev, domain: e.target.value }))}
                />
              </div>
              <Button 
                className="w-full"
                onClick={() => addCompetitorMutation.mutate(newCompetitor)}
                disabled={!newCompetitor.name || !newCompetitor.domain}
              >
                Toevoegen
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Competitors List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Concurrenten
            </CardTitle>
          </CardHeader>
          <CardContent>
            {competitors.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nog geen concurrenten toegevoegd
              </p>
            ) : (
              <div className="space-y-2">
                {competitors.map((competitor) => (
                  <div 
                    key={competitor.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedCompetitor === competitor.id 
                        ? 'border-primary bg-primary/5' 
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedCompetitor(competitor.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{competitor.name}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Globe className="h-3 w-3" />
                          {competitor.domain}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCompetitorMutation.mutate(competitor.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Keyword Comparison */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Keyword Vergelijking
                </CardTitle>
                <CardDescription>
                  {selectedCompetitor 
                    ? `${competitors.find(c => c.id === selectedCompetitor)?.name || 'Geselecteerd'}`
                    : 'Selecteer een concurrent'
                  }
                </CardDescription>
              </div>
              
              {selectedCompetitor && (
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span>Winnen: {keywordsWinning}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span>Verliezen: {keywordsLosing}</span>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedCompetitor ? (
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Selecteer een concurrent om keywords te vergelijken</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Add keyword */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Nieuw keyword toevoegen..."
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newKeyword) {
                        addKeywordMutation.mutate({ 
                          competitorId: selectedCompetitor, 
                          keyword: newKeyword 
                        });
                      }
                    }}
                  />
                  <Button
                    onClick={() => {
                      if (newKeyword) {
                        addKeywordMutation.mutate({ 
                          competitorId: selectedCompetitor, 
                          keyword: newKeyword 
                        });
                      }
                    }}
                    disabled={!newKeyword}
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Track
                  </Button>
                </div>

                {/* Keywords table */}
                {keywordComparisons.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Voeg keywords toe om te vergelijken</p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Keyword</TableHead>
                          <TableHead className="text-center">Jouw positie</TableHead>
                          <TableHead className="text-center">Concurrent</TableHead>
                          <TableHead className="text-center">Verschil</TableHead>
                          <TableHead className="text-right">Volume</TableHead>
                          <TableHead className="text-right">Moeilijkheid</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {keywordComparisons.map((kw) => (
                          <TableRow key={kw.id}>
                            <TableCell className="font-medium">{kw.keyword}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline">{kw.our_position || '-'}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary">{kw.competitor_position || '-'}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {getPositionBadge(kw.our_position, kw.competitor_position)}
                            </TableCell>
                            <TableCell className="text-right">
                              {kw.search_volume?.toLocaleString() || '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={getDifficultyColor(kw.difficulty_score)}>
                                {kw.difficulty_score || '-'}%
                              </span>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => deleteKeywordMutation.mutate(kw.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
