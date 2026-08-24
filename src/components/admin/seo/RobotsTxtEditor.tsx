import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Bot,
  Copy,
  Download,
  ChevronDown,
  Check,
  AlertCircle,
  FileCode,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface RobotsTxtEditorProps {
  baseUrl: string;
}

const PRESETS = {
  default: `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /checkout/

Sitemap: {{BASE_URL}}/sitemap.xml`,
  
  allowAll: `User-agent: *
Allow: /

Sitemap: {{BASE_URL}}/sitemap.xml`,
  
  blockAll: `User-agent: *
Disallow: /`,
  
  ecommerce: `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /checkout/
Disallow: /cart/
Disallow: /account/
Disallow: /search?*
Disallow: /*?sort=*
Disallow: /*?filter=*

# Block AI crawlers
User-agent: GPTBot
Disallow: /

User-agent: ChatGPT-User
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: Google-Extended
Disallow: /

Sitemap: {{BASE_URL}}/sitemap.xml
Sitemap: {{BASE_URL}}/sitemap-images.xml`,

  aiOptimized: `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /checkout/
Disallow: /cart/
Disallow: /account/

# Allow AI crawlers for visibility in AI search
User-agent: GPTBot
Allow: /products/
Allow: /categories/
Disallow: /admin/
Disallow: /checkout/

User-agent: ChatGPT-User
Allow: /products/
Allow: /categories/
Disallow: /admin/
Disallow: /checkout/

User-agent: Google-Extended
Allow: /

Sitemap: {{BASE_URL}}/sitemap.xml`,
};

// Labels staan als i18n-key; de sleutel blijft de preset-naam.
const PRESET_LABELS: Record<string, { labelKey: string; descriptionKey: string }> = {
  default: { labelKey: 'admin.seo.robotsTxtEditor.presetLabels.default.label', descriptionKey: 'admin.seo.robotsTxtEditor.presetLabels.default.description' },
  allowAll: { labelKey: 'admin.seo.robotsTxtEditor.presetLabels.allowAll.label', descriptionKey: 'admin.seo.robotsTxtEditor.presetLabels.allowAll.description' },
  blockAll: { labelKey: 'admin.seo.robotsTxtEditor.presetLabels.blockAll.label', descriptionKey: 'admin.seo.robotsTxtEditor.presetLabels.blockAll.description' },
  ecommerce: { labelKey: 'admin.seo.robotsTxtEditor.presetLabels.ecommerce.label', descriptionKey: 'admin.seo.robotsTxtEditor.presetLabels.ecommerce.description' },
  aiOptimized: { labelKey: 'admin.seo.robotsTxtEditor.presetLabels.aiOptimized.label', descriptionKey: 'admin.seo.robotsTxtEditor.presetLabels.aiOptimized.description' },
};

export function RobotsTxtEditor({ baseUrl }: RobotsTxtEditorProps) {
  const { t } = useTranslation();
  const [content, setContent] = useState(
    PRESETS.ecommerce.replace(/{{BASE_URL}}/g, baseUrl)
  );
  const [copied, setCopied] = useState(false);

  const handlePresetSelect = (presetKey: string) => {
    const preset = PRESETS[presetKey as keyof typeof PRESETS];
    setContent(preset.replace(/{{BASE_URL}}/g, baseUrl));
    toast.success(t('admin.seo.robotsTxtEditor.preset_geladen', { preset: t(PRESET_LABELS[presetKey].labelKey) }));
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success('Gekopieerd naar klembord');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'robots.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('robots.txt gedownload');
  };

  // Parse content for validation
  const lines = content.split('\n');
  const hasUserAgent = lines.some((line) => line.startsWith('User-agent:'));
  const hasSitemap = lines.some((line) => line.startsWith('Sitemap:'));
  const blocksAll = content.includes('Disallow: /') && !content.includes('Allow:');
  const allowsAI = 
    content.includes('User-agent: GPTBot') && 
    content.includes('Allow:');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileCode className="h-5 w-5" />
              {t('admin.seo.robotsTxtEditor.robots_txt_configuratie')}
            </CardTitle>
            <CardDescription>
              {t('admin.seo.robotsTxtEditor.bepaal_welke_pagina_s_zoekmachines_mogen')}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {t('admin.seo.robotsTxtEditor.presets')}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {Object.entries(PRESET_LABELS).map(([key, { labelKey, descriptionKey }]) => (
                  <DropdownMenuItem key={key} onClick={() => handlePresetSelect(key)}>
                    <div>
                      <p className="font-medium">{t(labelKey)}</p>
                      <p className="text-xs text-muted-foreground">{t(descriptionKey)}</p>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Validation Status */}
        <div className="flex flex-wrap gap-2">
          <Badge variant={hasUserAgent ? 'default' : 'destructive'}>
            {hasUserAgent ? <Check className="mr-1 h-3 w-3" /> : <AlertCircle className="mr-1 h-3 w-3" />}
            User-agent
          </Badge>
          <Badge variant={hasSitemap ? 'default' : 'secondary'}>
            {hasSitemap ? <Check className="mr-1 h-3 w-3" /> : <AlertCircle className="mr-1 h-3 w-3" />}
            Sitemap
          </Badge>
          {blocksAll && (
            <Badge variant="destructive">
              <AlertCircle className="mr-1 h-3 w-3" />
              {t('admin.seo.robotsTxtEditor.blokkeert_alles')}
            </Badge>
          )}
          {allowsAI && (
            <Badge variant="default" className="bg-blue-500">
              <Bot className="mr-1 h-3 w-3" />
              AI-vriendelijk
            </Badge>
          )}
        </div>

        {/* Editor */}
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="font-mono text-sm min-h-[300px]"
          placeholder={t('admin.seo.robotsTxtEditor.user_agent_10_allow')}
        />

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied ? t('admin.seo.robotsTxtEditor.gekopieerd') : t('admin.marketing.aIContentLibrary.kopieren')}
          </Button>
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            {t('admin.marketing.mediaAssetsLibrary.downloaden')}
          </Button>
        </div>

        {/* Info */}
        <div className="p-4 rounded-lg bg-muted/50 text-sm space-y-2">
          <p className="font-medium">{t('admin.seo.robotsTxtEditor.waar_te_plaatsen')}</p>
          <p className="text-muted-foreground">
            {t('admin.seo.robotsTxtEditor.upload_naar_root')} <code className="px-1 py-0.5 rounded bg-background">{baseUrl}/robots.txt</code>
          </p>
          <p className="text-muted-foreground">
            {t('admin.seo.robotsTxtEditor.je_kunt_dit_ook_configureren_via')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
