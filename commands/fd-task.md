---
description: Define a task end to end — auto-init the workspace, map the codebase, confirm requirements, and save one plan.md (task, architecture, affect, steps)
argument-hint: <task description>
---

# Task

Pipeline entrypoint. Turns a task description into the confirmed `plan.md` every later stage reads.

**Input:** $ARGUMENTS — the task description. REQUIRED.

**Asking.** Every decision in this command is asked with the `AskUserQuestion` tool, and the text layouts shown are only the fallback for when the tool is unavailable (non-interactive runs) or denied. If `AskUserQuestion` is not in your tool list but `ToolSearch` is, load it first with `ToolSearch` query `select:AskUserQuestion`. Use 2-4 short options, your recommendation first and labelled `(Recommended)`; free text arrives as "Other". A typed answer in the form shown (`Y`, `N`, `CONFIRM`, a revision) is equally valid.

If `$ARGUMENTS` is empty, ask the user for a task description before doing anything else. Do not guess or infer the task.

Codebase mapping runs in the read-only `flowdeck:mapper` agent, following the `fd-map` skill. Research (Step 2) goes to `flowdeck:researcher`, and the design and plan drafts (Step 4) to `flowdeck:architect` and `flowdeck:planner`. Those agents are read-only and cannot see this conversation: brief each with the task, the evidence and answers so far, the paths it needs and the template it must fill. You write the files, after CONFIRM.

**State writes.** Every change to `STATE.md` or `checkpoint.json` in this command goes through `fd-state`, which is on the Bash PATH while the plugin is enabled: `fd-state set key=value ...` (quote values that contain spaces). It validates the keys and values and renders `state.json`, `STATE.md` and `checkpoint.json` together, so do not edit those files by hand. Where a step below says to update STATE.md or merge into the checkpoint, pass the same keys, leaving out `version`, `project` and `saved_at` (it sets them); append to a list with `steps_complete+=3`. If it rejects a value, fix the value and retry. Only if the `fd-state` command is not found, say so and write the files as the step describes.

**Agent names.** Set the `description` of every `Agent` call to the agent's own name (`researcher`, `coder`, `tester`), followed by what it is working on in parentheses when one stage runs several of the same kind (`researcher (query 1)`, `researcher (query 2)`). Anything else about the query or step goes in the brief.

**Models.** Before the first `Agent` call in this command, run `fd-state models <main>` once, where `<main>` is the model you are running on (for example `opus`, or your full model id). It prints `agent=model` pairs from the user's FlowDeck settings (`/config`: agent models and per-agent overrides). Pass that model as the `model` parameter of every `Agent` call to that agent. If the command fails or prints nothing, leave `model` out so the agent inherits your model.

## Step 1: Auto-init

`<fd>/` is the directory `fd-state path` prints, the same one the hooks use: `~/.fd-plan/<project>/` (named after the git top-level folder), or `<project>/.fd-plan/` when the storage setting is `project`. Planning state lives in `<fd>/`.

If `<fd>/` does not exist:
1. Create it, then write `STATE.md` immediately so an interrupted session can resume:
   ```
   status: in_progress
   plan_confirmed: false
   last_action: fd-task started
   next_action: complete fd-task steps
   ```
2. Write `checkpoint.json` with `"current_command": "fd-task"` and `"current_stage": "in_progress"`.
3. Map the codebase with an `Agent` call: `subagent_type` `flowdeck:mapper`, `description` `mapper`, `model` the mapper model from Models, and the prompt "Map the codebase in <project root>. Follow the steps in ${CLAUDE_PLUGIN_ROOT}/skills/fd-map/SKILL.md and return the summary it describes." If that call errors, invoke the `fd-map` skill through the Skill tool instead. Write the summary to `<fd>/architecture.md`. This file is project-level context. It is not the task's design: Step 6 writes the task's own `architecture.md` under `<topic>/`.

If codebase mapping fails, report the failure and stop. A task planned against an unmapped codebase is not trustworthy.

If `<fd>/architecture.md` already exists, do not overwrite it. Read it instead.

## Step 1b: Enter plan mode

With the workspace initialized and mapped, call `EnterPlanMode` (load it first with `ToolSearch` query `select:EnterPlanMode,ExitPlanMode` if it is not in your tool list). Steps 2-4 then run read-only, which suits them: research, questions and the agents' drafts write nothing. `AskUserQuestion` and the read-only agents still work in plan mode. Step 5 ends it with `ExitPlanMode`.

If the tool is missing (non-interactive runs), is refused, or the user declines to enter, carry on without plan mode and use the Step 5 fallback. Do not write `STATE.md`, `checkpoint.json` or `plan.md` until Step 6; they are not needed before it.

