# FlowDeck for Claude Code

A Claude Code port of [FlowDeck](https://github.com/DVNghiem/FlowDeck), the OpenCode plugin by DVNghiem. It runs a fixed task pipeline with approval gates, using Claude Code's own tools instead of custom ones:

```
/flowdeck:fd-task -> /flowdeck:fd-review -> /flowdeck:fd-execute -> /flowdeck:fd-verify -> /flowdeck:fd-done
```

Early port. It works end to end on a small project; some of upstream is not ported (see below).

## Install

```
/plugin marketplace add troskater/flowdeck-claude
/plugin install flowdeck@flowdeck-marketplace
```

Or load a local checkout for one session: `claude --plugin-dir <path>`. If your Claude Code surface has no `/plugin`, use `claude plugin marketplace add` and `claude plugin install` in a terminal.

## Commands

| Command | What it does |
|---|---|
| `fd-task <description>` | Maps the codebase, runs a research gate, asks questions one at a time, and saves `task.md`, `architecture.md`, `affect.md`, `plan.md` after you type CONFIRM |
| `fd-review` | CEO and engineering review of those artifacts before any code is written |
| `fd-execute` | Implements the plan step by step: behavior, failing test, minimal code, refactor. Offers a local topic branch, commits each wave, and runs the built-in `code-review` after each wave |
| `fd-verify` | Runs tests, regression scope, the built-in `code-review` and `security-review`. Blocks `fd-done` on failure |
| `fd-done` | Summarizes built vs required, checks for slop, then commits and pushes only on your yes |
| `fd-checkpoint`, `fd-resume`, `fd-status` | Save, restore and show an in-flight pipeline |
| `fd-doctor` | Read-only check of what the steps above need: an active LSP server, `origin/HEAD`, a test runner |

**You type only the first command.** As in upstream FlowDeck there are two approval gates: you CONFIRM the artifacts at the end of `fd-task` (before anything is saved), and you CONFIRM at the end of `fd-review` (before any code is written). After that `fd-execute`, `fd-verify` and `fd-done` run on their own. The pipeline stops if a step fails or verification fails, and `fd-done` still asks about the commit message and permission to push. Use `fd-resume` to pick up after stopping. You can also type any stage yourself; each stage checks its own preconditions, so running one out of order is refused.

Planning state lives in `~/.fd-plan/<project>/` (`STATE.md`, `checkpoint.json`, and one folder per topic).

## What it uses from Claude Code

- **Code navigation:** the `LSP` tool when a [code-intelligence plugin](https://code.claude.com/docs/en/plugins/code-intelligence) and its language server are installed, otherwise Grep, Glob and Read. The `fd-codenav` skill holds the rules. Run `fd-doctor` to see which you have.
- **Mapping:** the `fd-map` skill runs in a read-only `Explore` subagent pinned to haiku.
- **Review:** the bundled `code-review` skill and the built-in `security-review`. Neither is replaced by a home-grown version.
- **Models:** interactive commands run on your session model (a command-level `model:` only lasts one turn). For a pinned model, start with `claude --agent flowdeck:orchestrator`.

## Security review needs committed work

`security-review` compares your branch with `origin/HEAD` and sees only committed changes. So `fd-execute` offers a local branch `fd/<topic>` and commits each wave (never pushed), and `fd-verify` checks for `origin/HEAD` and a non-empty diff first. `fd-verify` first asks whether to run the security audit and whether it may auto-fix failures (`--security=on|off` and `--fix=on|off` answer up front). If you choose it and it cannot run, the check is NOT RUN and the verdict is NOT VERIFIED until you fix the setup or switch to skipping. A skip is recorded and `fd-done` reminds you. When verification fails, `fd-verify` makes up to two automatic fix-and-rerun attempts (if you allowed auto-fix) before handing back to you. Without `origin/HEAD` run `git remote set-head origin -a`, or `fd-doctor` will tell you what is missing.

## The edit gate

While a pipeline is active, a hook blocks `Write`, `Edit` and `MultiEdit` until the stage is `EXECUTE` or `VERIFY`. It does not apply to:

- projects with no `~/.fd-plan/<project>/checkpoint.json`
- a finished pipeline (`fd-done` complete) or a cancelled one
- writes under `~/.fd-plan/`

Set `FLOWDECK_DEV_MODE=on` in the environment that launches Claude Code to bypass it.

## Rules and skills

Upstream's rules are injected at session start, only in projects FlowDeck has already touched: the always-on rules in full, plus an index of the stage rules matching the detected language, which `fd-execute` and `fd-verify` read. 30 of upstream's 42 skills are included; two of them (`research-first`, `context-budget`) were adapted from `fdx` to LSP and Grep.

## Not ported

- Upstream's Rust `fdx` tools and dependency graph.
- 12 upstream skills: eleven that need its state files, tools or a pruning step (`change-impact-radar`, `blast-radius-preview`, `failure-replay-engine`, `self-healing-policies`, `telemetry-steward`, `decision-trace`, `session-persistence`, `context-guard`, `repo-memory-graph`, `context-steward` with its `-triggers` stub), and its `code-review`, left out so it cannot shadow the built-in.
- Parallel worktree waves, `--override`, lesson capture, and the automatic save on idle.
- Nothing enforces "test before code" except the instruction in `fd-execute`.
- Blast radius without LSP is text-based and misses dynamic imports.

## Develop

```
node --test tests/hooks.test.mjs
claude plugin validate . --strict
```

## License

MIT. See `LICENSE` and `NOTICE`.
