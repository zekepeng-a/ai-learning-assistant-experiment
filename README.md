# AI learning assistant experiment

The main product is a Chinese arbitrary-subject learning workspace served by the
existing backend, with SQLite history and server-side model/search providers. Use Node
22.13 or newer; no installation is required:

```sh
npm start
# Or directly:
node src/backend-server.mjs --port 4174
```

It binds to `127.0.0.1`, stores data in `.data/backend.sqlite`, and exposes an API
and the workspace at `/`. See [DEEPSEEK_WORKSPACE.md](docs/DEEPSEEK_WORKSPACE.md)
for DeepSeek setup, versioned plans, source pins, activity logging, advisory Q&A,
and recovery. For DeepSeek, set `LEARNING_PROVIDER=deepseek` and
`DEEPSEEK_API_KEY` in the server launch environment; the model is `deepseek-flash`.
The default OpenAI provider uses `OPENAI_API_KEY` and `LEARNING_MODEL`;
`TAVILY_API_KEY` optionally enables search.
Without configuration, those capabilities return 503 while goals and supplied
sources remain available. Keys stay server-side; `.env` is ignored but is not
automatically loaded. See [BACKEND_API.md](docs/BACKEND_API.md) for exact API
examples, setup, verification and limits. Plans and answers are unverified
advice; activity counts never establish mastery. No live-model quality proof or
acceptance is claimed.

Run all six checks directly without installation or live provider calls:

```sh
node tests/learning.test.mjs
node tests/web.test.mjs
node tests/backend.test.mjs
node tests/backend-http.test.mjs
node tests/deepseek-provider.test.mjs
node tests/assistant-workspace.test.mjs
```

`npm test` remains unchanged; `npm start` serves the real workspace.
DeepSeek PLAN instructions introduce one concept per ordered step, with review
in activity prose. Existing validation still independently rejects invalid plans.

The following describes the **legacy deterministic demo**, which remains
separate from the new backend and keeps its original JSON storage and browser UI.

A local, deterministic practice loop for one goal: `javascript-functions`.
It recommends parameters, then return values, with an MDN source link and an
original short explanation/question. No dependencies, network calls, or model APIs.

Use Node.js with ESM and the built-in test runner. Run from this repository:

For the Chinese browser workspace, no installation is needed:

```sh
npm run start:legacy
# Optional port and workspace-local data file (port 0 chooses a free port):
npm run start:legacy -- --port 4173 --data .data/progress.json
```

Open the printed `http://127.0.0.1:4173` address. The server binds only to
`127.0.0.1`; use that address rather than `localhost`. If Node is not on PATH:

```powershell
& 'C:\Users\ADMIN\nodejs\node.exe' src/server.mjs --port 4173
& 'C:\Users\ADMIN\nodejs\node.exe' --test tests/learning.test.mjs tests/web.test.mjs
```

Keep the terminal running while using the browser; press Ctrl+C to stop the
server. With `--port 0`, open the actual port printed in the terminal.
The default `.data/` directory is ignored by Git.

The browser restores progress from `.data/progress.json` by default. Reading
material never advances progress; a hint marks the next submitted answer as
assisted. Only an unaided correct answer advances. Reset requires confirmation
and clears the history. Corrupt data produces an error without being overwritten;
retry after repairing the file, or explicitly restart to discard it. After a
request failure, reload the state before submitting again to check whether the
previous request was saved. All UI assets are local; only the optional MDN source
link leaves the app when clicked. No outbound application requests occur.

`createLearningServer({progressFile})` in `src/server.mjs` returns an unbound
Node HTTP server. Browser API writes are serialized with reads and saved through
a temporary file plus rename. Use one server/writer per data file; do not run the
CLI against the same file while the server is active. The APIs are `GET /api/state`,
`POST /api/exposure` with `{conceptId}`, `POST /api/practice` with
`{conceptId,answer,assisted}`, and `POST /api/reset` with `{confirm:true}`.
POST bodies must use JSON, contain exactly the specified fields, and fit in 16 KiB.
Successful API responses contain `{progress,nextAction}`. Browser mutations must
be same-origin. Learning completion concerns only the two exercises.

The original command-line workflow is also available:

```sh
node src/cli.mjs start javascript-functions progress.json
node src/cli.mjs next progress.json
node src/cli.mjs expose progress.json parameters
node src/cli.mjs practice progress.json parameters parameter --assisted
node src/cli.mjs practice progress.json parameters parameter
node src/cli.mjs next progress.json
node src/cli.mjs practice progress.json return-values return
node src/cli.mjs next progress.json
node --test tests/learning.test.mjs
```

`npm test` runs `node --test tests/*.test.mjs`; no installation is needed.
If Node is absent from PATH in this environment, use PowerShell:

```powershell
& 'C:\Users\ADMIN\nodejs\node.exe' --test tests/learning.test.mjs
```

Commands emit JSON. Errors emit a JSON error on stderr and exit nonzero.
`start` refuses to overwrite an existing file. Use a workspace-local progress
path; commands do not create parent directories. `next` returns JSON `null` after
both fixtures have been answered correctly without assistance.

The answers are `parameter` and `return`, compared after trimming whitespace and
lowercasing. All other strings are wrong; input is never executed. Exposure and
assisted correct answers remain in history but do not advance the recommendation.
Practice must target the current recommendation, including after reload. Exposure
may be recorded for either known concept at any time.

`src/learning.mjs` exports `createProgress(goal)`, `getNextAction(progress)`,
`recordExposure(progress, conceptId)`, `recordPractice(progress, conceptId, answer,
{ assisted: false })`, and asynchronous `saveProgress(file, progress)` /
`loadProgress(file)`. Recording returns a new progress object. Progress has
`version: 1`, `goal`, and an ordered `events` array; practice events retain the
answer, correctness, and assistance flag. Loading validates the entire history
and fails on missing, corrupt, unsupported, or inconsistent data without resetting
it. Local JSON is inspectable evidence, not authenticated assessment. Use one
writer at a time; file writes are not a transactional or concurrent storage system.

Correct answers demonstrate only performance on these two checked fixtures.
They do not establish broad mastery, independent transfer, or learning benefit.
There is no mastery score, curriculum generation, BKT, or control-plane feature.

Sources and bounded decisions are recorded in
[PRECEDENT_DECISIONS.md](docs/PRECEDENT_DECISIONS.md). The discovery document and
contract are immutable inputs. Passing software checks does not grant acceptance;
human review and learning-effectiveness validation remain separate.
