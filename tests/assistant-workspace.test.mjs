import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { createBackendServer } from '../src/backend-server.mjs';
import { DeepSeekProvider } from '../src/deepseek-provider.mjs';
import { planSchema, answerSchema, validatePlan } from '../src/backend-schema.mjs';

const goal = { subject: '<img src=x onerror=alert(1)> 植物学', objective: '解释生长与环境的关系', level: 'BEGINNER', weeklyHours: 2 };
function fixture(subject, sourceIds) {
  return { subject, underlyingLogic: 'TEST: structures support functions.', coreQuestions: ['How does structure affect growth?'], concepts: ['structure', 'growth'].map((id, i) => ({ id, name: id, explanation: 'A foundational explanation for testing.', whyItMatters: 'Connect observations to a testable explanation.', prerequisites: i ? ['structure'] : [], sourceIds })), steps: ['structure', 'growth'].map(id => ({ id, title: id, conceptIds: [id], estimatedHours: 1, activity: 'Draw two observed examples and compare their structure.', deliverable: 'Two annotated drawings with a comparison.', check: 'Compare labels and observations against the supplied reference.', sourceIds })), misconceptions: [{ description: 'All observations are equivalent.', correction: 'Distinguish the conditions of observation.', sourceIds }], limitations: ['TEST only, unverified.'] };
}
async function start(dbFile, modelProvider) {
  const server = createBackendServer({ dbFile, modelProvider }); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const request = (path, { method = 'GET', body, headers = {} } = {}) => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path, method, agent: false, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers } }, res => { const chunks = []; res.on('data', c => chunks.push(c)); res.on('error', reject); res.on('end', () => { const text = Buffer.concat(chunks).toString(); resolve({ status: res.statusCode, headers: res.headers, text, body: res.headers['content-type']?.startsWith('application/json') ? JSON.parse(text) : undefined }); }); }); req.on('error', reject); req.setTimeout(3000, () => req.destroy(new Error('HTTP test timeout'))); req.end(body === undefined ? undefined : JSON.stringify(body));
  });
  return { server, request, close: async () => { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); server.backend.close(); } };
}
test('workspace real HTTP assets, immutable histories, read-only answers, recovery and reopen', async () => {
  const dir = mkdtempSync(join(resolve('.'), '.assistant-workspace-')); const dbFile = join(dir, 'workspace.sqlite'); let running; const calls = [];
  const modelProvider = { metadata: { id: 'workspace-test', model: 'fixture', mode: 'TEST' }, async generate(input) { calls.push(input.kind); return input.kind === 'PLAN' ? fixture(input.goal.subject, input.sources.map(s => s.id)) : { answer: '<script>unsafe()</script> Advisory TEST answer.', limitations: ['Needs independent checking.'], sourceIds: input.sources.map(s => s.id) }; } };
  try {
    running = await start(dbFile, modelProvider); let request = running.request;
    for (const [path, file, mime] of [['/', 'assistant.html', 'text/html'], ['/assistant.js', 'assistant.js', 'text/javascript'], ['/assistant.css', 'assistant.css', 'text/css'], ['/styles.css', 'styles.css', 'text/css']]) { const r = await request(path); assert.equal(r.status, 200); assert.ok(r.headers['content-type'].startsWith(mime)); assert.equal(r.text, readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8')); for (const directive of ["default-src 'self'", "connect-src 'self'", "script-src 'self'", "style-src 'self'", "font-src 'self'", "base-uri 'none'", "frame-ancestors 'none'", "form-action 'self'"]) assert.ok(r.headers['content-security-policy'].includes(directive)); }
    assert.deepEqual(calls, []);
    for (const path of ['/../package.json', '/%2e%2e/package.json', '/.env', '/.data/backend.sqlite', '/src/backend.mjs', '/index.html', '/assistant.js?x=1', '/public/assistant.html']) assert.equal((await request(path)).status, 404);
    assert.equal((await request('/', { headers: { Host: 'evil.invalid' } })).status, 403);
    const post = (path, body, headers) => request(path, { method: 'POST', body, headers });
    for (const headers of [{ Origin: 'https://evil.invalid' }, { 'Sec-Fetch-Site': 'cross-site' }]) { const r = await post('/api/v1/goals', goal, headers); assert.equal(r.status, 403); assert.equal(r.headers['access-control-allow-origin'], undefined); }
    const g = (await post('/api/v1/goals', goal)).body, base = `/api/v1/goals/${g.id}`;
    const source = (await post(`${base}/sources`, { title: '<svg onload=bad()> Source', url: 'https://www.wikipedia.org/botany', text: 'Original pasted text.' })).body;
    const p = (await post(`${base}/plans`, { sourceIds: [source.id] })).body; assert.equal(p.provider.mode, 'TEST'); assert.equal(p.grounding, 'PINNED_SOURCES');
    const path = `/api/v1/plans/${p.id}`;
    assert.equal((await post(`${path}/activities`, { kind: 'PRACTICE', stepId: 'structure', note: 'Drew examples', assisted: true })).status, 201);
    const answer = (await post(`${path}/ask`, { question: 'Why does this matter?' })).body;
    const before = running.server.backend.store.db.prepare('SELECT count(*) AS n FROM events').get().n;
    assert.deepEqual((await request(`${path}/answers`)).body, [answer]); assert.equal((await request('/api/v1/plans/missing/answers')).status, 404); assert.equal((await post(`${path}/answers`, {})).status, 404);
    assert.equal(running.server.backend.store.db.prepare('SELECT count(*) AS n FROM events').get().n, before); assert.deepEqual(calls, ['PLAN', 'ANSWER']);
    const p2 = (await post(`${base}/plans`, { sourceIds: [] })).body; assert.equal(p2.revision, 2); assert.notEqual(p2.id, p.id); assert.deepEqual((await request(path)).body, p);
    running.server.backend.modelProvider = { ...modelProvider, generate: async () => { throw new Error('private provider detail'); } };
    const failed = await post(`${base}/plans`, { sourceIds: [] }); assert.equal(failed.status, 502); assert.ok(!failed.text.includes('private provider')); assert.equal((await request(`${base}/plans`)).body.length, 2);
    await running.close(); running = await start(dbFile); request = running.request;
    assert.deepEqual((await request('/api/v1/goals')).body, [g]); assert.deepEqual((await request(path)).body, p); assert.deepEqual((await request(`${path}/answers`)).body, [answer]);
    const progress = (await request(`${path}/progress`)).body; assert.equal(progress.counts.PRACTICE, 1); assert.equal(progress.mastery, 'UNPROVEN'); assert.equal((await request('/api/v1/model-info')).body.configured, false);
    assert.equal((await request(`${base}/plans`, { method: 'POST', body: { sourceIds: [] } })).status, 503);
  } finally { if (running) await running.close(); assert.ok(dir.startsWith(resolve('.') + sep)); rmSync(dir, { recursive: true, force: true }); }
});

test('workspace uses text DOM, bounded fetch and required accessible controls', () => {
  const script = readFileSync(new URL('../public/assistant.js', import.meta.url), 'utf8'), html = readFileSync(new URL('../public/assistant.html', import.meta.url), 'utf8');
  assert.doesNotMatch(script, /innerHTML|outerHTML|insertAdjacentHTML|\beval\s*\(|new\s+Function/); assert.match(script, /textContent/); assert.match(script, /135000/);
  for (const id of ['goal-form', 'subject', 'objective', 'level', 'weekly-hours', 'generate-plan', 'plan-version', 'step-select', 'mark-exposure', 'activity-form', 'activity-note', 'assisted', 'save-activity', 'ask-form', 'question', 'ask-submit', 'add-source-form', 'source-title', 'source-url', 'source-text', 'add-source']) assert.ok(html.includes(`id="${id}"`), id);
  assert.doesNotMatch(html, /<script(?![^>]*src=)|\son\w+=|type="password"/); assert.match(html, /aria-live="polite"/);
});

test('DeepSeek curriculum ordering guidance preserves strict validation and advisory answer shape', async () => {
  const plan = fixture(goal.subject, []), answer = { answer: 'Advisory TEST answer.', sourceIds: [], limitations: ['TEST only.'] };
  const provider = new DeepSeekProvider({ apiKey: 'synthetic-test-only', fetch: async (_, options) => {
    const { messages } = JSON.parse(options.body), input = JSON.parse(messages[1].content);
    const guidance = messages[0].content;
    for (const rule of [/Teach every concept exactly once/, /conceptIds must contain exactly one ID/, /Order steps topologically/, /prerequisites must be taught in earlier steps/, /Never put previously taught concepts, prerequisite IDs or a cumulative review list in conceptIds/, /earlier knowledge in activity prose/, /For kind ANSWER only: return exactly answer, sourceIds and limitations/, /must not add plan fields to answers/]) assert.match(guidance, rule);
    return new Response(JSON.stringify({ model: 'deepseek-flash', choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(input.kind === 'PLAN' ? plan : answer) } }] }));
  } });
  const input = { kind: 'PLAN', goal, sources: [], plan: null, question: null, schema: planSchema };
  const result = await provider.generate(input);
  assert.deepEqual(validatePlan(result, { goal, sources: [] }), plan);
  const cumulativeReview = structuredClone(result);
  cumulativeReview.steps[1].conceptIds = ['structure', 'growth'];
  assert.throws(() => validatePlan(cumulativeReview, { goal, sources: [] }), /Prerequisites must precede step/);
  assert.deepEqual(await provider.generate({ ...input, kind: 'ANSWER', plan, question: 'How should I review?', schema: answerSchema }), answer);
});
