# Setup Guide

This document explains how to set up the LeetCode Tracker Automation project from scratch.

It covers:

- local installation
- `.env` configuration
- where to get each key or credential
- Notion setup
- email alert setup
- GitHub Actions setup
- first local run
- first GitHub Actions run
- common issues

## 1. What This Project Needs

This project depends on 4 external systems:

- LeetCode
- OpenRouter
- Notion
- Resend

It also uses:

- GitHub Actions for nightly automation
- Node.js to run the app

## 2. Prerequisites

Install these before starting:

- Node.js 20 or higher
- npm
- Git
- a GitHub account
- a Notion account
- an OpenRouter account
- a Resend account
- a LeetCode account

## 3. Fork the Repository First

If someone else is using this project, they should fork your repository first instead of using your repository directly.

Why:

- GitHub Actions run in the repository where the workflow exists
- GitHub Secrets are configured per repository
- each user needs their own secrets, logs, schedule, and workflow runs

Recommended flow:

1. Open the original GitHub repository
2. Click `Fork`
3. Create the fork in their own GitHub account
4. Use that fork for the rest of the setup

## 4. Clone and Install

Open a terminal in the folder where you want the project and run:

```powershell
git clone <your-repo-url>
cd leetcode-automation
npm install
```

If they are setting up from a fork, they should clone their fork URL, not the original repository URL.

Example:

```powershell
git clone https://github.com/their-username/leetcode-automation.git
```

## 5. Create the `.env` File

Copy the sample env file:

```powershell
Copy-Item .env.example .env
```

Then open `.env` and fill in all values.

Current required env structure:

```env
LEETCODE_SESSION=your_leetcode_session_cookie
LEETCODE_CSRF_TOKEN=your_leetcode_csrf_token
LEETCODE_USERNAME=your_leetcode_username
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=openai/gpt-4.1-mini
OPENROUTER_MAX_TOKENS=1200
OPENROUTER_SITE_URL=https://github.com/your-username/your-repo
OPENROUTER_APP_NAME=leetcode-tracker-automation
RESEND_API_KEY=your_resend_api_key
ALERT_EMAIL_TO=you@example.com
ALERT_EMAIL_FROM=alerts@example.com
ENABLE_FAILURE_ALERTS=true
ALERT_DEDUPE_HOURS=24
ALERT_STATE_PATH=.tracker-alert-state.json
NOTION_API_KEY=your_notion_integration_token
NOTION_PARENT_PAGE_ID=your_notion_parent_page_id
NOTION_DATABASE_ID=
NOTION_AUTO_CREATE_DATABASE=true
MAX_PROBLEMS_PER_RUN=20
PROCESS_CONCURRENCY=2
LOOKBACK_HOURS=24
```

## 6. How to Get Each Credential

### 6.1 LeetCode

You need:

- `LEETCODE_SESSION`
- `LEETCODE_CSRF_TOKEN`
- `LEETCODE_USERNAME`

#### `LEETCODE_USERNAME`

This is your normal LeetCode username.

Example:

```env
LEETCODE_USERNAME=nishantdholakia
```

#### `LEETCODE_SESSION`

This is a browser cookie, not an API key.

How to get it:

1. Log in to `https://leetcode.com`
2. Open browser developer tools
3. Go to `Application` or `Storage`
4. Open `Cookies`
5. Select `https://leetcode.com`
6. Find the cookie named `LEETCODE_SESSION`
7. Copy its value into `.env`

#### `LEETCODE_CSRF_TOKEN`

This is also a browser cookie.

How to get it:

1. Stay logged in to `https://leetcode.com`
2. In browser developer tools, open cookies for `https://leetcode.com`
3. Find the cookie named `csrftoken`
4. Copy that value into `.env` as `LEETCODE_CSRF_TOKEN`

Example:

```env
LEETCODE_SESSION=abc123...
LEETCODE_CSRF_TOKEN=xyz456...
```

Important:

- if you log out of LeetCode, these cookies may stop working
- if the cookies expire, the automation may fail until you update them

### 6.2 OpenRouter

You need:

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `OPENROUTER_MAX_TOKENS`
- `OPENROUTER_SITE_URL`
- `OPENROUTER_APP_NAME`

#### `OPENROUTER_API_KEY`

How to get it:

