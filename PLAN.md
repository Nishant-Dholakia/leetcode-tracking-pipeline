# LeetCode Tracker Automation Plan

## Summary
Build a Node.js service that runs nightly via GitHub Actions, fetches LeetCode problems solved in the previous 24 hours for one authenticated user, generates structured OpenAI analysis for each accepted solution, and stores each result as a ClickUp task in a dedicated list.

Primary success criteria:
- Scheduled run completes automatically every night with no manual trigger.
- Up to 20 daily solves are processed in under 5 minutes.
- Partial failures do not stop the run; each problem is isolated.
- Duplicate ClickUp entries are prevented for the same submission.

## Implementation Changes

### 1. Project foundation
Create a small Node.js TypeScript service rather than plain JS so API contracts, env validation, and payload shapes are explicit from day one.

Core structure:
- `src/config` for env loading and validation
- `src/leetcode` for GraphQL queries and normalization
- `src/ai` for prompt building and OpenAI response parsing
- `src/clickup` for list metadata lookup, task creation, and duplicate detection
- `src/orchestrator` for end-to-end pipeline
- `src/utils` for logging, retry, dates, and error helpers
- `.github/workflows` for nightly execution
- `.env.example` and `README.md` for setup

Key libraries:
- `typescript`, `tsx`
- `dotenv`, `zod`
- `axios` or `undici`
- `p-limit` for bounded concurrency
- `dayjs` or native UTC utilities
- `vitest` for tests

### 2. LeetCode ingestion
Implement two GraphQL operations:
- Recent accepted submissions for the configured username
- Problem details by title slug for description, difficulty, and topic tags

Fetcher behavior:
- Authenticate with `LEETCODE_SESSION` and `LEETCODE_CSRF_TOKEN`
- Pull recent submissions and keep only `Accepted` entries within the last 24 hours using UTC timestamps
- De-duplicate by submission id before processing
- For each retained submission, fetch full problem metadata and solution code if available from the submission detail endpoint used by the web app
- Normalize into one internal object per submission

Internal submission shape:
- `submissionId`
- `title`
- `titleSlug`
- `problemUrl`
- `difficulty`
- `topicTags[]`
- `solvedAt`
- `language`
- `solutionCode`
- `problemDescription`

If solution code cannot be retrieved for a submission, skip AI analysis for that item and record it as a failed problem in the run summary.

### 3. AI analysis engine
Use OpenAI as the primary provider with a provider interface so Anthropic can be added later without restructuring.

Provider contract:
- Input: normalized submission object
- Output:
  - `algorithm`
  - `timeComplexity`
  - `spaceComplexity`
  - `edgeCases[]`
  - `interviewTalkingPoints[]`
  - `approachSummary`

Prompting rules:
- System prompt forces strict JSON output only
- User payload includes title, description, language, and solution code
- Set deterministic settings for consistent formatting
- Validate model output with `zod`; retry once if parsing fails
- Produce a compact markdown summary from validated JSON for ClickUp storage

Default model path:
- `OPENAI_MODEL=gpt-5-mini` or equivalent low-latency structured-output-capable model
- Model name stays configurable through env

### 4. ClickUp storage
Store one ClickUp task per submission in a dedicated list.

Task mapping:
- Task name: `Question Name`
- Custom fields:
  - `Question Name` as text
  - `Difficulty` as dropdown
  - `Topic Tags` as labels
  - `My Solution` as long text or code block-compatible text field
  - `AI Approach Summary` as long text
  - `Date Solved` as date
  - `Problem URL` as URL
- Task description should also contain a readable markdown version with sections for algorithm, complexity, edge cases, and interview points

Idempotency rule:
- Before create, search existing tasks in the target list for a custom marker containing `submissionId`
- If found, skip creation
- If not found, create the task and include the marker in description or a dedicated hidden text field if available

ClickUp resilience:
- Retry once after 5 seconds on 429 or transient 5xx
- Treat 4xx schema/config issues as hard failures and include them in the summary

