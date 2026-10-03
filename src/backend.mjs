import { randomUUID } from 'node:crypto';
import { BackendStore } from './backend-store.mjs';
import { exact, text, fail, publicUrl, hash, canonical, planSchema, answerSchema, validatePlan, validateAnswer } from './backend-schema.mjs';

const stamp = () => ({ id: randomUUID(), createdAt: new Date().toISOString() });
let activeJobs = 0;
async function job(fn) {
  if (activeJobs >= 4) fail('Provider busy', 503);
  activeJobs++; let timer;
  const running = Promise.resolve().then(fn);
  // A timed-out provider keeps its slot until settlement: no unbounded orphan jobs.
  running.finally(() => { activeJobs--; }).catch(() => {});
  try { return await Promise.race([running, new Promise((_, reject) => { timer = setTimeout(() => { const e = new Error('Provider timeout'); e.status = 504; reject(e); }, 125000); })]); }
  catch (e) { fail(e.status === 504 ? 'Provider timeout' : 'Provider unavailable', e.status === 504 ? 504 : 502); }
  finally { clearTimeout(timer); }
}
export class LearningBackend {
  constructor({ dbFile, modelProvider, searchProvider }) {
    this.modelProvider = modelProvider; this.searchProvider = searchProvider;
    if (modelProvider) { exact(modelProvider.metadata, ['id', 'model', 'mode']); text(modelProvider.metadata.id, 100); text(modelProvider.metadata.model, 200); if (!['LIVE', 'TEST'].includes(modelProvider.metadata.mode) || typeof modelProvider.generate !== 'function') fail('Invalid model configuration'); }
    if (searchProvider && typeof searchProvider.search !== 'function') fail('Invalid search configuration');
    this.store = new BackendStore(dbFile);
  }
  close() { this.store.close(); }
  createGoal(input) {
    exact(input, ['subject', 'objective', 'level', 'weeklyHours']);
    const subject = text(input.subject, 200), objective = text(input.objective, 2000);
    if (!['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].includes(input.level) || !Number.isFinite(input.weeklyHours) || input.weeklyHours < 0.5 || input.weeklyHours > 80) fail();
    return this.store.transaction(() => this.store.insert('goal', null, { ...stamp(), subject, objective, level: input.level, weeklyHours: input.weeklyHours }));
  }
  listGoals() { return this.store.list('goal'); }
  getGoal(id) { return this.store.get('goal', text(id, 100)) ?? fail('Goal not found', 404); }
  source(input, kind) { exact(input, ['title', 'url', 'text']); const body = text(input.text, 32000); return { id: randomUUID(), title: text(input.title, 500), url: publicUrl(input.url), text: body, contentHash: hash(body), observedAt: new Date().toISOString(), provenance: { kind } }; }
  addSource(goalId, input) { this.getGoal(goalId); const s = { ...this.source(input, 'USER_SUPPLIED'), goalId }; return this.store.transaction(() => this.store.insert('source', goalId, s)); }
  listSources(goalId) { this.getGoal(goalId); return this.store.list('source', goalId); }
  async searchSources(goalId, input) {
    this.getGoal(goalId); exact(input, ['query']); const query = text(input.query, 500);
    if (!this.searchProvider) fail('Search not configured', 503);
    const results = await job(() => this.searchProvider.search({ query }));
    if (!Array.isArray(results) || results.length > 5) fail('Invalid search output', 502);
    let sources;
    try { sources = results.map(r => ({ ...this.source(r, 'SEARCH_SNIPPET'), goalId })); } catch { fail('Invalid search output', 502); }
    return this.store.transaction(() => sources.map(s => this.store.insert('source', goalId, s)));
  }
  listPlans(goalId) { this.getGoal(goalId); return this.store.list('plan', goalId); }
  getPlan(id) { return this.store.get('plan', text(id, 100)) ?? fail('Plan not found', 404); }
  metadata() { if (!this.modelProvider) fail('Model not configured', 503); return structuredClone(this.modelProvider.metadata); }
  recheck(goalId, sources) { const current = this.listSources(goalId); for (const s of sources) if (!current.some(c => c.id === s.id && c.contentHash === s.contentHash && canonical(c) === canonical(s))) fail('Source pins changed', 409); }
  async generatePlan(goalId, input) {
    const goal = this.getGoal(goalId); exact(input, ['sourceIds']);
    if (!Array.isArray(input.sourceIds) || input.sourceIds.length > 8 || new Set(input.sourceIds).size !== input.sourceIds.length) fail();
    const available = this.listSources(goalId);
    const sources = input.sourceIds.length ? input.sourceIds.map(id => { text(id, 100); return available.find(s => s.id === id) ?? fail('Unknown goal source'); }) : available.slice(0, 8);
    const provider = this.metadata();
    const raw = await job(() => this.modelProvider.generate({ kind: 'PLAN', goal: structuredClone(goal), sources: structuredClone(sources), plan: null, question: null, schema: planSchema }));
    let payload; try { payload = validatePlan(raw, { goal, sources }); } catch { fail('Invalid model plan', 502); }
    return this.store.transaction(() => {
      this.recheck(goalId, sources);
      return this.store.insert('plan', goalId, { ...stamp(), goalId, revision: this.listPlans(goalId).length + 1, status: 'AI_GENERATED_UNVERIFIED', grounding: sources.length ? 'PINNED_SOURCES' : 'MODEL_ONLY', provider, promptVersion: 'learning-backend-v1', sourceManifest: sources.map(({ id, contentHash, provenance, observedAt }) => ({ id, contentHash, provenance, observedAt })), payload, payloadHash: hash(canonical(payload)) });
    });
  }
  recordActivity(planId, input) {
    const plan = this.getPlan(planId); exact(input, ['stepId', 'kind', 'note', 'assisted']);
    if (!plan.payload.steps.some(s => s.id === input.stepId) || !['EXPOSURE', 'PRACTICE', 'REFLECTION'].includes(input.kind) || typeof input.assisted !== 'boolean') fail();
    const note = text(input.note, 4000, 0);
    return this.store.transaction(() => this.store.insert('activity', planId, { ...stamp(), planId, stepId: input.stepId, kind: input.kind, note, assisted: input.assisted }));
  }
  getProgress(planId) { this.getPlan(planId); const activities = this.store.list('activity', planId); const counts = { EXPOSURE: 0, PRACTICE: 0, REFLECTION: 0 }; for (const a of activities) counts[a.kind]++; return { activities, counts, mastery: 'UNPROVEN' }; }
  listAnswers(planId) { this.getPlan(planId); return this.store.list('answer', planId); }
  async ask(planId, input) {
    const plan = this.getPlan(planId); exact(input, ['question']); const question = text(input.question, 4000);
    const goal = this.getGoal(plan.goalId), available = this.listSources(goal.id), sources = plan.sourceManifest.map(pin => available.find(s => s.id === pin.id && s.contentHash === pin.contentHash) ?? fail('Source pin missing', 409));
    const provider = this.metadata();
    const raw = await job(() => this.modelProvider.generate({ kind: 'ANSWER', goal: structuredClone(goal), sources: structuredClone(sources), plan: structuredClone(plan), question, schema: answerSchema }));
    let answer; try { answer = validateAnswer(raw, sources); } catch { fail('Invalid model answer', 502); }
    return this.store.transaction(() => { this.recheck(goal.id, sources); return this.store.insert('answer', planId, { ...stamp(), planId, question, ...answer, status: 'AI_GENERATED_UNVERIFIED', advisory: true, provider }); });
  }
}
