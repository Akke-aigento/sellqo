import { useState } from 'react';
import { invokeWithErrorBody } from '@/lib/invokeWithErrorBody';
import { useToast } from '@/hooks/use-toast';

export type DocType = 'invoice' | 'credit_note' | 'shipping_label';
export type DocKind = 'pdf' | 'ubl';

interface SingleResp {
  url: string;
}
interface BatchResp {
  files: Array<{ id: string; name: string; url: string }>;
}

const CHUNK = 200;

/**
 * Shared hook for fetching short-lived signed URLs from `get-document-url`
 * and safely opening them without triggering popup-blockers.
 *
 * Popup-safe pattern: `openDocument` first calls `window.open('', '_blank')`
 * *synchronously* inside the user gesture, then swaps the location once the
 * signed URL comes back. If the browser blocked the popup anyway, we fall
 * back to a same-tab redirect.
 */
export function useDocumentDownload() {
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);

  const getDocumentUrl = async (docType: DocType, docId: string, kind: DocKind): Promise<string> => {
    const res = await invokeWithErrorBody<SingleResp>('get-document-url', {
      body: { doc_type: docType, doc_id: docId, kind },
    });
    if (!res?.url) throw new Error('Geen download-URL ontvangen');
    return res.url;
  };

  const openDocument = async (docType: DocType, docId: string, kind: DocKind): Promise<void> => {
    // Must be synchronous inside the user gesture, otherwise Safari/Firefox
    // block the popup once we hit the first `await`.
    const win = window.open('', '_blank');
    setIsDownloading(true);
    try {
      const url = await getDocumentUrl(docType, docId, kind);
      if (win && !win.closed) {
        win.location.href = url;
      } else {
        // Popup was blocked — fall back to same-tab navigation.
        window.location.href = url;
      }
    } catch (e: any) {
      try { win?.close(); } catch { /* noop */ }
      toast({
        title: 'Downloaden mislukt',
        description: e?.message || 'Onbekende fout',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const getDocumentUrls = async (
    docType: DocType,
    docIds: string[],
    kind: DocKind,
  ): Promise<Array<{ id: string; name: string; url: string }>> => {
    if (docIds.length === 0) return [];
    setIsDownloading(true);
    try {
      const out: Array<{ id: string; name: string; url: string }> = [];
      for (let i = 0; i < docIds.length; i += CHUNK) {
        const chunk = docIds.slice(i, i + CHUNK);
        const res = await invokeWithErrorBody<BatchResp>('get-document-url', {
          body: { doc_type: docType, doc_ids: chunk, kind },
        });
        if (res?.files?.length) out.push(...res.files);
      }
      return out;
    } finally {
      setIsDownloading(false);
    }
  };

  return { getDocumentUrl, openDocument, getDocumentUrls, isDownloading };
}