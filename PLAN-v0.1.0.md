# Wrap-up plan: v0.1.0

Goal: close out the port at a version we can describe honestly. Everything below is a proposal until marked done; items marked **(decide)** need Troy's call.

## 0. Done already
- `target/` deleted (369 MB, gitignored, nothing tracked).
- Gaps closed earlier: tool guard, autosave, `fd-status --all`, per-step suite run, `/fd-gate`, optional security audit, auto-fix loop, model policy, `DIFFERENCES.md`.

## 1. Verify what was never run
| Check | How |
|---|---|
| `/fd-checkpoint`, `/fd-resume`, `/fd-doctor` | Run once each on a throwaway project; fix what breaks |
| `Stop` autosave hook fires in the VS Code panel | Check `saved_at` changes after a turn |
| `fd-gate off/on`, tool guard, `--security`/`--fix` flags | One pipeline run with flags, one without |
| Shortened prompts vs upstream: `fd-resume` (60 vs 75 lines), `fd-checkpoint` (53 vs 67), `fd-review` (120 vs 167), `fd-done` (164 vs 208) | Diff each against upstream; list every dropped behavior; restore or document |
| LSP path | Optional. Install a language-server plugin once and compare the `affect.md` `Source:` line |

## 2. Gaps to fill (decide which)
Cheap and worth doing:
- **Trivial-task shortcut** (`fd-task -> fd-execute -> fd-done`, skip is logged). Small prompt change plus a gate rule.
- **`CONSTRAINTS.md` check** in `tool-guard.mjs` (upstream feature).
- **Lesson capture** in `fd-review` step 5b. Decide where lessons live: `~/.fd-plan/<slug>/` as upstream does, or Claude's memory.
- **Desktop notification** when a stage needs input or finishes, via the `Notification`/`Stop` hook events. **(decide)** whether wanted in the VS Code panel at all.

Probably skip (record as not ported):
- UI design-first gating: needs a design-handoff flow we do not have.
- `--override`: the edit gate is already switchable with `/fd-gate`, and there are no other guards to override.
- Context-window monitor: Claude Code auto-compacts.
- Per-step review: per-wave `code-review` is the deliberate trade.

## 2b. Subagent delegation (in 0.1.0)
- `fd-execute`: one foreground `Agent` per step (or wave) for plans over about 3 steps, on every model (no `model` set, so it inherits and never exceeds the session). Brief = step text, acceptance cases, files, rules paths, TDD instructions. Result contract = files changed, test result, open questions. The main agent re-runs the suite before marking a step complete and asks the user any returned question.
- `fd-verify`: test/regression run and each auto-fix attempt go to a subagent that returns only failures and a fix summary. Replaces the Opus-only delegation.
- `fd-review`: CEO and eng lenses as two parallel fresh-context agents; main agent merges findings and handles CONFIRM.
- Not adding planner/architect/researcher agents. Tester-agent for RED tests: not in 0.1.0.
- Measured 2026-10-20 (`claude -p`, opus session, sonnet subagent): a general-purpose subagent starts at about 97k tokens, almost all of it Troy's setup (skills, agents, tools); about 70% was a cache read on runs 2 and 3, and about 28k was newly cached each run. Explore starts at about 61k. So delegation is not free per call and pays off for noisy or long steps, not tiny ones. Hence the "over about 3 steps" threshold.
- Verified: the tool guard (`rm -rf` block) fires inside a subagent.
- Verified: two parallel foreground Explore agents in one message both returned in-turn (2 spawned, 2 completed). Built 2026-10-20 in fd-execute, fd-verify, fd-review. Still to check: the edit gate inside a subagent, and a real pipeline run with delegation.

## 3. State files: what Claude covers vs what is needed
See the discussion section below; the outcome decides whether this phase has work.

## 4. Documentation
- Move the "Compared with upstream" content from `DIFFERENCES.md` into a README section so users see it without hunting: *what is missing*, *what is different*, *what was added*.
- Add `CHANGELOG.md` starting at 0.1.0.
- Refresh `HANDOFF.md` (stale: mentions `target/`, version, the open list).

