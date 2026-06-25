import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Globe, 
  Languages, 
  Lock, 
  Unlock, 
  RefreshCw, 
  Check, 
  AlertCircle,
  Package,
  FolderTree,
  FileText,
  Settings,
  Play,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { useTranslations } from '@/hooks/useTranslations';
import { useTenant } from '@/hooks/useTenant';
import { useAICredits } from '@/hooks/useAICredits';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { AICreditsBadge } from '@/components/admin/marketing/AICreditsBadge';
import { CreditPurchaseDialog } from '@/components/admin/marketing/CreditPurchaseDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { 
  TRANSLATION_LANGUAGES, 
  ENTITY_TYPE_LABELS,
  type TranslatableEntityType, 
  type TranslationLanguage 
} from '@/types/translation';

const ENTITY_ICONS: Record<TranslatableEntityType, React.ElementType> = {
  product: Package,
  category: FolderTree,
  email_template: FileText,
  page: FileText,
};

export default function TranslationHub() {
  const { currentTenant } = useTenant();
  const { credits, hasCredits, getCreditCost, isUnlimited } = useAICredits();
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const { 
    settings, 
    settingsLoading,
    stats,
    statsLoading,
    jobs,
    jobsLoading,
    pendingEntities,
    pendingLoading,
    saveSettings,
    toggleLock,
    startBulkTranslation,
    translateEntity,
  } = useTranslations({ onInsufficientCredits: () => setPurchaseOpen(true) });
  const { products } = useProducts();
  const { categories } = useCategories();

  const [selectedEntityType, setSelectedEntityType] = useState<TranslatableEntityType>('product');
  const [selectedLanguage, setSelectedLanguage] = useState<TranslationLanguage>('en');
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Record<TranslatableEntityType, Set<string>>>({
    product: new Set(),
    category: new Set(),
    email_template: new Set(),
    page: new Set(),
  });
  const [bulkScope, setBulkScope] = useState<'all' | 'missing' | 'selected'>('missing');
  const [bulkMode, setBulkMode] = useState<'missing' | 'all'>('missing');
  const [bulkLanguages, setBulkLanguages] = useState<TranslationLanguage[]>([]);

  // Initialise bulk language selection from tenant settings (once they load)
  useEffect(() => {
    if (bulkLanguages.length === 0 && settings?.target_languages?.length) {
      setBulkLanguages(settings.target_languages as TranslationLanguage[]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.target_languages?.join(',')]);

  const currentSelected = selectedIds[selectedEntityType];

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev[selectedEntityType]);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...prev, [selectedEntityType]: next };
    });
  };

  const toggleLang = (code: TranslationLanguage) => {
    setBulkLanguages(prev =>
      prev.includes(code) ? prev.filter(l => l !== code) : [...prev, code]
    );
  };

  if (!currentTenant) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Selecteer eerst een winkel</p>
      </div>
    );
  }

  // Field counts must match the edge function FIELD_CONFIGS exactly.
  const FIELDS_PER_ENTITY: Record<TranslatableEntityType, number> = {
    product: 5,
    category: 4,
    email_template: 0,
    page: 0,
  };
  const perCreditCost = getCreditCost('translation');
  const perEntityCost =
    FIELDS_PER_ENTITY[selectedEntityType] * 1 * perCreditCost; // 1 entity × 1 lang via dropdown
  const availableCredits = credits?.available || 0;

  const handleBulkTranslate = async () => {
    if (!bulkLanguages.length) {
      toast.error('Kies minstens één doeltaal');
      return;
    }
    const ids =
      bulkScope === 'selected'
        ? Array.from(currentSelected)
        : bulkScope === 'missing'
          ? entitiesForScope.filter(e => e.coverage < 100).map(e => e.id)
          : entitiesForScope.map(e => e.id);
    if (!ids.length) {
      toast.error('Geen items om te vertalen in deze scope');
      return;
    }
    try {
      await startBulkTranslation.mutateAsync({
        entityTypes: [selectedEntityType],
        targetLanguages: bulkLanguages,
        mode: bulkMode,
        entityIds: ids,
      });
      setBulkDialogOpen(false);
      setSelectedIds(prev => ({ ...prev, [selectedEntityType]: new Set() }));
      toast.success('Bulk vertaling gestart');
    } catch {
      // Error toast (including insufficient-credits CTA) is handled by the hook's onError.
    }
  };

  const handleTranslateEntity = async (entityType: TranslatableEntityType, entityId: string) => {
    try {
      await translateEntity.mutateAsync({
        entityType,
        entityId,
        targetLanguages: [selectedLanguage],
      });
      toast.success('Vertaling voltooid');
    } catch {
      // Error toast (including insufficient-credits CTA) is handled by the hook's onError.
    }
  };

  const handleSettingChange = async (key: string, value: boolean) => {
    if (!settings) return;
    try {
      await saveSettings.mutateAsync({
        ...settings,
        [key]: value,
      });
    } catch (error) {
      toast.error('Fout bij opslaan instellingen');
    }
  };

  // Active jobs (processing or pending)
  const activeJobs = jobs?.filter(j => j.status === 'processing' || j.status === 'pending') || [];

  // Get entity data based on type
  const getEntityData = () => {
    if (selectedEntityType === 'product') {
      return pendingEntities?.products || [];
    }
    if (selectedEntityType === 'category') {
      return pendingEntities?.categories || [];
    }
    return [];
  };

  const entityData = getEntityData();

  // All entities (not just pending)
  const getAllEntities = () => {
    if (selectedEntityType === 'product') {
      return products.map(p => {
        const pe = pendingEntities?.products.find(x => x.id === p.id);
        return {
        id: p.id,
        name: p.name,
        entity_type: 'product' as const,
        coverage: pe?.coverage ?? 0,
        missing: pe?.missing ?? 0,
        missingByLang: pe?.missingByLang ?? {},
      };});
    }
    if (selectedEntityType === 'category') {
      return categories.map(c => {
        const pe = pendingEntities?.categories.find(x => x.id === c.id);
        return {
        id: c.id,
        name: c.name,
        entity_type: 'category' as const,
        coverage: pe?.coverage ?? 0,
        missing: pe?.missing ?? 0,
        missingByLang: pe?.missingByLang ?? {},
      };});
    }
    return [];
  };

  const allEntities = getAllEntities();
  const entitiesForScope = allEntities;
  const incompleteEntities = allEntities.filter(e => e.coverage < 100);

  // Default-init bulk languages from settings the first time settings load
  if (bulkLanguages.length === 0 && settings?.target_languages?.length) {
    // best-effort init via state setter outside render is not allowed; use effect would be cleaner.
  }

  // Compute bulk cost based on current dialog selections
  const fieldsPerItem = FIELDS_PER_ENTITY[selectedEntityType];
  const scopeEntities =
    bulkScope === 'selected'
      ? allEntities.filter(e => currentSelected.has(e.id))
      : bulkScope === 'missing'
        ? incompleteEntities
        : allEntities;

  const bulkCost = (() => {
    if (!bulkLanguages.length || !fieldsPerItem) return 0;
    if (bulkMode === 'all') {
      return scopeEntities.length * fieldsPerItem * bulkLanguages.length * perCreditCost;
    }
    // 'missing' — sum per-entity missingByLang for the chosen languages
    let total = 0;
    for (const e of scopeEntities) {
      for (const lang of bulkLanguages) {
        total += e.missingByLang?.[lang] ?? 0;
      }
    }
    return total * perCreditCost;
  })();

  const canAffordBulk = isUnlimited || hasCredits(bulkCost);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" />
            Vertaal Hub
          </h1>
          <p className="text-muted-foreground">
            Beheer vertalingen voor al je content met AI
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <AICreditsBadge variant="compact" onUpgrade={() => setPurchaseOpen(true)} />
          <AlertDialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button>
                <Languages className="mr-2 h-4 w-4" />
                Bulk Vertalen
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Bulk vertaling starten</AlertDialogTitle>
                <AlertDialogDescription>
                  Dit zal alle {ENTITY_TYPE_LABELS[selectedEntityType].toLowerCase()} vertalen naar de geselecteerde talen. 
                  Bestaande niet-vergrendelde vertalingen worden overschreven.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-4">
                <Label className="text-sm font-medium mb-2 block">Doeltalen</Label>
                <div className="flex flex-wrap gap-2">
                  {TRANSLATION_LANGUAGES.filter(l => l.code !== 'nl').map(lang => (
                    <Badge key={lang.code} variant="secondary" className="text-sm">
                      {lang.flag} {lang.label}
                    </Badge>
                  ))}
                </div>
                <div className="mt-4 rounded-md border bg-muted/40 p-3 text-sm">
                  <p className="font-medium">
                    Geschatte kost: ~{bulkCost} {bulkCost === 1 ? 'credit' : 'credits'}
                  </p>
                  <p className="text-muted-foreground mt-1">
                    {isUnlimited
                      ? 'Je hebt onbeperkte credits (platform admin).'
                      : `Je hebt ${availableCredits} credits beschikbaar.`}
                  </p>
                  {!canAffordBulk && (
                    <button
                      type="button"
                      onClick={() => {
                        setBulkDialogOpen(false);
                        setPurchaseOpen(true);
                      }}
                      className="mt-2 text-sm font-medium text-primary hover:underline"
                    >
                      Onvoldoende credits — koop bij
                    </button>
                  )}
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuleren</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleBulkTranslate}
                  disabled={startBulkTranslation.isPending || !canAffordBulk}
                >
                  {startBulkTranslation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Start Vertaling
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totale dekking (alle content)</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.coverage || 0}%</div>
                <Progress value={stats?.coverage || 0} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.totalTranslations || 0} van {stats?.totalNeeded || 0} vertalingen
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Producten</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.products || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {pendingEntities?.products.length || 0} nog te vertalen
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categorieën</CardTitle>
            <FolderTree className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.categories || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {pendingEntities?.categories.length || 0} nog te vertalen
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Per Taal</CardTitle>
            <Languages className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="space-y-1">
                {stats?.byLanguage && Object.entries(stats.byLanguage).map(([lang, data]) => {
                  const langInfo = TRANSLATION_LANGUAGES.find(l => l.code === lang);
                  return (
                    <div key={lang} className="flex items-center justify-between text-sm">
                      <span>{langInfo?.flag} {langInfo?.code.toUpperCase()}</span>
                      <span className="text-muted-foreground">{data.coverage}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active Jobs */}
      {activeJobs.length > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Actieve Vertaaltaken
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeJobs.map(job => (
                <div key={job.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{job.job_type}</p>
                    <p className="text-xs text-muted-foreground">
                      {job.processed_items} / {job.total_items} items
                    </p>
                  </div>
                  <Progress 
                    value={job.total_items > 0 ? (job.processed_items / job.total_items) * 100 : 0} 
                    className="w-32"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs defaultValue="content" className="space-y-4">
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="settings">Instellingen</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <Select value={selectedEntityType} onValueChange={(v) => setSelectedEntityType(v as TranslatableEntityType)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ENTITY_TYPE_LABELS).map(([key, label]) => {
                  const Icon = ENTITY_ICONS[key as TranslatableEntityType];
                  return (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Select value={selectedLanguage} onValueChange={(v) => setSelectedLanguage(v as TranslationLanguage)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Taal" />
              </SelectTrigger>
              <SelectContent>
                {TRANSLATION_LANGUAGES.filter(l => l.code !== 'nl').map(lang => (
                  <SelectItem key={lang.code} value={lang.code}>
                    <span className="mr-2">{lang.flag}</span>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Entity Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {(() => {
                  const Icon = ENTITY_ICONS[selectedEntityType];
                  return <Icon className="h-5 w-5" />;
                })()}
                {ENTITY_TYPE_LABELS[selectedEntityType]}
              </CardTitle>
              <CardDescription>
                Dekking per item — een item is 100% wanneer alle velden in alle doeltalen vertaald zijn
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto px-0 sm:px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Naam</TableHead>
                    <TableHead>Dekking</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Acties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingLoading ? (
                    [...Array(5)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      </TableRow>
                    ))
                  ) : allEntities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Geen {ENTITY_TYPE_LABELS[selectedEntityType].toLowerCase()} gevonden
                      </TableCell>
                    </TableRow>
                  ) : (
                    allEntities.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={item.coverage} className="w-16 h-2" />
                            <span className="text-sm text-muted-foreground">{item.coverage}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.coverage === 100 ? (
                            <Badge variant="default" className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
                              <Check className="mr-1 h-3 w-3" />
                              Compleet
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <AlertCircle className="mr-1 h-3 w-3" />
                              {item.missing} ontbrekend
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {item.coverage < 100 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleTranslateEntity(selectedEntityType, item.id)}
                                disabled={translateEntity.isPending || (!isUnlimited && !hasCredits(perEntityCost))}
                                title={`Kost ~${perEntityCost} credits`}
                              >
                                {translateEntity.isPending ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Play className="mr-2 h-4 w-4" />
                                )}
                                Vertalen
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" asChild>
                              <Link 
                                to={selectedEntityType === 'product' 
                                  ? `/admin/products/${item.id}/edit` 
                                  : `/admin/categories`
                                }
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Vertaalinstellingen
              </CardTitle>
              <CardDescription>
                Configureer automatische vertalingen en gedrag
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {settingsLoading ? (
                <div className="space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <h3 className="font-medium">Brontaal</h3>
                    <p className="text-sm text-muted-foreground">
                      Nederlands (NL) is ingesteld als brontaal
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-medium">Doeltalen</h3>
                    <div className="flex flex-wrap gap-2">
                      {TRANSLATION_LANGUAGES.filter(l => l.code !== 'nl').map(lang => (
                        <Badge 
                          key={lang.code} 
                          variant={settings?.target_languages?.includes(lang.code) ? 'default' : 'outline'}
                          className="cursor-pointer"
                        >
                          {lang.flag} {lang.label}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="font-medium">Automatische vertalingen</h3>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="auto-products">Producten automatisch vertalen</Label>
                        <p className="text-sm text-muted-foreground">
                          Vertaal nieuwe producten automatisch naar alle doeltalen
                        </p>
                      </div>
                      <Switch 
                        id="auto-products" 
                        checked={settings?.auto_translate_products || false}
                        onCheckedChange={(v) => handleSettingChange('auto_translate_products', v)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="auto-categories">Categorieën automatisch vertalen</Label>
                        <p className="text-sm text-muted-foreground">
                          Vertaal nieuwe categorieën automatisch naar alle doeltalen
                        </p>
                      </div>
                      <Switch 
                        id="auto-categories" 
                        checked={settings?.auto_translate_categories || false}
                        onCheckedChange={(v) => handleSettingChange('auto_translate_categories', v)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="auto-seo">SEO content automatisch vertalen</Label>
                        <p className="text-sm text-muted-foreground">
                          Vertaal meta titels en beschrijvingen automatisch
                        </p>
                      </div>
                      <Switch 
                        id="auto-seo" 
                        checked={settings?.auto_translate_seo || false}
                        onCheckedChange={(v) => handleSettingChange('auto_translate_seo', v)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="auto-marketing">Marketing automatisch vertalen</Label>
                        <p className="text-sm text-muted-foreground">
                          Vertaal e-mail templates en campagnes automatisch
                        </p>
                      </div>
                      <Switch 
                        id="auto-marketing" 
                        checked={settings?.auto_translate_marketing || false}
                        onCheckedChange={(v) => handleSettingChange('auto_translate_marketing', v)}
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreditPurchaseDialog open={purchaseOpen} onOpenChange={setPurchaseOpen} />
    </div>
  );
}
