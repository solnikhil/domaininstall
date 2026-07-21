/** Bright editorial theme tokens for the landscape product film. */
export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

export const colors = {
  bg: "#ffffff",
  bgSoft: "#f5f8fc",
  text: "#101828",
  textDim: "#667085",
  green: "#12a150",
  red: "#e5484d",
  blue: "#1677ff",
  purple: "#7857d9",
  yellow: "#b77900",
  card: "rgba(255,255,255,0.90)",
  cardBorder: "rgba(16,24,40,0.10)",
  hairline: "rgba(16,24,40,0.08)",
};

export const font = {
  display: '"SF Pro Display", Inter, -apple-system, "Helvetica Neue", sans-serif',
  mono: '"SF Mono", "JetBrains Mono", ui-monospace, "Menlo", monospace',
};

/** Scene layout — single source of truth for sequencing. */
export const scenes = {
  hero: { from: 0, duration: 105 },
  problem: { from: 105, duration: 120 },
  solution: { from: 225, duration: 105 },
  terminal: { from: 330, duration: 240 },
  how: { from: 570, duration: 120 },
  security: { from: 690, duration: 105 },
  outro: { from: 795, duration: 105 },
} as const;

export const TOTAL = scenes.outro.from + scenes.outro.duration; // 900 frames = 30s
