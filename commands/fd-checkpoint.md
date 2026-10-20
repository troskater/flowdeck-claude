---
description: Force-save session state to checkpoint.json and STATE.md so the work can be resumed later
---

# Checkpoint

Save the current session state so `/flowdeck:fd-resume` can pick the work up later.

A Stop hook refreshes `saved_at` after each turn, but only this command writes `STATE.md` and the rest of the checkpoint. Run it before closing a session mid-pipeline.

## Steps

1. `~/.fd-plan/<slug>/STATE.md` must exist. If not: `No planning workspace. Run /flowdeck:fd-task to start.`

2. Read STATE.md and any existing `checkpoint.json`.

3. Update STATE.md: set `last_updated` to the current timestamp and make sure `status` reflects reality.

4. If `~/.fd-plan/<slug>/<topic>/plan.md` exists, scan it for steps marked done (`- [x]`) and update `steps_complete` in STATE.md to match.

5. Write `~/.fd-plan/<slug>/checkpoint.json`. **Merge into the existing file.** Never drop fields an earlier command wrote.

```json
{
  "version": "1",
  "project": "<slug>",
  "topic": "<topic>",
  "saved_at": "<ISO>",
  "current_command": "fd-execute",
  "current_stage": "EXECUTE",
  "files_written": ["~/.fd-plan/<slug>/<topic>/plan.md"],
  "blockers": [],
  "status": "in_progress"
}
```

Rules:
- Leave `current_command` and `current_stage` exactly as they are. They control the code-edit gate: `EXECUTE` and `VERIFY` allow edits, everything else blocks them. Never set `EXECUTE` or `VERIFY` here, and never change either value.
- `version` is always `"1"`.
- `blockers` copies the STATE.md blockers verbatim, or `[]`.
- `status` is `in_progress` while the pipeline runs and `done` after `/flowdeck:fd-done`.
- `phases` and `worktrees` are not tracked in this version. Keep them if an earlier file has them.

If the file cannot be written, report the failure. Do not claim a checkpoint that `/flowdeck:fd-resume` cannot load.

6. Report:

```
Checkpoint saved
   Topic: <topic> | Command: <current_command> -> <current_stage>
   File:  ~/.fd-plan/<slug>/checkpoint.json
   Safe to close the session. Resume with /flowdeck:fd-resume.
```
