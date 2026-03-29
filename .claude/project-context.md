# RPReader — Project Context

Generated: 2026-03-28

---

## 1. Product Identity

**Type:** Web reader for roleplay text in chat format (Telegram RP conversations).

**Target use case:** Two-person RP sessions exported from Telegram, displayed as a styled chat with character identity, scene structure, and search.

**Key features (implemented):**
- Chat-bubble layout (left/right alternating by author)
- Character name linking with hover tooltip and side panel
- Full-text search (Cmd/Ctrl+K, snippet preview)
- Scene dividers (`***` in source)
- Blue-light filter toggle
- Mobile-responsive layout (bottom nav + bottom sheet panel)
- Progress bar + scroll percentage status bar
- Battery API integration (optional, graceful fallback)
- Character library page (library + detail views)

**Not yet implemented (roadmap):**
- Auth (Supabase whitelist)
- Comments (Google Docs style)
- Bookmarks (DB + localStorage guest)
- Reactions
- LOD / lazy block loading
- Offline (Service Worker)
- Content submission via browser or Telegram bot
- Reading statistics
- Export to PDF/MD
- Editing mode

**Formats supported:** Telegram export format: `[M/D/YYYY H:MM AM] Author: text`

**Annotations:** None implemented yet.

**Sync/offline:** Not implemented.

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Framework | None — vanilla JS ES modules |
| Bundler | None — deploy directly from source |
| State management | Module-level variables in class instances |
| Storage (client) | `sessionStorage` (cross-page nav state only) |
| Storage (server) | None yet (Supabase planned) |
| Backend | None yet |
| Fonts | Google Fonts: Lora, DM Sans, JetBrains Mono |
| CSS | Plain CSS with native nesting + custom properties |
| Node tooling | `scripts/process.js` — preprocessing pipeline only (not a build step) |
| Package manager | None (no npm) |

---

## 3. Architecture

### Module map

```
index.html          → css/index.css
reader.html         → js/reader.js → js/characters.js
                                   → js/search.js
                    → css/reader.css, css/common.css
character.html      → js/character.js
                    → css/character.css, css/reader.css, css/common.css

scripts/process.js  → (Node only) js/parser.js (partial reuse pattern)
                    → data/parser-rules.json
                    → data/characters/index.json
                    → content/main.md → content/blocks/
```

### Data flow (one direction, enforced by design)

```
content/main.md  (Telegram export)
  ↓  scripts/process.js
content/blocks/{authorId}_{NN}.md  (YAML frontmatter + HTML)
  ↓  reader.js fetch + parse frontmatter
blocks[]  (JS objects in memory)
  ↓  reader.js render
DOM  (.chat container)
```

No reverse flow. Renderer never modifies blocks or source.

### Content block format

```markdown
---
author: tars
side: right
type: message | divider
datetime: 3/17/2026 2:52 AM
---
<p>Text with <a href="character.html?id=lan-xichen" class="char-link" data-char-id="lan-xichen">Лань Сичэнь</a> linked.</p>
```

### Block index

`content/blocks/index.json` — ordered array of filenames; reader loads in this order.

### Character system

```
data/characters/index.json      — registry (id, clan, names[], file)
  ↓  characters.js load()
nameMap (name → id, lowercase)
  ↓  bindLinks() on DOM
.char-link elements → tooltip on hover, panel on click, navigate on second click

data/characters/{id}.json       — lazy-loaded on first interaction
```

Character names are linked at processing time (process.js), not in the browser. `Characters.wrapNames()` exists but is unused — it's a dead method.

### Search

Linear scan through `blocks[]` on each keystroke. No index. Min 2 chars, max 40 results, 60-char snippet context. Case-insensitive substring.

### CSS architecture

- `common.css` — custom properties (colors, spacing, typography, transitions) + reset
- Per-page files import from common; no shared component library
- Mobile breakpoint: 768px (panel → bottom nav, char panel → bottom sheet)

---

## 4. Current State

