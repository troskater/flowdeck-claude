---
description: Show the active FlowDeck pipeline stage and any blockers for the current project.
allowed-tools: Bash, Read
---

Spike command. Read `~/.fd-plan/<slug>/STATE.md` (slug = current directory name) and report the stage, status and blockers. If the file is missing, say the pipeline has not been initialized and suggest `/fd-task`.