1. Create or log in to your OpenRouter account
2. Open the API keys section
3. Create a new key
4. Copy it into `.env`

Example:

```env
OPENROUTER_API_KEY=sk-or-v1-...
```

#### `OPENROUTER_MODEL`

This is the model used for AI analysis.

Recommended default:

```env
OPENROUTER_MODEL=openai/gpt-4.1-mini
```

#### `OPENROUTER_MAX_TOKENS`

Controls maximum output size from the AI provider.

Recommended default:

```env
OPENROUTER_MAX_TOKENS=1200
```

If you get OpenRouter credit errors, reduce it to:

```env
OPENROUTER_MAX_TOKENS=800
```

#### `OPENROUTER_SITE_URL`

Use your GitHub repository URL here.

Example:

```env
OPENROUTER_SITE_URL=https://github.com/your-username/leetcode-automation
```

#### `OPENROUTER_APP_NAME`

Recommended:

```env
OPENROUTER_APP_NAME=leetcode-tracker-automation
```

### 6.3 Resend

You need:

- `RESEND_API_KEY`
- `ALERT_EMAIL_TO`
- `ALERT_EMAIL_FROM`

#### `RESEND_API_KEY`

How to get it:

1. Create or log in to your Resend account
2. Open the API keys section
3. Create a key
4. Copy it into `.env`

Example:

```env
RESEND_API_KEY=re_...
```

#### `ALERT_EMAIL_TO`

This is the email address that will receive failure and recovery alerts.

Example:

```env
ALERT_EMAIL_TO=you@example.com
```

#### `ALERT_EMAIL_FROM`

This is the sender email used by Resend.

Important:

- this address must be allowed by your Resend setup
- if your sending domain is not configured properly, email delivery may fail

Example:

```env
ALERT_EMAIL_FROM=Leetcode Summarizer <onboarding@resend.dev>
```
Keep this only because mail is needed to sent to you only.

### 6.4 Notion

You need:

- `NOTION_API_KEY`
- `NOTION_PARENT_PAGE_ID`
- optionally `NOTION_DATABASE_ID`
- `NOTION_AUTO_CREATE_DATABASE`

#### Step A: Create a parent page first

Create a fresh Notion page first, for example:

- `LeetCode Interview Prep`

This is the page where the tracker will create or use the database.

#### Step B: Create a Notion integration

1. Open Notion integrations - `https://www.notion.so/profile/integrations/internal`
2. Create a new internal integration
3. Give it a name like `LeetCode Tracker`
4. Select the correct workspace
5. Copy the integration token

That token becomes:

```env
NOTION_API_KEY=secret_xxx...
```

#### Step C: Give the integration access to that page

This step is required.

1. Open the parent page
2. Click `Share`
3. Invite your integration to the page
4. Confirm it has access

If you skip this step, Notion API calls will fail even if the API key is correct.

#### Step D: Get `NOTION_PARENT_PAGE_ID`

1. Open the parent page in the browser
2. Copy the page URL
3. Find the 32-character page id in the URL - 
`https://www.notion.so/Leetcode-Tracker-0123456789abcdef0123456789abcdef`
4. Put it into `.env`

Example:

```env
NOTION_PARENT_PAGE_ID=0123456789abcdef0123456789abcdef
```

#### Step E: `NOTION_DATABASE_ID`

For first run:

- keep this blank
- let the app auto-create the database

Example:

```env
NOTION_DATABASE_ID=
NOTION_AUTO_CREATE_DATABASE=true
```

After the first successful run:

- open the created database
- copy its id from the URL
`https://www.notion.so/abcdef1234567890abcdef1234567890?v=abcdef1234567890abcdef9876543210`
- copy the first 32-bit id
- save it into `.env`
- set auto-create to `false`

Recommended stable config after first run:

```env
NOTION_DATABASE_ID=abcdef1234567890abcdef1234567890
NOTION_AUTO_CREATE_DATABASE=false
```

This prevents the app from creating a new database again on later runs.

## 7. Optional Runtime Settings

### `ENABLE_FAILURE_ALERTS`

Controls whether email alerts are sent.

Recommended:

```env
ENABLE_FAILURE_ALERTS=true
```

### `ALERT_DEDUPE_HOURS`

Prevents repeated failure emails from spamming you.

Recommended:

```env
ALERT_DEDUPE_HOURS=24
```

