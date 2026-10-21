---
description: FlowDeck pipeline stage. Close the task by summarizing built vs required, then commit and push only on confirmation. Run only when continuing the pipeline after fd-verify, or when the user names /flowdeck:fd-done.
argument-hint: [--topic=<slug>]
---

`<fd>` is this project's FlowDeck directory, the one `fd-state path` prints (`~/.fd-plan/<project>/`, or `<project>/.fd-plan/` when the storage setting is `project`).

# Done

Close the task: summarize what was built against what was asked, then commit and, if you approve, push.

**Input:** $ARGUMENTS — optional `--topic=<slug>` to target a topic other than the active one.

**Asking.** Every decision in this command is asked with the `AskUserQuestion` tool, and the text layouts shown are only the fallback for when the tool is unavailable (non-interactive runs) or denied. If `AskUserQuestion` is not in your tool list but `ToolSearch` is, load it first with `ToolSearch` query `select:AskUserQuestion`. Use 2-4 short options, your recommendation first and labelled `(Recommended)`; free text arrives as "Other". A typed answer in the form shown (`Y`, `N`, `CONFIRM`, a revision) is equally valid.

**State writes.** Every change to `STATE.md` or `checkpoint.json` in this command goes through `fd-state`, which is on the Bash PATH while the plugin is enabled: `fd-state set key=value ...` (quote values that contain spaces). It validates the keys and values and renders `state.json`, `STATE.md` and `checkpoint.json` together, so do not edit those files by hand. Where a step below says to update STATE.md or merge into the checkpoint, pass the same keys, leaving out `version`, `project` and `saved_at` (it sets them); append to a list with `steps_complete+=3`. If it rejects a value, fix the value and retry. Only if the `fd-state` command is not found, say so and write the files as the step describes.

## Step 0: Pre-flight

1. `<fd>/STATE.md` must exist. If not: `No planning workspace. Run /flowdeck:fd-task first.`
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

Read the Task section of `<fd>/<topic>/plan.md` and check every requirement and acceptance criterion against what actually landed.

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

If STATE.md has `verified_by: trivial skip`, add a line under the box: `Trivial task: fd-review and fd-verify were skipped (<skip_reason>). Tests were run once.` If `security_check` in STATE.md is `skipped`, add a line under the box: `Security audit was skipped at verification. No security review was done on these changes.`

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

Wait for the answer. On [2], stop without committing. **Call `AskUserQuestion` now instead of printing the block above (print it only if the tool is unavailable):** header `Slop`, options `Proceed anyway` and `Abort, I will clean it up`.

## Step 3b: Extra skills

Run `fd-state skills done`. It prints the extra skills the user configured for this stage (`/config`, "Extra skills per stage"), one per line; nothing printed means none. Invoke each one in order with the Skill tool, passing the topic and the path of its `plan.md` as args. Run them after the slop check and before the commit message, so the user sees the findings before committing. Always include a section `Extra skills (advisory)` in the report, even when none are configured. Its first line is `Configured: <skills from fd-state skills done>` or `Configured: none`, so the user can see this step ran; when none are configured, stop there. Otherwise add one line per finding with the skill name. These findings never block the stage or change its outcome. If a skill is not installed, errors, or is blocked by the edit gate, say so in that section and carry on.

## Step 4: Commit message

Propose a Conventional Commits message derived from the plan's Task section:

```
Proposed commit message:

  <type>: <description>

  <body — what changed and why>

Use this message, edit it, or type SKIP to stop without committing.
```

Wait for the user. **Call `AskUserQuestion` now instead of printing the block above (print it only if the tool is unavailable):** header `Commit`, options `Use this message (Recommended)`, `Keep existing commits, no new one` (when the topic branch already holds the wave commits) and `Skip, do not commit`; an edited message arrives as "Other" text.

## Step 5: Push?

```
Push to remote? (yes / no)
Branch: <current branch> -> <remote>/<branch>
```

Wait for the user. **Call `AskUserQuestion` now instead of printing the block above (print it only if the tool is unavailable):** header `Push`, options `No, keep it local (Recommended)` and `Yes, push`. If the current branch is the repository's default branch, say so and offer to create a topic branch first. Do not commit directly to the default branch without the user saying to.

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

Re-read `<fd>/architecture.md` and compare it with what the task changed (from the plan's Affect section and the completed steps). If the task added modules, changed the tech stack, added dependencies, or shifted conventions, update the relevant sections only. Do not rewrite the whole file. Log: `Updated <fd>/architecture.md with changes from <topic>.`

## Step 8: Close out state

Set STATE.md: `status: complete`, `last_action: <topic> closed via /flowdeck:fd-done`, `next_action: run /flowdeck:fd-task to start the next task`.

Merge into `<fd>/checkpoint.json`:

```json
{
  "current_command": "fd-done",
  "current_stage": "complete",
  "status": "done",
  "topic": "<topic>"
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
  State:             <fd>/STATE.md (status: complete)
────────────────────────────────────────────────────
Next: /flowdeck:fd-task to start the next task
════════════════════════════════════════════════════
```

## Error handling

- STATE.md missing: point to `/flowdeck:fd-task`.
- Status is not `verified`: block and point to `/flowdeck:fd-verify`.
- Blockers present: list them all and do not close.
- Write state only if the gates pass. No partial state writes.
