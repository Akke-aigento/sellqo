import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircleQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AIHelpChatWindow } from './AIHelpChatWindow';

export function AIHelpWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  // Hide on POS pages — the floating button gets in the way of the terminal UI
  const isPOS = location.pathname.startsWith('/admin/pos/') || location.pathname.startsWith('/kassa/');
  if (isPOS) return null;

  return (
    <>
      {isOpen && <AIHelpChatWindow onClose={() => setIsOpen(false)} />}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          size="icon"
          className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full shadow-lg"
          title="SellQo Assistent"
        >
          <MessageCircleQuestion className="h-6 w-6" />
        </Button>
      )}
    </>
  );
}

// Allow external components to open the widget
export { AIHelpWidget as default };
