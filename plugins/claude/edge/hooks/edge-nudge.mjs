#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

export const NUDGE = 'If this task calls for a specialist deliverable or workflow, call edge.find_skill before starting and compare its candidates with local skills; skip it for routine coding and small edits. If Edge is unavailable, continue locally.';
// A request to produce or analyse something (a deliverable), not a small edit,
// a quick question or a reply. The model makes the final call; the sentence is
// conditional. Activation plan C, 2026-10-02: tuned on evals/activation-trigger
// prompts.json and heldout.json, measured once on heldout2.json.
const DELIVERABLE = /\b(?:design|create|build|make|write|rewrite|draft|develop|produce|generate|prepare|put (?:it |this |them )?together|whip up|come up with|review|audit|analy[sz]e|analysis|research|investigate|compare|plan|forecast|plot|chart|visuali[sz]e|migrate|optimi[sz]e|secure|animate|edit|polish|redesign|improve|turn|threat[- ]model|check\b.*\bfor|set up|fit|estimate|validate|outline|cut|export)\b/i;
const SMALL_EDIT = /^(?:please\s+|can you\s+|could you\s+)?(?:(?:fix|correct) (?:this |the |a )?(?:typo|spelling)|rename\b|delete\b|remove (?:the )?(?:unused|extra|duplicate|trailing)|bump\b|sort\b|format\b|move (?:the )?\S+(?: \S+)? (?:link |button |item )?(?:before|after|above|below)|add (?:a |an )?(?:comment|print|log|console\.log|docstring|todo|import|newline|semicolon)|(?:change|make) (?:the )?(?:\S+ )?(?:button |error |footer |header )?(?:text|message|label|title|colou?r|font size)\b|change (?:the )?(?:button )?text\b)/i;
const QUESTION = /^(?:what|how|why|when|where|who|which|is|are|does|do)\b[^.!]*\?$/i;
const FILE = /\.(?:csv|xlsx?|parquet|ipynb|pptx?|key|mp4|mov|webm|fig|tf)\b|\b(?:xlsx|docx|pptx|pdf|parquet)\b/i;

export function shouldNudge(prompt) {
  if (typeof prompt !== 'string') return false;
  const text = prompt.trim().slice(0, 32_768);
  if (text.length < 12 || text.split(/\s+/, 5).length < 4) return false;
  if (/^(?:hi|hello|hey|thanks|thank you|ok|okay|yes|no)\b[^.?!]{0,30}[.!?\s]*$/i.test(text)) return false;
  if (/^(?:stop\b|(?:can you )?repeat\b|summari[sz]e .*\b(?:conversation|session)\b|(?:what is|tell me) (?:your |the )?(?:status|progress)\b)/i.test(text)) return false;
  // A short explanation or a mechanical edit stays quiet; an explicit second
  // work request after it is evaluated on its own.
  const followup = text.split(/\b(?:and then|then|also)\b/i).slice(1).join(' ');
  const simple = SMALL_EDIT.test(text) || QUESTION.test(text) ||
    /^(?:please\s+)?(?:what (?:does|is)\b|explain (?:this|the difference)\b|(?:show|give me) (?:the |a )?(?:git )?command\b|how do i (?:undo|revert|list)\b)/i.test(text);
  if (simple) return Boolean(followup && DELIVERABLE.test(followup));
  return DELIVERABLE.test(text) || FILE.test(text);
}

/** EDGE_NUDGE=off silences the hook without uninstalling it. */
export function hookOutput(input, env = process.env) {
  return env.EDGE_NUDGE !== 'off' && shouldNudge(input?.prompt)
    ? { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: NUDGE } }
    : undefined;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // No network, filesystem reads, prompt logging or child processes. Malformed,
  // oversized or stalled input fails open. Never emit a blocking decision.
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
      if (output) { process.stdout.write(JSON.stringify(output) + '\n', finish); return; }
    } catch { /* Optional advice must never interrupt the user's task. */ }
    finish();
  });
}
