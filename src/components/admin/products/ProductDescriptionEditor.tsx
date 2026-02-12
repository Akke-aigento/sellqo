import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { useCallback, useEffect, useState } from 'react';
import { AIFieldAssistant } from '@/components/admin/ai/AIFieldAssistant';
import type { AIFieldContext } from '@/components/admin/ai/AIFieldAssistant';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Heading2,
  Heading3,
  Heading4,
  List,
  ListOrdered,
  Quote,
  Minus,
  Link as LinkIcon,
  Image as ImageIcon,
  Undo,
  Redo,
} from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface ProductDescriptionEditorProps {
  value: string;
  onChange: (html: string) => void;
  maxLength?: number;
  aiContext?: AIFieldContext;
}

export function ProductDescriptionEditor({
  value,
  onChange,
  maxLength = 5000,
  aiContext,
}: ProductDescriptionEditorProps) {
  const [charCount, setCharCount] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, HTMLAttributes: { class: 'text-primary underline' } },
        underline: {},
      }),
      Image.configure({
        HTMLAttributes: { class: 'max-w-full rounded-lg' },
      }),
      Placeholder.configure({
        placeholder: 'Schrijf een uitgebreide productbeschrijving...',
      }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      const textLen = editor.getText().length;
      setCharCount(textLen);
      if (textLen <= maxLength) {
        onChange(editor.getHTML());
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] p-4',
      },
    },
  });

  // Sync charCount on mount
  useEffect(() => {
    if (editor) {
      setCharCount(editor.getText().length);
    }
  }, [editor]);

  const addLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href;
    const url = window.prompt('URL invoeren:', prev || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const addImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('Afbeelding URL:', 'https://');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  if (!editor) return null;

  const warnThreshold = maxLength - 500;
  const isWarning = charCount >= warnThreshold && charCount < maxLength;
  const isOver = charCount >= maxLength;

  return (
    <div className="border rounded-md overflow-hidden border-input">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/30">
        {/* Text styles */}
        <Toggle size="sm" pressed={editor.isActive('bold')} onPressedChange={() => editor.chain().focus().toggleBold().run()} aria-label="Vet">
          <Bold className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('italic')} onPressedChange={() => editor.chain().focus().toggleItalic().run()} aria-label="Cursief">
          <Italic className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('underline')} onPressedChange={() => editor.chain().focus().toggleUnderline().run()} aria-label="Onderstrepen">
          <UnderlineIcon className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('strike')} onPressedChange={() => editor.chain().focus().toggleStrike().run()} aria-label="Doorhalen">
          <Strikethrough className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('code')} onPressedChange={() => editor.chain().focus().toggleCode().run()} aria-label="Code">
          <Code className="h-4 w-4" />
        </Toggle>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Headings */}
        <Toggle size="sm" pressed={editor.isActive('heading', { level: 2 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} aria-label="Kop 2">
          <Heading2 className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('heading', { level: 3 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} aria-label="Kop 3">
          <Heading3 className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('heading', { level: 4 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} aria-label="Kop 4">
          <Heading4 className="h-4 w-4" />
        </Toggle>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Lists & blocks */}
        <Toggle size="sm" pressed={editor.isActive('bulletList')} onPressedChange={() => editor.chain().focus().toggleBulletList().run()} aria-label="Opsommingslijst">
          <List className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('orderedList')} onPressedChange={() => editor.chain().focus().toggleOrderedList().run()} aria-label="Genummerde lijst">
          <ListOrdered className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('blockquote')} onPressedChange={() => editor.chain().focus().toggleBlockquote().run()} aria-label="Citaat">
          <Quote className="h-4 w-4" />
        </Toggle>
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().setHorizontalRule().run()} className="h-8 w-8 p-0" aria-label="Horizontale lijn">
          <Minus className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Link & Image */}
        <Button type="button" variant="ghost" size="sm" onClick={addLink} className="h-8 w-8 p-0" aria-label="Link">
          <LinkIcon className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={addImage} className="h-8 w-8 p-0" aria-label="Afbeelding">
          <ImageIcon className="h-4 w-4" />
        </Button>

        <div className="flex-1" />

        {/* AI Assistant */}
        {aiContext && (
          <AIFieldAssistant
            fieldType="description"
            currentValue={editor.getText()}
            onApply={(html) => {
              editor.commands.setContent(html);
              onChange(html);
            }}
            context={aiContext}
            multiVariant
          />
        )}

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Undo/Redo */}
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className="h-8 w-8 p-0" aria-label="Ongedaan maken">
          <Undo className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className="h-8 w-8 p-0" aria-label="Opnieuw">
          <Redo className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />

      {/* Character counter */}
      <div className="flex justify-end px-3 py-1.5 border-t bg-muted/20">
        <span
          className={cn(
            'text-xs font-medium',
            isOver && 'text-destructive',
            isWarning && !isOver && 'text-yellow-600 dark:text-yellow-500',
            !isWarning && !isOver && 'text-muted-foreground'
          )}
        >
          {charCount} / {maxLength} tekens
        </span>
      </div>
    </div>
  );
}
