import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Button } from '@/components/ui/button';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Link as LinkIcon,
  Unlink,
} from 'lucide-react';
import { useCallback, useEffect, useImperativeHandle, forwardRef } from 'react';

interface ComposeRichEditorProps {
  content: string;
  onChange: (html: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
}

export interface ComposeRichEditorRef {
  insertContent: (html: string) => void;
  setContent: (html: string) => void;
  getHTML: () => string;
}

export const ComposeRichEditor = forwardRef<ComposeRichEditorRef, ComposeRichEditorProps>(
  ({ content, onChange, onSubmit, placeholder = 'Typ je bericht...' }, ref) => {
    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: false,
        }),
        Underline,
        Link.configure({
          openOnClick: false,
          HTMLAttributes: { class: 'text-primary underline' },
        }),
        Placeholder.configure({ placeholder }),
      ],
      content,
      onUpdate: ({ editor }) => {
        onChange(editor.getHTML());
      },
      editorProps: {
        attributes: {
          class: 'prose prose-sm max-w-none min-h-[120px] px-3 py-2 focus:outline-none text-foreground prose-p:text-foreground prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0',
        },
        handleKeyDown: (_view, event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            onSubmit?.();
            return true;
          }
          return false;
        },
      },
    });

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      insertContent: (html: string) => {
        editor?.commands.insertContent(html, { parseOptions: { preserveWhitespace: false } });
      },
      setContent: (html: string) => {
        editor?.commands.setContent(html);
      },
      getHTML: () => editor?.getHTML() || '',
    }), [editor]);

    // Sync external content changes (e.g. template selection)
    useEffect(() => {
      if (editor && content !== editor.getHTML() && content === '') {
        editor.commands.clearContent();
      }
    }, [content, editor]);

    const setLink = useCallback(() => {
      if (!editor) return;
      const previousUrl = editor.getAttributes('link').href;
      const url = window.prompt('URL', previousUrl);
      if (url === null) return;
      if (url === '') {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
        return;
      }
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }, [editor]);

    if (!editor) return null;

    return (
      <div className="rounded-md border border-input bg-background">
        {/* Toolbar */}
        <div className="flex items-center gap-0.5 border-b border-input px-1 py-1">
          <Button type="button" variant="ghost" size="sm"
            className={`h-7 w-7 p-0 ${editor.isActive('bold') ? 'bg-accent' : ''}`}
            onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm"
            className={`h-7 w-7 p-0 ${editor.isActive('italic') ? 'bg-accent' : ''}`}
            onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm"
            className={`h-7 w-7 p-0 ${editor.isActive('underline') ? 'bg-accent' : ''}`}
            onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <UnderlineIcon className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm"
            className={`h-7 w-7 p-0 ${editor.isActive('strike') ? 'bg-accent' : ''}`}
            onClick={() => editor.chain().focus().toggleStrike().run()}>
            <Strikethrough className="h-3.5 w-3.5" />
          </Button>
          <div className="w-px h-4 bg-border mx-1" />
          <Button type="button" variant="ghost" size="sm"
            className={`h-7 w-7 p-0 ${editor.isActive('bulletList') ? 'bg-accent' : ''}`}
            onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm"
            className={`h-7 w-7 p-0 ${editor.isActive('orderedList') ? 'bg-accent' : ''}`}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered className="h-3.5 w-3.5" />
          </Button>
          <div className="w-px h-4 bg-border mx-1" />
          <Button type="button" variant="ghost" size="sm"
            className={`h-7 w-7 p-0 ${editor.isActive('link') ? 'bg-accent' : ''}`}
            onClick={setLink}>
            <LinkIcon className="h-3.5 w-3.5" />
          </Button>
          {editor.isActive('link') && (
            <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0"
              onClick={() => editor.chain().focus().unsetLink().run()}>
              <Unlink className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <EditorContent editor={editor} />
      </div>
    );
  }
);

ComposeRichEditor.displayName = 'ComposeRichEditor';
