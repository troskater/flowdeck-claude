// Stop hook (stand-in for upstream's save-on-idle): stamps saved_at on an open pipeline's checkpoint.
// Only the timestamp is written; stage and step data stay model-written. Never touches closed pipelines.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const input = JSON.parse(readFileSync(0, "utf8"));
const slug = (input.cwd ?? process.cwd()).split(/[\\/]/).pop();
const path = join(homedir(), ".fd-plan", slug, "checkpoint.json");
if (!existsSync(path)) process.exit(0);

try {
  const cp = JSON.parse(readFileSync(path, "utf8"));
  if (cp.current_stage === "cancelled" || (cp.current_command === "fd-done" && cp.current_stage === "complete")) process.exit(0);
  cp.saved_at = new Date().toISOString();
  writeFileSync(path, JSON.stringify(cp, null, 2));
} catch {
  // unreadable checkpoint: leave it for fd-resume to report
}
