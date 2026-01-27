import { useState, useEffect } from 'react';
import { FileText, Image, File, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Attachment {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number | null;
  storage_path: string;
}

interface MessageAttachmentsProps {
  messageId: string;
  isOutbound?: boolean;
  className?: string;
}

const getFileIcon = (contentType: string) => {
  if (contentType.startsWith('image/')) return Image;
  if (contentType.includes('pdf')) return FileText;
  return File;
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function MessageAttachments({ messageId, isOutbound, className }: MessageAttachmentsProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAttachments() {
      const { data, error } = await supabase
        .from('customer_message_attachments')
        .select('id, filename, content_type, size_bytes, storage_path')
        .eq('message_id', messageId);

      if (!error && data) {
        setAttachments(data);
      }
      setLoading(false);
    }

    fetchAttachments();
  }, [messageId]);

  const handleDownload = async (attachment: Attachment) => {
    setDownloading(attachment.id);
    try {
      const { data, error } = await supabase.storage
        .from('message-attachments')
        .download(attachment.storage_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloading(null);
    }
  };

  if (loading) return null;
  if (attachments.length === 0) return null;

  return (
    <div className={cn('mt-2 space-y-1', className)}>
      {attachments.map((attachment) => {
        const FileIcon = getFileIcon(attachment.content_type);
        const isImage = attachment.content_type.startsWith('image/');

        return (
          <Button
            key={attachment.id}
            variant="ghost"
            size="sm"
            className={cn(
              'w-full justify-start gap-2 h-auto py-1.5 px-2 text-xs',
              isOutbound
                ? 'text-primary-foreground/90 hover:bg-primary-foreground/10'
                : 'text-foreground hover:bg-muted'
            )}
            onClick={() => handleDownload(attachment)}
            disabled={downloading === attachment.id}
          >
            {downloading === attachment.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileIcon className={cn(
                'h-3.5 w-3.5',
                isImage && 'text-blue-500',
                attachment.content_type.includes('pdf') && 'text-red-500'
              )} />
            )}
            <span className="truncate flex-1 text-left">{attachment.filename}</span>
            {attachment.size_bytes && (
              <span className={cn(
                'text-xs',
                isOutbound ? 'text-primary-foreground/60' : 'text-muted-foreground'
              )}>
                {formatFileSize(attachment.size_bytes)}
              </span>
            )}
            <Download className="h-3 w-3 shrink-0" />
          </Button>
        );
      })}
    </div>
  );
}
