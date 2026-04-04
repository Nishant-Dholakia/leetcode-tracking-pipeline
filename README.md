# LeetCode Tracker Automation

Nightly automation that fetches LeetCode problems solved in the previous 24 hours, generates AI explanations, and stores them in Notion as an interview-prep knowledge base.

## What it does

- Fetches accepted LeetCode submissions for one user
- Enriches each item with question metadata and submission code
- Generates structured AI analysis through OpenRouter
- Creates one Notion database page per problem slug
- Syncs only submissions you explicitly mark for Notion
- Runs nightly through GitHub Actions

## Setup

1. Copy `.env.example` to `.env`
2. Fill in all required credentials and Notion settings
3. Install dependencies with `npm install`
4. Run locally with `npm run start`

## Selecting Which Problems Sync

The tracker is opt-in. A solved problem is added only when the first non-empty line of your submitted code is the exact sync marker for that language.

Marker keyword:

- `ADD_TO_NOTION`

Examples:

- TypeScript / Java / C++ / JavaScript / Go / Rust: `//ADD_TO_NOTION`
- Python / Ruby / Bash / PowerShell / Perl: `#ADD_TO_NOTION`
- SQL / Lua / Haskell: `--ADD_TO_NOTION`
- Erlang / Prolog / Matlab: `%ADD_TO_NOTION`
- Lisp-style languages: `;ADD_TO_NOTION`

Rules:

- The marker must be on the first non-empty line.
- The marker must match exactly.
- Submissions without the marker are ignored.
- The marker line is removed before the code is sent to AI or stored in Notion.
- If a language does not have marker support yet, that submission is skipped.

## Deployment

Deployment for this project is GitHub Actions based, not a long-running server.

1. Push this repository to GitHub.
2. In GitHub, open `Settings -> Secrets and variables -> Actions`.
3. Add the same values from your local `.env` as repository secrets.
4. Enable the workflow in `.github/workflows/nightly.yml`.
5. Run the workflow once with `workflow_dispatch` to verify secrets, Notion access, and alerts.

Recommended repository secrets:

- `LEETCODE_SESSION`
- `LEETCODE_CSRF_TOKEN`
- `LEETCODE_USERNAME`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `OPENROUTER_MAX_TOKENS`
- `OPENROUTER_SITE_URL`
- `OPENROUTER_APP_NAME`
- `NOTION_API_KEY`
- `NOTION_PARENT_PAGE_ID`
- `NOTION_DATABASE_ID`
- `NOTION_AUTO_CREATE_DATABASE`
- `RESEND_API_KEY`
- `ALERT_EMAIL_TO`
- `ALERT_EMAIL_FROM`
- `ENABLE_FAILURE_ALERTS`
- `ALERT_DEDUPE_HOURS`
- `MAX_PROBLEMS_PER_RUN`
- `PROCESS_CONCURRENCY`
- `LOOKBACK_HOURS`

Notes:

- The workflow runs daily at `00:00 UTC`.
- A concurrency lock prevents overlapping nightly runs.
- Each run uploads `tracker-run.log` as a workflow artifact for debugging.
- Alert dedupe state is preserved through the GitHub Actions cache.

## Notion Setup

1. Create a Notion internal integration and copy the API key.
2. Create or choose a parent page where the database should live.
3. Share that page with the integration.
4. Set `NOTION_PARENT_PAGE_ID`.
5. Leave `NOTION_DATABASE_ID` blank if you want the app to auto-create the recommended study database.

The Notion database is designed for interview preparation and includes metadata plus page sections for:
- problem URL
- your solution
- AI summary
- revision notes
- mistakes / learnings

## Scripts

- `npm run start` runs the pipeline
- `npm run check` runs TypeScript checks
- `npm run test` runs the test suite
- `npm run build` builds the project

## Notes

- The GitHub Actions schedule is configured for `00:00 UTC`
- Historical backfill is intentionally not part of this MVP
- Notion dedupe uses `titleSlug`
- OpenRouter is the only AI provider in the current implementation