### 5. Orchestration and scheduling
The pipeline entrypoint should:
1. Load and validate config
2. Fetch recent accepted submissions
3. Exit cleanly if none found
4. Process each submission with bounded concurrency of 2 to 3 items
5. For each item:
   - enrich LeetCode data
   - generate AI analysis
   - upsert to ClickUp
6. Emit a structured run summary and exit non-zero only if the whole run is systemically broken

Scheduling approach:
- GitHub Actions scheduled workflow runs daily at `00:00 UTC`
- Add optional `workflow_dispatch` for manual reruns
- Repo secrets hold all production credentials
- The workflow installs deps, runs the pipeline, and uploads a small JSON log artifact on failure

Reason for UTC default:
- GitHub Actions cron is UTC-based and simpler than keeping a server alive
- “Last 24 hours” logic remains stable even if the user is in another timezone

### 6. Configuration and public interfaces
Env contract:
- `LEETCODE_SESSION`
- `LEETCODE_CSRF_TOKEN`
- `LEETCODE_USERNAME`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `CLICKUP_API_TOKEN`
- `CLICKUP_LIST_ID`
- `CLICKUP_FIELD_QUESTION_NAME`
- `CLICKUP_FIELD_DIFFICULTY`
- `CLICKUP_FIELD_TOPIC_TAGS`
- `CLICKUP_FIELD_MY_SOLUTION`
- `CLICKUP_FIELD_AI_SUMMARY`
- `CLICKUP_FIELD_DATE_SOLVED`
- `CLICKUP_FIELD_PROBLEM_URL`
- `MAX_PROBLEMS_PER_RUN` default `20`
- `PROCESS_CONCURRENCY` default `2`
- `LOOKBACK_HOURS` default `24`

Important interface decision:
- ClickUp custom field IDs must be explicit env vars rather than discovered heuristically, to avoid brittle name matching across workspaces.

### 7. Observability and failure handling
Logging:
- Structured JSON logs in CI
- One run id per execution
- Per-problem status: `fetched`, `analyzed`, `stored`, `skipped`, `failed`

Failure policy:
- No submissions: success exit
- LeetCode auth failure: fail run immediately with actionable log
- Single problem AI failure: skip that problem and continue
- Single problem ClickUp failure: retry once, then continue
- JSON parse failure from AI: one repair retry, then fail only that problem
- End-of-run summary includes totals for processed, created, skipped, and failed

Optional later enhancement, not in v1:
- Slack/email summary notifications

## Test Plan
Automated tests:
- Config validation rejects missing secrets and invalid numeric env values
- LeetCode submission filtering keeps only accepted submissions inside the 24-hour window
- Duplicate submissions are collapsed by `submissionId`
- AI response parser accepts valid JSON and rejects malformed or incomplete payloads
- ClickUp payload builder maps fields correctly
- Idempotency logic skips an existing `submissionId`
- Orchestrator continues after one item fails and reports correct summary totals

Integration-style tests with mocked HTTP:
- Successful full run with 2 solved problems
- Empty run with no accepted submissions
- LeetCode 401/403 auth failure
- OpenAI malformed response followed by successful retry
- ClickUp 429 then successful retry
- ClickUp hard 400 failure for one item while others still succeed

Manual acceptance checks:
- Run locally with `.env` and confirm one sample problem creates one ClickUp task with all required fields
- Trigger GitHub Actions manually and verify secrets, schedule, and logs
- Re-run the same day and confirm no duplicate task is created

## Assumptions
- Primary stack is Node.js with TypeScript.
- Primary AI provider is OpenAI; Anthropic support is deferred behind an interface.
- Production runtime is GitHub Actions, not an always-on server.
- One ClickUp task is created per accepted submission, not per problem slug.
- The LeetCode web/API session provides enough access to retrieve recent accepted submissions and submission code for the authenticated user.
- Midnight scheduling is implemented as `00:00 UTC`; the fetch window remains the previous 24 hours rather than “local midnight to local midnight.”
- Slack/email notifications are out of scope for v1 unless later requested.
