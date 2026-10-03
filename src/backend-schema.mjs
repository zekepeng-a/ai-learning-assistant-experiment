import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

export function fail(message = 'Invalid input', status = 400) { const e = new Error(message); e.status = status; throw e; }
export function exact(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(k => !Object.hasOwn(value, k))) fail();
}
export function text(value, max, min = 1) {
  if (typeof value !== 'string') fail();
  const result = value.trim();
  if (result.length < min || result.length > max) fail();
  return result;
}
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
export const hash = value => createHash('sha256').update(value, 'utf8').digest('hex');
export function publicUrl(value) {
  const raw = text(value, 2048); let u;
  try { u = new URL(raw); } catch { fail('Invalid public HTTPS URL'); }
  const h = u.hostname.toLowerCase();
  // Literal IPs are conservatively excluded, including IPv6 and numeric aliases.
  if (u.protocol !== 'https:' || u.username || u.password || u.port && u.port !== '443' || isIP(h) || h.includes(':') || !h.includes('.') || h.endsWith('.') || /(^|\.)(localhost|local|internal|test|invalid|example|onion)$/.test(h) || !/^[a-z0-9.-]+$/.test(h)) fail('Invalid public HTTPS URL');
  return u.href;
}
const str = (maxLength = 4000) => ({ type: 'string', minLength: 1, maxLength });
const arr = (items, minItems = 0, maxItems = 24) => ({ type: 'array', items, minItems, maxItems });
const obj = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const refs = () => arr(str(100), 0, 24);
export const planSchema = obj({
  subject: str(200), underlyingLogic: str(8000), coreQuestions: arr(str(2000), 1, 24),
  concepts: arr(obj({ id: str(100), name: str(300), explanation: str(4000), whyItMatters: str(2000), prerequisites: refs(), sourceIds: refs() }), 2, 24),
  steps: arr(obj({ id: str(100), title: str(300), conceptIds: arr(str(100), 1, 24), estimatedHours: { type: 'number', minimum: 0.1, maximum: 160 }, activity: str(4000), deliverable: str(2000), check: str(2000), sourceIds: refs() }), 2, 24),
  misconceptions: arr(obj({ description: str(2000), correction: str(2000), sourceIds: refs() }), 1, 24), limitations: arr(str(2000), 1, 24)
});
export const answerSchema = obj({ answer: str(16000), sourceIds: arr(str(100), 0, 8), limitations: arr(str(2000), 1, 24) });
function shape(v, s) {
  if (s.type === 'object') { exact(v, s.required); for (const k of s.required) shape(v[k], s.properties[k]); }
  else if (s.type === 'array') { if (!Array.isArray(v) || v.length < s.minItems || v.length > s.maxItems) fail(); for (const x of v) shape(x, s.items); }
  else if (s.type === 'string') { text(v, s.maxLength, s.minLength); }
  else if (typeof v !== 'number' || !Number.isFinite(v) || v < s.minimum || v > s.maximum) fail();
}
function unique(values) { if (new Set(values).size !== values.length) fail('Duplicate IDs'); }
function bounded(payload, schema) {
  let encoded; try { encoded = JSON.stringify(payload); } catch { fail(); }
  if (!encoded || Buffer.byteLength(encoded) > 128 * 1024) fail('Output too large');
  const copy = JSON.parse(encoded); shape(copy, schema); return copy;
}
function citations(ids, sources) { unique(ids); if (ids.some(id => !sources.some(s => s.id === id))) fail('Unknown source reference'); }
export function validatePlan(payload, { goal, sources }) {
  const p = bounded(payload, planSchema);
  if (p.subject !== goal.subject) fail('Subject mismatch');
  unique(p.concepts.map(c => c.id)); unique(p.steps.map(s => s.id));
  const concepts = new Map(p.concepts.map(c => [c.id, c]));
  for (const c of p.concepts) { unique(c.prerequisites); citations(c.sourceIds, sources); if (c.prerequisites.some(id => !concepts.has(id) || id === c.id)) fail('Invalid dependency'); }
  const visiting = new Set(), visited = new Set();
  function visit(id) { if (visiting.has(id)) fail('Dependency cycle'); if (visited.has(id)) return; visiting.add(id); for (const dep of concepts.get(id).prerequisites) visit(dep); visiting.delete(id); visited.add(id); }
  for (const id of concepts.keys()) visit(id);
  const covered = new Set();
  for (const step of p.steps) {
    unique(step.conceptIds); citations(step.sourceIds, sources);
    for (const id of step.conceptIds) { if (!concepts.has(id) || concepts.get(id).prerequisites.some(dep => !covered.has(dep) || step.conceptIds.includes(dep))) fail('Prerequisites must precede step'); }
    // Explicit, nontrivial practice, deliverable and verification are required.
    for (const k of ['activity', 'deliverable', 'check']) if (step[k].trim().length < 12 || /^(none|n\/a|tbd|read|study|practice|check)[.! ]*$/i.test(step[k].trim())) fail('Concrete practice and check required');
    for (const id of step.conceptIds) covered.add(id);
  }
  if (covered.size !== concepts.size) fail('Incomplete concept coverage');
  for (const m of p.misconceptions) citations(m.sourceIds, sources);
  return p;
}
export function validateAnswer(payload, sources) { const a = bounded(payload, answerSchema); citations(a.sourceIds, sources); return a; }
