import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createLearningServer } from '../src/server.mjs';

async function fixture(t) {
  const dir = await mkdtemp(fileURLToPath(new URL('../.web-test-', import.meta.url)));
  const progressFile = join(dir, 'progress.json');
  const servers = [];
  t.after(async () => {
    for (const server of servers) {
      if (server.listening) await new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
    }
    await rm(dir, { recursive: true, force: true });
  });
  async function start() {
    const server = createLearningServer({ progressFile });
    servers.push(server);
    assert.equal(server.listening, false);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    assert.equal(server.address().address, '127.0.0.1');
    const port = server.address().port;
    function request(path, { method = 'GET', body, raw, headers = {} } = {}) {
      const payload = raw ?? (body === undefined ? undefined : JSON.stringify(body));
      return new Promise((resolve, reject) => {
        const req = http.request({ hostname: '127.0.0.1', port, path, method, agent: false,
          headers: { ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers } }, res => {
          const chunks = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('error', reject);
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            resolve({ status: res.statusCode, headers: res.headers, text,
              value: res.headers['content-type']?.startsWith('application/json') ? JSON.parse(text) : undefined });
          });
        });
        req.on('error', reject);
        req.setTimeout(5000, () => req.destroy(new Error('HTTP test request timed out')));
        req.end(payload);
      });
    }
    return { server, request, origin: `http://127.0.0.1:${port}` };
  }
  return { dir, progressFile, start, ...await start() };
}
const practice = (conceptId, answer, assisted = false) => ({ conceptId, answer, assisted });
async function ok(request, path, body, headers) {
  const response = await request(path, body === undefined ? {} : { method: 'POST', body, headers });
  assert.equal(response.status, 200, response.text);
  assert.deepEqual(Object.keys(response.value).sort(), ['nextAction', 'progress']);
  return response.value;
}

test('HTTP initialization, exposure, wrong/assisted practice, refresh, completion and reset', async t => {
  const f = await fixture(t);
  const initial = await ok(f.request, '/api/state');
  assert.deepEqual(initial.progress, { version: 1, goal: 'javascript-functions', events: [] });
  assert.equal(initial.nextAction.conceptId, 'parameters');
  let state = await ok(f.request, '/api/exposure', { conceptId: 'parameters' });
  assert.equal(state.nextAction.conceptId, 'parameters');
  assert.deepEqual(state.progress.events, [{ type: 'exposure', conceptId: 'parameters' }]);
  state = await ok(f.request, '/api/practice', practice('parameters', 'wrong'));
  assert.equal(state.nextAction.conceptId, 'parameters');
  state = await ok(f.request, '/api/practice', practice('parameters', 'parameter', true));
  assert.equal(state.nextAction.conceptId, 'parameters');
  assert.deepEqual(state.progress.events.slice(1).map(e => [e.correct, e.assisted]), [[false, false], [true, true]]);
  state = await ok(f.request, '/api/practice', practice('parameters', ' PARAMETER '), { Origin: f.origin });
  assert.equal(state.nextAction.conceptId, 'return-values');
  assert.deepEqual(await ok(f.request, '/api/state'), state);
  await new Promise(resolve => f.server.close(resolve));
  const restarted = await f.start();
  assert.deepEqual(await ok(restarted.request, '/api/state'), state);
  state = await ok(restarted.request, '/api/practice', practice('return-values', 'return'));
  assert.equal(state.nextAction, null);
  assert.equal(state.progress.events.length, 5);
  assert.deepEqual(JSON.parse(await readFile(f.progressFile, 'utf8')), state.progress);
  assert.equal((await restarted.request('/api/practice', { method: 'POST', body: practice('return-values', 'return') })).status, 400);
  assert.deepEqual(await ok(restarted.request, '/api/state'), state);
  assert.deepEqual(await ok(restarted.request, '/api/reset', { confirm: true }), initial);
});