## Step 2: Research gate

Derive 3-5 research queries from the task. Each should target a different area: existing implementation, affected modules, dependencies, prior decisions.

Present them and wait. Ask with the tool as described after the block; print the block only as the fallback:

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

Do not continue until the user answers. **Call `AskUserQuestion` now instead of printing the block above (print it only if the tool is unavailable):** header `Research`, options `Run these queries (Recommended)`, `Skip research`, `Custom queries`, with the numbered queries in the question text.

- **Y:** send the queries to one foreground `Agent` call with `subagent_type: flowdeck:researcher` (for 4-5 independent queries, split them across parallel calls in the same message), briefed with the task, the queries and the paths of `architecture.md` and the prior `<fd>/*/plan.md` files. It follows the `fd-codenav` skill's guidance, reads `CLAUDE.md` / `AGENTS.md` if present, and returns evidence per query. Summarize in 3-5 bullets. Delegation is not optional: a small or one-line change is not a reason to do the work yourself, and neither is cost. Fall back only when the `Agent` call itself returned an error, and say so. Then run the queries yourself.
- **N:** log "Research skipped by user." and add `Note: created without codebase research — may need revision.` under `### Constraints` in `plan.md`.
- **C:** ask for the queries one per line, use them exactly as given, then run them as in Y.

## Step 3: Clarify, one question at a time

Ask clarifying questions **one at a time**. Do not batch them. Each is one `AskUserQuestion` call whose options are the realistic answers you found in the code (for example the two plausible behaviors), your recommendation first; an open-ended question has options only if real alternatives exist, otherwise ask it in text.

Skip a question if:
1. Its answer is already in `architecture.md`, a prior topic's `plan.md`, or `STATE.md`
2. Its answer follows from the tech stack or existing patterns
3. It was already answered this session

Record each skipped question and its evidence for the Task section of `plan.md`.

Before proposing a new component, grep for an existing one. If one exists, extend it, and note it under "Alternatives Considered" as `<name> — reused existing <component> instead of building new.`

Cover, in order, skipping what research already settled: scope (and what is out of scope), constraints, acceptance criteria, risks.

## Step 4: Draft the plan

Draft the whole plan before showing anything. It is one file, `plan.md`, with four sections. Every claim must trace to Step 2 evidence or a Step 3 answer. Do not guess.

Write the Task section yourself, since it holds the user's answers. Then call `Agent` with `subagent_type: flowdeck:architect`, briefed with the Task section, the research bullets, the project `architecture.md` and the Architecture and Affect templates below; it returns both sections. Then call `Agent` with `subagent_type: flowdeck:planner`, briefed with the three sections and the Steps and Parallel Safety templates; it returns the steps, the Parallel Safety lists and the effort estimate. Review what they return against the rules below, fix mismatches, and assemble the sections into the template. Delegation is not optional: a small or one-line change is not a reason to do the work yourself, and neither is cost. Fall back only when the `Agent` call itself returned an error, and say so. Then draft that part yourself.

```md
# Plan: <title>

**Created:** <ISO timestamp>

## Task

### Requirements
- R-01: <requirement>

### Out of Scope
- <item>

### Acceptance Criteria
- [ ] <verifiable criterion>

### Constraints
- <constraint>

### Open Questions
- <item, or "none">

### Suppressed Questions
- "<question>" → answered by: <evidence source>

## Architecture

### Approach
<the chosen design, one paragraph>

### Components
- <component>: <responsibility>

### Data Flow
<how the pieces connect>

### Alternatives Considered
- <alternative> — rejected because <reason>

## Affect

Generated: <ISO timestamp>
Source: LSP | Grep (text-based; misses dynamic imports and generated code)

### Affected Files
- path/to/file (modify|create|delete)

### Affected Systems
- <system>: <reason>

### Risk Level
low | medium | high

### Parallel Safety
#### Can Parallel
- Step A: [file1, file2]
#### Must Sequential
- Step C (depends on A): [file1, file3]

## Steps

### Wave 1
- [ ] Step 1: <action> (traces: R-01) — files: [file1]

### Wave 2
- [ ] Step 2: <action> (traces: R-02) — files: [file1, file3]
```

Find the affected files and their dependents by following the blast-radius procedure in the `fd-codenav` skill, and fill in the `Source:` line honestly. Every step appears exactly once under Can Parallel or Must Sequential. A step goes under Must Sequential if its files overlap another step's files or it depends on one. Risk is `high` for security, schema or breaking changes, `medium` for shared modules or public API, otherwise `low`.

