import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import type { EmailBlock, EmailBlockStyle, EmailBlockContent } from '@/types/emailBuilder';
import { BLOCK_TEMPLATES } from '@/types/emailBuilder';
import { AIFieldAssistant } from '@/components/admin/ai/AIFieldAssistant';
import { useTranslation } from 'react-i18next';

interface EmailBlockPropertiesProps {
  block: EmailBlock | null;
  onUpdate: (block: EmailBlock) => void;
  onClose: () => void;
}

export function EmailBlockProperties({ block, onUpdate, onClose }: EmailBlockPropertiesProps) {
  const { t } = useTranslation();
  const [localBlock, setLocalBlock] = useState<EmailBlock | null>(null);

  useEffect(() => {
    setLocalBlock(block);
  }, [block]);

  if (!localBlock) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full text-muted-foreground">
          {t('admin.marketing.emailBlockProperties.selecteer_een_blok_om_te_bewerken')}
        </CardContent>
      </Card>
    );
  }

  const template = BLOCK_TEMPLATES[localBlock.type];

  const updateContent = (key: keyof EmailBlockContent, value: unknown) => {
    const updated = {
      ...localBlock,
      content: { ...localBlock.content, [key]: value },
    };
    setLocalBlock(updated);
    onUpdate(updated);
  };

  const updateStyle = (key: keyof EmailBlockStyle, value: unknown) => {
    const updated = {
      ...localBlock,
      style: { ...localBlock.style, [key]: value },
    };
    setLocalBlock(updated);
    onUpdate(updated);
  };

  const renderContentFields = () => {
    switch (localBlock.type) {
      case 'header':
        return (
          <>
            <div>
              <div className="flex items-center gap-1">
                <Label>{t('admin.marketing.emailBlockProperties.header_tekst')}</Label>
                <AIFieldAssistant
                  fieldType="newsletter"
                  currentValue={localBlock.content.headerText || ''}
                  onApply={(text) => updateContent('headerText', text)}
                  context={{}}
                />
              </div>
              <Input
                value={localBlock.content.headerText || ''}
                onChange={(e) => updateContent('headerText', e.target.value)}
                placeholder={t('admin.marketing.emailBlockProperties.welkom')}
              />
            </div>
            <div>
              <Label>{t('admin.marketing.emailBlockProperties.logo_url')}</Label>
              <Input
                value={localBlock.content.logoUrl || ''}
                onChange={(e) => updateContent('logoUrl', e.target.value)}
                placeholder="https://..."
              />
            </div>
          </>
        );

      case 'text':
        return (
          <div>
            <div className="flex items-center gap-1">
              <Label>{t('admin.marketing.emailBlockProperties.tekst')}</Label>
              <AIFieldAssistant
                fieldType="newsletter"
                currentValue={localBlock.content.text || ''}
                onApply={(text) => updateContent('text', text)}
                context={{}}
              />
            </div>
            <Textarea
              value={localBlock.content.text || ''}
              onChange={(e) => updateContent('text', e.target.value)}
              rows={4}
              placeholder={t('admin.marketing.emailBlockProperties.voeg_hier_je_tekst_toe')}
            />
          </div>
        );

      case 'image':
        return (
          <>
            <div>
              <Label>{t('admin.marketing.emailBlockProperties.afbeelding_url')}</Label>
              <Input
                value={localBlock.content.imageUrl || ''}
                onChange={(e) => updateContent('imageUrl', e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>{t('admin.marketing.emailBlockProperties.alt_tekst')}</Label>
              <Input
                value={localBlock.content.altText || ''}
                onChange={(e) => updateContent('altText', e.target.value)}
                placeholder={t('admin.marketing.emailBlockProperties.beschrijving_van_de_afbeelding')}
              />
            </div>
            <div>
              <Label>{t('admin.marketing.emailBlockProperties.link_url_optioneel')}</Label>
              <Input
                value={localBlock.content.linkUrl || ''}
                onChange={(e) => updateContent('linkUrl', e.target.value)}
                placeholder="https://..."
              />
            </div>
          </>
        );

      case 'button':
        return (
          <>
            <div>
              <Label>{t('admin.marketing.emailBlockProperties.knop_tekst')}</Label>
              <Input
                value={localBlock.content.buttonText || ''}
                onChange={(e) => updateContent('buttonText', e.target.value)}
                placeholder={t('admin.marketing.emailBlockProperties.klik_hier')}
              />
            </div>
            <div>
              <Label>{t('admin.marketing.emailBlockProperties.link_url')}</Label>
              <Input
                value={localBlock.content.buttonUrl || ''}
                onChange={(e) => updateContent('buttonUrl', e.target.value)}
                placeholder="https://..."
              />
            </div>
          </>
        );

      case 'divider':
        return (
          <div>
            <Label>{t('admin.marketing.emailBlockProperties.lijn_stijl')}</Label>
            <Select
              value={localBlock.content.dividerStyle || 'solid'}
              onValueChange={(v) => updateContent('dividerStyle', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solid">{t('admin.marketing.emailBlockProperties.doorgetrokken')}</SelectItem>
                <SelectItem value="dashed">{t('admin.marketing.emailBlockProperties.gestreept')}</SelectItem>
                <SelectItem value="dotted">{t('admin.marketing.emailBlockProperties.gestippeld')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );

      case 'spacer':
        return (
          <div>
            <Label>Hoogte: {localBlock.content.height || 32}px</Label>
            <Slider
              value={[localBlock.content.height || 32]}
              onValueChange={([v]) => updateContent('height', v)}
              min={8}
              max={100}
              step={4}
            />
          </div>
        );

      case 'product':
        return (
          <>
            <div>
              <Label>{t('admin.marketing.emailBlockProperties.product_naam')}</Label>
              <Input
                value={localBlock.content.productName || ''}
                onChange={(e) => updateContent('productName', e.target.value)}
              />
            </div>
            <div>
              <Label>{t('common.price')}</Label>
              <Input
                value={localBlock.content.productPrice || ''}
                onChange={(e) => updateContent('productPrice', e.target.value)}
                placeholder="€0,00"
              />
            </div>
            <div>
              <Label>{t('admin.marketing.emailBlockProperties.afbeelding_url_2')}</Label>
              <Input
                value={localBlock.content.productImage || ''}
                onChange={(e) => updateContent('productImage', e.target.value)}
              />
            </div>
            <div>
              <Label>{t('admin.marketing.emailBlockProperties.beschrijving')}</Label>
              <Textarea
                value={localBlock.content.productDescription || ''}
                onChange={(e) => updateContent('productDescription', e.target.value)}
                rows={2}
              />
            </div>
          </>
        );

      case 'social':
        return (
          <>
            <div>
              <Label>{t('admin.marketing.emailBlockProperties.facebook_url')}</Label>
              <Input
                value={localBlock.content.facebook || ''}
                onChange={(e) => updateContent('facebook', e.target.value)}
              />
            </div>
            <div>
              <Label>{t('admin.marketing.emailBlockProperties.instagram_url')}</Label>
              <Input
                value={localBlock.content.instagram || ''}
                onChange={(e) => updateContent('instagram', e.target.value)}
              />
            </div>
            <div>
              <Label>{t('admin.marketing.emailBlockProperties.twitter_x_url')}</Label>
              <Input
                value={localBlock.content.twitter || ''}
                onChange={(e) => updateContent('twitter', e.target.value)}
              />
            </div>
            <div>
              <Label>{t('admin.marketing.emailBlockProperties.linkedin_url')}</Label>
              <Input
                value={localBlock.content.linkedin || ''}
                onChange={(e) => updateContent('linkedin', e.target.value)}
              />
            </div>
          </>
        );

      case 'footer':
        return (
          <>
            <div>
              <Label>{t('admin.marketing.emailBlockProperties.bedrijfsnaam')}</Label>
              <Input
                value={localBlock.content.companyName || ''}
                onChange={(e) => updateContent('companyName', e.target.value)}
                placeholder="{{company_name}}"
              />
            </div>
            <div>
              <Label>{t('common.address')}</Label>
              <Input
                value={localBlock.content.companyAddress || ''}
                onChange={(e) => updateContent('companyAddress', e.target.value)}
                placeholder="{{company_address}}"
              />
            </div>
            <div>
              <Label>{t('admin.marketing.emailBlockProperties.uitschrijf_tekst')}</Label>
              <Input
                value={localBlock.content.unsubscribeText || ''}
                onChange={(e) => updateContent('unsubscribeText', e.target.value)}
                placeholder={t('admin.marketing.emailBlockProperties.uitschrijven')}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t('admin.marketing.emailBlockProperties.toon_voorkeuren_link')}</Label>
              <Switch
                checked={localBlock.content.includePreferences ?? true}
                onCheckedChange={(v) => updateContent('includePreferences', v)}
              />
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="h-full overflow-auto">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <span>{template.icon}</span>
            {template.name}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-b pb-4 space-y-4">
          <h4 className="text-xs font-medium text-muted-foreground uppercase">{t('admin.marketing.emailBlockPalette.inhoud')}</h4>
          {renderContentFields()}
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-medium text-muted-foreground uppercase">{t('admin.marketing.emailBlockProperties.stijl')}</h4>
          
          <div>
            <Label>{t('admin.marketing.emailBlockProperties.achtergrondkleur')}</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={localBlock.style.backgroundColor || '#ffffff'}
                onChange={(e) => updateStyle('backgroundColor', e.target.value)}
                className="w-12 h-9 p-1"
              />
              <Input
                value={localBlock.style.backgroundColor || '#ffffff'}
                onChange={(e) => updateStyle('backgroundColor', e.target.value)}
                className="flex-1"
              />
            </div>
          </div>

          <div>
            <Label>{t('admin.marketing.emailBlockProperties.tekstkleur')}</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={localBlock.style.textColor || '#333333'}
                onChange={(e) => updateStyle('textColor', e.target.value)}
                className="w-12 h-9 p-1"
              />
              <Input
                value={localBlock.style.textColor || '#333333'}
                onChange={(e) => updateStyle('textColor', e.target.value)}
                className="flex-1"
              />
            </div>
          </div>

          <div>
            <Label>{t('admin.marketing.emailBlockProperties.tekstgrootte')}</Label>
            <Select
              value={String(localBlock.style.fontSize || 16)}
              onValueChange={(v) => updateStyle('fontSize', parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12">{t('admin.marketing.emailBlockProperties.klein_12px')}</SelectItem>
                <SelectItem value="14">{t('admin.marketing.emailBlockProperties.normaal_14px')}</SelectItem>
                <SelectItem value="16">{t('admin.marketing.emailBlockProperties.medium_16px')}</SelectItem>
                <SelectItem value="18">{t('admin.marketing.emailBlockProperties.groot_18px')}</SelectItem>
                <SelectItem value="24">{t('admin.marketing.emailBlockProperties.extra_groot_24px')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t('admin.marketing.emailBlockProperties.uitlijning')}</Label>
            <Select
              value={localBlock.style.textAlign || 'left'}
              onValueChange={(v) => updateStyle('textAlign', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left">{t('admin.marketing.emailBlockProperties.links')}</SelectItem>
                <SelectItem value="center">{t('admin.marketing.emailBlockProperties.midden')}</SelectItem>
                <SelectItem value="right">{t('admin.marketing.emailBlockProperties.rechts')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Padding boven: {localBlock.style.paddingTop ?? 16}px</Label>
            <Slider
              value={[localBlock.style.paddingTop ?? 16]}
              onValueChange={([v]) => updateStyle('paddingTop', v)}
              min={0}
              max={64}
              step={4}
            />
          </div>

          <div>
            <Label>Padding onder: {localBlock.style.paddingBottom ?? 16}px</Label>
            <Slider
              value={[localBlock.style.paddingBottom ?? 16]}
              onValueChange={([v]) => updateStyle('paddingBottom', v)}
              min={0}
              max={64}
              step={4}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
