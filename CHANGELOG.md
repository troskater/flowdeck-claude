# Changelog

Every change that reaches users bumps the version in `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` (a test checks they match).

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
