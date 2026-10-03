# Local learning workspace

Use Node 22.13 or newer. No installation or separate frontend server is needed.
Run `npm start` (or `node src/backend-server.mjs --port 4174`) and open the
printed `http://127.0.0.1:4174` address. `npm run start:backend` is equivalent.
`npm run start:legacy` runs the preserved deterministic lesson demo on 4173.
The original CLI, lesson files, public assets and tests remain available.

The server stores immutable goals, source records, plan versions, activities
and advisory answers in `.data/backend.sqlite`. Use `--db` for another trusted
workspace-local file, and one server per database. Restarting restores records.

For DeepSeek, configure `LEARNING_PROVIDER=deepseek` and `DEEPSEEK_API_KEY` in
the server's launch environment; optionally set `LEARNING_MODEL` (the existing
provider default and only supported DeepSeek model is `deepseek-flash`). An
explicit DeepSeek selection without its key stays unavailable, with no fallback.
The application does not load `.env`.
No browser key fields exist. Keys belong exclusively to the server. No credentials
were inspected and no live provider calls were made while implementing this UI.

“已配置” reflects configuration, not connectivity or quality. With no provider,
saved plans remain readable and generation is disabled. An explicitly injected
TEST provider is labeled test-only in stored plans and answers. Optional search
requires server-side `TAVILY_API_KEY`; otherwise its button stays disabled.

Choose an existing goal or fill any subject, concrete objective, starting level,
and weekly hours. Example chips only fill fields. Saving a goal and generating a
plan are separate requests: a saved goal survives a generation failure. Version
selection reads immutable snapshots; “生成新版本” explicitly requests a new one.
No model request happens on page load, goal selection, recovery, or version change.

Read the foundational explanation, concept dependencies and ordered actions.
DeepSeek PLAN instructions teach every concept exactly once, with exactly one
new concept ID per step and all prerequisites in earlier steps. Reviews refer to
earlier knowledge in activity prose, never cumulative or prerequisite IDs in
`conceptIds`. ANSWER output remains limited to `answer`, `sourceIds`, and
`limitations`. The independent validator and API/settings are unchanged; this
prompt repair does not prove that a live model will always comply.

Select a step to record exposure or a practice note with an assistance flag.
Counts are a history of activity, never proof of mastery. Q&A is advisory and its
saved answers reload with their plan. `GET /api/v1/plans/:id/answers` validates
the plan exists and returns already persisted records without generating anything.

Sources store pasted text and HTTPS metadata without fetching the URL. Generate
a new version to use added sources (the backend selects up to eight). The current
snapshot keeps its original grounding and source manifest. MODEL_ONLY means model
knowledge requiring independent checks; PINNED_SOURCES means fixed source records,
not verified truth. Search summaries and citations also need human verification.

During writes, navigation and duplicate submission are disabled. Elapsed seconds
are actual elapsed time. The browser deadline is 135 seconds; existing provider,
job and HTTP deadlines remain 90, 125 and 130 seconds respectively for DeepSeek.
There are no automatic retries or fallbacks.
After a failed or uncertain write, use “检查已保存结果” to read goals, the selected
goal's latest plans, activities and answers before explicitly retrying. A failed
response does not establish that nothing was saved. If goal creation's response
was lost, inspect the refreshed goal list before creating another goal.

Only `/`, `/assistant.js`, `/assistant.css`, and `/styles.css` are served as fixed
assets. Same-origin API calls retain Host/Origin checks, no CORS, and a self-only
CSP. Dynamic text is rendered through `textContent` and DOM creation. Source links
require HTTPS and open with `noopener noreferrer`.

Run the six direct Node commands listed in [README.md](../README.md), or
`node --test tests/*.test.mjs`. Workspace HTTP tests inject TEST fixtures,
use loopback HTTP and remove temporary SQLite directories inside this repository.
They do not use credentials, external network, subprocesses, or live models.
Browser layout/accessibility and real-provider validation are separate host checks;
these tests do not establish model quality or learning effectiveness.
