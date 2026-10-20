---
description: Define a task end to end — auto-init the workspace, map the codebase, confirm requirements, and save task.md + architecture.md + affect.md + plan.md
argument-hint: <task description>
---

# Task

Pipeline entrypoint. Turns a task description into the four confirmed artifacts every later stage reads.

**Input:** $ARGUMENTS — the task description. REQUIRED.

If `$ARGUMENTS` is empty, ask the user for a task description before doing anything else. Do not guess or infer the task.

Codebase mapping runs in the `fd-map` skill, which uses a read-only Explore subagent.

## Step 1: Auto-init

`<slug>` is the current project directory name. Planning state lives in `~/.fd-plan/<slug>/`.

If `~/.fd-plan/<slug>/` does not exist:
1. Create it, then write `STATE.md` immediately so an interrupted session can resume:
   ```
   status: in_progress
   plan_confirmed: false
   last_action: fd-task started
   next_action: complete fd-task steps
   ```
2. Write `checkpoint.json` with `"current_command": "fd-task"` and `"current_stage": "in_progress"`.
3. Invoke the `fd-map` skill through the Skill tool to map the codebase. Write the summary it returns to `~/.fd-plan/<slug>/architecture.md`. This file is project-level context. It is not the task's design: Step 6 writes the task's own `architecture.md` under `<topic>/`.

If codebase mapping fails, report the failure and stop. A task planned against an unmapped codebase is not trustworthy.

If `~/.fd-plan/<slug>/architecture.md` already exists, do not overwrite it. Read it instead.

## Step 2: Research gate

Derive 3-5 research queries from the task. Each should target a different area: existing implementation, affected modules, dependencies, prior decisions.

Present them and wait:

```
Research plan for: "<task description>"

Proposed queries:
  1. <query>
  2. <query>
  3. <query>

[Y] Run these queries
[N] Skip research — go straight to discussion
[C] Use custom queries
```

Do not continue until the user answers.

- **Y:** run the queries following the `fd-codenav` skill, then Read the matching files. Always also read `architecture.md`, prior `~/.fd-plan/<slug>/*/task.md` files, and `CLAUDE.md` / `AGENTS.md` if present. Summarize in 3-5 bullets.
- **N:** log "Research skipped by user." and add `Note: created without codebase research — may need revision.` under `## Constraints` in task.md.
- **C:** ask for the queries one per line, use them exactly as given, then run them as in Y.

## Step 3: Clarify, one question at a time

Ask clarifying questions **one at a time**. Do not batch them.

Skip a question if:
1. Its answer is already in `architecture.md`, a prior `task.md`, or `STATE.md`
2. Its answer follows from the tech stack or existing patterns
3. It was already answered this session

Record each skipped question and its evidence for `task.md`.

Before proposing a new component, grep for an existing one. If one exists, extend it, and note it under "Alternatives Considered" as `<name> — reused existing <component> instead of building new.`

Cover, in order, skipping what research already settled: scope (and what is out of scope), constraints, acceptance criteria, risks.

## Step 4: Draft the four artifacts

Draft all four before showing anything. Every claim must trace to Step 2 evidence or a Step 3 answer. Do not guess.

**`task.md`**
```md
# Task: <title>

**Created:** <ISO timestamp>

## Requirements
- R-01: <requirement>

## Out of Scope
- <item>

## Acceptance Criteria
- [ ] <verifiable criterion>

## Constraints
- <constraint>

## Open Questions
- <item, or "none">

## Suppressed Questions
- "<question>" → answered by: <evidence source>
```

**`architecture.md`** (task-level design)
```md
# Architecture: <title>

## Approach
<the chosen design, one paragraph>

## Components
- <component>: <responsibility>

## Data Flow
<how the pieces connect>

## Alternatives Considered
- <alternative> — rejected because <reason>
```

**`affect.md`** (blast radius)
```md
# Affect Analysis
Generated: <ISO timestamp>
Source: LSP | Grep (text-based; misses dynamic imports and generated code)

## Affected Files
- path/to/file (modify|create|delete)

## Affected Systems
- <system>: <reason>

## Risk Level
low | medium | high

## Parallel Safety
### Can Parallel
- Task A: [file1, file2]
### Must Sequential
- Task C (depends on A): [file1, file3]
```

Find the affected files and their dependents by following the blast-radius procedure in the `fd-codenav` skill, and fill in the `Source:` line honestly. Every task in `plan.md` appears exactly once under Can Parallel or Must Sequential. A task goes under Must Sequential if its files overlap another task's files or it depends on one. Risk is `high` for security, schema or breaking changes, `medium` for shared modules or public API, otherwise `low`.

**`plan.md`**
```md
# Plan: <title>

## Wave 1
- [ ] Step 1: <action> (traces: R-01) — files: [file1]

## Wave 2
- [ ] Step 2: <action> (traces: R-02) — files: [file1, file3]
```

Every step traces to at least one `R-XX`. Steps in the same wave do not depend on each other.

**Effort estimate:** 1-3 files, low risk, 1 wave ≈ 30 min. 4-10 files, low/medium, 1-2 waves ≈ 2-4 h. 10+ files, high risk, or 3+ waves ≈ 1 day+. Add 50% if 3+ systems are affected. Show it with the drafts.

**Trivial check.** The task is trivial only if it is a rename, typo, config value or version bump, touches at most 2 files, is `low` risk, has a single wave and changes no behavior. If so, propose the shortcut with the drafts: `fd-task -> fd-execute -> fd-done`, skipping `fd-review` and `fd-verify`, with the reason stated. The user decides; never apply it on your own.

## Step 5: Confirm

Present all four drafts, then print:

```
Ready to save these artifacts?
Type CONFIRM to save, or describe changes needed.
```

For a trivial task add: `Trivial task: skip fd-review and fd-verify? Type CONFIRM SKIP to save and skip them, CONFIRM to save and run the full pipeline.`

Do not write any file before CONFIRM. On requested changes, return to Step 4.

## Step 6: Save

Derive `<topic>` as a lowercase, hyphenated slug of the task title. Write `task.md`, `architecture.md`, `affect.md` and `plan.md` to `~/.fd-plan/<slug>/<topic>/`.

Check that each file exists and contains its required headings. Print what is missing and return to Step 4 if anything is.

Then update `STATE.md`: `topic: <topic>`, `plan_confirmed: true`, `last_action: Task artifacts confirmed and saved`, `next_action: run /flowdeck:fd-review`. After `CONFIRM SKIP` also set `trivial: true`, `skipped_stages: fd-review, fd-verify`, `skip_reason: <the reason you gave>`, and `next_action: run /flowdeck:fd-execute`.

## Step 7: Update checkpoint

Merge into `~/.fd-plan/<slug>/checkpoint.json`. Keep the existing keys and set:

```json
{
  "version": "1",
  "project": "<slug>",
  "topic": "<topic>",
  "current_command": "fd-task",
  "current_stage": "complete",
  "saved_at": "<ISO timestamp>"
}
```

After `CONFIRM SKIP` also add `"trivial": true`.

## Errors

- Empty `$ARGUMENTS`: ask for the task. Do not guess one.
- Mapping fails during init: report and stop.
- User never confirms: write nothing.

## Completion

Report the topic slug, the four artifact paths, requirement count, risk level, and the parallel/sequential split. The CONFIRM in Step 5 was the approval gate for this stage. Once the artifacts are saved and the checkpoint is written, continue straight into the review: invoke the Skill tool with skill `flowdeck:fd-review` and carry on with that stage (after `CONFIRM SKIP`, with skill `flowdeck:fd-execute` instead). If validation failed or the user did not CONFIRM, stop here.
