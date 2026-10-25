export function BambooLogo({ size = 40 }: { size?: number }) {
  return (
    <span
      className="grid place-items-center rounded-full bg-white shadow-card flex-none"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 40 40" width={size * 0.7} height={size * 0.7}>
        <g fill="none" stroke="#0a7a1e" strokeWidth="3" strokeLinecap="round">
          <path d="M14 34V10" />
          <path d="M26 34V6" />
          <path d="M10 18h8M22 14h8M10 27h8M22 24h8" strokeWidth="2" />
        </g>
        <circle cx="20" cy="4" r="2.5" fill="#a8854a" />
      </svg>
    </span>
  );
}