## 5. Release
- Bump `plugin.json` and `.claude-plugin/marketplace.json` to `0.1.0`. Installed copies are keyed by version, so an unchanged number can hide updates.
- **Versioning rule from now on:** every change that reaches users bumps the version (patch for fixes and prompt tweaks, minor for new commands, hooks or behavior). Write the rule in a repo `CLAUDE.md` so every session follows it, and add a test that fails when `plugin.json` and `marketplace.json` disagree.
- Run `claude plugin validate . --strict`, the hook tests, tag `v0.1.0`, push.

## 6. Backlog (pinned, not in 0.1.0)
- **Parallel worktree waves for `fd-execute`**: foreground `Agent` calls with `isolation: "worktree"` for steps marked Can Parallel, orchestrator merges, pause on conflict, `.claude/worktrees/` added to the target project's `.gitignore`. Spike already showed the worktree call works.
- **Skills audit**: the 30 copied skills overlap ECC and other skills in Troy's setup (tdd-workflow, git-workflow, security-scan and others). ECC is specific to Troy's machine, so do this in a separate session with the real skill list. **Reminder: raise this next session.**
- Deterministic state writer, only if drift shows up in use.

---

## Discussion: state files

Two files today, both under `~/.fd-plan/<slug>/`, both written by the model:

- `checkpoint.json`: `current_command`, `current_stage`, `topic`, `topic_branch`, `last_wave`, `saved_at`, `blockers`.
- `STATE.md`: `key: value` lines: `status`, `topic`, `plan_confirmed`, `steps_complete`, `last_action`, `next_action`, `security_check`, `auto_fix`.

**Evidence of drift.** The existing `~/.fd-plan/*` folders (from upstream and our own runs) show it: one `STATE.md` has a duplicate `status:` key, another is free-form bullets, one `checkpoint.json` has only three keys. Nothing validates either file.

**What Claude Code already covers**
- Conversation history and resume (`/resume`), and auto-compaction. These keep the *conversation* across sessions.
- Task lists within a session.
- Project memory (`CLAUDE.md`, auto-memory) for durable facts.
- Git for what changed.

**What it does not cover, so what is actually needed**
1. **The stage, readable by a hook.** The edit gate must decide in milliseconds, in a fresh process, without a model. That needs a small machine-readable file: `checkpoint.json` stays.
2. **Plan progress across sessions** (`steps_complete`, `topic`, `plan_confirmed`, confirmation of the review). A new session has none of this unless it is on disk.
3. **User choices** (`security_check`, `auto_fix`, `topic_branch`) so a re-run does not re-ask.

What is *not* needed: `last_action` / `next_action` prose (it duplicates what `/fd-status` computes and what the transcript shows), per-phase maps, `worktrees`, and a second file that overlaps the first.

**Options**
- **A. Keep both, tighten the prompts.** Lowest effort. Drift stays possible.
- **B. Merge into one `state.json`** with a fixed key list, written by a small Node helper (`node hooks/state.mjs set key=value ...`) that validates keys and merges. The commands call it instead of hand-editing. Removes the duplicate file, the format drift and the "merge, never replace" caveat; the hooks read the same file. Cost: a migration for existing `STATE.md` / `checkpoint.json` (read old, write new), and one more script to test. Windows quoting is the risk (the earlier `` !`cmd` `` spike failed on paths with spaces), so the helper must be called through the Bash tool with simple arguments, not injected into prompts.
- **C. Keep `STATE.md` human-readable but generated** from `state.json` by the helper, for users who want to read it. Optional on top of B.

**Recommendation:** B, with C only if you want a readable file. It is the one place where a few lines of deterministic code replace prompt text that has demonstrably drifted. It does change the file layout, so it would be its own minor version (0.2.0) rather than part of this wrap-up; for 0.1.0 do option A: fix duplicate keys, state the required key list in one place, and have `fd-doctor` warn on a malformed file.
