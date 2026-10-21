---
description: Show the active FlowDeck pipeline stage, plan, blockers and next command for this project; --all lists every topic
argument-hint: [--topic=<slug>] [--all]
allowed-tools: Read, Glob, Bash(fd-state path)
---

`<fd>/` is the directory `fd-state path` prints, the same one the hooks use: `~/.fd-plan/<project>/` (named after the git top-level folder), or `<project>/.fd-plan/` when the storage setting is `project`. Do not change any file.

Input: $ARGUMENTS

## Default: active topic

Read `<fd>/state.json` (every field), falling back to `checkpoint.json`, then `STATE.md` (say so if you fall back). `<topic>` is `--topic`, else `topic` from the state. If none of the three exists: `No planning workspace. Run /flowdeck:fd-task <description> to start.` If `--topic` names a topic with no directory: `Topic '<topic>' not found.` and list the topics that exist.

Print one block:

```
Project: <slug>   Topic: <topic>
Updated: <saved_at>   Source: state.json | checkpoint.json | STATE.md
Pipeline
  ✅ fd-task     — plan confirmed
  ✅ fd-review   — 0 blocking findings
  🔄 fd-execute  — wave-2  ← current
  ⬜ fd-verify
  ⬜ fd-done
Plan file   plan.md ✅  (Task ✅  Architecture ✅  Affect ✅  Steps ✅)
Plan        <X> steps (<Y> complete)     Risk  <low|medium|high> (from the Affect section)
Branch      <topic_branch or none>
Edit gate   open | closed (it opens only when current_stage is EXECUTE or VERIFY)
Blockers    <list, or none>
Next: <next command>
```

`✅` is a stage recorded complete in the checkpoint or implied by STATE.md `status`; `🔄` is the stage named by `current_command`; `⬜` is not reached. Check the four sections by looking for their `##` headings in `<topic>/plan.md`; count plan steps from its Steps section and `steps_complete` from STATE.md.

Show each blocker with the command that clears it, e.g. `Affect section missing → /flowdeck:fd-task`, `verification failed → fix the code, then /flowdeck:fd-verify`.

## `--all`

Glob the topic directories under `<fd>/` and list each as `<icon> <topic> — <stage> | updated <time>`, marking the active one. Stage per topic: STATE.md `status: complete` → `done`; `steps_complete` non-empty → `execute`; `plan.md` present → `task`. Finish with `Total: N topics | n done | n in progress | n planned`.
