# CLAUDE.md

**Ubuntu Flow** — PWA for Ubuntu Bali retreat hosting. Notion DB. Vercel host.

## Deploy

```bash
git push -u origin main   # Vercel auto-deploys
```

**Commit directly to `main`.** No feature branches unless asked. Push at end of every session.  
No local dev server — app runs on Vercel only (https://ubuntu-three-kappa.vercel.app).

## Hard rules

- **Never create files in repo root** — config files only (`vercel.json`, `package.json`, etc.)
- **Never create scratch/notes files** — no `notes.md`, `plan.txt`, `test.js`, etc.
- **`TAX = 1.15`** — defined in `js/offer.js`. Never hardcode `1.15`.
- **`$('id')`** — shorthand for `getElementById` in `core.js`. Use it in all `js/` files.
- **No framework in `js/`** — plain globals only. `export default` only in `api/`.
- **`js/core.js` declares globals** (`activeTab`, `crmData`, `crmTab`, `crmLoaded`) — do not redeclare.
- **`api/` is at 12 functions (Vercel limit)** — do not add files there. Shared helpers go in `lib/`.
- **`js/pricing-engine.js` is compiled output** — never edit directly. Edit `src/pricing/*.ts` → `npm run build`.
- **Notion rich_text 2000-char limit** — use `toRichTextBlocks()` in `api/notion.js` for long strings.
- **`<br>+<span>` for sub-lines** — never a block `<div>` inside flex rows.
- **Meals text** — always "2 plant based meals per day".
- **Read before editing** — always read a file before writing to it.

## Full reference

See `agent.md` — file map, API routes, Notion DB IDs, env vars, subsystem docs, UI patterns.
