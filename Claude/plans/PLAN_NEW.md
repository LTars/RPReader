# Implementation Plan: Dead Code Removal, Search Indexing, Bubble Hover

## Overview
Three interconnected tasks to improve code quality and UX:
1. **Remove dead code** — delete unused `wrapNames()` and orphaned `parser.js`
2. **Replace O(n) search with inverted index** — build substring index at init, O(1) lookups
3. **Bubble hover tooltip** — extend hover behavior to chat bubbles themselves

**Estimated scope:** 3 files modified, 1 file deleted, ~150 lines changed/added

---

## Task 1: Remove Dead Code

### What & Why
- `Characters.wrapNames()` (js/characters.js:71-87) — unused method that attempted dynamic name wrapping
  - Character linking happens at build-time in scripts/process.js, not runtime
  - Method never called anywhere in codebase

- `js/parser.js` (entire file) — orphaned Parser class
  - Never imported anywhere
  - reader.js only imports Characters and Search
  - Actual parsing handled by scripts/process.js (Node.js)
  - Pattern format mismatch with actual Telegram export format

### Implementation
1. Delete lines 71-87 from `js/characters.js` (entire wrapNames method)
2. Delete entire file `js/parser.js`
3. Verify no broken imports (already confirmed: none exist)

**Risk:** None. Both are completely unused.

---

## Task 2: Replace Search with Inverted Index

### Current State (O(n) per keystroke)
- `search.js:35-56` scans all blocks on every keystroke
- Uses `block.content.toLowerCase().indexOf(q)` substring matching
- Max 40 results, highlights with `<mark>` tags

### New Design (O(1) lookup)

**Index Structure:**
```javascript
this._index = {
  'we': [
    { blockIdx: 0, positions: [42, 156], authorId: 'tars' },
    { blockIdx: 3, positions: [8], authorId: 'zaveta' },
  ],
  'wei': [
    { blockIdx: 0, positions: [45], authorId: 'tars' },
  ]
  // ... all substrings of length 2-4 chars ...
}
```

**Key Decisions:**
- Substring matching (not token-based) — preserves current "Wei" matching "Wei Wuxian" behavior
- Index substrings 2-4 chars — balance performance vs. memory
- Build once at constructor, not per keystroke
- Keep 40-result cap, snippet context, `<mark>` highlighting, click behavior

### Implementation Steps

1. **Add `_buildIndex()` method to Search class**
   - Iterate all blocks, extract all 2-4 char substrings
   - Store as Map: substring → array of {blockIdx, positions, authorId}
   - Call from constructor

2. **Modify `_run()` to use index**
   - Look up query in `this._index`
   - If exists: pull all matching blocks, create snippets
   - If not: empty results (don't build on-demand)
   - Same snippet/highlight/render logic as before

3. **Call in constructor** after blocks assigned

### Performance Impact
- **Build:** One-time O(n·m·log(m)) where n=blocks, m=content length
- **Lookup:** O(1) cached, O(k) to generate k snippets
- **Memory:** ~1-2 MB for 50-block corpus
- **User experience:** Instant search vs. noticeable delay at 100+ blocks

---

## Task 3: Bubble Hover Tooltip

### Current State
- `.char-link` hover triggers tooltip with 1000ms delay
- Tooltip shows character name/aliases
- Positioned at link location

### Goal
Hovering anywhere on a message bubble shows tooltip for the message author.

### Implementation

**Step 1: Add `data-author-id` to bubble container**
- In `js/reader.js:_makeMessage()`, add `row.dataset.authorId = block.authorId`
- This identifies which character spoke the message

**Step 2: Add `bindBubbles()` method to Characters class**
- Find all `.message-row` elements
- On mouseenter: show tooltip for that author (1000ms delay)
- On mouseleave: hide tooltip (500ms delay)
- Desktop-only (pointer:fine media query)

**Step 3: Refactor `_showTooltip()` to handle bubbles**
- Accept optional element parameter (could be `.char-link` or `.bubble`)
- Adjust tooltip position:
  - For links: below the link (current behavior)
  - For bubbles: above/beside the bubble
- Load character data for the authorId

**Step 4: Call `bindBubbles()` from reader.js**
- After `this.characters.bindLinks(chat)` in `_render()` method

**Step 5: Optional CSS enhancement**
- Add subtle hover style to bubbles for visual feedback
- E.g., opacity fade or background tint on hover

### UX Behavior
- **Desktop:** Hover anywhere on bubble → tooltip appears after 1s delay
- **Mobile:** No change (pointer:coarse disables hover)
- **Links:** Existing char-link hover still works (unchanged)
- **Priority:** Link hover takes precedence if both active (more specific)

---

## Files Changed

| File | Change | Scope |
|---|---|---|
| `js/characters.js` | Delete wrapNames() method | Lines 71-87 |
| `js/characters.js` | Add bindBubbles(), _onBubbleHover() | New ~30 lines |
| `js/characters.js` | Refactor _showTooltip() | Modify positioning logic |
| `js/reader.js` | Add data-author-id to message-row | 1 line in _makeMessage() |
| `js/reader.js` | Call bindBubbles() in _render() | 1 line after bindLinks() |
| `js/search.js` | Add _buildIndex() method | New ~40 lines |
| `js/search.js` | Modify _run() to use index | Refactor ~20 lines |
| `js/search.js` | Call _buildIndex() in constructor | 1 line |
| `js/parser.js` | DELETE entire file | N/A |
| `css/reader.css` | Optional: add bubble hover styles | New ~5 lines |

---

## Implementation Order

1. **Task 1** (5 min) — Remove dead code
   - Simplest, no dependencies
   - Cleans codebase first

2. **Task 3** (20 min) — Bubble hover
   - UI-focused, easier to test
   - Builds on cleaned code

3. **Task 2** (30 min) — Search index
   - Most complex performance optimization
   - Can be tested independently

---

## Testing Strategy

- **Task 1:** Verify page still loads, no console errors
- **Task 2:** Search results identical to before, but instant
- **Task 3:** Hover bubble → tooltip appears; click → panel opens; links still work

---

## Rollback Plan

All changes are additive except dead code removal (which is safe). If anything breaks:
1. Revert individual commits
2. Most changes are isolated (e.g., search index doesn't affect reader logic)