Every step traces to at least one `R-XX`. Steps in the same wave do not depend on each other.

**Effort estimate:** 1-3 files, low risk, 1 wave ≈ 30 min. 4-10 files, low/medium, 1-2 waves ≈ 2-4 h. 10+ files, high risk, or 3+ waves ≈ 1 day+. Add 50% if 3+ systems are affected. Show it with the plan.

**Trivial check.** The task is trivial only if it is a rename, typo, config value or version bump, touches at most 2 files, is `low` risk, has a single wave and changes no behavior. If so, propose the shortcut with the plan: `fd-task -> fd-execute -> fd-done`, skipping `fd-review` and `fd-verify`, with the reason stated. The user decides; never apply it on your own.

## Step 4b: Extra skills

Run `fd-state skills task`. It prints the extra skills the user configured for this stage (`/config`, "Extra skills per stage"), one per line; nothing printed means none. Invoke each one in order with the Skill tool, passing the topic and the path of its `plan.md` as args. Run them after the drafts are assembled and before the CONFIRM, so the user sees the findings before approving; show the section with the plan in Step 5. Always include a section `Extra skills (advisory)` in the report, even when none are configured. Its first line is `Configured: <skills from fd-state skills task>` or `Configured: none`, so the user can see this step ran; when none are configured, stop there. Otherwise add one line per finding with the skill name. These findings never block the stage or change its outcome. If a skill is not installed, errors, or is blocked by the edit gate, say so in that section and carry on.

## Step 5: Confirm

**In plan mode** (Step 1b): call `ExitPlanMode` with the whole `plan.md` draft as the plan (all four sections, plus the effort estimate). The user's approval is the CONFIRM. Feedback on a rejected plan is the requested changes: stay in plan mode and return to Step 4. Approval may change the session's permission mode; leave it as the user set it. For a trivial task, once approved, ask with `AskUserQuestion` (header `Pipeline`): `Run the full pipeline (Recommended)` or `Skip review/verify`, which counts as `CONFIRM SKIP`. Then go to Step 6.

**Without plan mode**, present the plan, then print:

```
Ready to save this plan?
Type CONFIRM to save, or describe changes needed.
```

For a trivial task add: `Trivial task: skip fd-review and fd-verify? Type CONFIRM SKIP to save and skip them, CONFIRM to save and run the full pipeline.`

**Call `AskUserQuestion` now instead of printing the block above (print it only if the tool is unavailable):** header `Plan`, options `Confirm (Recommended)` and `Request changes` (the changes arrive as "Other" text); for a trivial task a third option `Confirm and skip review/verify`, which counts as `CONFIRM SKIP`. Show the plan in your message first, since the question text is short.

Do not write any file before CONFIRM. On requested changes, return to Step 4.

## Step 6: Save

Derive `<topic>` as a lowercase, hyphenated slug of the task title. Write `plan.md` to `<fd>/<topic>/`.

Check that it exists and contains its required headings: `## Task` with `### Requirements` and `### Acceptance Criteria`; `## Architecture` with `### Approach` and `### Components`; `## Affect` with `### Affected Files`, `### Risk Level` and `### Parallel Safety`; `## Steps` with at least one `### Wave`. Print what is missing and return to Step 4 if anything is.

Then update `STATE.md`: `topic: <topic>`, `plan_confirmed: true`, `last_action: Plan confirmed and saved`, `next_action: run /flowdeck:fd-review`. After `CONFIRM SKIP` also set `trivial: true`, `skipped_stages: fd-review, fd-verify`, `skip_reason: <the reason you gave>`, and `next_action: run /flowdeck:fd-execute`.

## Step 7: Update checkpoint

Merge into `<fd>/checkpoint.json`. Keep the existing keys and set:

```json
{
  "version": "1",
  "project": "<slug>",
  "topic": "<topic>",
  "current_command": "fd-task",
  "current_stage": "complete"
}
```

After `CONFIRM SKIP` also add `"trivial": true`.

## Errors

- Empty `$ARGUMENTS`: ask for the task. Do not guess one.
- Mapping fails during init: report and stop.
- User never confirms (or rejects the plan): write nothing.

## Completion

Report the topic slug, the `plan.md` path, requirement count, risk level, and the parallel/sequential split. The CONFIRM in Step 5 was the approval gate for this stage. Once the plan is saved and the checkpoint is written, continue straight into the review: invoke the Skill tool with skill `flowdeck:fd-review` and carry on with that stage (after `CONFIRM SKIP`, with skill `flowdeck:fd-execute` instead). If validation failed or the user did not CONFIRM, stop here.
