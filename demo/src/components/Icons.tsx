import React from "react";

/**
 * Font-independent inline icons. We render these as SVG rather than relying on
 * Unicode glyphs, because the subsetted webfonts don't include symbols like
 * ✔ ❯ ✓ or the braille spinner (they'd render as tofu boxes).
 */

const inline: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  verticalAlign: "middle",
};

export const Chevron: React.FC<{ size?: number; color?: string; weight?: number }> = ({
  size = 28,
  color = "#86868b",
  weight = 2,
}) => (
  <span style={{ ...inline, width: size, height: size }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <polyline
        points="9,5 16,12 9,19"
        stroke={color}
        strokeWidth={weight}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </span>
);

export const CheckMark: React.FC<{ size?: number; color?: string; weight?: number }> = ({
  size = 30,
  color = "#30d158",
  weight = 2.4,
}) => (
  <span style={{ ...inline, width: size, height: size }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <polyline
        points="5,13 10,18 19,6"
        stroke={color}
        strokeWidth={weight}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </span>
);

/** Frame-driven rotating spinner ring (CSS animations don't work in Remotion). */
export const Spinner: React.FC<{ size?: number; color?: string; frame: number }> = ({
  size = 30,
  color = "#0a84ff",
  frame,
}) => (
  <span style={{ ...inline, width: size, height: size }}>
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ transform: `rotate(${(frame * 18) % 360}deg)` }}
    >
      <circle cx="12" cy="12" r="9" stroke="rgba(148,163,184,0.28)" strokeWidth="3" fill="none" />
      <path
        d="M12 3 a9 9 0 0 1 9 9"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  </span>
);
