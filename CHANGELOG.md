# Changelog

Every change that reaches users bumps the version in `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` (a test checks they match).

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
