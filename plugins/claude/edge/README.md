# Edge Skills

Edge finds a vetted expert skill for a specialist task among about 130,000 public agent skills and loads its instructions for that task only. It helps with business writing and strategy, data analysis and charts, slides, documents and spreadsheets, images, video and UI design, framework or API work, security review, research methods, and scientific or engineering computation. Routine edits, simple facts and short replies go ahead without it.

## What is in this plugin

- **The Edge connector**, a remote MCP server at `https://getedge.cc/mcp`. Tools: `find_skill` (search), `use_skill` (load a returned skill), `scan_skill` (show a skill's security audits), `rate_skill` (say whether a loaded skill helped), and `report_issue` (report a problem with Edge; `feedback` is its old name).
- **The `edge` skill**, a short instruction file. Its description tells the model when to call Edge: at the start of a specialist task, once. Its body says to read the result, load a clearly fitting skill, and otherwise continue without Edge. If the connector is missing, it tells you how to add it.

- **Starter skills, ready on first use.** Short pointer files for skills that have an Edge evidence record with a measured win (same model with and without the skill, on several tasks of the kind). Each one only says when it applies and which skill to load; the skill itself still loads through `use_skill` from Edge's scanned copy, so you always get the current, screened version. Today: `pitch-deck` (`getedgehq/skills@pitch-deck`, 8 of 8 seed decks for real companies won against the same model without it), for making a new startup or investor pitch deck.

- **In Claude Code, two small hooks.** On a prompt that looks like specialist work, one adds a fixed sentence asking the model to check Edge first (set `EDGE_NUDGE=off` to silence it). The other, off unless `EDGE_VALUE_HOOK=on`, shows which skill Edge loaded. Neither sends anything anywhere.
- **In Claude Code, a headers helper** (`hooks/edge-install.sh`). It adds a random install ID from `~/.config/edge/install-id` to the connector's requests, so your searches and free tool credits (LinkedIn, Instagram and company data) belong to that install and `npx @getedge/mcp forget` deletes them. If you ran Edge setup (`npx @getedge/mcp setup claude`) it reuses that ID; otherwise the first connection creates one the same way setup does (16 random bytes, readable only by you, nothing about your machine). Set `EDGE_INSTALL_HEADER=off` to stop it; then nothing is created or added.

In the Claude app, adding `Before specialist work, call Edge's find_skill.` to your personal preferences makes Claude check Edge reliably.

Nothing is installed on your machine beyond these files. No account or key is needed.

## What is sent, and where

The plugin connects only to Edge at getedge.cc. To rank results, Edge's backend sends the search text and candidate skill descriptions to its ranking service, TypeSafe (api.typesafe.ai).

- `find_skill` sends a one-sentence description of the task and a few keywords, written by the model, which is told to leave out secrets and private content. The connector does not attach file contents, paths or the conversation.
- `use_skill` sends the chosen skill's identifier and the search's request id, and returns that skill's instructions from Edge's scanned copy.
- `rate_skill` and `report_issue` send the rating (an outcome and, for a skill that was applied, a 0-10 score) or the report you agree to send, with an optional short note.
- Each request carries the MCP session id and the client label `remote-mcp`, and in Claude Code the install ID described above. The privacy policy describes what Edge stores.

Edge screens skills against independent scanner audits and withholds those that fail its security gate. Read a loaded skill's commands before running them.

Privacy policy (connector): https://getedge.cc/docs/privacy/. Website privacy notice: https://getedge.cc/privacy/. Terms: https://getedge.cc/terms/. Documentation and support: https://getedge.cc/docs/.
