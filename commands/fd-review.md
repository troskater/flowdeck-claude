---
description: Two-lens review of the plan before execution — CEO review challenges scope and premise, eng review checks architecture, edge cases, and blast radius
argument-hint: [--topic=<slug>]
---

# Review

Review the plan `/flowdeck:fd-task` produced, through two independent lenses, before any code is written.

**Input:** $ARGUMENTS — optional `--topic=<slug>` to review a topic other than the active one.

**Asking.** Every decision in this command is asked with the `AskUserQuestion` tool, and the text layouts shown are only the fallback for when the tool is unavailable (non-interactive runs) or denied. If `AskUserQuestion` is not in your tool list but `ToolSearch` is, load it first with `ToolSearch` query `select:AskUserQuestion`. Use 2-4 short options, your recommendation first and labelled `(Recommended)`; free text arrives as "Other". A typed answer in the form shown (`Y`, `N`, `CONFIRM`, a revision) is equally valid.

Run the two lenses (Steps 2 and 3) as two foreground `Agent` calls (`subagent_type: flowdeck:reviewer`, read-only; one lens per call) sent in the same message so they run in parallel. Omit `model` so they inherit yours: judgment work stays on your model. A lens that did not write the plan does not anchor on it. Each subagent cannot see this conversation, so brief it with the lens text, the topic's `plan.md` path plus the project `architecture.md`, and ask for findings only, each marked blocking or advisory with its evidence. You merge the results into the Step 4 report and handle Step 5 yourself. Delegation is not optional: a small or one-line change is not a reason to do the work yourself, and neither is cost. Fall back only when the `Agent` call itself returned an error, and say so. Then run that lens yourself.

**State writes.** Every change to `STATE.md` or `checkpoint.json` in this command goes through `fd-state`, which is on the Bash PATH while the plugin is enabled: `fd-state set key=value ...` (quote values that contain spaces). It validates the keys and values and renders `state.json`, `STATE.md` and `checkpoint.json` together, so do not edit those files by hand. Where a step below says to update STATE.md or merge into the checkpoint, pass the same keys, leaving out `version`, `project` and `saved_at` (it sets them); append to a list with `steps_complete+=3`. If it rejects a value, fix the value and retry. Only if the `fd-state` command is not found, say so and write the files as the step describes.

**Agent names.** Set the `description` of every `Agent` call to the agent's own name (`researcher`, `coder`, `tester`), followed by what it is working on in parentheses so the user can tell several of the same kind apart: `reviewer (CEO lens)` and `reviewer (Eng lens)`, with the same labels on a re-review. Keep the CEO and Eng names in your own text too. The lens text itself goes in the brief.

## Step 1: Load the plan

Resolve `<topic>` from `--topic`, else from `topic` in `~/.fd-plan/<slug>/STATE.md`. If neither exists, stop and tell the user to run `/flowdeck:fd-task` first.

Check that `~/.fd-plan/<slug>/<topic>/plan.md` exists and contains its required headings (`## Task`: Requirements, Acceptance Criteria; `## Architecture`: Approach, Components; `## Affect`: Affected Files, Risk Level, Parallel Safety; `## Steps`: at least one Wave).

If any is missing or a heading is absent, stop and print:

```
❌ Artifact check failed for topic "<topic>". Fix before review:
  <file or heading missing>
Run /flowdeck:fd-task to regenerate the plan.
```

Otherwise read it. Also read `~/.fd-plan/<slug>/architecture.md` for project-level context. Do not review a partial plan.

If `~/.fd-plan/<slug>/lessons.md` exists, read it and give each lens subagent the lines that match this project's tech stack or the task's area. They are patterns earlier reviews flagged.

## Step 2: CEO review — challenge the premise

Argue with the task, not the code. Answer each question explicitly:

1. **Is this the right problem?** Does solving it move anything that matters, or is it work for its own sake? What happens if we do nothing?
2. **Is this the right approach?** Is there a materially cheaper or simpler way to get the same outcome? Is any part of the scope speculative?
3. **Is the risk acceptable?** Given the risk level in the Affect section, is the payoff worth the blast radius? What is the worst realistic outcome?
4. **Is the scope right?** What in the Task section could be cut without losing the point? What is missing that would make this fail on delivery?

