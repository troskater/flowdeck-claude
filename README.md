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
| `fd-task <description>` | Maps the codebase, runs a research gate, asks questions one at a time, and saves one `plan.md` (task, architecture, affect, steps) after you type CONFIRM |
| `fd-review` | CEO and engineering review of that plan before any code is written |
| `fd-execute` | Implements the plan step by step: behavior, failing test, minimal code, refactor. Offers a local topic branch, commits each wave, and runs the built-in `code-review` after each wave |
| `fd-verify` | Runs tests, regression scope, the built-in `code-review` and `security-review`. Blocks `fd-done` on failure |
| `fd-done` | Summarizes built vs required, checks for slop, then commits and pushes only on your yes |
| `fd-checkpoint`, `fd-resume`, `fd-status` | Save, restore and show an in-flight pipeline |
| `fd-doctor` | Read-only check of what the steps above need: an active LSP server, `origin/HEAD`, a test runner |

**You type only the first command.** As in upstream FlowDeck there are two approval gates: you CONFIRM the plan at the end of `fd-task` (before anything is saved), and you CONFIRM at the end of `fd-review` (before any code is written). After that `fd-execute`, `fd-verify` and `fd-done` run on their own. The pipeline stops if a step fails or verification fails, and `fd-done` still asks about the commit message and permission to push. Use `fd-resume` to pick up after stopping. You can also type any stage yourself; each stage checks its own preconditions, so running one out of order is refused.

Questions appear as Claude Code's native picker (recommended option first, "Other" for free text); typing `Y`, `CONFIRM` or a revision works too. Where the picker is unavailable, such as `claude -p`, the same questions are asked in plain text. Progress lives in `state.json` and the ticks in `plan.md`; FlowDeck does not use a task-list tool.

Planning state lives in `~/.fd-plan/<project>/` by default (`state.json`, with `STATE.md` and `checkpoint.json` rendered from it, plus one folder per topic). `<project>` is the name of the git top-level folder, or of the session directory outside git, so a `cd` into a subfolder still finds it; `fd-state path` prints it.

## Settings

Set these in `/config` (or when you enable the plugin). They are stored as the plugin's options in your Claude Code settings.

| Setting | Values | Default |
|---|---|---|
| Agent models (`model_profile`) | `inherit`: every agent on your session model. `optimized`: `mapper` and `researcher` on haiku, `coder` and `tester` on sonnet, the rest on your model. `reduced`: every agent one step below your model, haiku at the floor. | `optimized` |
| Per-agent overrides (`models`) | e.g. `coder=opus,mapper=haiku`. Agents: the nine below; models: `haiku`, `sonnet`, `opus`, `fable`. | empty |
| Storage (`storage`) | `home`: `~/.fd-plan/<project>/`. `project`: `<project>/.fd-plan/`, which gets its own `.gitignore` (`*`); delete that file if you want to commit your plans. | `home` |
| Extra skills per stage (`stage_skills`) | e.g. `review=ponytail:ponytail-audit,verify=simplify`. Stages: `task` (before the plan CONFIRM), `review` (before the findings report), `execute` (after the last wave), `verify` (before the report), `done` (before the commit message). Repeat a stage for more than one skill. | empty |

No agent ever runs above your session model: overrides and profiles are capped at it. `fd-state models <your model>` prints what each agent will get. Extra skills run in the main conversation through the Skill tool. Their findings go in an `Extra skills (advisory)` section of the stage's report and never block it, and the edit gate still applies to them. `fd-state skills <stage>` lists what a stage will run. Switching storage does not move existing state; move the folder yourself if you want to keep an open pipeline.

## What it uses from Claude Code

