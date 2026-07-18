import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

const inter = loadInter("normal", {
  weights: ["300", "400", "500", "600", "700", "800"],
  subsets: ["latin"],
});
const jetbrains = loadMono("normal", {
  weights: ["400", "500", "700"],
  subsets: ["latin"],
});

export const sans = `${inter.fontFamily}, -apple-system, "SF Pro Display", "Helvetica Neue", sans-serif`;
export const mono = `${jetbrains.fontFamily}, "SF Mono", ui-monospace, Menlo, monospace`;
