// Gatekeeper: while a FlowDeck pipeline is active, blocks code writes until EXECUTE or VERIFY.
// Projects with no checkpoint, or a closed pipeline, are never gated.
// shortcut: reads only checkpoint.json, not STATE.md. upgrade: share a STATE.md reader from lib/.
import { readFileSync, existsSync } from "node:fs";
import { join, resolve, relative, isAbsolute } from "node:path";
import { planDir } from "../lib/paths.mjs";

const input = JSON.parse(readFileSync(0, "utf8"));
if (process.env.FLOWDECK_DEV_MODE === "on") process.exit(0);

const dir = planDir(input.cwd);

// FlowDeck's own state files stay writable at every stage, or fd-task could not save its artifacts.
const target = input.tool_input?.file_path;
if (target) {
  const rel = relative(dir, resolve(input.cwd ?? process.cwd(), target));
  if (rel && !rel.startsWith("..") && !isAbsolute(rel)) process.exit(0);
}

try {
  if (JSON.parse(readFileSync(join(dir, "gate.json"), "utf8")).enabled === false) process.exit(0);
} catch {
  // no gate.json: gate stays on
}
const statePath = join(dir, "checkpoint.json");
if (!existsSync(statePath)) process.exit(0);

let cp = {};
try {
  cp = JSON.parse(readFileSync(statePath, "utf8"));
} catch {
  // unreadable checkpoint in a FlowDeck project: fail closed
}
const command = cp.current_command ?? "";
const stage = cp.current_stage ?? "INIT";

const closed = (command === "fd-done" && stage === "complete") || stage === "cancelled";
const executing = stage === "EXECUTE" || stage === "VERIFY";
if (closed || executing) process.exit(0);

const reason = `[FlowDeck] Blocked ${input.tool_name}: pipeline is at [${command || "none"} / ${stage}]. Code edits open only in the EXECUTE and VERIFY stages: run /flowdeck:fd-task, /flowdeck:fd-review, then /flowdeck:fd-execute. To turn FlowDeck off for this project, run /flowdeck:fd-gate off.`;
process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason },
}));
process.exit(0);
