# AI Learning Assistant Experiment — Discovery

Research date: 2026-10-02 (Asia/Hong_Kong)  
Phase: Discovery / Research only  
Status: Awaiting human review  
Decision: Component feasibility is supported; product demand and end-to-end learning effectiveness remain unvalidated.

## 1. Research summary

### Scope and evidence rules

This is an independent experiment. Project Control OS is only the control and verification basis. This phase makes no changes to it, creates no architecture layers, selects no implementation stack, installs no dependencies, and produces no production code.

The hypothesis is that a learner can state a goal and receive help understanding a domain, identifying concepts, choosing a path, practicing, and tracking progress. The hypothesis is not treated as a requirement proven by research.

Labels used throughout:

- **FACT:** An observed repository, source file, official document, maintenance record, or primary study. A README statement is evidence of what maintainers document, not independent proof that a feature works or that users benefit.
- **INFERENCE:** An interpretation of cited observations, including likely user value and limitations inferred from a mechanism.
- **PROPOSAL:** A possible future product or research choice requiring review.
- **OPEN QUESTION:** An unresolved matter. Failure to find evidence does not establish absence.

Method: search across the six requested categories; examine primary repositories, official guides, commits/releases, selected source files/manifests, and a learning-outcome study; compare mechanisms before considering a product direction. Stars were not used as evidence of utility, quality, adoption, or learning outcomes. Commit volume was not used as a success measure.

This was desk research, not a runtime audit. No projects were installed or executed; no learners were interviewed. GitHub pages sometimes returned incomplete file listings or rate limits. Raw source and official documentation were used where available. A direct GitHub API request from the local shell could not connect; maintenance observations therefore come from browser-accessible pages. These pages may be cached. Dates below identify observed records, not a guarantee of the latest commit as of today. Branch links are mutable; release tags and cited commit identifiers provide firmer maintenance anchors. The study is dated separately from the software snapshot.

### Selection and maturity assessment

**INFERENCE:** Maturity is multidimensional: sustained maintenance, documented workflows, operational support, actual use, and outcome evidence must be considered separately. An established project can have an experimental current branch; a polished demo can lack adoption evidence.

