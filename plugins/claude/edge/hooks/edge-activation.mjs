#!/usr/bin/env node
// Activation measurement for Edge-recommended installed skills (Claude Code,
// PostToolUse; FUNNEL-FIX-PLAN-AGREED-2026-10-04 Amendment 15 points 1-2).
//   find_skill: when the answer presented installed skills (the connector wrote
//     req-<request_id>.json with an opaque id and a keyed name hash for each),
//     this session's open recommendation becomes that request. Any later
//     find_skill closes it, with or without installed skills.
//   Skill, or Read of a SKILL.md: when the invoked or read skill is one the open
//     recommendation presented, within 30 minutes of it, writes one
//     applied-<request_id>-<candidate_id>.json marker. The connector process that
//     made the request sends only those two ids and how (skill or read).
// Names are compared as keyed hashes; nothing here stores a name, a path, a
// description or prompt text. No network, no output, no logging. Any error,
// malformed or oversized input fails open. EDGE_ACTIVATION_HOOK=off turns it off.
import { closeSync, mkdirSync, openSync, readFileSync, readSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Same values as src/local-activation.ts (a test keeps them in step). */
export const ACTIVATION_WINDOW_MS = 30 * 60 * 1000;
export const DEFAULT_DIR = process.env.EDGE_ACTIVATION_DIR?.trim() || join(tmpdir(), 'edge-activation');
export const nameKey = name => createHash('sha256').update(`edge-local-skill\0${String(name).trim().toLowerCase()}`).digest('hex').slice(0, 32);

const FIND_SKILL = /^mcp__.*edge.*__find_skill$/;
const REQUEST_ID = /^[\w-]{1,32}$/;
const CANDIDATE_ID = /^lc[a-f0-9]{10}$/;

export function enabled(env = process.env) {
  return env.EDGE_ACTIVATION_HOOK !== 'off';
}

function sessionFile(sessionId, dir) {
  if (typeof sessionId !== 'string') return undefined;
  const safe = sessionId.replace(/[^\w-]/g, '_').slice(0, 128);
  return /[A-Za-z0-9]/.test(safe) ? join(dir, `sess-${safe}.json`) : undefined;
}

/** The request_id a find_skill answer printed, from the tool response. */
export function requestIdOf(response) {
  const raw = (typeof response === 'string' ? response : JSON.stringify(response ?? '')).slice(0, 200_000);
  const text = raw.replace(/\\"/g, '"');
  const match = text.match(/request_id(?:"\s*:\s*"| "|: )([\w-]{1,32})/);
  return match && REQUEST_ID.test(match[1]) ? match[1] : undefined;
}

function readJson(path) {
  try {
    const text = readFileSync(path, 'utf8');
    return text.length > 16_384 ? undefined : JSON.parse(text);
  } catch { return undefined; }
}

/** `name:` from a SKILL.md's frontmatter, reading at most 4 KiB. */
function frontmatterName(path) {
  let fd;
  try {
    fd = openSync(path, 'r');
    const buffer = Buffer.alloc(4096);
    const head = buffer.subarray(0, readSync(fd, buffer, 0, 4096, 0)).toString('utf8');
    const block = head.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const name = block?.[1].match(/^name:[ \t]*["']?([^"'\n]+?)["']?[ \t]*$/m)?.[1];
    return name || undefined;
  } catch { return undefined; } finally {
    if (fd !== undefined) try { closeSync(fd); } catch { /* ignore */ }
  }
}

/** The names under which a tool call applied an installed skill, or []. */
export function appliedNames(input) {
  const tool = input.tool_name;
  const args = input.tool_input && typeof input.tool_input === 'object' ? input.tool_input : {};
  if (tool === 'Skill') {
    const skill = typeof args.skill === 'string' ? args.skill.trim() : typeof args.command === 'string' ? args.command.trim() : '';
    if (!skill || skill.length > 200) return [];
    // A plugin skill is invoked as plugin:skill; the installed name is the last part.
    return [...new Set([skill, skill.split(':').pop()])].filter(Boolean);
  }
  if (tool === 'Read') {
    const path = typeof args.file_path === 'string' ? args.file_path : '';
    if (!/(^|[\\/])SKILL\.md$/i.test(path) || path.length > 4096) return [];
    return [...new Set([basename(dirname(path)), frontmatterName(path)])].filter(Boolean);
  }
  return [];
}

/** Handles one PostToolUse event; returns what it recorded, for tests. */
export function handle(input, { env = process.env, dir = DEFAULT_DIR, now = Date.now() } = {}) {
  if (!enabled(env) || !input || typeof input !== 'object' || input.hook_event_name !== 'PostToolUse') return undefined;
  const pointer = sessionFile(input.session_id, dir);
  if (!pointer) return undefined;
  const tool = typeof input.tool_name === 'string' ? input.tool_name : '';
  if (FIND_SKILL.test(tool)) {
    // Any new search closes the previous recommendation of this session.
    try { unlinkSync(pointer); } catch { /* none open */ }
    const requestId = requestIdOf(input.tool_response);
    if (!requestId) return { closed: true };
    const request = readJson(join(dir, `req-${requestId}.json`));
    if (!request || request.request_id !== requestId) return { closed: true };
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const temp = `${pointer}.${process.pid}.tmp`;
    writeFileSync(temp, JSON.stringify({ request_id: requestId, at: now }), { mode: 0o600 });
    renameSync(temp, pointer);
    return { opened: requestId };
  }
  const names = appliedNames(input);
  if (!names.length) return undefined;
  const open = readJson(pointer);
  if (!open || typeof open.request_id !== 'string' || !REQUEST_ID.test(open.request_id)) return undefined;
  const request = readJson(join(dir, `req-${open.request_id}.json`));
  if (!request || request.request_id !== open.request_id || !Array.isArray(request.candidates)) return undefined;
  if (typeof request.at !== 'number' || now - request.at > ACTIVATION_WINDOW_MS || now < request.at) return undefined;
  const keys = new Set(names.map(nameKey));
  const hit = request.candidates.find(c => c && CANDIDATE_ID.test(c.id) && keys.has(c.key));
  if (!hit) return undefined;
  const via = tool === 'Skill' ? 'skill' : 'read';
  try {
    // 'wx': one marker per candidate and request, never overwriting.
    writeFileSync(join(dir, `applied-${open.request_id}-${hit.id}.json`), JSON.stringify({ request_id: open.request_id, candidate_id: hit.id, via, at: now }), { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error?.code === 'EEXIST') return { duplicate: hit.id };
    throw error;
  }
  return { applied: hit.id, via };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let input = '';
  const finish = () => process.exit(0);
  const timer = setTimeout(finish, 1500);
  process.stdin.setEncoding('utf8');
  process.stdin.on('error', finish);
  process.stdin.on('data', chunk => {
    input += chunk;
    if (input.length > 4_194_304) finish();
  });
  process.stdin.on('end', () => {
    clearTimeout(timer);
    try { handle(JSON.parse(input)); } catch { /* measurement only: never interrupt the task */ }
    finish();
  });
}
