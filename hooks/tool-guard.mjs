// Tool guard (port of upstream tool-guard): in a FlowDeck project, blocks reads of secret files,
// writes into node_modules and `rm -rf`. Disable with FLOWDECK_TOOL_GUARD_ENABLED=off.
// Also enforces the Forbidden Paths list in ~/.fd-plan/<slug>/.codebase/CONSTRAINTS.md.
// shortcut: only active where ~/.fd-plan/<slug>/ exists (upstream guards every project).
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
  else if (tool !== "Read") {
    // upstream format: a "## Forbidden Paths" list of "- pattern  # note" lines in .codebase/CONSTRAINTS.md
    try {
      const text = readFileSync(join(projectDir, ".codebase", "CONSTRAINTS.md"), "utf8");
      const section = text.match(/## Forbidden Paths\r?\n([\s\S]*?)(?:\r?\n##|$)/)?.[1] ?? "";
      for (const line of section.split(/\r?\n/)) {
        const pattern = line.replace(/^-\s*/, "").split("#")[0].trim();
        if (pattern && file.replace(/\\/g, "/").includes(pattern)) why = `editing "${pattern}" is forbidden by .codebase/CONSTRAINTS.md`;
      }
    } catch {
      // no constraints file
    }
  }
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
