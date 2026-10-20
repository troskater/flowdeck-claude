---
description: FlowDeck pipeline stage. Implement plan.md step by step with a TDD cycle, wave by wave, checkpointing after each wave. Run only when continuing the pipeline after fd-review, or when the user names /flowdeck:fd-execute.
argument-hint: [--topic=<slug>]
---

# Execute

Implement the confirmed plan. This is the only stage that opens the code-edit gate: the gatekeeper blocks Write and Edit until the checkpoint reads `EXECUTE`.

**Input:** $ARGUMENTS — optional `--topic=<slug>` to target a topic other than the active one.

After each wave this command calls Claude Code's built-in `code-review` skill.

Not ported in this version: parallel worktree waves and the `--override` and `--keep-worktree` flags. Every step runs sequentially in the main checkout.

## Step 1: Guards

Resolve `<topic>` from `--topic`, else from `topic` in `~/.fd-plan/<slug>/STATE.md`.

Stop with the matching message if any guard fails:

- `~/.fd-plan/<slug>/STATE.md` missing → `No planning workspace. Run /flowdeck:fd-task first.`
- `task.md`, `architecture.md`, `affect.md` or `plan.md` missing under `<topic>/` → `Error: <file> not found for topic "<topic>". Run /flowdeck:fd-task first.`
- `plan_confirmed` is not `true` in STATE.md → `Plan not confirmed. Run /flowdeck:fd-task first.`
- `checkpoint.json` does not show `current_command: fd-review` with `current_stage: complete` → `Review has not passed. Run /flowdeck:fd-review first.`

Do not skip these guards. There is no override.

## Step 2: Parallel guard

Build the file list per task from `affect.md`. For each pair of tasks in the same wave, check whether their file lists intersect.

Worktrees are not available here, so every task runs sequentially. Log the decision before any code is written:

```
Parallel guard: 0 parallel, <N> sequential (worktrees not ported)
  sequential: <Task A>, <Task B>, ...
```

## Step 2b: Topic branch

`/flowdeck:fd-verify` runs Claude Code's `security-review`, which only sees work that is **committed** on a branch that differs from `origin/HEAD`. Ask once:

```
Create branch fd/<topic> and commit after each wave?
Commits stay local and are never pushed from here. Without this, the security check in /flowdeck:fd-verify cannot run.
[Y] yes   [N] no, work stays uncommitted
```

Wait for the answer. On Y, run `git switch -c fd/<topic>` (stop and report if the working tree has unrelated changes) and remember the branch name for `topic_branch` below. On N, set `topic_branch` to `null`.

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

Work through `plan.md` wave by wave, and within a wave one step at a time, in the order the plan gives. Skip any step already listed as complete in STATE.md.

For each step:

1. **Behavior.** State in one paragraph what the step does, its input and output, and its edge cases. If you cannot state it clearly, stop and ask the user.
2. **Red.** Write a failing test for the behavior, covering the acceptance cases and edge cases. Run it and confirm it fails. Do not write production code before a failing test exists.
3. **Green.** Write the minimal code that makes the test pass.
4. **Refactor.** Remove duplication and improve naming. Tests must still pass after this step.
5. **Record.** Add the step number to `steps_complete` in STATE.md and set `last_action`.

Exemptions, which skip Red but still run Behavior and Green: renames and typos (run the tests once), config, migration, DTO, constants and type-only files, and documentation-only steps.

A bugfix step writes a regression test that reproduces the bug first, and Green is the fix that makes it pass.

## Step 5: Wave review

After each wave:

1. If `topic_branch` is set, commit the wave: `git add` the files changed in the wave (never `git add -A`), then `git commit -m "fd(<topic>): wave <N>"`. Never push.
2. Call the Skill tool with skill `code-review` and args `high`. It reviews the current diff, including uncommitted work. Never pass `ultra` (a billed cloud review), `--fix` or `--comment`.
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

Report: steps implemented, test status, review findings, and files changed. Then ask:

```
Execution finished. Type CONFIRM to continue to /flowdeck:fd-verify, or stop here and resume later with /flowdeck:fd-resume.
```

Wait for the user. On CONFIRM, invoke the Skill tool with skill `flowdeck:fd-verify` and carry on with that stage. Do not start it without the CONFIRM.

## Error handling

- A test will not go red for a step that should fail: stop and report. Do not write the production code.
- The review finds a CRITICAL issue: return to Green for that step.
- Any error mid-wave: report it, leave STATE.md at the last completed step, and do not mark the step complete.
