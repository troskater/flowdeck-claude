---
description: FlowDeck pipeline stage. Close the task by summarizing built vs required, then commit and push only on confirmation. Run only when continuing the pipeline after fd-verify, or when the user names /flowdeck:fd-done.
argument-hint: [--topic=<slug>]
---

# Done

Close the task: summarize what was built against what was asked, then commit and, if you approve, push.

**Input:** $ARGUMENTS — optional `--topic=<slug>` to target a topic other than the active one.

## Step 0: Pre-flight

1. `~/.fd-plan/<slug>/STATE.md` must exist. If not: `No planning workspace. Run /flowdeck:fd-task first.`
2. Resolve `<topic>` from `--topic`, else from `topic` in STATE.md.
3. Read STATE.md and record `status`, `plan_confirmed`, `blockers`, `steps_complete`.

## Step 1: Verify gate

If `status` is not `verified`, print the following, then stop. Do not commit and do not update state.

```
Cannot close — /flowdeck:fd-verify has not passed for "<topic>".
Run /flowdeck:fd-verify first. If it reported failures, fix them and re-run it.
```

Also stop if `blockers` is non-empty, and list every blocker.

## Step 2: Summarize built vs required

Read `~/.fd-plan/<slug>/<topic>/task.md` and check every requirement and acceptance criterion against what actually landed.

Collect the changed files with `git status --short` and `git diff --name-only HEAD`. If a branch base is known, also run `git log --oneline --no-merges <base>..HEAD`.

```
════════════════════════════════════════════════════
SUMMARY: <topic>
════════════════════════════════════════════════════
Requirements
  PASS R-01: <requirement> — <where it landed>
  GAP  R-03: <requirement> — not implemented: <reason>

Acceptance Criteria
  PASS <criterion>
  GAP  <criterion> — <gap>

Changed files: <N>
  <file>
════════════════════════════════════════════════════
```

If `security_check` in STATE.md is `skipped`, add a line under the box: `Security audit was skipped at verification. No security review was done on these changes.`

Report gaps honestly. State a dropped or deferred requirement as such. Never omit it quietly.

## Step 3: Slop check

Scan the diff before committing:

```bash
git diff HEAD | grep -iE "improving|enhancing|robust|comprehensive|leveraging|utilizing|pivotal|seamless|tailored|streamline|cutting-edge|game.?changer|revolutioni|unparalleled|bespoke" || true
```

Also look for lines over 500 characters, generic praise in the proposed commit message ("excellent work", "great job"), and leftover template artifacts (`TODO`, `[REVIEWER NOTE]`, `[STEP 1]`).

If anything is found, list it and ask:

```
SLOP DETECTED — the diff contains generic artifacts:
  <findings>

  [1] Proceed anyway
  [2] Abort — I will clean it up first
```

Wait for the answer. On [2], stop without committing.

## Step 4: Commit message

Propose a Conventional Commits message derived from `task.md`:

```
Proposed commit message:

  <type>: <description>

  <body — what changed and why>

Use this message, edit it, or type SKIP to stop without committing.
```

Wait for the user.

## Step 5: Push?

```
Push to remote? (yes / no)
Branch: <current branch> -> <remote>/<branch>
```

Wait for the user. If the current branch is the repository's default branch, say so and offer to create a topic branch first. Do not commit directly to the default branch without the user saying to.

## Step 6: Commit

If `topic_branch` in `checkpoint.json` is set, `/flowdeck:fd-execute` already committed each wave to that branch. Show `git log --oneline origin/HEAD..HEAD` and offer:

```
  [1] Keep the wave commits as they are
  [2] Squash them into the single commit from Step 4
```

Squash only on [2]: `git reset --soft $(git merge-base origin/HEAD HEAD)`, then commit with the confirmed message. The staging steps below then cover only uncommitted leftovers.

Stage only the changed files from Step 2. Do not use `git add -A`. Then:

```bash
git add <changed files>
git commit -m "<confirmed message>"
```

Push only if the user approved it in Step 5, to the remote and branch shown there. Report the commit SHA and, if pushed, the remote ref. If the user declined a step, say exactly what was and was not done.

If `git commit` fails, report the git error verbatim and do not mark the task complete. If `git push` fails, the commit stands: report the failure and carry on to Step 7.

## Step 7: Update project architecture

Re-read `~/.fd-plan/<slug>/architecture.md` and compare it with what the task changed (from `affect.md` and the completed steps). If the task added modules, changed the tech stack, added dependencies, or shifted conventions, update the relevant sections only. Do not rewrite the whole file. Log: `Updated ~/.fd-plan/<slug>/architecture.md with changes from <topic>.`

## Step 8: Close out state

Set STATE.md: `status: complete`, `last_action: <topic> closed via /flowdeck:fd-done`, `next_action: run /flowdeck:fd-task to start the next task`.

Merge into `~/.fd-plan/<slug>/checkpoint.json`:

```json
{
  "current_command": "fd-done",
  "current_stage": "complete",
  "status": "done",
  "topic": "<topic>",
  "saved_at": "<ISO timestamp>"
}
```

## Step 9: Report

```
════════════════════════════════════════════════════
DONE — <topic>
════════════════════════════════════════════════════
  Requirements met:  <N>/<M>
  Changed files:     <N>
  Commit:            <sha> | not committed
  Pushed:            <remote>/<branch> | no
  State:             ~/.fd-plan/<slug>/STATE.md (status: complete)
────────────────────────────────────────────────────
Next: /flowdeck:fd-task to start the next task
════════════════════════════════════════════════════
```

## Error handling

- STATE.md missing: point to `/flowdeck:fd-task`.
- Status is not `verified`: block and point to `/flowdeck:fd-verify`.
- Blockers present: list them all and do not close.
- Write state only if the gates pass. No partial state writes.
