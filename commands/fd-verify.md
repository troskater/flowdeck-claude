---
description: FlowDeck pipeline stage. Verify the implementation by running tests, checking regression on affect.md files, then review and security scan; blocks /flowdeck:fd-done on failure. Run only when continuing the pipeline after fd-execute, or when the user names /flowdeck:fd-verify.
argument-hint: [--topic=<slug>]
---

# Verify

Run the verification pipeline for the active topic. `/flowdeck:fd-done` will not close a task until this passes.

**Input:** $ARGUMENTS — optional `--topic=<slug>` to target a topic other than the active one.

Step 4 uses Claude Code's built-in `code-review` and `security-review` skills. This command never runs a substitute of its own.

## Pre-flight

1. `~/.fd-plan/<slug>/STATE.md` must exist. If not: `No planning workspace. Run /flowdeck:fd-task first.`
2. Resolve `<topic>` from `--topic`, else from `topic` in STATE.md.
3. `steps_complete` must not be empty. If it is: `No steps completed yet. Run /flowdeck:fd-execute first.`

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

**Security.** `security-review` diffs `origin/HEAD...`, so it sees only committed work. It also silently receives an empty diff when there is none, and a model will then improvise a review. Guard against that:

1. Run `git rev-parse --verify origin/HEAD`. If it fails, tell the user `git remote set-head origin <default-branch>` fixes it, and ask before running anything.
2. Run `git diff --name-only origin/HEAD...`. It must list the task's changed files. If it is empty because the work is uncommitted, ask the user to commit it on the topic branch (`topic_branch` in `checkpoint.json`).
3. Only then call the Skill tool with skill `security-review`. Check that its output names the files and commits it examined. If those sections are empty, treat the check as **NOT RUN** and discard any review that did not come from the skill's own flow.
4. Any Critical or High finding is blocking.

If the Security check cannot run, its status is **NOT RUN** and the verdict is NOT VERIFIED. The user may accept that risk only by typing `WAIVE`; record the waiver and the reason in `STATE.md`.

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
| Security     | PASS / FAIL / NOT RUN | [summary]      |

Verdict: VERIFIED | NOT VERIFIED
════════════════════════════════════════════════════
```

## No-go conditions (automatic NOT VERIFIED)

- Any test failure
- A CRITICAL security finding
- A CRITICAL review finding
- An affected file with no test coverage
- The Security check is NOT RUN and the user has not typed `WAIVE`

## Step 6: Go or no-go

**VERIFIED:** set STATE.md `status: verified`, `last_action: <topic> verified — all checks passed`, `next_action: run /flowdeck:fd-done`. Then continue straight into closing the task: invoke the Skill tool with skill `flowdeck:fd-done` and carry on with that stage. `fd-done` has its own confirmations for the slop check, the commit message and the push, so nothing is committed or pushed without the user. On **NOT VERIFIED** do not continue: present the options below and stop.

**NOT VERIFIED:** set STATE.md `status: not_verified`, list the failures under `blockers`, and print the required fixes. Then offer:

```
  [1] Fix issues and re-run /flowdeck:fd-verify
  [2] Stop here (no rollback is run automatically)
```

Do not set `status: verified` on a failing run. `/flowdeck:fd-done` refuses to close unless STATE.md says `verified`.

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
