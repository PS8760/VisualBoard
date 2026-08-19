import { useEffect, useRef } from 'react';
import { MessageSquare, Radio, Users, Lock, PenLine } from 'lucide-react';
import { Container, Section, SectionHeading } from '../../components/ui/Section';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const FEATURES = [
  { icon: PenLine, title: 'Live drawing', detail: 'Everyone draws on the same canvas at the same time.' },
  { icon: MessageSquare, title: 'Inline comments', detail: 'Comment threads pinned exactly where the question is.' },
  { icon: Users, title: 'Shared board', detail: 'One board per project. The link is the invitation.' },
  { icon: Lock, title: 'Role-based access', detail: 'Owner, editor and viewer roles on every board.' },
];

export default function Collaboration() {
  const stageRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const el = stageRef.current;
    if (!el) return;
    el.querySelectorAll('.collab-reveal').forEach((n, i) => {
      (n as HTMLElement).style.animationDelay = `${i * 180}ms`;
    });
  }, [reduced]);

  return (
    <Section id="collaboration" className="border-t border-line">
      <Container>
        <div className="grid items-center gap-14 lg:grid-cols-[400px_1fr] lg:gap-16">
          <div>
            <SectionHeading
              eyebrow="Collaboration"
              title="Work together without being in the same room."
              description="Cursors, live drawing and comments move in real time. The person on the other side of the board isn't a nickname in a chat — they're right there with you."
            />
            <ul className="mt-9 space-y-4">
              {FEATURES.map((f, i) => (
                <li key={f.title} data-reveal data-reveal-delay={String(i * 0.06)} className="flex gap-3.5">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-paper text-ink-2 shadow-xs">
                    <f.icon size={15} />
                  </span>
                  <div>
                    <p className="text-[14px] font-semibold text-ink">{f.title}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{f.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div ref={stageRef} data-reveal className="relative">
            <div className="overflow-hidden rounded-xl border border-line-2 bg-board shadow-sm">
              <div className="flex h-10 items-center justify-between border-b border-line bg-paper-2/70 px-4">
                <span className="inline-flex items-center gap-2 text-[12.5px] font-medium text-ink">
                  <Radio size={13} className="text-success" />
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                  </span>
                  Live — 3 online
                </span>
                <span className="flex -space-x-1.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-paper bg-accent text-[9px] font-semibold text-white">P</span>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-paper bg-blue-600 text-[9px] font-semibold text-white">A</span>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-paper bg-violet-600 text-[9px] font-semibold text-white">M</span>
                </span>
              </div>

              <div className="relative h-[400px] grid-paper grid-paper-fine">
                <div className="absolute left-14 top-[150px] flex h-[52px] w-[170px] flex-col items-center justify-center rounded-lg border border-line-2 bg-paper shadow-xs">
                  <span className="text-[12.5px] font-semibold text-ink">Login Service</span>
                  <span className="font-mono text-[9px] uppercase tracking-wide text-ink-3">refactoring</span>
                </div>
                <div className="absolute right-14 top-[150px] flex h-[52px] w-[170px] flex-col items-center justify-center rounded-lg border border-line-2 bg-paper shadow-xs">
                  <span className="text-[12.5px] font-semibold text-ink">Session Store</span>
                  <span className="font-mono text-[9px] uppercase tracking-wide text-ink-3">redis</span>
                </div>

                <svg className="absolute inset-0" width="100%" height="100%" aria-hidden="true">
                  <line x1="34%" y1="176" x2="66%" y2="176" stroke="#b0aea2" strokeWidth="1.75" />
                  <line x1="50%" y1="176" x2="50%" y2="0" stroke="#b0aea2" strokeWidth="1.75" strokeDasharray="4 4" />
                  <path
                    className="collab-draw"
                    d="M 0 120 C 80 90, 120 40, 190 52 S 300 140, 360 130 L 430 110"
                    fill="none"
                    stroke="#d9480f"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray="600"
                    strokeDashoffset="600"
                  />
                </svg>

                <div className="collab-cursor absolute" style={{ left: '36%', top: '46%' }} aria-hidden="true">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M5.5 3.2l12.8 6.8-6 2.2-3.4 6L5.5 3.2z" fill="#d9480f" stroke="#fff" strokeWidth="1.4" />
                  </svg>
                  <span className="absolute left-3 top-2.5 flex h-[16px] items-center whitespace-nowrap rounded-sm bg-accent px-1.5 text-[9px] font-medium text-white">
                    Pranav <span className="ml-1 opacity-70">drawing</span>
                  </span>
                </div>
                <div className="collab-cursor collab-cursor-2 absolute" style={{ left: '50%', top: '30%' }} aria-hidden="true">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M5.5 3.2l12.8 6.8-6 2.2-3.4 6L5.5 3.2z" fill="#2563eb" stroke="#fff" strokeWidth="1.4" />
                  </svg>
                  <span className="absolute left-3 top-2.5 flex h-[16px] items-center whitespace-nowrap rounded-sm bg-blue-600 px-1.5 text-[9px] font-medium text-white">
                    Aisha <span className="ml-1 opacity-70">reviewing</span>
                  </span>
                </div>
                <div className="collab-cursor collab-cursor-3 absolute" style={{ left: '62%', top: '40%' }} aria-hidden="true">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M5.5 3.2l12.8 6.8-6 2.2-3.4 6L5.5 3.2z" fill="#7c3aed" stroke="#fff" strokeWidth="1.4" />
                  </svg>
                  <span className="absolute left-3 top-2.5 flex h-[16px] items-center whitespace-nowrap rounded-sm bg-violet-600 px-1.5 text-[9px] font-medium text-white">
                    Marcus <span className="ml-1 opacity-70">commenting</span>
                  </span>
                </div>

                <div className="collab-comment collab-reveal absolute left-[56%] top-[52%] flex w-[190px] items-start gap-1.5 rounded-lg border border-line bg-paper p-2.5 shadow-md">
                  <MessageSquare size={11} className="mt-0.5 shrink-0 text-violet-600" />
                  <div>
                    <p className="text-[10.5px] font-medium text-ink">Marcus</p>
                    <p className="mt-0.5 text-[10.5px] leading-snug text-ink-2">
                      Session keys should rotate — flagging before we merge.
                    </p>
                  </div>
                </div>

                <div className="collab-reveal absolute bottom-3 right-3 flex items-center gap-2 rounded-md border border-line bg-paper px-2.5 py-1.5 shadow-xs">
                  <span className="font-mono text-[9.5px] uppercase tracking-wide text-ink-3">role-based access</span>
                  <span className="h-3 w-px bg-line" />
                  <span className="mono-label text-[9px] text-success">owner</span>
                  <span className="mono-label text-[9px] text-ink-2">editors</span>
                  <span className="mono-label text-[9px] text-ink-3">viewer</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>

      <style>{`
        .collab-draw { animation: cd-draw 5s ease-in-out infinite; }
        .collab-cursor { opacity: 0; animation: cc-move 8s ease-in-out infinite; }
        .collab-cursor-2 { animation-delay: 1.6s; }
        .collab-cursor-3 { animation-delay: 3.4s; }
        .collab-reveal { opacity: 0; animation: cd-pop 0.5s cubic-bezier(0.22,1,0.36,1) forwards; }
        @keyframes cd-draw {
          0% { stroke-dashoffset: 600; }
          22% { stroke-dashoffset: 0; }
          55% { stroke-dashoffset: 0; }
          75% { stroke-dashoffset: 600; }
          100% { stroke-dashoffset: 600; }
        }
        @keyframes cc-move {
          0%, 80% { transform: translate(0, 0); opacity: 0; }
          4% { opacity: 1; }
          20% { opacity: 1; transform: translate(40px, 62px); }
          34% { opacity: 1; transform: translate(-20px, -18px); }
          48% { opacity: 1; transform: translate(120px, 28px); }
          62% { opacity: 1; transform: translate(10px, 80px); }
          74% { opacity: 1; transform: translate(-60px, 10px); }
          86% { opacity: 0; transform: translate(0, 0); }
          100% { opacity: 0; }
        }
        @keyframes cd-pop {
          from { opacity: 0; transform: translateY(10px) scale(0.97); }
          to { opacity: 1; transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .collab-draw, .collab-cursor, .collab-reveal { animation: none !important; opacity: 1 !important; }
          .collab-draw { stroke-dashoffset: 0; }
        }
      `}</style>
    </Section>
  );
}