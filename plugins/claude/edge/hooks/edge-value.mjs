#!/usr/bin/env node
// PostToolUse hook on Edge's use_skill (Claude Code plugin). The host, not the
// model, shows the user which skill Edge loaded: `systemMessage` is rendered in
// the transcript as a notice. The model is asked only for the part it alone can
// know, the concrete change the skill made, as the last line of its answer.
// Off unless EDGE_VALUE_HOOK=on: in lane levers (V3) it raised the line in the
// final answer from 50% to 79% but cut rate_skill calls to 3% and did not reach
// the default-on bar (REPORT-levers.md).
// No network, no file access, no logging. Malformed input fails open (no output).
import { pathToFileURL } from 'node:url';

const LOADED = /Loaded ([\w.-]+\/[\w.-]+)@([\w.:-]+) for this task only/;

export function loadedSkill(input) {
  if (!input || typeof input !== 'object' || !/^mcp__.*edge.*__use_skill$/.test(String(input.tool_name || ''))) return undefined;
  const text = typeof input.tool_response === 'string' ? input.tool_response : JSON.stringify(input.tool_response ?? '');
  const match = text.slice(0, 4096).match(LOADED);
  if (!match || input.tool_input?.file) return undefined;
  return { source: match[1], skill: match[2] };
}

export function valueContext(skill) {
  return `Edge already showed the user that ${skill} was loaded. After the deliverable, end your chat answer with one line: '⚡ Edge · ${skill}: <specific observed change(s)>'. Name 1 to 3 concrete changes this skill made to your answer that you directly applied, with counts and constraints when available, and no evaluative adjectives unless measured. Write it in the user's language, once per task, never inside files, code or JSON you deliver. Leave it out if you did not apply the skill or the user asked to hide Edge summaries. This replaces any other Edge closing-line instruction.`;
}

export function hookOutput(input, env = process.env) {
  if (env.EDGE_VALUE_HOOK !== 'on') return undefined;
  const loaded = loadedSkill(input);
  if (!loaded) return undefined;
  return {
    systemMessage: `⚡ Edge · loaded ${loaded.skill} (${loaded.source}) for this task`,
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: valueContext(loaded.skill) },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let input = '';
  const finish = () => process.exit(0);
  const timer = setTimeout(finish, 1000);
  process.stdin.setEncoding('utf8');
  process.stdin.on('error', finish);
  process.stdout.on('error', finish);
  process.stdin.on('data', (chunk) => { input += chunk; if (input.length > 4_000_000) finish(); });
  process.stdin.on('end', () => {
    clearTimeout(timer);
    try {
      const output = hookOutput(JSON.parse(input));
      if (output) { process.stdout.write(JSON.stringify(output) + '\n', finish); return; }
    } catch { /* The value line is optional; never interrupt the task. */ }
    finish();
  });
}
