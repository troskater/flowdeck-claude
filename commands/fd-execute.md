---
description: Implement plan.md step by step with a TDD cycle, wave by wave, checkpointing after each wave
argument-hint: [--topic=<slug>]
---

# Execute

Implement the confirmed plan. This is the only stage that opens the code-edit gate: the gatekeeper blocks Write and Edit until the checkpoint reads `EXECUTE`.

**Input:** $ARGUMENTS — optional `--topic=<slug>` to target a topic other than the active one.

Run this as the orchestrator. Use the `reviewer` agent after each wave.

Not ported in this version: git worktrees, the `fdx` graph, the `--override` flag, and the `--keep-worktree` flag. Every step runs sequentially in the main checkout.

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

## Step 3: Open the gate

Only now, with guards passed and the guard decision logged, update `~/.fd-plan/<slug>/checkpoint.json` (keep the existing keys):

```json
{
  "current_command": "fd-execute",
  "current_stage": "EXECUTE",
  "topic": "<topic>",
  "saved_at": "<ISO timestamp>"
}
```

Update `STATE.md`: `status: executing`, `last_action: Execution started`.

## Step 4: Run each step through the TDD cycle

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

After each wave, run the `reviewer` agent over the files changed in that wave. Fix any CRITICAL or HIGH finding before moving to the next wave. Missing or weak tests are HIGH.

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

Report: steps implemented, test status, reviewer findings, and files changed. Next step: `/flowdeck:fd-verify`.

## Error handling

- A test will not go red for a step that should fail: stop and report. Do not write the production code.
- The reviewer finds a CRITICAL issue: return to Green for that step.
- Any error mid-wave: report it, leave STATE.md at the last completed step, and do not mark the step complete.
