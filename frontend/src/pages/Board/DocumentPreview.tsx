import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, FileQuestion, X, Download, Eye, Loader2, AlertCircle } from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';
import { downloadAttachment, fetchAttachmentBlob } from '../../api/document.api';
import { formatFileSize, timeAgo } from '../../utils';
import { toast } from 'sonner';

type PreviewKind = 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'other';

type PreviewState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; kind: PreviewKind; url?: string; text?: string };

function classify(mime: string): PreviewKind | null {
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('text/') || mime === 'application/json' || mime === 'application/xml') return 'text';
  return null;
}

export default function DocumentPreview() {
  const doc = useUIStore((s) => s.documentPreview);
  const setPreview = useUIStore((s) => s.setDocumentPreview);
  const setRightPanelTab = useUIStore((s) => s.setRightPanelTab);
  const [downloading, setDownloading] = useState(false);
  const [preview, setPreviewState] = useState<PreviewState | null>(null);
  const [previewForId, setPreviewForId] = useState<string | null>(null);

  // Reset to loading when a different document opens. Done as a render-phase
  // adjustment so the fetch effect never sets state synchronously. Compare
  // normalized ids (null, never undefined) so the adjustment converges.
  const docId = doc?.id ?? null;
  if (docId !== previewForId) {
    setPreviewForId(docId);
    setPreviewState(doc ? { status: 'loading' } : null);
  }

  useEffect(() => {
    if (!doc) return;

    let cancelled = false;
    let objectUrl: string | null = null;

    void (async () => {
      const res = await fetchAttachmentBlob(doc);
      if (cancelled) return;
      if (!res.ok) {
        setPreviewState({ status: 'error', message: res.message });
        return;
      }

      const mime = (res.blob.type || doc.type || '').toLowerCase();
      const kind = classify(mime);

      try {
        if (kind === 'text') {
          const text = await res.blob.text();
          if (cancelled) return;
          setPreviewState({ status: 'ready', kind, text: text.slice(0, 100_000) });
        } else if (kind) {
          objectUrl = URL.createObjectURL(res.blob);
          if (cancelled) {
            URL.revokeObjectURL(objectUrl);
            return;
          }
          setPreviewState({ status: 'ready', kind, url: objectUrl });
        } else {
          setPreviewState({ status: 'ready', kind: 'other' });
        }
      } catch {
        if (!cancelled) setPreviewState({ status: 'error', message: 'Could not read this file' });
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc]);

  const handleDownload = async () => {
    if (!doc || downloading) return;
    setDownloading(true);
    try {
      const res = await downloadAttachment(doc);
      if (res.ok) {
        toast.success('Download started');
      } else {
        toast.error('Download failed', { description: res.message });
      }
    } finally {
      setDownloading(false);
    }
  };

  const renderBody = () => {
    if (!preview || preview.status === 'loading') {
      return (
        <div className="flex h-56 flex-col items-center justify-center gap-3 text-ink-3">
          <Loader2 size={20} className="animate-spin text-ink-2" />
          <p className="font-mono text-[11px]">Loading preview…</p>
        </div>
      );
    }
    if (preview.status === 'error') {
      return (
        <div className="flex h-56 flex-col items-center justify-center gap-2 text-center">
          <AlertCircle size={20} className="text-danger" />
          <p className="max-w-xs text-[12px] text-ink-2">{preview.message}</p>
        </div>
      );
    }

    switch (preview.kind) {
      case 'image':
        return (
          <img
            src={preview.url}
            alt={doc?.name ?? 'Attached image'}
            className="mx-auto max-h-[55vh] w-auto max-w-full object-contain"
          />
        );
      case 'pdf':
        return (
          <iframe
            src={preview.url}
            title={doc?.name ?? 'PDF preview'}
            className="h-[55vh] w-full border-0"
          />
        );
      case 'video':
        return <video src={preview.url} controls className="mx-auto max-h-[55vh] w-full" />;
      case 'audio':
        return (
          <div className="flex h-32 items-center justify-center">
            <audio src={preview.url} controls className="w-full" />
          </div>
        );
      case 'text':
        return (
          <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[11px] leading-relaxed text-ink-2">
            {preview.text}
          </pre>
        );
      default:
        return (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
            <FileQuestion size={22} className="text-ink-3" />
            <p className="max-w-xs text-[12px] text-ink-2">
              No inline preview for this file type — download it to open it.
            </p>
          </div>
        );
    }
  };

  return (
    <AnimatePresence>
      {doc && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/30 p-4 backdrop-blur-[2px]"
          onMouseDown={(e) => e.target === e.currentTarget && setPreview(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${doc.name}`}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-lg overflow-hidden rounded-lg border border-line-2 bg-paper shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-ink">
                <FileText size={14} className="shrink-0 text-danger" />
                <span className="truncate">{doc.name}</span>
                <span className="hidden shrink-0 rounded-sm bg-paper-2 px-1.5 py-0.5 font-mono text-[9px] font-normal text-ink-3 sm:block">
                  {doc.type}
                </span>
              </span>
              <button
                onClick={() => setPreview(null)}
                className="flex h-7 w-7 items-center justify-center rounded-sm text-ink-3 hover:bg-paper-2 hover:text-ink"
                aria-label="Close preview"
              >
                <X size={14} />
              </button>
            </div>

            <div className="bg-paper-2/60 px-6 py-5">
              <div className="overflow-hidden rounded-md border border-line bg-paper p-4 shadow-xs">
                {renderBody()}
              </div>
              <p className="mt-3 text-center font-mono text-[10px] text-ink-3">
                inline preview · attached to the board · {doc.uploadedAt && timeAgo(doc.uploadedAt)}
              </p>
            </div>

            <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
              <span className="font-mono text-[10.5px] text-ink-3">
                {formatFileSize(doc.size)} · uploaded {timeAgo(doc.uploadedAt)}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setPreview(null);
                    setRightPanelTab('documents');
                  }}
                  className="flex h-7 items-center gap-1.5 rounded-sm border border-line-2 px-2.5 text-[11px] font-medium text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
                >
                  <Eye size={12} /> Open in panel
                </button>
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="flex h-7 items-center gap-1.5 rounded-sm bg-ink px-2.5 text-[11px] font-medium text-paper transition-colors hover:bg-black disabled:opacity-60"
                >
                  {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                  {downloading ? 'Downloading…' : 'Download'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
