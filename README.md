# Edge Skills plugins

Edge finds a vetted expert skill for a specialist task among about 130,000 public agent skills and loads its instructions for that task only. This repository holds the Edge plugins for Claude and for Codex and ChatGPT. Each plugin bundles two things: the hosted Edge connector (no account, no key) and a short skill, `edge`, that tells the model when to call it. The Codex and ChatGPT plugin uses `https://getedge.cc/mcp/directory`, Edge's profile for directory installs (conservative tool wording, consent-only ratings and reports, paged skill text). The Claude plugin uses the direct-install profile `https://getedge.cc/mcp`.

| Path | What it is |
|---|---|
| `plugins/claude/edge/` | Claude plugin: `.claude-plugin/plugin.json`, `.mcp.json`, `skills/edge/SKILL.md`, `README.md` |
| `plugins/openai/edge/` | Codex and ChatGPT plugin: `.codex-plugin/plugin.json`, `.mcp.json`, `skills/edge/SKILL.md`, `README.md`, `assets/logo.svg` |
| `.claude-plugin/marketplace.json` | Claude Code marketplace `getedge` |
| `.agents/plugins/marketplace.json` | Codex marketplace `getedge` |

## Install

Claude Code:

```bash
claude plugin marketplace add getedgehq/edge-plugins
claude plugin install edge@getedge
```

Codex:

```bash
codex plugin marketplace add getedgehq/edge-plugins
codex plugin add edge@getedge
```

Claude app and other MCP hosts: add a custom connector with the URL `https://getedge.cc/mcp`.

## What is sent, and where

Each plugin connects only to Edge at getedge.cc. A search sends a one-sentence task description and a few keywords written by the model; it does not attach files, paths or the conversation. To rank results, Edge's backend sends the search text and candidate skill descriptions to its ranking service, TypeSafe (api.typesafe.ai). Loading a skill returns third-party instructions that Edge has screened against scanner audits; read them before running any command they contain. What Edge stores, for how long, and how to delete it: https://getedge.cc/privacy/. Connector data flow: https://getedge.cc/docs/privacy/.

## Support

Open an issue in this repository, or email fede@getedge.cc. Terms: https://getedge.cc/terms/.

## License

MIT, see `LICENSE`.