- **Code navigation:** the `LSP` tool when a [code-intelligence plugin](https://code.claude.com/docs/en/plugins/code-intelligence) and its language server are installed, otherwise Grep, Glob and Read. The `fd-codenav` skill holds the rules. Run `fd-doctor` to see which you have.
- **Mapping:** the read-only `flowdeck:mapper` agent follows the `fd-map` skill, on the model the settings give it.
- **Review:** the bundled `code-review` skill and the built-in `security-review`. Neither is replaced by a home-grown version.
- **Agents:** nine focused agents (`mapper`, `researcher`, `architect`, `planner`, `coder`, `tester`, `reviewer`, `security-auditor`, `debug-specialist`), each with its own tool list: only `coder` can edit files. The main conversation routes and asks; `fd-execute` sends every step to `coder` (a trivial task is the exception), `fd-verify` uses `tester`, `security-auditor` and, on failure, `debug-specialist` then `coder`, `fd-review` runs two `reviewer` lenses in parallel, and `fd-task` uses `researcher`, `architect` and `planner`. Each subagent starts with a large context of its own.
- **Parallel waves:** a wave with two or more steps runs through the `fd-execute-wave` workflow (`Workflow` tool, authorized by the command). Steps whose file lists in `plan.md` do not intersect run in parallel through `coder`; sharing a file means running in order. This is the shared checkout, not git worktrees: the file lists are trusted, and the full suite runs after the wave.
- **State:** `fd-state` (in `bin/`, on the Bash PATH while the plugin is enabled) is the only writer. It validates and renders `state.json`, `STATE.md` and `checkpoint.json` together.
- **Plan mode:** `fd-task` enters plan mode after mapping the codebase and leaves it with the plan. Approval is the CONFIRM. Not available in `claude -p`; the picker or text CONFIRM is used there.
- **Output style:** optional `FlowDeck` style (`/output-style`) that keeps the model on `AskUserQuestion` and the agents.
- **Models:** commands run on your session model; a `model:` in a command or skill does not switch it when stages chain. Each stage runs `fd-state models <its model>` and passes the result as the `model` of every agent call, so the Settings above decide what agents run on. That per-call model also takes priority over `CLAUDE_CODE_SUBAGENT_MODEL`. For a pinned main model, start with `claude --agent flowdeck:orchestrator`.

## Security review needs committed work

`security-review` compares your branch with `origin/HEAD` and sees only committed changes. So `fd-execute` offers a local branch `fd/<topic>` and commits each wave (never pushed), and `fd-verify` checks for `origin/HEAD` and a non-empty diff first. `fd-verify` first asks whether to run the security audit and whether it may auto-fix failures (`--security=on|off` and `--fix=on|off` answer up front). If you choose it and it cannot run, the check is NOT RUN and the verdict is NOT VERIFIED until you fix the setup or switch to skipping. A skip is recorded and `fd-done` reminds you. When verification fails, `fd-verify` makes up to two automatic fix-and-rerun attempts (if you allowed auto-fix) before handing back to you. Without `origin/HEAD` run `git remote set-head origin -a`, or `fd-doctor` will tell you what is missing.

## The edit gate

While a pipeline is active, a hook blocks `Write`, `Edit` and `MultiEdit` until the stage is `EXECUTE` or `VERIFY` (a failed `fd-verify` stays in `VERIFY`, so you can fix and re-run it). It does not apply to:

- projects with no `~/.fd-plan/<project>/checkpoint.json`
- a finished pipeline (`fd-done` complete) or a cancelled one
- writes under `~/.fd-plan/`

Run `/flowdeck:fd-gate off` to turn the gate off for the current project (`on` restores it, `status` shows it). `FLOWDECK_DEV_MODE=on` in the environment that launches Claude Code also bypasses it.

A second hook, the tool guard, applies in FlowDeck projects. It blocks reading `.env*` (but not `.env.example`, `.sample` or `.template`), `*.pem`, `*.key` and `*.secret`, writing under `node_modules`, the destructive `rm` with recursive-force flags, and edits to the Forbidden Paths in `~/.fd-plan/<project>/.codebase/CONSTRAINTS.md`. `/flowdeck:fd-gate off` and `FLOWDECK_TOOL_GUARD_ENABLED=off` disable it. A Stop hook refreshes `saved_at` on an open checkpoint.

## Rules and skills

Upstream's rules are injected at session start, only in projects FlowDeck has already touched: the always-on rules in full, plus an index of the stage rules matching the detected language, which `fd-execute` and `fd-verify` read. 30 of upstream's 42 skills are included; two of them (`research-first`, `context-budget`) were adapted from `fdx` to LSP and Grep.

## Compared with upstream

Full tables are in [DIFFERENCES.md](DIFFERENCES.md). In short:

**Not ported (shortcomings)**
- Upstream's Rust `fdx` tools and dependency graph. Blast radius uses LSP or text search, and without LSP it misses dynamic imports.
- 12 upstream skills: eleven that need its state files, tools or a pruning step (`change-impact-radar`, `blast-radius-preview`, `failure-replay-engine`, `self-healing-policies`, `telemetry-steward`, `decision-trace`, `session-persistence`, `context-guard`, `repo-memory-graph`, `context-steward` with its `-triggers` stub), and its `code-review`, left out so it cannot shadow the built-in.
- Separate git worktrees per parallel step (parallel waves share the checkout), `--override`, UI design-first gating, the context-window monitor and desktop notifications.
- Upstream's separate frontend-coder and devops agents (one `coder` here). Per-agent models are settings here, capped at the session model (see Settings).
- Review is per wave, not per step, and uses Claude Code's built-in reviews instead of upstream's reviewer and security-auditor prompts.
- `security-review` sees only committed work and needs `origin/HEAD`.
- Nothing enforces "test before code" except the instruction in `fd-execute`.
- The edit gate covers `Write` and `Edit`, not file writes made through Bash.

**Added here**
- `/flowdeck:fd-gate`, the tool guard and the autosave hook (above), `fd-status --all`, and `fd-doctor`.
- `fd-verify` asks up front about the security audit and auto-fix, and fixes and re-runs up to twice on failure. Upstream only offered a manual re-run.
- Subagent delegation and the model ceiling (above).
- `fd-state`, one validated writer for the state files (upstream's are written by the model).
- The full test suite runs after every step in `fd-execute` (after the whole wave when steps run in parallel).

**Ported as upstream:** the trivial-task shortcut (`CONFIRM SKIP` at the end of `fd-task`), lesson capture (`lessons.md`) and Forbidden Paths constraints.

## Develop

```
node --test tests/hooks.test.mjs
claude plugin validate . --strict
```

## License

MIT. See `LICENSE` and `NOTICE`.
