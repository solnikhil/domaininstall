/** Apple-keynote-inspired theme tokens. */
export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

export const colors = {
  bg: "#000000",
  bgSoft: "#0a0a0c",
  text: "#f5f5f7", // Apple's off-white
  textDim: "#86868b", // Apple's gray text
  green: "#30d158", // Apple system green
  red: "#ff453a", // Apple system red
  blue: "#0a84ff", // Apple system blue
  purple: "#bf5af2",
  yellow: "#ffd60a",
  card: "rgba(28,28,30,0.72)",
  cardBorder: "rgba(255,255,255,0.10)",
  hairline: "rgba(255,255,255,0.08)",
};

export const font = {
  display: '"SF Pro Display", Inter, -apple-system, "Helvetica Neue", sans-serif',
  mono: '"SF Mono", "JetBrains Mono", ui-monospace, "Menlo", monospace',
};

/** Scene layout — single source of truth for sequencing. */
export const scenes = {
  hero: { from: 0, duration: 118 },
  problem: { from: 118, duration: 132 },
  solution: { from: 250, duration: 110 },
  terminal: { from: 360, duration: 320 },
  how: { from: 680, duration: 150 },
  security: { from: 830, duration: 118 },
  outro: { from: 948, duration: 132 },
} as const;

export const TOTAL = scenes.outro.from + scenes.outro.duration; // 1080 frames = 36s
