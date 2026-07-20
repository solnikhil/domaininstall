import React from "react";

/**
 * App-icon-style mark: an Apple-esque rounded-square with a globe (domain)
 * and a download chevron (install) — "the domain is the package".
 */
export const Logo: React.FC<{ size?: number; radiusRatio?: number }> = ({
  size = 220,
  radiusRatio = 0.235,
}) => {
  const r = size * radiusRatio;
  return (
    <svg width={size} height={size} viewBox="0 0 220 220" fill="none">
      <defs>
        <linearGradient id="dgrad" x1="0" y1="0" x2="220" y2="220">
          <stop offset="0" stopColor="#0a84ff" />
          <stop offset="1" stopColor="#bf5af2" />
        </linearGradient>
        <linearGradient id="dgloss" x1="0" y1="0" x2="0" y2="220">
          <stop offset="0" stopColor="rgba(255,255,255,0.35)" />
          <stop offset="0.5" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <rect width="220" height="220" rx={r * (220 / size)} fill="url(#dgrad)" />
      <rect width="220" height="220" rx={r * (220 / size)} fill="url(#dgloss)" />
      {/* globe */}
      <g stroke="white" strokeWidth="6" fill="none" opacity="0.96">
        <circle cx="110" cy="96" r="46" />
        <ellipse cx="110" cy="96" rx="20" ry="46" />
        <line x1="64" y1="96" x2="156" y2="96" />
      </g>
      {/* download chevron + tray (install) */}
      <g stroke="white" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <line x1="110" y1="150" x2="110" y2="184" />
        <polyline points="94,170 110,186 126,170" />
      </g>
    </svg>
  );
};
