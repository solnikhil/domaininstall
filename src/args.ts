export type CliCommand =
  | { kind: "get_started" }
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "install"; target: string; yes: boolean }
  | { kind: "verify"; target: string }
  | { kind: "trust_reset"; force: boolean };

export type CliParseResult = { ok: true; command: CliCommand } | { ok: false; error: string };

const KNOWN_FLAGS = new Set(["-y", "--yes", "-h", "--help", "-V", "--version", "--all", "--force"]);

export function parseCliArgs(args: string[]): CliParseResult {
  if (args.length === 0) return { ok: true, command: { kind: "get_started" } };
  if (args.includes("--")) return { ok: false, error: "The -- argument separator is not supported." };

  const flags = args.filter((arg) => arg.startsWith("-"));
  const positionals = args.filter((arg) => !arg.startsWith("-"));
  const unknown = flags.find((flag) => !KNOWN_FLAGS.has(flag));
  if (unknown) return { ok: false, error: `Unknown option: ${unknown}` };
  if (new Set(flags).size !== flags.length) return { ok: false, error: "Duplicate options are not allowed." };

  const helpFlags = flags.filter((flag) => flag === "-h" || flag === "--help");
  const versionFlags = flags.filter((flag) => flag === "-V" || flag === "--version");
  if (helpFlags.length > 0 || versionFlags.length > 0) {
    if (args.length !== 1 || helpFlags.length + versionFlags.length !== 1) {
      return { ok: false, error: "Help and version options must be used alone." };
    }
    return {
      ok: true,
      command: { kind: helpFlags.length === 1 ? "help" : "version" },
    };
  }

  if (positionals[0] === "trust") {
    if (positionals.length !== 2 || positionals[1] !== "reset") {
      return { ok: false, error: "usage: di trust reset --all [--force]" };
    }
    if (!flags.includes("--all")) return { ok: false, error: "trust reset requires --all." };
    if (flags.some((flag) => flag !== "--all" && flag !== "--force")) {
      return { ok: false, error: "Only --all and --force are valid with trust reset." };
    }
    return { ok: true, command: { kind: "trust_reset", force: flags.includes("--force") } };
  }

  if (positionals[0] === "verify") {
    if (positionals.length !== 2) return { ok: false, error: "verify requires exactly one domain." };
    if (flags.length > 0) return { ok: false, error: "verify does not accept options." };
    return { ok: true, command: { kind: "verify", target: positionals[1]! } };
  }

  if (positionals.length !== 1) return { ok: false, error: "Install requires exactly one domain target." };
  if (flags.some((flag) => flag !== "-y" && flag !== "--yes")) {
    return { ok: false, error: "Only -y or --yes is valid with an install target." };
  }
  if (flags.length > 1) return { ok: false, error: "Use only one of -y or --yes." };
  return {
    ok: true,
    command: { kind: "install", target: positionals[0]!, yes: flags.length === 1 },
  };
}
