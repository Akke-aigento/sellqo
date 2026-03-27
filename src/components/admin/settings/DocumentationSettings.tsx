import { ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function DocumentationSettings() {
  const steps = [
    {
      title: 'Ga naar Cloudflare',
      description: (
        <>
          Ga naar{' '}
          <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">
            dash.cloudflare.com <ExternalLink className="h-3 w-3" />
          </a>{' '}
          en log in met je account.
        </>
      ),
    },
    {
      title: 'Open API Tokens',
      description: 'Klik rechtsboven op je profiel → "My Profile" → "API Tokens".',
    },
    {
      title: 'Maak een nieuw token aan',
      description: (
        <>
          Klik op <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">"Create Token"</span> → kies de template{' '}
          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">"Edit zone DNS"</span>.
        </>
      ),
    },
    {
      title: 'Selecteer je domein',
      description: (
        <>
          Onder <span className="font-semibold">"Zone Resources"</span> → kies{' '}
          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">Include → Specific zone</span>{' '}
          → selecteer je domein. Je kunt meerdere zones toevoegen via{' '}
          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">"+ Add more"</span>.
        </>
      ),
    },
    {
      title: 'Bevestig het token',
      description: 'Laat TTL en IP filtering leeg, klik "Continue to summary" → "Create Token".',
    },
    {
      title: 'Kopieer het token',
      description: (
        <>
          Kopieer de token die wordt getoond.{' '}
          <span className="text-destructive font-medium">Let op: je ziet hem maar één keer!</span>
        </>
      ),
    },
    {
      title: 'Plak in SellQo',
      description: (
        <>
          Ga terug naar{' '}
          <a href="/admin/settings?section=domain" className="text-primary underline">
            Instellingen → Domeinen
          </a>
          , open je domein en plak de token in het "Cloudflare API Token" veld → klik "Koppel".
        </>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cloudflare koppelen</CardTitle>
          <CardDescription>
            Volg deze stappen om je Cloudflare DNS automatisch te configureren via een API Token.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  {i + 1}
                </span>
                <div className="pt-0.5">
                  <p className="font-medium text-sm">{step.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
