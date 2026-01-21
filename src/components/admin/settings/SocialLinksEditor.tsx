import { useState, useEffect } from 'react';
import { 
  Facebook, Instagram, Twitter, Linkedin, 
  Youtube, Music2, Save, Loader2, ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStorefront } from '@/hooks/useStorefront';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { SocialLinks } from '@/types/storefront';

interface SocialPlatform {
  id: keyof SocialLinks;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  placeholder: string;
  color: string;
}

const socialPlatforms: SocialPlatform[] = [
  { 
    id: 'facebook', 
    name: 'Facebook', 
    icon: Facebook, 
    placeholder: 'https://facebook.com/jouwbedrijf',
    color: 'text-blue-600'
  },
  { 
    id: 'instagram', 
    name: 'Instagram', 
    icon: Instagram, 
    placeholder: 'https://instagram.com/jouwbedrijf',
    color: 'text-pink-500'
  },
  { 
    id: 'twitter', 
    name: 'X (Twitter)', 
    icon: Twitter, 
    placeholder: 'https://x.com/jouwbedrijf',
    color: 'text-foreground'
  },
  { 
    id: 'linkedin', 
    name: 'LinkedIn', 
    icon: Linkedin, 
    placeholder: 'https://linkedin.com/company/jouwbedrijf',
    color: 'text-blue-700'
  },
  { 
    id: 'youtube', 
    name: 'YouTube', 
    icon: Youtube, 
    placeholder: 'https://youtube.com/@jouwbedrijf',
    color: 'text-red-600'
  },
  { 
    id: 'tiktok', 
    name: 'TikTok', 
    icon: Music2, 
    placeholder: 'https://tiktok.com/@jouwbedrijf',
    color: 'text-foreground'
  },
];

export function SocialLinksEditor() {
  const { themeSettings, saveThemeSettings, isLoading } = useStorefront();
  const [links, setLinks] = useState<Partial<SocialLinks>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (themeSettings?.social_links) {
      setLinks(themeSettings.social_links);
    }
  }, [themeSettings]);

  const handleChange = (platform: keyof SocialLinks, value: string) => {
    setLinks(prev => ({
      ...prev,
      [platform]: value || undefined,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveThemeSettings.mutateAsync({
        social_links: links as SocialLinks,
      });
      toast.success('Social media links opgeslagen');
    } catch (error) {
      toast.error('Kon links niet opslaan');
    } finally {
      setIsSaving(false);
    }
  };

  const filledCount = Object.values(links).filter(Boolean).length;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Social Media Links</CardTitle>
        <CardDescription>
          Deze links worden getoond in de footer van je webshop.
          {filledCount > 0 && (
            <span className="ml-2 text-primary font-medium">
              {filledCount} platform{filledCount !== 1 ? 's' : ''} ingevuld
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {socialPlatforms.map((platform) => {
          const Icon = platform.icon;
          const value = links[platform.id] || '';
          const hasValue = Boolean(value);

          return (
            <div key={platform.id} className="space-y-2">
              <Label className="flex items-center gap-2">
                <Icon className={cn('h-4 w-4', hasValue ? platform.color : 'text-muted-foreground')} />
                {platform.name}
                {hasValue && (
                  <a 
                    href={value} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </Label>
              <Input
                type="url"
                placeholder={platform.placeholder}
                value={value}
                onChange={(e) => handleChange(platform.id, e.target.value)}
              />
            </div>
          );
        })}

        <div className="pt-4 flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Opslaan...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Opslaan
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
