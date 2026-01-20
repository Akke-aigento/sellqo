import { useState } from 'react';
import { 
  Copy, Check, RefreshCw, Download, Clock,
  Instagram, Facebook, Linkedin, Twitter, Mail,
  ImageIcon, MessageSquare, Sparkles, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import type { PromoKit } from './ProductPromoWizard';
import { cn } from '@/lib/utils';

interface PromoKitResultProps {
  kit: PromoKit;
  onNewKit: () => void;
  onClose: () => void;
}

export function PromoKitResult({ kit, onNewKit, onClose }: PromoKitResultProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('social');

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success('Gekopieerd!');
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error('Kopiëren mislukt');
    }
  };

  const handleDownloadImage = async (imageUrl: string, filename: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Afbeelding gedownload');
    } catch {
      toast.error('Download mislukt');
    }
  };

  const CopyButton = ({ text, field }: { text: string; field: string }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => handleCopy(text, field)}
      className="shrink-0"
    >
      {copiedField === field ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );

  const SocialCard = ({ 
    platform, 
    icon: Icon, 
    content, 
    hashtags,
    color 
  }: { 
    platform: string; 
    icon: React.ElementType; 
    content: string; 
    hashtags?: string[];
    color: string;
  }) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className={cn("h-4 w-4", color)} />
          {platform}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-2">
          <p className="text-sm flex-1 whitespace-pre-wrap">{content}</p>
          <CopyButton text={content} field={`${platform}-content`} />
        </div>
        {hashtags && hashtags.length > 0 && (
          <div className="flex items-start gap-2">
            <div className="flex-1 flex flex-wrap gap-1">
              {hashtags.map((tag, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  #{tag.replace(/^#/, '')}
                </Badge>
              ))}
            </div>
            <CopyButton 
              text={hashtags.map(t => `#${t.replace(/^#/, '')}`).join(' ')} 
              field={`${platform}-hashtags`} 
            />
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Success Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10">
          <Check className="h-6 w-6 text-green-500" />
        </div>
        <h3 className="text-lg font-medium">Je Marketing Kit is klaar!</h3>
        <p className="text-sm text-muted-foreground">
          {kit.productName} • {kit.creditsUsed} credits gebruikt
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="social" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Social</span>
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Email</span>
          </TabsTrigger>
          <TabsTrigger value="images" className="gap-2">
            <ImageIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Afbeeldingen</span>
          </TabsTrigger>
          <TabsTrigger value="extra" className="gap-2">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Extra</span>
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="h-[400px] mt-4">
          {/* Social Tab */}
          <TabsContent value="social" className="space-y-4 m-0">
            <SocialCard
              platform="Instagram"
              icon={Instagram}
              content={kit.social.instagram.caption}
              hashtags={kit.social.instagram.hashtags}
              color="text-pink-500"
            />
            <SocialCard
              platform="Facebook"
              icon={Facebook}
              content={kit.social.facebook.post}
              color="text-blue-600"
            />
            <SocialCard
              platform="LinkedIn"
              icon={Linkedin}
              content={kit.social.linkedin.post}
              color="text-blue-700"
            />
            <SocialCard
              platform="X (Twitter)"
              icon={Twitter}
              content={kit.social.twitter.tweet}
              color="text-foreground"
            />
          </TabsContent>

          {/* Email Tab */}
          <TabsContent value="email" className="space-y-4 m-0">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Onderwerp Regels (A/B Test)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {kit.email.subjectLines.map((subject, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <Badge variant="outline" className="shrink-0">
                      {String.fromCharCode(65 + i)}
                    </Badge>
                    <span className="flex-1 text-sm">{subject}</span>
                    <CopyButton text={subject} field={`subject-${i}`} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Preview Tekst</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-sm text-muted-foreground">{kit.email.previewText}</p>
                  <CopyButton text={kit.email.previewText} field="preview" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Body Tekst</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-2">
                  <p className="flex-1 text-sm whitespace-pre-wrap">{kit.email.bodySnippet}</p>
                  <CopyButton text={kit.email.bodySnippet} field="body" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Images Tab */}
          <TabsContent value="images" className="space-y-4 m-0">
            <div className="grid gap-4">
              {kit.images.original && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      Originele Foto
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadImage(kit.images.original!, `${kit.productName}-original.jpg`)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <img 
                      src={kit.images.original} 
                      alt="Original"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  </CardContent>
                </Card>
              )}

              {kit.images.enhanced && (
                <Card className="border-purple-500/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-purple-500" />
                        Enhanced Lifestyle
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadImage(kit.images.enhanced!, `${kit.productName}-enhanced.jpg`)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <img 
                      src={kit.images.enhanced} 
                      alt="Enhanced"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  </CardContent>
                </Card>
              )}

              {kit.images.generated && (
                <Card className="border-pink-500/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-pink-500" />
                        AI Gegenereerd
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadImage(kit.images.generated!, `${kit.productName}-ai-generated.jpg`)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <img 
                      src={kit.images.generated} 
                      alt="AI Generated"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  </CardContent>
                </Card>
              )}

              {!kit.images.enhanced && !kit.images.generated && (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Geen afbeeldingen gegenereerd</p>
                    <p className="text-xs">Zet "Afbeeldingen genereren" aan voor marketing visuals</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Extra Tab */}
          <TabsContent value="extra" className="space-y-4 m-0">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Marketing Slogans
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {kit.slogans.map((slogan, i) => (
                  <div key={i} className="flex items-center gap-2 p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                    <span className="flex-1 font-medium">{slogan}</span>
                    <CopyButton text={slogan} field={`slogan-${i}`} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Beste Posting Moment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{kit.suggestedTiming.bestDay}</p>
                      <p className="text-sm text-muted-foreground">{kit.suggestedTiming.bestTime}</p>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {kit.suggestedTiming.reason}
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </ScrollArea>
      </Tabs>

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onNewKit}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Nieuwe Kit
        </Button>
        <Button onClick={onClose}>
          Sluiten
        </Button>
      </div>
    </div>
  );
}
