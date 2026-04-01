import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';

export default function AdsAiRulesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Regels</h1>
        <p className="text-muted-foreground">Automatische optimalisatie regels voor je advertenties</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Automation Regels
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">AI regels worden geladen in de volgende stap...</p>
        </CardContent>
      </Card>
    </div>
  );
}
