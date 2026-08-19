import { useCanvasStore } from '../../stores/useCanvasStore';
import { useBoardStore } from '../../stores/useBoardStore';
import { useUIStore } from '../../stores/useUIStore';
import { formatFileSize, timeAgo } from '../../utils';
import { FileText, MessageSquare } from 'lucide-react';

/**
 * DOM overlays for attachments and comment markers, positioned via the
 * world→screen transform. Kept outside Fabric so hover/click UX is cheap.
 */
export default function ElementOverlays() {
  const board = useBoardStore((s) => s.board);
  const comments = useBoardStore((s) => s.comments);
  const viewport = useCanvasStore((s) => s.viewport);
  const setPreview = useUIStore((s) => s.setDocumentPreview);
  const setRightPanelTab = useUIStore((s) => s.setRightPanelTab);
  const setActiveComment = useUIStore((s) => s.setActiveComment);
  const activeComment = useUIStore((s) => s.activeComment);

  if (!board) return null;

  const { x: vx, y: vy, scale } = viewport;
  const toScreen = (x: number, y: number) => ({ x: x * scale + vx, y: y * scale + vy });

  const attached = board.elements.filter((e) => e.attachment);
  const commentMarkers = board.elements.filter((e) => (e.commentCount ?? 0) > 0);

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {attached.map((el) => {
        const pos = toScreen(el.x + el.width / 2, el.y);
        return (
          <div
            key={el.attachment!.id}
            className="pointer-events-auto absolute -translate-x-1/2 -translate-y-full"
            style={{ left: pos.x, top: pos.y }}
          >
            <button
              onClick={() => setPreview(el.attachment!)}
              className="group flex items-center gap-1.5 rounded-md border border-line-2 bg-paper px-2 py-1 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-line-3 hover:shadow-md"
              title={`${el.attachment!.name} · ${formatFileSize(el.attachment!.size)} · ${timeAgo(el.attachment!.uploadedAt)}`}
              aria-label={`Preview ${el.attachment!.name}`}
            >
              <FileText size={11} className="text-accent" />
              <span className="max-w-[130px] truncate font-mono text-[10px] text-ink-2">
                {el.attachment!.name}
              </span>
            </button>
          </div>
        );
      })}

      {commentMarkers.map((el) => {
        const pos = toScreen(el.x, el.y);
        return (
          <div
            key={el.id}
            className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: pos.x, top: pos.y }}
          >
            <button
              onClick={() => {
                setActiveComment({ elementId: el.id, x: pos.x, y: pos.y });
                setRightPanelTab('comments');
              }}
              className="relative flex h-7 w-7 items-center justify-center rounded-full border-2 border-paper bg-accent text-white shadow-md transition-transform duration-150 hover:scale-110"
              aria-label={`${el.commentCount} comment${(el.commentCount ?? 0) > 1 ? 's' : ''} on this element`}
            >
              <MessageSquare size={12} />
              {(el.commentCount ?? 0) > 1 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-ink px-1 text-[8.5px] font-semibold">
                  {el.commentCount}
                </span>
              )}
            </button>
          </div>
        );
      })}

      {activeComment && (
        <div
          className="pointer-events-none absolute z-30 -translate-x-1/2 translate-y-2"
          style={{ left: activeComment.x, top: activeComment.y }}
        >
          <div className="pointer-events-auto w-[220px] rounded-lg border border-line-2 bg-paper p-3 shadow-md">
            <p className="mono-label text-ink-3">Comment thread</p>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-2">
              {comments.filter((c) => c.elementId === activeComment.elementId).length > 0
                ? `Thread on ${activeComment.elementId.replace('el_', '')} — open the Comments tab to reply.`
                : 'No replies yet — open the Comments tab to start the thread.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}