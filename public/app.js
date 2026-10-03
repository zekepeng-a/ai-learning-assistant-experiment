const $ = id => document.getElementById(id);
const concepts = {
  parameters: {
    title: '函数参数：给输入一个名字', short: '函数参数',
    explanation: '参数是在函数定义中，为输入取的名字。调用函数时传入具体的值，函数便能用这个名字使用它。',
    code: 'function greet(name) {\n  console.log("你好，" + name);\n}\n\ngreet("小林");  // 你好，小林',
    caption: 'name 是定义中的参数；“小林”是调用时传入的具体值。',
    question: '函数定义中，用来命名输入的项，英文叫什么？请用单数形式回答。',
    hint: '提示：参数的英文是 parameter。本次作答已标记为辅助，不会推进进度。'
  },
  'return-values': {
    title: '返回值：把结果交还给调用者', short: '返回值',
    explanation: '函数可以计算一个结果，再通过返回语句将它交给调用者。这样，你就能保存这个结果，或在下一步继续使用它。',
    code: 'function double(number) {\n  return number * 2;\n}\n\nconst result = double(3);  // 6',
    caption: 'return 把计算结果交回；result 接住了返回的数值 6。',
    question: 'JavaScript 中，哪个关键字会把结果从函数传回？请用一个英文单词回答。',
    hint: '提示：把结果传回的关键字是 return。本次作答已标记为辅助，不会推进进度。'
  }
};
let state = null;
let busy = false;
let available = false;
let assisted = false;
let current = null;

function controls() {
  for (const id of ['answer', 'submit', 'hint', 'exposure']) $(id).disabled = busy || !available || !state?.nextAction;
  $('hint').disabled ||= assisted;
  for (const id of ['restart', 'restart-done', 'retry']) $(id).disabled = busy;
  $('submit').textContent = busy ? '处理中…' : '提交答案 →';
  $('answer-form').setAttribute('aria-busy', String(busy));
}
function feedback(text, kind) {
  $('feedback').hidden = false;
  $('feedback').className = `feedback ${kind}`;
  $('feedback').textContent = text;
}
function render() {
  const { progress, nextAction } = state;
  const next = nextAction?.conceptId || null;
  if (next !== current) {
    assisted = false;
    $('answer').value = '';
    $('hint-text').hidden = true;
    current = next;
  }
  const completed = progress.events.filter(e => e.type === 'practice' && e.correct && !e.assisted).length;
  $('progress').value = completed;
  $('progress-label').textContent = `已完成 ${completed} / 2 道练习`;
  $('progress-percent').textContent = `${completed * 50}%`;
  Object.keys(concepts).forEach((id, index) => {
    const done = index < completed;
    $(`path-${id}`).className = done ? 'done' : id === next ? 'active' : '';
    $(`status-${id}`).textContent = done ? '已独立答对' : id === next ? '正在学习' : '下一步';
    if (id === next) $(`path-${id}`).setAttribute('aria-current', 'step');
    else $(`path-${id}`).removeAttribute('aria-current');
  });
  $('lesson').hidden = !next;
  $('practice').hidden = !next;
  $('completion').hidden = Boolean(next);
  if (next) {
    const lesson = concepts[next];
    $('lesson-number').textContent = `LESSON ${next === 'parameters' ? '01' : '02'} / 02`;
    $('lesson-title').textContent = lesson.title;
    $('explanation').textContent = lesson.explanation;
    $('code-example').textContent = lesson.code;
    $('code-caption').textContent = lesson.caption;
    $('question').textContent = lesson.question;
    $('source').href = nextAction.sourceRefs[0];
  }
  $('history-count').textContent = `${progress.events.length} 条`;
  $('history-empty').hidden = progress.events.length > 0;
  $('history').replaceChildren();
  [...progress.events].reverse().forEach((event, index) => {
    const item = document.createElement('li');
    const title = document.createElement('strong');
    const detail = document.createElement('p');
    const label = event.type === 'exposure' ? '阅读材料' : event.assisted ? (event.correct ? '辅助答对' : '辅助尝试 · 未答对') : event.correct ? '独立答对' : '尝试 · 未答对';
    title.textContent = `${String(progress.events.length - index).padStart(2, '0')} · ${concepts[event.conceptId].short}`;
    detail.textContent = `${label}${event.type === 'practice' ? ` · ${event.answer || '（空答案）'}` : ' · 不计入完成'}`;
    item.className = event.type === 'exposure' ? 'read' : event.assisted ? 'assisted' : event.correct ? 'correct' : 'wrong';
    item.append(title, detail);
    $('history').append(item);
  });
}

async function request(path, body) {
  if (busy) return;
  busy = true;
  controls();
  $('error-box').hidden = true;
  $('connection').textContent = body ? '正在保存本地记录…' : '正在读取本地记录…';
  try {
    const response = await fetch(path, body === undefined ? { cache: 'no-store' } : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '请求失败。');
    state = result;
    available = true;
    if (path === '/api/practice') {
      const event = state.progress.events.at(-1);
      const name = concepts[event.conceptId].short;
      if (event.assisted) feedback(`${name}：${event.correct ? '在提示帮助下答对了' : '使用提示后仍未答对'}。本次不推进进度；下一次请尝试独立回答。`, 'assisted');
      else if (event.correct) feedback(`${name}：独立答对！${state.nextAction ? '已进入返回值练习。' : '两道练习均已完成。'}`, 'correct');
      else feedback(`${name}：还差一点。再看看示例，检查英文单词后重试。`, 'wrong');
      assisted = false;
      $('hint-text').hidden = true;
      $('answer').value = '';
    } else if (path === '/api/exposure') feedback('已记录阅读。阅读材料不会推进练习进度。', 'read');
    else if (path === '/api/reset') {
      assisted = false;
      $('answer').value = '';
      $('hint-text').hidden = true;
      feedback('学习记录已重置。从函数参数重新开始。', 'read');
    }
    render();
    $('connection').textContent = '本地记录已同步';
  } catch (error) {
    available = false;
    $('error-message').textContent = `${error.message} 请重新读取记录，确认上次操作是否已保存，再继续。`;
    $('error-box').hidden = false;
    $('connection').textContent = '记录尚未同步';
  } finally {
    busy = false;
    controls();
  }
}

$('answer-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!available || !state?.nextAction || busy) return;
  request('/api/practice', { conceptId: state.nextAction.conceptId, answer: $('answer').value, assisted });
});
$('hint').addEventListener('click', () => {
  if (busy || !available || !current) return;
  assisted = true;
  $('hint-text').textContent = concepts[current].hint;
  $('hint-text').hidden = false;
  controls();
  $('answer').focus();
});
$('exposure').addEventListener('click', () => request('/api/exposure', { conceptId: current }));
function restart() {
  if (!busy && window.confirm('确定清空本地学习记录并重新开始吗？此操作无法撤销。')) request('/api/reset', { confirm: true });
}
$('restart').addEventListener('click', restart);
$('restart-done').addEventListener('click', restart);
$('retry').addEventListener('click', () => request('/api/state'));
request('/api/state');
