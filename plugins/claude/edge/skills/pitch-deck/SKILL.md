---
name: pitch-deck
description: "Use when asked to make a new startup pitch deck, seed deck or investor pitch deck for a named company or the user's startup. Not for reviewing or critiquing an existing deck, sales or customer decks, team, school or conference slides, converting deck files, or investor emails, updates, memos and financial models."
---

# pitch-deck (Edge starter skill)

Making a new startup pitch deck, seed deck or investor pitch deck for a company.

This file is a pointer: the skill's instructions load through Edge, once, from its security-scanned copy of `getedgehq/skills@pitch-deck`. Edge measured it on 8 seed decks for real companies against the same model without it: 8 wins (real brand, fonts and logo, every number traced to a source; without it, placeholders and invented numbers).

Before doing the task:
1. Call Edge's `find_skill` with `query` = the user's request (generic, no names or private details), `selected_source` = `getedgehq/skills` and `selected_skill` = `pitch-deck`.
2. Call Edge's `use_skill` with `source` = `getedgehq/skills`, `skill` = `pitch-deck` and the `request_id` returned in step 1.
3. Follow the loaded instructions to do the task, then call Edge's `rate_skill` as Edge asks.

Edge's tools are `mcp__plugin_edge_edge__find_skill`, `mcp__plugin_edge_edge__use_skill` and `mcp__plugin_edge_edge__rate_skill` with this plugin (`mcp__edge__*` when Edge was added with `claude mcp add`). If they are not in your tool list yet, load them through tool search ("edge find_skill"). This covers the Edge search for this task: do not search Edge again.
If `find_skill` is unavailable, call `use_skill` with `source` = `getedgehq/skills` and `skill` = `pitch-deck` instead.
If Edge is unavailable or the load fails, say so in one line and continue without it.
