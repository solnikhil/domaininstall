import { sanitizeTerminalText } from "../../dist/terminal.js";
import type { Harness, TestModule } from "./harness.ts";

function run(h: Harness): void {
  h.section("terminal.ts — output sanitization");

  h.check("passes through plain text", sanitizeTerminalText("hello world") === "hello world");
  h.check("passes through unicode letters", sanitizeTerminalText("café 日本語") === "café 日本語");
  h.check("escapes ESC", sanitizeTerminalText("\x1b") === "\\x1b");
  h.check("escapes CSI color", !sanitizeTerminalText("\x1b[31mred\x1b[0m").includes("\x1b"));
  h.check("escapes BEL", sanitizeTerminalText("a\x07b") === "a\\u{0007}b");
  h.check("escapes LF CR TAB NUL", sanitizeTerminalText("a\nb\rc\td\0e") === "a\\nb\\rc\\td\\u{0000}e");
  h.check("escapes DEL", sanitizeTerminalText("\x7f") === "\\u{007f}");
  h.check("escapes C1 range", sanitizeTerminalText("\x9b") === "\\u{009b}");
  h.check(
    "escapes bidi RLO",
    sanitizeTerminalText(String.fromCodePoint(0x202e)) === "\\u{202e}",
  );
  h.check(
    "escapes bidi LRI",
    sanitizeTerminalText(String.fromCodePoint(0x2066)) === "\\u{2066}",
  );
  h.check(
    "escapes line separator U+2028",
    sanitizeTerminalText(String.fromCodePoint(0x2028)) === "\\u{2028}",
  );
  h.check(
    "escapes paragraph separator U+2029",
    sanitizeTerminalText(String.fromCodePoint(0x2029)) === "\\u{2029}",
  );
  h.check(
    "escapes Arabic letter mark",
    sanitizeTerminalText(String.fromCodePoint(0x061c)) === "\\u{061c}",
  );
  h.check("empty string", sanitizeTerminalText("") === "");
  h.check(
    "mixed safe and unsafe",
    sanitizeTerminalText("ok\x1b[0m\n") === "ok\\x1b[0m\\n",
  );
}

export const terminalTests: TestModule = { name: "terminal", run };
