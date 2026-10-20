// Spike gatekeeper: blocks code writes until the pipeline reaches EXECUTE.
// shortcut: reads only the project-local stage file, not ~/.fd-plan, until Phase 1 wires up fd-state. upgrade: share the STATE.md reader from lib/.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const input = JSON.parse(readFileSync(0, "utf8"));
const slug = (input.cwd ?? process.cwd()).split(/[\\/]/).pop();
const statePath = join(homedir(), ".fd-plan", slug, "checkpoint.json");

let stage = "INIT";
if (existsSync(statePath)) {
  try {
    stage = JSON.parse(readFileSync(statePath, "utf8")).current_stage ?? "INIT";
  } catch {
    stage = "INIT";
  }
}

if (stage === "EXECUTE" || stage === "VERIFY") process.exit(0);

const reason = `[FlowDeck] Blocked ${input.tool_name}: stage is [${stage}]. Advance to EXECUTE via /fd-execute before editing code.`;
process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason },
}));
process.exit(0);
