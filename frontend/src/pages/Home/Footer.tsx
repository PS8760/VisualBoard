import { Link } from 'react-router-dom';
import { AtSign } from 'lucide-react';
import { Container } from '../../components/ui/Section';
import Logo from '../../components/ui/Logo';

const COLUMNS = [
  {
    title: 'Product',
    links: ['Canvas', 'Auto-arrangement', 'Architecture suggestions', 'Document attachments'],
  },
  {
    title: 'Company',
    links: ['Documentation', 'GitHub', 'Contact'],
  },
  {
    title: 'Legal',
    links: ['Privacy', 'Terms'],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-line bg-paper-2/40">
      <Container className="py-14">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs" data-reveal>
            <Link to="/" aria-label="VisualBoard home">
              <Logo />
            </Link>
            <p className="mt-4 text-[13px] leading-relaxed text-ink-2">
              A collaborative whiteboard for ideas, system architecture and
              documentation.
            </p>
            <div className="mt-5 flex gap-2">
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-line-2 text-ink-2 transition-colors duration-150 hover:border-line-3 hover:text-ink"
                aria-label="VisualBoard on GitHub"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.38 7.86 10.9.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.53-1.36-1.3-1.72-1.3-1.72-1.06-.72.08-.71.08-.71 1.18.08 1.8 1.21 1.8 1.21 1.04 1.78 2.73 1.27 3.4.97.11-.75.41-1.27.75-1.56-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.2-3.1-.12-.3-.52-1.52.11-3.17 0 0 .98-.31 3.2 1.19a11.1 11.1 0 0 1 2.92-.39c.99 0 1.99.13 2.92.39 2.21-1.5 3.19-1.19 3.19-1.19.64 1.65.24 2.87.12 3.17.75.81 1.2 1.84 1.2 3.1 0 4.44-2.7 5.41-5.27 5.69.42.36.8 1.07.8 2.16 0 1.56-.01 2.82-.01 3.2 0 .31.21.68.8.56C20.71 21.38 24 17.08 24 12 24 5.65 18.35.5 12 .5z" fill="currentColor" />
                </svg>
              </a>
              <a
                href="mailto:hello@visualboard.dev"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-line-2 text-ink-2 transition-colors duration-150 hover:border-line-3 hover:text-ink"
                aria-label="Email VisualBoard"
              >
                <AtSign size={14} />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3" data-reveal data-reveal-delay="0.1">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <p className="mono-label mb-3.5 text-ink-3">{col.title}</p>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a
                        href="#"
                        onClick={(e) => e.preventDefault()}
                        className="text-[13px] text-ink-2 transition-colors duration-150 hover:text-ink"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div
          className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-line pt-6 sm:flex-row sm:items-center"
          data-reveal
          data-reveal-delay="0.15"
        >
          <p className="font-mono text-[11px] text-ink-3">
            Built for ideas that don&rsquo;t fit in a box.
          </p>
          <p className="font-mono text-[11px] text-ink-3">
            © 2026 VisualBoard · canvas · collaboration · architecture
          </p>
        </div>
      </Container>
    </footer>
  );
}