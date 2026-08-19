export function AuthShell({
  children,
  sideNote,
}: {
  children: React.ReactNode;
  sideNote: string;
}) {
  return (
    <div className="grid min-h-screen bg-paper lg:grid-cols-[420px_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-ink p-10 lg:flex">
        <a
          href="/"
          className="inline-flex items-center gap-2.5 text-paper"
          aria-label="VisualBoard home"
        >
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect x="1.5" y="1.5" width="29" height="29" rx="6.5" stroke="currentColor" strokeWidth="2" />
            <g stroke="currentColor" strokeWidth="1.5" opacity="0.6">
              <path d="M9.5 11 L20 11 M9.5 11 L14.5 20.5 M20 11 L15.5 14" />
            </g>
            <g fill="currentColor">
              <circle cx="9.5" cy="11" r="2.3" />
              <circle cx="20" cy="11" r="1.6" />
              <circle cx="14.5" cy="20.5" r="2.3" />
            </g>
            <circle cx="23" cy="22.5" r="1.7" fill="#d9480f" />
          </svg>
          <span className="text-[17px] font-semibold tracking-tight">VisualBoard</span>
        </a>

        <div>
          <p className="mono-label text-paper/40">{sideNote}</p>
          <h2 className="mt-4 text-balance text-[34px] font-semibold leading-[1.15] tracking-tight text-paper">
            Think. Sketch.
            <br />
            Structure.
            <br />
            Collaborate.
          </h2>

          <div className="mt-10 grid max-w-[280px] grid-cols-3 gap-2" aria-hidden="true">
            {[
              ['M', 'client'],
              ['P', 'api'],
              ['Q', 'queue'],
            ].map(([label, sub], i) => (
              <div
                key={label}
                className="animate-auth-node flex h-20 flex-col items-center justify-center rounded-md border border-white/10 bg-white/[0.04]"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                <span className="text-[13px] font-semibold text-paper">{label}</span>
                <span className="font-mono text-[8.5px] uppercase tracking-wider text-paper/40">{sub}</span>
              </div>
            ))}
          </div>
          <svg className="mt-[-20px] w-[300px]" height="40" aria-hidden="true">
            <path
              d="M33 18 C 60 18, 80 18, 92 20 M 128 20 C 150 20, 168 20, 178 32 M 125 34 C 150 34, 165 34, 180 18"
              stroke="#d9480f"
              strokeWidth="1.5"
              fill="none"
              opacity="0.5"
              strokeDasharray="300"
              className="animate-auth-line"
            />
          </svg>
        </div>

        <p className="font-mono text-[11px] leading-relaxed text-paper/35">
          Infinite canvas · real-time collaboration
          <br />
          architecture intelligence · board history
        </p>
      </aside>

      <main className="flex items-center justify-center px-5 py-12">{children}</main>

      <style>{`
        @keyframes auth-node-pop { from { opacity: 0; transform: translateY(8px) scale(0.95); } to { opacity: 1; transform: none; } }
        .animate-auth-node { opacity: 0; animation: auth-node-pop 0.5s cubic-bezier(0.22,1,0.36,1) forwards; }
        @keyframes auth-line-draw { to { stroke-dashoffset: 0; } }
        .animate-auth-line { stroke-dashoffset: 300; animation: auth-line-draw 1.6s 0.6s ease-out forwards; }
        @media (prefers-reduced-motion: reduce) {
          .animate-auth-node, .animate-auth-line { animation: none !important; opacity: 1; }
          .animate-auth-line { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
}

export default AuthShell;