import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KeyRound, Zap, Activity, Check, X, Plus } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';

interface DemoNode {
  id: string;
  label: string;
  sub: string;
  y: number;
  accent?: boolean;
}

const BASE_CHAIN: DemoNode[] = [
  { id: 'user', label: 'User', sub: 'client', y: 12 },
  { id: 'frontend', label: 'Frontend', sub: 'react app', y: 82 },
  { id: 'api', label: 'API', sub: 'app service', y: 152, accent: true },
  { id: 'db', label: 'Database', sub: 'postgres', y: 222 },
];

const SUGGESTIONS = [
  { id: 'auth', title: 'Add authentication layer', icon: KeyRound },
  { id: 'cache', title: 'Add caching', icon: Zap },
  { id: 'monitor', title: 'Add monitoring', icon: Activity },
];

export default function SuggestionsDemo() {
  const [chain, setChain] = useState<DemoNode[]>(BASE_CHAIN);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = SUGGESTIONS.filter((s) => !applied.has(s.id) && !dismissed.has(s.id));
  const authApplied = applied.has('auth');

  const applySuggestion = (id: string) => {
    setApplied((prev) => new Set(prev).add(id));
    if (id === 'auth' && !authApplied) {
      setChain((prev) => {
        const apiIndex = prev.findIndex((n) => n.id === 'api');
        if (apiIndex === -1) return prev;
        const head = prev.slice(0, apiIndex);
        const tail = prev.slice(apiIndex);
        return [
          ...head,
          { id: 'authsvc', label: 'Auth Service', sub: 'jwt · oauth', y: head.length * 70 + 12, accent: true },
          ...tail.map((n) => ({ ...n, y: n.y + 70 })),
        ];
      });
    }
  };

  const dismissSuggestion = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  };

  return (
    <div className="overflow-hidden rounded-lg border border-line-2 bg-board shadow-xs">
      <div className="flex h-9 items-center justify-between border-b border-line bg-paper-2/70 px-3">
        <span className="font-mono text-[10px] uppercase tracking-wide text-ink-3">
          architecture intelligence
        </span>
        <Badge tone="accent" className="px-2 py-0 text-[10px]">
          {visible.length} suggestion{visible.length === 1 ? '' : 's'}
        </Badge>
      </div>

      <div className="grid min-h-[300px] grid-cols-[1fr_190px] gap-0 md:grid-cols-[1fr_230px]">
        <div className="relative grid-paper grid-paper-fine border-r border-line">
          {chain.map((node) => (
            <div key={node.id} className="absolute inset-x-0 flex justify-center" style={{ top: node.y }}>
              <div
                className={[
                  'flex h-[48px] w-[150px] flex-col items-center justify-center rounded-lg border px-3 shadow-xs',
                  node.accent ? 'border-accent/60 bg-accent-softer' : 'border-line-2 bg-paper',
                ].join(' ')}
              >
                <span className="text-[12px] font-semibold leading-tight text-ink">{node.label}</span>
                <span className="font-mono text-[9px] uppercase tracking-wide text-ink-3">{node.sub}</span>
              </div>
            </div>
          ))}

          <svg className="absolute left-1/2 top-0 h-full -translate-x-1/2" width="2" aria-hidden="true">
            {chain.slice(0, -1).map((n, i) => (
              <line
                key={n.id}
                x1="1" y1={n.y + 54} x2="1" y2={chain[i + 1]!.y - 2}
                stroke="#b0aea2" strokeWidth="1.75"
              />
            ))}
          </svg>
        </div>

        <div className="flex flex-col gap-2 bg-paper-2/40 p-3">
          <AnimatePresence initial={false}>
            {visible.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.2, delay: i * 0.05 }}
                className="rounded-md border border-line bg-paper p-2.5 shadow-xs"
              >
                <div className="flex items-start gap-2">
                  <s.icon size={13} className="mt-0.5 shrink-0 text-accent" />
                  <div className="min-w-0">
                    <p className="text-[11.5px] font-medium leading-snug text-ink">{s.title}</p>
                    <p className="mt-0.5 text-[10.5px] leading-snug text-ink-3">{s.id === 'auth' ? 'Protect the API behind token-based auth before exposing it.' : s.id === 'cache' ? 'Frequently read data could sit behind a cache to cut latency.' : 'Logs, metrics and tracing make production behaviour visible.'}</p>
                  </div>
                </div>
                <div className="mt-2 flex gap-1.5">
                  <button
                    onClick={() => applySuggestion(s.id)}
                    className="inline-flex h-6 flex-1 items-center justify-center gap-1 rounded-sm bg-ink px-2 text-[10.5px] font-medium text-paper transition-colors hover:bg-black"
                  >
                    <Plus size={11} /> Apply
                  </button>
                  <button
                    onClick={() => dismissSuggestion(s.id)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-sm border border-line-2 text-ink-3 transition-colors hover:bg-paper-2 hover:text-ink"
                    aria-label="Dismiss suggestion"
                  >
                    <X size={11} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {visible.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <Check size={18} className="text-success" />
              <p className="text-[11px] leading-snug text-ink-3">
                All suggestions handled
                <br />
                <span className="font-mono text-[9.5px]">board is sound</span>
              </p>
            </div>
          )}

          <div className="mt-auto border-t border-line pt-2">
            <p className="font-mono text-[9.5px] uppercase tracking-wide text-ink-3">
              contextual · non-intrusive
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}