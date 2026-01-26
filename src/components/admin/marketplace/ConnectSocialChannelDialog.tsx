import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Copy, ExternalLink, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSocialChannels } from '@/hooks/useSocialChannels';
import { useTenant } from '@/hooks/useTenant';
import { SOCIAL_CHANNEL_INFO, type SocialChannelType } from '@/types/socialChannels';
import { toast } from 'sonner';

const googleShoppingSchema = z.object({
  merchantId: z.string().min(1, 'Merchant ID is verplicht'),
});

const metaSchema = z.object({
  // Meta integration would use OAuth, so minimal form needed
  channel_name: z.string().optional(),
});

interface ConnectSocialChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelType: SocialChannelType;
}

export function ConnectSocialChannelDialog({
  open,
  onOpenChange,
  channelType,
}: ConnectSocialChannelDialogProps) {
  const { currentTenant } = useTenant();
  const { createConnection } = useSocialChannels();
  const [copied, setCopied] = useState(false);
  const info = SOCIAL_CHANNEL_INFO[channelType];

  const isFeedBased = info.feedBased;

  // Feed URL that will be generated
  const feedUrl = currentTenant 
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-product-feed?tenant_id=${currentTenant.id}&format=${channelType}`
    : '';

  const form = useForm({
    resolver: zodResolver(isFeedBased ? googleShoppingSchema : metaSchema),
    defaultValues: {
      merchantId: '',
      channel_name: '',
    },
  });

  const handleCopyFeedUrl = () => {
    navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    toast.success('Feed URL gekopieerd!');
    setTimeout(() => setCopied(false), 2000);
  };

  const onSubmit = async (data: z.infer<typeof googleShoppingSchema>) => {
    try {
      await createConnection.mutateAsync({
        channel_type: channelType,
        channel_name: info.name,
        credentials: isFeedBased ? { merchantId: data.merchantId } : {},
      });
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  const renderGoogleShoppingForm = () => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Alert>
          <AlertDescription>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Ga naar <a href="https://merchants.google.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google Merchant Center</a></li>
              <li>Maak een account aan of log in</li>
              <li>Kopieer je Merchant Center ID (rechtsbovenhoek)</li>
              <li>Voer het ID hieronder in</li>
            </ol>
          </AlertDescription>
        </Alert>

        <FormField
          control={form.control}
          name="merchantId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Google Merchant Center ID</FormLabel>
              <FormControl>
                <Input placeholder="123456789" {...field} />
              </FormControl>
              <FormDescription>
                Je vindt dit ID rechtsboven in Google Merchant Center
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          <FormLabel>Product Feed URL</FormLabel>
          <div className="flex gap-2">
            <Input 
              value={feedUrl} 
              readOnly 
              className="font-mono text-xs"
            />
            <Button 
              type="button" 
              variant="outline" 
              size="icon"
              onClick={handleCopyFeedUrl}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Voeg deze URL toe als product feed in Google Merchant Center
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuleer
          </Button>
          <Button type="submit" disabled={createConnection.isPending}>
            {createConnection.isPending ? 'Verbinden...' : 'Verbind Google Shopping'}
          </Button>
        </div>
      </form>
    </Form>
  );

  const renderMetaForm = () => (
    <div className="space-y-6">
      <Alert>
        <AlertDescription>
          <p className="text-sm mb-4">
            Facebook/Instagram Shop koppeling werkt via Meta Commerce Manager. 
            Dit vereist een Facebook Business Page met Commerce features.
          </p>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Ga naar <a href="https://business.facebook.com/commerce" target="_blank" rel="noopener noreferrer" className="text-primary underline">Meta Commerce Manager</a></li>
            <li>Maak een catalogus aan of selecteer een bestaande</li>
            <li>Gebruik onze feed URL om producten te importeren</li>
          </ol>
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <FormLabel>Product Feed URL voor Meta</FormLabel>
        <div className="flex gap-2">
          <Input 
            value={feedUrl.replace(channelType, 'facebook')} 
            readOnly 
            className="font-mono text-xs"
          />
          <Button 
            type="button" 
            variant="outline" 
            size="icon"
            onClick={() => {
              navigator.clipboard.writeText(feedUrl.replace(channelType, 'facebook'));
              toast.success('Feed URL gekopieerd!');
            }}
          >
            <Copy className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Gebruik deze URL in Meta Commerce Manager om producten te importeren
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Annuleer
        </Button>
        <Button 
          onClick={() => {
            createConnection.mutate({
              channel_type: channelType,
              channel_name: info.name,
            });
            onOpenChange(false);
          }}
          disabled={createConnection.isPending}
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Markeer als Verbonden
        </Button>
      </div>
    </div>
  );

  const renderPinterestForm = () => (
    <div className="space-y-6">
      <Alert>
        <AlertDescription>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Ga naar <a href="https://business.pinterest.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Pinterest Business</a></li>
            <li>Claim je website in Pinterest</li>
            <li>Ga naar Catalogus en maak een nieuwe data source aan</li>
            <li>Kies &quot;RSS Feed&quot; en plak de onderstaande URL</li>
          </ol>
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <FormLabel>Pinterest RSS Feed URL</FormLabel>
        <div className="flex gap-2">
          <Input 
            value={feedUrl} 
            readOnly 
            className="font-mono text-xs"
          />
          <Button 
            type="button" 
            variant="outline" 
            size="icon"
            onClick={handleCopyFeedUrl}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Annuleer
        </Button>
        <Button 
          onClick={() => {
            createConnection.mutate({
              channel_type: channelType,
              channel_name: info.name,
            });
            onOpenChange(false);
          }}
          disabled={createConnection.isPending}
        >
          Markeer als Verbonden
        </Button>
      </div>
    </div>
  );

  const renderDefaultForm = () => (
    <div className="space-y-6">
      <Alert>
        <AlertDescription>
          <p className="text-sm">
            Volg de instructies van {info.name} om je account te koppelen.
            Na het instellen kun je deze verbinding markeren als actief.
          </p>
        </AlertDescription>
      </Alert>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Annuleer
        </Button>
        <Button 
          onClick={() => {
            createConnection.mutate({
              channel_type: channelType,
              channel_name: info.name,
            });
            onOpenChange(false);
          }}
          disabled={createConnection.isPending}
        >
          Markeer als Verbonden
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Verbind {info.name}</DialogTitle>
          <DialogDescription>
            {info.tooltip}
          </DialogDescription>
        </DialogHeader>

        {channelType === 'google_shopping' && renderGoogleShoppingForm()}
        {(channelType === 'facebook_shop' || channelType === 'instagram_shop') && renderMetaForm()}
        {channelType === 'pinterest_catalog' && renderPinterestForm()}
        {channelType === 'microsoft_shopping' && renderGoogleShoppingForm()}
        {channelType === 'whatsapp_business' && renderDefaultForm()}
      </DialogContent>
    </Dialog>
  );
}
