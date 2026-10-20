---
name: fd-map
description: Maps the current project's tech stack, module layout, entry points, conventions and dependencies in a read-only subagent. FlowDeck's fd-task calls this once to build the project-level architecture summary.
context: fork
agent: flowdeck:mapper
background: false
user-invocable: false
---

Map the codebase in the current working directory. Report only what you can see in the files. Do not guess, and do not write or edit anything.

1. Read the package and build manifests (`package.json`, `pyproject.toml`, `requirements.txt`, `Cargo.toml`, `go.mod`, `pom.xml`, `build.gradle`, and similar) for the stack, versions and dependencies.
2. Glob the source tree (`src/`, `app/`, `lib/`, `cmd/`, or whatever the project uses) to get the module layout. Ignore `node_modules`, `target`, `dist`, `build`, `.git` and vendored code.
3. Find the entry points: the main files, server or CLI bootstraps, route tables, and scripts in the manifest.
4. Note the conventions you can see: naming, layering, where tests live and what runner they use, lint and format config.
5. If an LSP tool is available, use its document symbols to outline large entry-point files. Otherwise Read with `offset` and `limit`, or Grep the definition keywords. Do not read whole large files.

Return a Markdown summary with these sections, citing a file path for each claim:

## Tech stack
## Module layout
## Entry points
## Conventions
## External dependencies
## Test setup
## Unknown

Put anything you could not determine under Unknown. Do not pad the other sections.
