# Compatibility record

Observed behavior, not promises. Add a row when a host, version or install path is exercised.

| Date | Host and version | OS | Install source | Check | Outcome |
| --- | --- | --- | --- | --- | --- |
| 2026-10-19 | Claude Code 2.1.303 | Windows 11, Node 24.19 | Local marketplace (path with spaces), isolated `CLAUDE_CONFIG_DIR` | `claude plugin validate`; marketplace add, install, `plugin details` | Pass: 1 skill, 1 MCP server, ~111 always-on tokens |
| 2026-10-19 | Claude Code 2.1.303 | Windows 11 | `--plugin-dir` on the staged package | One headless turn | Skill fired, `show_diagram` called with status classes and caption |
| 2026-10-19 | Codex CLI 0.163.0 | Windows 11 | Local marketplace, isolated `CODEX_HOME` | `codex plugin marketplace add`, `codex plugin add`, `codex mcp list`, `codex debug prompt-input` | Pass: installed to cache, server registered with cwd = plugin root, skill listed in the model prompt |
| 2026-10-19 | Codex CLI 0.163.0 | Windows 11 | Server attached with `-c mcp_servers…` (no skill) | Two `codex exec` turns | Unprompted: answered with Mermaid in chat. Asked for the board: one correct `show_diagram` call |
| 2026-10-19 | Claude Code 2.1.303 | Windows 11 | GitHub `ossianravn/pele-agent-plugin` @ 15156c8 (private), isolated profile | Marketplace add, install, `plugin details`, installed server started and called | Pass: 2.1 MB install, no `node_modules` |
| 2026-10-19 | Codex CLI 0.163.0 | Windows 11 | GitHub @ 15156c8 (private), isolated `CODEX_HOME` | Marketplace add, `plugin add`, `codex mcp list`, installed server started and called | Pass |
| 2026-10-19 | Headless Chromium (Playwright 1.64) | Windows 11 | Built `dist/` | Board at 1440 and 390 px, light and dark; live update, follow and unread behavior | Pass |

## Not yet exercised

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
- Codex does not install dependencies, so `plugin/dist/` is committed and self-contained.
- Claude Code runs `npm` in a Git-installed plugin whose root has `package.json` and a lockfile, and installs
  devDependencies too: with the plugin at the repository root, a GitHub install pulled 75 MB of build tools.
  The plugin therefore lives in `plugin/`, which has no `package.json`.
