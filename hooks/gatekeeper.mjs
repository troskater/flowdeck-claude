// Gatekeeper: blocks code writes until the pipeline reaches EXECUTE or VERIFY.
// shortcut: reads only checkpoint.json under ~/.fd-plan, not STATE.md. upgrade: share the STATE.md reader from lib/.
import { readFileSync, existsSync } from "node:fs";
import { join, resolve, relative, isAbsolute } from "node:path";
import { homedir } from "node:os";

const input = JSON.parse(readFileSync(0, "utf8"));
if (process.env.FLOWDECK_DEV_MODE === "on") process.exit(0);

const planRoot = join(homedir(), ".fd-plan");

// FlowDeck's own state files stay writable at every stage, or fd-task could not save its artifacts.
const target = input.tool_input?.file_path;
if (target) {
  const rel = relative(planRoot, resolve(input.cwd ?? process.cwd(), target));
  if (rel && !rel.startsWith("..") && !isAbsolute(rel)) process.exit(0);
}

const slug = (input.cwd ?? process.cwd()).split(/[\\/]/).pop();
const statePath = join(planRoot, slug, "checkpoint.json");

let stage = "INIT";
if (existsSync(statePath)) {
  try {
    stage = JSON.parse(readFileSync(statePath, "utf8")).current_stage ?? "INIT";
  } catch {
    stage = "INIT";
  }
}

if (stage === "EXECUTE" || stage === "VERIFY") process.exit(0);

const reason = `[FlowDeck] Blocked ${input.tool_name}: stage is [${stage}]. Code edits open only in the EXECUTE and VERIFY stages: run /flowdeck:fd-task, /flowdeck:fd-review, then /flowdeck:fd-execute. Set FLOWDECK_DEV_MODE=on to bypass during development.`;
process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason },
}));
process.exit(0);
