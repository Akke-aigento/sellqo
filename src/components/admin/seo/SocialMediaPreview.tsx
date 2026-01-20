import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Facebook,
  Twitter,
  Linkedin,
  Wand2,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SocialMetaData {
  og_title?: string | null;
  og_description?: string | null;
  og_image?: string | null;
}

interface SocialMediaPreviewProps {
  title: string;
  description: string;
  image?: string | null;
  url: string;
  socialMeta?: SocialMetaData;
  onGenerateSocialMeta?: () => void;
  isGenerating?: boolean;
  isLoading?: boolean;
}

export function SocialMediaPreview({
  title,
  description,
  image,
  url,
  socialMeta,
  onGenerateSocialMeta,
  isGenerating,
  isLoading,
}: SocialMediaPreviewProps) {
  const [activePreview, setActivePreview] = useState('facebook');

  const displayTitle = socialMeta?.og_title || title;
  const displayDescription = socialMeta?.og_description || description;
  const displayImage = socialMeta?.og_image || image;

  const titleLength = displayTitle?.length || 0;
  const descLength = displayDescription?.length || 0;

  const titleStatus = titleLength === 0 ? 'missing' : titleLength > 60 ? 'too_long' : 'good';
  const descStatus = descLength === 0 ? 'missing' : descLength > 160 ? 'too_long' : 'good';

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Social Media Preview
          </CardTitle>
          {onGenerateSocialMeta && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onGenerateSocialMeta}
              disabled={isGenerating}
            >
              <Wand2 className="h-4 w-4 mr-2" />
              {isGenerating ? 'Genereren...' : 'AI Genereren'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Indicators */}
        <div className="flex flex-wrap gap-2">
          <Badge 
            variant={titleStatus === 'good' ? 'default' : 'secondary'}
            className={cn(
              titleStatus === 'missing' && 'bg-red-500/10 text-red-500',
              titleStatus === 'too_long' && 'bg-yellow-500/10 text-yellow-500'
            )}
          >
            {titleStatus === 'good' ? (
              <CheckCircle2 className="h-3 w-3 mr-1" />
            ) : (
              <AlertCircle className="h-3 w-3 mr-1" />
            )}
            OG Title: {titleLength}/60
          </Badge>
          <Badge 
            variant={descStatus === 'good' ? 'default' : 'secondary'}
            className={cn(
              descStatus === 'missing' && 'bg-red-500/10 text-red-500',
              descStatus === 'too_long' && 'bg-yellow-500/10 text-yellow-500'
            )}
          >
            {descStatus === 'good' ? (
              <CheckCircle2 className="h-3 w-3 mr-1" />
            ) : (
              <AlertCircle className="h-3 w-3 mr-1" />
            )}
            OG Description: {descLength}/160
          </Badge>
          <Badge variant={displayImage ? 'default' : 'secondary'}>
            {displayImage ? (
              <CheckCircle2 className="h-3 w-3 mr-1" />
            ) : (
              <AlertCircle className="h-3 w-3 mr-1" />
            )}
            OG Image
          </Badge>
        </div>

        {/* Preview Tabs */}
        <Tabs value={activePreview} onValueChange={setActivePreview}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="facebook" className="gap-2">
              <Facebook className="h-4 w-4" />
              Facebook
            </TabsTrigger>
            <TabsTrigger value="twitter" className="gap-2">
              <Twitter className="h-4 w-4" />
              Twitter
            </TabsTrigger>
            <TabsTrigger value="linkedin" className="gap-2">
              <Linkedin className="h-4 w-4" />
              LinkedIn
            </TabsTrigger>
          </TabsList>

          {/* Facebook Preview */}
          <TabsContent value="facebook" className="mt-4">
            <div className="border rounded-lg overflow-hidden bg-background max-w-md">
              {displayImage ? (
                <div className="aspect-[1.91/1] bg-muted">
                  <img
                    src={displayImage}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-[1.91/1] bg-muted flex items-center justify-center">
                  <ImageIcon className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              <div className="p-3 bg-muted/30">
                <p className="text-xs text-muted-foreground uppercase truncate">
                  {new URL(url).hostname}
                </p>
                <h3 className="font-semibold text-foreground line-clamp-2 mt-1">
                  {displayTitle || 'Geen titel ingesteld'}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {displayDescription || 'Geen beschrijving ingesteld'}
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Twitter Preview */}
          <TabsContent value="twitter" className="mt-4">
            <div className="border rounded-xl overflow-hidden bg-background max-w-md">
              {displayImage ? (
                <div className="aspect-[2/1] bg-muted">
                  <img
                    src={displayImage}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-[2/1] bg-muted flex items-center justify-center">
                  <ImageIcon className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              <div className="p-3">
                <h3 className="font-medium text-foreground line-clamp-1">
                  {displayTitle || 'Geen titel ingesteld'}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                  {displayDescription || 'Geen beschrijving ingesteld'}
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />
                  {new URL(url).hostname}
                </p>
              </div>
            </div>
          </TabsContent>

          {/* LinkedIn Preview */}
          <TabsContent value="linkedin" className="mt-4">
            <div className="border rounded-lg overflow-hidden bg-background max-w-md">
              {displayImage ? (
                <div className="aspect-[1.91/1] bg-muted">
                  <img
                    src={displayImage}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-[1.91/1] bg-muted flex items-center justify-center">
                  <ImageIcon className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              <div className="p-3 bg-muted/20">
                <h3 className="font-semibold text-foreground line-clamp-2">
                  {displayTitle || 'Geen titel ingesteld'}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {new URL(url).hostname}
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Tips */}
        <div className="p-3 rounded-lg bg-muted/50 text-sm">
          <p className="font-medium mb-1">Tips voor social media:</p>
          <ul className="text-muted-foreground space-y-1">
            <li>• Houd de titel onder 60 tekens voor optimale weergave</li>
            <li>• Gebruik een afbeelding van minimaal 1200x630 pixels</li>
            <li>• Voeg een duidelijke call-to-action toe in de beschrijving</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
