# AV Prep Checklist App: Project Plan

A collaborative web app that turns a client's equipment-list PDF into a shared workspace where the AV team marks each item as **have it**, **don't have it**, or **on another gig**.

## 1. Goals

- Upload a PDF equipment list and get a structured, editable checklist.
- Let the whole team mark items at the same time, with changes appearing instantly.
- Keep the existing color system: green (have), orange (don't have), purple (on another gig).
- Work well on a phone, in a warehouse, with patchy signal.
- Keep a record of who changed what and when.

**Non-goals for v1:** inventory management, billing, client-facing portals, native apps.

## 2. Users and roles

| Role | Can do |
|------|--------|
| **Admin** | Create events, upload PDFs, edit the list, invite crew, manage roles |
| **Crew** | View the list, mark statuses and quantities, add notes |
| **Viewer** (optional, later) | Read-only access, e.g. a sourcing or rental contact |

## 3. Item model

Each item has:

- `name`, `section` (audio / lighting / video / staging / other), `notes`
- `qtyNeeded`
- `qtyHave`: how many are confirmed in hand
- `status`: `unmarked | have | missing | other_gig`
- For `other_gig`: `otherGigId` (or free text), `qtyOnOtherGig`, `expectedBack` date

Partial quantities (e.g. "have 3 of 5 wireless mics") are handled by `qtyHave` against `qtyNeeded`. The color shown is derived from the status plus quantities:

- Green: `qtyHave >= qtyNeeded`
- Orange: shortfall with nothing allocated elsewhere
- Purple: the shortfall is covered by gear on another gig
- Partial: a split indicator when it's a mix (e.g. 3 have + 2 on another gig)

## 4. Tech stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js (App Router), React, TypeScript, Tailwind |
| Data and realtime | Firestore (`onSnapshot` listeners) |
| Auth | Firebase Auth (email link or Google sign-in) |
| File storage | Firebase Storage (original PDFs) |
| PDF extraction | Claude API, called server-side only (Next.js route handler or Cloud Function) |
| Hosting | Vercel or Firebase App Hosting |

Why Firestore: realtime sync and offline persistence are built in, which covers the two hardest requirements (live collaboration and flaky warehouse Wi-Fi) without running a socket layer.

## 5. Firestore data model

```
users/{uid}
  name, email, photoURL

events/{eventId}
  name, date, venue, client, createdBy, createdAt
  members: { [uid]: "admin" | "crew" | "viewer" }
  sourcePdfPath, listVersion, archived

events/{eventId}/items/{itemId}
  name, section, notes, sortOrder
  qtyNeeded, qtyHave
  status
  otherGigId, otherGigName, qtyOnOtherGig, expectedBack
  sourceRef            // page and line it came from, for traceability
  updatedBy, updatedAt

events/{eventId}/activity/{logId}
  itemId, itemName, userId, userName, at
  change: { field, from, to }

events/{eventId}/imports/{importId}
  version, pdfPath, status (processing | review | applied | failed)
  extractedItems[], diff { added, removed, changed }
```

Notes on the model:

- Keep `members` as a map on the event doc so security rules can check access with one read.
- Write the item update and its activity log entry in a single batched write, so the log can never drift from reality.
- Denormalize `userName` into the activity log so rendering it doesn't need extra reads.
- A cross-gig view for purple items uses a collection group query on `items` where `status == "other_gig"`. This needs a composite index and rules that allow the query for members of the relevant events.

## 6. Security rules (outline)

- Only authenticated users can read or write.
- Event read: `request.auth.uid in resource.data.members`.
- Item write: members with role `admin` or `crew`.
- Item create and delete, event edits, and member changes: `admin` only.
- Activity log: create-only for members, no updates or deletes.
- PDF extraction runs server-side with the Admin SDK, so the Claude API key never reaches the client.

## 7. PDF import pipeline

1. **Upload**: the admin uploads the PDF to Firebase Storage and an `imports` doc is created.
2. **Extract**: a server function sends the PDF to Claude with a structured-output prompt and returns JSON: item name, quantity, section, notes, and source page.
   - Text-based PDFs: send the document directly.
   - Scans or photos: rely on the model's vision on the page images (no separate OCR step at first).
3. **Review screen**: the admin sees the extracted list beside the original PDF page. They can edit names and quantities, merge or split lines, reassign sections, and delete junk rows. Nothing is written to the live list until they confirm.
4. **Apply**: confirmed items are written to `items` in batched writes (500 ops per batch limit).

A misread quantity means a missing mic on show day, so the review step is not optional.

### Revised lists (v2 from the client)

- Re-upload creates a new import with `version + 1`.
- Match new rows to existing items by normalized name and section (fuzzy matching, with the model assisting on ambiguous cases).
- Show a diff: **new**, **removed**, **quantity changed**, **unchanged**.
- Applying the diff preserves statuses on unchanged items. Changed quantities reset to "needs re-check" instead of silently keeping the old status.

## 8. Key screens

1. **Events list**: upcoming and past events, with a progress ring on each.
2. **Event workspace** (main screen):
   - Items grouped by section, with a sticky progress bar.
   - Large tap targets, one-tap status cycling, long-press or swipe for quantity and notes.
   - Filters: all / unmarked / missing / other gig / mine.
   - Live presence (who's viewing) is a nice-to-have.
3. **Import and review**: upload, processing state, side-by-side review.
4. **Missing items view**: orange and purple items only, with a shareable or exportable summary for whoever is sourcing gear.
5. **Activity log**: filterable by item or user.
6. **Cross-gig view**: all purple items across events, with the other gig and expected return date.
7. **Members**: invite and manage roles.

## 9. Offline and conflict behavior

- Enable Firestore offline persistence so marks made without signal sync on reconnect.
- Show a small "pending sync" indicator on locally-written items.
- Conflicts are last-write-wins per item. The activity log keeps the full history, so a bad overwrite is easy to spot and fix.
- Use increments or transactions only if two people editing quantities at once becomes a real problem.

## 10. Cost and limits to watch

- Realtime listeners are billed per document read, so listen to one event's items at a time, not everything.
- Keep item docs small and avoid putting the activity log in the item doc.
- Cap PDF upload size (e.g. 20 MB) and page count, and rate-limit extraction calls per user.

## 11. Build phases

### Phase 1: Core checklist (MVP)
- [x] Next.js + Firebase project setup, auth
- [ ] Deploy pipeline
- [x] Events and members
- [ ] Invite flow (admin adds crew by email/uid)
- [x] Manual item creation and editing
- [x] Status marking with partial quantities
- [x] Realtime sync, mobile-first layout, offline persistence
- [ ] Activity log (writes are implemented on every item change; no view screen yet)
- [ ] Security rules and tests (rules written and published; no automated tests yet)

**Exit test:** run one real event prep with the team using manually entered items.

### Phase 2: PDF import
- [x] Upload to Storage, server-side extraction with Claude
- [ ] Structured JSON schema and prompt, tested against 10+ real past lists (schema/prompt built; not yet validated against a real sample set)
- [ ] Review screen with side-by-side PDF view (editable review table is built; no side-by-side PDF viewer yet)
- [x] Apply to workspace
- [ ] Scan and photo handling (should work via Claude's native PDF vision; untested on an actual scanned doc)

### Phase 3: Revisions — pick up here next

- [ ] Re-upload, matching, and diff view
- [ ] Status preservation and "needs re-check" flagging

### Phase 4: Cross-gig and sourcing
- [ ] Link purple items to another event, with an expected return date
- [ ] Cross-gig view (collection group query and index)
- [ ] Missing items view and export or share
- [ ] PDF export of the final list

### Phase 5: Polish
- [ ] Presence indicators, push or email notifications for key changes
- [ ] Item templates or common gear presets
- [ ] Viewer role, event archiving

## 12. Risks

| Risk | Mitigation |
|------|------------|
| Extraction misreads items or quantities | Mandatory review screen, source page reference per item, test set of real lists |
| Messy or unusual PDF layouts | LLM-based extraction rather than parsing rules, iterate the prompt on real samples |
| Poor connectivity at venues | Firestore offline persistence, pending-sync indicator |
| Two people editing the same item | Last-write-wins plus activity log |
| Revised lists wiping progress | Diff-and-merge instead of replace |
| API key or data exposure | Server-side extraction only, strict security rules |

## 13. Open questions

- Are the PDFs mostly clean text-based files, or are some scans or photos? (Affects how much to invest in the vision path early.)
- Should purple items link to a real event in the app, or is free text enough at first?
- Who needs access beyond the core team (freelancers, rental vendors)? This decides whether a Viewer role ships in v1.
- Is a team or company workspace needed, so events are scoped to an organization rather than individual members?
