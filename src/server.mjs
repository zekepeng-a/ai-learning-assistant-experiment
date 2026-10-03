import http from 'node:http';
import { mkdir, readFile, rename, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createProgress, getNextAction, recordExposure, recordPractice, saveProgress, loadProgress } from './learning.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']]
]);
const problem = (status, message) => Object.assign(new Error(message), { status });
const fresh = () => createProgress('javascript-functions');

function validateBody(body, fields) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).sort().join(',') !== [...fields].sort().join(',')) {
    throw problem(400, '请求字段不完整或包含额外字段。');
  }
}

async function parseBody(req) {
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw problem(415, '请使用 application/json。');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16 * 1024) throw problem(413, '请求内容过大。');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw problem(400, 'JSON 格式无效。'); }
}

/** Creates an unbound server. Run one server/writer per progress file. */
export function createLearningServer({ progressFile = resolve(root, '.data/progress.json') } = {}) {
  const file = resolve(progressFile);
  let queue = Promise.resolve();
  const serialize = task => {
    const result = queue.then(task);
    queue = result.catch(() => {});
    return result;
  };
  async function persist(progress) {
    await mkdir(dirname(file), { recursive: true });
    const temp = `${file}.${randomUUID()}.tmp`;
    try {
      await saveProgress(temp, progress);
      await rename(temp, file);
    } finally { await rm(temp, { force: true }); }
  }
  async function read() {
    try { return await loadProgress(file); }
    catch (error) {
      if (error.code !== 'ENOENT') throw problem(500, '无法读取学习记录。请检查数据文件；原记录未被重置。');
      const progress = fresh();
      await persist(progress);
      return progress;
    }
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    const json = (status, value) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(value));
    };
    try {
      const host = `127.0.0.1:${server.address().port}`;
      // Pin the authority as well as Origin to reject DNS rebinding and browser CSRF.
      if (req.headers.host !== host) throw problem(403, '仅允许本机回环地址访问。');
      const route = req.url;
      if (req.method === 'GET' && assets.has(route)) {
        const [name, type] = assets.get(route);
        const content = await readFile(resolve(root, 'public', name));
        res.writeHead(200, { 'Content-Type': type });
        res.end(content);
        return;
      }
      if (req.method === 'GET' && route === '/api/state') {
        const state = await serialize(async () => {
          const progress = await read();
          return { progress, nextAction: getNextAction(progress) };
        });
        json(200, state);
        return;
      }
      if (req.method !== 'POST' || !['/api/exposure', '/api/practice', '/api/reset'].includes(route)) {
        throw problem(404, '找不到此资源。');
      }
      if ((req.headers.origin && req.headers.origin !== `http://${host}`) ||
          (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site']))) {
        throw problem(403, '不允许跨来源修改学习记录。');
      }
      const body = await parseBody(req);
      if (route === '/api/reset') {
        validateBody(body, ['confirm']);
        if (body.confirm !== true) throw problem(400, '重置需要明确确认。');
      } else {
        validateBody(body, route === '/api/exposure' ? ['conceptId'] : ['conceptId', 'answer', 'assisted']);
        if (typeof body.conceptId !== 'string' || !['parameters', 'return-values'].includes(body.conceptId)) {
          throw problem(400, '概念无效。');
        }
        if (route === '/api/practice' && (typeof body.answer !== 'string' || typeof body.assisted !== 'boolean')) {
          throw problem(400, '答案必须为文本，assisted 必须为布尔值。');
        }
      }
      const state = await serialize(async () => {
        let progress;
        if (route === '/api/reset') progress = fresh();
        else {
          progress = await read();
          try {
            progress = route === '/api/exposure'
              ? recordExposure(progress, body.conceptId)
              : recordPractice(progress, body.conceptId, body.answer, { assisted: body.assisted });
          } catch { throw problem(400, '请回答当前推荐的练习。'); }
        }
        await persist(progress);
        return { progress, nextAction: getNextAction(progress) };
      });
      json(200, state);
    } catch (error) {
      if (!res.destroyed) json(error.status || 500, error.status ? { error: error.message } : { error: '保存失败，请检查本地数据文件后重试。' });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    let port = 4173;
    let progressFile = resolve(root, '.data/progress.json');
    const args = process.argv.slice(2);
    const seen = new Set();
    for (let i = 0; i < args.length; i += 2) {
      const flag = args[i], value = args[i + 1];
      if (!['--port', '--data'].includes(flag) || seen.has(flag) || !value) throw new Error('Usage: node src/server.mjs [--port <0..65535>] [--data <progress-file>]');
      seen.add(flag);
      if (flag === '--port') {
        if (!/^\d+$/.test(value) || Number(value) > 65535) throw new Error('Port must be an integer from 0 to 65535.');
        port = Number(value);
      } else progressFile = resolve(value);
    }
    const server = createLearningServer({ progressFile });
    server.on('error', error => { console.error(error.message); process.exitCode = 1; });
    server.listen(port, '127.0.0.1', () => console.log(`学习工作台 http://127.0.0.1:${server.address().port}`));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
