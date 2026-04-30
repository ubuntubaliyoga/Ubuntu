# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Ubuntu Flow** — internal PWA for Ubuntu Bali retreat hosting. Notion is the database. Vercel is the host. Deploy = `git push origin main`.

The pricing engine (`src/pricing/`) uses Vite + TypeScript — `npm run build` compiles it to `js/pricing-engine.js`. All other JS is plain globals with no build step.

## Deploy

Vercel auto-deploys on every push to `origin/main`. The buildCommand in `vercel.json` stamps `sw.js` with `BUILD_TIMESTAMP`. There is no local dev server — the app only runs on Vercel (https://ubuntu-three-kappa.vercel.app).

### Git workflow — read this carefully

**The local `main` branch is permanently diverged from `origin/main` and must never be used as a base.** Always derive work from `origin/main` directly.

Every session follows this exact pattern — no exceptions:

```bash
# 1. Fetch the real remote state
git fetch origin main

# 2. Create a throw-away branch rooted at origin/main
git checkout -b work origin/main

# 3. Make and commit changes on that branch
git add <files>
git commit -m "..."

# 4. Push that branch directly into origin/main
git push origin work:main
```

**Why:** The harness running these sessions injects a feature-branch name (e.g. `claude/some-task-XXXX`) that diverges from local `main`. Trying to `git checkout main` and push will fail or silently deploy the wrong code. The only branch that Vercel watches is `origin/main`, and the only safe base for new commits is `origin/main`.

**Never do:**
- `git checkout main && git merge ... && git push origin main` — local main is diverged, merge will be refused
- `git push origin <feature-branch>` — Vercel does not watch feature branches; changes will be invisible
- Base any work on local `main` — it is stale by 50+ commits

## Architecture

**Single-page PWA.** `index.html` loads `css/style.css` and all JS via `<script src>`. Five views (deal, crm, bizdev, philosophy, tutorials) toggled by `switchTab()` in `js/core.js`.

### Frontend

| File | Responsibility |
|------|----------------|
| `css/style.css` | All app styles (extracted from index.html) |
| `js/core.js` | Global state, tab routing, error infrastructure, auto-debug agent dispatch, fetch monkey-patch, drift check on load |
| `js/drafts.js` | Deal drafts list — loads from Offers DB, stores full form state in `Form State` JSON blob |
| `js/offer.js` | Pricing calculations (`pricing()`, `TAX = 1.15`) and offer/contract PDF-style render |
| `js/crm.js` | CRM tab — lead cards, modal, email modal, drag-and-drop + long-press tab moves |
| `js/bizdev.js` | Leadgen tab — city autocomplete, random city, billboard, `lgGenerate()` |

`js/core.js` declares globals (`activeTab`, `crmData`, `crmTab`, `crmLoaded`) that all other files use — do **not** redeclare them.

### Backend (`api/`)

All handlers follow Vercel serverless conventions (`export default async function handler(req, res)`).

| File | Route | Purpose |
|------|-------|---------|
| `notion.js` | `POST /api/notion` | Offers DB CRUD — `action: load/create/update/delete` |
| `crm.js` | `POST /api/crm` | Unified CRM DB CRUD — `action: load/update/updateReachedOut/updateDetails/create/delete/promote/demote` |
| `leadgen-agent.js` | `POST /api/leadgen-agent` | Instagram hashtag scrape → profile scrape → Maps fallback → phone enrichment → Notion write |
| `lib/enrich-helpers.js` | *(imported)* | Shared phone extraction utilities — imported by `leadgen-agent.js` and `retro-enrich.js`. Lives in `lib/` not `api/` (Vercel 12-function limit). |
| `retro-enrich.js` | `GET /api/retro-enrich` | Re-run phone enrichment on today's leads. `?dry=1` = preview only |
| `clear-reached-out.js` | `GET /api/clear-reached-out` | Clear "Reached out on" for leads created since yesterday. `?dry=1` = preview |
| `exchange-rate.js` | `GET /api/exchange-rate` | USD→IDR live rate, 1h Vercel edge cache, fallback 17085 |
| `debug-agent.js` | `POST /api/debug-agent` | Level 1: Claude Haiku, pattern-gate auto-fix for safe Notion errors |
| `debug-agent-deep.js` | `POST /api/debug-agent-deep` | Level 2: Claude Sonnet with tool use — read_file, list_notion_databases, get_notion_schema, apply_fix |
| `drift-detector.js` | `GET /api/drift-detector` | Compares live Notion schemas vs hardcoded expected; runs daily via Vercel cron |
| `migrate-crm.js` | `GET/POST /api/migrate-crm` | ONE-TIME migration script — do not delete |

### Notion databases

| Constant | File | Value |
|----------|------|-------|
| `DB_ID` | `api/notion.js` | `978a217d69ae41bf9ca7ba9f5737ca3c` (Offers DB) |
| `CRM_DB_ID` | `api/crm.js`, `api/leadgen-agent.js`, `api/retro-enrich.js`, `api/clear-reached-out.js` | `34a622d3e57481738b3ce70824a6adf7` (unified CRM) |
| `BLOCKLIST_PAGE_ID` | `api/leadgen-agent.js` | `333622d3-e574-8159-b0d7-d4998af4cf2c` |

### Leadgen pipeline

`POST /api/leadgen-agent` flow:
1. **B1** — Fetch blocklist from Notion page
2. **B2** — Instagram hashtag scrape via Apify (`apify~instagram-hashtag-scraper`) → profile scrape (`apify~instagram-profile-scraper`)
3. **Maps fallback** — `compass~crawler-google-places` if < 10 leads found
4. **enrichContacts** — 5-method phone pipeline (Instagram captions → link-in-bio → website deep scrape → Brave Search). All helpers live in `api/enrich-helpers.js`
5. **claudeEnrich** — Claude Haiku extracts firstname, retreat name, variant from bio text
6. **B4** — Write to Notion CRM; append new names to blocklist

Phone enrichment source is logged to `_log` and shown in the "🔍 Debug trace" section in the UI.

### Auto-debug agent system

Errors flow: `window.onerror` / `window.onunhandledrejection` / fetch monkey-patch → `dbgStructured()` in `core.js` → dispatched to Level 1 or Level 2 agent.

- **Level 1** (`debug-agent.js`): Pattern gate (`SAFE_NOTION_CODES`), Claude Haiku, circuit breaker opens after 2 failures → escalates to Level 2.
- **Level 2** (`debug-agent-deep.js`): Claude Sonnet with tool use, max 8 turns, `auto_merge` → direct push to main; `needs_review` → opens a PR.
- Fetch monkey-patch **excludes** `/api/debug-agent*` URLs to prevent infinite loops.

### CRM data model

`api/crm.js` returns `{ emailLeads, whatsappLeads, shalaLeads, converted }` — all from one Notion database, partitioned by `Source` select + `Converted` checkbox. `promote`/`demote` flip only the checkbox; page ID never changes.

`js/crm.js` maps `lead.db` = `converted ? 'converted' : source.toLowerCase()` for tab routing.

Key helpers in `js/crm.js`:
- `allLeads()` — all non-converted leads
- `allLeadsAndConverted()` — all leads including converted
- `NOT_REACHED = 'Not reached out yet'` — sentinel displayed when `reachedOutOn` is empty

## Environment variables

| Variable | Used by |
|----------|---------|
| `NOTION_TOKEN` | All `api/` files that call Notion |
| `ANTHROPIC_API_KEY` | `api/debug-agent.js`, `api/debug-agent-deep.js`, `api/leadgen-agent.js` |
| `GITHUB_TOKEN` | `api/debug-agent.js`, `api/debug-agent-deep.js` |
| `APIFY_TOKEN` | `api/leadgen-agent.js` |
| `BRAVE_API_KEY` | `api/enrich-helpers.js` (optional — enables Brave Search phone lookup) |

## Key conventions

- **No framework, no bundler.** Vanilla JS ES modules in `api/`, plain JS globals in `js/`. `export default` only in `api/`.
- **`TAX = 1.15`** defined at top of `js/offer.js` (10% tax + 5% service charge). Use it — never hardcode `1.15`.
- **Notion rich_text 2000-char limit.** `toRichTextBlocks()` in `api/notion.js` chunks long strings.
- **`rt(s)` / `dt(s)` helpers** — used in `api/crm.js` and `api/migrate-crm.js` for building Notion `rich_text` and `date` property payloads.
- **`$('id')`** — shorthand for `document.getElementById` defined in `core.js`.
- **Meals default text** — always "2 plant based meals per day" everywhere.
- **`<br>` + inline `<span>` for sub-lines** — sub-text inside flex rows must use `<br><span style="...">` not a block `<div>`.

## UI patterns

### CRM card buttons
`.crm-action-btn` base class + colour modifier: `.crm-wa-btn` (green), `.crm-ig-btn` (pink), `.crm-web-btn` (blue), `.crm-em-btn` (terracotta). Email button opens `#email-modal` via `openEmailModal(leadId)`.

### Leadgen billboard
`lgBillboardStart()` / `lgBillboardStop()` in `js/bizdev.js` — 50 sales stats rotate every 5s while generation runs. Starts/stops automatically inside `lgGenerate()`.

### Outreach status
`NOT_REACHED` constant in `js/crm.js`. Active when `reachedOutOn` is empty. Clicking any real outreach method auto-deactivates it; deselecting all brings it back. Activating a method fires `spawnPlants(btn)` — plant emoji burst animation.

### Template edit mode (`window._templateMode`)

`openTemplateEdit()` sets `window._templateMode = true`. **Critical ordering:** call `switchTab('deal')` first, then set `_templateMode`, then fill fields, then `switchDealTab('edit')`. Setting it before `switchTab` causes it to be reset.

### Collapsible form sections

`toggleMoreDetails(btn)` — toggles `display:none` on the next sibling `<div>`.

### Avatar / update glow

When the service worker installs an update, `#avatar-btn` and the drawer update item both get class `update-glow` (`@keyframes avatarGoldPulse` / `updateItemGlow`).

### Bale/Gladak split (6+ rooms)

When `P.bales > 5`: render "5 Gladaks" + `(P.bales - 5) Partner Hotel Rooms` as separate rows. When `P.bales <= 5`: single Gladak row.

### Marketing Material overlay

`openMarketing()` / `closeMarketing()` show `#marketing-overlay`. Placeholder only — no backend.
