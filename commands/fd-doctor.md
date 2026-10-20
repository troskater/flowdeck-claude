---
description: Check that this project has what FlowDeck's built-in review and code-navigation steps need (LSP server, origin/HEAD, test runner). Read-only.
allowed-tools: Read, Glob, Grep, LSP, Bash(git *)
---

Check the current project and report. Change nothing, and do not install or run anything beyond the commands named here.

## 1. Languages
Glob for manifests: `package.json`, `tsconfig.json`, `pyproject.toml`, `requirements.txt`, `Cargo.toml`, `go.mod`, `pom.xml`, `build.gradle*`, `Gemfile`, `composer.json`. List the languages you find.

## 2. LSP (code navigation)
Pick one source file of the main language and make one `LSP` call on it (document symbols). Report **active** or **not active**, and quote the error if there is one. When it is not active, name the code-intelligence plugin and the language-server binary to install:

| Language | Plugin | Binary |
|---|---|---|
| TypeScript, JavaScript | `typescript-lsp` | `typescript-language-server` |
| Python | `pyright-lsp` | `pyright-langserver` |
| Rust | `rust-analyzer-lsp` | `rust-analyzer` |
| Go | `gopls-lsp` | `gopls` |
| Java | `jdtls-lsp` | `jdtls` |
| C, C++ | `clangd-lsp` | `clangd` |
| C# | `csharp-lsp` | `csharp-ls` |
| Kotlin | `kotlin-lsp` | `kotlin-lsp` |
| PHP | `php-lsp` | `intelephense` |
| Ruby | `ruby-lsp` | `ruby-lsp` |
| Swift | `swift-lsp` | `sourcekit-lsp` |
| Lua | `lua-lsp` | `lua-language-server` |

The plugins come from the `claude-plugins-official` marketplace. Without LSP, FlowDeck falls back to Grep and records that in `affect.md`.

## 3. Git (needed by `security-review`)
Run `git rev-parse --is-inside-work-tree`, `git remote -v`, and `git rev-parse --verify origin/HEAD`. Report each. If `origin` exists but `origin/HEAD` does not, say that `git remote set-head origin -a` (needs network) or `git remote set-head origin <default-branch>` fixes it. Without `origin/HEAD`, `/flowdeck:fd-verify` marks the Security check NOT RUN.

## 4. Test runner (needed by `fd-verify`)
Read the manifest and report the test command (`npm test`, `pytest`, `cargo test`, `go test ./...`, or similar), or say none was found.

## 5. FlowDeck state
Say whether `~/.fd-plan/<slug>/` exists (slug is this directory's name) and, if it does, the `current_command` and `current_stage` from its `checkpoint.json`.

End with a short list: what is ready, and what to fix first.
