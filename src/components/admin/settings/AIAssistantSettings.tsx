import { useState, useEffect } from 'react';
import { Bot, MessageSquare, Sparkles, BookOpen, RefreshCw, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { useAIAssistant } from '@/hooks/useAIAssistant';
import { useAICredits } from '@/hooks/useAICredits';
import { TONE_OPTIONS, POSITION_OPTIONS } from '@/types/ai-assistant';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';

export function AIAssistantSettings() {
  const { config, isLoading, knowledgeStats, updateConfig, isUpdating, rebuildIndex, isRebuilding } = useAIAssistant();
  const { credits } = useAICredits();

  // Local state for form
  const [formState, setFormState] = useState<{
    chatbot_enabled: boolean;
    chatbot_name: string;
    chatbot_welcome_message: string;
    chatbot_position: 'bottom-right' | 'bottom-left';
    reply_suggestions_enabled: boolean;
    reply_suggestions_auto_draft: boolean;
    reply_suggestions_tone: 'professional' | 'friendly' | 'formal';
    reply_suggestions_for_email: boolean;
    reply_suggestions_for_whatsapp: boolean;
    knowledge_include_products: boolean;
    knowledge_include_categories: boolean;
    knowledge_include_pages: boolean;
    knowledge_include_legal: boolean;
    knowledge_include_shipping: boolean;
    knowledge_custom_instructions: string;
    knowledge_forbidden_topics: string;
  }>({
    chatbot_enabled: false,
    chatbot_name: 'Assistent',
    chatbot_welcome_message: 'Hallo! Hoe kan ik je helpen?',
    chatbot_position: 'bottom-right',
    reply_suggestions_enabled: false,
    reply_suggestions_auto_draft: false,
    reply_suggestions_tone: 'professional',
    reply_suggestions_for_email: true,
    reply_suggestions_for_whatsapp: true,
    knowledge_include_products: true,
    knowledge_include_categories: true,
    knowledge_include_pages: true,
    knowledge_include_legal: true,
    knowledge_include_shipping: true,
    knowledge_custom_instructions: '',
    knowledge_forbidden_topics: '',
  });

  // Sync form state when config loads
  useEffect(() => {
    if (config) {
      setFormState({
        chatbot_enabled: config.chatbot_enabled,
        chatbot_name: config.chatbot_name,
        chatbot_welcome_message: config.chatbot_welcome_message,
        chatbot_position: config.chatbot_position,
        reply_suggestions_enabled: config.reply_suggestions_enabled,
        reply_suggestions_auto_draft: config.reply_suggestions_auto_draft,
        reply_suggestions_tone: config.reply_suggestions_tone,
        reply_suggestions_for_email: config.reply_suggestions_for_email,
        reply_suggestions_for_whatsapp: config.reply_suggestions_for_whatsapp,
        knowledge_include_products: config.knowledge_include_products,
        knowledge_include_categories: config.knowledge_include_categories,
        knowledge_include_pages: config.knowledge_include_pages,
        knowledge_include_legal: config.knowledge_include_legal,
        knowledge_include_shipping: config.knowledge_include_shipping,
        knowledge_custom_instructions: config.knowledge_custom_instructions || '',
        knowledge_forbidden_topics: config.knowledge_forbidden_topics || '',
      });
    }
  }, [config]);

  const handleSave = () => {
    updateConfig(formState);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const totalIndexed = knowledgeStats
    ? knowledgeStats.products + knowledgeStats.categories + knowledgeStats.pages + knowledgeStats.legal + knowledgeStats.shipping
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6" />
            AI Assistent
          </h2>
          <p className="text-muted-foreground mt-1">
            Configureer AI-gestuurde klantondersteuning voor je webshop
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="text-muted-foreground">Beschikbare credits</p>
          <p className="text-lg font-semibold">{credits?.available ?? 0}</p>
        </div>
      </div>

      {/* Chatbot Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            AI Chatbot voor Webshop
          </CardTitle>
          <CardDescription>
            Een slimme AI chatbot die je klanten helpt met vragen over producten, verzending, retourneren en meer. Werkt 24/7 en kent je hele webshop.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="chatbot-enabled">Chatbot inschakelen</Label>
            <Switch
              id="chatbot-enabled"
              checked={formState.chatbot_enabled}
              onCheckedChange={(checked) => setFormState((s) => ({ ...s, chatbot_enabled: checked }))}
            />
          </div>

          {formState.chatbot_enabled && (
            <>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="chatbot-name">Naam</Label>
                  <Input
                    id="chatbot-name"
                    value={formState.chatbot_name}
                    onChange={(e) => setFormState((s) => ({ ...s, chatbot_name: e.target.value }))}
                    placeholder="Assistent"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chatbot-position">Positie</Label>
                  <Select
                    value={formState.chatbot_position}
                    onValueChange={(v) => setFormState((s) => ({ ...s, chatbot_position: v as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POSITION_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="chatbot-welcome">Welkomstbericht</Label>
                <Input
                  id="chatbot-welcome"
                  value={formState.chatbot_welcome_message}
                  onChange={(e) => setFormState((s) => ({ ...s, chatbot_welcome_message: e.target.value }))}
                  placeholder="Hallo! Hoe kan ik je helpen vandaag?"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                💳 Verbruikt 1 AI credit per gesprek
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Reply Suggestions Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Antwoord Suggesties
          </CardTitle>
          <CardDescription>
            Krijg AI-gegenereerde antwoordsuggesties in je Klantgesprekken inbox. Je kunt suggesties accepteren, bewerken of negeren.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="suggestions-enabled">Suggesties inschakelen</Label>
            <Switch
              id="suggestions-enabled"
              checked={formState.reply_suggestions_enabled}
              onCheckedChange={(checked) => setFormState((s) => ({ ...s, reply_suggestions_enabled: checked }))}
            />
          </div>

          {formState.reply_suggestions_enabled && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label>Toon als</Label>
                <RadioGroup
                  value={formState.reply_suggestions_auto_draft ? 'draft' : 'suggestion'}
                  onValueChange={(v) => setFormState((s) => ({ ...s, reply_suggestions_auto_draft: v === 'draft' }))}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="suggestion" id="show-suggestion" />
                    <Label htmlFor="show-suggestion" className="font-normal">
                      Suggestie boven input veld
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="draft" id="show-draft" />
                    <Label htmlFor="show-draft" className="font-normal">
                      Concept in input veld (bewerkbaar)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label>Toon voor</Label>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="suggestions-email"
                      checked={formState.reply_suggestions_for_email}
                      onCheckedChange={(checked) => setFormState((s) => ({ ...s, reply_suggestions_for_email: checked }))}
                    />
                    <Label htmlFor="suggestions-email" className="font-normal">
                      Email berichten
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="suggestions-whatsapp"
                      checked={formState.reply_suggestions_for_whatsapp}
                      onCheckedChange={(checked) => setFormState((s) => ({ ...s, reply_suggestions_for_whatsapp: checked }))}
                    />
                    <Label htmlFor="suggestions-whatsapp" className="font-normal">
                      WhatsApp berichten
                    </Label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tone of voice</Label>
                <Select
                  value={formState.reply_suggestions_tone}
                  onValueChange={(v) => setFormState((s) => ({ ...s, reply_suggestions_tone: v as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label} - {opt.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <p className="text-xs text-muted-foreground">
                💳 Verbruikt 1 AI credit per suggestie
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Knowledge Base Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Kennisbank
          </CardTitle>
          <CardDescription>
            De AI leert automatisch van je webshop content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            {[
              { key: 'knowledge_include_products', label: 'Producten (naam, beschrijving, prijs, voorraad)', count: knowledgeStats?.products },
              { key: 'knowledge_include_categories', label: 'Categorieën', count: knowledgeStats?.categories },
              { key: 'knowledge_include_pages', label: 'Pagina\'s (Over ons, FAQ, Contact, etc.)', count: knowledgeStats?.pages },
              { key: 'knowledge_include_legal', label: 'Juridische pagina\'s (Retourbeleid, Verzendbeleid, etc.)', count: knowledgeStats?.legal },
              { key: 'knowledge_include_shipping', label: 'Verzendmethoden & prijzen', count: knowledgeStats?.shipping },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formState[item.key as keyof typeof formState] as boolean}
                    onCheckedChange={(checked) => setFormState((s) => ({ ...s, [item.key]: checked }))}
                  />
                  <span className="text-sm">{item.label}</span>
                </div>
                {item.count !== undefined && (
                  <span className="text-xs text-muted-foreground">{item.count} geïndexeerd</span>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-sm text-muted-foreground">
              {knowledgeStats?.lastUpdated ? (
                <>Laatste update: {formatDistanceToNow(new Date(knowledgeStats.lastUpdated), { addSuffix: true, locale: nl })}</>
              ) : (
                <>Nog niet geïndexeerd</>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => rebuildIndex()} disabled={isRebuilding}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isRebuilding ? 'animate-spin' : ''}`} />
              Index vernieuwen
            </Button>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="custom-instructions">Extra instructies</Label>
            <Textarea
              id="custom-instructions"
              value={formState.knowledge_custom_instructions}
              onChange={(e) => setFormState((s) => ({ ...s, knowledge_custom_instructions: e.target.value }))}
              placeholder="Voeg extra context of regels toe die de AI moet weten...&#10;&#10;Bijvoorbeeld:&#10;- Wij leveren alleen binnen Nederland en België.&#10;- Bij bestellingen boven €50 is verzending gratis."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Extra regels of informatie die de AI moet weten bij het beantwoorden van vragen.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="forbidden-topics">🚫 Verboden onderwerpen</Label>
            <Textarea
              id="forbidden-topics"
              value={formState.knowledge_forbidden_topics}
              onChange={(e) => setFormState((s) => ({ ...s, knowledge_forbidden_topics: e.target.value }))}
              placeholder="Onderwerpen waar de AI NIET over mag praten...&#10;&#10;Bijvoorbeeld:&#10;- Concurrenten of prijsvergelijkingen&#10;- Inkoopprijzen of marges"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              De AI zal deze onderwerpen vermijden en doorverwijzen naar menselijk contact.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isUpdating}>
          <Save className="h-4 w-4 mr-2" />
          {isUpdating ? 'Opslaan...' : 'Instellingen opslaan'}
        </Button>
      </div>

      {/* Info footer */}
      <p className="text-sm text-muted-foreground text-center">
        ℹ️ De AI respecteert altijd je instructies en weigert verboden onderwerpen.
        Bij complexe vragen verwijst de chatbot naar menselijk contact.
      </p>
    </div>
  );
}
