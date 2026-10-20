---
name: fd-codenav
description: How FlowDeck explores code and measures blast radius. Use when mapping a codebase, finding the callers or dependents of a file or symbol, or checking which files a change affects. LSP first, then Grep, Glob and Read, with Explore for broad sweeps.
user-invocable: false
---

# Code navigation

Use the cheapest tool that answers the question. Do not shell out to `grep`, `find` or `cat` when Grep, Glob and Read exist.

## Order of tools

1. **`LSP`**, when a code-intelligence plugin is active for the language: definition, references, call hierarchy, implementations, document symbols, workspace symbol search.
2. **Grep, Glob, Read** otherwise.
3. **`Explore` subagent** for broad sweeps across independent areas. It is read-only and does not see CLAUDE.md, so put every fact it needs in the prompt. Ask for `quick`, `medium` or `very thorough`.

Check LSP once per task, on one representative file. If the call errors or reports no server, switch to Grep for the rest of the task and say so in your output. Do not retry.

## What to use for what

| Question | LSP | Fallback |
|---|---|---|
| Where is symbol X defined | definition | Grep `class X\|function X\|def X\|fn X\|type X`, scoped by `type` or `glob` |
| Who uses X | references, call hierarchy | Grep `\bX\b`, `output_mode: files_with_matches` first |
| What does this file expose | document symbols | Read the first ~60 lines, then Grep the export or definition keywords |
| What implements interface X | implementations | Grep `implements X\|: X\b\|impl X` |
| Find a symbol by name | workspace symbol search | Grep, then Glob for file names |
| What is in this big file | document symbols, then Read `offset`/`limit` | Grep `-n` for the section, then Read a window |

Read only the lines you need. Use Grep `files_with_matches` or `count` before `content`, and set `head_limit` on content searches.

## Blast radius for a set of files

1. For each file, list its exported or public symbols (LSP document symbols, else Grep the export keywords). Cap at 15 symbols per file, exported first.
2. Find the references to each symbol (LSP references, else Grep `\bsymbol\b`). Collect the distinct referencing files.
3. Grep once per file for its module path and file name. This catches config, docs, build files, string-based and dynamic imports that LSP does not see.
4. Glob for the matching test files (`*.test.*`, `*_test.*`, `test_*`, `*.spec.*`, `tests/`) and note which referencing files are tests.
5. Report: dependents not already in the affected set, which affected files have no test file, and which task pairs share a file.

Import patterns for the Grep fallback: JS/TS `from '…'`, `require('…')`, `import('…')`; Python `import x`, `from x import`; Go the import path string; Rust `use`, `mod`; Java `import` and the fully qualified name.

## What to record

State the source in the artifact: `Source: LSP` or `Source: Grep (text-based; misses dynamic imports and generated code)`. If you capped symbols or stopped early, say so.
