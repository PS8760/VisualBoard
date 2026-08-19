import { FileText, FileCode2, Image, FileType2 } from 'lucide-react';
import { Container, Section, SectionHeading } from '../../components/ui/Section';
import { useReveal } from '../../hooks/useReveal';

const ARCH = [
  { label: 'API Gateway', file: 'architecture.pdf', icon: FileText, tone: 'text-danger', center: true },
  { label: 'Authentication', file: 'api-spec.md', icon: FileCode2, tone: 'text-accent', center: true },
  { label: 'PostgreSQL', file: 'database-schema.png', icon: Image, tone: 'text-blue-600', center: false },
];

export default function Documentation() {
  const sectionRef = useReveal<HTMLDivElement>();

  return (
    <Section id="documentation" className="border-t border-line bg-paper-2/40">
      <Container>
        <div className="grid items-start gap-14 lg:grid-cols-[1fr_420px] lg:gap-16">
          <div ref={sectionRef}>
            <SectionHeading
              eyebrow="Documentation"
              title="Docs live where the system lives."
              description="Attach a PDF to the service it belongs to, a schema to the database, a spec to the API. Files stay anchored to the exact step of the design that needs them."
            />

            <div data-reveal className="mt-10 overflow-hidden rounded-xl border border-line-2 bg-board shadow-sm">
              <div className="flex h-9 items-center justify-between border-b border-line bg-paper-2/70 px-4">
                <span className="font-mono text-[10px] uppercase tracking-wide text-ink-3">
                  system architecture
                </span>
                <span className="font-mono text-[10px] text-ink-3">4 attachments</span>
              </div>

              <div className="flex flex-col items-center gap-0 py-8">
                {ARCH.map((node, i) => (
                  <div key={node.label} className="flex flex-col items-center">
                    <div className="flex h-[46px] w-[180px] items-center justify-center rounded-lg border border-line-2 bg-paper shadow-xs">
                      <span className="text-[12px] font-semibold text-ink">{node.label}</span>
                    </div>
                    <div className="my-1.5 h-6 w-px bg-line-2" aria-hidden="true" />
                    <a
                      href="#documentation"
                      onClick={(e) => e.preventDefault()}
                      data-reveal
                      data-reveal-delay={String(i * 0.15)}
                      className="group flex h-[30px] w-[190px] items-center gap-2 rounded-md border border-line-2 bg-paper px-2.5 shadow-xs transition-all duration-150 hover:-translate-y-0.5 hover:border-line-3 hover:shadow-md"
                    >
                      <node.icon size={12} className={node.tone} />
                      <span className="flex-1 truncate font-mono text-[10px] text-ink-2">{node.file}</span>
                      <span className="font-mono text-[9px] text-ink-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                        view
                      </span>
                    </a>
                  </div>
                ))}
                <div data-reveal data-reveal-delay="0.45" className="mt-2 flex items-center gap-2">
                  <div className="flex h-[30px] w-[190px] items-center gap-2 rounded-md border border-dashed border-line-2 px-2.5">
                    <FileType2 size={12} className="text-ink-3" />
                    <span className="font-mono text-[10px] text-ink-3">requirements.docx</span>
                  </div>
                  <span className="font-mono text-[9px] text-ink-3">← auth</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:sticky lg:top-24">
            <div data-reveal className="rounded-xl border border-line-2 bg-ink p-6 text-left shadow-lg">
              <p className="mono-label flex items-center gap-2 text-paper/50">
                <FileText size={12} />
                attachment model
              </p>
              <pre className="mt-4 overflow-x-auto font-mono text-[12px] leading-relaxed text-paper/85">
{`Attachment {
  id: "att_8f2…"
  element: "postgresql"
  file: "database-schema.png"
  type: "image/png"
  size: 1.2 MB
  added: 2d ago
  by: "Aisha"
}`}
              </pre>
              <div className="mt-5 space-y-2 border-t border-white/10 pt-4">
                {[
                  ['Drag & drop', 'drop a file onto any element'],
                  ['Hover', 'name · type · size · date'],
                  ['Open', 'inline preview in the side panel'],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-4">
                    <span className="font-mono text-[10px] uppercase tracking-wide text-accent">{k}</span>
                    <span className="text-right text-[12px] text-paper/70">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <p data-reveal className="mt-6 text-[13.5px] leading-relaxed text-ink-2">
              No more digging through a docs folder wondering which version
              matches the diagram. The file is on the element, the element is
              in the diagram, the diagram is the source of truth.
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}