# Compatibility record

Observed behavior, not promises. Add a row when a host, version or install path is exercised.

| Date | Host and version | OS | Install source | Check | Outcome |
| --- | --- | --- | --- | --- | --- |
| 2026-10-19 | Claude Code 2.1.303 | Windows 11, Node 24.19 | Local marketplace (path with spaces), isolated `CLAUDE_CONFIG_DIR` | `claude plugin validate`; marketplace add, install, `plugin details` | Pass: 1 skill, 1 MCP server, ~111 always-on tokens |
| 2026-10-19 | Claude Code 2.1.303 | Windows 11 | `--plugin-dir` on the staged package | One headless turn | Skill fired, `show_diagram` called with status classes and caption |
| 2026-10-19 | Codex CLI 0.163.0 | Windows 11 | Local marketplace, isolated `CODEX_HOME` | `codex plugin marketplace add`, `codex plugin add`, `codex mcp list`, `codex debug prompt-input` | Pass: installed to cache, server registered with cwd = plugin root, skill listed in the model prompt |
| 2026-10-19 | Codex CLI 0.163.0 | Windows 11 | Server attached with `-c mcp_servers…` (no skill) | Two `codex exec` turns | Unprompted: answered with Mermaid in chat. Asked for the board: one correct `show_diagram` call |
| 2026-10-19 | Headless Chromium (Playwright 1.64) | Windows 11 | Built `dist/` | Board at 1440 and 390 px, light and dark; live update, follow and unread behavior | Pass |

## Not yet exercised

- Installing from the GitHub repository in either host. Claude Code runs its own dependency install for Git-hosted
  plugins that ship `package.json` and a lockfile; this package has only devDependencies and needs none at runtime.
- The Codex app's Plugins screen, and the skill triggering in a live Codex turn after a real install.
- macOS and Linux (browser opening uses `open` and `xdg-open`).

## Host facts this package relies on

Checked 2026-10-19 against <https://code.claude.com/docs/en/plugins/manifest-reference>,
<https://developers.openai.com/plugins/build/plugins> and the Codex 0.163.0 source.

- Claude Code reads `.claude-plugin/plugin.json`; the server is declared inline there, not in a root `.mcp.json`,
  which Claude Code would also load as project config when this repository is opened.
- Codex reads root `plugin.json` only when its `$schema` is the Agent Plugins URL, and always reads root `mcp.json`.
  It starts the server with cwd set to the plugin root and does not pass the parent environment through, so the
  board shows no project name under Codex.
- Codex does not install dependencies, so `dist/` is committed and self-contained.
