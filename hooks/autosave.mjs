// Stop hook (stand-in for upstream's save-on-idle): stamps saved_at on an open pipeline's checkpoint.
// Only the timestamp is written; stage and step data stay model-written. Never touches closed pipelines.
// state.json (written by bin/fd-state) is stamped alongside checkpoint.json when it exists.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { planDir } from "../lib/paths.mjs";

const input = JSON.parse(readFileSync(0, "utf8"));
const dir = planDir(input.cwd);
const path = join(dir, "checkpoint.json");
if (!existsSync(path)) process.exit(0);

try {
  const cp = JSON.parse(readFileSync(path, "utf8"));
  if (cp.current_stage === "cancelled" || (cp.current_command === "fd-done" && cp.current_stage === "complete")) process.exit(0);
  const now = new Date().toISOString();
  for (const file of [path, join(dir, "state.json")]) {
    if (!existsSync(file)) continue;
    const doc = JSON.parse(readFileSync(file, "utf8"));
    doc.saved_at = now;
    writeFileSync(file, JSON.stringify(doc, null, 2));
  }
} catch {
  // unreadable checkpoint: leave it for fd-resume to report
}
