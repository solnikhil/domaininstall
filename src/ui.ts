import { createInterface } from "node:readline/promises";
import { stdin, stdout, stderr } from "node:process";
import { sanitizeTerminalText } from "./terminal.js";

export interface Palette {
  bold: (s: string) => string;
  dim: (s: string) => string;
  red: (s: string) => string;
  green: (s: string) => string;
  yellow: (s: string) => string;
  blue: (s: string) => string;
  cyan: (s: string) => string;
  gray: (s: string) => string;
}

/**
 * Colour is decided per stream: writing escape codes into a redirected stream
 * would corrupt piped output, and stdout and stderr are redirected separately.
 */
function palette(isTty: boolean): Palette {
  const useColor = isTty && !process.env.NO_COLOR;
  const wrap = (code: number, s: string): string => {
    const safe = sanitizeTerminalText(s);
    return useColor ? `\x1b[${code}m${safe}\x1b[0m` : safe;
  };
  return {
    bold: (s) => wrap(1, s),
    dim: (s) => wrap(2, s),
    red: (s) => wrap(31, s),
    green: (s) => wrap(32, s),
    yellow: (s) => wrap(33, s),
    blue: (s) => wrap(34, s),
    cyan: (s) => wrap(36, s),
    gray: (s) => wrap(90, s),
  };
}

/** Palette for standard output: previews, progress, and results. */
export const c = palette(stdout.isTTY === true);
/** Palette for standard error: warnings and failures. */
export const ce = palette(stderr.isTTY === true);

export function info(msg: string): void {
  stdout.write(msg + "\n");
}

/** A supporting line that belongs with the preceding warning or error. */
export function detail(msg: string): void {
  stderr.write(msg + "\n");
}

export function warn(msg: string): void {
  stderr.write(ce.yellow("⚠  " + msg) + "\n");
}

export function error(msg: string): void {
  stderr.write(ce.red("✖  " + msg) + "\n");
}

export function success(msg: string): void {
  stdout.write(c.green("✔  " + msg) + "\n");
}

/** Yes/No confirmation. Defaults to No unless the user explicitly types y/yes. */
export async function confirm(question: string): Promise<boolean> {
  // Non-interactive: never assume yes. Require an explicit --yes upstream.
  if (!stdin.isTTY) return false;
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await rl.question(question + " " + c.dim("(y/N)") + " ")).trim().toLowerCase();
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}
