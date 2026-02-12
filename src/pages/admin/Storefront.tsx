import { useState } from 'react';
import { Globe, Paintbrush, LayoutDashboard, FileText, Settings, ExternalLink, Rocket, Sliders, Scale, Star } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenant } from '@/hooks/useTenant';
import { useStorefront } from '@/hooks/useStorefront';
import { useTenantDomains } from '@/hooks/useTenantDomains';
import { ThemeGallery } from '@/components/admin/storefront/ThemeGallery';
import { ThemeCustomizer } from '@/components/admin/storefront/ThemeCustomizer';
import { HomepageBuilder } from '@/components/admin/storefront/HomepageBuilder';
import { StorefrontPagesManager } from '@/components/admin/storefront/StorefrontPagesManager';
import { StorefrontSettings } from '@/components/admin/storefront/StorefrontSettings';
import { StorefrontFeaturesSettings } from '@/components/admin/storefront/StorefrontFeaturesSettings';
import { LegalPagesManager } from '@/components/admin/storefront/LegalPagesManager';
import { ReviewsHub } from '@/components/admin/storefront/ReviewsHub';

export default function StorefrontPage() {
  const { currentTenant } = useTenant();
  const { 
    themes, 
    themeSettings, 
    isLoading,
    saveThemeSettings,
    publishStorefront 
  } = useStorefront();
  const [activeTab, setActiveTab] = useState('theme');
  const { canonicalDomain } = useTenantDomains();

  if (!currentTenant) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Selecteer een winkel om door te gaan</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedTheme = themes.find(t => t.id === themeSettings?.theme_id);
  const isPublished = themeSettings?.is_published;
  const storefrontUrl = canonicalDomain?.domain
    ? `https://${canonicalDomain.domain}`
    : (currentTenant as any).custom_domain 
      ? `https://${(currentTenant as any).custom_domain}`
      : `/shop/${currentTenant.slug}`;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Globe className="h-8 w-8 text-primary" />
            Webshop
          </h1>
          <p className="text-muted-foreground mt-1">
            Beheer je online webshop: theme, homepage, pagina's en instellingen
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isPublished ? (
            <Badge variant="default" className="bg-green-500">
              <Rocket className="h-3 w-3 mr-1" />
              Live
            </Badge>
          ) : (
            <Badge variant="secondary">Draft</Badge>
          )}
          <Button variant="outline" size="sm" asChild>
            <a href={storefrontUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Preview
            </a>
          </Button>
          <Button 
            onClick={() => publishStorefront.mutate()}
            disabled={publishStorefront.isPending || !themeSettings?.theme_id}
          >
            <Rocket className="h-4 w-4 mr-2" />
            {isPublished ? 'Opnieuw Publiceren' : 'Publiceren'}
          </Button>
        </div>
      </div>

      {/* Status Card */}
      {isLoading ? (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : selectedTheme ? (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <div 
                className="h-16 w-16 rounded-lg border flex items-center justify-center"
                style={{ backgroundColor: themeSettings?.primary_color || selectedTheme.default_settings.primary_color }}
              >
                <Paintbrush className="h-8 w-8 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{selectedTheme.name} Theme</h3>
                <p className="text-sm text-muted-foreground">{selectedTheme.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Paintbrush className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">Kies een theme om te beginnen</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Selecteer een van onze professionele themes en pas het aan naar je merk
            </p>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="theme" className="flex items-center gap-2">
            <Paintbrush className="h-4 w-4" />
            <span className="hidden sm:inline">Theme</span>
          </TabsTrigger>
          <TabsTrigger value="homepage" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Homepage</span>
          </TabsTrigger>
          <TabsTrigger value="pages" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Pagina's</span>
          </TabsTrigger>
          <TabsTrigger value="reviews" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            <span className="hidden sm:inline">Reviews</span>
          </TabsTrigger>
          <TabsTrigger value="legal" className="flex items-center gap-2">
            <Scale className="h-4 w-4" />
            <span className="hidden sm:inline">Juridisch</span>
          </TabsTrigger>
          <TabsTrigger value="features" className="flex items-center gap-2">
            <Sliders className="h-4 w-4" />
            <span className="hidden sm:inline">Functies</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Instellingen</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="theme" className="space-y-6">
          <ThemeGallery />
          {themeSettings?.theme_id && <ThemeCustomizer />}
        </TabsContent>

        <TabsContent value="homepage">
          <HomepageBuilder />
        </TabsContent>

        <TabsContent value="pages">
          <StorefrontPagesManager />
        </TabsContent>

        <TabsContent value="reviews">
          <ReviewsHub />
        </TabsContent>

        <TabsContent value="legal">
          <LegalPagesManager />
        </TabsContent>

        <TabsContent value="features">
          <StorefrontFeaturesSettings />
        </TabsContent>

        <TabsContent value="settings">
          <StorefrontSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
