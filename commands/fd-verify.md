---
description: FlowDeck pipeline stage. Verify the implementation by running tests, checking regression on affect.md files, then review and security scan; blocks /flowdeck:fd-done on failure. Run only when continuing the pipeline after fd-execute, or when the user names /flowdeck:fd-verify.
argument-hint: [--topic=<slug>]
---

# Verify

Run the verification pipeline for the active topic. `/flowdeck:fd-done` will not close a task until this passes.

**Input:** $ARGUMENTS — optional `--topic=<slug>` to target a topic other than the active one, and `--security=on|off` to answer the security question below without being asked.

Step 4 uses Claude Code's built-in `code-review` and `security-review` skills. This command never runs a substitute of its own.

## Pre-flight

1. `~/.fd-plan/<slug>/STATE.md` must exist. If not: `No planning workspace. Run /flowdeck:fd-task first.`
2. Resolve `<topic>` from `--topic`, else from `topic` in STATE.md.
3. `steps_complete` must not be empty. If it is: `No steps completed yet. Run /flowdeck:fd-execute first.`

## Security audit: ask first

Unless STATE.md already has `security_check` (a re-run keeps the earlier answer) or `--security` was given, ask once before running anything:

```
Run the security audit as part of verification?
It uses Claude Code's built-in security-review: slower and costlier than the other checks, and it needs the work committed on a branch plus an origin/HEAD ref.
[Y] yes (recommended)
[N] skip it: the verdict can still be VERIFIED, but nobody has checked for injection, auth gaps or leaked secrets, and fd-done will say so.
```

Wait for the answer, then record `security_check: on` or `security_check: skipped` in STATE.md. Step 4 runs the security part only when it is `on`.

## Model

Your own model is the ceiling for anything you delegate. If you are running on Opus, run Steps 1-3 in one foreground `Agent` call with `model: "sonnet"` and have it return the raw results (test output, coverage per file, unlisted dependents); you keep Step 4 and the verdict. On any other model, run the steps yourself.

## Step 1: Tests

Read the stage rules listed in the "FlowDeck rules" section of the session context first (testing, security, language patterns). Judge Step 4 against them.

Detect the runner from the project manifest: `npm test` or `bun test` for Node, `cargo test` for Rust, `pytest` for Python, `go test ./...` for Go. Run the full suite.

All tests must pass, with no failures and no unexplained skips.

If no runner is configured, say so explicitly and fail the check: `No test script found — cannot verify. Configure a test runner before /flowdeck:fd-done.` Never pass by default.

## Step 2: Browser tests

Only for web projects (a frontend framework in the manifest, or `public/index.html`):
- Playwright configured (`playwright.config.*` exists): run the E2E suite and include the result in the verdict.
- Web project without Playwright: note that UI behavior is unverified. Do not fail the verdict for this.
- Not a web project: skip.

## Step 3: Regression scope

Read `~/.fd-plan/<slug>/<topic>/affect.md` and take the Affected Files list as the regression scope.

For each affected file, confirm it has test coverage. An uncovered changed file is a HIGH finding.

Find dependents the plan missed by following the blast-radius procedure in the `fd-codenav` skill, and check that the files that reference each affected file have passing tests. Log any dependent that `affect.md` did not list as a planning gap. If only Grep was available, say the check is text-based and does not catch dynamic imports.

If `affect.md` is missing, skip this step, record that the regression scope is unknown, and mark the verdict NOT VERIFIED.

## Step 4: Review and scan

**Review.** Call the Skill tool with skill `code-review` and args `high`. Never pass `ultra`, `--fix` or `--comment`. Any confirmed bug or CRITICAL/HIGH finding is blocking. The review does not measure coverage: judge the 80% target for changed files from the Step 1 test results, and treat a miss as a HIGH finding.

**Security.** If `security_check` is `skipped`, do not run it: its status is **SKIPPED (by choice)**. Otherwise: `security-review` diffs `origin/HEAD...`, so it sees only committed work. It also silently receives an empty diff when there is none, and a model will then improvise a review. Guard against that:

