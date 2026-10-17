# 🚀 Automation, Job Discovery & Live-Link Checking System
> **Role:** Automation Engineer / Background Tasks & Aggregator  
> **Challenge:** Problem 2 – Placement Readiness Challenge (MSOT Hackathon)

This system provides an end-to-end background automation engine that verifies live project deployments using headless browser automation, discovers relevant tech roles across compliant ATS and RSS sources using boolean logic, calculates the official **Module 4 Placement Readiness Score**, and syncs results to **Supabase**. Local SQLite is available for development, while verification workflows can require Supabase and fail closed.

---

## 📑 Core Capabilities

### 1. 🔍 Live Link Checking (`src/link_checker/`)
- **Headless Mobile Emulation (Playwright)**: Launches Chromium emulating mobile viewports (iPhone 13 standard: 375x812, touch enabled, retina pixel ratio).
- **Comprehensive Error Auditing**:
  - Catches browser `console.error` logs and unhandled JavaScript exceptions (`pageerror`).
  - Detects failed network assets (4xx/5xx script/stylesheet bundles).
  - Flags **white-screens / empty DOM mounts** (common in broken React/Next.js/Vue client-side hydration).
  - Checks for mobile viewport meta tags and horizontal overflow (`scrollWidth > clientWidth`).
- **Visual Proof**: Captures above-the-fold mobile screenshots and automatically uploads them to Supabase Storage (`project-screenshots` bucket).
- **Diagnostics & Scoring**: Computes an automated quality score (0–100) and actionable fix advice.

### 2. 🎯 Compliant Job Discovery & Boolean Search (`src/job_discovery/`)
- **100% Policy-Compliant**: Strictly avoids illegal scraping on LinkedIn or unauthorized sites. Uses permitted, public data sources:
  - **Official Greenhouse Public ATS API**: Query company boards (e.g. Cloudflare, Figma, GitLab, Datadog, Reddit, Instacart, etc.).
  - **Official Lever Public ATS API**: Query company career boards.
  - **Syndicated Tech RSS Feeds (`feedparser`)**: WeWorkRemotely, Jobicy, RemoteOK.
- **Nested Boolean Query Engine**: Supports `AND`, `OR`, `NOT`, quotes `"..."`, and parentheses `(...)`.
  - *Example:* `("React" OR "Next.js") AND (intern OR internship) AND (Bangalore OR remote)`
- **Match Scoring & Explainability**: Calculates relevance (0–100%) and provides **"Why this job matched"** highlighting student skills and role criteria.
- **Smart Deduplication**: Eliminates duplicate postings across cross-listed boards.

### 3. 📊 Placement Readiness Score Math Engine (`src/readiness_score/`)
- **Official Weights (Hackathon Module 4, Page 12)**:
  | Component | Weight | Source |
  | :--- | :---: | :--- |
  | **Resume quality** | **25%** | Member 2 (Resume Parsing & Checks) |
  | **Projects (live, documented, well-coded)** | **25%** | Live Link Check (10%) + GitHub Review (10%) + README (5%) |
  | **Mock interview performance** | **20%** | Member 3 (AI Mock Viva) |
  | **GitHub profile and activity** | **10%** | Member 2 (Profile README & commits) |
  | **Coding practice (LeetCode etc.)** | **10%** | Member 2 (Solved counts & difficulty) |
  | **LinkedIn profile** | **5%** | Member 2 (Headline & Experience) |
  | **Co-curricular achievements** | **5%** | Member 2 (Hackathons & Clubs) |
  | **Total** | **100%** | |
- **Readiness Tiers**:
  - `0 – 49`: **Not ready**
  - `50 – 74`: **Almost ready**
  - `75 – 100`: **Placement ready**
- **Top 5 Point-Yielding Actions**: Sensitivity analysis computes which deficient areas give the candidate the highest point return to reach the next tier.

### 4. 🗄️ Supabase Sync with Local Fallback (`src/db/`)
- Direct integration with Member 1's Supabase database and storage buckets.
- **Local SQLite / JSON Fallback**: If Supabase credentials are not yet entered in `.env`, the entire system runs locally inside `data/local_cache.db` with zero errors.

---

## 🛠️ Quickstart

### 1. Install dependencies
```bash
uv sync --dev
uv run playwright install chromium
```

### 2. Run Complete Showcase Demo
```bash
uv run python run.py demo
```

### 3. Run Individual Commands
- **Check a live project link:**
  ```bash
  uv run python run.py check-link https://my-portfolio-demo.vercel.app --name "AI Portfolio"
  ```
- **Discover matching jobs:**
  ```bash
  uv run python run.py discover-jobs --skills "React, TypeScript, Python" --role "Software Engineer Intern" --limit 10
  ```
- **Compute placement readiness score:**
  ```bash
  uv run python run.py calculate-score --file data/sample_student_input.json
  ```
- **Start REST API / Webhook server:**
  ```bash
  uv run python run.py serve --port 8000
  ```

### 4. Run Test Suite
```bash
uv run pytest
```

### 5. Verify a real Supabase score write

Set `SUPABASE_URL` and the server-only `SUPABASE_SERVICE_ROLE_KEY`, apply the
frontend Supabase migrations, then run:

```bash
uv run python -m scripts.verify_readiness_supabase
```

The verifier calculates the seven-component fixture, requires a Supabase
upsert, reads the row back, and prints the persisted JSON. Never expose the
service-role key to browser code.

---

## 🤖 Background Automation & GitHub Actions

Two automated GitHub Actions are included in `.github/workflows/`:
1. **`daily_job_discovery.yml`**: Scheduled daily cron (`0 6 * * *` at 6 AM UTC) that pulls fresh internship and entry-level listings, filters them, and syncs them to Supabase.
2. **`live_link_checker.yml`**: On-demand or scheduled headless Playwright runner to verify student project URLs and upload mobile screenshots as artifacts.

---

## 📐 Database Schema for Member 1

Member 1 can execute `src/db/schema.sql` in the Supabase SQL Editor:
- `project_live_checks`: stores link verification results, console errors, load time, and screenshot URLs.
- `discovered_jobs`: stores aggregated ATS/RSS jobs with boolean match flags and relevance scores.
- `readiness_scores`: stores calculated readiness scores (0–100), tiers, and top 5 action items.
- **Storage Bucket**: Create a public bucket named `project-screenshots`.
