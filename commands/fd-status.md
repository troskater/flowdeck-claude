---
description: Show the active FlowDeck pipeline stage, status, topic and blockers for the current project, and the next command to run
allowed-tools: Read
---

`<slug>` is the current project directory name. Read `~/.fd-plan/<slug>/STATE.md` and `~/.fd-plan/<slug>/checkpoint.json`.

If neither exists, say the pipeline has not been started here and suggest `/flowdeck:fd-task <description>`.

Otherwise report, in one short block: topic, `status`, `current_command` and `current_stage` from the checkpoint, `plan_confirmed`, `steps_complete`, `topic_branch` if set, `blockers`, and `next_action`. Say whether the code-edit gate is open (it opens only when `current_stage` is `EXECUTE` or `VERIFY`). Do not change any file.
