import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity, AlertTriangle, Check, ChevronDown, Copy, Crosshair, DatabaseBackup, KeyRound, Layers, Loader2,
  Network, RotateCcw, ShieldAlert, Sparkles, Spline, StickyNote, Tag, Unlink, Wand2, X, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, uid } from '../../utils';
import { useBoardStore } from '../../stores/useBoardStore';
import { useSuggestionStore } from '../../stores/useSuggestionStore';
import { useBoardSuggestions } from '../../hooks/useBoardSuggestions';
import { elementBox, unionBox } from '../../services/geometry';
import { fetchBoardSuggestions, type AiSuggestion } from '../../api/suggestions.api';
import type { BoardElement, Suggestion, SuggestionCategory, SuggestionKind, SuggestionSeverity } from '../../types';

const KIND_ICON: Record<SuggestionKind, typeof Zap> = {
  'direct-db': ShieldAlert,
  auth: KeyRound,
  gateway: Network,
  cache: Zap,
  queue: Layers,
  spof: DatabaseBackup,
  monitoring: Activity,
  orphan: Unlink,
  unlabeled: Tag,
  'loose-arrow': Spline,
  duplicate: Copy,
};

const CATEGORY_LABEL: Record<SuggestionCategory, string> = {
  security: 'Security',
  performance: 'Performance',
  reliability: 'Reliability',
  observability: 'Observability',
  structure: 'Structure',
};

const SEVERITY_STYLE: Record<SuggestionSeverity, { bar: string; pill: string; dot: string; label: string }> = {
  high: { bar: 'bg-danger', pill: 'bg-danger-soft text-danger', dot: 'bg-danger', label: 'High' },
  medium: { bar: 'bg-warning', pill: 'bg-warning-soft text-warning', dot: 'bg-warning', label: 'Medium' },
  low: { bar: 'bg-line-3', pill: 'bg-paper-2 text-ink-3', dot: 'bg-ink-3', label: 'Low' },
};

type Filter = 'all' | SuggestionCategory;

export default function SuggestionsPanel() {
  const { analysis, visible, hidden } = useBoardSuggestions();
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: visible.length };
    for (const s of visible) c[s.category] = (c[s.category] ?? 0) + 1;
    return c;
  }, [visible]);
  const shown = filter === 'all' ? visible : visible.filter((s) => s.category === filter);
  const filters = (['all', 'security', 'performance', 'reliability', 'observability', 'structure'] as Filter[]).filter(
    (f) => f === 'all' || counts[f],
  );

  return (
    <div className="space-y-3" data-testid="suggestions-panel">
      <HealthCard score={analysis.score} items={visible} components={analysis.nodes.length} />

      {visible.length > 1 && filters.length > 2 && (
        <div className="-mx-0.5 flex flex-wrap gap-1" role="tablist" aria-label="Filter suggestions">
          {filters.map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                'flex h-6 items-center gap-1 rounded-full border px-2 text-[10.5px] font-medium transition-colors',
                filter === f ? 'border-ink bg-ink text-paper' : 'border-line-2 text-ink-3 hover:border-line-3 hover:text-ink',
              )}
            >
              {f === 'all' ? 'All' : CATEGORY_LABEL[f]}
              <span className={cn('font-mono text-[9px]', filter === f ? 'text-paper/70' : 'text-ink-3')}>{counts[f]}</span>
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <AnimatePresence initial={false} mode="popLayout">
          {shown.map((s) => (
            <SuggestionCard key={s.id} s={s} />
          ))}
        </AnimatePresence>
      </div>

      <AiReviewer />

      {hidden > 0 && (
        <button
          onClick={() => useSuggestionStore.getState().restoreAll()}
          className="flex w-full items-center justify-center gap-1.5 py-1 text-[10.5px] text-ink-3 transition-colors hover:text-ink"
        >
          <RotateCcw size={10} /> {hidden} dismissed · restore
        </button>
      )}
    </div>
  );
}

