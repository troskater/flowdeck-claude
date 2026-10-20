# FlowDeck for Claude Code

A Claude Code port of [FlowDeck](https://github.com/DVNghiem/FlowDeck), the OpenCode plugin by DVNghiem. It runs a fixed task pipeline with approval gates:

```
/flowdeck:fd-task -> /flowdeck:fd-review -> /flowdeck:fd-execute -> /flowdeck:fd-verify -> /flowdeck:fd-done
```

Early port. It works end to end on a small project; large parts of upstream are not ported (see below).

## Install

```
/plugin marketplace add troskater/flowdeck-claude
/plugin install flowdeck@flowdeck-marketplace
```

Or load a local checkout for one session: `claude --plugin-dir <path>`.

## Commands

| Command | What it does |
|---|---|
| `fd-task <description>` | Maps the codebase, runs a research gate, asks questions one at a time, and saves `task.md`, `architecture.md`, `affect.md`, `plan.md` after you type CONFIRM |
| `fd-review` | CEO and engineering review of those artifacts before any code is written |
| `fd-execute` | Implements the plan step by step: behavior, failing test, minimal code, refactor, wave review |
| `fd-verify` | Runs tests, regression scope, a code review and a security audit. Blocks `fd-done` on failure |
| `fd-done` | Summarizes built vs required, checks for slop, then commits and pushes only on your yes |
| `fd-checkpoint`, `fd-resume` | Save and restore an interrupted pipeline |
| `fd-status` | Show the current stage |

Planning state lives in `~/.fd-plan/<project>/` (`STATE.md`, `checkpoint.json`, and one folder per topic).

## The edit gate

While a pipeline is active, a hook blocks `Write`, `Edit` and `MultiEdit` until the stage is `EXECUTE` or `VERIFY`. It does not apply to:

- projects with no `~/.fd-plan/<project>/checkpoint.json`
- a finished pipeline (`fd-done` complete) or a cancelled one
- writes under `~/.fd-plan/`

Set `FLOWDECK_DEV_MODE=on` in the environment that launches Claude Code to bypass it.

## Agents and models

`orchestrator` (opus) runs the pipeline and is the default agent. It delegates to `mapper` (haiku), `reviewer` (sonnet) and `security-auditor` (opus). Change the `model:` line in an agent file to retarget one.

## Rules and skills

Upstream's rules are injected at session start, only in projects FlowDeck has already touched: the always-on rules in full, plus an index of the stage rules matching the detected language, which `fd-execute` and `fd-verify` read. 30 of upstream's 42 skills are included.

## Not ported yet

- Upstream's Rust `fdx` tools and dependency graph. This port uses Claude Code's own tools (Grep, Glob, Read, and the `LSP` tool when a code-intelligence plugin is installed) instead.
- 12 skills that need upstream's state files or the `fdx` tools: `change-impact-radar`, `blast-radius-preview`, `failure-replay-engine`, `self-healing-policies`, `telemetry-steward`, `decision-trace`, `session-persistence`, `context-budget`, `context-guard`, `context-steward`, `research-first`, and `repo-memory-graph`.
- Git worktrees, parallel waves, `--override`, lesson capture, and the automatic save on idle.
- Nothing enforces "test before code" except the instruction in `fd-execute`.

## Develop

```
node --test tests/hooks.test.mjs
claude plugin validate . --strict
```

## License

MIT. See `LICENSE` and `NOTICE`.
