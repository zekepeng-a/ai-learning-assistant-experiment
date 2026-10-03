import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createBackendServer } from '../src/backend-server.mjs';
import { OpenAIResponsesProvider, TavilySearchProvider } from '../src/backend-providers.mjs';
import { planSchema, answerSchema } from '../src/backend-schema.mjs';

// Independent transport fixtures, not evidence of subject knowledge or teaching quality.
const goal = { subject: 'Map reading', objective: 'Interpret contour maps', level: 'BEGINNER', weeklyHours: 2 };
const source = { title: 'Contour observation', url: 'https://www.usgs.gov/maps', text: 'Contours connect equal elevations.' };
function planFixture(subject, sourceIds) {
  return {
    subject, underlyingLogic: 'Equal elevations describe the shape of terrain.', coreQuestions: ['How does contour spacing describe slope?'],
    concepts: [
      { id: 'elevation', name: 'Elevation', explanation: 'Height is measured relative to a datum.', whyItMatters: 'Provides a common reference.', prerequisites: [], sourceIds },
      { id: 'slope', name: 'Slope', explanation: 'Slope compares elevation change with distance.', whyItMatters: 'Supports interpreting terrain.', prerequisites: ['elevation'], sourceIds }
    ],
    steps: ['elevation', 'slope'].map(id => ({ id, title: `Apply ${id}`, conceptIds: [id], estimatedHours: 1, activity: 'Annotate two contour maps with measured elevations.', deliverable: 'Two annotated contour diagrams.', check: 'Compare the marked heights against the contour labels.', sourceIds })),
    misconceptions: [{ description: 'Contour spacing gives absolute elevation.', correction: 'Read contour labels to find elevation.', sourceIds }],
    limitations: ['TEST fixture; AI_GENERATED_UNVERIFIED; MODEL_ONLY without sources.']
  };
}
async function withServer(options, run) {
  const dir = mkdtempSync(join(resolve('.'), '.backend-http-'));
  let server;
  try {
    server = createBackendServer({ dbFile: join(dir, 'db.sqlite'), ...options });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const port = server.address().port;
    const request = (path, { method = 'GET', body, raw, headers = {} } = {}) => new Promise((resolve, reject) => {
      const req = http.request({ hostname: '127.0.0.1', port, path, method, agent: false, headers: { ...(body !== undefined || raw !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers } }, res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => { try { resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(Buffer.concat(chunks).toString()) }); } catch (e) { reject(e); } });
        res.on('error', reject);
      });
      req.setTimeout(3000, () => req.destroy(new Error('Test request timed out')));
      req.on('error', reject); req.end(raw ?? (body === undefined ? undefined : JSON.stringify(body)));
    });
    await run(request, server.backend, port);
  } finally {
    if (server) { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); server.backend.close(); }
    rmSync(dir, { recursive: true, force: true });
  }
}
test('real HTTP: unconfigured capabilities, strict bodies, Host/Origin and safe errors', async () => {
  await withServer({}, async (request, backend, port) => {
    assert.deepEqual((await request('/api/v1/status')).body, { modelConfigured: false, searchConfigured: false, scope: 'LOCAL_SINGLE_USER' });
    const created = await request('/api/v1/goals', { method: 'POST', body: goal });
    assert.equal(created.status, 201); const id = created.body.id;
    assert.deepEqual((await request('/api/v1/goals')).body, [created.body]);
    assert.deepEqual((await request(`/api/v1/goals/${id}`)).body, created.body);
    const base = `/api/v1/goals/${id}`;
    assert.equal((await request(`${base}/sources`, { method: 'POST', body: source })).status, 201);
    for (const [path, body] of [[`${base}/plans`, { sourceIds: [] }], [`${base}/search`, { query: 'contours' }]]) {
      assert.equal((await request(path, { method: 'POST', body })).status, 503);
    }
    assert.deepEqual((await request(`${base}/plans`)).body, []);
    const before = backend.store.db.prepare('SELECT count(*) AS n FROM events').get().n;
    for (const body of [{ ...goal, extra: true }, { ...goal, weeklyHours: '2' }, { ...goal, subject: '' }, { ...goal, level: 'EXPERT' }, { subject: 'missing fields' }, null, []]) {
      assert.equal((await request('/api/v1/goals', { method: 'POST', body })).status, 400);
    }
    assert.equal((await request('/api/v1/goals', { method: 'POST', raw: '{' })).status, 400);
    assert.equal((await request('/api/v1/goals', { method: 'POST', body: goal, headers: { 'Content-Type': 'text/plain' } })).status, 415);
    assert.equal((await request('/api/v1/goals', { method: 'POST', raw: JSON.stringify({ text: 'x'.repeat(128 * 1024) }) })).status, 413);
    assert.equal((await request('/api/v1/status', { headers: { Host: `localhost:${port}` } })).status, 403);
    for (const headers of [{ Origin: 'https://evil.invalid' }, { Origin: 'null' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
      const response = await request('/api/v1/goals', { method: 'POST', body: goal, headers });
      assert.equal(response.status, 403); assert.equal(response.headers['access-control-allow-origin'], undefined);
    }
    assert.equal((await request('/api/v1/goals', { method: 'OPTIONS' })).status, 405);
    for (const path of ['/unknown', '/api/v1/goals/missing', '/api/v1/plans/missing']) {
      const response = await request(path); assert.equal(response.status, 404); assert.deepEqual(Object.keys(response.body), ['error']);
    }
    assert.equal(backend.store.db.prepare('SELECT count(*) AS n FROM events').get().n, before);
  });
});
test('real HTTP: sources, search, immutable plans, activities and pinned advisory answers', async () => {
  const calls = [];
  const modelProvider = { metadata: { id: 'http-fixture', model: 'maps', mode: 'TEST' }, async generate(input) {
    calls.push(input);
    return input.kind === 'PLAN' ? planFixture(input.goal.subject, input.sources.map(s => s.id)) : { answer: 'Compare contour intervals.', sourceIds: input.sources.map(s => s.id), limitations: ['TEST advice only.'] };
  } };
  await withServer({ modelProvider, searchProvider: { async search({ query }) { assert.equal(query, 'contour maps'); return [source]; } } }, async (request, backend, port) => {
    const post = (path, body) => request(path, { method: 'POST', body, headers: { Origin: `http://127.0.0.1:${port}` } });
    assert.equal((await request('/api/v1/status')).body.modelConfigured, true);
    const g = (await post('/api/v1/goals', goal)).body; const base = `/api/v1/goals/${g.id}`;
    const s = (await post(`${base}/sources`, source)).body;
    const searched = await post(`${base}/search`, { query: ' contour maps ' });
    assert.equal(searched.status, 201); assert.equal(searched.body[0].provenance.kind, 'SEARCH_SNIPPET');
    assert.equal((await request(`${base}/sources`)).body.length, 2);
    const response = await post(`${base}/plans`, { sourceIds: [s.id] }); assert.equal(response.status, 201);
    const p = response.body; const path = `/api/v1/plans/${p.id}`;
    assert.equal(p.provider.mode, 'TEST'); assert.equal(p.status, 'AI_GENERATED_UNVERIFIED'); assert.equal(p.grounding, 'PINNED_SOURCES');
    assert.deepEqual(p.sourceManifest.map(s => s.id), [s.id]);
    assert.deepEqual((await request(path)).body, p);
    assert.deepEqual((await request(`${base}/plans`)).body, [p]);
    for (const kind of ['EXPOSURE', 'PRACTICE', 'REFLECTION']) assert.equal((await post(`${path}/activities`, { stepId: 'elevation', kind, note: 'Tried the map exercise', assisted: true })).status, 201);
    const progress = (await request(`${path}/progress`)).body;
    assert.deepEqual(progress.counts, { EXPOSURE: 1, PRACTICE: 1, REFLECTION: 1 }); assert.equal(progress.mastery, 'UNPROVEN');
    const answer = await post(`${path}/ask`, { question: 'How do intervals work?' });
    assert.equal(answer.status, 201); assert.equal(answer.body.advisory, true); assert.deepEqual(answer.body.sourceIds, [s.id]);
    assert.equal(calls[1].plan.id, p.id); assert.deepEqual(calls[1].sources.map(s => s.id), [s.id]);
    const before = backend.store.db.prepare('SELECT count(*) AS n FROM events').get().n;
    for (const [url, body] of [[`${base}/sources`, { ...source, url: 'https://127.0.0.1' }], [`${base}/plans`, { sourceIds: ['missing'] }], [`${path}/activities`, { stepId: 'missing', kind: 'PRACTICE', note: '', assisted: false }], [`${path}/ask`, { question: 'why', extra: true }]]) assert.equal((await post(url, body)).status, 400);
    backend.modelProvider = { ...modelProvider, generate: async () => ({ invalid: true }) };
    assert.equal((await post(`${base}/plans`, { sourceIds: [] })).status, 502);
    assert.equal((await post(`${path}/ask`, { question: 'Why?' })).status, 502);
    assert.equal(backend.store.db.prepare('SELECT count(*) AS n FROM events').get().n, before);
    assert.deepEqual((await request(path)).body, p);
    backend.modelProvider = undefined;
    assert.equal((await post(`${path}/ask`, { question: 'Why?' })).status, 503);
  });
});

test('real HTTP: four active provider jobs bound concurrency and excess work is rejected', async () => {
  const releases = []; let ready;
  const allStarted = new Promise(resolve => { ready = resolve; });
  const modelProvider = { metadata: { id: 'busy-test', model: 'maps', mode: 'TEST' }, generate(input) {
    return new Promise(resolve => { releases.push(() => resolve(planFixture(input.goal.subject, []))); if (releases.length === 4) ready(); });
  } };
  await withServer({ modelProvider }, async request => {
    const g = (await request('/api/v1/goals', { method: 'POST', body: goal })).body;
    const url = `/api/v1/goals/${g.id}/plans`;
    const pending = Array.from({ length: 4 }, () => request(url, { method: 'POST', body: { sourceIds: [] } }));
    try {
      await allStarted;
      const excess = await request(url, { method: 'POST', body: { sourceIds: [] } });
      assert.equal(excess.status, 503); assert.equal(excess.body.error, 'Provider busy'); assert.equal(releases.length, 4);
    } finally { releases.forEach(release => release()); await Promise.allSettled(pending); }
    const results = await Promise.all(pending);
    assert.ok(results.every(r => r.status === 201 && r.body.grounding === 'MODEL_ONLY'));
    assert.deepEqual(results.map(r => r.body.revision).sort(), [1, 2, 3, 4]);
  });
});

const secret = 'fake-test-secret';
const input = { kind: 'PLAN', goal, sources: [source], plan: null, question: null, schema: planSchema };
const completed = value => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] });
const json = value => new Response(JSON.stringify(value), { status: 200 });
test('injected OpenAI and Tavily requests obey fixed protocols without network', async () => {
  let count = 0;
  const model = new OpenAIResponsesProvider({ apiKey: secret, model: 'test-model', fetch: async (url, options) => {
    count++; assert.equal(url, 'https://api.openai.com/v1/responses'); assert.equal(options.method, 'POST'); assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, `Bearer ${secret}`); assert.equal(options.headers['Content-Type'], 'application/json'); assert.ok(options.signal instanceof AbortSignal);
    const body = JSON.parse(options.body); assert.equal(body.store, false); assert.equal(body.model, 'test-model'); assert.ok(body.max_output_tokens > 0 && body.max_output_tokens <= 12000);
    assert.deepEqual(body.text.format, { type: 'json_schema', name: count === 1 ? 'learning_plan' : 'learning_answer', strict: true, schema: count === 1 ? planSchema : answerSchema });
    assert.deepEqual(JSON.parse(body.input).sources, [source]); assert.match(body.instructions, /untrusted data/); assert.ok(!options.body.includes(secret));
    return json(completed({ sample: true }));
  } });
  assert.deepEqual(await model.generate(input), { sample: true });
  await model.generate({ ...input, kind: 'ANSWER', schema: answerSchema, question: 'Why?' }); assert.equal(count, 2);
  const search = new TavilySearchProvider({ apiKey: secret, fetch: async (url, options) => {
    assert.equal(url, 'https://api.tavily.com/search'); assert.equal(options.method, 'POST'); assert.equal(options.redirect, 'error'); assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.headers.Authorization, `Bearer ${secret}`);
    assert.deepEqual(JSON.parse(options.body), { query: 'contours', search_depth: 'basic', max_results: 5 });
    return json({ results: [{ title: source.title, url: source.url, content: source.text }] });
  } });
  assert.deepEqual(await search.search({ query: 'contours' }), [source]);
});
test('injected provider failures: rate limits, refusal, incomplete, invalid JSON, bounds and timeout', async t => {
  const cases = [
    ['rate limit', () => new Response(secret, { status: 429 })],
    ['invalid transport JSON', () => new Response(`not JSON ${secret}`)],
    ['oversized stream', () => new Response('x'.repeat(512 * 1024 + 1))],
    ['network exception', () => { throw new Error(secret); }],
    ['incomplete', () => json({ ...completed({}), status: 'incomplete' })],
    ['refusal', () => json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: secret }] }] })],
    ['invalid output JSON', () => json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: secret }] }] })],
    ['multiple texts', () => { const r = completed({}); r.output.push(r.output[0]); return json(r); }],
    ['nonobject output', () => json(completed([]))]
  ];
  for (const [name, response] of cases) await t.test(name, async () => {
    let calls = 0;
    const provider = new OpenAIResponsesProvider({ apiKey: secret, model: 'test', fetch: async () => { calls++; return response(); } });
    await assert.rejects(provider.generate(input), e => e.status === 502 && !e.message.includes(secret)); assert.equal(calls, 1);
  });
  for (const Provider of [OpenAIResponsesProvider, TavilySearchProvider]) {
    const invoke = p => Provider === OpenAIResponsesProvider ? p.generate(input) : p.search({ query: 'contours' });
    for (const response of [() => new Response(secret, { status: 429 }), () => new Response(secret), () => json({ results: [{ ...source, url: 'http://localhost', content: source.text }] })]) {
      const p = new Provider({ apiKey: secret, model: 'test', fetch: async () => response() });
      await assert.rejects(invoke(p), e => e.status === 502 && !e.message.includes(secret));
    }
    let signal, calls = 0;
    const p = new Provider({ apiKey: secret, model: 'test', timeoutMs: 10, fetch: async (_, options) => { calls++; signal = options.signal; return new Promise(() => {}); } });
    await assert.rejects(invoke(p), { status: 502, message: 'Provider request failed' }); assert.equal(signal.aborted, true); assert.equal(calls, 1);
    assert.throws(() => new Provider({ apiKey: 'bad key', model: 'test' }));
    assert.throws(() => new Provider({ apiKey: secret, model: 'test', timeoutMs: 20001 }));
  }
});