1. Run `git rev-parse --verify origin/HEAD`. If it fails, tell the user `git remote set-head origin <default-branch>` fixes it, and ask before running anything.
2. Run `git diff --name-only origin/HEAD...`. It must list the task's changed files. If it is empty because the work is uncommitted, ask the user to commit it on the topic branch (`topic_branch` in `checkpoint.json`).
3. Only then call the Skill tool with skill `security-review`. Check that its output names the files and commits it examined. If those sections are empty, treat the check as **NOT RUN** and discard any review that did not come from the skill's own flow.
4. Any Critical or High finding is blocking.

If the Security check was chosen but cannot run, its status is **NOT RUN** and the verdict is NOT VERIFIED. Tell the user what is missing and offer: fix the setup, or switch to skipping (set `security_check: skipped` and record the reason in STATE.md).

## Step 5: Report

```
════════════════════════════════════════════════════
VERIFICATION: <topic>
════════════════════════════════════════════════════

| Check        | Status            | Details            |
|--------------|-------------------|--------------------|
| Tests        | PASS / FAIL       | N/N passed         |
| Browser E2E  | PASS / N/A        | [or: not configured] |
| Regression   | PASS / FAIL       | [uncovered files]  |
| Code review  | PASS / FAIL       | [summary]          |
| Security     | PASS / FAIL / NOT RUN / SKIPPED | [summary] |

Verdict: VERIFIED | VERIFIED (security skipped) | NOT VERIFIED
════════════════════════════════════════════════════
```

## No-go conditions (automatic NOT VERIFIED)

- Any test failure
- A CRITICAL security finding
- A CRITICAL review finding
- An affected file with no test coverage
- The Security check was chosen and is NOT RUN (a deliberate skip is not a no-go)

## Step 6: Go or no-go

**VERIFIED** (including "security skipped"): set STATE.md `status: verified`, `last_action: <topic> verified — all checks passed`, `next_action: run /flowdeck:fd-done`. Then continue straight into closing the task: invoke the Skill tool with skill `flowdeck:fd-done` and carry on with that stage. `fd-done` has its own confirmations for the slop check, the commit message and the push, so nothing is committed or pushed without the user. On **NOT VERIFIED** do not continue: present the options below and stop.

**NOT VERIFIED:** set STATE.md `status: not_verified`, list the failures under `blockers`, and print the required fixes. Then run the fix loop below. Do not set `status: verified` on a failing run.

### Fix loop (up to 2 attempts, no prompt)

The gate is open in `VERIFY`, so fix the problems yourself rather than asking. Upstream only offers this as a manual option; the automatic loop is a deliberate addition.

Fix automatically: failing tests, confirmed review bugs and CRITICAL/HIGH findings, security Critical/High findings, and affected files with no test (write the test). Do not fix automatically, and stop the loop: no test runner, security NOT RUN, missing `affect.md`, or a fix that needs a change outside `plan.md`'s scope or a new requirement.

Per attempt:
1. Fix each blocker at its root cause, test first for a bug.
2. If `topic_branch` is set, commit the fix: `git add` only the files you changed, `git commit -m "fd(<topic>): verify fix <n>"`. Never push.
3. Re-run Step 1 (full suite) and every check that failed. Re-run `code-review` and, if enabled, `security-review` whenever code changed, since a fix can introduce new findings.
4. Print the Step 5 table again and say what attempt this was.

If the verdict is now VERIFIED, continue as above. Stop the loop early if an attempt leaves the same failures unchanged. After the second failed attempt, or on an early stop, offer:

```
  [1] Fix issues yourself (or tell me what to try) and re-run /flowdeck:fd-verify
  [2] Stop here (no rollback is run automatically)
``` `/flowdeck:fd-done` refuses to close unless STATE.md says `verified`.

## Step 7: Checkpoint

Merge into `~/.fd-plan/<slug>/checkpoint.json`:

```json
{
  "current_command": "fd-verify",
  "current_stage": "VERIFY",
  "topic": "<topic>",
  "saved_at": "<ISO timestamp>"
}
```

On a passing verdict, set `current_stage: complete`. On a failing verdict, set `current_stage: failed`. Keep `VERIFY` while fixes are still possible, since the gate allows edits in `VERIFY`.

## Error handling

- STATE.md missing: point to `/flowdeck:fd-task`.
- Test runner missing: report with the remedy. Do not pass.
- Partial failure during a check: do not update STATE.md. Report and stop.

## Completion

Report the verdict, per-check status and required fixes. Next step: `/flowdeck:fd-done` on pass, `/flowdeck:fd-execute` to fix.
