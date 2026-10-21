---
description: FlowDeck pipeline stage. Implement the Steps in plan.md step by step with a TDD cycle, wave by wave, checkpointing after each wave. Run only when continuing the pipeline after fd-review, or when the user names /flowdeck:fd-execute.
argument-hint: [--topic=<slug>]
---

# Execute

Implement the confirmed plan. This is the only stage that opens the code-edit gate: the gatekeeper blocks Write and Edit until the checkpoint reads `EXECUTE`.

**Input:** $ARGUMENTS — optional `--topic=<slug>` to target a topic other than the active one.

**Asking.** Every decision in this command is asked with the `AskUserQuestion` tool, and the text layouts shown are only the fallback for when the tool is unavailable (non-interactive runs) or denied. If `AskUserQuestion` is not in your tool list but `ToolSearch` is, load it first with `ToolSearch` query `select:AskUserQuestion`. Use 2-4 short options, your recommendation first and labelled `(Recommended)`; free text arrives as "Other". A typed answer in the form shown (`Y`, `N`, `CONFIRM`, a revision) is equally valid.

After each wave this command calls Claude Code's built-in `code-review` skill.

Not ported in this version: separate git worktrees per parallel step, and the `--override` and `--keep-worktree` flags. Steps the parallel guard clears run in parallel in the main checkout (Step 2); everything else runs in order.

**State writes.** Every change to `STATE.md` or `checkpoint.json` in this command goes through `fd-state`, which is on the Bash PATH while the plugin is enabled: `fd-state set key=value ...` (quote values that contain spaces). It validates the keys and values and renders `state.json`, `STATE.md` and `checkpoint.json` together, so do not edit those files by hand. Where a step below says to update STATE.md or merge into the checkpoint, pass the same keys, leaving out `version`, `project` and `saved_at` (it sets them); append to a list with `steps_complete+=3`. If it rejects a value, fix the value and retry. Only if the `fd-state` command is not found, say so and write the files as the step describes.

**Agent names.** Set the `description` of every `Agent` call to the agent's own name (`researcher`, `coder`, `tester`), numbered when one stage runs several of the same kind (`coder 1`, `coder 2` by step number). Do not invent labels such as "CEO lens"; anything about the lens or step goes in the brief.

## Delegation

You route; `flowdeck:coder` writes the code. Run each step's TDD cycle (Step 4) in one foreground `Agent` call with `subagent_type: flowdeck:coder`, one step at a time. This keeps test output and file reads out of this conversation and means source, config and test files are only written by the coder. The only exception is a task the user chose to skip review for (`trivial: true` in `checkpoint.json`, from `CONFIRM SKIP`). Without that flag, never edit source, config or test files yourself with Write, Edit or a shell command such as `sed`, however small the step. Delegation is not optional: a small or one-line change is not a reason to do the work yourself, and neither is cost. Fall back only when the `Agent` call itself returned an error, and say so.

- **Model:** omit `model`. The agent inherits your session model.
- **Brief:** the subagent cannot see this conversation. Give it the step text, its acceptance cases from the plan's Task section, its files from the Steps and Affect sections, the paths of the stage rules, the Step 4 cycle, every decision that bears on the step (the Constraints and Out of Scope in the plan's Task section, its Approach, review outcomes, and anything the user decided or changed during this stage), and this instruction: never push, never commit, never touch `~/.fd-plan/`, and if the step's behavior is unclear return the question instead of guessing.
- **Result:** ask for files changed, test command and result, and any open question. Do not accept "tests pass" on its word: run the full suite yourself before recording the step complete. If it returns a question, ask the user.
- **You keep** the guards, the topic branch, the wave commit and review, and all STATE.md and checkpoint updates.

## Step 1: Guards

Resolve `<topic>` from `--topic`, else from `topic` in `~/.fd-plan/<slug>/STATE.md`.

Stop with the matching message if any guard fails:

- `~/.fd-plan/<slug>/STATE.md` missing → `No planning workspace. Run /flowdeck:fd-task first.`
- `plan.md` missing under `<topic>/` → `Error: plan.md not found for topic "<topic>". Run /flowdeck:fd-task first.`
- `plan_confirmed` is not `true` in STATE.md → `Plan not confirmed. Run /flowdeck:fd-task first.`
- `checkpoint.json` does not show `current_command: fd-review` with `current_stage: complete` → `Review has not passed. Run /flowdeck:fd-review first.` Exception: `trivial: true` in `checkpoint.json` with `current_command: fd-task` and `current_stage: complete` (the user chose `CONFIRM SKIP`); log `Review skipped (trivial): <skip_reason>` and continue.

Do not skip these guards. There is no override.

## Step 2: Parallel guard

Build the file list per step from the plan's Affect and Steps sections. For each pair of tasks in the same wave, check whether their file lists intersect.

Two steps of a wave whose file lists do not intersect may run in parallel; any pair that shares a file runs in order. Worktrees are not used, so the check is only as good as the file lists in `plan.md`. If a step's list is empty or looks incomplete, treat it as sequential. Log the decision before any code is written:

```
Parallel guard: <X> parallel, <Y> sequential
  parallel:   Step A, Step B
  sequential: Step C (shares <file> with Step A)
```

The `fd-execute-wave` workflow (Step 4) recomputes the same grouping from the file lists you pass it, so the two must agree.

## Step 2b: Topic branch

