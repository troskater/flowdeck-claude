---
description: Restore from state.json (falling back to checkpoint.json and STATE.md), brief you, wait for confirmation, then continue from the recorded command and stage
argument-hint: [--yes]
---

# Resume

Resume an interrupted FlowDeck session.

**Input:** $ARGUMENTS — pass `--yes` to skip the confirmation pause.

**Asking.** Every decision in this command is asked with the `AskUserQuestion` tool, and the text layouts shown are only the fallback for when the tool is unavailable (non-interactive runs) or denied. If `AskUserQuestion` is not in your tool list but `ToolSearch` is, load it first with `ToolSearch` query `select:AskUserQuestion`. Use 2-4 short options, your recommendation first and labelled `(Recommended)`; free text arrives as "Other". A typed answer in the form shown (`Y`, `N`, `CONFIRM`, a revision) is equally valid.

## Steps

1. **Read `~/.fd-plan/<slug>/state.json` (the directory `fd-state path` prints). It is the primary source and holds every field.** If it exists and `version` is `"1"`, rebuild the summary from `current_command`, `current_stage`, `topic`, `blockers`, `status`, `plan_confirmed`, `steps_complete`, `last_action`, `next_action` and `saved_at`.

2. **Fallback for older projects.** If `state.json` is missing, unreadable, or has another `version`, read `checkpoint.json` for `current_command`, `current_stage`, `topic` and `blockers`, and STATE.md for `status`, `plan_confirmed`, `steps_complete`, `last_action` and `next_action`, and say which source you used. If neither exists: `No planning workspace. Run /flowdeck:fd-task to start.`

3. If `~/.fd-plan/<slug>/<topic>/plan.md` exists, show the first 10 lines of its Steps section. show the requirement count: the number of lines that start with `- R-` followed by digits.

4. Present:

```
═══════════════════════════════════════════════
RESUMING SESSION
═══════════════════════════════════════════════
Source: state.json | checkpoint.json + STATE.md (fallback)
Project: <slug>  |  Topic: <topic>
Command: <current_command> -> stage: <current_stage>
Status: <status>
Last updated: <timestamp>
Plan confirmed: <yes/no>
Requirements: <X> from plan.md
Blockers: <list, or "none">

Plan preview:
<first 10 lines of the Steps section of plan.md>
───────────────────────────────────────────────
Type CONFIRM to resume from this point.
═══════════════════════════════════════════════
```

5. Unless `--yes` was passed, **wait** for the user to type CONFIRM. **Call `AskUserQuestion` now instead of printing the block above (print it only if the tool is unavailable):** header `Resume`, options `Resume from here (Recommended)` and `Stop`.

6. After confirmation:
   - If `blockers` is non-empty, report them and stop. Do not resume into a blocked state.
   - Otherwise pick the stage to run. If `current_stage` is `complete`, it is the stage after `current_command` in the pipeline order below (`fd-done` complete: say the pipeline is finished and stop). Anything else (including a failed `fd-verify`, which stays at `VERIFY`) re-enters `current_command`. Invoke the Skill tool with skill `flowdeck:<that stage>` (the CONFIRM in step 5 is the approval) and carry on with it. Its own guards skip finished work and steps already in `steps_complete`.
   - If the checkpoint was missing, use STATE.md: `plan_confirmed: true` with unfinished steps resumes at `/flowdeck:fd-execute`; no plan starts at `/flowdeck:fd-task`.
   - Say what the next step is before starting it.

Resuming does not change the edit gate. It stays open only if `current_stage` is already `EXECUTE` or `VERIFY`, and otherwise `/flowdeck:fd-execute` has to open it again through its guards.

## Pipeline order

Stages resume in this order and may not be skipped:

```
fd-task -> fd-review -> fd-execute -> fd-verify -> fd-done
```
