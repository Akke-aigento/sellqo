import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircleQuestion, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AIHelpChatWindow } from './AIHelpChatWindow';

export function AIHelpWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(() => sessionStorage.getItem('ai-help-minimized') === '1');
  const location = useLocation();

  const handleMinimize = (val: boolean) => {
    setIsMinimized(val);
    if (val) sessionStorage.setItem('ai-help-minimized', '1');
    else sessionStorage.removeItem('ai-help-minimized');
  };

  // Hide on POS pages
  const isPOS = location.pathname.startsWith('/admin/pos/') || location.pathname.startsWith('/kassa/');
  if (isPOS) return null;

  return (
    <>
      {isOpen && <AIHelpChatWindow onClose={() => setIsOpen(false)} />}

      {/* Minimized: thin vertical strip on right edge */}
      {!isOpen && isMinimized && (
        <button
          onClick={() => setIsMinimized(false)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-50 w-1 h-10 rounded-l-full bg-primary/40 hover:bg-primary/70 hover:w-1.5 transition-all cursor-pointer"
          title="SellQo Assistent openen"
        />
      )}

      {/* Normal: full floating button */}
      {!isOpen && !isMinimized && (
        <div className="fixed bottom-20 lg:bottom-4 right-4 z-50 group">
          <Button
            onClick={() => setIsOpen(true)}
            size="icon"
            className="h-12 w-12 rounded-full shadow-lg"
            title="SellQo Assistent"
          >
            <MessageCircleQuestion className="h-5 w-5" />
          </Button>
          <button
            onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }}
            className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-muted border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            title="Minimaliseren"
          >
            <X className="h-2.5 w-2.5 text-muted-foreground" />
          </button>
        </div>
      )}
    </>
  );
}

export { AIHelpWidget as default };
