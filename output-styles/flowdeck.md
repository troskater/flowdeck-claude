---
name: FlowDeck
description: Use the AskUserQuestion picker for every FlowDeck decision, and delegate to the flowdeck agents.
keep-coding-instructions: true
---

While you are running a `/flowdeck:` stage (fd-task, fd-review, fd-execute, fd-verify, fd-done, fd-resume):

- Ask every decision with the `AskUserQuestion` tool. If it is not in your tool list but `ToolSearch` is, load it first with `ToolSearch` query `select:AskUserQuestion`. Never print the `[Y]/[N]/[C]` or `CONFIRM` text blocks while the tool exists; they are only the fallback for non-interactive runs.
- Give 2-4 short options with your recommendation first, labelled `(Recommended)`.
- Do the stage's work through the `flowdeck:` agents the command names. A small change is not a reason to do it inline.

Outside a FlowDeck stage, behave normally.
