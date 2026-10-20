---
description: Restore from checkpoint.json (falling back to STATE.md), brief you, wait for confirmation, then continue from the recorded command and stage
argument-hint: [--yes]
---

# Resume

Resume an interrupted FlowDeck session.

**Input:** $ARGUMENTS — pass `--yes` to skip the confirmation pause.

## Steps

1. **Read `~/.fd-plan/<slug>/checkpoint.json`. It is the primary source.** If it exists and `version` is `"1"`, rebuild the summary from `current_command`, `current_stage`, `topic` and `blockers`. If it is missing, unreadable, or has another `version`, fall back to STATE.md and say which source you used.

2. **Fallback to STATE.md.** Read `topic`, `status`, `plan_confirmed`, `steps_complete`, `last_action` and `next_action`. If STATE.md is also missing: `No planning workspace. Run /flowdeck:fd-task to start.`

3. Read STATE.md for anything the checkpoint does not carry: `last_updated`, `plan_confirmed`, `steps_complete`.

4. If `~/.fd-plan/<slug>/<topic>/plan.md` exists, show its first 10 lines. If `task.md` exists, show the requirement count.

5. Present:

```
═══════════════════════════════════════════════
RESUMING SESSION
═══════════════════════════════════════════════
Source: checkpoint.json | STATE.md (fallback)
Project: <slug>  |  Topic: <topic>
Command: <current_command> -> stage: <current_stage>
Status: <status>
Last updated: <timestamp>
Plan confirmed: <yes/no>
Requirements: <X> from task.md
Blockers: <list, or "none">

Plan preview:
<first 10 lines of plan.md>
───────────────────────────────────────────────
Type CONFIRM to resume from this point.
═══════════════════════════════════════════════
```

6. Unless `--yes` was passed, **wait** for the user to type CONFIRM.

7. After confirmation:
   - If `blockers` is non-empty, report them and stop. Do not resume into a blocked state.
   - Otherwise invoke the Skill tool with skill `flowdeck:<current_command>` (the CONFIRM in step 6 is the approval) and carry on with that stage. Its own guards skip finished work and steps already in `steps_complete`.
   - If the checkpoint was missing, use STATE.md: `plan_confirmed: true` with unfinished steps resumes at `/flowdeck:fd-execute`; no plan starts at `/flowdeck:fd-task`.
   - Say what the next step is before starting it.

Resuming does not change the edit gate. It stays open only if `current_stage` is already `EXECUTE` or `VERIFY`, and otherwise `/flowdeck:fd-execute` has to open it again through its guards.

## Pipeline order

Stages resume in this order and may not be skipped:

```
fd-task -> fd-review -> fd-execute -> fd-verify -> fd-done
```
