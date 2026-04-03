# LeetCode Tracker Automation Project Report

## 1. Project Overview

This project is an automated interview-preparation pipeline built with Node.js and TypeScript. Its goal is to track recently solved LeetCode problems, generate structured AI explanations for each solution, and store the results in Notion as a study-friendly knowledge base.

The system is designed to run both:

- locally through `npm run start`
- automatically every day through GitHub Actions

The current implementation uses:

- LeetCode for source problem and submission data
- OpenRouter or OpenAI for AI analysis
- Notion for persistent storage and revision-friendly organization
- Resend for failure and recovery alert emails

## 2. Main Objective

The project solves a practical interview-prep problem:

- after solving LeetCode problems, users usually forget the exact idea, edge cases, and talking points
- manually documenting each solved problem is repetitive
- this project converts recent accepted submissions into a structured study system automatically

The final output in Notion includes:

- problem metadata
- solution code
- AI-generated explanation
- interview talking points
- revision placeholders for future study

## 3. Core Features

- Fetch accepted LeetCode submissions from the last `LOOKBACK_HOURS`
- Enrich each submission with:
  - problem number
  - title
  - slug
  - difficulty
  - topic tags
  - solution code
  - problem description
- Generate structured AI analysis
- Deduplicate entries in Notion using `titleSlug`
- Auto-create the Notion study database if one is not already configured
- Send alert emails when any run fails
- Send recovery emails after the system becomes healthy again
- Run nightly through GitHub Actions

## 4. High-Level Architecture

```text
+-------------------+
| GitHub Actions /  |
| Local CLI Run     |
+---------+---------+
          |
          v
+-------------------+
| src/index.ts      |
| Bootstrap + Alert |
| Coordination      |
+---------+---------+
          |
          v
+-------------------+
| Config Loader     |
| src/config/env.ts |
+---------+---------+
          |
          v
+---------------------------+
| Orchestrator              |
| src/orchestrator/run.ts   |
+----+---------------+------+
     |               |
     |               |
     v               v
+-----------+   +----------------+
| LeetCode  |   | AI Provider    |
| Fetcher   |   | OpenRouter /   |
|           |   | OpenAI         |
+-----+-----+   +--------+-------+
      |                   |
      +--------+----------+
               |
               v
      +-------------------+
      | Notion Service    |
      | Store Study Pages |
      +---------+---------+
                |
                v
      +-------------------+
      | Notion Database   |
      | Interview Prep KB |
      +-------------------+

Failure path:
main/index -> alert summary -> Resend notifier -> email
```

## 5. Folder Structure and Responsibilities

### `src/index.ts`

This is the main entry point of the project. It:

- loads alert state
- loads runtime configuration
- starts the pipeline
- converts failures into alert summaries
- sends failure or recovery emails through Resend
- updates the alert-state file

This file is responsible for top-level lifecycle management.

### `src/config/env.ts`

This module validates environment variables using `zod`.

It ensures:

- required LeetCode credentials are present
- the selected AI provider has the matching API key
- Notion configuration is complete
- alert configuration is complete when alerts are enabled
- numeric settings are parsed safely

This prevents the application from starting in an invalid state.

### `src/orchestrator/run.ts`

This is the execution coordinator of the business logic.

It performs the main workflow:

1. create fetcher, analyzer, and storage services
2. fetch recent solved problems
3. skip run if no recent problems are found
4. process each problem with controlled concurrency
5. check whether the problem already exists in Notion
6. request AI analysis
7. create the Notion page
8. produce a final run summary

### `src/leetcode/*`

This layer talks to LeetCode.

- `client.ts` handles authenticated HTTP GraphQL requests
- `queries.ts` contains GraphQL queries
- `fetcher.ts` filters recent accepted submissions and enriches them into normalized domain objects

The fetcher transforms raw LeetCode API responses into a clean internal shape.

### `src/ai/provider.ts`

This module provides the AI abstraction layer.

It supports:

- OpenRouter
- OpenAI

It:

- builds prompts from normalized problem data
- sends the request to the selected provider
- expects structured JSON
- validates the JSON using `zod`
- retries once for transient failures
- avoids retrying on permanent credit/quota errors

