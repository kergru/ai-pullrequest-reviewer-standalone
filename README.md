# AI Pull Request Reviewer (Standalone)

This repository provides a local, standalone web application that loads pull requests, offers a GUI with a file tree and diff viewer, and allows triggering an AI-based review (LLM) per file. Additionally, after file reviews, you can create meta-reviews across all files and check them against JIRA tickets.

In short: a tool for semi-/fully-automated code review assistance using AI.

## Main Features

- Load PRs (GitHub / Bitbucket support).
- Display file tree and select changed files.
- Per-file diff viewer.
- Trigger an AI review for each file (calls an LLM with contextual prompt, budget & diagnostics).
- Meta-review: aggregate all file reviews, optionally attach the full diff, and verify against a JIRA request.
- Session management for review sessions.
- Optional: resolve / link to JIRA tickets.

## Architecture & Key Components

The app is built with Next.js + React + TypeScript.

Important folders/files:

- `src/app/` – Next.js app routes and API endpoints
  - `api/` – Backend API routes (e.g. `reviews`, `diff`, `sessions`, `llm-models`, `meta-review`, `resolve-jira`)
  - `review/[sessionId]/page.tsx` – Review UI for a session
- `src/components/`
  - `FileTree.tsx` – Renders the file tree structure
  - `DiffViewer.tsx` – Code diff viewer
  - `ReviewPanel.tsx` – Panel to run file reviews and show results
  - `ReviewDiagnosticsPanel.tsx` – Shows warnings / diagnostics
- `src/lib/`
  - `vcs/` – VCS client abstractions and providers (GitHub, Bitbucket)
  - `llm/` – LLM client, prompt builder, token/budgeting, runners for file/meta reviews
  - `review/` – Logic for preparing review context, policies, aggregation
  - `jira/` – JIRA helper functions
  - `session/` – Session persistence and store

## How it works (Flow)

1. Select a PR.
2. Optionally extract a JIRA ticket from the PR (e.g. via ticket key in branch name or PR title).
3. The VCS client loads the diff, changed files and metadata from the PR.
4. The UI displays the file tree and diffs.
5. The user triggers an AI review for a file → backend builds the context (file content, surrounding files, tests, diff, policy, system prompt, budget) and calls the LLM.
6. The response contains review items, warnings/diagnostics, and meta data (tokens, model, duration). The UI presents the results.
7. After several file reviews, a meta-review can be started that aggregates all file reviews and checks them against the JIRA ticket.

## Technologies

- Next.js (App Router)
- React + TypeScript
- Node.js
- LLM client (custom implementation in `src/lib/llm`) — supports plugging in providers (OpenAI, Anthropic, local LLMs)
- VCS provider implementations (GitHub / Bitbucket)
- JIRA integration (via REST API)

## Local Setup (Development)

1. Install Node.js (>=16).
2. Install dependencies:

   npm install

3. Start local dev server:

   npm run dev

4. To use LLMs: configure API keys in `.env.local` (e.g. `OPENAI_API_KEY=...`).