### `ALERT_STATE_PATH`

Local file used to remember alert state.

Recommended:

```env
ALERT_STATE_PATH=.tracker-alert-state.json
```

### `MAX_PROBLEMS_PER_RUN`

Maximum number of problems processed in one run.

Recommended:

```env
MAX_PROBLEMS_PER_RUN=20
```

### `PROCESS_CONCURRENCY`

How many problems are processed in parallel.

Recommended:

```env
PROCESS_CONCURRENCY=2
```

### `LOOKBACK_HOURS`

How far back the script checks for accepted solutions.

Recommended:

```env
LOOKBACK_HOURS=24
```

## 8. Marker-Based Sync Rule

This project only syncs submissions that you intentionally mark.

The first non-empty line of your submitted code must contain the exact marker:

```text
ADD_TO_NOTION
```

Language-specific examples:

- C++ / Java / JavaScript / TypeScript / Go / Rust:

```cpp
//ADD_TO_NOTION
```

- Python / Ruby / Bash:

```python
#ADD_TO_NOTION
```

- SQL:

```sql
--ADD_TO_NOTION
```

Rules:

- the marker must be the first non-empty line
- it must match exactly
- if the marker is missing, the submission is skipped
- the marker line is removed before storing the code

## 9. Run Locally for the First Time

After `.env` is ready, run:

```powershell
npm run check
npm run test
npm run start
```

What should happen:

- config is validated
- recent accepted submissions are fetched from LeetCode
- only marked submissions are selected
- AI analysis is generated
- a Notion database is created if needed
- new Notion pages are created
- alerts are sent only if failures happen

## 10. Verify the First Successful Run

Check these things:

### In terminal logs

You should see messages like:

- `Pipeline started`
- `Fetching recent accepted submissions`
- `Problem stored`
- `Pipeline finished`

### In Notion

You should see:

- one database for this project
- pages for newly synced problems
- page properties filled
- solution code and AI summary in the page body

### In `.env`

If the first run auto-created the database:

- get the created database id
- put it into `NOTION_DATABASE_ID`
- set `NOTION_AUTO_CREATE_DATABASE=false`

## 11. Push to GitHub

Once local setup works:

```powershell
git add .
git commit -m "Set up LeetCode tracker"
git push
```

## 12. Enable GitHub Actions

The nightly automation is already defined in:

- [.github/workflows/nightly.yml](d:\Projects\demos\leetcode-automation\.github\workflows\nightly.yml)

Current schedule:

- `00:00 UTC / 05:30 IST` every day

To enable it:

1. Fork the repository into the user's own GitHub account
2. Push local changes to that fork
3. Open the forked repository
4. Go to `Settings`
5. Open `Secrets and variables`
6. Open `Actions`
7. Add repository secrets
8. Open the `Actions` tab
9. Enable Actions if GitHub asks

Important:

- each user should configure GitHub Actions in their own fork
- they should not depend on your original repository for their automation
- secrets should only be added to their own forked repository

## 13. Add GitHub Secrets

Add these repository secrets in the forked GitHub repository:

- `LEETCODE_SESSION`
- `LEETCODE_CSRF_TOKEN`
- `LEETCODE_USERNAME`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `OPENROUTER_MAX_TOKENS`
- `OPENROUTER_SITE_URL`
- `OPENROUTER_APP_NAME`
- `RESEND_API_KEY`
- `ALERT_EMAIL_TO`
- `ALERT_EMAIL_FROM`
- `ENABLE_FAILURE_ALERTS`
- `ALERT_DEDUPE_HOURS`
- `NOTION_API_KEY`
- `NOTION_PARENT_PAGE_ID`
- `NOTION_DATABASE_ID`
- `NOTION_AUTO_CREATE_DATABASE`
- `MAX_PROBLEMS_PER_RUN`
- `PROCESS_CONCURRENCY`
- `LOOKBACK_HOURS`

Important:

- GitHub Secrets must contain values, not placeholder text
- if `NOTION_DATABASE_ID` is still blank and `NOTION_AUTO_CREATE_DATABASE=true`, the workflow may create another new database
- after first stable setup, prefer:
  - `NOTION_DATABASE_ID=<real id>`
  - `NOTION_AUTO_CREATE_DATABASE=false`

## 14. Run GitHub Actions Manually Once

