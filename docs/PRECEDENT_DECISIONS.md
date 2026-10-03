# Precedents and bounded decisions

FACT: The supplied discovery document and `DOGFOOD_CONTRACT.json` are the evidence
inputs for this implementation. Source observations below are attributed to those
inputs; no source was fetched or independently re-inspected during implementation.

FACT: The supplied OATutor observation describes `update(model,isCorrect)` as
conditioning its update on correctness and configured slip/guess/transit
probabilities. Source: [OATutor update function](https://raw.githubusercontent.com/CAHLR/OATutor/main/src/models/BKT/BKT-brain.js).

INFERENCE: Explicit observations can inform a next action without importing a
probabilistic mastery estimate whose assumptions are unvalidated for this task.

ADOPTED PROJECT DECISION: Preserve correctness and assistance on each practice
event. Exclude assisted answers from advancement. Do not implement BKT or a
permanent mastery score.

FACT: The supplied Kolibri Learn guide observation distinguishes viewing/reading
resources from practice exercises; checked answers feed progress and next resource
selection. Source: [Kolibri Learn guide](https://kolibri.readthedocs.io/en/latest/learn.html).

ADOPTED PROJECT DECISION: Store exposure separately from practice. Exposure never
advances the recommended exercise. Preserve wrong answers and assisted work as
history. Do not copy Kolibri completion thresholds or classroom infrastructure.

FACT: The supplied MDN observation identifies explanations of parameters and return
values. Source: [MDN Functions guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions).

ADOPTED PROJECT DECISION: Support only `javascript-functions`, in the fixed order
`parameters`, `return-values`. Each next action links to MDN and includes an original
short explanation and question. No source code or curriculum is copied. Exact
checked words are `parameter` and `return`, ignoring surrounding whitespace and
case. Treat all other strings as incorrect and never evaluate input as code.

ADOPTED PROJECT DECISION: Only an unaided correct answer advances the current
fixture. Reject practice for any other concept or after completion. Return `null`
when both fixtures are demonstrated; this is not a claim of general competence.
Allow exposure to either known concept at any point, since reading is independent
of the practice sequence. Record functions return new objects, preserving prior
history. Omitted practice options mean `{ assisted: false }`; explicit flags must
be booleans.

ADOPTED PROJECT DECISION: Use built-in Node modules, ESM, a small JSON CLI, and local
version-1 JSON event history. Replay and validate the complete event sequence on
load and before use/save, rejecting unsupported schemas, malformed events,
inconsistent correctness, and impossible practice ordering. Never silently reset
invalid data. Refuse CLI `start` on an existing file. Storage is single-writer and
not crash-atomic; a corrupt file fails closed and requires user-directed recovery.

INFERENCE: A small traceable practice loop makes stronger software-test evidence
than a generated learning-path document. User benefit remains unproven. These two
word checks do not establish retention, transfer, or broad JavaScript skill.

ADOPTED PROJECT DECISION: Keep the implementation bounded to the six required
files. Add no dependencies, network/model calls, agents, authentication, generated
curriculum, control-plane code, or Project Control OS changes. Test behavior with
the built-in Node runner; temporary fixtures stay inside this repository and are
removed. Preserve both input documents byte-for-byte. This implementation report
and passing tests do not grant acceptance.
