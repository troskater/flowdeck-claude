# FlowDeck for Claude Code

- Bump the version in `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` (same number) on every change that reaches users: patch for fixes and prompt tweaks, minor for new commands, hooks or behavior. Add a `CHANGELOG.md` entry.
- Installed copies live in `~/.claude/plugins/cache/flowdeck-marketplace/flowdeck/<version>`. A new version installs beside the old one; users run `claude plugin update flowdeck` then `/reload-plugins`.
- Run `node --test tests/hooks.test.mjs` and `claude plugin validate . --strict` before committing.
- Edit text files with the Edit/Write tools, not PowerShell `Get-Content | Set-Content` (it corrupts non-ASCII).
- Commit and push only when the user asks.
