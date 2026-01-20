import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Search, 
  Plus, 
  Trash2, 
  TrendingUp, 
  TrendingDown,
  Minus,
  Star,
  Wand2,
  Loader2,
  Target,
  ShoppingCart,
  HelpCircle,
  Navigation
} from 'lucide-react';
import { toast } from 'sonner';
import { SEO_LANGUAGES, type SEOKeyword, type SEOLanguage } from '@/types/seo';

interface KeywordResearchPanelProps {
  keywords: SEOKeyword[];
  onAddKeyword: (keyword: Omit<SEOKeyword, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) => void;
  onDeleteKeyword: (id: string) => void;
  onGenerateKeywords?: (productId: string, language: SEOLanguage) => Promise<void>;
  isLoading?: boolean;
  isGenerating?: boolean;
}

const volumeColors = {
  high: 'bg-green-500/10 text-green-600 border-green-500/20',
  medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  low: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
};

const difficultyColors = {
  easy: 'bg-green-500/10 text-green-600 border-green-500/20',
  medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  hard: 'bg-red-500/10 text-red-600 border-red-500/20',
};

const intentIcons = {
  informational: HelpCircle,
  commercial: Target,
  transactional: ShoppingCart,
  navigational: Navigation,
};

const intentLabels = {
  informational: 'Informatief',
  commercial: 'Commercieel',
  transactional: 'Transactioneel',
  navigational: 'Navigatie',
};

