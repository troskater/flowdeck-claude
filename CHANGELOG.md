# Changelog

Every change that reaches users bumps the version in `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` (a test checks they match).

## 0.3.3

Fixed
- A failed `fd-verify` no longer strands you. It used to set the stage to `failed`, which blocked edits, while `fd-execute` refused to run again. The stage now stays at `VERIFY`, so you can fix the code and re-run `fd-verify`; `fd-done` still refuses until it passes.
- `fd-state` no longer refuses every write when an older `STATE.md` holds a value it no longer accepts (such as `status: planning`). That value is skipped on import, as intended.
- The hooks and `fd-state` find the project from the git top level (and `CLAUDE_PROJECT_DIR` in hooks), not from the current folder. Before, a `cd src` in Bash turned the edit gate off and made `fd-state` write a second state folder. A session started in a subfolder of a repo now uses the repo's state folder. New `fd-state path` prints it.
- The wave workflow no longer crashes on a step with no file list (that step now runs alone), and treats `./src/a.ts` and `src/a.ts` as the same file.
- Tool guard: `rm -rfv` and `rm -Rf` are now blocked; reading `.env.example`, `.env.sample` and `.env.template` is allowed.
- `fd-status` and `fd-resume` read `state.json` first; README, DIFFERENCES and the orchestrator describe the current state writer and parallel waves.

Removed
- `PLAN-v0.1.0.md`, a finished planning note.

## 0.3.2

Changed
- Every agent label is the agent name plus its job in parentheses: `coder (step 2)`, `researcher (query 1)`, `reviewer (CEO lens)`; no more bare numbers.

## 0.3.1

Changed
- One plan file. `fd-task` now saves a single `plan.md` with four sections (Task, Architecture, Affect, Steps) instead of `task.md`, `architecture.md`, `affect.md` and `plan.md`; the project-level `architecture.md` is unchanged. `fd-review`, `fd-execute`, `fd-verify`, `fd-done`, `fd-status`, `fd-resume`, `fd-checkpoint` and the agents read the sections. The architect drafts Architecture and Affect, the planner drafts Steps and Parallel Safety. Topics saved in the old four-file layout are not supported.

## 0.3.0

Added
- `workflows/fd-execute-wave.js`: `fd-execute` hands a wave of two or more steps to this workflow. It batches the steps by file overlap, runs disjoint steps in parallel through `flowdeck:coder` in the same checkout, and runs overlapping steps in order. You run the full suite after it returns. No separate git worktrees (see README).
- `bin/fd-state`: one validated writer for pipeline state. `state.json` is the source of truth; `STATE.md` and `checkpoint.json` are rendered from it on every write, so they cannot drift. It rejects unknown keys and bad values, and imports an existing `STATE.md` and `checkpoint.json` on the first write. The stage commands write state through it; the hooks still read `checkpoint.json`. The Stop hook stamps `saved_at` in `state.json` too.
- `fd-task` runs steps 2-4 (research, questions, drafts) in plan mode when the tool is available; approving the plan with `ExitPlanMode` is the CONFIRM, and the artifacts are written right after. Without the tool (non-interactive runs) or if the user declines, it behaves as before.
- Agent calls are labelled with the agent's name (`researcher`, `reviewer 1`, `reviewer 2`, `coder 3`).
- Opt-in output style `FlowDeck` (`/output-style`): AskUserQuestion at every decision, delegate to the flowdeck agents.

Fixed
- Tool guard: the recursive-force delete is blocked only in command position, so an echo, a commit message or a grep for the text no longer trips it. A delete wrapped in `bash -c "..."` is not caught.

## 0.2.1

Changed
- Delegation to the agents is now mandatory in `fd-task`, `fd-review`, `fd-execute` and `fd-verify`. A first test showed the model running the review lenses and the edits itself because the change was small. Only an `Agent` call that errors, or a `CONFIRM SKIP` task in `fd-execute`, allows doing the work inline.

## 0.2.0

Added
- Nine focused agents under `agents/`, modelled on upstream's roster: `mapper`, `researcher`, `architect`, `planner`, `coder`, `tester`, `reviewer`, `security-auditor`, `debug-specialist`. Read-only agents have no edit tools; only `coder` can write.

Changed
- `fd-execute` sends every step to `flowdeck:coder` (a trivial task is still done inline). The old rule of delegating only above 3 steps is gone.
- `fd-verify` uses `tester`, `security-auditor` and, in the fix loop, `debug-specialist` then `coder`. `fd-review` lenses use `reviewer`. `fd-task` uses `researcher`, `architect` and `planner`; the main conversation still writes the files after CONFIRM.
- `fd-map` runs in `flowdeck:mapper`. Agents inherit the session model (the old "sonnet on Opus" rule is removed); only `mapper` is pinned, to haiku.
- `flowdeck:orchestrator` now states the router-not-worker rule and the stage-to-agent table.

Not in this release: Workflow scripts and parallel worktree waves (planned for 0.3.0).

## 0.1.0

First described release. Port of DVNghiem/FlowDeck to Claude Code's built-ins; see [DIFFERENCES.md](DIFFERENCES.md).

Added
- Tool guard hook: secret-file reads, `node_modules` writes, destructive `rm`, Forbidden Paths from `CONSTRAINTS.md`.
- `/flowdeck:fd-gate off|on|status` to switch the edit gate and tool guard per project.
- Stop hook that refreshes `saved_at` on an open checkpoint.
- `fd-status --all` and a fuller status block.
- `fd-verify`: asks about the security audit and auto-fix up front; fixes and re-runs up to twice on failure.
- Subagent delegation in `fd-execute` (plans over 3 steps), `fd-verify` and `fd-review` (parallel lenses). Delegates never run above the session model.
- Trivial-task shortcut (`CONFIRM SKIP`), lesson capture (`lessons.md`).
- `fd-execute` runs the full suite after every step.
- Questions use Claude Code's `AskUserQuestion` picker (research gate, clarifying questions, every CONFIRM, topic branch, security and auto-fix, slop, commit, push, resume). Typed answers (`Y`, `CONFIRM`, a revision) still work, and commands fall back to plain text where the tool is missing, as in `claude -p`.
- README section comparing with upstream.

Changed
- `fd-resume` moves on to the next stage when the recorded stage is `complete`.
- Found in a local end-to-end run and fixed before release: `fd-verify` stalled after the built-in security review returned its report (it now runs in a subagent and returns as a tool result), `fd-execute` did not tick `plan.md`, and `fd-resume` miscounted requirements.
- `fd-checkpoint` text no longer claims nothing saves automatically.

Not in this release: parallel worktree waves (planned), UI design-first gating, `--override`, notifications.
