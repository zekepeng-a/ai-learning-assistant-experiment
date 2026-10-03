import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { LearningBackend } from '../src/backend.mjs';
import { validatePlan, canonical, hash, publicUrl } from '../src/backend-schema.mjs';

// Recording TEST fixtures establish wiring and validation, not curriculum quality.
export function fixture(subject, sourceIds = []) {
  const topics = { Botany: ['cell', 'growth'], Music: ['rhythm', 'composition'], Algebra: ['variable', 'equation'] };
  const [a, b] = topics[subject] ?? ['foundation', 'application'];
  return { subject, underlyingLogic: `${subject} connects ${a} to ${b}.`, coreQuestions: [`How does ${a} constrain ${b}?`], concepts: [
    { id: a, name: a, explanation: `Explain ${a} in ${subject}.`, whyItMatters: `It supports ${b}.`, prerequisites: [], sourceIds },
    { id: b, name: b, explanation: `Explain ${b} using ${a}.`, whyItMatters: 'It enables a worked application.', prerequisites: [a], sourceIds }
  ], steps: [a, b].map((id, i) => ({ id: `step${i}`, title: `Apply ${id}`, conceptIds: [id], estimatedHours: 1, activity: `Construct two examples of ${id} and explain their differences.`, deliverable: `Submit an annotated ${id} example.`, check: `Compare each ${id} example against explicit constraints.`, sourceIds })), misconceptions: [{ description: `Confusing ${a} and ${b}`, correction: `Distinguish the role of ${a} from ${b}.`, sourceIds }], limitations: ['TEST fixture; MODEL_ONLY when no pins; AI_GENERATED_UNVERIFIED.'] };
}
export function provider(calls = []) { return { metadata: { id: 'recording-test', model: 'fixtures', mode: 'TEST' }, async generate(input) { calls.push(input); return input.kind === 'PLAN' ? fixture(input.goal.subject, input.sources.map(s => s.id)) : { answer: 'An advisory TEST answer.', sourceIds: input.sources.map(s => s.id), limitations: ['Not verified.'] }; } }; }
const goalInput = subject => ({ subject, objective: `Understand ${subject}`, level: 'BEGINNER', weeklyHours: 3 });

test('SQLite durable immutable histories, isolated goals, revisions and atomic failures', async () => {
  const dir = mkdtempSync(join(resolve('.'), '.backend-test-')); const dbFile = join(dir, 'data.sqlite'); let b;
  try {
    const calls = []; b = new LearningBackend({ dbFile, modelProvider: provider(calls) });
    const goals = ['Botany', 'Music', 'Algebra'].map(s => b.createGoal(goalInput(s)));
    const source = b.addSource(goals[0].id, { title: 'Pinned', url: 'https://www.wikipedia.org/article', text: '  original observation  ' });
    assert.equal(source.contentHash, hash('original observation'));
    await assert.rejects(b.generatePlan(goals[1].id, { sourceIds: [source.id] })); assert.equal(calls.length, 0);
    const plans = []; for (const g of goals) plans.push(await b.generatePlan(g.id, { sourceIds: [] }));
    assert.deepEqual(calls.map(c => c.goal.subject), ['Botany', 'Music', 'Algebra']); assert.equal(new Set(plans.map(p => p.payload.concepts[0].id)).size, 3);
    assert.equal(plans[0].grounding, 'PINNED_SOURCES'); assert.equal(plans[1].grounding, 'MODEL_ONLY');
    const second = await b.generatePlan(goals[0].id, { sourceIds: [source.id] }); assert.equal(second.revision, 2); assert.notEqual(second.id, plans[0].id);
    b.recordActivity(plans[0].id, { stepId: 'step0', kind: 'PRACTICE', note: 'Attempted', assisted: true });
    const answer = await b.ask(plans[0].id, { question: 'Why?' }); assert.equal(answer.advisory, true);
    const count = b.store.db.prepare('SELECT count(*) AS n FROM events').get().n;
    b.modelProvider = { ...provider(), generate: async () => ({ bad: true }) };
    await assert.rejects(b.generatePlan(goals[0].id, { sourceIds: [] })); await assert.rejects(b.ask(plans[0].id, { question: 'Why?' }));
    b.searchProvider = { search: async () => [{ title: 'valid', url: 'https://www.wikipedia.org', text: 'snippet' }, { title: 'bad', url: 'http://localhost', text: 'bad' }] };
    await assert.rejects(b.searchSources(goals[0].id, { query: 'plants' })); assert.equal(b.listSources(goals[0].id).length, 1);
    assert.equal(b.store.db.prepare('SELECT count(*) AS n FROM events').get().n, count);
    assert.throws(() => b.store.db.prepare('UPDATE records SET body=? WHERE id=?').run('{}', source.id));
    b.close(); b = new LearningBackend({ dbFile });
    assert.deepEqual(b.getPlan(plans[0].id), plans[0]); assert.equal(plans[0].payloadHash, hash(canonical(plans[0].payload)));
    assert.equal(b.getProgress(plans[0].id).mastery, 'UNPROVEN'); assert.equal(b.getProgress(plans[0].id).counts.PRACTICE, 1);
    assert.equal(b.store.list('answer', plans[0].id)[0].id, answer.id);
    await assert.rejects(b.generatePlan(goals[0].id, { sourceIds: [] }), { status: 503 });
    assert.throws(() => b.createGoal({ ...goalInput('X'), extra: 1 })); assert.throws(() => b.getGoal('missing'), { status: 404 });
  } finally { b?.close(); rmSync(dir, { recursive: true, force: true }); }
});
test('schema rejects cycles, incomplete coverage, same-step dependency, citations and malformed output', () => {
  const goal = goalInput('Algebra'), valid = fixture(goal.subject); assert.deepEqual(validatePlan(valid, { goal, sources: [] }), valid);
  const changes = [p => p.concepts[0].prerequisites.push('equation'), p => p.steps[1].conceptIds = ['variable'], p => p.steps[0].conceptIds.push('equation'), p => p.steps[0].sourceIds.push('unseen'), p => p.extra = true, p => p.concepts[0].explanation = '', p => p.steps[0].estimatedHours = Infinity, p => p.steps[0].check = 'read', p => p.subject = 'Music', p => p.concepts[1].id = 'variable', p => p.steps.pop()];
  for (const change of changes) { const p = structuredClone(valid); change(p); assert.throws(() => validatePlan(p, { goal, sources: [] })); }
  for (const url of ['http://public.com', 'https://127.0.0.1', 'https://10.0.0.1', 'https://[::1]', 'https://user:pass@public.com', 'https://localhost', 'https://2130706433']) assert.throws(() => publicUrl(url));
});
