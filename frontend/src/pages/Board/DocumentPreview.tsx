import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, X, Download, Eye, Loader2 } from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';
import { downloadAttachment } from '../../api/document.api';
import { formatFileSize, timeAgo } from '../../utils';
import { toast } from 'sonner';

export default function DocumentPreview() {
  const doc = useUIStore((s) => s.documentPreview);
  const setPreview = useUIStore((s) => s.setDocumentPreview);
  const setRightPanelTab = useUIStore((s) => s.setRightPanelTab);
  const [downloading, setDownloading] = useState(false);

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
              <div className="rounded-md border border-line bg-paper p-4 shadow-xs">
                <div className="space-y-2">
                  <div className="h-2 w-1/3 rounded-full bg-ink/15" />
                  <div className="h-2 w-1/2 rounded-full bg-ink/10" />
                  <div className="h-2 w-2/5 rounded-full bg-ink/10" />
                  <div className="h-2 w-1/4 rounded-full bg-ink/10" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="h-2 w-full rounded-full bg-ink/10" />
                    <div className="h-2 w-3/4 rounded-full bg-ink/10" />
                    <div className="h-2 w-5/6 rounded-full bg-ink/10" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 w-4/5 rounded-full bg-ink/10" />
                    <div className="h-2 w-full rounded-full bg-ink/10" />
                    <div className="h-2 w-2/3 rounded-full bg-ink/10" />
                  </div>
                </div>
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