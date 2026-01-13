import { Link } from 'react-router-dom';
import { Construction } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export default function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Construction className="h-16 w-16 text-muted-foreground mb-4" />
      <h1 className="text-2xl font-bold mb-2">{title}</h1>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        {description || 'Deze pagina wordt binnenkort gebouwd in de volgende fase.'}
      </p>
      <Button asChild variant="outline">
        <Link to="/admin">Terug naar Dashboard</Link>
      </Button>
    </div>
  );
}
