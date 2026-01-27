import { useRef } from 'react';
import { X, FileText, Image, File, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UploadedFile {
  file: File;
  preview?: string;
}

interface AttachmentUploaderProps {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  isUploading?: boolean;
  maxFiles?: number;
  maxSizeMB?: number;
  className?: string;
}

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return Image;
  if (type.includes('pdf')) return FileText;
  return File;
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function AttachmentUploader({
  files,
  onFilesChange,
  isUploading,
  maxFiles = 5,
  maxSizeMB = 10,
  className,
}: AttachmentUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles: UploadedFile[] = [];

    for (const file of selectedFiles) {
      // Check file size
      if (file.size > maxSizeMB * 1024 * 1024) {
        console.warn(`File ${file.name} exceeds ${maxSizeMB}MB limit`);
        continue;
      }

      // Create preview for images
      const uploadedFile: UploadedFile = { file };
      if (file.type.startsWith('image/')) {
        uploadedFile.preview = URL.createObjectURL(file);
      }
      validFiles.push(uploadedFile);
    }

    // Limit total files
    const newFiles = [...files, ...validFiles].slice(0, maxFiles);
    onFilesChange(newFiles);

    // Reset input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    const newFiles = [...files];
    const removed = newFiles.splice(index, 1)[0];
    if (removed.preview) {
      URL.revokeObjectURL(removed.preview);
    }
    onFilesChange(newFiles);
  };

  const openFilePicker = () => {
    inputRef.current?.click();
  };

  if (files.length === 0) {
    return (
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
      />
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap gap-2">
        {files.map((uploadedFile, index) => {
          const FileIcon = getFileIcon(uploadedFile.file.type);
          const isImage = uploadedFile.file.type.startsWith('image/');

          return (
            <div
              key={index}
              className="relative group flex items-center gap-2 bg-muted rounded-md px-2 py-1.5 pr-7"
            >
              {isImage && uploadedFile.preview ? (
                <img
                  src={uploadedFile.preview}
                  alt={uploadedFile.file.name}
                  className="h-6 w-6 rounded object-cover"
                />
              ) : (
                <FileIcon className={cn(
                  'h-4 w-4',
                  uploadedFile.file.type.includes('pdf') && 'text-red-500'
                )} />
              )}
              <div className="flex flex-col">
                <span className="text-xs font-medium truncate max-w-[120px]">
                  {uploadedFile.file.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(uploadedFile.file.size)}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full w-6 rounded-l-none opacity-60 hover:opacity-100"
                onClick={() => removeFile(index)}
                disabled={isUploading}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          );
        })}

        {files.length < maxFiles && !isUploading && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-auto py-1.5"
            onClick={openFilePicker}
          >
            + Toevoegen
          </Button>
        )}

        {isUploading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Uploaden...</span>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
      />
    </div>
  );
}

// Expose the file picker trigger
export function useAttachmentUploader() {
  const inputRef = useRef<HTMLInputElement>(null);

  const openFilePicker = () => {
    inputRef.current?.click();
  };

  return { inputRef, openFilePicker };
}
