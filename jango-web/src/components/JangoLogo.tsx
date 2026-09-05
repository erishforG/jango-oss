/**
 * Jango brand logo — Geometric "J" inside a rounded coin shape.
 * Uses CSS custom properties so the icon automatically follows
 * the active color-theme (indigo / emerald / slate) and dark mode.
 *
 * Variants:
 *   icon  – square icon only   (sidebar collapsed, favicon, mobile header icon)
 *   full  – icon + wordmark    (sidebar expanded, login)
 */

interface JangoLogoProps {
  /** Which variant to render */
  variant?: 'icon' | 'full';
  /** Icon size in px (width = height) */
  size?: number;
  /** Optional extra className on the wrapper */
  className?: string;
  /** Show tagline below wordmark (only for "full" variant) */
  tagline?: string;
}

/**
 * We generate a unique gradient ID per instance so that multiple
 * logos on the same page don't collide.
 */
let instanceCounter = 0;

function LogoIcon({ size = 32 }: { size?: number }) {
  const gradientId = `jango-bg-${++instanceCounter}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="0"
          y1="0"
          x2="64"
          y2="64"
          gradientUnits="userSpaceOnUse"
        >
          {/*
            --color-primary-500 is the lighter stop,
            --color-primary      is the main (darker) stop.
            Both are overridden per theme / dark-mode in index.css.
          */}
          <stop offset="0%" style={{ stopColor: 'var(--color-primary-500)' }} />
          <stop offset="100%" style={{ stopColor: 'var(--color-primary)' }} />
        </linearGradient>
      </defs>

      {/* Rounded-square background */}
      <rect width="64" height="64" rx="16" fill={`url(#${gradientId})`} />

      {/* Geometric J */}
      <path
        d="M24 16h16v4H28v20c0 5.52 4.48 10 10 10h2v4h-2c-7.73 0-14-6.27-14-14V16z"
        fill="white"
        opacity={0.95}
      />

      {/* Coin arc accent */}
      <path
        d="M38 50c5.52 0 10-4.48 10-10"
        stroke="white"
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.5}
      />
    </svg>
  );
}

export default function JangoLogo({
  variant = 'icon',
  size = 32,
  className = '',
  tagline,
}: JangoLogoProps) {
  if (variant === 'icon') {
    return (
      <span className={className}>
        <LogoIcon size={size} />
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoIcon size={size} />
      <span className="flex flex-col">
        <span
          className="font-bold leading-tight text-text-primary"
          style={{ fontSize: size * 0.47 }}
        >
          Jango
        </span>
        {tagline && (
          <span
            className="text-text-tertiary leading-tight tracking-wide"
            style={{ fontSize: size * 0.31 }}
          >
            {tagline}
          </span>
        )}
      </span>
    </span>
  );
}

/* ── Dynamic favicon helper ──────────────────────────────────
 *  Call `updateFavicon(primary500, primary)` whenever the
 *  color-theme or dark-mode changes.  It generates an SVG data-URL
 *  and swaps the <link rel="icon"> href.
 * ──────────────────────────────────────────────────────────── */
export function updateFavicon(primaryLight: string, primary: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${primaryLight}"/>
      <stop offset="100%" stop-color="${primary}"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="16" fill="url(#bg)"/>
  <path d="M24 16h16v4H28v20c0 5.52 4.48 10 10 10h2v4h-2c-7.73 0-14-6.27-14-14V16z" fill="white" opacity="0.95"/>
  <path d="M38 50c5.52 0 10-4.48 10-10" stroke="white" stroke-width="3" stroke-linecap="round" opacity="0.5"/>
</svg>`;

  const encoded = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    document.head.appendChild(link);
  }
  link.href = encoded;
}
