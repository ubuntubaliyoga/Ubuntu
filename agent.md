# agent.md — Ubuntu Flow: Agent Navigation Guide

> Read this before touching any file. It applies to Claude, Gemini, and any other agent working in this repo.

## Rules first

- **Never create new files in the repo root.** The root contains only config files (`vercel.json`, `package.json`, `tsconfig.json`, `vite.config.ts`, `sw.js`, `index.html`). Everything else lives in a subdirectory. If you think you need a new file, put it in the correct subdirectory.
- **Never create scratch, notes, or exploration files** (`notes.md`, `plan.txt`, `test.js`, etc.). Work happens in the actual source files.
- **Always push to `main` when done.** `git push origin main` — Vercel auto-deploys on push to main.
- **Commit directly to main** for this solo project. Feature branches only if the user explicitly asks.
- **Read before editing.** Always read a file before writing to it.

---

## What this project is

**Ubuntu Flow** — internal PWA for Ubuntu Bali retreat hosting (yoga / experience packages).  
Live URL: `https://ubuntu-three-kappa.vercel.app`  
Database: Notion. Host: Vercel (Hobby plan — max 12 serverless functions in `api/`).  
Deploy: `git push origin main` → Vercel builds and serves.

---

## AI Collaboration Protocol

This repo uses a tiered intelligence approach to balance speed and reasoning.

- **Gemini 3 Flash (Workhorse):** Use for 80% of tasks.
    - UI/CSS styling and layout tweaks.
    - Standard API CRUD updates (Notion/CRM).
    - Documentation, logs, and maintenance.
    - Standard bug fixes and "Safe" auto-fixes.
- **Claude 3.5 Sonnet (Architect):** Use for "Sophisticated" tasks.
    - Complex algorithms (e.g., Pricing Engine `engine.ts` logic).
    - Architectural decisions (managing the 12-function limit).
    - Cross-file refactors or breaking schema changes.
    - Security-sensitive logic or complex regex (Leadgen).

---

## File map

```
ubuntu-flow/
│
├── index.html              Single HTML shell — loads all CSS + JS
├── sw.js                   Service worker (no-cache, BUILD_TIMESTAMP replaced on deploy)
│
├── css/
│   └── style.css           ALL styles for the entire app (one file)
│
├── js/                     Plain JS globals — loaded via <script src> in index.html
│   ├── core.js             Global state, tab routing, error/debug system, fetch patch
│   ├── offer.js            Pricing calc (pricing(), TAX=1.15), offer + contract render
│   ├── drafts.js           Deals list, Notion CRUD, draft form state
│   ├── crm.js              CRM tab — lead cards, email modal, drag-drop
│   ├── bizdev.js           Leadgen tab — hashtag scrape, city autocomplete
│   ├── fx.js               Currency ticker (USD/IDR/EUR/etc)
│   └── pricing-engine.js   AUTO-GENERATED — do not edit directly (see src/pricing/)
│
├── src/pricing/            TypeScript source for the pricing engine (compiled → js/pricing-engine.js)
│   ├── main.ts             Entry point — wires all window.* exports
│   ├── admin-ui.ts         Cost Calculation overlay: library tab, templates tab, renders HTML
│   ├── chat-ui.ts          AI chat panel inside the overlay (sendPeChat, applyPeAction)
│   ├── deals-ui.ts         Deals tab integration — extras picker, recalculate on pax change
│   ├── engine.ts           Pure SPPP formula: CEIL((fixedCosts/pax + variableCosts) × markup)
│   ├── store.ts            load/save pricing.json via /api/save-pricing
│   └── types.ts            Shared interfaces + Window augmentation
│
├── api/                    Vercel serverless functions (max 12 — currently at 12)
│   ├── notion.js           POST /api/notion — Offers DB CRUD
│   ├── crm.js              POST /api/crm — CRM DB CRUD
│   ├── leadgen-agent.js    POST /api/leadgen-agent — Instagram scrape → Notion
│   ├── retro-enrich.js     GET /api/retro-enrich — re-enrich today's leads
│   ├── clear-reached-out.js GET /api/clear-reached-out
│   ├── exchange-rate.js    GET /api/exchange-rate — USD→IDR, 1h cache
│   ├── debug-agent.js      POST /api/debug-agent — L1 auto-fix (Claude Haiku)
│   ├── debug-agent-deep.js POST /api/debug-agent-deep — L2 auto-fix (Claude Sonnet)
│   ├── drift-detector.js   GET /api/drift-detector — daily Notion schema check
│   ├── migrate-crm.js      ONE-TIME migration script — do not delete, do not run again
│   ├── pricing-chat.js     POST /api/pricing-chat — AI assistant for Cost Calculation overlay
│   └── save-pricing.js     POST /api/save-pricing — writes data/pricing.json via GitHub API
│
├── lib/                    Shared helpers (not Vercel functions)
│   └── enrich-helpers.js   Phone extraction utils — imported by leadgen-agent + retro-enrich
│
├── data/
│   └── pricing.json        Cost library + product templates (edited via the admin overlay)
│
└── [build config — root only]
    ├── vercel.json         buildCommand: sw.js timestamp only (no npm run build)
    ├── package.json        Vite + TypeScript devDeps — only needed to build src/pricing/
    ├── vite.config.ts      IIFE build: src/pricing/main.ts → js/pricing-engine.js
    └── tsconfig.json
```

