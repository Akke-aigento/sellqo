import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircleQuestion, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AIHelpChatWindow } from './AIHelpChatWindow';

export function AIHelpWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const location = useLocation();

  // Re-show widget on route change
  useEffect(() => {
    setIsDismissed(false);
  }, [location.pathname]);

  // Hide on POS pages
  const isPOS = location.pathname.startsWith('/admin/pos/') || location.pathname.startsWith('/kassa/');
  if (isPOS) return null;

  return (
    <>
      {isOpen && <AIHelpChatWindow onClose={() => setIsOpen(false)} />}
      {!isOpen && !isDismissed && (
        <div className="fixed bottom-20 lg:bottom-4 right-4 z-50 group">
          <Button
            onClick={() => setIsOpen(true)}
            size="icon"
            className="h-9 w-9 rounded-full shadow-lg"
            title="SellQo Assistent"
          >
            <MessageCircleQuestion className="h-4 w-4" />
          </Button>
          <button
            onClick={(e) => { e.stopPropagation(); setIsDismissed(true); }}
            className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-muted border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            title="Verbergen"
          >
            <X className="h-2.5 w-2.5 text-muted-foreground" />
          </button>
        </div>
      )}
    </>
  );
}

export { AIHelpWidget as default };
