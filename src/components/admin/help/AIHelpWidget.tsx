import { useState } from 'react';
import { MessageCircleQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AIHelpChatWindow } from './AIHelpChatWindow';

export function AIHelpWidget() {
  const [isOpen, setIsOpen] = useState(false);

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
