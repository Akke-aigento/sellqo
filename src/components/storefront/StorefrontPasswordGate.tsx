import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface StorefrontPasswordGateProps {
  logoUrl?: string | null;
  shopName: string;
  correctPassword: string;
  tenantSlug: string;
  onSuccess: () => void;
}

export function StorefrontPasswordGate({ logoUrl, shopName, correctPassword, tenantSlug, onSuccess }: StorefrontPasswordGateProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === correctPassword) {
      sessionStorage.setItem(`storefront_access_${tenantSlug}`, 'granted');
      onSuccess();
    } else {
      setError(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        {logoUrl ? (
          <img src={logoUrl} alt={shopName} className="h-16 mx-auto" />
        ) : (
          <h1 className="text-3xl font-bold">{shopName}</h1>
        )}
        <div className="flex justify-center">
          <Lock className="h-12 w-12 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">
          Deze webshop is beveiligd met een wachtwoord.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(false); }}
            placeholder="Voer wachtwoord in"
            autoFocus
          />
          {error && (
            <p className="text-sm text-destructive">Onjuist wachtwoord</p>
          )}
          <Button type="submit" className="w-full">
            Toegang
          </Button>
        </form>
      </div>
    </div>
  );
}
