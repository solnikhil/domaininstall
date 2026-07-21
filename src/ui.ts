import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { sanitizeTerminalText } from "./terminal.js";

const useColor = stdout.isTTY && !process.env.NO_COLOR;

function wrap(code: number, s: string): string {
  const safe = sanitizeTerminalText(s);
  return useColor ? `\x1b[${code}m${safe}\x1b[0m` : safe;
}

export const c = {
  bold: (s: string) => wrap(1, s),
  dim: (s: string) => wrap(2, s),
  red: (s: string) => wrap(31, s),
  green: (s: string) => wrap(32, s),
  yellow: (s: string) => wrap(33, s),
  blue: (s: string) => wrap(34, s),
  cyan: (s: string) => wrap(36, s),
  gray: (s: string) => wrap(90, s),
};

export function info(msg: string): void {
  stdout.write(msg + "\n");
}

export function warn(msg: string): void {
  stdout.write(c.yellow("⚠  " + msg) + "\n");
}

export function error(msg: string): void {
  stdout.write(c.red("✖  " + msg) + "\n");
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
