# Ubuntu Bali — Lead Research & Notion Sync

**Goal:** Research yoga/retreat/conscious community leads for Shala rental
at https://www.ubuntubali.com/yoga-venue in [CITY]. Sync to Notion.

No step confirmations. No tool call narration. Final output only.

## Final Output

```
| Business Name | Email | WA Link | Status |
✅ Added: [Name] / ⏭️ Skipped: Duplicate: [Name]
```

---

## B1 — Blocklist

Fetch flat page (not CRM): `333622d3-e574-8159-b0d7-d4998af4cf2c`

Split on commas, trim → in-memory set. Frozen for entire run. No re-fetch.
Fail → skip, flag user, continue.

**Dedupe rules** (apply at B2 and before each B4 write):

- Check each candidate against every blocklist entry individually. No skimming.
- Match on candidate's own name only — not venue, surname, or associated facilitator.
- Shared surname or shared venue contact is NOT a match.
- Only drop a candidate if their own name closely matches a blocklist entry.

After B4: append only actually-written names to same page, one call.
Never append skipped or dropped candidates.

---

## B2 — Research

**Search 1:** Discover the top local platforms for yoga/wellness event listings in [CITY/COUNTRY] — use these to anchor all subsequent searches. Do not assume platforms.

**Search 2:** `yoga OR retreat OR wellness facilitator [CITY] 2025 2026` on best platforms found.

**Search 3:** `yoga studio [CITY] retreat OR workshop OR program contact` using local directories found.

Extract **12 candidates**: name, website, Instagram, named event (retreat, workshop, immersion, YTT, or recurring branded program — past events qualify). No event of any kind → DROP.

Contacts: fetch `[website]/events` OR `/retreat` AND `[website]/contact` as one paired operation. Cap 800 tokens. Fetch any Linktree directly. Skip Instagram bios but record handle as contact fallback.

If 2+ still missing phone: 1 batched OR-search `"Name1" OR "Name2" contact phone [CITY]`. Still missing → "Not found".

**Total ops:** 3 searches + max 4 fetches. Dedupe, take first 10, note shortfall if <10.

---

## B3 — WhatsApp Message

No number found → write `no number found` in Whatsapp 1. Never store message text as fallback.

Number found → encode as `wa.me` link:

**MESSAGE 1 — Curiosity Hook** (personalised per lead):

```
https://wa.me/[NUMBER]?text=Dear%20[FIRSTNAME],%20Kevin%20here%20from%20Bali.%0A%0A[A]%20You%20are%20hosting%20the%20[UPCOMING%20RETREAT],%20is%20that%20right%3F
```

```
[B — no upcoming retreat] You held [LAST RETREAT], is that right?
```

---

## B4 — Notion Write

Write all leads in one batch to: `collection://320622d3-e574-81e2-b672-000b38b5ed23`

| Field | Value |
|---|---|
| Name | full name or business name (Title) |
| Whatsapp 1 | MESSAGE 1 link (Text) |
| Mail | email (Text) |
| Website | URL (Text) |
| Location | Google Maps link for [CITY] (Text) |
| Insta | Instagram handle (Text) |
| Engaged first | [TODAY'S DATE] (Text) |
