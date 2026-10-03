import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { mkdirSync, readFileSync } from 'node:fs';
import { LearningBackend } from './backend.mjs';
import { OpenAIResponsesProvider, TavilySearchProvider } from './backend-providers.mjs';
import { DeepSeekProvider } from './deepseek-provider.mjs';
import { fail } from './backend-schema.mjs';

// Called by the CLI only; tests pass an explicit object and never inspect process.env.
export function configuredProviders(env) {
  const selected = env.LEARNING_PROVIDER ?? 'openai';
  if (!['openai', 'deepseek'].includes(selected)) fail('Invalid provider configuration');
  let modelProvider;
  if (selected === 'deepseek') {
    const apiKey = env.DEEPSEEK_API_KEY;
    if (apiKey) modelProvider = new DeepSeekProvider({ apiKey, model: env.LEARNING_MODEL ?? 'deepseek-flash' });
  } else {
    const apiKey = env.OPENAI_API_KEY, model = env.LEARNING_MODEL;
    if (apiKey && model) modelProvider = new OpenAIResponsesProvider({ apiKey, model });
  }
  const searchKey = env.TAVILY_API_KEY;
  const searchProvider = searchKey ? new TavilySearchProvider({ apiKey: searchKey }) : undefined;
  return { modelProvider, searchProvider };
}

async function body(req) {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] ?? '')) fail('JSON content-type required', 415);
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 128 * 1024) fail('Body too large', 413); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('Invalid JSON'); }
}
export function createBackendServer(options) {
  const backend = new LearningBackend(options);
  const assets = new Map([
    ['/', ['assistant.html', 'text/html; charset=utf-8']],
    ['/assistant.js', ['assistant.js', 'text/javascript; charset=utf-8']],
    ['/assistant.css', ['assistant.css', 'text/css; charset=utf-8']],
    ['/styles.css', ['styles.css', 'text/css; charset=utf-8']]
  ].map(([route, [file, type]]) => [route, { body: readFileSync(new URL(`../public/${file}`, import.meta.url)), type }]));
  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const timer = setTimeout(() => { if (!res.writableEnded) { res.writeHead(408, { 'Content-Type': 'application/json', Connection: 'close' }); res.end(JSON.stringify({ error: 'Request timeout' })); req.destroy(); } }, 130000);
    try {
      const host = `127.0.0.1:${server.address().port}`;
      if (req.headers.host !== host || req.rawHeaders.filter((_, i) => i % 2 === 0).filter(h => h.toLowerCase() === 'host').length !== 1) fail('Invalid Host', 403);
      if (!['GET', 'POST'].includes(req.method)) fail('Method not allowed', 405);
      if (req.method === 'POST' && ((req.headers.origin && req.headers.origin !== `http://${host}`) || (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site'])))) fail('Cross-origin write denied', 403);
      if (!req.url.startsWith('/') || req.url.includes('?') || req.url.includes('#')) fail('Not found', 404);
      if (req.method === 'GET' && assets.has(req.url)) {
        const asset = assets.get(req.url);
        res.writeHead(200, { 'Content-Type': asset.type, 'Cache-Control': 'no-store' }); res.end(asset.body); return;
      }
      const path = req.url.split('/').filter(Boolean); let result, status = 200;
      if (req.url === '/api/v1/status' && req.method === 'GET') result = { modelConfigured: !!backend.modelProvider, searchConfigured: !!backend.searchProvider, scope: 'LOCAL_SINGLE_USER' };
      else if (req.url === '/api/v1/model-info' && req.method === 'GET') result = { configured: !!backend.modelProvider, provider: backend.modelProvider?.metadata.id ?? null, model: backend.modelProvider?.metadata.model ?? null };
      else if (req.url === '/api/v1/goals') {
        if (req.method === 'GET') result = backend.listGoals(); else { result = backend.createGoal(await body(req)); status = 201; }
      } else if (path[0] === 'api' && path[1] === 'v1' && path.length >= 4 && path.length <= 5) {
        const [, , resource, id, action] = path;
        if (resource === 'goals') {
          if (!action && req.method === 'GET') result = backend.getGoal(id);
          else if (action === 'sources') { if (req.method === 'GET') result = backend.listSources(id); else { result = backend.addSource(id, await body(req)); status = 201; } }
          else if (action === 'search' && req.method === 'POST') { result = await backend.searchSources(id, await body(req)); status = 201; }
          else if (action === 'plans') { if (req.method === 'GET') result = backend.listPlans(id); else { result = await backend.generatePlan(id, await body(req)); status = 201; } }
          else fail('Not found', 404);
        } else if (resource === 'plans') {
          if (!action && req.method === 'GET') result = backend.getPlan(id);
          else if (action === 'progress' && req.method === 'GET') result = backend.getProgress(id);
          else if (action === 'answers' && req.method === 'GET') result = backend.listAnswers(id);
          else if (action === 'activities' && req.method === 'POST') { result = backend.recordActivity(id, await body(req)); status = 201; }
          else if (action === 'ask' && req.method === 'POST') { result = await backend.ask(id, await body(req)); status = 201; }
          else fail('Not found', 404);
        } else fail('Not found', 404);
      } else fail('Not found', 404);
      if (!res.writableEnded) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(result)); }
    } catch (e) {
      if (!res.writableEnded && !res.destroyed) { res.writeHead(e.status ?? 500, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Connection: 'close' }); res.end(JSON.stringify({ error: e.status ? e.message : 'Internal backend error' })); }
    } finally { clearTimeout(timer); }
  });
  server.requestTimeout = 130000; server.headersTimeout = 10000; server.timeout = 130000; server.keepAliveTimeout = 1000; server.maxConnections = 64;
  server.backend = backend; return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    let port = 4174, dbFile = '.data/backend.sqlite'; const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i += 2) {
      if (args[i] === '--port' && /^\d+$/.test(args[i + 1] ?? '') && Number(args[i + 1]) <= 65535) port = Number(args[i + 1]);
      else if (args[i] === '--db' && args[i + 1]) dbFile = args[i + 1];
      else fail('Usage: --port 0..65535 --db trusted-path');
    }
    if (dbFile === '.data/backend.sqlite') mkdirSync('.data', { recursive: true });
    const { modelProvider, searchProvider } = configuredProviders(process.env);
    const server = createBackendServer({ dbFile, modelProvider, searchProvider });
    server.on('error', () => { console.error('Backend server failed'); server.backend.close(); process.exitCode = 1; });
    server.listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${server.address().port}`));
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => server.backend.close()));
  } catch { console.error('Backend configuration failed'); process.exitCode = 1; }
}
