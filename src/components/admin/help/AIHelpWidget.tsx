import { useState } from 'react';
import { MessageCircleQuestion, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AIHelpChatWindow } from './AIHelpChatWindow';

export function AIHelpWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(() =>
    localStorage.getItem('ai-help-minimized') === 'true'
  );

  const handleClose = () => {
    setIsOpen(false);
    setIsMinimized(true);
    localStorage.setItem('ai-help-minimized', 'true');
  };

  const handleOpen = () => {
    setIsOpen(true);
    setIsMinimized(false);
    localStorage.setItem('ai-help-minimized', 'false');
  };

  return (
    <>
      {isOpen && <AIHelpChatWindow onClose={handleClose} />}
      {!isOpen && !isMinimized && (
        <div className="fixed bottom-20 md:bottom-4 right-4 z-50 flex items-center gap-2">
          <Button
            onClick={() => {
              setIsMinimized(true);
              localStorage.setItem('ai-help-minimized', 'true');
            }}
            size="icon"
            variant="outline"
            className="h-8 w-8 rounded-full shadow-md bg-background"
            title="Minimaliseer"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button
            onClick={handleOpen}
            size="icon"
            className="h-12 w-12 rounded-full shadow-lg"
            title="SellQo Assistent"
          >
            <MessageCircleQuestion className="h-6 w-6" />
          </Button>
        </div>
      )}
      {!isOpen && isMinimized && (
        <Button
          onClick={handleOpen}
          size="icon"
          variant="outline"
          className="fixed bottom-20 md:bottom-4 right-4 z-50 h-9 w-9 rounded-full shadow-md bg-background/80 backdrop-blur-sm"
          title="SellQo Assistent"
        >
          <MessageCircleQuestion className="h-4 w-4" />
        </Button>
      )}
    </>
  );
}

export { AIHelpWidget as default };
