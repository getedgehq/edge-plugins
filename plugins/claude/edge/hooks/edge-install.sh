#!/bin/sh
# MCP headersHelper for the plugin's Edge connector (Claude Code runs it at each
# connection and merges its JSON output into the request headers).
# Always sends X-Edge-Transport: plugin_http, a fixed value that tells Edge this
# connection is the plugin's hosted connector (connectorTransport on its events,
# FUNNEL-FIX-PLAN Amendment 17). It carries nothing about the user or machine.
# Also sends the plugin's random install id as X-Edge-Install, so plugin searches
# and free tool credits belong to this install like the npm connector's do, and
# `npx @getedge/mcp forget` deletes them with the rest. The id lives in
# ~/.config/edge/install-id, the same file `npx @getedge/mcp setup` uses: setup's
# id is reused, and without setup the first connection creates one (16 random
# bytes as hex, mode 600, nothing about the machine), the same way setup does.
# Sends the stored first-touch ref (including its visit token) as X-Edge-Ref.
# No network and no logging. Prints only the transport header on anything
# unexpected so the connection never fails because of this script.
# EDGE_INSTALL_HEADER=off stops sending both install and ref, and creates nothing.
id=
ref=
if [ "${EDGE_INSTALL_HEADER:-}" != off ]; then
  dir=${EDGE_INSTALL_STATE_DIR:-${HOME:-}/.config/edge}
  id=$(head -c 64 "$dir/install-id" 2>/dev/null | tr -d ' \t\r\n')
  if [ -z "$id" ] && { [ -n "${EDGE_INSTALL_STATE_DIR:-}" ] || [ -n "${HOME:-}" ]; }; then
    # Create the id once. ln is atomic and never replaces an existing file, so
    # concurrent starts (and a setup running at the same time) end on one id.
    new=$(od -An -tx1 -N16 /dev/urandom 2>/dev/null | tr -d ' \n')
    if [ ${#new} -eq 32 ] && (umask 077; mkdir -p "$dir") 2>/dev/null; then
      tmp="$dir/.install-$$-$new"
      if (umask 077; printf '%s' "$new" > "$tmp") 2>/dev/null; then
        ln "$tmp" "$dir/install-id" 2>/dev/null
        rm -f "$tmp"
      fi
      id=$(head -c 64 "$dir/install-id" 2>/dev/null | tr -d ' \t\r\n')
    fi
  fi
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
