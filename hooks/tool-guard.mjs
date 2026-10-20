// Tool guard (port of upstream tool-guard): in a FlowDeck project, blocks reads of secret files,
// writes into node_modules and `rm -rf`. Disable with FLOWDECK_TOOL_GUARD_ENABLED=off.
// shortcut: no CONSTRAINTS.md enforcement and only active where ~/.fd-plan/<slug>/ exists. upgrade: port constraint checks if wanted.
import { readFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";

const input = JSON.parse(readFileSync(0, "utf8"));
if (process.env.FLOWDECK_TOOL_GUARD_ENABLED === "off" || process.env.FLOWDECK_DEV_MODE === "on") process.exit(0);

const cwd = input.cwd ?? process.cwd();
const projectDir = join(homedir(), ".fd-plan", cwd.split(/[\\/]/).pop());
if (!existsSync(projectDir)) process.exit(0);
try {
  if (JSON.parse(readFileSync(join(projectDir, "gate.json"), "utf8")).enabled === false) process.exit(0);
} catch {
  // no gate.json: guard stays on
}

const { tool_name: tool, tool_input: args = {} } = input;
const file = args.file_path ?? args.path;
let why = null;

if (tool === "Bash") {
  if (/\brm\s+-(rf|fr)\b/.test(args.command ?? "")) why = "`rm -rf` is blocked";
} else if (file) {
  const name = basename(file).toLowerCase();
  if (tool === "Read" && (name === ".env" || name.startsWith(".env.") || /\.(pem|key|secret)$/.test(name))) why = `reading ${name} is blocked (secrets)`;
  else if (tool !== "Read" && /[\\/]node_modules[\\/]/.test(file)) why = "writing into node_modules is blocked";
}

if (why) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: `[FlowDeck] ${why}. Run /flowdeck:fd-gate off to turn FlowDeck off for this project.`,
    },
  }));
}