### Works
- Full processing pipeline: `node scripts/process.js` converts `main.md` → blocks
- Reader loads and renders all 48 blocks (32 tars + 16 zaveta)
- Character linking with tooltip, panel, navigation
- Full-text search
- Blue-light filter
- Character library (32 characters registered)
- Mobile layout (responsive)
- Progress bar, status bar, battery display

### Incomplete / missing
- Individual character detail JSON files not confirmed to exist (only `index.json` + `example_char.json` referenced as fallback)
- `data/character-appearances.json` is empty `[]` — generated on next process run
- No auth, no comments, no bookmarks, no offline

### Known code issues
- `Characters.wrapNames()` — dead method, never called
- Author partial-name matching in `parser.js` could false-positive with similar names
- Errors logged to console but never surfaced to user (reader.js, character.js)
- All blocks loaded upfront — will degrade on large content (LOD not implemented)
- Search is O(n) per keystroke — fine at current scale

---

## 5. Code Quality Signals

### Strengths
- Clean one-direction data flow, no coupling between parser and renderer
- Configuration-driven: authors, patterns, transforms all in `parser-rules.json`
- Modern JS (ES modules, const-first, no polyfills)
- Graceful degradation (Battery API, missing character files)
- Longest-first name matching prevents partial-name collisions in character linking
- Session storage used minimally and correctly (return link highlight only)
- CSS custom properties used consistently; no inline styles

### Inconsistencies / smells
- `js/parser.js` exists in `js/` but is only used by `scripts/process.js` (Node context); it's never imported in the browser. Could live in `scripts/` instead.
- `character.html` imports `css/reader.css` alongside `css/character.css` — likely for shared `.char-link`, `.char-panel`, `.char-tooltip` styles, but not documented
- `character.js` has a fallback to `example_char.json` — indicates character detail files may be incomplete
- UI string objects in both `reader.js` and `character.js` — no shared i18n layer
- `Characters` class has both tooltip positioning and swipe gesture logic — slightly mixed concerns

### Dead code
- `Characters.wrapNames()` — never called
- `Parser` class in `js/parser.js` — never imported in browser

---

## 6. Agent Integration Opportunities

| Area | Opportunity | Recommended agent type |
|---|---|---|
| **Content processing** | Run `process.js` when `main.md` is updated, validate output blocks | general-purpose |
| **Character data** | Generate missing `{id}.json` detail files from `index.json` entries | general-purpose |
| **Search improvement** | Build inverted index at render time to replace O(n) scan | Plan → implementation |
| **LOD loading** | Intersection Observer + chunked block loading to replace full upfront load | Plan → implementation |
| **Code review** | Identify dead code, coupling issues, missing error surfaces | Explore |
| **New content intake** | Parse and validate pasted Telegram text before processing | general-purpose |
| **Character linking audit** | Check all `unresolved` char-links in blocks against index | Explore + lib |
| **CSS audit** | Verify all custom properties defined in common.css are actually used | Explore |

---

## 7. File Reference

| Path | Purpose | Lines |
|---|---|---|
| `index.html` | Landing page | 21 |
| `reader.html` | Main reader | 124 |
| `character.html` | Character library/detail | 35 |
| `js/reader.js` | Reader orchestrator | 231 |
| `js/parser.js` | Text parser (Node/process only) | 158 |
| `js/characters.js` | Character UI + data | 253 |
| `js/search.js` | Full-text search | 77 |
| `js/character.js` | Character page logic | 144 |
| `css/common.css` | Variables, reset, shared | ~56+ |
| `css/reader.css` | Reader layout + components | 507 |
| `css/character.css` | Character page styles | 188 |
| `css/index.css` | Landing page styles | 45 |
| `data/parser-rules.json` | Author config, patterns, transforms | 51 |
| `data/characters/index.json` | 32-character registry | 188 |
| `scripts/process.js` | Node processing pipeline | 387 |
| `content/blocks/index.json` | Ordered block manifest | — |
| `content/blocks/*.md` | 48 processed content blocks | — |
