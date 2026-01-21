import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link2, Share2 } from 'lucide-react';
import { SocialLinksEditor } from './SocialLinksEditor';
import { SocialConnectionsManager } from './SocialConnectionsManager';

export function SocialMediaHub() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Social Media</h2>
        <p className="text-muted-foreground">
          Beheer je social media links en koppel accounts voor automatisch posten
        </p>
      </div>

      <Tabs defaultValue="links" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="links" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Website Links
          </TabsTrigger>
          <TabsTrigger value="autopost" className="flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            Autopost
          </TabsTrigger>
        </TabsList>

        <TabsContent value="links" className="mt-6">
          <SocialLinksEditor />
        </TabsContent>

        <TabsContent value="autopost" className="mt-6">
          <SocialConnectionsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
