import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { createProgress, getNextAction, recordExposure, recordPractice, saveProgress, loadProgress } from './learning.mjs';

export async function run(args) {
  const [command, ...rest] = args;
  if (command === 'start' && rest.length === 2) {
    const progress = createProgress(rest[0]);
    // Exclusive creation prevents an accidental restart from erasing evidence.
    await writeFile(rest[1], JSON.stringify(progress, null, 2) + '\n', { flag: 'wx' });
    return progress;
  }
  if (command === 'next' && rest.length === 1) return getNextAction(await loadProgress(rest[0]));
  if (command === 'expose' && rest.length === 2) {
    const progress = recordExposure(await loadProgress(rest[0]), rest[1]);
    await saveProgress(rest[0], progress);
    return progress;
  }
  if (command === 'practice' && (rest.length === 3 ||
      (rest.length === 4 && rest[3] === '--assisted'))) {
    const progress = recordPractice(await loadProgress(rest[0]), rest[1], rest[2], { assisted: rest.length === 4 });
    await saveProgress(rest[0], progress);
    return progress;
  }
  throw new Error('Usage: start javascript-functions <file> | next <file> | expose <file> <concept> | practice <file> <concept> <answer> [--assisted]');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await run(process.argv.slice(2)))); }
  catch (error) {
    console.error(JSON.stringify({ error: error.message }));
    process.exitCode = 1;
  }
}
