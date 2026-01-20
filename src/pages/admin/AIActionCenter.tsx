import { useState } from 'react';
import { 
  Brain, 
  RefreshCw, 
  Filter, 
  AlertTriangle,
  Package,
  Megaphone,
  UserCheck,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAIActions } from '@/hooks/useAIActions';
import { AIActionCard } from '@/components/admin/ai/AIActionCard';
import { AIActionPreviewDialog } from '@/components/admin/ai/AIActionPreviewDialog';
import type { AIActionSuggestion, AISuggestionType, AISuggestionStatus } from '@/types/aiActions';
import { FeatureGate } from '@/components/FeatureGate';

export default function AIActionCenter() {
  const { 
    pendingSuggestions, 
    suggestionsLoading, 
    suggestionCounts,
    triggerAnalysis,
    executeSuggestion,
    rejectSuggestion,
    useSuggestions,
  } = useAIActions();

  const [selectedSuggestion, setSelectedSuggestion] = useState<AIActionSuggestion | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<AISuggestionType | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'pending' | 'executed' | 'rejected'>('pending');

  // Fetch history based on active tab
  const { data: historySuggestions } = useSuggestions({ 
    status: activeTab === 'executed' ? 'executed' : 
            activeTab === 'rejected' ? 'rejected' : undefined 
  });

  const handlePreview = (suggestion: AIActionSuggestion) => {
    setSelectedSuggestion(suggestion);
    setPreviewOpen(true);
  };

  const handleQuickExecute = async (suggestion: AIActionSuggestion) => {
    await executeSuggestion.mutateAsync({ suggestionId: suggestion.id });
  };

  const handleReject = async (suggestion: AIActionSuggestion) => {
    await rejectSuggestion.mutateAsync(suggestion.id);
  };

  const filteredPending = pendingSuggestions?.filter(s => 
    typeFilter === 'all' || s.suggestion_type === typeFilter
  ) || [];

  const filteredHistory = historySuggestions?.filter(s => 
    typeFilter === 'all' || s.suggestion_type === typeFilter
  ) || [];

  const currentSuggestions = activeTab === 'pending' 
    ? filteredPending 
    : filteredHistory.filter(s =>
        typeFilter === 'all' || s.suggestion_type === typeFilter
      ) || [];

  return (
    <FeatureGate feature="ai_marketing">
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold flex items-center gap-2">
                <Brain className="h-6 w-6 text-primary" />
                AI Actie Centrum
              </h1>
              <p className="text-muted-foreground mt-1">
                Proactieve suggesties en acties van je AI assistent
              </p>
            </div>
            <Button
              onClick={() => triggerAnalysis.mutate()}
              disabled={triggerAnalysis.isPending}
            >
              {triggerAnalysis.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Nieuwe Analyse
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Openstaand</p>
                    <p className="text-2xl font-bold">{suggestionCounts?.total || 0}</p>
                  </div>
                  <Clock className="h-8 w-8 text-muted-foreground/50" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-red-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Urgent</p>
                    <p className="text-2xl font-bold text-red-600">{suggestionCounts?.urgent || 0}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-500/50" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-orange-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Hoge prioriteit</p>
                    <p className="text-2xl font-bold text-orange-600">{suggestionCounts?.high || 0}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-orange-500/50" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Type verdeling</p>
                    <div className="flex gap-1 mt-1">
                      {suggestionCounts?.byType.slice(0, 3).map(([type]) => (
                        <Badge key={type} variant="secondary" className="text-xs">
                          {type.split('_')[0]}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Brain className="h-8 w-8 text-primary/50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs and Filters */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <TabsList>
                <TabsTrigger value="pending" className="gap-1">
                  <Clock className="h-4 w-4" />
                  Openstaand ({suggestionCounts?.total || 0})
                </TabsTrigger>
                <TabsTrigger value="executed" className="gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Uitgevoerd
                </TabsTrigger>
                <TabsTrigger value="rejected" className="gap-1">
                  <XCircle className="h-4 w-4" />
                  Afgewezen
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Alle types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle types</SelectItem>
                    <SelectItem value="stock_alert">
                      <span className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" /> Stock Alerts
                      </span>
                    </SelectItem>
                    <SelectItem value="purchase_order">
                      <span className="flex items-center gap-2">
                        <Package className="h-4 w-4" /> Inkooporders
                      </span>
                    </SelectItem>
                    <SelectItem value="marketing_campaign">
                      <span className="flex items-center gap-2">
                        <Megaphone className="h-4 w-4" /> Marketing
                      </span>
                    </SelectItem>
                    <SelectItem value="customer_winback">
                      <span className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4" /> Win-back
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <TabsContent value="pending" className="mt-6">
              {suggestionsLoading ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-40" />
                  ))}
                </div>
              ) : currentSuggestions.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <h3 className="font-medium text-lg mb-2">Geen openstaande suggesties</h3>
                    <p className="text-muted-foreground mb-4">
                      Je AI assistent monitort continu je bedrijf. Nieuwe suggesties verschijnen hier.
                    </p>
                    <Button onClick={() => triggerAnalysis.mutate()} disabled={triggerAnalysis.isPending}>
                      <RefreshCw className={`h-4 w-4 mr-2 ${triggerAnalysis.isPending ? 'animate-spin' : ''}`} />
                      Analyse uitvoeren
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {currentSuggestions.map(suggestion => (
                    <AIActionCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      onPreview={handlePreview}
                      onQuickExecute={handleQuickExecute}
                      onReject={handleReject}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="executed" className="mt-6">
              {currentSuggestions.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nog geen uitgevoerde acties</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {currentSuggestions.map(suggestion => (
                    <AIActionCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      onPreview={handlePreview}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="rejected" className="mt-6">
              {currentSuggestions.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <XCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Geen afgewezen suggesties</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {currentSuggestions.map(suggestion => (
                    <AIActionCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      onPreview={handlePreview}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <AIActionPreviewDialog
          suggestion={selectedSuggestion}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
        />
      </AdminLayout>
    </FeatureGate>
  );
}
