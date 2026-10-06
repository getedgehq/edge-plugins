# Edge Skills

Edge finds a vetted expert skill for a specialist task among about 130,000 public agent skills and loads its instructions for that task only. It helps with business writing and strategy, data analysis and charts, slides, documents and spreadsheets, images, video and UI design, framework or API work, security review, research methods, and scientific or engineering computation. Routine edits, simple facts and short replies go ahead without it.

## What is in this plugin

- **The Edge connector**, the `@getedge/mcp` npm package (exact version pinned in `.mcp.json`), which Claude Code starts on your machine with `npx`. It needs Node.js 20 or newer. It is the same connector as the npm route, so if you opt in it can rank your installed skills alongside the catalog (`npx -y @getedge/mcp setup claude --local-skills on`; `EDGE_LOCAL_SKILLS_EXCLUDE` keeps chosen skills out). Tools: `find_skill` (search), `use_skill` (load a returned skill), `scan_skill` (show a skill's security audits), `rate_skill` (say whether a loaded skill helped), and `report_issue` (report a problem with Edge; `feedback` is its old name).
- **The `edge` skill**, a short instruction file. Its description tells the model when to call Edge: at the start of a specialist task, once. Its body says to read the result, load a clearly fitting skill, and otherwise continue without Edge. If the connector is missing, it tells you how to add it.

- **In Claude Code, two small hooks.** On a prompt that looks like specialist work, one adds a fixed sentence asking the model to check Edge first (set `EDGE_NUDGE=off` to silence it). The other, off unless `EDGE_VALUE_HOOK=on`, shows which skill Edge loaded. Neither sends anything anywhere.
- **In Claude Code, an activation hook** (`hooks/edge-activation.mjs`). Only when Edge recommended one of your installed skills and Claude then uses or reads it, it writes a local marker; the connector reports two opaque ids, never the skill name. It sends nothing itself. `EDGE_ACTIVATION_HOOK=off` turns it off.
- **Install ID.** The connector keeps a random install ID in `~/.config/edge/install-id` (created on first start, as with the npm route), so your searches belong to that install and `npx @getedge/mcp forget` deletes them.

In the Claude app, adding `Before specialist work, call Edge's find_skill.` to your personal preferences makes Claude check Edge reliably.

Beyond these files, `npx` downloads the pinned `@getedge/mcp` package into your npm cache on first start. No account or key is needed.

## What is sent, and where

The plugin connects only to Edge at getedge.cc, plus the npm registry when npx fetches the connector package. To rank results, Edge's backend sends the search text and candidate skill descriptions to its ranking service, TypeSafe (api.typesafe.ai).

- `find_skill` sends a one-sentence description of the task and a few keywords, written by the model, which is told to leave out secrets and private content. The connector does not attach file contents, paths or the conversation.
- `use_skill` sends the chosen skill's identifier and the search's request id, and returns that skill's instructions from Edge's scanned copy.
- `rate_skill` and `report_issue` send the rating (an outcome and, for a skill that was applied, a 0-10 score) or the report you agree to send, with an optional short note.
- Each request carries a random session id, the install ID described above, the connector version, the client name and version, and, from the connector release that adds it, `transport: plugin_stdio`. The privacy policy describes what Edge stores.

Edge screens skills against independent scanner audits and withholds those that fail its security gate. Read a loaded skill's commands before running them.

Privacy policy (connector): https://getedge.cc/docs/privacy/. Website privacy notice: https://getedge.cc/privacy/. Terms: https://getedge.cc/terms/. Documentation and support: https://getedge.cc/docs/.
