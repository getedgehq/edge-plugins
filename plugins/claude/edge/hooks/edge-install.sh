#!/bin/sh
# MCP headersHelper for the plugin's Edge connector (Claude Code runs it at each
# connection and merges its JSON output into the request headers).
# Always sends X-Edge-Transport: plugin_http, a fixed value that tells Edge this
# connection is the plugin's hosted connector (connectorTransport on its events,
# FUNNEL-FIX-PLAN Amendment 17). It carries nothing about the user or machine.
# Also sends the install id that `npx @getedge/mcp setup claude` already created,
# so plugin searches belong to that install like the npm connector's do, and
# `npx @getedge/mcp forget` deletes them with the rest. It never creates an id:
# without setup the connector stays session-only, as before.
# Sends the stored first-touch ref (including its visit token) as X-Edge-Ref.
# Reads only install-id and install-ref; no network and no logging. Prints only the
# transport header on anything unexpected so the connection never fails because
# of this script. EDGE_INSTALL_HEADER=off stops sending both install and ref.
id=
ref=
if [ "${EDGE_INSTALL_HEADER:-}" != off ]; then
  dir=${EDGE_INSTALL_STATE_DIR:-${HOME:-}/.config/edge}
  id=$(head -c 64 "$dir/install-id" 2>/dev/null | tr -d ' \t\r\n')
  ref=$(head -c 42 "$dir/install-ref" 2>/dev/null | tr -d '\r\n')
  # The stored first touch wins; EDGE_REF also works before setup has run.
  ref=${ref:-${EDGE_REF:-}}
fi
case $id in *[!a-f0-9]*) id= ;; esac
case $ref in *[!a-z0-9-]*) ref= ;; esac
if [ ${#ref} -lt 2 ] || [ ${#ref} -gt 40 ]; then ref=; fi
printf '{"X-Edge-Transport":"plugin_http"'
if [ ${#id} -eq 32 ]; then printf ',"X-Edge-Install":"%s"' "$id"; fi
if [ -n "$ref" ]; then printf ',"X-Edge-Ref":"%s"' "$ref"; fi
printf '}\n'
exit 0
