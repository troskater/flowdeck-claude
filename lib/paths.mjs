// Where FlowDeck keeps a project's state. The hooks and bin/fd-state must agree, so both resolve it here.
// The project is CLAUDE_PROJECT_DIR (set for hooks) or the cwd, widened to its git top level, so a `cd src`
// in Bash does not switch projects.
// shortcut: outside git, fd-state run from a subfolder still uses that subfolder; each git worktree is its own project.
import { spawnSync } from "node:child_process";
import { join, basename } from "node:path";
import { homedir } from "node:os";

export function projectRoot(cwd = process.cwd()) {
  const start = process.env.CLAUDE_PROJECT_DIR || cwd;
  const git = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: start, encoding: "utf8" });
  return git.status === 0 ? git.stdout.trim() : start;
}

export const planRoot = () => join(homedir(), ".fd-plan");
export const planDir = (cwd, slug = basename(projectRoot(cwd))) => join(planRoot(), slug);
