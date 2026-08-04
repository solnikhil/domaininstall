import { parseCliArgs } from "../../dist/args.js";
import type { Harness, TestModule } from "./harness.ts";

function run(h: Harness): void {
  h.section("args.ts — CLI argument surface");

  h.check("empty args → get_started", parseCliArgs([]).ok && (parseCliArgs([]) as { command: { kind: string } }).command.kind === "get_started");

  const help = parseCliArgs(["--help"]);
  h.check(" --help alone", help.ok && help.command.kind === "help");
  const helpShort = parseCliArgs(["-h"]);
  h.check("-h alone", helpShort.ok && helpShort.command.kind === "help");
  const ver = parseCliArgs(["--version"]);
  h.check("--version alone", ver.ok && ver.command.kind === "version");
  const verShort = parseCliArgs(["-V"]);
  h.check("-V alone", verShort.ok && verShort.command.kind === "version");

  h.check("rejects help with target", !parseCliArgs(["example.com", "--help"]).ok);
  h.check("rejects version with target", !parseCliArgs(["example.com", "--version"]).ok);
  h.check("rejects both help and version", !parseCliArgs(["--help", "--version"]).ok);
  h.check("rejects -- separator", !parseCliArgs(["example.com", "--"]).ok);
  h.check("rejects unknown flag", !parseCliArgs(["example.com", "--json"]).ok);
  h.check("rejects duplicate --yes", !parseCliArgs(["example.com", "--yes", "-y"]).ok);
  h.check("rejects duplicate global", !parseCliArgs(["example.com", "-g", "--global"]).ok);
  h.check("rejects unknown + known flag mix", !parseCliArgs(["example.com", "--yes", "--nope"]).ok);

  const install = parseCliArgs(["example.com"]);
  h.check(
    "install bare target",
    install.ok &&
      install.command.kind === "install" &&
      install.command.target === "example.com" &&
      install.command.yes === false &&
      install.command.global === false,
  );

  const yes = parseCliArgs(["example.com", "--yes"]);
  h.check("install --yes", yes.ok && yes.command.kind === "install" && yes.command.yes === true);

  const y = parseCliArgs(["example.com", "-y"]);
  h.check("install -y", y.ok && y.command.kind === "install" && y.command.yes === true);

  const g = parseCliArgs(["pkg.example", "--global"]);
  h.check("install --global", g.ok && g.command.kind === "install" && g.command.global === true);

  const yg = parseCliArgs(["pkg.example", "-y", "-g"]);
  h.check(
    "install -y -g",
    yg.ok && yg.command.kind === "install" && yg.command.yes && yg.command.global,
  );

  h.check("rejects two install targets", !parseCliArgs(["a.com", "b.com"]).ok);
  h.check("rejects empty install with only flags", !parseCliArgs(["--yes"]).ok);

  const verify = parseCliArgs(["verify", "example.com"]);
  h.check(
    "verify domain",
    verify.ok && verify.command.kind === "verify" && verify.command.target === "example.com",
  );
  h.check("verify requires domain", !parseCliArgs(["verify"]).ok);
  h.check("verify rejects extra args", !parseCliArgs(["verify", "a.com", "b.com"]).ok);
  h.check("verify rejects flags", !parseCliArgs(["verify", "a.com", "--yes"]).ok);

  const trust = parseCliArgs(["trust", "reset", "--all"]);
  h.check("trust reset --all", trust.ok && trust.command.kind === "trust_reset" && !trust.command.force);

  const trustForce = parseCliArgs(["trust", "reset", "--all", "--force"]);
  h.check(
    "trust reset --all --force",
    trustForce.ok && trustForce.command.kind === "trust_reset" && trustForce.command.force,
  );

  h.check("trust without subcommand fails", !parseCliArgs(["trust"]).ok);
  const trustList = parseCliArgs(["trust", "list"]);
  h.check("trust list supported", trustList.ok && trustList.command.kind === "trust_list");
  const trustForget = parseCliArgs(["trust", "forget", "x.com"]);
  h.check(
    "trust forget supported",
    trustForget.ok &&
      trustForget.command.kind === "trust_forget" &&
      trustForget.command.domain === "x.com" &&
      !trustForget.command.force,
  );
  const trustForgetForce = parseCliArgs(["trust", "forget", "x.com", "--force"]);
  h.check(
    "trust forget force supported",
    trustForgetForce.ok &&
      trustForgetForce.command.kind === "trust_forget" &&
      trustForgetForce.command.force,
  );
  h.check("trust reset without --all fails", !parseCliArgs(["trust", "reset"]).ok);
  h.check("trust reset rejects --yes", !parseCliArgs(["trust", "reset", "--all", "--yes"]).ok);
  h.check("trust reset rejects -g", !parseCliArgs(["trust", "reset", "--all", "-g"]).ok);
  h.check("duplicate --all rejected", !parseCliArgs(["trust", "reset", "--all", "--all"]).ok);
}

export const argsTests: TestModule = { name: "args", run };
