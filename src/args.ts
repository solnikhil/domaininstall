export type CliCommand =
  | { kind: "get_started" }
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "install"; target: string; yes: boolean; global: boolean }
  | { kind: "verify"; target: string; json: boolean }
  | { kind: "setup"; target: string; package: string; json: boolean }
  | { kind: "trust_reset"; force: boolean }
  | { kind: "trust_list"; json: boolean }
  | { kind: "trust_forget"; domain: string };

export type CliParseResult = { ok: true; command: CliCommand } | { ok: false; error: string };

const KNOWN_FLAGS = new Set([
  "-y",
  "--yes",
  "-g",
  "--global",
  "-h",
  "--help",
  "-V",
  "--version",
  "--all",
  "--force",
  "--json",
]);

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
    const subcommand = positionals[1];

    if (subcommand === "reset") {
      if (positionals.length !== 2) {
        return { ok: false, error: "usage: di trust reset --all [--force]" };
      }
      if (!flags.includes("--all")) return { ok: false, error: "trust reset requires --all." };
      if (flags.some((flag) => flag !== "--all" && flag !== "--force")) {
        return { ok: false, error: "Only --all and --force are valid with trust reset." };
      }
      return { ok: true, command: { kind: "trust_reset", force: flags.includes("--force") } };
    }

    if (subcommand === "list") {
      if (positionals.length !== 2) return { ok: false, error: "trust list takes no arguments." };
      if (flags.some((flag) => flag !== "--json")) {
        return { ok: false, error: "Only --json is valid with trust list." };
      }
      return { ok: true, command: { kind: "trust_list", json: flags.includes("--json") } };
    }

    if (subcommand === "forget") {
      if (positionals.length !== 3) {
        return { ok: false, error: "usage: di trust forget <domain>" };
      }
      if (flags.length > 0) return { ok: false, error: "trust forget does not accept options." };
      return { ok: true, command: { kind: "trust_forget", domain: positionals[2]! } };
    }

    return {
      ok: false,
      error: "usage: di trust list | di trust forget <domain> | di trust reset --all",
    };
  }

  if (positionals[0] === "setup") {
    if (positionals.length !== 3) {
      return { ok: false, error: "usage: di setup <domain> <package>[@range] [--json]" };
    }
    if (flags.some((flag) => flag !== "--json")) {
      return { ok: false, error: "Only --json is valid with setup." };
    }
    return {
      ok: true,
      command: {
        kind: "setup",
        target: positionals[1]!,
        package: positionals[2]!,
        json: flags.includes("--json"),
      },
    };
  }

  if (positionals[0] === "verify") {
    if (positionals.length !== 2) return { ok: false, error: "verify requires exactly one domain." };
    if (flags.some((flag) => flag !== "--json")) {
      return { ok: false, error: "Only --json is valid with verify." };
    }
    return {
      ok: true,
      command: { kind: "verify", target: positionals[1]!, json: flags.includes("--json") },
    };
  }

  if (positionals.length !== 1) return { ok: false, error: "Install requires exactly one domain target." };
  const confirmFlags = flags.filter((flag) => flag === "-y" || flag === "--yes");
  const globalFlags = flags.filter((flag) => flag === "-g" || flag === "--global");
  if (confirmFlags.length + globalFlags.length !== flags.length) {
    return { ok: false, error: "Only -y/--yes and -g/--global are valid with an install target." };
  }
  if (confirmFlags.length > 1) return { ok: false, error: "Use only one of -y or --yes." };
  if (globalFlags.length > 1) return { ok: false, error: "Use only one of -g or --global." };
  return {
    ok: true,
    command: {
      kind: "install",
      target: positionals[0]!,
      yes: confirmFlags.length === 1,
      global: globalFlags.length === 1,
    },
  };
}
