interface LogoProps {
  /** Rendered width/height in px. */
  size?: number;
}

/** Vectorizer mark: a pen-tool bezier on a Material-Blue tile with gray handles. */
export default function Logo({ size = 28 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="Vectorizer logo"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="vz-logo-blue" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#42A5F5" />
          <stop offset="1" stopColor="#1565C0" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="11" fill="url(#vz-logo-blue)" />
      <g stroke="#B0BEC5" strokeWidth="1.6" strokeLinecap="round">
        <line x1="15" y1="33" x2="15" y2="18" />
        <line x1="33" y1="15" x2="33" y2="30" />
      </g>
      <circle cx="15" cy="18" r="2.4" fill="#CFD8DC" />
      <circle cx="33" cy="30" r="2.4" fill="#CFD8DC" />
      <path d="M15 33 C15 18 33 30 33 15" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" />
      <rect x="11.5" y="29.5" width="7" height="7" rx="1.4" fill="#FFFFFF" stroke="#1565C0" strokeWidth="1.6" />
      <rect x="29.5" y="11.5" width="7" height="7" rx="1.4" fill="#FFFFFF" stroke="#1565C0" strokeWidth="1.6" />
    </svg>
  );
}
