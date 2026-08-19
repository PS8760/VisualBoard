import { useEffect, useRef, useState } from 'react';
import {
  MousePointer2, Hand, PenLine, Square, Circle as CircleIcon, Minus,
  MoveUpRight, Type, StickyNote, Image as ImageIcon, FileText,
  MessageSquare, Share2, History, Settings, Check, ChevronsUpDown,
  PanelRight, Keyboard, ZoomIn, ZoomOut, GitBranch, MoreHorizontal,
} from 'lucide-react';
import { Container, Section, SectionHeading } from '../../components/ui/Section';
import { Kbd } from '../../components/ui/Kbd';
import { cn } from '../../utils';

const W = 1120;
const H = 640;

const TOOLS: Array<{ id: string; icon: typeof MousePointer2; label: string; key: string }> = [
  { id: 'select', icon: MousePointer2, label: 'Select', key: 'V' },
  { id: 'hand', icon: Hand, label: 'Hand', key: 'H' },
  { id: 'pen', icon: PenLine, label: 'Pen', key: 'P' },
  { id: 'rect', icon: Square, label: 'Rectangle', key: 'R' },
  { id: 'circle', icon: CircleIcon, label: 'Circle', key: 'O' },
  { id: 'line', icon: Minus, label: 'Line', key: 'L' },
  { id: 'arrow', icon: MoveUpRight, label: 'Arrow', key: 'A' },
  { id: 'text', icon: Type, label: 'Text', key: 'T' },
  { id: 'sticky', icon: StickyNote, label: 'Sticky', key: 'S' },
  { id: 'image', icon: ImageIcon, label: 'Image', key: '' },
  { id: 'doc', icon: FileText, label: 'Document', key: '' },
  { id: 'comment', icon: MessageSquare, label: 'Comment', key: 'C' },
];

const NODES: Array<{
  label: string; sub: string; x: number; y: number; w: number; accent?: string; stick?: string;
}> = [
  { label: 'User', sub: 'client', x: 60, y: 270, w: 170 },
  { label: 'Frontend', sub: 'react · web', x: 260, y: 270, w: 190 },
  { label: 'API Gateway', sub: 'auth · rate-limit', x: 480, y: 160, w: 190, accent: '#d9480f' },
  { label: 'Authentication', sub: 'jwt · oauth', x: 480, y: 370, w: 190 },
  { label: 'PostgreSQL', sub: 'primary store', x: 480, y: 490, w: 190 },
  { label: 'Redis Cache', sub: 'sessions', x: 700, y: 160, w: 180 },
  { label: 'Message Queue', sub: 'async jobs', x: 700, y: 350, w: 190 },
];

const CONNS: Array<[number, number, number, number]> = [
  [230, 300, 260, 300],
  [450, 300, 480, 220],
  [575, 220, 575, 370],
  [575, 430, 575, 490],
  [670, 190, 700, 190],
  [620, 200, 740, 350],
];

const LEFT_TABS: Array<{ id: string; label: string; count?: number; accent?: boolean }> = [
  { id: 'info', label: 'Board info' },
  { id: 'comments', label: 'Comments', count: 3 },
  { id: 'docs', label: 'Documents', count: 2 },
  { id: 'suggest', label: 'Suggestions', count: 2, accent: true },
] as const;

