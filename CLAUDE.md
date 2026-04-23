# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Ubuntu Flow** — internal PWA for Ubuntu Bali retreat hosting. Notion is the database. Vercel is the host. No npm, no build system, no package.json. Deploy = `git push origin main`.

## Deploy

```bash
git push -u origin main   # Vercel auto-deploys; sw.js BUILD_TIMESTAMP replaced by vercel.json buildCommand
```

Test API endpoints locally by setting `NOTION_TOKEN` (already in `.claude/settings.local.json`) and running:
```bash
node -e "process.env.NOTION_TOKEN='...'; import('./api/notion.js').then(m => ...)"
```
There is no local dev server — the app only runs on Vercel.

## Architecture

**Single-page PWA.** `index.html` contains all CSS inline and loads all JS via `<script src>`. Five views (deal, crm, bizdev, philosophy, tutorials) toggled by `switchTab()` in `js/core.js`.

### Frontend (`js/`)

| File | Responsibility |
|------|----------------|
| `core.js` | Global state, tab routing, error infrastructure, auto-debug agent dispatch, fetch monkey-patch, drift check on load |
| `drafts.js` | Deal drafts list (loads from Offers DB, stores full form state in `Form State` JSON blob) |
| `offer.js` | Pricing calculations (`pricing()`) and offer/contract PDF-style render |
| `crm.js` | CRM tab — lead cards, modal, drag-and-drop + long-press tab moves, duplicate detection |

`js/core.js` declares globals (`activeTab`, `crmData`, `crmTab`, `crmLoaded`) that all other files use — do **not** redeclare them.

### Backend (`api/`)

All handlers follow Vercel serverless conventions (`export default async function handler(req, res)`).

| File | Route | Purpose |
|------|-------|---------|
| `notion.js` | `POST /api/notion` | Offers DB CRUD — `action: load/create/update/delete` |
| `crm.js` | `POST /api/crm` | Unified CRM DB CRUD — `action: load/update/updateReachedOut/updateDetails/create/delete/promote/demote` |
| `exchange-rate.js` | `GET /api/exchange-rate` | USD→IDR live rate, 1h Vercel edge cache, fallback 17085 |
| `debug-agent.js` | `POST /api/debug-agent` | Level 1: Claude Haiku, pattern-gate auto-fix for safe Notion errors |
| `debug-agent-deep.js` | `POST /api/debug-agent-deep` | Level 2: Claude Sonnet with tool use — read_file, list_notion_databases, get_notion_schema, apply_fix |
| `drift-detector.js` | `GET /api/drift-detector` | Compares live Notion schemas vs hardcoded expected; runs daily via Vercel cron |
| `migrate-crm.js` | `GET/POST /api/migrate-crm` | ONE-TIME: GET = dry run, POST = migrate 4 old DBs → unified CRM |

### Notion databases

| Constant | File | Value |
|----------|------|-------|
| `DB_ID` | `api/notion.js` | `978a217d69ae41bf9ca7ba9f5737ca3c` (Offers DB) |
| `CRM_DB` | `api/crm.js`, `api/migrate-crm.js`, `api/drift-detector.js` | **`REPLACE_WITH_NEW_DB_ID`** — unified CRM DB not yet created |

**Pending:** Create the unified CRM Notion database, replace all three `REPLACE_WITH_NEW_DB_ID` placeholders, then run `POST /api/migrate-crm` to migrate leads from the 4 old databases (IDs in `api/migrate-crm.js` `OLD` constant).

### Auto-debug agent system

Errors flow: `window.onerror` / `window.onunhandledrejection` / fetch monkey-patch → `dbgStructured()` in `core.js` → dispatched to Level 1 or Level 2 agent.

- **Level 1** (`debug-agent.js`): Pattern gate (`SAFE_NOTION_CODES`), Claude Haiku, circuit breaker opens after 2 failures → escalates to Level 2.
- **Level 2** (`debug-agent-deep.js`): Claude Sonnet with tool use, max 8 turns, `auto_merge` confidence → direct push to main; `needs_review` → opens a PR.
- Agent toggle button in the debug panel (bottom of screen) — persisted in `localStorage`.
- Fetch monkey-patch **excludes** `/api/debug-agent*` URLs to prevent infinite loops.

### CRM data model

