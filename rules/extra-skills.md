# Extra skills protocol

Every stage command runs `fd-state skills <stage>` and follows this file. Nothing printed means no skill is configured. Run `fd-state skills-auto` once: it prints `true` or `false` (the "Auto-approve extra skills" setting).

Handle the skills one at a time, in the order printed:

1. **Approve.** If auto-approve is `false`, ask with AskUserQuestion: "Run <skill> now?" with options Run, Skip, Skip all remaining. Put no audit content in the question. If it is `true`, skip this question and run.
2. **Run.** Invoke the skill with the Skill tool, passing the topic and the path of its `plan.md` as args. Show its output as normal chat text, in full, not inside a question. If the skill is not installed, errors, or is blocked by the edit gate, say so and go to the next skill.
3. **Decide.** If auto-approve is `false`, ask with AskUserQuestion: "<skill> finished. How to proceed?" with options Continue (recommended), Address findings, Stop here. If it is `true`, continue without asking.
   - Continue: go to the next skill, then back to the stage.
   - Address findings: the stage's own text says how. Where it says nothing, offer only Continue and Stop here.
   - Stop here: invoke the `flowdeck:fd-checkpoint` skill to save state, tell the user to continue with `/flowdeck:fd-resume`, and end the stage. Do not run the remaining skills or later steps.
4. **Record.** In the stage report, add a section `Extra skills (advisory)`. Its first line is `Configured: <skills>` or `Configured: none`; when none are configured, stop there. Otherwise list each skill as ran, skipped, or failed, with a one-line summary of its findings and the user's choice.

Findings from extra skills never block the stage or change its outcome. A skill the user declined is not a failure. A skill must not change code outside the plan: report the changes it proposes instead of applying them, unless the user chose Address findings.
