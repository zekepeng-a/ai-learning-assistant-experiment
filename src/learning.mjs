import { readFile, writeFile } from 'node:fs/promises';

const goal = 'javascript-functions';
const ids = ['parameters', 'return-values'];
const answers = ['parameter', 'return'];
const source = 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions';

function fail(message) { throw new Error(message); }
function keys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== [...expected].sort().join(',')) {
    fail('Invalid progress shape');
  }
}
function concept(id) {
  if (!ids.includes(id)) fail('Unknown concept');
}
function isCorrect(id, answer) {
  if (typeof answer !== 'string') fail('Answer must be a string');
  return answer.trim().toLowerCase() === answers[ids.indexOf(id)];
}
function validate(progress) {
  keys(progress, ['version', 'goal', 'events']);
  if (progress.version !== 1 || progress.goal !== goal || !Array.isArray(progress.events)) {
    fail('Unsupported or invalid progress');
  }
  let next = 0;
  for (const event of progress.events) {
    if (event?.type === 'exposure') {
      keys(event, ['type', 'conceptId']);
      concept(event.conceptId);
    } else if (event?.type === 'practice') {
      keys(event, ['type', 'conceptId', 'answer', 'correct', 'assisted']);
      concept(event.conceptId);
      if (event.conceptId !== ids[next] || typeof event.correct !== 'boolean' ||
          typeof event.assisted !== 'boolean' ||
          event.correct !== isCorrect(event.conceptId, event.answer)) fail('Invalid practice history');
      if (event.correct && !event.assisted) next++;
    } else fail('Invalid event');
  }
  return next;
}

export function createProgress(requestedGoal) {
  if (requestedGoal !== goal) fail('Unsupported goal');
  return { version: 1, goal, events: [] };
}

export function getNextAction(progress) {
  const next = validate(progress);
  if (next === ids.length) return null;
  return {
    conceptId: ids[next], sourceRefs: [source],
    explanation: next === 0
      ? 'A parameter names an input in a function definition.'
      : 'A return statement sends a result back to the caller.',
    practice: { question: next === 0
      ? 'What is the name for a named input in a function definition? Answer with one singular word.'
      : 'Which JavaScript keyword sends a result back from a function? Answer with one word.' },
    evidenceScope: 'These two checked answers only; not general competence.'
  };
}

function append(progress, event) {
  return { ...progress, events: [...progress.events.map(e => ({ ...e })), event] };
}

export function recordExposure(progress, conceptId) {
  validate(progress);
  concept(conceptId);
  return append(progress, { type: 'exposure', conceptId });
}

export function recordPractice(progress, conceptId, answer, options = { assisted: false }) {
  const next = validate(progress);
  concept(conceptId);
  keys(options, ['assisted']);
  if (typeof options.assisted !== 'boolean') fail('assisted must be boolean');
  if (conceptId !== ids[next]) fail('Practice must target the currently recommended concept');
  return append(progress, {
    type: 'practice', conceptId, answer,
    correct: isCorrect(conceptId, answer), assisted: options.assisted
  });
}

export async function saveProgress(file, progress) {
  validate(progress);
  await writeFile(file, JSON.stringify(progress, null, 2) + '\n', 'utf8');
}

export async function loadProgress(file) {
  const progress = JSON.parse(await readFile(file, 'utf8'));
  validate(progress);
  return progress;
}