export default function Showcase() {
  const [tool, setTool] = useState('select');
  const [tab, setTab] = useState<(typeof LEFT_TABS)[number]['id']>('suggest');
  const [selected, setSelected] = useState<string | null>('API Gateway');
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const measure = () => {
      const el = wrapRef.current;
      if (!el) return;
      setScale(Math.min(1, el.clientWidth / W));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <Section id="product-demo" className="border-t border-line bg-ink py-0">
      <div className="bg-ink px-5 py-20 md:px-8 md:py-28">
        <Container className="max-w-none px-0 md:px-8">
          <SectionHeading
            className="[&_h2]:text-paper [&_p]:text-paper/60"
            eyebrow="The workspace"
            title="Everything a board needs. Nothing it doesn't."
            description="A toolbar, a canvas, and a panel that appears when you need it. The full workspace in miniature — exactly what you get when you create a board."
          />
        </Container>

        <div className="mx-auto mt-14 max-w-[1240px] px-5 md:px-8">
          <div ref={wrapRef} className="relative overflow-hidden rounded-xl border border-white/10 bg-paper shadow-lg" style={{ height: H * scale + 76 * scale }}>
            <div
              className="absolute left-0 top-0 origin-top-left"
              style={{ width: W, height: H + 76, transform: `scale(${scale})` }}
            >
              {/* Top bar */}
              <div className="flex h-[48px] items-center justify-between border-b border-line bg-paper px-3.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex gap-1.5" aria-hidden="true">
                    <span className="h-2 w-2 rounded-full bg-line-3" />
                    <span className="h-2 w-2 rounded-full bg-line-3" />
                    <span className="h-2 w-2 rounded-full bg-accent/70" />
                  </span>
                  <span className="ml-1 flex min-w-0 items-center gap-1 truncate text-[13px] font-semibold text-ink">
                    Checkout Service Architecture
                    <ChevronsUpDown size={11} className="shrink-0 text-ink-3" />
                  </span>
                  <span className="ml-2 inline-flex items-center gap-1 font-mono text-[10px] text-ink-3">
                    <Check size={10} className="text-success" /> Saved
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button className="flex h-7 w-7 items-center justify-center rounded-sm text-ink-2 hover:bg-paper-2" aria-label="Share">
                    <Share2 size={14} />
                  </button>
                  <button className="flex h-7 w-7 items-center justify-center rounded-sm text-ink-2 hover:bg-paper-2" aria-label="Version history">
                    <History size={14} />
                  </button>
                  <button className="flex h-7 w-7 items-center justify-center rounded-sm text-ink-2 hover:bg-paper-2" aria-label="Settings">
                    <Settings size={14} />
                  </button>
                  <span className="mx-1 h-4 w-px bg-line" aria-hidden="true" />
                  <span className="flex -space-x-1.5" aria-hidden="true">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] border-paper bg-accent text-[9px] font-semibold text-white">P</span>
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] border-paper bg-blue-600 text-[9px] font-semibold text-white">A</span>
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] border-paper bg-violet-600 text-[9px] font-semibold text-white">M</span>
                  </span>
                  <button className="ml-2 flex h-7 items-center gap-1.5 rounded-sm bg-accent px-3 text-[11.5px] font-medium text-white transition-colors hover:bg-accent-2">
                    <Share2 size={12} /> Share
                  </button>
                </div>
              </div>

              <div className="flex" style={{ height: H }}>
                {/* Toolbar */}
                <div className="flex w-[52px] shrink-0 flex-col items-center gap-0.5 border-r border-line bg-paper-2/60 py-2.5">
                  {TOOLS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTool(t.id)}
                      title={`${t.label}${t.key ? `  (${t.key})` : ''}`}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-sm transition-colors duration-100',
                        tool === t.id ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-paper-2 hover:text-ink',
                      )}
                    >
                      <t.icon size={15} />
                    </button>
                  ))}
                  <div className="mt-1.5 h-px w-6 bg-line" aria-hidden="true" />
                  <button className="flex h-8 w-8 items-center justify-center rounded-sm text-ink-2 hover:bg-paper-2 hover:text-ink" title="More tools">
                    <MoreHorizontal size={15} />
                  </button>
                </div>

                {/* Canvas */}
                <div className="relative flex-1 overflow-hidden grid-paper grid-paper-fine">
                  <svg width={W} height={H} className="absolute inset-0" aria-hidden="true">
                    {CONNS.map(([x1, y1, x2, y2], i) => (
                      <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#b0aea2" strokeWidth="1.75" />
                    ))}
                  </svg>

                  {NODES.map((node) => (
                    <button
                      key={node.label}
                      onClick={() => setSelected(node.label === selected ? null : node.label)}
                      className={cn(
                        'absolute flex flex-col items-center justify-center rounded-lg border bg-paper shadow-xs transition-all duration-150',
                        selected === node.label ? 'z-10 ring-2 ring-accent ring-offset-2 ring-offset-board' : 'border-line-2 hover:border-line-3',
                      )}
                      style={{
                        left: node.x, top: node.y,
                        width: node.w, height: 52,
                        borderColor: node.accent ? undefined : undefined,
                        outline: node.accent ? '1px solid rgba(217,72,15,0.35)' : undefined,
                        background: node.accent ? '#fdf3ec' : undefined,
                      }}
                    >
                      <span className="text-[12.5px] font-semibold text-ink">{node.label}</span>
                      <span className="font-mono text-[9px] uppercase tracking-wide text-ink-3">{node.sub}</span>
                      {node.label === 'API Gateway' && (
                        <span className="absolute -bottom-2 right-1.5 flex h-[18px] items-center gap-1 rounded-[4px] border border-line-2 bg-paper px-1.5 shadow-xs">
                          <FileText size={9} className="text-accent" />
                          <span className="font-mono text-[8.5px] text-ink-2">architecture.pdf</span>
                        </span>
                      )}
                      {node.label === 'PostgreSQL' && (
                        <span className="absolute -left-2.5 -top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white shadow-xs">
                          <MessageSquare size={9} />
                        </span>
                      )}
                    </button>
                  ))}

                  <div className="absolute left-[700px] top-[470px] flex w-[190px] items-center gap-1.5 rounded-lg border border-line-2 bg-paper p-1.5 shadow-sm">
                    <span className="flex h-5 w-5 items-center justify-center rounded-[4px] bg-danger-soft text-danger">
                      <FileText size={10} />
                    </span>
                    <span className="truncate font-mono text-[10px] text-ink-2">api-spec.md</span>
                  </div>

                  {/* cursors */}
                  <div className="showcase-cursor cursor-a absolute" style={{ left: 340, top: 120 }} aria-hidden="true">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path d="M5.5 3.2l12.8 6.8-6 2.2-3.4 6L5.5 3.2z" fill="#2563eb" stroke="#fff" strokeWidth="1.4" />
                    </svg>
                    <span className="absolute left-3 top-2.5 h-[16px] whitespace-nowrap rounded-sm bg-blue-600 px-1.5 text-[9px] font-medium text-white">Aisha</span>
                  </div>
                  <div className="showcase-cursor cursor-b absolute" style={{ left: 560, top: 300 }} aria-hidden="true">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path d="M5.5 3.2l12.8 6.8-6 2.2-3.4 6L5.5 3.2z" fill="#7c3aed" stroke="#fff" strokeWidth="1.4" />
                    </svg>
                    <span className="absolute left-3 top-2.5 h-[16px] whitespace-nowrap rounded-sm bg-violet-600 px-1.5 text-[9px] font-medium text-white">Marcus</span>
                  </div>

                  {/* zoom */}
                  <div className="absolute bottom-3 left-1/2 flex h-7 -translate-x-1/2 items-center gap-0.5 rounded-md border border-line-2 bg-paper px-1 shadow-sm">
                    <ZoomOut size={12} className="text-ink-3" />
                    <span className="px-1 font-mono text-[10px] text-ink-2">100%</span>
                    <ZoomIn size={12} className="text-ink-3" />
                  </div>
                </div>

                {/* Right panel */}
                <div className="hidden w-[248px] shrink-0 flex-col border-l border-line bg-paper lg:flex">
                  <div className="flex border-b border-line">
                    {LEFT_TABS.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={cn(
                          'relative flex-1 px-1 py-2 text-center text-[10.5px] font-medium transition-colors',
                          tab === t.id ? 'text-ink' : 'text-ink-3 hover:text-ink-2',
                        )}
                      >
                        {t.label}
                        {t.count && (
                          <span className={cn('ml-0.5 font-mono text-[9px]', t.accent ? 'text-accent' : 'text-ink-3')}>
                            {t.count}
                          </span>
                        )}
                        {tab === t.id && (
                          <span className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-accent" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="flex-1 overflow-hidden p-3">
                    {tab === 'suggest' && (
                      <div className="space-y-2">
                        <p className="mono-label text-[9px] text-ink-3">Contextual suggestions</p>
                        {[
                          { title: 'Add monitoring', tag: 'OBSERV', accent: true },
                          { title: 'Consider a message queue', tag: 'QUEUE', accent: false },
                        ].map((s) => (
                          <div key={s.title} className="rounded-md border border-line bg-paper p-2.5 shadow-xs">
                            <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink">
                              <GitBranch size={11} className="text-accent" /> {s.title}
                            </p>
                            <span className="mt-1 block font-mono text-[9px] uppercase tracking-wide text-ink-3">{s.tag}</span>
                            <div className="mt-2 flex gap-1.5">
                              <span className="flex h-5 flex-1 items-center justify-center rounded-[3px] bg-ink text-[9.5px] font-medium text-paper">Apply</span>
                              <span className="flex h-5 w-10 items-center justify-center rounded-[3px] border border-line-2 text-[9.5px] text-ink-3">Skip</span>
                            </div>
                          </div>
                        ))}
                        <p className="pt-1 text-center font-mono text-[9px] text-ink-3">intelligence · not a chatbot</p>
                      </div>
                    )}
                    {tab === 'comments' && (
                      <div className="space-y-2">
                        <div className="rounded-md border border-line p-2.5">
                          <p className="flex items-center gap-1.5 text-[11px] font-medium text-ink">
                            <span className="h-2.5 w-2.5 rounded-full bg-violet-600" /> Marcus
                          </p>
                          <p className="mt-1 text-[10.5px] leading-snug text-ink-2">
                            Should the gateway also terminate TLS here?
                          </p>
                          <p className="mt-1.5 font-mono text-[9px] text-ink-3">2 days ago</p>
                        </div>
                        <div className="rounded-md border border-line p-2.5">
                          <p className="flex items-center gap-1.5 text-[11px] font-medium text-ink">
                            <span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> Aisha
                          </p>
                          <p className="mt-1 text-[10.5px] leading-snug text-ink-2">
                            Queue consumers still unbuilt — flagging for the sprint.
                          </p>
                          <p className="mt-1.5 font-mono text-[9px] text-ink-3">1 day ago</p>
                        </div>
                      </div>
                    )}
                    {tab === 'info' && selected && (
                      <div className="space-y-3">
                        <p className="mono-label text-[9px] text-ink-3">Selection</p>
                        <div className="rounded-md border border-accent/25 bg-accent-softer p-2.5">
                          <p className="text-[12px] font-semibold text-ink">{selected}</p>
                        </div>
                        {[
                          ['Fill', '#fdf3ec'],
                          ['Stroke', '#d9480f'],
                          ['Radius', '8 px'],
                          ['Font', 'Inter · 14'],
                        ].map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between rounded-md border border-line px-2.5 py-2">
                            <span className="text-[10.5px] text-ink-3">{k}</span>
                            <span className="flex items-center gap-1.5 font-mono text-[10px] text-ink-2">
                              {k === 'Fill' && <span className="h-2.5 w-2.5 rounded-[3px] border border-line" style={{ background: v }} />}
                              {k === 'Stroke' && <span className="h-2.5 w-2.5 rounded-[3px] border border-line" style={{ background: v }} />}
                              {v}
                            </span>
                          </div>
                        ))}
                        <p className="pt-1 font-mono text-[9px] text-ink-3">1 element selected</p>
                      </div>
                    )}
                    {tab === 'docs' && (
                      <div className="space-y-2">
                        {[
                          ['architecture.pdf', 'PDF · 4.6 MB', 'danger'],
                          ['api-spec.md', 'Markdown · 48 KB', 'accent'],
                        ].map(([name, meta, tone]) => (
                          <div key={String(name)} className="flex items-center gap-2 rounded-md border border-line p-2">
                            <FileText size={13} className={cn(tone === 'danger' ? 'text-danger' : 'text-accent')} />
                            <div className="min-w-0">
                              <p className="truncate text-[10.5px] font-medium text-ink">{name}</p>
                              <p className="font-mono text-[9px] text-ink-3">{meta}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Status bar */}
              <div className="flex h-[28px] items-center justify-between border-t border-line bg-paper px-3">
                <span className="inline-flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-wide text-ink-3">
                  <MousePointer2 size={10} />
                  {TOOLS.find((t) => t.id === tool)?.label ?? 'Select'}
                  <span className="mx-1 text-line-3">|</span>
                  <Kbd className="h-[15px] text-[9px]">⌘K</Kbd> commands
                </span>
                <span className="inline-flex items-center gap-3 font-mono text-[9.5px] uppercase tracking-wide text-ink-3">
                  <span className="inline-flex items-center gap-1"><Keyboard size={10} /> shortcuts</span>
                  <span className="inline-flex items-center gap-1"><PanelRight size={10} /> 2 online</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .showcase-cursor { opacity: 0; }
        .showcase-cursor { animation: sc-cursor 9s ease-in-out infinite; }
        .cursor-b { animation-delay: 3.2s; }
        @keyframes sc-cursor {
          0%, 62% { opacity: 0; transform: translate(0, 0); }
          6% { opacity: 1; }
          34% { opacity: 1; transform: translate(60px, 90px); }
          42% { opacity: 1; transform: translate(200px, 40px); }
          56% { opacity: 1; transform: translate(-40px, 150px); }
          66% { opacity: 0; transform: translate(-60px, 0); }
          100% { opacity: 0; transform: translate(-60px, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .showcase-cursor { display: none; }
        }
      `}</style>
    </Section>
  );
}