Do one manual run before depending on the nightly schedule.

Steps:

1. Open the forked GitHub repository
2. Open the `Actions` tab
3. Open `Nightly LeetCode Tracker`
4. Click `Run workflow`
5. Wait for the job to finish

Check:

- the run succeeds
- Notion pages are created in the correct database
- no invalid credential error appears
- alert emails work if a failure occurs

## 15. How the Nightly Run Works

Every scheduled run:

1. GitHub checks out the repo
2. Restores alert state cache
3. Installs dependencies with `npm ci`
4. Runs `npm run start`
5. Saves the run log artifact
6. Saves alert-state cache

This means the project does not need a server running 24/7.

## 16. Useful Files in the Project

- [.env.example](d:\Projects\demos\leetcode-automation\.env.example)
  Template for environment variables
- [README.md](d:\Projects\demos\leetcode-automation\README.md)
  General project overview
- [.github/workflows/nightly.yml](d:\Projects\demos\leetcode-automation\.github\workflows\nightly.yml)
  Nightly GitHub Actions workflow
- [.tracker-alert-state.json](d:\Projects\demos\leetcode-automation\.tracker-alert-state.json)
  Local alert dedupe state

## 17. Common Problems and Fixes

### LeetCode cookies stop working

Symptoms:

- recent submissions stop loading
- LeetCode requests fail

Fix:

- log in again to LeetCode
- copy fresh `LEETCODE_SESSION` and `csrftoken`
- update `.env` and GitHub Secrets in the fork

### OpenRouter credit or quota error

Symptoms:

- AI request fails
- errors mention credits, quota, or token limits

Fix:

- add OpenRouter credits
- reduce `OPENROUTER_MAX_TOKENS`
- rerun

### Notion page or database creation fails

Symptoms:

- Notion validation or auth errors

Fix:

- make sure the parent page was created first
- make sure that page is shared with the integration
- verify `NOTION_API_KEY`
- verify `NOTION_PARENT_PAGE_ID`
- verify `NOTION_DATABASE_ID` if using an existing database

### New Notion database gets created again

Symptoms:

- every run creates another database

Fix:

- copy the real database id into `NOTION_DATABASE_ID`
- set `NOTION_AUTO_CREATE_DATABASE=false`

### Alert emails do not arrive

Symptoms:

- failures happen but no mail is received

Fix:

- verify `RESEND_API_KEY`
- verify `ALERT_EMAIL_TO`
- verify `ALERT_EMAIL_FROM`
- check Resend sender/domain setup

## 18. Recommended Final Stable Configuration

After your first successful local run, your stable setup should usually look like this:

```env
LEETCODE_SESSION=real_cookie_value
LEETCODE_CSRF_TOKEN=real_csrf_value
LEETCODE_USERNAME=your_username
OPENROUTER_API_KEY=real_openrouter_key
OPENROUTER_MODEL=openai/gpt-4.1-mini
OPENROUTER_MAX_TOKENS=1200
OPENROUTER_SITE_URL=https://github.com/your-username/your-forked-repo
OPENROUTER_APP_NAME=leetcode-tracker-automation
RESEND_API_KEY=real_resend_key
ALERT_EMAIL_TO=you@example.com
ALERT_EMAIL_FROM=alerts@yourdomain.com
ENABLE_FAILURE_ALERTS=true
ALERT_DEDUPE_HOURS=24
ALERT_STATE_PATH=.tracker-alert-state.json
NOTION_API_KEY=real_notion_token
NOTION_PARENT_PAGE_ID=real_parent_page_id
NOTION_DATABASE_ID=real_database_id
NOTION_AUTO_CREATE_DATABASE=false
MAX_PROBLEMS_PER_RUN=20
PROCESS_CONCURRENCY=2
LOOKBACK_HOURS=24
```

## 19. Final Checklist

Before you depend on nightly automation, confirm all of these:

- the repository was forked into the user's own GitHub account
- `.env` is filled correctly
- local `npm run start` works
- the Notion parent page was created first
- the Notion parent page is shared with the integration
- real `NOTION_DATABASE_ID` is saved
- GitHub repository secrets are added to the fork
- one manual GitHub Actions run succeeds in the fork
- you understand how to refresh LeetCode cookies if they expire
- alert emails are configured and tested

Once these are done, the project is ready for daily automated use.
