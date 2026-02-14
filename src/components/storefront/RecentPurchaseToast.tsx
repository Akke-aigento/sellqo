import { useState, useEffect } from 'react';
import { X, ShoppingBag } from 'lucide-react';

const CITIES = ['Amsterdam', 'Rotterdam', 'Utrecht', 'Den Haag', 'Eindhoven', 'Groningen', 'Breda', 'Tilburg', 'Arnhem', 'Leiden', 'Antwerpen', 'Gent', 'Brussel'];
const INTERVALS = [15000, 25000, 35000, 45000]; // ms between toasts

interface RecentPurchaseToastProps {
  tenantSlug: string;
  productNames?: string[];
}

export function RecentPurchaseToast({ tenantSlug, productNames = [] }: RecentPurchaseToastProps) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (productNames.length === 0) return;

    const showToast = () => {
      const city = CITIES[Math.floor(Math.random() * CITIES.length)];
      const product = productNames[Math.floor(Math.random() * productNames.length)];
      const minutes = Math.floor(Math.random() * 30) + 1;
      setMessage(`Iemand uit ${city} kocht "${product}" ${minutes} min geleden`);
      setVisible(true);
      setTimeout(() => setVisible(false), 5000);
    };

    const interval = INTERVALS[Math.floor(Math.random() * INTERVALS.length)];
    const timer = setInterval(showToast, interval);

    // Show first one after a delay
    const initialTimer = setTimeout(showToast, 8000);

    return () => {
      clearInterval(timer);
      clearTimeout(initialTimer);
    };
  }, [productNames]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[90] animate-in slide-in-from-left-full duration-300 max-w-sm">
      <div className="bg-background border rounded-lg shadow-lg p-3 flex items-start gap-3">
        <div className="bg-primary/10 rounded-full p-2 flex-shrink-0">
          <ShoppingBag className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm">{message}</p>
        </div>
        <button onClick={() => setVisible(false)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