---

## Key subsystems

### Pricing Engine
Accessed via the **Cost Calculation** button in the avatar drawer.  
- **Library tab** — list of cost items (id, name, IDR cost). Edits are staged in memory; click Save to persist.
- **Templates tab** — product templates that reference library items. Dropdown to add items; each chip has a "fixed ÷pax" toggle (fixed = shared group cost divided by headcount; unticked = per-person cost).
- **AI chat panel** — bottom of the overlay. Calls `/api/pricing-chat` (Claude Haiku) with tools: `add_library_item`, `create_template`, `update_cost`. Suggested actions appear as cards; click Apply to stage, Save to persist.
- **SPPP formula**: `Math.ceil((fixedTotal / pax + variableTotal) × markup)`
- **Modifying**: edit `src/pricing/*.ts` → run `npm run build` → commit `js/pricing-engine.js`

### Deals tab extras
Experiences from the pricing engine appear in the extras dropdown (`pe_` prefix). Changing pax triggers `recalculatePeExtra()` which recomputes SPPP live.

### CRM
Four tabs: email leads, whatsapp leads, shala leads, converted. All from one Notion DB — partitioned by `Source` select + `Converted` checkbox. `promote`/`demote` only flip the checkbox; page ID never changes.

### Auto-debug system
JS errors → `dbgStructured()` in `core.js` → L1 (`debug-agent.js`, Haiku, safe patterns only) → escalates to L2 (`debug-agent-deep.js`, Sonnet, tool use, can push to main).

---

## Notion databases

| DB | ID | Used by |
|----|----|---------|
| Offers | `978a217d69ae41bf9ca7ba9f5737ca3c` | `api/notion.js` |
| CRM | `34a622d3e57481738b3ce70824a6adf7` | `api/crm.js`, leadgen, retro-enrich, clear-reached-out |

---

## Environment variables

`NOTION_TOKEN` · `ANTHROPIC_API_KEY` · `GITHUB_TOKEN` · `APIFY_TOKEN` · `BRAVE_API_KEY`  
Set in Vercel dashboard. Never hardcode.

---

## Critical conventions

| Rule | Detail |
|------|--------|
| `TAX = 1.15` | Defined top of `js/offer.js`. Never hardcode `1.15` anywhere. |
| `$('id')` | Shorthand for `getElementById`, defined in `core.js`. Use it in `js/` files. |
| No framework in `js/` | Plain globals only. `export default` only in `api/`. |
| Notion rich_text limit | 2000 chars. Use `toRichTextBlocks()` in `api/notion.js` for long strings. |
| `<br>+<span>` for sub-lines | Never use a block `<div>` for sub-text inside flex rows. |
| Meals text | Always "2 plant based meals per day". |
| Vercel function limit | `api/` is at exactly 12 functions — do not add new files there. Put shared helpers in `lib/`. |
| `pricing-engine.js` | Never edit directly — it is the compiled output. Edit `src/pricing/` and run `npm run build`. |

---

## How to make changes

**Frontend (js/, css/, index.html):**
```bash
# Edit the file, then:
git add <file> && git commit -m "..." && git push origin main
```

**Pricing engine (src/pricing/):**
```bash
# Edit src/pricing/*.ts, then:
npm run build          # outputs to js/pricing-engine.js
git add src/pricing/ js/pricing-engine.js
git commit -m "..." && git push origin main
```

**API (api/):**
```bash
# Edit api/*.js, then:
git add api/<file> && git commit -m "..." && git push origin main
```

**Shared helpers:**  
Go in `lib/`, not `api/`. Import with `'../lib/filename.js'` from inside `api/`.

---

## Current status (as of 2026-04-25)

| Feature | Status |
|---------|--------|
| Deals / Offers tab | Live — Notion backend, multi-currency (USD/IDR/EUR/CNY/JPY/RUB), offer + contract render |
| CRM tab | Live — email/WA/shala/converted, drag-drop, email modal |
| Leadgen tab | Live — Instagram scrape, phone enrichment, Notion write |
| Cost Calculation overlay | Live — library editor, templates with dropdown+chips, AI chat panel |
| Marketing Material overlay | Placeholder — UI exists, no backend |
| Auto-debug agents | Live — L1 Haiku + L2 Sonnet, push-to-main on auto_merge |
