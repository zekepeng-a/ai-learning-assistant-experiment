# Local learning backend

This separate API supports arbitrary learner subjects, immutable SQLite history,
pinned source observations, generated plans, advisory answers and activity logs.
It does not replace or connect to the legacy browser demo. The original backend
contract remains unchanged. The previously dispatched implementation was
unaccepted input; passing the checks here does not grant acceptance.

## Start and configuration

Use Node **22.13 or newer** with built-in `node:sqlite`. No package installation is
needed. From the repository root:

```sh
npm run start:backend
# Optional: port 0 prints an available port; the custom DB parent must exist.
npm run start:backend -- --port 0 --db .data/my-learning.sqlite
# Equivalent direct execution:
node src/backend-server.mjs --port 4174
```

The default DB is `.data/backend.sqlite`; its parent is created automatically.
Use a trusted workspace-local database path. Legacy JSON files are neither
migrated nor reset. Reopening a valid database preserves IDs, source pins, plan
hashes, revisions, activities, answers and append-only events. Invalid databases
fail rather than silently resetting. Stop with Ctrl+C.

With no provider configuration, goals and user-supplied sources still work.
Generating plans or answers returns 503; search returns 503 independently. There
is no fallback curriculum or fixture provider in the CLI.

Optional server-process environment variables:

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI API credential; both this and `LEARNING_MODEL` are required for the model capability |
| `LEARNING_MODEL` | Model identifier for an OpenAI Responses model supporting strict structured outputs |
| `TAVILY_API_KEY` | Optional Tavily search credential |

Supply these through your local process environment. Keys never belong in browser
code, request bodies, source text or committed files. `.env`, `.env.*` (except
`.env.example`) and `.data/` are ignored; the server does **not** load `.env`
automatically. Tests use fake strings and injected fetch, never credentials.

The implementation targets OpenAI Responses specifically, not every
OpenAI-compatible service: fixed `POST https://api.openai.com/v1/responses`,
`store:false`, strict `text.format.json_schema`, maximum 12,000 output tokens.
Only completed responses with one output text and no refusal are accepted.
Optional Tavily uses fixed `POST https://api.tavily.com/search`, bearer auth,
basic depth and at most five results. Submitted source URLs are never fetched.
Provider requests reject redirects, bound responses to 512 KiB, time out within
20 seconds and do not retry automatically. Public errors omit upstream bodies.

## HTTP interface

Bind and connect only to `127.0.0.1` (default port 4174). The exact
`Host: 127.0.0.1:<actual-port>` is required; `localhost` is rejected. Browser
writes must have the same origin. Cross-site writes and OPTIONS are rejected;
there is no permissive CORS. This is a local single-user service with no
multi-user authentication or remote deployment claim.

All POST bodies must contain exactly the documented fields, use
`Content-Type: application/json` (optional UTF-8 charset), and fit in 128 KiB.
GET responses are 200. Successful POSTs return 201 and the created object (search
returns an array). GET collections return arrays. Errors are `{ "error": "..." }`:
400 invalid fields, 403 Host/origin rejection, 404 missing resource, 405 unsupported
method, 413 oversized body, 415 wrong content type, 502 failed/invalid provider
output, 503 unavailable capability or busy, 504 backend provider-job timeout.
Request handling is bounded at 30 seconds, with at most four active provider jobs
per process and no waiting job queue. Queries and fragments are unsupported.

| Method and path | Exact POST fields / result |
| --- | --- |
| GET `/api/v1/status` | `{modelConfigured,searchConfigured,scope:"LOCAL_SINGLE_USER"}`; configuration flags are not live health probes |
| GET / POST `/api/v1/goals` | List goals / `{subject,objective,level,weeklyHours}` |
| GET `/api/v1/goals/:id` | Goal including immutable input, ID and timestamp |
| GET / POST `/api/v1/goals/:id/sources` | List sources / `{title,url,text}` |
| POST `/api/v1/goals/:id/search` | `{query}`; persisted source snippets |
| GET / POST `/api/v1/goals/:id/plans` | List snapshots / `{sourceIds:[]}` |
| GET `/api/v1/plans/:id` | Full immutable snapshot |
| POST `/api/v1/plans/:id/activities` | `{stepId,kind,note,assisted}` |
| GET `/api/v1/plans/:id/progress` | `{activities,counts,mastery:"UNPROVEN"}` |
| POST `/api/v1/plans/:id/ask` | `{question}`; persisted advisory answer |

Subjects are trimmed 1–200 characters; objectives 1–2,000. Level is `BEGINNER`,
`INTERMEDIATE` or `ADVANCED`; weekly hours is a finite number from 0.5 to 80.
Source titles are 1–500 characters, text 1–32,000 and URLs at most 2,048. Source
URLs require public-looking HTTPS hostnames: credentials, IP literals, private
or local names and nonstandard ports are rejected. URL validation does not
establish ownership, truth or trustworthiness. Queries are 1–500 characters.

### Example session (PowerShell)

