# Differences from upstream (DVNghiem/FlowDeck)

Compared 2026-10-20 against upstream's `src/commands`, `src/hooks`, `src/services` and `src/agents`. Command outlines and hooks were compared; prompts were not diffed line by line.

## Same
- Five stages (`fd-task`, `fd-review`, `fd-execute`, `fd-verify`, `fd-done`) plus `fd-checkpoint`, `fd-resume`, `fd-status`.
- Four artifacts, research gate, one-question-at-a-time with question and reuse suppression, effort estimate, CEO and eng review lenses, slop check, commit and push questions.
- State in `~/.fd-plan/<slug>/` (`STATE.md`, `checkpoint.json`).
- Approval gates: CONFIRM at the end of `fd-task` and `fd-review`, none after.

## Replaced with Claude Code built-ins
| Upstream | Here |
|---|---|
| `fdx-graph` code graph (Rust) | LSP, then Grep/Glob/Read, then Explore (`fd-codenav`). No persistent graph. |
| `@reviewer` after each step | Built-in `code-review` (`high`) after each wave |
| `@security-auditor` | Built-in `security-review`; needs a committed branch and `origin/HEAD` |
| `@mapper` | `fd-map`, a forked Explore skill on haiku |
| 13 custom agents | One optional launch target (`flowdeck:orchestrator`) |
| `flowdeck.json` `agentModels` | Model policy below |

## Still different
| Area | Upstream | Here |
|---|---|---|
| Parallel waves | Parallel guard creates `fd-<slug>-wave-N` worktrees and merges them | Guard classifies, everything runs sequentially (deferred) |
| Trivial-task shortcut | `fd-task -> fd-execute -> fd-done` | Not ported |
| UI design-first gating | Blocks UI-heavy work until `design_approved` | Not ported |
| `--override`, `--keep-worktree` | Override log surfaced in verify | Not ported |
| Lesson capture | Review step 5b | Not ported |
| Constraint enforcement | `tool-guard` checks `.codebase/CONSTRAINTS.md` | Not ported |
| Context-window monitor, desktop notifications | 70% warning, idle/error notifications | Not ported (Claude Code auto-compacts) |
| Per-step review | `@reviewer` each step | Per wave |
| `fd-status` | Same output | Same (with `--all`) |
| Model config | Per-agent in `flowdeck.json` | See below |

## Added in this port (closing gaps)
- `hooks/tool-guard.mjs`: in a FlowDeck project, blocks reading `.env*`, `*.pem`, `*.key`, `*.secret`, writing under `node_modules`, and `rm -rf`. `/flowdeck:fd-gate off` (writes `~/.fd-plan/<slug>/gate.json`) turns off both this guard and the edit gate per project; `FLOWDECK_TOOL_GUARD_ENABLED=off` and `FLOWDECK_DEV_MODE=on` still work. Upstream applies it to every project; this one only where `~/.fd-plan/<slug>/` exists.
- `hooks/autosave.mjs` (Stop): stamps `saved_at` on an open pipeline's checkpoint. Stage and step data are still model-written; upstream's idle save had the same limit.
- `fd-status --all` and the fuller status block.
- `fd-execute` runs the full test suite after each step and undoes a refactor that breaks it.
- `fd-verify` asks whether to run the security audit (recorded as `security_check`, flagged again in `fd-done`) and, on NOT VERIFIED, makes up to two automatic fix-and-rerun attempts. Upstream only offered "fix and re-run" as a manual option, and always ran the security scan.

## Model policy
Spike results (2026-10-20, `claude -p --model sonnet`): `model:` in a chained skill's or command's frontmatter does **not** switch the model (all reported `claude-sonnet-5-5`). The `Agent` tool's `model` parameter does (an opus session ran a sonnet subagent), and a forked skill with `model: haiku` does (`fd-map`).

So stages cannot be pinned, and the rule is: **a delegate never runs above the session model.**
- Stages run on the session model.
- `fd-map` always runs on haiku.
- On Opus, `fd-execute` runs each step's TDD cycle, and `fd-verify` runs tests and regression, in a `model: "sonnet"` subagent. Planning, review, verdicts and `fd-done` stay on Opus.
- On Sonnet or Haiku nothing is delegated upward or sideways; everything stays on the session model, apart from the haiku map.
