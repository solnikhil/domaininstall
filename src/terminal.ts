/**
 * Render untrusted text without allowing it to control or visually reorder a
 * terminal. Escape dangerous code points instead of silently dropping them so
 * diagnostics still show that the input was hostile or malformed.
 */
export function sanitizeTerminalText(input: string): string {
  let output = "";

  for (const char of input) {
    const codePoint = char.codePointAt(0)!;

    switch (char) {
      case "\n":
        output += "\\n";
        continue;
      case "\r":
        output += "\\r";
        continue;
      case "\t":
        output += "\\t";
        continue;
      case "\x1b":
        output += "\\x1b";
        continue;
    }

    const isControl =
      codePoint <= 0x1f ||
      (codePoint >= 0x7f && codePoint <= 0x9f) ||
      codePoint === 0x2028 ||
      codePoint === 0x2029;
    const isBidirectionalControl =
      codePoint === 0x061c ||
      codePoint === 0x200e ||
      codePoint === 0x200f ||
      (codePoint >= 0x202a && codePoint <= 0x202e) ||
      (codePoint >= 0x2066 && codePoint <= 0x206f);

    if (isControl || isBidirectionalControl) {
      output += `\\u{${codePoint.toString(16).padStart(4, "0")}}`;
    } else {
      output += char;
    }
  }

  return output;
}