`api/crm.js` returns `{ emailLeads, whatsappLeads, shalaLeads, converted }` — all from one Notion database, partitioned by `Source` select + `Converted` checkbox. `promote`/`demote` flip only the checkbox; page ID never changes.

`js/crm.js` maps `lead.db` = `converted ? 'converted' : source.toLowerCase()` for tab routing.

## Environment variables

| Variable | Used by |
|----------|---------|
| `NOTION_TOKEN` | All `api/` files that call Notion |
| `ANTHROPIC_API_KEY` | `api/debug-agent.js`, `api/debug-agent-deep.js` |
| `GITHUB_TOKEN` | `api/debug-agent.js`, `api/debug-agent-deep.js` (push fixes / open PRs) |

`NOTION_TOKEN` is stored in `.claude/settings.local.json` (gitignored) for local use. All three are set in Vercel project environment variables for production.

## Key conventions

- **No framework, no bundler.** Vanilla JS ES modules in `api/`, plain JS globals in `js/`. `export default` only in `api/`.
- **Notion rich_text 2000-char limit.** `toRichTextBlocks()` in `api/notion.js` chunks long strings. The `Form State` field stores the entire serialized form as JSON.
- **`rt(s)` / `dt(s)` helpers** — used in both `api/crm.js` and `api/migrate-crm.js` for building Notion `rich_text` and `date` property payloads.
- **`$('id')`** — shorthand for `document.getElementById` defined in `core.js`.
- **Drift detector** — update `EXPECTED` in `api/drift-detector.js` whenever Notion property names change in code.
- **Meals default text** — always "2 plant based meals per day" everywhere (offer, contract, form defaults). Legacy "2 organic meals per day" is migrated on draft load in `loadDraftByIndex()`.
- **`<br>` + inline `<span>` for sub-lines** — sub-text inside flex rows must use `<br><span style="...">` not a block `<div>` (flex layout breaks block children).

## UI patterns

### Template edit mode (`window._templateMode`)

`openTemplateEdit()` in `core.js` sets `window._templateMode = true` and opens the edit view with a "Master Template" heading. While active:
- `saveToNotion()` in `drafts.js` intercepts and calls `showTemplateConfirm()` instead of saving to Notion.
- Autosave is suppressed (`markDraftActive()` returns early when `intentionalDraft === false`).
- `switchDealTab('edit')` skips resetting the title/button/notion-status when `_templateMode` is true.
- `switchDealTab('drafts')` resets `_templateMode = false`.

**Critical ordering in `openTemplateEdit()`:** call `switchTab('deal')` first (resets any prior state), then set `_templateMode = true`, then fill form fields, then `switchDealTab('edit')`. Setting `_templateMode` before `switchTab` causes it to be reset.

Template fields are defined in `TEMPLATE_FIELDS` in `core.js` and stored in `localStorage` key `masterTemplate`. Applied to new drafts in `newDraft()`.

### Collapsible form sections

Use the `toggleMoreDetails(btn)` pattern — a `<button>` that toggles `display:none` on the next sibling `<div>`.

### Avatar update glow

When the service worker installs an update, `#avatar-btn` and `#update-btn` both get class `update-glow` (CSS `@keyframes avatarGoldPulse`). `#update-btn` is `display:none` by default.

### Contract pricing table

Two-column layout: **ITEM** (with optional detail sub-line) and **TOTAL** (right-aligned). Built with `cR(label, sub, amt)` helper in `buildContractHTML()` (`js/offer.js`). Rows with no rate sub-line pass `''` as `sub`. Section headers and total rows use `colspan="2"`.

### Offer pricing table (`.pt-*` classes)

Three-column layout in the offer tab (Item, Rate, Subtotal) — separate from the simplified contract table.

### Sign-off section

Collapsed by default using `toggleMoreDetails`. Two fields:
- `f-signoff` — offer sign-off name (default: "Andréa and Tari")
- `f-signoff2` — contract signatory note (default: "Tari, as representative of Andréa Drottholm")

### Bale/Gladak split (6+ rooms)

When `P.bales > 5`: render "5 Gladaks" + `(P.bales - 5) Partner Hotel Rooms` as separate rows in both offer and contract. When `P.bales <= 5`: single Gladak row.

### Marketing Material overlay

`openMarketing()` / `closeMarketing()` show `#marketing-overlay` with 5 placeholder cards. No backend — placeholder only.
