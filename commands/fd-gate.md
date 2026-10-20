---
description: Turn FlowDeck's edit gate and tool guard off or on for this project, or show their state
argument-hint: off | on | status
allowed-tools: Read, Write
---

`<slug>` is the current project directory name. Input: $ARGUMENTS

The gate (blocks code edits until EXECUTE or VERIFY) and the tool guard (blocks secret reads, `node_modules` writes, `rm -rf`) both read `~/.fd-plan/<slug>/gate.json`. This command is the only thing that writes it.

- `off`: write `{"enabled": false, "changed_at": "<ISO timestamp>"}` to `~/.fd-plan/<slug>/gate.json`. Say that FlowDeck no longer blocks anything in this project, and that `/flowdeck:fd-gate on` restores it. The pipeline commands still run.
- `on`: write `{"enabled": true, "changed_at": "<ISO timestamp>"}`.
- `status` or no argument: read the file and report `off` if `enabled` is `false`, otherwise `on`. Change nothing.

Any other argument: print the usage line above and change nothing.
