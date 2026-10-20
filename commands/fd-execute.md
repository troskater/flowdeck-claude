---
description: FlowDeck pipeline stage. Implement plan.md step by step with a TDD cycle, wave by wave, checkpointing after each wave. Run only when continuing the pipeline after fd-review, or when the user names /flowdeck:fd-execute.
argument-hint: [--topic=<slug>]
---

# Execute

Implement the confirmed plan. This is the only stage that opens the code-edit gate: the gatekeeper blocks Write and Edit until the checkpoint reads `EXECUTE`.

**Input:** $ARGUMENTS — optional `--topic=<slug>` to target a topic other than the active one.

**Asking.** Every decision in this command is asked with the `AskUserQuestion` tool, and the text layouts shown are only the fallback for when the tool is unavailable (non-interactive runs) or denied. If `AskUserQuestion` is not in your tool list but `ToolSearch` is, load it first with `ToolSearch` query `select:AskUserQuestion`. Use 2-4 short options, your recommendation first and labelled `(Recommended)`; free text arrives as "Other". A typed answer in the form shown (`Y`, `N`, `CONFIRM`, a revision) is equally valid.

After each wave this command calls Claude Code's built-in `code-review` skill.

Not ported in this version: parallel worktree waves and the `--override` and `--keep-worktree` flags. Every step runs sequentially in the main checkout.

## Delegation

A subagent keeps test output and file reads out of this conversation, but it starts with a large context of its own, so it only pays off on longer plans. If `plan.md` has more than 3 steps, run each step's TDD cycle (Step 4) in one foreground `Agent` call (`subagent_type: general-purpose`); with 3 steps or fewer, do the steps yourself.

- **Model:** your own model is the ceiling. On Opus pass `model: "sonnet"`; on any other model omit `model` so it inherits yours.
- **Brief:** the subagent cannot see this conversation. Give it the step text, its acceptance cases from `task.md`, the files from `plan.md`/`affect.md`, the paths of the stage rules, the Step 4 cycle, every decision that bears on the step (the Constraints and Out of Scope in `task.md`, the Approach in `architecture.md`, review outcomes, and anything the user decided or changed during this stage), and this instruction: never push, never commit, never touch `~/.fd-plan/`, and if the step's behavior is unclear return the question instead of guessing.
- **Result:** ask for files changed, test command and result, and any open question. Do not accept "tests pass" on its word: run the full suite yourself before recording the step complete. If it returns a question, ask the user.
- **You keep** the guards, the topic branch, the wave commit and review, and all STATE.md and checkpoint updates.

## Step 1: Guards

Resolve `<topic>` from `--topic`, else from `topic` in `~/.fd-plan/<slug>/STATE.md`.

Stop with the matching message if any guard fails:

- `~/.fd-plan/<slug>/STATE.md` missing → `No planning workspace. Run /flowdeck:fd-task first.`
- `task.md`, `architecture.md`, `affect.md` or `plan.md` missing under `<topic>/` → `Error: <file> not found for topic "<topic>". Run /flowdeck:fd-task first.`
- `plan_confirmed` is not `true` in STATE.md → `Plan not confirmed. Run /flowdeck:fd-task first.`
- `checkpoint.json` does not show `current_command: fd-review` with `current_stage: complete` → `Review has not passed. Run /flowdeck:fd-review first.` Exception: `trivial: true` in `checkpoint.json` with `current_command: fd-task` and `current_stage: complete` (the user chose `CONFIRM SKIP`); log `Review skipped (trivial): <skip_reason>` and continue.

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

Work through `plan.md` wave by wave, and within a wave one step at a time, in the order the plan gives. Skip any step already listed as complete in STATE.md.

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
