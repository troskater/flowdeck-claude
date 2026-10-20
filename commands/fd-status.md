---
description: Show the active FlowDeck pipeline stage, artifacts, blockers and next command for this project; --all lists every topic
argument-hint: [--topic=<slug>] [--all]
allowed-tools: Read, Glob
---

`<slug>` is the current project directory name. Do not change any file.

Input: $ARGUMENTS

## Default: active topic

Read `~/.fd-plan/<slug>/checkpoint.json`, falling back to `~/.fd-plan/<slug>/STATE.md` (say so if you fall back). `<topic>` is `--topic`, else `topic` from STATE.md. If neither file exists: `No planning workspace. Run /flowdeck:fd-task <description> to start.` If `--topic` names a topic with no directory: `Topic '<topic>' not found.` and list the topics that exist.

Print one block:

```
Project: <slug>   Topic: <topic>
Updated: <saved_at>   Source: checkpoint.json | STATE.md
Pipeline
  ✅ fd-task     — artifacts confirmed
  ✅ fd-review   — 0 blocking findings
  🔄 fd-execute  — wave-2  ← current
  ⬜ fd-verify
  ⬜ fd-done
Artifacts   task.md ✅  architecture.md ✅  affect.md ✅  plan.md ✅
Plan        <X> steps (<Y> complete)     Risk  <low|medium|high> (from affect.md)
Branch      <topic_branch or none>
Edit gate   open | closed (it opens only when current_stage is EXECUTE or VERIFY)
Blockers    <list, or none>
Next: <next command>
```

`✅` is a stage recorded complete in the checkpoint or implied by STATE.md `status`; `🔄` is the stage named by `current_command`; `⬜` is not reached. Check the four artifacts by looking for the files under `<topic>/`; count plan steps from `plan.md` and `steps_complete` from STATE.md.

Show each blocker with the command that clears it, e.g. `affect.md missing → /flowdeck:fd-task`, `verification failed → /flowdeck:fd-execute, then /flowdeck:fd-verify`.

## `--all`

Glob the topic directories under `~/.fd-plan/<slug>/` and list each as `<icon> <topic> — <stage> | updated <time>`, marking the active one. Stage per topic: STATE.md `status: complete` → `done`; `steps_complete` non-empty → `execute`; `plan.md` present → `task`. Finish with `Total: N topics | n done | n in progress | n planned`.
