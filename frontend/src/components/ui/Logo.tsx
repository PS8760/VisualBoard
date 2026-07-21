export default function Logo() {
  return (
    <div className="flex items-center gap-3">
      <svg
        width="32"
        height="32"
        viewBox="0 0 64 64"
        fill="none"
      >
        <defs>
          <linearGradient
            id="logo-gradient"
            x1="0"
            y1="0"
            x2="64"
            y2="64"
          >
            <stop offset="0%" stopColor="#A855F7" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
        </defs>

        <path
          d="M12 16H24L32 40L24 48L12 16Z"
          fill="url(#logo-gradient)"
        />

        <path
          d="M40 16H52L40 48H28L40 16Z"
          fill="url(#logo-gradient)"
        />
      </svg>

      <span className="text-xl font-semibold text-white">
        VisualBoard
      </span>
    </div>
  );
}