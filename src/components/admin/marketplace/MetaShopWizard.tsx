import { useState } from 'react';
import { Check, ChevronRight, Facebook, Instagram, Loader2, MessageCircle, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import type { MetaBusiness, MetaCatalog, SocialChannelType } from '@/types/socialChannels';

interface MetaShopWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelType: SocialChannelType;
  onSuccess: (connectionId: string) => void;
}

type WizardStep = 'login' | 'business' | 'catalog' | 'options' | 'complete';

const CHANNEL_CONFIG = {
  facebook_shop: {
    name: 'Facebook Shop',
    icon: Facebook,
    color: 'text-blue-700',
  },
  instagram_shop: {
    name: 'Instagram Shop',
    icon: Instagram,
    color: 'text-pink-600',
  },
  whatsapp_business: {
    name: 'WhatsApp Business Catalog',
    icon: MessageCircle,
    color: 'text-green-600',
  },
} as const;

export function MetaShopWizard({ open, onOpenChange, channelType, onSuccess }: MetaShopWizardProps) {
  const { currentTenant } = useTenant();
  const [step, setStep] = useState<WizardStep>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<(MetaBusiness & { catalogs: MetaCatalog[] })[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<string | null>(null);
  const [selectedCatalog, setSelectedCatalog] = useState<string | null>(null);
  const [createNewCatalog, setCreateNewCatalog] = useState(false);
  const [newCatalogName, setNewCatalogName] = useState('SellQo Products');
  const [syncAllProducts, setSyncAllProducts] = useState(true);

  const config = CHANNEL_CONFIG[channelType as keyof typeof CHANNEL_CONFIG] || CHANNEL_CONFIG.facebook_shop;
  const Icon = config.icon;

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      // Call the OAuth init edge function
      const { data, error } = await supabase.functions.invoke('social-oauth-init', {
        body: {
          platform: 'facebook',
          tenantId: 'current', // Will be replaced by the function
          redirectUrl: window.location.origin + '/admin/settings?section=social',
        },
      });

      if (error) throw error;

      // Open OAuth popup
      const popup = window.open(data.authUrl, 'meta_oauth', 'width=600,height=700');
      
      // Listen for OAuth completion
      const checkPopup = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkPopup);
          // Check if we got the token
          handleOAuthComplete();
        }
      }, 500);

    } catch (error: any) {
      toast.error('Kon niet inloggen bij Meta: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthComplete = async () => {
    setIsLoading(true);
    try {
      // Fetch the stored connection with access token
      const { data: connection, error } = await supabase
        .from('social_connections')
        .select('*')
        .eq('platform', 'facebook')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!connection?.access_token) {
        toast.error('Login niet voltooid. Probeer opnieuw.');
        return;
      }

      setAccessToken(connection.access_token);
      
      // Fetch businesses and catalogs
      const { data: catalogData, error: catError } = await supabase.functions.invoke('fetch-meta-catalogs', {
        body: { access_token: connection.access_token },
      });

      if (catError) throw catError;

      setBusinesses(catalogData.businesses || []);
      setStep('business');

    } catch (error: any) {
      toast.error('Kon businesses niet ophalen: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectBusiness = (businessId: string) => {
    setSelectedBusiness(businessId);
    const business = businesses.find(b => b.id === businessId);
    if (business?.catalogs && business.catalogs.length > 0) {
      setStep('catalog');
    } else {
      setCreateNewCatalog(true);
      setStep('options');
    }
  };

  const handleSelectCatalog = (catalogId: string | 'new') => {
    if (catalogId === 'new') {
      setCreateNewCatalog(true);
      setSelectedCatalog(null);
    } else {
      setCreateNewCatalog(false);
      setSelectedCatalog(catalogId);
    }
    setStep('options');
  };

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      if (!currentTenant?.id) {
        throw new Error('Geen tenant geselecteerd');
      }

      // Create the social channel connection
      const { data, error } = await supabase
        .from('social_channel_connections')
        .insert([{
          tenant_id: currentTenant.id,
          channel_type: channelType as string,
          channel_name: config.name,
          business_id: selectedBusiness,
          catalog_id: createNewCatalog ? null : selectedCatalog,
          credentials: {
            accessToken,
            businessId: selectedBusiness,
            catalogId: selectedCatalog,
            syncAllProducts,
          } as any,
          is_active: true,
          sync_status: 'idle',
        }])
        .select()
        .single();

      if (error) throw error;

      // If creating new catalog, we'd call Meta API here
      // For now, user needs to create catalog in Meta Commerce Manager

      setStep('complete');
      toast.success(`${config.name} verbonden!`);
      
      setTimeout(() => {
        onSuccess(data.id);
        onOpenChange(false);
      }, 2000);

    } catch (error: any) {
      toast.error('Kon verbinding niet maken: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedBusinessData = businesses.find(b => b.id === selectedBusiness);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Icon className={cn('h-6 w-6', config.color)} />
            <DialogTitle>Verbind {config.name}</DialogTitle>
          </div>
          <DialogDescription>
            Koppel je producten automatisch aan {config.name}
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 py-4">
          {(['login', 'business', 'catalog', 'options', 'complete'] as WizardStep[]).map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                step === s ? 'bg-primary text-primary-foreground' :
                (['login', 'business', 'catalog', 'options', 'complete'].indexOf(step) > i)
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
              )}>
                {(['login', 'business', 'catalog', 'options', 'complete'].indexOf(step) > i) 
                  ? <Check className="h-4 w-4" />
                  : i + 1
                }
              </div>
              {i < 4 && <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="py-4">
          {step === 'login' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                <Facebook className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium">Login met Meta Business</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Je wordt doorgestuurd naar Facebook om in te loggen en toestemming te geven.
                </p>
              </div>
              <Button onClick={handleLogin} disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Facebook className="h-4 w-4 mr-2" />}
                Login met Facebook
              </Button>
            </div>
          )}

          {step === 'business' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">Selecteer Business Account</h3>
                <p className="text-sm text-muted-foreground">
                  Kies het business account waar je de shop aan wilt koppelen
                </p>
              </div>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : businesses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Store className="h-8 w-8 mx-auto mb-2" />
                  <p>Geen business accounts gevonden.</p>
                  <p className="text-sm">Maak eerst een Meta Business account aan.</p>
                </div>
              ) : (
                <RadioGroup onValueChange={handleSelectBusiness}>
                  {businesses.map((business) => (
                    <div key={business.id} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
                      <RadioGroupItem value={business.id} id={business.id} />
                      <Label htmlFor={business.id} className="flex-1 cursor-pointer">
                        <span className="font-medium">{business.name}</span>
                        <span className="text-sm text-muted-foreground block">
                          {business.catalogs?.length || 0} catalogus(sen)
                        </span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </div>
          )}

          {step === 'catalog' && selectedBusinessData && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">Selecteer Catalogus</h3>
                <p className="text-sm text-muted-foreground">
                  Kies een bestaande catalogus of maak een nieuwe aan
                </p>
              </div>
              <RadioGroup onValueChange={handleSelectCatalog}>
                {selectedBusinessData.catalogs?.map((catalog) => (
                  <div key={catalog.id} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
                    <RadioGroupItem value={catalog.id} id={catalog.id} />
                    <Label htmlFor={catalog.id} className="flex-1 cursor-pointer">
                      <span className="font-medium">{catalog.name}</span>
                      <span className="text-sm text-muted-foreground block">
                        {catalog.product_count} producten
                      </span>
                    </Label>
                  </div>
                ))}
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 border-dashed">
                  <RadioGroupItem value="new" id="new-catalog" />
                  <Label htmlFor="new-catalog" className="flex-1 cursor-pointer">
                    <span className="font-medium">+ Nieuwe catalogus aanmaken</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {step === 'options' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">Synchronisatie opties</h3>
                <p className="text-sm text-muted-foreground">
                  Configureer hoe je producten worden gesynchroniseerd
                </p>
              </div>
              
              {createNewCatalog && (
                <div className="space-y-2">
                  <Label htmlFor="catalog-name">Catalogus naam</Label>
                  <Input
                    id="catalog-name"
                    value={newCatalogName}
                    onChange={(e) => setNewCatalogName(e.target.value)}
                    placeholder="Bijv. Mijn Webshop Producten"
                  />
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="sync-all"
                    checked={syncAllProducts}
                    onCheckedChange={(checked) => setSyncAllProducts(checked === true)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label htmlFor="sync-all" className="cursor-pointer">
                      Sync alle actieve producten
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Alle actieve producten worden automatisch gesynchroniseerd
                    </p>
                  </div>
                </div>
                
                {!syncAllProducts && (
                  <p className="text-sm text-muted-foreground pl-6">
                    Je kunt per product instellen of het naar dit kanaal gesynchroniseerd moet worden
                  </p>
                )}
              </div>

              <div className="pt-4">
                <Button onClick={handleComplete} disabled={isLoading} className="w-full">
                  {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Verbinding maken
                </Button>
              </div>
            </div>
          )}

          {step === 'complete' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h3 className="font-medium text-lg">Verbinding gelukt!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Je producten worden nu gesynchroniseerd naar {config.name}
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