Be direct. If the premise is weak, say so plainly rather than hedging.

## Step 3: Eng review — challenge the design

1. **Architecture quality** — does the Architecture section fit the project-level `architecture.md`? Does it introduce an abstraction used exactly once?
2. **Edge cases** — what inputs, states, or failure modes do the Steps not handle? Check boundaries, empty or absent values, concurrency, and partial failure.
3. **Test coverage** — does every acceptance criterion in the Task section have a step that makes it verifiable? Which steps ship untested behavior?
4. **Blast radius** — cross-check the Affect section against the codebase. Re-run the blast-radius procedure from the `fd-codenav` skill on the affected files, and compare it with the Affect section. Flag any dependent the analysis missed, and any task pair marked **Can Parallel** whose file lists actually overlap. If only Grep was available, say the check is text-based and does not follow transitive or dynamic dependencies.

## Step 4: Surface findings

Present both lenses in one report:

```
════════════════════════════════════════════════════
REVIEW: <topic>
════════════════════════════════════════════════════

CEO LENS
  Right problem:  ✅ | ⚠️  <concern>
  Right approach: ✅ | ⚠️  <concern>
  Risk:           ✅ acceptable | ⚠️  <concern>
  Scope:          ✅ | ⚠️  <cut this / add that>

ENG LENS
  Architecture:   ✅ | ⚠️  <finding>
  Edge cases:     <N> unhandled — <list>
  Test coverage:  <N>/<M> acceptance criteria covered
  Blast radius:   ✅ Affect section accurate | ⚠️  <missed dependency>

────────────────────────────────────────────────────
Blocking findings: <N>
Advisory findings: <N>
════════════════════════════════════════════════════
```

A finding is **blocking** when it would make the implementation wrong, unsafe, or unverifiable. Everything else is advisory.

## Step 5: Confirm or revise

Print:

```
Type CONFIRM to accept this plan and continue to /flowdeck:fd-execute,
or describe the revisions you want.
```

**Wait for the user.** Do not proceed until they respond. **Call `AskUserQuestion` now instead of printing the block above (print it only if the tool is unavailable):** header `Review`, options `Confirm (Recommended)` and `Request revisions` (the revisions arrive as "Other" text); when there are blocking findings add `Accept the risk and continue`, and never treat plain Confirm as accepting them.

- **CONFIRM:** go to Step 6. Record each advisory finding the user accepted as-is.
- **Revisions requested:** apply them to the files under `~/.fd-plan/<slug>/<topic>/`, then re-run Steps 2–4 on the revised set.

Do not move past blocking findings unless the user explicitly accepts the risk. Record that decision in `STATE.md`.

## Step 5b: Capture lessons

After CONFIRM, append the review's recurring patterns to `~/.fd-plan/<slug>/lessons.md` (create it if absent), one line each: `- fd-review (<topic>, <date>): <pattern> — <recommendation>`. Take them from findings of either lens that reflect a habit rather than a one-off, for example scope creep, a wrong-problem premise, an architecture smell or a blast-radius miss. Skip the step if there were none, and never rewrite earlier lines.

## Step 6: Update state and checkpoint

Update `~/.fd-plan/<slug>/STATE.md`:

```
last_action: Review complete — plan confirmed
next_action: run /flowdeck:fd-execute
```

Merge into `~/.fd-plan/<slug>/checkpoint.json`, keeping existing keys and setting:

```json
{
  "current_command": "fd-review",
  "current_stage": "complete"
}
```

## Error handling

- Missing plan or section: name it and `/flowdeck:fd-task` as the remedy. Do not review a partial plan.
- User never confirms: do not change `STATE.md` and do not update the checkpoint.

## Completion

Report blocking and advisory finding counts, any plan sections revised, and any accepted risks. The CONFIRM in Step 5 is also the approval to continue: once the state and checkpoint are written, invoke the Skill tool with skill `flowdeck:fd-execute` and carry on with that stage. If the user did not CONFIRM, stop here.