| Project | Coverage | FACT: maintenance/documentation observation | Usage/effectiveness evidence and assessment |
|---|---|---|---|
| OATutor | Adaptive tutor; AI-assisted educational help | [Commit history](https://github.com/CAHLR/OATutor/commits) includes September 2026 fixes; `3e20cbd` on September 24. README explains skill mapping, hints, answer checks, and BKT. | [Repository](https://github.com/CAHLR/OATutor) reports classroom pilots; primary study examined 274 participants. Strongest direct learning-outcome evidence in this sample, within a narrow setting. |
| Kolibri | Learning platform; practice and progress | [Releases](https://github.com/learningequality/kolibri/releases) show stable `v0.19.5` (`f7cafd4`) and `v0.20.0-alpha1` (`428d58d`); coach guide and patch notes are detailed. | [Official impact reports](https://learningequality.org/impact/our-impact/) describe named programs and partners. Deployment evidence is stronger than most AI-specific candidates; do not attribute results from predecessor KA Lite to Kolibri. |
| Anki | Personal learning; review scheduling | [Release 26.09.3](https://github.com/ankitects/anki/releases/tag/26.09.3), September 23, and multiple preceding stable/beta releases; extensive study manual. | Actual operational concerns appear in release fixes, including card state and Windows upgrades. Sustained ecosystem evidence, not an audited active-user count or proof of engineering skill transfer. |
| developer-roadmap / roadmap.sh | Domain maps; learning paths | [History](https://github.com/nilbuild/developer-roadmap/commits/master/) shows September 1, 2026 content work (`64d2a72`) and contributed resource changes. | Public educational site and merged contributions demonstrate a content workflow. Traffic, completion, and learning impact were not verified. Established map/content reference. |
| Logseq | Personal knowledge management; linked knowledge | [History](https://github.com/logseq/logseq/commits/master/) shows September 8, 2026 fixes (`be800f1`) and import work; extensive DB documentation. | Import, sync, and data-recovery workflows indicate operational depth. Current DB beta/mobile and RTC alpha must be distinguished from the established project. No learning-outcome evidence examined. |
| Khoj | Personal AI knowledge assistant; custom agents | [History](https://github.com/khoj-ai/khoj/commits/master/) includes August 2, 2026 export/privacy changes (`ae229ca`, `4d7ac85`); model integrations and retrieval guide. | README claims thousands of users; this is unverified maintainer reporting. Cloud-deprecation-related commits constrain any assumption of service continuity. Established mechanism reference with lifecycle uncertainty. |
| OpenTutor (`zijinz456`) | AI tutor; educational agents; learning workspace | [History](https://github.com/zijinz456/OpenTutor/commits/main) shows September 2026 repository-health/marketing commits. [Experimental status matrix](https://raw.githubusercontent.com/zijinz456/OpenTutor/main/docs/experimental-status-matrix.md) identifies flags and integration states. | No independently verified sustained learner usage or learning gains found in reviewed sources. Recent activity is not sufficient proof of product maintenance. Emerging comparison, not a mature effectiveness benchmark. |
| Enterprise DNA AI Learning Path Generator | Goal-to-path generation | [History](https://github.com/Enterprise-DNA-OS/ai-learning-path-generator/commits/main/) retrieved one initial open-source release, April 10, 2026 (`cd83c80`); detailed README and accessible generation function. | No sustained maintenance, usage, or outcome evidence established. Included for direct hypothesis overlap, not presented as a mature success. |

**FACT:** The original `kamranahmedse/developer-roadmap` URL redirected to `nilbuild/developer-roadmap` during research. The current README describes a content repository, not the entire site's application source. [Repository](https://github.com/nilbuild/developer-roadmap), [README](https://raw.githubusercontent.com/nilbuild/developer-roadmap/master/readme.md).

**INFERENCE:** The sample prioritizes established component references rather than pretending every requested category has a mature, proven AI product. Direct educational-agent and arbitrary-goal path candidates have weaker evidence. “Successful” below means demonstrated operational or research use where identified, not commercial success. This is a purposive sample, not an exhaustive market census.

### Main conclusion

**INFERENCE:** Building domain navigation, source-based explanation, practice records, and a suggested next step is technically plausible. That does not establish that automatically generated paths teach effectively, that users need another standalone tool, or that the combined experience beats a roadmap, existing documentation, a chatbot, and a review tool.

**INFERENCE:** The more defensible opportunity to investigate is reducing the gap between a learning goal and evidence of usable competence. Generating additional content is already represented in the comparison set. The combined hypothesis must be tested against simple existing workflows.

## 2. Competitive analysis

### 2.1 OATutor

**Repository:** [CAHLR/OATutor](https://github.com/CAHLR/OATutor).

**Purpose — FACT:** An open adaptive tutoring system using intelligent tutoring principles and Bayesian Knowledge Tracing (BKT).  
**Target users — FACT:** Learning-sciences researchers, educators, and learners using curated mathematics/statistics material.  
**Core mechanism — FACT:** Problems map to skills; answer attempts update estimated mastery; selection heuristics choose practice; authored hints and scaffolds provide help.  
**Technical approach — FACT:** React, optional Firebase logging, configurable content/skill data, and answer checks. The inspected [BKT update function](https://raw.githubusercontent.com/CAHLR/OATutor/main/src/models/BKT/BKT-brain.js) conditions on correctness, slip and guess probabilities, then applies a learning-transition probability. [README](https://github.com/CAHLR/OATutor).

**What problem does it solve? — INFERENCE:** It makes targeted practice and tutoring experimentation reproducible rather than relying on an unstructured conversation.  
**Why might users value it? — INFERENCE:** Learners get help connected to a specific problem; educators can inspect curriculum and record attempts.  
**Concepts worth learning — INFERENCE:** Explicit skill-to-task mappings, incremental hints, observable attempts, and evaluation separate from the tutoring interface.  
**What should NOT be copied — INFERENCE:** Mathematics-specific answer checks or BKT probabilities as a universal model of software-engineering competence. A numerical mastery estimate is conditional on its inputs and assumptions.

**Known limitations — FACT:** A 2024 primary study analyzed 274 participants across four mathematics areas. AI hints were screened before learners saw them; 32% of initially generated hints were disqualified for incorrect work/answers. No statistically significant gain difference was found between AI and human hints. Pre/post tests reused questions. [Study: methods and results](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0304013).  
**Limitations — INFERENCE:** This supports supervised help in that setting; it does not prove formal equivalence, long-term transfer, autonomous tutoring, or performance on AI Agent engineering.  
**OPEN QUESTION:** What tasks and rubrics could provide comparably interpretable evidence in an open-ended engineering domain?

### 2.2 Kolibri

**Repository:** [learningequality/kolibri](https://github.com/learningequality/kolibri).

**Purpose — FACT:** Offline-first teaching and learning without requiring internet access.  
**Target users — FACT:** Learners, coaches, and administrators; official programs include refugee and other resource-constrained communities. [Repository](https://github.com/learningequality/kolibri), [program reports](https://learningequality.org/impact/our-impact/).  
**Core mechanism — FACT:** Coaches assign lessons/quizzes and inspect class, group, and learner progress. Incorrect attempts can trigger help-needed reporting. [Coach guide](https://kolibri.readthedocs.io/en/latest/coach/index.html).  
**Technical approach — FACT:** The inspected [Python manifest](https://raw.githubusercontent.com/learningequality/kolibri/develop/pyproject.toml) includes Django, Django REST Framework, Morango, and content-viewer/plugin entrypoints; release notes address database/sync reliability.

**What problem does it solve? — INFERENCE:** It makes educational content and learning supervision usable under unreliable connectivity.  
**Why might users value it? — INFERENCE:** Reliable access and actionable reports may matter more than novel generation features.  
**Concepts worth learning — INFERENCE:** Track attempts as well as completion; make progress useful to a person deciding when to intervene; treat delivery reliability as part of learning.  
**What should NOT be copied — INFERENCE:** Classroom administration, content-distribution machinery, and offline sync as automatic requirements for a personal assistant.

**Known limitations — FACT:** Course pre/post-test workflows appear in `0.20` prerelease material, while `0.19.5` is marked stable in the examined release page. [Releases](https://github.com/learningequality/kolibri/releases).  
**Limitations — INFERENCE:** This is a strong operational reference, not evidence that an arbitrary user goal can become a valid curriculum automatically. Reports depend on the activities provided.  
**OPEN QUESTION:** Does our learner need teacher intervention, peer review, or independent use only?

### 2.3 Anki

**Repository:** [ankitects/anki](https://github.com/ankitects/anki).

**Purpose — FACT:** Spaced-repetition flashcard learning.  
**Target users — INFERENCE:** Learners who need repeated recall of material they can represent as cards.  
**Core mechanism — FACT:** Reveal a card answer, rate recall, and revisit cards according to scheduling. FSRS uses review history and desired retention; incorrect rating habits distort scheduling. [Studying](https://docs.ankiweb.net/studying.html), [deck options](https://docs.ankiweb.net/deck-options).  
**Technical approach — FACT:** Rust workspace, Python bridge, SQLite-related dependency, and FSRS dependency in the inspected [Cargo manifest](https://raw.githubusercontent.com/ankitects/anki/main/Cargo.toml); Python/Qt directories in the repository.

**What problem does it solve? — INFERENCE:** It reduces the learner's burden of deciding when to revisit memorized material.  
**Why might users value it? — INFERENCE:** A finite daily queue makes continued practice actionable.  
**Concepts worth learning — INFERENCE:** Delayed review, persistent attempt history, explicit workload tradeoffs, and user-correctable feedback.  
**What should NOT be copied — INFERENCE:** Turn every engineering concept into a card or equate successful recall with debugging, design, or implementation ability.

**Known limitations — FACT:** The manual explains that higher desired retention increases review workload and that choosing “Hard” after forgetting can produce inappropriate intervals. [Deck options](https://docs.ankiweb.net/deck-options).  
**Limitations — INFERENCE:** Scheduling cannot rescue misleading cards; self-ratings are weaker evidence than independently checked performance. This research did not establish broad skill-transfer effects.  
**OPEN QUESTION:** Which parts of the learning goal require recall, explanation, application, or transfer?

### 2.4 developer-roadmap / roadmap.sh

**Repository:** [nilbuild/developer-roadmap](https://github.com/nilbuild/developer-roadmap), accessed through the original redirected URL.

**Purpose — FACT:** Interactive developer roadmaps, guides, and educational content.  
**Target users — FACT:** Developers exploring skills and career paths.  
**Core mechanism — FACT:** Curated topic maps with linked topic content and related questions; contributions update educational resources.  
**Technical approach — FACT:** The current repository stores topic Markdown at `roadmaps/<roadmap-slug>/content/<topic-slug>@<node-id>.md`; node IDs link content to topics, and merged changes sync to the site. [README](https://raw.githubusercontent.com/nilbuild/developer-roadmap/master/readme.md).

**What problem does it solve? — INFERENCE:** It exposes domain breadth and reduces the blank-page problem of deciding what to study.  
**Why might users value it? — INFERENCE:** A map helps locate unknown concepts and compare possible directions.  
**Concepts worth learning — INFERENCE:** Start from curated domain coverage; attach resources to concepts; maintain content independently of presentation.  
**What should NOT be copied — INFERENCE:** Treat visual proximity or every drawn connection as an empirically validated prerequisite, or require learners to finish an entire map.

**Known limitations — FACT:** The inspected repository contains site content, so it cannot establish the mechanics of every feature on the hosted service. [README](https://raw.githubusercontent.com/nilbuild/developer-roadmap/master/readme.md).  
**Limitations — INFERENCE:** A curated map does not diagnose a person's prior knowledge. Contributions demonstrate maintenance, not measured learning efficacy.  
**OPEN QUESTION:** Would a small prioritized list outperform a graph for first-time learners?

### 2.5 Logseq

**Repository:** [logseq/logseq](https://github.com/logseq/logseq).

**Purpose — FACT:** Personal knowledge management and collaboration emphasizing user control.  
**Target users — FACT:** Students, professionals, and people organizing ideas and notes.  
**Core mechanism — FACT:** In the documented DB version, pages/blocks act as nodes with references, properties, tags, and queries. [DB guide](https://github.com/logseq/docs/blob/master/db-version.md).  
**Technical approach — FACT:** Repository identifies Clojure/ClojureScript and DataScript among its foundations; README distinguishes DB graphs and SQLite backups from earlier file workflows. [README](https://raw.githubusercontent.com/logseq/logseq/master/README.md).

**What problem does it solve? — INFERENCE:** It preserves and reconnects information accumulated over time.  
**Why might users value it? — INFERENCE:** Personal notes remain editable evidence of their own thinking.  
**Concepts worth learning — INFERENCE:** Stable references, learner-authored explanations, inspectable metadata, and practical export/recovery.  
**What should NOT be copied — INFERENCE:** A complete general-purpose notes environment or the assumption that a dense personal graph is a valid prerequisite map.

**Known limitations — FACT:** Current README calls the DB version beta and mobile/RTC alpha, explicitly warns about possible data loss, and recommends backups. [README](https://raw.githubusercontent.com/logseq/logseq/master/README.md).  
**Limitations — INFERENCE:** Organizing notes is not demonstration of understanding; current-version migration complexity matters when considering reuse.  
**OPEN QUESTION:** Should learning evidence live in the learner's existing notes rather than a new repository of knowledge?

### 2.6 Khoj

**Repository:** [khoj-ai/khoj](https://github.com/khoj-ai/khoj).

**Purpose — FACT:** Personal AI using documents and web information, with custom agents and automations.  
**Target users — INFERENCE:** People querying accumulated personal/work knowledge.  
**Core mechanism — FACT:** Retrieval embeds document chunks and queries; users can search and chat over documents. Changing the bi-encoder requires reindexing, and retrieval confidence thresholds may need tuning. [Search documentation](https://docs.khoj.dev/features/search/).  
**Technical approach — FACT:** The inspected [manifest](https://raw.githubusercontent.com/khoj-ai/khoj/master/pyproject.toml) includes FastAPI, Django, sentence-transformers, pgvector, and PostgreSQL bindings. README documents local/online models and custom knowledge/persona/tool configurations.

**What problem does it solve? — INFERENCE:** It reduces friction finding relevant material across a personal corpus.  
**Why might users value it? — INFERENCE:** Answers can use the documents they already trust and maintain.  
**Concepts worth learning — INFERENCE:** Corpus selection, retrieval transparency, and model/data control.  
**What should NOT be copied — INFERENCE:** Broad autonomous assistance, extensive connectors, or agent personas as a substitute for a teaching strategy.

**Known limitations — FACT:** Maintenance history includes cloud-deprecation-banner changes in March 2026 and later export/privacy fixes. [Commit history](https://github.com/khoj-ai/khoj/commits/master/).  
**Limitations — INFERENCE:** Hosting continuity requires verification; this does not prove that the open-source code is abandoned. Retrieval relevance does not prove correctness or teach prerequisite structure.  
**OPEN QUESTION:** Do learner-provided documents contain sufficient, current material to support a whole learning goal?

### 2.7 OpenTutor — emerging educational-agent comparison

**Repository:** [zijinz456/OpenTutor](https://github.com/zijinz456/OpenTutor). Distinct from other repositories sharing the name.

**Purpose — FACT (documented claims):** Turn uploaded study materials into a learning workspace with notes, quizzes, cards, and tutoring.  
**Target users — INFERENCE:** Individual learners studying a bounded body of course material.  
**Core mechanism — FACT (documented):** Intent routing coordinates Tutor, Planner, and Layout agents. FSRS and BKT are listed; knowledge graph and semantic review are marked experimental.  
**Technical approach — FACT (documented):** Next.js, FastAPI, SQLite/SQLAlchemy, hybrid BM25/vector retrieval, local or cloud LLMs. [README](https://raw.githubusercontent.com/zijinz456/OpenTutor/main/README.md). The [status matrix](https://raw.githubusercontent.com/zijinz456/OpenTutor/main/docs/experimental-status-matrix.md) records active LOOM/LECTOR integrations and gated diagnostic/browser/vision tools; “active” is a runtime classification, not validated effectiveness.

**What problem does it solve? — INFERENCE:** It attempts to connect material consumption, practice, review, and planning.  
**Why might users value it? — INFERENCE:** Less switching between separate study tools.  
**Concepts worth learning — INFERENCE:** Distinguish experimental capabilities visibly; investigate whether a continuous study workflow matters.  
**What should NOT be copied — INFERENCE:** The agent count, automatic layout changes, or claims of cognitive-load detection without evidence that these improve learning.

**Known limitations — FACT:** The retrieved recent [history](https://github.com/zijinz456/OpenTutor/commits/main) prominently contains recurring repository-health and community-post work.  
**Limitations — INFERENCE:** That activity does not establish sustained feature development or learner adoption. This review did not validate runtime behavior or learning outcomes. Local-first documentation does not mean cloud-provider use keeps data local.  
**OPEN QUESTION:** Does orchestration improve measured outcomes compared with one tutor using the same material and tools?

### 2.8 Enterprise DNA AI Learning Path Generator — direct hypothesis comparison

**Repository:** [Enterprise-DNA-OS/ai-learning-path-generator](https://github.com/Enterprise-DNA-OS/ai-learning-path-generator).

**Purpose — FACT (documented):** Generate project-based learning paths and lesson content from a topic.  
**Target users — INFERENCE:** Self-directed learners who want a starting plan.  
**Core mechanism — FACT:** The inspected [journey function](https://raw.githubusercontent.com/Enterprise-DNA-OS/ai-learning-path-generator/main/supabase/functions/generate-learning-journey/index.ts) prompts an LLM for topics, skills, or a plan. A plan includes milestones and a first project; returned JSON is parsed and normalized.  
**Technical approach — FACT:** README describes React/Vite/TypeScript, Supabase/PostgreSQL, and Deno edge functions with model routing. [Repository](https://github.com/Enterprise-DNA-OS/ai-learning-path-generator).

**What problem does it solve? — INFERENCE:** It accelerates preparation of a plausible plan and on-demand material.  
**Why might users value it? — INFERENCE:** It reduces initial planning effort.  
**Concepts worth learning — INFERENCE:** Goal refinement, structured milestones, and connecting a path to a practice project.  
**What should NOT be copied — INFERENCE:** Generated duration estimates as reliable forecasts, multimedia breadth as differentiation, or valid JSON as proof of valid pedagogy.

**Known limitations — FACT:** The inspected plan branch accepts an object with only shallow validation. Its resource schema requests title/type/duration/free status, without source URLs; the function shows no retrieval step. This is a bounded file observation, not an audit of all functions. [Source](https://raw.githubusercontent.com/Enterprise-DNA-OS/ai-learning-path-generator/main/supabase/functions/generate-learning-journey/index.ts).  
**Limitations — INFERENCE:** Output can be well-formed yet ungrounded, poorly sequenced, or impossible to follow. Only an initial release was visible in the retrieved history; maturity and adoption remain unestablished.  
**OPEN QUESTION:** Can experts verify the plan's resource validity and prerequisite logic faster than writing a plan themselves?

### Capability comparison

**FACT/documentation inventory:** “D” means documented in reviewed material; “S” means selected source inspected; “E” means explicitly experimental; “—” means not established in this review, not absent. This is not a quality score or a complete inventory.

| Project | Domain structure | Path/sequence | Tutor/help | Practice | Progress/review | Personal corpus |
|---|---|---|---|---|---|---|
| OATutor | D: skill model | D: adaptive items | D: scaffolds | D: checked problems | S: BKT update | — |
| Kolibri | D: organized content | D: assigned lessons | D: coach intervention | D: quizzes | D: reports | — |
| Anki | — | D: review schedule | — | D: recall cards | D: recall-based review | D: authored notes/cards |
| developer-roadmap | D: curated maps | D: suggested routes | D: topic material | D: question resources | — | — |
| Logseq | D: personal node links | — | — | D: cards in DB guide | D: tasks/cards | D: notes |
| Khoj | — | — | D: corpus chat | — | — | D: retrieval |
| OpenTutor | E: concept graph | D/E: planner/graph | D: tutor agent | D: quizzes/cards | D/E: review/mastery | D: uploaded material |
| AI Path Generator | S: topic expansion | S: generated plan | D: contextual chat | D: proposed projects | D: step signals | — |

Source basis: the individual project profiles above. In particular, personal note links, retrieved document chunks, topic maps, and validated prerequisites are different kinds of structure.

## 3. Extracted principles and product-analysis answers

### 3.1 What common patterns exist among successful projects?

**INFERENCE:** In the stronger operational/research references, usefulness is anchored to a bounded activity: solving a tagged problem (OATutor), delivering assigned content (Kolibri), reviewing cards (Anki), navigating curated topics (roadmap.sh), or maintaining personal records (Logseq). Persistent, inspectable artifacts give users something to act on outside a conversation. This pattern does not establish a causal explanation for project success.

**INFERENCE:** Content work and operational reliability recur alongside the headline mechanism. Authored scaffolds, maintained resources, review history, export, and sync fixes suggest that sustained use needs more than generation. Maintenance records support this interpretation; they do not quantify user satisfaction.

### 3.2 Which capabilities appear repeatedly?

**FACT/documentation inventory:** Repeated capabilities include bounded content organization, contextual help, explicit practice tasks, persistent progress/attempt records, and revisiting material. Source/corpus context appears in the AI assistants; human curation is prominent in the established education/map references. See the capability matrix and linked profiles.

**INFERENCE:** No single representation spans all of these well. A useful learning record may need to distinguish exposure, attempted work, recall, independent application, and uncertainty. A completion checkbox alone supports a weaker claim than a checked attempt.

### 3.3 Which ideas are proven patterns?

“Proven” needs an explicit level:

| Pattern | Evidence level | Supported conclusion | Unsupported extrapolation |
|---|---|---|---|
| Curated tasks with hints and attempt tracking | Operational repository + narrow learning study | Supervised AI help can be useful in the studied mathematics setting. | A universal autonomous tutor is effective. |
| Recall-based scheduling | Established software, manual, scheduler dependency | Scheduling review from recall history is an implemented, maintained product mechanism. | Recall scores prove engineering competence. |
| Curated topic navigation | Content repository and contribution workflow | Domain maps can be maintained and published as an educational product. | A graph is always the best interface or an optimal path. |
| Assigned practice and actionable reports | Coach guide + named deployment programs | Progress can be tied to observable work and teacher action. | Activity reports measure causal learning impact. |
| Personal knowledge retrieval | Search documentation + manifest | Documents can ground a practical retrieval/chat workflow. | Retrieved text guarantees correct or pedagogically useful answers. |

**INFERENCE:** These are established product mechanisms with different evidence strengths. Only the bounded OATutor study examined here directly addresses learning gains; the entire proposed combination is not proven. The absence of a statistically significant difference is not a formal equivalence test. [Primary study](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0304013).

### 3.4 Which ideas are speculative?

**INFERENCE:** The reviewed evidence does not validate: universal goal-to-curriculum generation; reliable prerequisite discovery from arbitrary text; mastery inference from chat; behavior-based cognitive-load diagnosis; an automatically changing workspace; or a necessary learning advantage from multiple agents. These may be feasible features, but citations to underlying research or a checked roadmap item do not validate a specific product implementation.

**INFERENCE:** Personalization from preferences, personalization from measured knowledge, and adaptation from learning results are distinct. A preferred audio format does not establish a better sequence or improved learning.

### 3.5 What problems remain unsolved?

**INFERENCE — unresolved in this sample, not claims that nobody has solved them:**

- Translating a broad goal into an assessable outcome and identifying the learner's actual starting point.
- Maintaining correct prerequisite relationships and resources as an engineering field changes.
- Assessing open-ended work without mistaking AI-produced answers for independent competence.
- Choosing a useful next task from sparse, noisy evidence while explaining uncertainty.
- Sustaining practice after the novelty of a generated plan disappears.
- Showing delayed retention and transfer rather than only immediate quiz gains or completion.
- Balancing author/reviewer labor, model expense, learner time, and benefit.

### 3.6 Is there a meaningful opportunity for a new project?

**INFERENCE:** There is a plausible opportunity hypothesis, not validated demand: learners may benefit from a narrow, source-backed path that connects each next step to evidence of their own understanding. Existing products already cover much of the proposed functionality, so merely combining chat, maps, and generated lessons is weak differentiation.

**OPEN QUESTION:** Is fragmentation painful enough that learners would change tools? Would a guided workflow using existing tools solve the problem adequately? This desk research cannot establish willingness to adopt, retain, or pay.

## 4. Potential product direction

Everything in this section is **PROPOSAL**, not an approved design or implementation plan.

### Candidate directions for review

| Direction | Potential advantage | Main uncertainty |
|---|---|---|
| Goal-to-map explorer | Faster orientation using source-backed concept coverage | May duplicate existing roadmaps; map quality and interface value are untested. |
| Tutor for supplied materials | Bounded scope and relevant explanations | Strong overlap with document assistants; learning advantage over chat is unclear. |
| Evidence-based next-step coach | Connect diagnosis, practice, feedback, and a justified next action | Assessment reliability and learner effort may dominate costs. |

**PROPOSAL:** Investigate the third direction first through human-led validation, using the other two as alternatives. An initial research cohort could be adults with basic programming experience learning a narrowly defined AI Agent engineering outcome. This is a candidate cohort, not an assumed user segment.

**PROPOSAL:** Refine “learn AI Agent engineering” into an outcome such as explaining tool execution, diagnosing a failed interaction, and completing a bounded agent task with explicit evaluation criteria. Experts should determine the actual concept set, task difficulty, and valid rubric; this document does not commit to a curriculum.

**PROPOSAL:** Before any build, conduct a manual comparison:

1. Interview a small group about a recent learning goal, their current tools, abandoned plans, and actual next-step decisions. Collect behavioral examples rather than reactions to a product pitch.
2. Have a domain expert create/review a small map, source set, and several unseen practice tasks. Record review time and disagreements.
3. Compare a manually delivered coaching workflow against an existing roadmap + official materials + ordinary chatbot workflow, with similar time and access to help.
4. Use independent rubric review of tasks, an unseen transfer task, and a delayed check. Distinguish tool-assisted performance from unaided explanation. Counterbalance order or task sets if the same people try both workflows.
5. Record learner effort, continuation, correction burden, and failures as well as perceived usefulness. A small pilot supplies directional evidence, not statistical proof.

**PROPOSAL:** Agree on numeric review criteria with the human reviewer before any future trial. Candidate criteria: fewer invalid prerequisite recommendations, higher independently assessed task quality, less time choosing a next step, and voluntary return for another session. Count reviewer effort and model cost per completed learning task. Do not declare success from generated content volume, time in chat, or checkboxes alone.

**PROPOSAL:** Revise or reject the hypothesis if learners already solve the problem comfortably, if benefits disappear against the simple baseline, or if reliable assessment demands disproportionate expert labor. A negative result is a valid dogfood outcome.

No user interviews, pilot, prototype, architecture, framework selection, or curriculum commitment has been executed in this phase.

## 5. Risks

The risk entries are **INFERENCE** unless an explicit fact/source is identified. Possible validation actions are **PROPOSAL** for a later reviewed phase.

| Risk | Evidence/reason | Possible validation action |
|---|---|---|
| Confident but wrong teaching | The OATutor study screened generated hints and found substantial initial errors; that historical error rate is not a prediction for current models. | Expert-check a bounded source/task set; measure correction frequency. |
| Invalid learning sequence | Generated topics and shallow JSON checks do not validate prerequisite relationships. | Compare suggested sequences with independent expert judgments and learner performance. |
| False mastery | Self-report, completion, and assisted answers can exaggerate competence. | Separate observed attempts from estimates; use unseen tasks and delayed checks. |
| Opportunity is already served | Existing map, tutor, review, and notes products cover the main components. | Compare against an assembled existing-tools baseline. |
| Engagement without learning | Convenient summaries may reduce productive practice. | Measure independent task performance alongside voluntary continuation. |
| Stale sources and changing terminology | AI engineering topics evolve; generated resources can lack verifiable provenance. | Record source versions/dates and review obsolete material. |
| Excessive operating/reviewer cost | Quality control and open-ended assessment may dominate generation cost. | Time expert review and count full cost per meaningful learning outcome. |
| Privacy assumptions | Documents, mistakes, goals, and chat form a personal learning record; local hosting alone does not prevent remote model calls. | Determine required data, model destinations, and deletion/export expectations with users. |
| Reuse/lifecycle mistakes | Khoj has cloud-deprecation-related changes; Logseq's current DB workflow has beta/alpha caveats. | Evaluate a specific version and hosting mode if reuse is later proposed. |
| Licensing mismatch | Repositories and educational content can have different licenses; OATutor's README distinguishes code and attributed content, LearnHouse distinguishes enterprise features. | Review exact artifacts and content permissions before any copying. No code reuse is proposed now. |
| Evaluation bias | Purposive repository selection, maintainer claims, cached pages, and a small future cohort limit confidence. | Publish negative findings; seek independent review and broaden evidence before generalization. |
| Dogfood scope drift | Building a new control layer would change the experiment being tested. | Use this document as a review checkpoint; record gaps without changing Project Control OS. |

**FACT sources for specific caveats:** [OATutor study](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0304013), [journey source](https://raw.githubusercontent.com/Enterprise-DNA-OS/ai-learning-path-generator/main/supabase/functions/generate-learning-journey/index.ts), [Khoj history](https://github.com/khoj-ai/khoj/commits/master/), [Logseq README](https://raw.githubusercontent.com/logseq/logseq/master/README.md), [OATutor repository](https://github.com/CAHLR/OATutor), [LearnHouse license boundary](https://raw.githubusercontent.com/learnhouse/learnhouse/main/README.md).

LearnHouse was also screened as an adjacent course-platform candidate: its README documents courses, assignments, analytics, contextual AI, and a Next.js/FastAPI stack; July 27, 2026 history shows a `1.3.4` release merge and application/security fixes. These are engineering-maintenance signals, not verified adoption or learning gains. It was not selected as a full profile because Kolibri offered stronger deployment evidence for the course-platform comparison. [Repository](https://github.com/learnhouse/learnhouse), [history](https://github.com/learnhouse/learnhouse/commits/main/).

## 6. Open questions and human review checkpoint

All questions below are **OPEN QUESTION**:

1. Who is the first learner: novice programmer, experienced engineer entering agents, or someone with a fixed course?
2. What outcome makes a learning goal complete, and who can assess it independently?
3. Is the principal pain orientation, next-step choice, explanation, practice feedback, or sustained review?
4. What concrete evidence shows this pain in current behavior rather than stated enthusiasm?
5. What existing workflow is the fair baseline, including ordinary AI assistance?
6. Who curates concepts and verifies prerequisite edges? What happens when experts disagree?
7. Should the learner supply sources, choose a reviewed corpus, or explore the web? What freshness is required?
8. How much independent work and review effort will users tolerate?
9. How will assistance during practice affect the interpretation of progress?
10. Are a map and chat necessary, or would a short task list with explanations suffice?
11. Should the product integrate into existing notes/review tools instead of becoming a standalone assistant?
12. What data must persist, for how long, under whose control, and with what export/deletion expectations?
13. What evidence threshold would justify another phase, and what result would stop the experiment?
14. Which existing Project Control OS workflow/checkpoint should govern the next phase? No local control specification was found during the workspace inspection; none has been invented.

### Review request

**PROPOSAL:** Human review should first assess the adequacy of the evidence, challenge the interpretation of established versus speculative patterns, and decide whether to reject, refine, or further validate the product hypothesis. Approval of this discovery document should not be interpreted as approval to implement.

**FACT — phase completion:** The requested research document has been produced. Work stops at this checkpoint. No implementation, dependency installation, Project Control OS modification, new architecture layer, or architecture commitment has been made. Further work awaits human direction.
