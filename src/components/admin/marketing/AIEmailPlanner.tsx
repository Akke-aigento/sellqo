import { useState } from 'react';
import { 
  Mail, Sparkles, Loader2, Check, Copy, 
  Users, AlertTriangle, Gift, Package
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAIMarketing } from '@/hooks/useAIMarketing';
import { useAICredits } from '@/hooks/useAICredits';
import { useCustomerSegments } from '@/hooks/useCustomerSegments';
import { useEmailCampaigns } from '@/hooks/useEmailCampaigns';
import { CampaignDialog } from '@/components/admin/marketing/CampaignDialog';
import { ProductSelectDialog } from './ProductSelectDialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type CampaignType = 'newsletter' | 'promotion' | 'win_back' | 'new_product' | 'low_stock' | 'custom';

const campaignTypes = [
  { id: 'newsletter' as CampaignType, name: 'Nieuwsbrief', icon: Mail, description: 'Maandelijkse update', color: 'bg-blue-500', needsProducts: false },
  { id: 'promotion' as CampaignType, name: 'Promotie', icon: Gift, description: 'Korting of aanbieding', color: 'bg-green-500', needsProducts: true },
  { id: 'win_back' as CampaignType, name: 'Win-back', icon: Users, description: 'Inactieve klanten', color: 'bg-purple-500', needsProducts: false },
  { id: 'new_product' as CampaignType, name: 'Nieuw Product', icon: Package, description: 'Productlancering', color: 'bg-pink-500', needsProducts: true },
  { id: 'low_stock' as CampaignType, name: 'Laatste Kans', icon: AlertTriangle, description: 'Urgentie campagne', color: 'bg-amber-500', needsProducts: false },
];

interface EmailContentResult {
  subjectLines: string[];
  previewText: string;
  greeting: string;
  body: string;
  cta: { text: string; url: string };
  closing: string;
  htmlContent: string;
}

interface AIEmailPlannerProps {
  initialCampaignType?: CampaignType;
  initialProductIds?: string[];
}

