import { Link2, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SocialLinksEditor } from './SocialLinksEditor';

export function SocialMediaHub() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Social Media</h2>
        <p className="text-muted-foreground">
          Beheer de social media links die in je webshop footer worden getoond
        </p>
      </div>

      <SocialLinksEditor />

      <Alert>
        <Link2 className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>
            Wil je producten verkopen via Facebook Shop, Instagram Shopping of Google Shopping? 
            Of automatisch content posten naar social media?
          </span>
          <Button variant="outline" size="sm" asChild className="ml-4 shrink-0">
            <a href="/admin/connect">
              <ExternalLink className="h-4 w-4 mr-2" />
              Naar SellQo Connect
            </a>
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