function HealthCard({ score, items, components }: { score: number | null; items: Suggestion[]; components: number }) {
  const bySeverity = (sev: SuggestionSeverity) => items.filter((s) => s.severity === sev).length;
  const high = bySeverity('high');
  const tone = score === null ? 'idle' : high ? 'bad' : score >= 85 ? 'good' : 'warn';
  const ring = { idle: 'text-line-3', good: 'text-success', warn: 'text-warning', bad: 'text-danger' }[tone];
  const headline =
    score === null
      ? 'Sketch a few components'
      : !items.length
        ? 'Looking solid'
        : high
          ? `${high} critical issue${high > 1 ? 's' : ''}`
          : score >= 85
            ? 'Almost there'
            : 'Worth a look';
  const sub =
    score === null
      ? 'Label boxes like “Web App”, “API” or “Postgres” and connect them — the reviewer reads the diagram as you draw.'
      : !items.length
        ? `${components} components reviewed — nothing missing that the local reviewer can spot.`
        : `${components} components reviewed live as you edit.`;
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div className="rounded-lg border border-line bg-paper p-3 shadow-xs" data-testid="board-health">
      <div className="flex items-center gap-3">
        <div className="relative h-14 w-14 shrink-0">
          <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
            <circle cx="28" cy="28" r={r} fill="none" strokeWidth="5" className="stroke-paper-3" />
            <motion.circle
              cx="28" cy="28" r={r} fill="none" strokeWidth="5" strokeLinecap="round"
              className={cn('stroke-current', ring)}
              strokeDasharray={c}
              initial={false}
              animate={{ strokeDashoffset: c * (1 - (score ?? 0) / 100) }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-mono text-[13px] font-semibold text-ink" aria-label="Board health score">
            {score ?? '—'}
          </span>
        </div>
        <div className="min-w-0">
          <p className="mono-label text-ink-3">Board health</p>
          <p className="mt-0.5 text-[13px] font-semibold text-ink">{headline}</p>
          <p className="mt-0.5 text-[10.5px] leading-snug text-ink-3">{sub}</p>
        </div>
      </div>
      {items.length > 0 && (
        <div className="mt-2.5 flex gap-3 border-t border-line pt-2">
          {(['high', 'medium', 'low'] as SuggestionSeverity[]).map((sev) => (
            <span key={sev} className="flex items-center gap-1.5 text-[10.5px] text-ink-3">
              <span className={cn('h-1.5 w-1.5 rounded-full', SEVERITY_STYLE[sev].dot, !bySeverity(sev) && 'opacity-30')} />
              <span className="font-mono text-ink-2">{bySeverity(sev)}</span> {SEVERITY_STYLE[sev].label.toLowerCase()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SuggestionCard({ s }: { s: Suggestion }) {
  const [open, setOpen] = useState(false);
  const elements = useBoardStore((st) => st.board?.elements);
  const canEdit = useBoardStore((st) => st.canEdit || st.isDemo);
  const Icon = KIND_ICON[s.kind];
  const sev = SEVERITY_STYLE[s.severity];
  const chips = useMemo(() => {
    const byId = new Map((elements ?? []).map((e) => [e.id, e]));
    return s.elementIds
      .map((id) => byId.get(id))
      .filter((e): e is BoardElement => !!e && e.kind !== 'arrow' && e.kind !== 'line' && !!e.content?.trim())
      .slice(0, 4);
  }, [elements, s.elementIds]);
  const store = useSuggestionStore.getState;
  const generates = s.action.type !== 'select';

  const run = () => {
    if (!store().apply(s)) {
      toast.error('Couldn’t apply that suggestion', { description: 'The shapes it refers to may have changed.' });
      return;
    }
    if (generates) {
      toast.success(s.actionLabel.replace(/^Insert|^Add/, (m) => (m === 'Insert' ? 'Inserted' : 'Added')), {
        description: 'Placed on the board and selected — drag it anywhere.',
        action: { label: 'Undo', onClick: () => useBoardStore.getState().undo() },
      });
    }
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 24, transition: { duration: 0.16 } }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="group relative overflow-hidden rounded-lg border border-line bg-paper shadow-xs transition-shadow hover:shadow-sm"
      data-testid="suggestion-card"
      data-kind={s.kind}
    >
      <span className={cn('absolute inset-y-0 left-0 w-[3px]', sev.bar)} aria-hidden="true" />
      <div className="p-2.5 pl-3.5">
        <div className="flex items-start gap-2.5">
          <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md', sev.pill)}>
            <Icon size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className={cn('rounded-sm px-1 py-px font-mono text-[8.5px] font-semibold uppercase tracking-wide', sev.pill)}>{sev.label}</span>
              <span className="font-mono text-[8.5px] uppercase tracking-wide text-ink-3">{CATEGORY_LABEL[s.category]}</span>
            </div>
            <h4 className="mt-1 text-[12.5px] font-semibold leading-snug text-ink">{s.title}</h4>
            <p className="mt-0.5 text-[11px] leading-relaxed text-ink-3">{s.detail}</p>
          </div>
          <button
            onClick={() => store().dismiss(s.id)}
            className="-mr-1 -mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-ink-3 opacity-60 transition hover:bg-paper-2 hover:text-ink hover:opacity-100"
            aria-label={`Dismiss: ${s.title}`}
          >
            <X size={12} />
          </button>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="mt-1.5 flex items-center gap-1 pl-[38px] text-[10.5px] font-medium text-ink-3 transition-colors hover:text-ink"
          aria-expanded={open}
        >
          <ChevronDown size={11} className={cn('transition-transform', open && 'rotate-180')} /> Why this?
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.p
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden pl-[38px] text-[10.5px] leading-relaxed text-ink-2"
            >
              <span className="block pt-1">{s.why}</span>
            </motion.p>
          )}
        </AnimatePresence>

        {chips.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1 pl-[38px]">
            {chips.map((el) => (
              <button
                key={el.id}
                onClick={() => store().focus([el.id])}
                className="max-w-[120px] truncate rounded-sm border border-line-2 bg-paper-2 px-1.5 py-0.5 font-mono text-[9.5px] text-ink-2 transition-colors hover:border-accent hover:text-accent"
                title={`Show “${el.content}” on the board`}
              >
                {el.content}
              </button>
            ))}
          </div>
        )}

        <div className="mt-2.5 flex gap-1.5 pl-[38px]">
          {generates ? (
            <button
              onClick={run}
              disabled={!canEdit}
              title={canEdit ? undefined : 'You have view-only access'}
              className="flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md bg-ink text-[11px] font-medium text-paper transition-colors hover:bg-ink-hover disabled:opacity-50"
            >
              <Wand2 size={11} /> {s.actionLabel}
            </button>
          ) : null}
          <button
            onClick={() => store().focus(s.elementIds)}
            className={cn(
              'flex h-7 items-center justify-center gap-1.5 rounded-md border border-line-2 px-2.5 text-[11px] font-medium text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink',
              !generates && 'flex-1',
            )}
          >
            <Crosshair size={11} /> {generates ? 'Show' : 'Show on board'}
          </button>
        </div>
      </div>
    </motion.article>
  );
}

const AI_CATEGORY_LABEL: Record<AiSuggestion['category'], string> = {
  architecture: 'Architecture',
  security: 'Security',
  performance: 'Performance',
  reliability: 'Reliability',
  process: 'Process',
  product: 'Product',
};

function AiReviewer() {
  const boardId = useBoardStore((s) => s.board?.id);
  const elements = useBoardStore((s) => s.board?.elements);
  const canEdit = useBoardStore((s) => s.canEdit || s.isDemo);
  const [ai, setAi] = useState<AiSuggestion[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [focus, setFocus] = useState('');
  const [added, setAdded] = useState<Set<string>>(new Set());

  const run = async () => {
    if (!boardId || state === 'loading') return;
    setState('loading');
    setMessage(null);
    const res = await fetchBoardSuggestions(boardId, focus.trim() || undefined);
    if (res.ok && res.data) {
      setAi(res.data.suggestions.map((s, i) => ({ ...s, id: s.id ?? `ai_${i}`, elements: s.elements ?? [] })));
      setState('done');
      if (!res.data.suggestions.length) setMessage('The reviewer found nothing to add.');
    } else {
      setState('error');
      setMessage(res.message ?? 'AI analysis is unavailable right now.');
    }
  };

  /** Board elements an AI finding names (exact label first, then contains). */
  const related = (s: AiSuggestion) => {
    const shapes = (elements ?? []).filter((e) => e.kind !== 'arrow' && e.kind !== 'line' && e.content?.trim());
    return (s.elements ?? [])
      .map((label) => {
        const l = label.toLowerCase();
        return shapes.find((e) => e.content.trim().toLowerCase() === l) ?? shapes.find((e) => e.content.toLowerCase().includes(l));
      })
      .filter((e, i, arr): e is BoardElement => !!e && arr.indexOf(e) === i);
  };

  const addNote = (s: AiSuggestion) => {
    const store = useBoardStore.getState();
    const near = related(s);
    const box = unionBox((near.length ? near : store.board?.elements ?? []).map(elementBox)) ?? { x: 0, y: 0, w: 0, h: 0 };
    const note: BoardElement = {
      id: uid('el'), kind: 'sticky', x: Math.round(box.x + box.w + 60), y: Math.round(box.y), width: 220, height: 130,
      rotation: 0, fill: '#fdeeb0', stroke: '#e6cf74', strokeWidth: 1, fontSize: 13, version: 0,
      content: `${s.title}\n\n${s.detail}`.slice(0, 400),
    };
    store.commitHistory();
    store.addElement(note);
    store.commitHistory();
    useSuggestionStore.getState().focus([note.id]);
    setAdded((prev) => new Set(prev).add(s.id));
    toast.success('Added as a note', { action: { label: 'Undo', onClick: () => useBoardStore.getState().undo() } });
  };

  return (
    <section className="overflow-hidden rounded-lg border border-line bg-linear-to-b from-accent-softer to-paper shadow-xs" data-testid="ai-reviewer">
      <div className="p-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-white">
            <Sparkles size={13} />
          </span>
          <div>
            <p className="text-[12.5px] font-semibold text-ink">AI reviewer</p>
            <p className="text-[10.5px] text-ink-3">Reads labels, connections and comments.</p>
          </div>
        </div>
        <form
          className="mt-2.5 flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <input
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            maxLength={500}
            placeholder="Focus (optional) — e.g. scaling to 1M users"
            className="h-7 min-w-0 flex-1 rounded-md border border-line-2 bg-paper px-2 text-[11px] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
            aria-label="What should the AI focus on?"
          />
          <button
            type="submit"
            disabled={state === 'loading' || !boardId}
            className="flex h-7 shrink-0 items-center gap-1.5 rounded-md bg-ink px-2.5 text-[11px] font-medium text-paper transition-colors hover:bg-ink-hover disabled:opacity-60"
          >
            {state === 'loading' ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
            {state === 'loading' ? 'Reviewing…' : state === 'done' ? 'Re-run' : 'Review'}
          </button>
        </form>
        {state === 'loading' && (
          <div className="mt-2.5 space-y-1.5" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-paper-2" style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        )}
        {state === 'error' && (
          <p className="mt-2 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-ink-3">
            <AlertTriangle size={11} className="mt-0.5 shrink-0 text-warning" /> {message}
          </p>
        )}
        {state === 'done' && !ai.length && (
          <p className="mt-2 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-ink-3">
            <Check size={11} className="mt-0.5 shrink-0 text-success" /> {message}
          </p>
        )}
      </div>

      {state === 'done' && ai.length > 0 && (
        <ul className="space-y-1.5 border-t border-line bg-paper/60 p-2">
          {ai.map((s) => {
            const rel = related(s);
            const sev = SEVERITY_STYLE[s.priority];
            return (
              <li key={s.id} className="relative overflow-hidden rounded-md border border-line bg-paper p-2.5 pl-3.5" data-testid="ai-finding">
                <span className={cn('absolute inset-y-0 left-0 w-[3px]', sev.bar)} aria-hidden="true" />
                <div className="flex items-center gap-1.5">
                  <span className={cn('rounded-sm px-1 py-px font-mono text-[8.5px] font-semibold uppercase tracking-wide', sev.pill)}>{sev.label}</span>
                  <span className="font-mono text-[8.5px] uppercase tracking-wide text-ink-3">{AI_CATEGORY_LABEL[s.category] ?? s.category}</span>
                </div>
                <p className="mt-1 text-[12px] font-semibold leading-snug text-ink">{s.title}</p>
                {s.detail && <p className="mt-0.5 text-[11px] leading-relaxed text-ink-3">{s.detail}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {rel.slice(0, 3).map((el) => (
                    <button
                      key={el.id}
                      onClick={() => useSuggestionStore.getState().focus([el.id])}
                      className="max-w-[110px] truncate rounded-sm border border-line-2 bg-paper-2 px-1.5 py-0.5 font-mono text-[9.5px] text-ink-2 hover:border-accent hover:text-accent"
                    >
                      {el.content}
                    </button>
                  ))}
                  <button
                    onClick={() => addNote(s)}
                    disabled={!canEdit || added.has(s.id)}
                    className="ml-auto flex h-6 items-center gap-1 rounded-sm px-1.5 text-[10.5px] font-medium text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink disabled:opacity-50"
                  >
                    {added.has(s.id) ? <Check size={11} /> : <StickyNote size={11} />} {added.has(s.id) ? 'Added' : 'Add as note'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
