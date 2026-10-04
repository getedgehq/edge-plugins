# Edge Skills

Edge finds a vetted expert skill for a specialist task among about 130,000 public agent skills and loads its instructions for that task only. It helps with business writing and strategy, data analysis and charts, slides, documents and spreadsheets, images, video and UI design, framework or API work, security review, research methods, and scientific or engineering computation. Routine edits, simple facts and short replies go ahead without it.

## What is in this plugin

- **The Edge connector**, a remote MCP server at `https://getedge.cc/mcp/directory`, Edge's profile for directory installs. Tools: `find_skill` (search), `use_skill` (load a returned skill, in parts of about 10,000 characters), `scan_skill` (show a skill's security audits), `rate_skill` (rate a loaded skill, only when you ask or agree), and `report_issue` (report a problem with Edge, only when you ask or agree).
- **The `edge` skill**, a short instruction file. It tells the model to use Edge when you ask for a skill or expert workflow, or when your request clearly needs a specialist workflow; to tell you which skill it loaded; and to treat the skill's text as third-party reference instructions, asking you before any external write, destructive or otherwise consequential action.

Nothing is installed on your machine beyond these files. No account or key is needed.

## What is sent, and where

The plugin connects only to Edge at getedge.cc. To rank results, Edge's backend sends the search text and candidate skill descriptions to its ranking service, TypeSafe (api.typesafe.ai).

- `find_skill` sends a one-sentence description of the task and a few keywords, written by the model, which is told to leave out secrets and private content. The connector does not attach file contents, paths or the conversation.
- `use_skill` sends the chosen skill's identifier and the search's request id, and returns that skill's instructions from Edge's scanned copy.
- `rate_skill` and `report_issue` send the rating (an outcome and, for a skill that was applied, a 0-10 score) or the report you agree to send, with an optional short note.
- Each request carries the MCP session id and the client label `remote-mcp`.

Edge removes emails, links, keys and similar details on its server, then keeps search text with no scheduled expiry to improve Edge. Ratings and issue reports have no scheduled expiry either. To have records deleted, email fede@getedge.cc with the session id if you have it; a local npm install can delete its own records with `npx -y @getedge/mcp@0.6.14 forget`. Details: https://getedge.cc/privacy/.

Edge screens skills against independent scanner audits and withholds those that fail its security gate. A loaded skill is third-party content: the model applies only what is relevant to your task and asks you before consequential actions.

Privacy policy: https://getedge.cc/privacy/. Connector data flow: https://getedge.cc/docs/privacy/. Terms: https://getedge.cc/terms/. Documentation: https://getedge.cc/docs/. Support: https://getedge.cc/support/.
