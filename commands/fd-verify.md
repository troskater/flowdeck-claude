---
description: Verify the implementation — run tests, check regression on affect.md files, review and scan; blocks /flowdeck:fd-done on failure
argument-hint: [--topic=<slug>]
---

# Verify

Run the verification pipeline for the active topic. `/flowdeck:fd-done` will not close a task until this passes.

**Input:** $ARGUMENTS — optional `--topic=<slug>` to target a topic other than the active one.

Run this as the orchestrator. Use the `reviewer` and `security-auditor` agents for Step 4.

## Pre-flight

1. `~/.fd-plan/<slug>/STATE.md` must exist. If not: `No planning workspace. Run /flowdeck:fd-task first.`
2. Resolve `<topic>` from `--topic`, else from `topic` in STATE.md.
3. `steps_complete` must not be empty. If it is: `No steps completed yet. Run /flowdeck:fd-execute first.`

## Step 1: Tests

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

Find dependents the plan missed: Grep for each affected file's module path or exported symbol names, and check that the files that reference them have passing tests. Log any dependent that `affect.md` did not list as a planning gap. This check is text-based and does not catch dynamic imports.

If `affect.md` is missing, skip this step, record that the regression scope is unknown, and mark the verdict NOT VERIFIED.

## Step 4: Review and scan

- **Review** (`reviewer` agent): over the files changed since the task began. Check security, quality, conventions, and test coverage of at least 80% for changed files. Below that is a HIGH finding.
- **Security** (`security-auditor` agent): over the same files. No hardcoded secrets, input validated at trust boundaries, auth on protected routes, and no CRITICAL or HIGH vulnerabilities.

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
| Security     | PASS / FAIL       | [summary]          |

Verdict: VERIFIED | NOT VERIFIED
════════════════════════════════════════════════════
```

## No-go conditions (automatic NOT VERIFIED)

- Any test failure
- A CRITICAL security finding
- A CRITICAL review finding
- An affected file with no test coverage

## Step 6: Go or no-go

**VERIFIED:** set STATE.md `status: verified`, `last_action: <topic> verified — all checks passed`, `next_action: run /flowdeck:fd-done`.

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