Run against your printed port. The first three calls work without a model;
plan generation and ask require model configuration. The search call requires
Tavily configuration and is optional. These are usage examples, not live calls
performed during development.

```powershell
$base = 'http://127.0.0.1:4174/api/v1'
Invoke-RestMethod "$base/status"
$goal = Invoke-RestMethod "$base/goals" -Method Post -ContentType 'application/json' -Body '{"subject":"Map reading","objective":"Interpret contour maps","level":"BEGINNER","weeklyHours":2}'
$source = Invoke-RestMethod "$base/goals/$($goal.id)/sources" -Method Post -ContentType 'application/json' -Body '{"title":"My contour notes","url":"https://www.usgs.gov/maps","text":"Contours connect equal elevations. User-supplied observation, not a verified page extract."}'
$selection = @{ sourceIds = @($source.id) } | ConvertTo-Json -Compress
$plan = Invoke-RestMethod "$base/goals/$($goal.id)/plans" -Method Post -ContentType 'application/json' -Body $selection
Invoke-RestMethod "$base/plans/$($plan.id)"
$activity = @{ stepId = $plan.payload.steps[0].id; kind = 'PRACTICE'; note = 'Annotated two maps'; assisted = $true } | ConvertTo-Json -Compress
Invoke-RestMethod "$base/plans/$($plan.id)/activities" -Method Post -ContentType 'application/json' -Body $activity
Invoke-RestMethod "$base/plans/$($plan.id)/progress"
Invoke-RestMethod "$base/plans/$($plan.id)/ask" -Method Post -ContentType 'application/json' -Body '{"question":"How should I compare contour intervals?"}'
# Optional search adds observations; it does not change the existing plan pins:
Invoke-RestMethod "$base/goals/$($goal.id)/search" -Method Post -ContentType 'application/json' -Body '{"query":"contour map intervals"}'
```

Each source stores its ID, goal ID, title, URL, trimmed text, SHA-256 content hash,
observation timestamp and `USER_SUPPLIED` or `SEARCH_SNIPPET` provenance. Search
snippets are original pinned observations, not full-page reads or verified truth.
A failed search inserts nothing.

Plan selection accepts at most eight unique IDs from the goal. An empty array
selects up to eight existing sources in insertion order; it means model-only
only when no sources exist. Unknown or cross-goal IDs fail before generation.
Each generation creates a new ID and revision, never updates an earlier plan.
Snapshots include `goalId`, `revision`, `status:AI_GENERATED_UNVERIFIED`,
`grounding:MODEL_ONLY|PINNED_SOURCES`, `{id,model,mode}` provider metadata,
`promptVersion`, `createdAt`, `sourceManifest`, `payload` and `payloadHash`.
The manifest pins IDs, hashes, provenance and observation times; the payload hash
is SHA-256 of recursively key-sorted JSON. `LIVE` describes provider mode, not
verification of its output; injected fixtures are marked `TEST`.

Payloads contain `subject`, `underlyingLogic`, `coreQuestions`, `concepts`,
`steps`, `misconceptions` and `limitations`. See exported `planSchema` and
`validatePlan` in `src/backend-schema.mjs` for exact nested bounds. Validation
requires 2–24 concepts and steps, prior-step prerequisites, complete concept
coverage, concrete practice/deliverable/check fields, and only selected source
citations. Cycles, extra fields and invalid outputs fail without repair or
partial plan writes. Source text is sent as untrusted data.

Activity kinds are `EXPOSURE`, `PRACTICE` and `REFLECTION`; `stepId` must belong to
the plan, `note` is at most 4,000 characters (empty allowed), and `assisted` is a
boolean. Questions are 1–4,000 characters. Answers contain `answer`, `sourceIds`,
`limitations`, ID, timestamp, plan ID, question, provider metadata,
`advisory:true` and `status:AI_GENERATED_UNVERIFIED`. Citations can reference only
that plan's pinned sources. Invalid answers persist nothing. There is no answer
history HTTP endpoint; persisted history remains in SQLite.

## Verification and limits

Run each test file directly, without test-runner worker processes:

```sh
node tests/backend.test.mjs
node tests/backend-http.test.mjs
node tests/learning.test.mjs
node tests/web.test.mjs
```

Backend tests cover SQLite reopen persistence, isolated goals, immutable history,
hashes, revisions, atomic invalid writes and schema failures. Recording fixtures
for three disciplines test wiring and distinct subject inputs. The independent
HTTP fixtures exercise real loopback routes, model/search unavailable responses,
body/field/Host/Origin rejection, activities, pinned advisory answers and busy
responses. Injected fetch tests check provider protocol, rate limits, refusal,
incomplete output, invalid JSON, response bounds and timeout/abort behavior.
Temporary databases stay inside the workspace and are removed.

These checks establish tested software behavior only. No live model or search
was exercised, no curriculum quality or learning benefit was proven, and no full
internet corpus was read. Schema validation cannot prove factual accuracy,
effective practice or resistance to every prompt injection. Model output,
exposure, assistance and self-reported activity never establish mastery or
Acceptance: progress always reports `UNPROVEN`. No pCOS state is changed.
