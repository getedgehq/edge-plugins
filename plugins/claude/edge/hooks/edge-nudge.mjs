#!/usr/bin/env node
import { existsSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
// Fails open: without the classifier next to this file, the hook stays quiet.
const { classify } = await import('./edge-classify.mjs').catch(() => ({ classify: () => ({ nudge: false, gate: false }) }));

export const NUDGE = 'Edge\'s local check sees specialist work in this request (writing for an audience, strategy, sales, negotiation, finance, research, design, data, media or a named framework). Before you answer or act, call edge.find_skill once with the user\'s request, load a fitting candidate with use_skill, then do the task. Skip Edge for routine coding and small edits, when the user said not to use it, or if it is unavailable.';
// Funnel Step 1 classifier v2 (hooks/edge-classify.mjs): explicit opt-out,
// trivial bounded operations, chat, simple facts and explanations stay quiet;
// specialist work scored over feature families nudges. The sentence states
// that check and names business and writing work too: the conditional
// "if this task calls for a specialist deliverable" wording let Claude decide a
// LinkedIn post, negotiation prep or cap table was not specialist and skip Edge
// (activation-gap lane, 2026-10-10). The model still makes the final call
// through the skip clause.
export function shouldNudge(prompt) {
  return classify(prompt).nudge;
}

/** EDGE_NUDGE=off silences the hook without uninstalling it. */
export function hookOutput(input, env = process.env) {
  return env.EDGE_NUDGE !== 'off' && shouldNudge(input?.prompt)
    ? { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: NUDGE } }
    : undefined;
}

/** The first nudge of a UTC day leaves one empty marker, nudge-day-YYYY-MM-DD,
 *  in the connector's state directory (src/activation.ts). The local connector
 *  sends it as that day's nudge_fired_day signal (src/presence.ts) and keeps it
 *  as .sent, so later nudges that day write nothing. The name is the only
 *  content: no prompt, score, category or count. Only where a local connector
 *  has created its install id; EDGE_TELEMETRY=0 writes nothing. */
export function markNudgeDay(env = process.env, now = Date.now()) {
  if (['0', 'off', 'false', 'no'].includes(String(env.EDGE_TELEMETRY ?? '').trim().toLowerCase())) return false;
  const dir = env.EDGE_INSTALL_STATE_DIR || join(homedir(), '.config', 'edge');
  if (!existsSync(join(dir, 'install-id'))) return false;
  const marker = join(dir, `nudge-day-${new Date(now).toISOString().slice(0, 10)}`);
  if (existsSync(`${marker}.sent`)) return false;
  try { writeFileSync(marker, '', { flag: 'wx', mode: 0o600 }); }
  catch { return false; }
  // Where no connector sends them (the hosted plugin alone), markers would
  // pile up: a new day's marker clears those older than the connector sends.
  try {
    const oldest = `nudge-day-${new Date(now - 7 * 86_400_000).toISOString().slice(0, 10)}`;
    for (const name of readdirSync(dir)) if (/^nudge-day-\d{4}-\d{2}-\d{2}(\.sent)?$/.test(name) && name.slice(0, 20) < oldest) unlinkSync(join(dir, name));
  } catch { /* housekeeping only */ }
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // No network, prompt logging or child processes; the only file it writes is
  // the empty day marker above. Malformed, oversized or stalled input fails
  // open. Never emit a blocking decision.
  let input = '';
  const finish = () => process.exit(0);
  const timer = setTimeout(finish, 250);
  process.stdin.setEncoding('utf8');
  process.stdin.on('error', finish);
  process.stdout.on('error', finish);
  process.stdin.on('data', chunk => {
    input += chunk;
    if (input.length > 131_072) finish();
  });
  process.stdin.on('end', () => {
    clearTimeout(timer);
    try {
      const output = hookOutput(JSON.parse(input));
      if (output) {
        try { markNudgeDay(); } catch { /* measurement only */ }
        process.stdout.write(JSON.stringify(output) + '\n', finish);
        return;
      }
    } catch { /* Optional advice must never interrupt the user's task. */ }
    finish();
  });
}