### `src/notion/*`

This layer stores study content in Notion.

- `client.ts` performs raw Notion API operations
- `service.ts` implements higher-level storage behavior

The Notion service:

- finds existing problems by `Question Slug`
- auto-creates the study database if needed
- creates a page with metadata properties
- writes the problem URL, code, AI summary, and revision sections into the page body

### `src/alerts/*`

This layer handles monitoring and notifications.

- `classify.ts` maps raw errors into meaningful categories
- `summary.ts` converts run results into alert-ready summaries
- `manager.ts` decides whether to send or suppress an alert
- `notifier.ts` sends emails through Resend
- `state.ts` stores alert memory in `.tracker-alert-state.json`

This makes the system operationally safer for unattended nightly runs.

### `src/utils/*`

This folder contains shared helpers for:

- HTTP requests
- retries
- logging
- time filtering
- identity generation

## 6. Data Flow of the Project

The complete project flow is as follows.

### Step 1. Application startup

When the project starts:

- `src/index.ts` generates a run context
- environment variables are validated through `loadConfig()`
- alert state is loaded from `.tracker-alert-state.json`

If config is invalid, the run stops immediately and a failure alert is attempted.

### Step 2. Pipeline start

`runPipeline(config)` is called from the orchestrator.

The orchestrator creates:

- `LeetCodeFetcher`
- analyzer from `createAnalyzer(config)`
- `NotionService`

### Step 3. Recent LeetCode submissions are fetched

The fetcher calls LeetCode GraphQL and requests recent accepted submissions for the configured username.

Then it filters submissions by:

- accepted status
- solved time inside the last `LOOKBACK_HOURS`
- maximum number of problems allowed in one run

### Step 4. Each submission is enriched

For each selected submission, the fetcher loads:

- question details
- submission details

Then it builds a normalized problem object:

- `submissionId`
- `questionFrontendId`
- `title`
- `titleSlug`
- `problemKey`
- `problemUrl`
- `difficulty`
- `topicTags`
- `solvedAt`
- `language`
- `solutionCode`
- `problemDescription`

This normalized object is the central internal data contract of the project.

### Step 5. Deduplication check in Notion

Before creating a page, the Notion storage layer queries the database using:

- property: `Question Slug`
- value: `titleSlug`

If the slug already exists:

- the problem is marked as `skipped`
- no AI call is made
- no duplicate page is created

### Step 6. AI analysis generation

For new problems, the analyzer builds a prompt using:

- question number
- title
- slug
- language
- problem description
- solution code

The AI provider returns structured JSON with:

- algorithm
- time complexity
- space complexity
- edge cases
- interview talking points
- approach summary

This output is validated before it is accepted.

### Step 7. Notion page creation

After analysis is ready, the Notion service creates a database page.

The page properties store compact metadata:

- Title
- Question Slug
- Question Number
- Difficulty
- Topic Tags
- Date Solved
- Problem URL
- Revision Status
- Confidence
- Mistakes / Learnings

The page body stores long-form study content:

- Problem URL
- My Solution
- AI Summary
- Revision Notes
- Mistakes / Learnings

The solution is saved as a Notion code block, with the language normalized to one supported by Notion.

### Step 8. Run summary generation

After all problems are processed, the orchestrator builds a run summary containing:

- processed count
- stored count
- skipped count
- failed count
- per-problem results

### Step 9. Alert handling

Back in `src/index.ts`, the run summary is evaluated.

If there were failures:

- a normalized alert summary is created
- dedupe logic checks whether the same alert was already sent recently
- if not suppressed, a Resend email is sent
- alert state is saved

If the current run succeeds after a previous failing state:

- a recovery email is sent
- alert state is reset to healthy

## 7. Execution Sequence of Main Code

The main code path is:

```text
npm run start
  -> tsx src/index.ts
    -> loadConfig()
    -> runPipeline(config)
      -> fetcher.fetchRecentSolvedProblems()
      -> for each problem:
           -> storage.hasProblem(titleSlug)
           -> analyzer.analyze(problem)
           -> storage.createProblemEntry(problem, analysis)
      -> return RunSummary
    -> build alert summary if needed
    -> send failure/recovery email if needed
    -> save alert state
```

