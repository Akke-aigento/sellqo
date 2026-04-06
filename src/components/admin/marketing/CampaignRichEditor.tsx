import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Button } from '@/components/ui/button';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Link as LinkIcon,
  Unlink,
  Heading1,
  Heading2,
  ImageIcon,
} from 'lucide-react';
import { useCallback, useEffect } from 'react';

interface CampaignRichEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function CampaignRichEditor({ content, onChange, placeholder = 'Schrijf je email...' }: CampaignRichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-primary underline' },
      }),
      Image.configure({
        inline: false,
        HTMLAttributes: { style: 'max-width: 100%; height: auto;' },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[200px] px-4 py-3 focus:outline-none text-foreground prose-p:text-foreground prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-headings:text-foreground',
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || '');
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

  const addImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('Afbeelding URL');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="rounded-md border border-input bg-background">
      <div className="flex items-center gap-0.5 border-b border-input px-1 py-1 flex-wrap">
        <Button
          type="button" variant="ghost" size="sm"
          className={`h-7 w-7 p-0 ${editor.isActive('heading', { level: 1 }) ? 'bg-accent' : ''}`}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button" variant="ghost" size="sm"
          className={`h-7 w-7 p-0 ${editor.isActive('heading', { level: 2 }) ? 'bg-accent' : ''}`}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button
          type="button" variant="ghost" size="sm"
          className={`h-7 w-7 p-0 ${editor.isActive('bold') ? 'bg-accent' : ''}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button" variant="ghost" size="sm"
          className={`h-7 w-7 p-0 ${editor.isActive('italic') ? 'bg-accent' : ''}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button" variant="ghost" size="sm"
          className={`h-7 w-7 p-0 ${editor.isActive('underline') ? 'bg-accent' : ''}`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button
          type="button" variant="ghost" size="sm"
          className={`h-7 w-7 p-0 ${editor.isActive('bulletList') ? 'bg-accent' : ''}`}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button" variant="ghost" size="sm"
          className={`h-7 w-7 p-0 ${editor.isActive('orderedList') ? 'bg-accent' : ''}`}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button
          type="button" variant="ghost" size="sm"
          className={`h-7 w-7 p-0 ${editor.isActive('link') ? 'bg-accent' : ''}`}
          onClick={setLink}
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </Button>
        {editor.isActive('link') && (
          <Button
            type="button" variant="ghost" size="sm"
            className="h-7 w-7 p-0"
            onClick={() => editor.chain().focus().unsetLink().run()}
          >
            <Unlink className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          type="button" variant="ghost" size="sm"
          className="h-7 w-7 p-0"
          onClick={addImage}
        >
          <ImageIcon className="h-3.5 w-3.5" />
        </Button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

/**
 * Wraps rich-text HTML body content in a full email-ready HTML document.
 */
export function wrapInEmailTemplate(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <tr>
      <td style="padding: 40px 30px;">
        ${bodyHtml}
      </td>
    </tr>
    <tr>
      <td style="padding: 20px 30px; background-color: #f8f8f8; text-align: center; font-size: 12px; color: #999999;">
        <p style="margin: 0;">
          <a href="{{unsubscribe_url}}" style="color: #999999;">Uitschrijven</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