test('HTTP rejects invalid bodies, routes, filesystem paths and cross-origin mutations without changing history', async t => {
  const f = await fixture(t);
  await ok(f.request, '/api/exposure', { conceptId: 'parameters' });
  const before = await readFile(f.progressFile, 'utf8');
  const valid = practice('parameters', 'parameter');
  const cases = [
    ['/api/practice', { body: { ...valid, extra: true } }, 400],
    ['/api/practice', { body: { conceptId: 'parameters', answer: 'parameter' } }, 400],
    ['/api/practice', { body: { ...valid, answer: 1 } }, 400],
    ['/api/practice', { body: { ...valid, assisted: 'false' } }, 400],
    ['/api/practice', { body: practice('return-values', 'return') }, 400],
    ['/api/exposure', { body: { conceptId: 'unknown' } }, 400],
    ['/api/exposure', { body: { conceptId: 1 } }, 400],
    ['/api/exposure', { body: { conceptId: 'parameters', progressFile: 'other.json' } }, 400],
    ...[null, [], {}, { confirm: false }, { confirm: 'true' }, { confirm: true, extra: 1 }].map(body => ['/api/reset', { body }, 400]),
    ['/api/practice', { raw: '{' }, 400],
    ['/api/practice', { body: practice('parameters', 'x'.repeat(17000)) }, 413],
    ['/api/practice', { body: valid, headers: { 'Content-Type': 'text/plain' } }, 415],
    ['/api/practice', { body: valid, headers: { Host: 'untrusted.invalid' } }, 403],
    ...['/api/exposure', '/api/practice', '/api/reset'].flatMap(path => [
      [path, { body: valid, headers: { Origin: 'https://untrusted.invalid' } }, 403],
      [path, { body: valid, headers: { 'Sec-Fetch-Site': 'cross-site' } }, 403]
    ]),
    ['/api/unknown', { body: {} }, 404]
  ];
  for (const [path, options, status] of cases) {
    const response = await f.request(path, { method: 'POST', ...options });
    assert.equal(response.status, status, `${path}: ${response.text}`);
    assert.equal(typeof response.value.error, 'string');
    assert.equal(await readFile(f.progressFile, 'utf8'), before);
  }
  for (const path of ['/../src/learning.mjs', '/%2e%2e/src/server.mjs', '/src/server.mjs', '/.data/progress.json', '/docs/WEB_UI_CONTRACT.json', '/api/reset', '/unknown']) {
    assert.equal((await f.request(path)).status, 404, path);
  }
  assert.equal(await readFile(f.progressFile, 'utf8'), before);
});

test('HTTP corrupt history fails closed until explicit confirmed reset', async t => {
  const f = await fixture(t);
  for (const raw of ['{', JSON.stringify({ version: 99, goal: 'javascript-functions', events: [] })]) {
    await writeFile(f.progressFile, raw);
    for (const [path, options] of [
      ['/api/state', {}],
      ['/api/exposure', { method: 'POST', body: { conceptId: 'parameters' } }],
      ['/api/practice', { method: 'POST', body: practice('parameters', 'parameter') }]
    ]) {
      assert.equal((await f.request(path, options)).status, 500);
      assert.equal(await readFile(f.progressFile, 'utf8'), raw);
    }
    assert.equal((await f.request('/api/reset', { method: 'POST', body: { confirm: false } })).status, 400);
    assert.equal(await readFile(f.progressFile, 'utf8'), raw);
    const reset = await ok(f.request, '/api/reset', { confirm: true });
    assert.deepEqual(reset.progress.events, []);
    assert.equal(reset.nextAction.conceptId, 'parameters');
  }
});

test('HTTP concurrent writes retain every event and leave no temporary persistence files', async t => {
  const f = await fixture(t);
  await Promise.all(Array.from({ length: 12 }, () => ok(f.request, '/api/exposure', { conceptId: 'parameters' })));
  const responses = await Promise.all(Array.from({ length: 2 }, () => f.request('/api/practice', {
    method: 'POST', body: practice('parameters', 'parameter')
  })));
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 400]);
  const state = await ok(f.request, '/api/state');
  assert.equal(state.progress.events.length, 13);
  assert.equal(state.progress.events.filter(e => e.type === 'exposure').length, 12);
  assert.equal(state.nextAction.conceptId, 'return-values');
  assert.deepEqual(JSON.parse(await readFile(f.progressFile, 'utf8')), state.progress);
  assert.deepEqual(await readdir(f.dir), ['progress.json']);
});

test('HTTP serves only the local browser assets with matching content and MIME types', async t => {
  const f = await fixture(t);
  for (const [path, name, mime] of [
    ['/', 'index.html', 'text/html'], ['/index.html', 'index.html', 'text/html'],
    ['/app.js', 'app.js', 'text/javascript'], ['/styles.css', 'styles.css', 'text/css']
  ]) {
    const response = await f.request(path);
    assert.equal(response.status, 200);
    assert.equal(response.headers['content-type'], `${mime}; charset=utf-8`);
    assert.equal(response.text, await readFile(new URL(`../public/${name}`, import.meta.url), 'utf8'));
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.match(response.headers['content-security-policy'], /connect-src 'self'/);
  }
});
