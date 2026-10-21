---
description: Force-save session state to state.json (rendered to STATE.md and checkpoint.json) so the work can be resumed later
---

# Checkpoint

Save the current session state so `/flowdeck:fd-resume` can pick the work up later.

A Stop hook refreshes `saved_at` after each turn, but only this command corrects `STATE.md` and the rest of the state. Run it before closing a session mid-pipeline.

## Steps

1. `~/.fd-plan/<slug>/STATE.md` must exist. If not: `No planning workspace. Run /flowdeck:fd-task to start.`

2. Read STATE.md and any existing `checkpoint.json`.

3. If `~/.fd-plan/<slug>/<topic>/plan.md` exists, scan its Steps section for steps marked done (`- [x]`) and make `steps_complete` match.

4. Save with one Bash call to `fd-state` (on PATH while the plugin is enabled), which validates the values and renders `state.json`, `STATE.md` and `checkpoint.json` together; do not edit those files by hand: `fd-state set status=<status> steps_complete=<0,1,...> blockers=<...>`. Pass only what needs correcting; everything else is kept, and `saved_at` is set for you. Only if the command is not found, say so and update STATE.md and `checkpoint.json` by hand, merging into the existing file and never dropping fields an earlier command wrote.

Rules:
- Never pass `current_command` or `current_stage`. They control the code-edit gate: `EXECUTE` and `VERIFY` allow edits, everything else blocks them. Never set `EXECUTE` or `VERIFY` here, and never change either value.
- `blockers` keeps the existing blockers, or `[]`.
- `status` is `in_progress` while the pipeline runs and `done` after `/flowdeck:fd-done`.

If the file cannot be written, report the failure. Do not claim a checkpoint that `/flowdeck:fd-resume` cannot load.

5. Report:

```
Checkpoint saved
   Topic: <topic> | Command: <current_command> -> <current_stage>
   File:  ~/.fd-plan/<slug>/checkpoint.json
   Safe to close the session. Resume with /flowdeck:fd-resume.
```