## 8. Notion Database Design

The current Notion schema is intentionally designed for interview preparation, not generic task management.

### Properties

| Property | Type | Purpose |
|---|---|---|
| `Title` | title | Human-readable page title |
| `Question Slug` | rich text | Unique dedupe key |
| `Question Number` | number | Problem number |
| `Difficulty` | select | Easy / Medium / Hard |
| `Topic Tags` | multi-select | Problem topics |
| `Date Solved` | date | Solve timestamp |
| `Problem URL` | url | Direct problem link |
| `Revision Status` | select | Manual study progress |
| `Confidence` | select | Manual confidence level |
| `Mistakes / Learnings` | rich text | Manual reflection notes |

### Why this design works for interview prep

- metadata is filterable and sortable
- long explanations stay in the page body, not crowded into fields
- manual revision can happen directly inside Notion
- users can create views by difficulty, topic, or revision status

## 9. Failure Handling Strategy

The project is designed to be fault-aware.

### Problem-level failure isolation

If one problem fails:

- the run continues for the remaining problems
- the failed problem is included in the final summary
- an alert can be sent later

### Startup failure handling

If the application crashes before normal run completion:

- the crash is converted into a run-level alert
- an email is attempted

### Alert deduplication

To avoid mail spam:

- the system saves alert fingerprints in `.tracker-alert-state.json`
- repeated identical failures inside the dedupe window are suppressed

### Recovery notification

When a later run succeeds after a failure state:

- a recovery email is sent once

## 10. Scheduling and Automation

Nightly automation is configured in:

- `.github/workflows/nightly.yml`

The workflow:

1. checks out the repository
2. restores cached alert state
3. sets up Node.js
4. installs dependencies
5. runs the tracker
6. saves alert state back to cache

Current schedule:

- `0 0 * * *`
- this means every day at `00:00 UTC`

## 11. Configuration Summary

The project depends on four groups of configuration.

### LeetCode

- `LEETCODE_SESSION`
- `LEETCODE_CSRF_TOKEN`
- `LEETCODE_USERNAME`

### AI Provider

- `AI_PROVIDER`
- `OPENROUTER_API_KEY` or `OPENAI_API_KEY`
- model and token settings

### Notion

- `NOTION_API_KEY`
- `NOTION_PARENT_PAGE_ID`
- `NOTION_DATABASE_ID`
- `NOTION_AUTO_CREATE_DATABASE`

### Alerts

- `RESEND_API_KEY`
- `ALERT_EMAIL_TO`
- `ALERT_EMAIL_FROM`
- `ENABLE_FAILURE_ALERTS`
- `ALERT_DEDUPE_HOURS`
- `ALERT_STATE_PATH`

## 12. Strengths of the Current Design

- clear modular separation between fetch, analyze, store, and alert phases
- validated configuration at startup
- pluggable AI provider abstraction
- Notion storage is aligned with real interview revision workflows
- dedupe prevents duplicate study pages
- detailed structured logs help debugging
- email alerts make unattended runs practical

## 13. Current Limitations

- LeetCode authentication still depends on session cookies
- historical backfill is not part of the current automated flow
- dedupe currently uses `titleSlug`, so multiple accepted submissions of the same slug are intentionally collapsed
- Notion database ID is not auto-persisted back to `.env`, so first-time auto-created databases should be saved manually
- AI quality depends on provider credits and availability

## 14. Suggested Future Enhancements

- historical backfill command for older solved problems
- automatic persistence of newly created `NOTION_DATABASE_ID`
- richer revision metrics such as next-review date or spaced repetition score
- optional local fallback analyzer when AI credits are unavailable
- dashboard summary page in Notion
- stronger credential-health checks for LeetCode session expiry

## 15. Conclusion

This project is a full automation pipeline that converts recent LeetCode practice into a reusable interview knowledge base. It connects data collection, AI summarization, knowledge storage, and operational monitoring in one workflow.

Instead of simply tracking solved problems, the system helps transform coding practice into structured interview preparation. Its current architecture is modular, production-oriented for small-scale automation, and already suitable for daily personal use.
