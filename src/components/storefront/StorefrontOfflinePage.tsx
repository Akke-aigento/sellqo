import { Construction } from 'lucide-react';

interface StorefrontOfflinePageProps {
  logoUrl?: string | null;
  shopName: string;
}

export function StorefrontOfflinePage({ logoUrl, shopName }: StorefrontOfflinePageProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {logoUrl ? (
          <img src={logoUrl} alt={shopName} className="h-16 mx-auto" />
        ) : (
          <h1 className="text-3xl font-bold">{shopName}</h1>
        )}
        <div className="flex justify-center">
          <Construction className="h-16 w-16 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Binnenkort beschikbaar</h2>
          <p className="text-muted-foreground">
            We werken hard aan onze webshop. Kom snel terug!
          </p>
        </div>
      </div>
    </div>
  );
}