export function AIEmailPlanner({ initialCampaignType, initialProductIds }: AIEmailPlannerProps) {
  const [campaignType, setCampaignType] = useState<CampaignType>(initialCampaignType || 'newsletter');
  const [segmentId, setSegmentId] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [includeDiscount, setIncludeDiscount] = useState(false);
  const [discountPercentage, setDiscountPercentage] = useState(10);
  const [generatedContent, setGeneratedContent] = useState<EmailContentResult | null>(null);
  const [selectedSubject, setSelectedSubject] = useState(0);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(initialProductIds || []);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);

  const { generateEmailContent, context } = useAIMarketing();
  const { hasCredits, getCreditCost } = useAICredits();
  const { segments } = useCustomerSegments();
  const { createCampaign } = useEmailCampaigns();

  const creditCost = getCreditCost('email_content');
  const canGenerate = hasCredits(creditCost);
  const selectedType = campaignTypes.find(t => t.id === campaignType);
  const needsProducts = selectedType?.needsProducts;

  const handleGenerate = async () => {
    if (!canGenerate) {
      toast.error('Onvoldoende AI credits');
      return;
    }

    const result = await generateEmailContent.mutateAsync({
      campaignType,
      segmentId: segmentId || undefined,
      customPrompt: campaignType === 'custom' ? customPrompt : undefined,
      includeDiscount,
      discountPercentage,
      productIds: needsProducts && selectedProductIds.length > 0 ? selectedProductIds : undefined,
    });

    setGeneratedContent(result);
    setSelectedSubject(0);
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('Gekopieerd!');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleUseCampaign = () => {
    if (!generatedContent) return;
    setCampaignDialogOpen(true);
  };

  const handleSaveCampaign = async (data: any) => {
    try {
      await createCampaign.mutateAsync(data);
      toast.success('Campagne opgeslagen als concept!');
      setCampaignDialogOpen(false);
    } catch (error) {
      toast.error('Fout bij opslaan campagne');
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500">
              <Mail className="h-4 w-4 text-white" />
            </div>
            AI Email Planner
          </CardTitle>
          <CardDescription>
            Laat AI je email campagne content schrijven
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Campaign Type Selection */}
          <div className="space-y-3">
            <Label>Type Campagne</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {campaignTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => {
                    setCampaignType(type.id);
                    if (!type.needsProducts) {
                      setSelectedProductIds([]);
                    }
                  }}
                  className={cn(
                    'flex flex-col items-center gap-2 p-3 rounded-lg border transition-all',
                    campaignType === type.id
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'hover:border-primary/50'
                  )}
                >
                  <div className={cn('p-2 rounded-lg', type.color)}>
                    <type.icon className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-sm font-medium">{type.name}</span>
                  <span className="text-xs text-muted-foreground text-center">
                    {type.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Segment Selection */}
          <div className="space-y-2">
            <Label>Doelgroep Segment (optioneel)</Label>
            <Select value={segmentId} onValueChange={setSegmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Alle abonnees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Alle abonnees</SelectItem>
                {segments.map((seg) => (
                  <SelectItem key={seg.id} value={seg.id}>
                    {seg.name} ({seg.member_count} klanten)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Product Selection */}
          {needsProducts && (
            <div className="space-y-2">
              <Label>Producten (optioneel)</Label>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setProductDialogOpen(true)}
              >
                <Package className="h-4 w-4 mr-2" />
                {selectedProductIds.length > 0 
                  ? `${selectedProductIds.length} product${selectedProductIds.length > 1 ? 'en' : ''} geselecteerd`
                  : 'Kies producten om te promoten'
                }
              </Button>
              {selectedProductIds.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedProductIds([])}
                  className="text-muted-foreground"
                >
                  Selectie wissen
                </Button>
              )}
            </div>
          )}

          {/* Discount Toggle */}
          {(campaignType === 'promotion' || campaignType === 'win_back') && (
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="space-y-0.5">
                <Label>Korting toevoegen</Label>
                <p className="text-xs text-muted-foreground">
                  Voeg een kortingspercentage toe aan de email
                </p>
              </div>
              <div className="flex items-center gap-3">
                {includeDiscount && (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={5}
                      max={50}
                      value={discountPercentage}
                      onChange={(e) => setDiscountPercentage(Number(e.target.value))}
                      className="w-16 h-8"
                    />
                    <span className="text-sm">%</span>
                  </div>
                )}
                <Switch
                  checked={includeDiscount}
                  onCheckedChange={setIncludeDiscount}
                />
              </div>
            </div>
          )}

          {/* Custom prompt for custom type */}
          {campaignType === 'custom' && (
            <div className="space-y-2">
              <Label>Beschrijf je campagne</Label>
              <Textarea
                placeholder="Wat wil je communiceren? Welke producten of boodschap?"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={generateEmailContent.isPending || !canGenerate}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {generateEmailContent.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Email genereren...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Genereer Email Content ({creditCost} credits)
              </>
            )}
          </Button>

          {/* Generated Content */}
          {generatedContent && (
            <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2">
                {selectedType?.icon && <selectedType.icon className="h-5 w-5" />}
                <span className="font-medium">{selectedType?.name} Email</span>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  AI Gegenereerd
                </Badge>
              </div>

              <Tabs defaultValue="content" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="content">Content</TabsTrigger>
                  <TabsTrigger value="subjects">Onderwerpen</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>

                <TabsContent value="content" className="space-y-4 mt-4">
                  {/* Subject Lines */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Onderwerpregel</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(generatedContent.subjectLines[selectedSubject], 'subject')}
                      >
                        {copiedField === 'subject' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {generatedContent.subjectLines.map((subject, i) => (
                        <Badge
                          key={i}
                          variant={selectedSubject === i ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => setSelectedSubject(i)}
                        >
                          {subject}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Preview Text */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Preview tekst</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(generatedContent.previewText, 'preview')}
                      >
                        {copiedField === 'preview' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-sm p-2 bg-background rounded border">
                      {generatedContent.previewText}
                    </p>
                  </div>

                  {/* Body */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Email inhoud</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(generatedContent.body, 'body')}
                      >
                        {copiedField === 'body' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <div 
                      className="text-sm p-3 bg-background rounded border prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: generatedContent.body }}
                    />
                  </div>

                  {/* CTA */}
                  <div className="space-y-2">
                    <Label>Call-to-Action</Label>
                    <div className="flex items-center gap-2">
                      <Button className="pointer-events-none">
                        {generatedContent.cta.text}
                      </Button>
                      <span className="text-xs text-muted-foreground">→ {generatedContent.cta.url}</span>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="subjects" className="space-y-3 mt-4">
                  <p className="text-sm text-muted-foreground">
                    Kies de beste onderwerpregel voor je campagne:
                  </p>
                  {generatedContent.subjectLines.map((subject, i) => (
                    <div
                      key={i}
                      className={cn(
                        'p-3 rounded-lg border cursor-pointer transition-colors',
                        selectedSubject === i ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                      )}
                      onClick={() => setSelectedSubject(i)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{subject}</span>
                        {selectedSubject === i && <Check className="h-4 w-4 text-primary" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {subject.length} karakters
                      </p>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="preview" className="mt-4">
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted p-2 text-xs text-muted-foreground">
                      Email Preview
                    </div>
                    <iframe
                      srcDoc={generatedContent.htmlContent}
                      className="w-full h-[400px] bg-white"
                      title="Email Preview"
                    />
                  </div>
                </TabsContent>
              </Tabs>

              {/* Use in Campaign Button */}
              <Button 
                className="w-full" 
                variant="outline"
                onClick={handleUseCampaign}
              >
                <Mail className="mr-2 h-4 w-4" />
                Gebruik in nieuwe campagne
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ProductSelectDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        selectedIds={selectedProductIds}
        onSelect={setSelectedProductIds}
        maxSelect={10}
      />

      <CampaignDialog
        open={campaignDialogOpen}
        onOpenChange={setCampaignDialogOpen}
        onSave={handleSaveCampaign}
        isLoading={createCampaign.isPending}
        defaultValues={generatedContent ? {
          name: `AI ${selectedType?.name || 'Campagne'} - ${new Date().toLocaleDateString('nl-NL')}`,
          subject: generatedContent.subjectLines[selectedSubject],
          preview_text: generatedContent.previewText,
          html_content: generatedContent.htmlContent,
          segment_id: segmentId || '',
        } : undefined}
        isAIGenerated
      />
    </>
  );
}