export function KeywordResearchPanel({
  keywords,
  onAddKeyword,
  onDeleteKeyword,
  onGenerateKeywords,
  isLoading,
  isGenerating,
}: KeywordResearchPanelProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<SEOLanguage>('nl');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newKeyword, setNewKeyword] = useState({
    keyword: '',
    language: 'nl' as SEOLanguage,
    search_volume_estimate: 'medium' as const,
    difficulty_estimate: 'medium' as const,
    intent: 'commercial' as const,
    is_primary: false,
  });

  const filteredKeywords = keywords.filter(k => k.language === selectedLanguage);
  const primaryKeywords = filteredKeywords.filter(k => k.is_primary);
  const secondaryKeywords = filteredKeywords.filter(k => !k.is_primary);

  const handleAddKeyword = () => {
    if (!newKeyword.keyword.trim()) {
      toast.error('Voer een keyword in');
      return;
    }

    onAddKeyword({
      keyword: newKeyword.keyword.trim(),
      language: newKeyword.language,
      search_volume_estimate: newKeyword.search_volume_estimate,
      difficulty_estimate: newKeyword.difficulty_estimate,
      intent: newKeyword.intent,
      is_primary: newKeyword.is_primary,
      product_id: null,
      category_id: null,
      position_tracking: [],
    });

    setNewKeyword({
      keyword: '',
      language: selectedLanguage,
      search_volume_estimate: 'medium',
      difficulty_estimate: 'medium',
      intent: 'commercial',
      is_primary: false,
    });
    setIsAddDialogOpen(false);
  };

  const getVolumeIcon = (volume: string | null) => {
    if (volume === 'high') return <TrendingUp className="h-3 w-3" />;
    if (volume === 'low') return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Keyword Research
            </CardTitle>
            <CardDescription>
              Beheer je SEO keywords per taal voor betere vindbaarheid
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Keyword Toevoegen
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nieuw Keyword Toevoegen</DialogTitle>
                <DialogDescription>
                  Voeg een nieuw keyword toe aan je SEO strategie.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Keyword</Label>
                  <Input
                    placeholder="bijv. handgemaakte sieraden"
                    value={newKeyword.keyword}
                    onChange={(e) => setNewKeyword({ ...newKeyword, keyword: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Taal</Label>
                    <Select
                      value={newKeyword.language}
                      onValueChange={(v) => setNewKeyword({ ...newKeyword, language: v as SEOLanguage })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SEO_LANGUAGES.map((lang) => (
                          <SelectItem key={lang.code} value={lang.code}>
                            {lang.flag} {lang.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={newKeyword.is_primary ? 'primary' : 'secondary'}
                      onValueChange={(v) => setNewKeyword({ ...newKeyword, is_primary: v === 'primary' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="primary">Primair</SelectItem>
                        <SelectItem value="secondary">Secundair</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Zoekvolume</Label>
                    <Select
                      value={newKeyword.search_volume_estimate}
                      onValueChange={(v) => setNewKeyword({ ...newKeyword, search_volume_estimate: v as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">Hoog</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Laag</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Moeilijkheid</Label>
                    <Select
                      value={newKeyword.difficulty_estimate}
                      onValueChange={(v) => setNewKeyword({ ...newKeyword, difficulty_estimate: v as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Makkelijk</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Moeilijk</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Zoekintentie</Label>
                  <Select
                    value={newKeyword.intent}
                    onValueChange={(v) => setNewKeyword({ ...newKeyword, intent: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="informational">Informatief - Wil iets leren</SelectItem>
                      <SelectItem value="commercial">Commercieel - Vergelijkt opties</SelectItem>
                      <SelectItem value="transactional">Transactioneel - Wil kopen</SelectItem>
                      <SelectItem value="navigational">Navigatie - Zoekt specifieke site</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Annuleren
                </Button>
                <Button onClick={handleAddKeyword}>Toevoegen</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {/* Language Tabs */}
        <Tabs value={selectedLanguage} onValueChange={(v) => setSelectedLanguage(v as SEOLanguage)}>
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              {SEO_LANGUAGES.map((lang) => (
                <TabsTrigger key={lang.code} value={lang.code} className="gap-1">
                  <span>{lang.flag}</span>
                  <span className="hidden sm:inline">{lang.label}</span>
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {keywords.filter(k => k.language === lang.code).length}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
            {onGenerateKeywords && (
              <Button variant="outline" size="sm" disabled={isGenerating}>
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4 mr-2" />
                )}
                AI Suggesties
              </Button>
            )}
          </div>

          {SEO_LANGUAGES.map((lang) => (
            <TabsContent key={lang.code} value={lang.code}>
              {filteredKeywords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nog geen keywords voor {lang.label}</p>
                  <p className="text-sm">Voeg keywords toe of gebruik AI suggesties</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Primary Keywords */}
                  {primaryKeywords.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                        <Star className="h-4 w-4 text-yellow-500" />
                        Primaire Keywords ({primaryKeywords.length})
                      </h4>
                      <ScrollArea className="h-[150px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Keyword</TableHead>
                              <TableHead>Volume</TableHead>
                              <TableHead>Moeilijkheid</TableHead>
                              <TableHead>Intentie</TableHead>
                              <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {primaryKeywords.map((kw) => {
                              const IntentIcon = kw.intent ? intentIcons[kw.intent] : HelpCircle;
                              return (
                                <TableRow key={kw.id}>
                                  <TableCell className="font-medium">{kw.keyword}</TableCell>
                                  <TableCell>
                                    {kw.search_volume_estimate && (
                                      <Badge variant="outline" className={volumeColors[kw.search_volume_estimate]}>
                                        {getVolumeIcon(kw.search_volume_estimate)}
                                        <span className="ml-1 capitalize">{kw.search_volume_estimate}</span>
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {kw.difficulty_estimate && (
                                      <Badge variant="outline" className={difficultyColors[kw.difficulty_estimate]}>
                                        {kw.difficulty_estimate === 'easy' ? 'Makkelijk' : 
                                         kw.difficulty_estimate === 'medium' ? 'Medium' : 'Moeilijk'}
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {kw.intent && (
                                      <div className="flex items-center gap-1 text-muted-foreground">
                                        <IntentIcon className="h-3 w-3" />
                                        <span className="text-xs">{intentLabels[kw.intent]}</span>
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                      onClick={() => onDeleteKeyword(kw.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </div>
                  )}

                  {/* Secondary Keywords */}
                  {secondaryKeywords.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">
                        Secundaire Keywords ({secondaryKeywords.length})
                      </h4>
                      <ScrollArea className="h-[200px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Keyword</TableHead>
                              <TableHead>Volume</TableHead>
                              <TableHead>Moeilijkheid</TableHead>
                              <TableHead>Intentie</TableHead>
                              <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {secondaryKeywords.map((kw) => {
                              const IntentIcon = kw.intent ? intentIcons[kw.intent] : HelpCircle;
                              return (
                                <TableRow key={kw.id}>
                                  <TableCell>{kw.keyword}</TableCell>
                                  <TableCell>
                                    {kw.search_volume_estimate && (
                                      <Badge variant="outline" className={volumeColors[kw.search_volume_estimate]}>
                                        {getVolumeIcon(kw.search_volume_estimate)}
                                        <span className="ml-1 capitalize">{kw.search_volume_estimate}</span>
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {kw.difficulty_estimate && (
                                      <Badge variant="outline" className={difficultyColors[kw.difficulty_estimate]}>
                                        {kw.difficulty_estimate === 'easy' ? 'Makkelijk' : 
                                         kw.difficulty_estimate === 'medium' ? 'Medium' : 'Moeilijk'}
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {kw.intent && (
                                      <div className="flex items-center gap-1 text-muted-foreground">
                                        <IntentIcon className="h-3 w-3" />
                                        <span className="text-xs">{intentLabels[kw.intent]}</span>
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                      onClick={() => onDeleteKeyword(kw.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
