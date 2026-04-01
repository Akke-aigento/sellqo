import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Megaphone } from 'lucide-react';

export default function AdsBolcomPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bol.com Advertising</h1>
        <p className="text-muted-foreground">Beheer je Bol.com Sponsored Products campagnes</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            Bol.com Campagnes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Campagne-overzicht wordt geladen in de volgende stap...</p>
        </CardContent>
      </Card>
    </div>
  );
}