`/flowdeck:fd-verify` runs Claude Code's `security-review`, which only sees work that is **committed** on a branch that differs from `origin/HEAD`. Ask once:

```
Create branch fd/<topic> and commit after each wave?
Commits stay local and are never pushed from here. Without this, the security check in /flowdeck:fd-verify cannot run.
[Y] yes   [N] no, work stays uncommitted
```

**Call `AskUserQuestion` now instead of printing the block above (print it only if the tool is unavailable):** header `Branch`, options `Yes, create fd/<topic> (Recommended)` and `No, leave work uncommitted`. Wait for the answer. On Y, run `git switch -c fd/<topic>` (stop and report if the working tree has unrelated changes) and remember the branch name for `topic_branch` below. On N, set `topic_branch` to `null`.

## Step 3: Open the gate

Only now, with guards passed and the guard decision logged, update `~/.fd-plan/<slug>/checkpoint.json` (keep the existing keys):

```json
{
  "current_command": "fd-execute",
  "current_stage": "EXECUTE",
  "topic": "<topic>",
  "topic_branch": "fd/<topic> or null",
  "saved_at": "<ISO timestamp>"
}
```

Update `STATE.md`: `status: executing`, `last_action: Execution started`.

## Step 4: Run each step through the TDD cycle

Before the first step, read the stage rules listed in the "FlowDeck rules" section of the session context (testing, coding style, security, git workflow, and the language patterns for this project). If that section is missing, the session started before FlowDeck was initialized here: read `rules/common/` and the matching language file from the plugin directory instead.

Work through the Steps in `plan.md` wave by wave, in the order the plan gives. Skip any step already listed as complete in STATE.md.

**A wave with two or more steps left** goes to Claude Code's `Workflow` tool, which this command authorizes: call it with name `flowdeck:fd-execute-wave` and `args` `{"wave": <N>, "steps": [{"n": <step number>, "files": [<paths from plan.md>], "brief": "<the full coder brief from Delegation, for that step>"}, ...]}`. The workflow groups the steps by file overlap, runs each group's steps in parallel through `flowdeck:coder` and the groups in order, and returns per-step results. The workflow tells parallel coders to run only their own tests; you run the full suite after it returns, then do Step 6 of the cycle (Record) for every step in the result. If the result carries a `question` or a failed step, stop the wave and ask or report. If the `Workflow` tool is unavailable or errors, run the wave's steps one at a time as below and say so.

**A wave with one step left** is a single `flowdeck:coder` call as below.

For each step:

1. **Behavior.** State in one paragraph what the step does, its input and output, and its edge cases. If you cannot state it clearly, stop and ask the user.
2. **Red.** Write a failing test for the behavior, covering the acceptance cases and edge cases. Run it and confirm it fails. Do not write production code before a failing test exists.
3. **Green.** Write the minimal code that makes the test pass.
4. **Refactor.** Remove duplication and improve naming. Tests must still pass after this step.
5. **Verify.** Run the full test suite, not just the new test. If anything fails, undo the refactor and return to Green. Do not refactor unless the suite is green.
6. **Record.** Add the step number to `steps_complete` in STATE.md, set `last_action`, and tick the step in `plan.md` (`- [ ]` to `- [x]`) so `fd-checkpoint` and `fd-resume` see it.

Exemptions, which skip Red but still run Behavior and Green: renames and typos (run the tests once), config, migration, DTO, constants and type-only files, and documentation-only steps.

A bugfix step writes a regression test that reproduces the bug first, and Green is the fix that makes it pass.

## Step 5: Wave review

After each wave:

1. If `topic_branch` is set, commit the wave: `git add` the files changed in the wave (never `git add -A`), then `git commit -m "fd(<topic>): wave <N>"`. Never push.
2. Call the Skill tool with skill `code-review` and args `high`. Its report is an input to the wave, not the end of your turn: fix findings and carry on to the next wave or Step 6. It reviews the current diff, including uncommitted work. Never pass `ultra` (a billed cloud review), `--fix` or `--comment`.
3. Fix any confirmed bug or CRITICAL/HIGH finding before the next wave. Missing or weak tests count as HIGH, since the review does not measure coverage.

If the Skill call is refused or errors, say so, stop and ask the user. Do not substitute your own review and present it as the built-in one.

Then update `checkpoint.json`:

```json
{
  "current_command": "fd-execute",
  "current_stage": "EXECUTE",
  "topic": "<topic>",
  "last_wave": <N>,
  "saved_at": "<ISO timestamp>"
}
```

Keep `current_stage: EXECUTE` until verification starts, so the gate stays open for fixes.

## Step 6: Finish

When every step is complete, update STATE.md: `status: executed`, `next_action: run /flowdeck:fd-verify`.

Report: steps implemented, test status, review findings, and files changed. The plan was approved at the end of `fd-review`, so there is no further gate. When every step is complete and the last wave's review is clean, invoke the Skill tool with skill `flowdeck:fd-verify` and carry on with that stage. For a trivial task (`trivial: true`), run the test suite once instead, and if it passes set STATE.md `status: verified` and `verified_by: trivial skip` and invoke `flowdeck:fd-done`; if it fails, stop and report. If a step failed or any step is still incomplete, stop and report instead.

## Error handling

- A test will not go red for a step that should fail: stop and report. Do not write the production code.
- The review finds a CRITICAL issue: return to Green for that step.
- Any error mid-wave: report it, leave STATE.md at the last completed step, and do not mark the step complete.
