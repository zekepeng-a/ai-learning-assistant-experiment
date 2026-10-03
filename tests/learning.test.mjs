import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createProgress, getNextAction, recordExposure, recordPractice, saveProgress, loadProgress } from '../src/learning.mjs';
import { run } from '../src/cli.mjs';

const fresh = () => createProgress('javascript-functions');
const correct = p => recordPractice(p, 'parameters', 'parameter', { assisted: false });
async function fixture(t) {
  const dir = await mkdtemp(fileURLToPath(new URL('../.learning-test-', import.meta.url)));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return join(dir, 'progress.json');
}

test('initial goal and source-backed action', () => {
  assert.throws(() => createProgress('anything'));
  assert.deepEqual(fresh().events, []);
  const action = getNextAction(fresh());
  assert.equal(action.conceptId, 'parameters');
  assert.ok(action.practice.question.length > 0);
  assert.ok(action.sourceRefs.every(ref => new URL(ref).protocol === 'https:'));
  assert.deepEqual(JSON.parse(JSON.stringify(fresh())), fresh());
});

test('exposure is immutable and never advances practice', () => {
  const original = fresh();
  const exposed = recordExposure(original, 'parameters');
  assert.equal(original.events.length, 0);
  assert.equal(exposed.events[0].type, 'exposure');
  assert.equal(getNextAction(exposed).conceptId, 'parameters');
  assert.throws(() => recordExposure(original, 'unknown'));
});

test('wrong and assisted answers persist without advancing', () => {
  let p = recordPractice(fresh(), 'parameters', 'globalThis.shouldNeverRun = true');
  p = recordPractice(p, 'parameters', 'parameter', { assisted: true });
  assert.equal(globalThis.shouldNeverRun, undefined);
  assert.deepEqual(p.events.map(e => [e.correct, e.assisted]), [[false, false], [true, true]]);
  assert.equal(getNextAction(p).conceptId, 'parameters');
});

test('unaided correct fixtures advance in order and completion rejects practice', () => {
  const initial = fresh();
  assert.throws(() => recordPractice(initial, 'return-values', 'return'));
  assert.throws(() => recordPractice(initial, 'unknown', 'parameter'));
  const p = correct(initial);
  assert.equal(initial.events.length, 0);
  assert.equal(getNextAction(p).conceptId, 'return-values');
  assert.throws(() => correct(p));
  const done = recordPractice(p, 'return-values', ' RETURN ', { assisted: false });
  assert.equal(getNextAction(done), null);
  assert.throws(() => recordPractice(done, 'return-values', 'return'));
  assert.throws(() => recordPractice(fresh(), 'parameters', 1));
  assert.throws(() => recordPractice(fresh(), 'parameters', 'parameter', { assisted: 'false' }));
});

test('versioned history survives save/load including all evidence types', async t => {
  const file = await fixture(t);
  let p = recordExposure(fresh(), 'parameters');
  p = recordPractice(p, 'parameters', 'wrong');
  p = recordPractice(p, 'parameters', 'parameter', { assisted: true });
  p = correct(p);
  await saveProgress(file, p);
  assert.deepEqual(await loadProgress(file), p);
  assert.equal(getNextAction(await loadProgress(file)).conceptId, 'return-values');
});

test('corrupt, unsupported and impossible histories fail closed', async t => {
  const file = await fixture(t);
  await assert.rejects(loadProgress(file));
  const invalid = [
    '{', 'null', JSON.stringify({ ...fresh(), version: 2 }),
    JSON.stringify({ ...fresh(), score: 1 }),
    JSON.stringify({ ...fresh(), events: [{ type: 'exposure', conceptId: 'unknown' }] }),
    JSON.stringify({ ...fresh(), events: [{ type: 'practice', conceptId: 'return-values', answer: 'return', correct: true, assisted: false }] }),
    JSON.stringify({ ...fresh(), events: [{ type: 'practice', conceptId: 'parameters', answer: 'wrong', correct: true, assisted: false }] })
  ];
  for (const raw of invalid) {
    await writeFile(file, raw);
    await assert.rejects(loadProgress(file));
    assert.equal(await readFile(file, 'utf8'), raw);
  }
  await assert.rejects(saveProgress(file, { ...fresh(), version: NaN }));
});

test('CLI handlers persist the loop and reject invalid input without erasing history', async t => {
  const file = await fixture(t);
  await run(['start', 'javascript-functions', file]);
  await run(['expose', file, 'parameters']);
  await run(['practice', file, 'parameters', 'parameter', '--assisted']);
  assert.equal((await run(['next', file])).conceptId, 'parameters');
  await run(['practice', file, 'parameters', 'parameter']);
  await run(['practice', file, 'return-values', 'return']);
  assert.equal(await run(['next', file]), null);
  const before = await readFile(file, 'utf8');
  for (const args of [['start', 'javascript-functions', file], ['next', file, 'extra'],
    ['practice', file, 'parameters', 'parameter', '--unknown'], ['expose', file, 'unknown'],
    ['practice', file, 'return-values', 'return'], []]) await assert.rejects(run(args));
  assert.equal(await readFile(file, 'utf8'), before);
});
