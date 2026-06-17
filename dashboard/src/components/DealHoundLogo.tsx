// Cerberus mark — a bold, angular guard-dog / wolf head. Reads at any size.
export function CerberusLogo({ size = 44, className = "" }: { size?: number; className?: string }) {
  const c = "var(--primary-cyan, #8ed1df)";
  const ink = "#0a1a3f";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-label="Cerberus">
      <circle cx="32" cy="32" r="29" stroke={c} strokeWidth="1.5" opacity="0.22" />
      {/* ears */}
      <path d="M18 16 L27 25 L20 27 Z" fill={c} />
      <path d="M46 16 L37 25 L44 27 Z" fill={c} />
      {/* head → muzzle */}
      <path d="M21 23 H43 L46 35 L38 47 L32 51 L26 47 L18 35 Z" fill={c} />
      {/* eyes (negative) */}
      <path d="M24.5 31 L30 33 L29 36 L24 34 Z" fill={ink} />
      <path d="M39.5 31 L34 33 L35 36 L40 34 Z" fill={ink} />
      {/* nose */}
      <path d="M32 42 L35.5 47 L28.5 47 Z" fill={ink} />
    </svg>
  );
}
