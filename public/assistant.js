'use strict';
const $ = id => document.getElementById(id);
const state = { goals: [], goal: null, plans: [], plan: null, sources: [], model: {}, search: false, busy: false, loading: false, uncertain: false, epoch: 0 };
const levels = { BEGINNER: '初学者', INTERMEDIATE: '有一定基础', ADVANCED: '进阶学习' };
function node(tag, text, className) { const n = document.createElement(tag); if (text !== undefined) n.textContent = String(text); if (className) n.className = className; return n; }
function paragraph(parent, text, className) { parent.append(node('p', text, className)); }
function status(text) { $('status').textContent = text; }
async function api(path, data) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 135000);
  try {
    const response = await fetch(`/api/v1${path}`, { method: data === undefined ? 'GET' : 'POST', headers: data === undefined ? {} : { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data), signal: controller.signal });
    if (!response.ok) { const e = new Error('request'); e.status = response.status; throw e; }
    return await response.json();
  } finally { clearTimeout(timer); }
}
function errorText(e) { return ({ 400: '输入或资料不符合要求，请检查填写内容。', 403: '请求来源被拒绝，请使用服务器打印的 127.0.0.1 地址。', 404: '找不到对应记录，请重新读取。', 409: '资料状态发生变化，请重新读取。', 413: '内容过长，请缩短后重试。', 502: '模型服务不可用，或返回内容未通过校验。', 503: '服务尚未配置或正在忙碌。', 504: '模型处理超时。', 408: '请求处理超时。' })[e.status] || '连接中断或读取失败，请检查本地服务。'; }
function controls() {
  const locked = state.busy || state.loading;
  document.querySelectorAll('button,input,textarea,select').forEach(el => { el.disabled = locked; });
  $('generate-plan').disabled = locked || state.uncertain || !state.model.configured;
  $('regenerate').disabled = locked || state.uncertain || !state.model.configured || !state.goal;
  $('ask-submit').disabled = locked || state.uncertain || !state.model.configured || !state.plan;
  ['save-activity', 'mark-exposure'].forEach(id => { $(id).disabled = locked || state.uncertain || !state.plan; });
  $('add-source').disabled = locked || state.uncertain || !state.goal;
  $('search-button').disabled = locked || state.uncertain || !state.goal || !state.search;
  document.querySelector('.brand').setAttribute('aria-disabled', String(locked));
}
document.querySelector('.brand').addEventListener('click', e => { if (state.busy || state.loading) e.preventDefault(); });
async function mutate(label, fn) {
  if (state.busy || state.loading || state.uncertain) return;
  state.busy = true; controls(); const start = Date.now();
  const tick = () => status(`${label} · 已等待 ${Math.floor((Date.now() - start) / 1000)} 秒，请勿重复提交。`);
  tick(); const timer = setInterval(tick, 1000);
  try { await fn(); status('已保存。模型内容仍需独立核查。'); }
  catch (e) { state.uncertain = true; status(`${errorText(e)} 请求可能已经保存；请先点击“检查已保存结果”，再决定是否重试。`); }
  finally { clearInterval(timer); state.busy = false; controls(); }
}
function drawGoals() {
  $('goals').replaceChildren();
  if (!state.goals.length) paragraph($('goals'), '还没有目标，从一个好问题开始。', 'muted');
  for (const goal of state.goals) { const b = node('button', goal.subject, goal.id === state.goal?.id ? 'selected' : ''); b.type = 'button'; b.setAttribute('aria-current', String(goal.id === state.goal?.id)); b.addEventListener('click', () => selectGoal(goal)); $('goals').append(b); }
}
function citations(parent, ids) { paragraph(parent, ids.length ? `引用资料：${ids.join(' · ')}` : '无固定资料引用 · 模型生成，尚需独立核查', 'citation'); }
function sourceCard(source) {
  const d = node('details'); d.append(node('summary', source.title));
  paragraph(d, `资料 ID：${source.id}`); paragraph(d, `来源：${source.provenance.kind} · ${source.observedAt}`); paragraph(d, `内容指纹：${source.contentHash}`, 'citation');
  try { const u = new URL(source.url); if (u.protocol === 'https:' && !u.username && !u.password) { const a = node('a', '打开来源 ↗'); a.href = u.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; d.append(a); } } catch { /* Invalid metadata is never a link. */ }
  paragraph(d, source.text); return d;
}
function drawSources() {
  $('sources').replaceChildren(node('h3', '目标的已保存资料'));
  if (!state.sources.length) paragraph($('sources'), '暂无资料。可以使用模型知识生成，再独立核查。', 'muted');
  state.sources.forEach(s => $('sources').append(sourceCard(s)));
  $('pinned-sources').replaceChildren(node('h3', '当前版本固定引用'));
  for (const pin of state.plan?.sourceManifest || []) { const source = state.sources.find(s => s.id === pin.id && s.contentHash === pin.contentHash); if (source) $('pinned-sources').append(sourceCard(source)); else paragraph($('pinned-sources'), `固定记录未找到：${pin.id}`); }
  if (!state.plan?.sourceManifest.length) paragraph($('pinned-sources'), '当前版本未固定资料。', 'muted');
}
function panel(title) { const p = node('section', undefined, 'panel'); p.append(node('h2', title)); $('plan-content').append(p); return p; }
function drawStep() {
  const step = state.plan?.payload.steps.find(s => s.id === $('step-select').value); $('step-detail').replaceChildren();
  if (step) { paragraph($('step-detail'), `行动：${step.activity}`); paragraph($('step-detail'), `产出：${step.deliverable}`); paragraph($('step-detail'), `自查：${step.check}`); }
}
function drawPlan() {
  $('plan-content').replaceChildren(); $('side-path').replaceChildren(); $('step-select').replaceChildren();
  $('practice-panel').hidden = $('qa-panel').hidden = !state.plan;
  if (!state.plan) { panel('计划尚未生成').append(node('p', '目标已保存。配置模型后，点击“生成新版本”继续。')); drawSources(); return; }
  const p = state.plan, data = p.payload;
  const meta = panel(data.subject); const hours = data.steps.reduce((sum, s) => sum + s.estimatedHours, 0);
  paragraph(meta, `${state.goal.objective} · ${levels[state.goal.level]} · 每周 ${state.goal.weeklyHours} 小时`);
  paragraph(meta, `版本 ${p.revision} · ${p.provider.id} / ${p.provider.model} · ${p.createdAt}`, 'muted');
  paragraph(meta, p.provider.mode === 'TEST' ? 'TEST · 仅测试夹具，不代表真实模型质量' : 'AI_GENERATED_UNVERIFIED · AI 生成，未经核实', 'pill');
  paragraph(meta, p.grounding === 'PINNED_SOURCES' ? '已固定资料，引用仍需人工核查' : '模型生成，尚需独立核查');
  paragraph(meta, `预计共 ${hours} 小时 / ${(hours / state.goal.weeklyHours).toFixed(1)} 周，仅供安排参考。`);
  const logic = panel('先理解底层逻辑'); paragraph(logic, data.underlyingLogic); logic.append(node('h3', '核心问题')); const qs = node('ul'); data.coreQuestions.forEach(q => qs.append(node('li', q))); logic.append(qs);
  const concepts = panel('概念与依赖'); const names = new Map(data.concepts.map(c => [c.id, c.name]));
  for (const c of data.concepts) { const article = node('article'); article.append(node('h3', c.name)); paragraph(article, c.explanation); paragraph(article, `为什么重要：${c.whyItMatters}`); paragraph(article, `前置概念：${c.prerequisites.map(id => names.get(id) || id).join(' → ') || '无'}`, 'muted'); citations(article, c.sourceIds); concepts.append(article); }
  const steps = panel('可执行的学习路径'), list = node('ol');
  data.steps.forEach((s, i) => { const item = node('li'); item.append(node('h3', `${s.title} · 预计 ${s.estimatedHours} 小时`)); paragraph(item, `关联概念：${s.conceptIds.map(id => names.get(id) || id).join('、')}`); paragraph(item, `行动：${s.activity}`); paragraph(item, `产出：${s.deliverable}`); paragraph(item, `自查：${s.check}`); citations(item, s.sourceIds); list.append(item); $('side-path').append(node('li', s.title)); const option = node('option', `${i + 1}. ${s.title}`); option.value = s.id; $('step-select').append(option); }); steps.append(list);
  const limits = panel('常见误区与边界'); data.misconceptions.forEach(m => { paragraph(limits, m.description); paragraph(limits, `澄清：${m.correction}`); citations(limits, m.sourceIds); }); data.limitations.forEach(l => paragraph(limits, l, 'muted')); drawStep(); drawSources();
}
function drawHistory(progress, answers) {
  $('activity-history').replaceChildren(); paragraph($('activity-history'), `接触 ${progress.counts.EXPOSURE} 次 · 练习 ${progress.counts.PRACTICE} 次 · 反思 ${progress.counts.REFLECTION} 次`);
  for (const a of progress.activities) { paragraph($('activity-history'), `${a.createdAt} · ${a.kind} · ${a.stepId} · ${a.assisted ? '有协助' : '未标记协助'}\n${a.note}`); }
  $('answers').replaceChildren(); for (const a of answers) { const d = node('article'); d.append(node('h3', a.question)); paragraph(d, a.answer); paragraph(d, `${a.createdAt} · ${a.provider.model} · ${a.provider.mode === 'TEST' ? '仅测试' : '参考建议，未经核实'}`, 'muted'); a.limitations.forEach(l => paragraph(d, l, 'muted')); citations(d, a.sourceIds); $('answers').append(d); }
}
async function loadHistory(plan, epoch) {
  const [progress, answers] = await Promise.all([api(`/plans/${plan.id}/progress`), api(`/plans/${plan.id}/answers`)]);
  if (epoch === state.epoch && state.plan?.id === plan.id) drawHistory(progress, answers);
}
async function loadGoal(goal, preferredPlan) {
  const epoch = ++state.epoch;
  const [plans, sources] = await Promise.all([api(`/goals/${goal.id}/plans`), api(`/goals/${goal.id}/sources`)]);
  if (epoch !== state.epoch) return;
  state.goal = goal; state.plans = plans.sort((a, b) => b.revision - a.revision); state.sources = sources;
  state.plan = plans.find(p => p.id === preferredPlan) || plans[0] || null;
  $('goal-editor').hidden = true; $('goal-workspace').hidden = false; $('goal-title').textContent = goal.subject; $('goal-detail').textContent = goal.objective;
  $('plan-version').replaceChildren(); for (const p of state.plans) { const o = node('option', `版本 ${p.revision} · ${p.createdAt}`); o.value = p.id; $('plan-version').append(o); }
  if (state.plan) $('plan-version').value = state.plan.id;
  drawGoals(); drawPlan(); controls(); $('answers').replaceChildren(); $('activity-history').replaceChildren();
  if (state.plan) await loadHistory(state.plan, epoch);
}
async function readAction(fn, message = '已读取保存的记录。') {
  if (state.busy || state.loading) return; state.loading = true; controls();
  try { await fn(); status(message); } catch (e) { status(errorText(e)); } finally { state.loading = false; controls(); }
}
function selectGoal(goal) { return readAction(() => loadGoal(goal)); }
$('new-goal').addEventListener('click', () => { if (state.busy || state.loading) return; ++state.epoch; state.goal = state.plan = null; state.sources = []; $('goal-editor').hidden = false; $('goal-workspace').hidden = true; $('side-path').replaceChildren(); drawGoals(); drawSources(); controls(); $('subject').focus(); });
const examples = [['微积分', '理解导数与积分，并用它们解释变化率与面积'], ['水彩绘画', '掌握控水与混色，完成一幅水彩静物习作'], ['电路分析', '运用欧姆定律和基尔霍夫定律分析简单直流电路']];
document.querySelectorAll('[data-example]').forEach(b => b.addEventListener('click', () => { [$('subject').value, $('objective').value] = examples[Number(b.dataset.example)]; $('level').value = 'BEGINNER'; $('weekly-hours').value = '3'; }));
$('goal-form').addEventListener('submit', e => { e.preventDefault(); if (!state.model.configured) return; mutate('保存目标并生成计划', async () => { const goal = await api('/goals', { subject: $('subject').value.trim(), objective: $('objective').value.trim(), level: $('level').value, weeklyHours: Number($('weekly-hours').value) }); state.goal = goal; state.goals.push(goal); await loadGoal(goal); const p = await api(`/goals/${goal.id}/plans`, { sourceIds: [] }); await loadGoal(goal, p.id); }); });
$('regenerate').addEventListener('click', () => mutate('正在生成新版本', async () => { const p = await api(`/goals/${state.goal.id}/plans`, { sourceIds: [] }); await loadGoal(state.goal, p.id); }));
$('plan-version').addEventListener('change', () => readAction(async () => { ++state.epoch; state.plan = state.plans.find(p => p.id === $('plan-version').value); drawPlan(); $('answers').replaceChildren(); $('activity-history').replaceChildren(); await loadHistory(state.plan, state.epoch); }));
$('step-select').addEventListener('change', drawStep);
function record(kind) { return mutate('正在保存学习记录', async () => { await api(`/plans/${state.plan.id}/activities`, { stepId: $('step-select').value, kind, note: $('activity-note').value, assisted: $('assisted').checked }); await loadHistory(state.plan, state.epoch); $('activity-note').value = ''; }); }
$('mark-exposure').addEventListener('click', () => record('EXPOSURE'));
$('activity-form').addEventListener('submit', e => { e.preventDefault(); record('PRACTICE'); });
$('ask-form').addEventListener('submit', e => { e.preventDefault(); mutate('正在生成参考回答', async () => { await api(`/plans/${state.plan.id}/ask`, { question: $('question').value.trim() }); await loadHistory(state.plan, state.epoch); }); });
$('add-source-form').addEventListener('submit', e => { e.preventDefault(); mutate('正在保存资料；使用它需要生成新版本', async () => { await api(`/goals/${state.goal.id}/sources`, { title: $('source-title').value.trim(), url: $('source-url').value.trim(), text: $('source-text').value }); await loadGoal(state.goal, state.plan?.id); $('add-source-form').reset(); }); });
$('search-form').addEventListener('submit', e => { e.preventDefault(); mutate('正在搜索并保存资料摘要', async () => { await api(`/goals/${state.goal.id}/search`, { query: $('search-query').value.trim() }); await loadGoal(state.goal, state.plan?.id); }); });
async function refresh() {
  const [model, service, goals] = await Promise.all([api('/model-info'), api('/status'), api('/goals')]); state.model = model; state.search = service.searchConfigured; state.goals = goals;
  $('readiness').textContent = model.configured ? '模型已配置 · 未检测在线状态' : '模型未配置';
  $('model-detail').textContent = model.configured ? `${model.provider} / ${model.model}。实际调用可能失败；保留已存记录。` : '请在服务器端配置模型后重启。DeepSeek 需要 LEARNING_PROVIDER=deepseek 与 DEEPSEEK_API_KEY；浏览器不接收密钥。现有快照仍可阅读。';
  $('search-detail').textContent = state.search ? '搜索仅保存摘要，不代表互联网已核实。' : '未配置资料搜索，目前使用模型知识和用户提供的资料。';
  drawGoals(); if (state.goal) await loadGoal(state.goal); state.uncertain = false;
}
$('recover').addEventListener('click', () => readAction(refresh, '已检查保存的目标、最新计划、活动与回答。请确认结果后再决定是否重试。'));
readAction(refresh, '已读取目标。选择已有目标，或填写新的学习主题。');
