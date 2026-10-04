#!/bin/sh
# MCP headersHelper for the plugin's Edge connector (Claude Code runs it at each
# connection and merges its JSON output into the request headers).
# Sends the install id that `npx @getedge/mcp setup claude` already created, so
# plugin searches belong to that install like the npm connector's do, and
# `npx @getedge/mcp forget` deletes them with the rest. It never creates an id:
# without setup the connector stays session-only, as before.
# Reads one local file; no network, no other files, no logging. Prints {} on
# anything unexpected so the connection never fails because of this script.
# EDGE_INSTALL_HEADER=off stops sending it.
id=
if [ "${EDGE_INSTALL_HEADER:-}" != off ]; then
  dir=${EDGE_INSTALL_STATE_DIR:-${HOME:-}/.config/edge}
  id=$(head -c 64 "$dir/install-id" 2>/dev/null | tr -d ' \t\r\n')
fi
case $id in
  *[!a-f0-9]*) id= ;;
esac
if [ ${#id} -eq 32 ]; then
  printf '{"X-Edge-Install":"%s"}\n' "$id"
else
  printf '{}\n'
fi
exit 0
