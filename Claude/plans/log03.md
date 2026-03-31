# Plan: Character Profile Auto-Generation System

**Date:** 2026-03-28
**Task:** Design and implement system for auto-generating character profile skeleton files on-demand
**User Decisions:**
- Format: Use `example_char.json` schema as-is (MVP)
- Authoring: Direct JSON editing
- Generation: Auto-generate on first load/click
- Workflow: On-click, local files, no tracking, manual linking

---

## Architecture Overview

RPReader is a static GitHub Pages site with Node.js processing pipeline. The character profile system must fit within:
- Frontend: Pure JS, no bundler, no API
- Processing: Node.js scripts (already have `scripts/process.js`)
- Deployment: GitHub Pages (read-only)
- Git as source of truth

---

## Implementation Strategy

### Detection Logic
- **When**: During `scripts/process.js` execution (normal processing pipeline)
- **What**: After parsing blocks and character appearances, identify characters in `data/characters/index.json` that lack corresponding `.json` files in `data/characters/{id}.json`
- **How**: Check filesystem for file existence

### Generation Trigger: Two-Phase Approach

**Phase 1 — Automatic Detection** (during `process.js`):
- After parsing, check for missing character files
- Log warning: "Missing profile files for: X characters. Run `node scripts/generate-skeletons.js` to create skeletons."

**Phase 2 — Manual Generation** (author action):
- Author runs: `node scripts/generate-skeletons.js`
- Script creates skeleton `.json` files for all missing characters
- Reports what was created
- Author manually edits files to add real data
- Commits to git

**Why two-phase?**
- Explicit control; respects "content is sacred" principle
- Keeps `process.js` focused on parsing
- Author sees what will be generated before it happens

### Skeleton Creation

**File location:** `data/characters/{id}.json`

**Generated structure** (template from `example_char.json`):
```json
{
  "id": "{id from index}",
  "names": ["{primary name from index.names[0]}"],
  "description": "",
  "avatar": "",
  "relations": [],
  "scenes": [],
  "gallery": []
}
```

- Only `id` and `names[0]` populated from index
- All other fields empty for author to fill
- Maintains schema consistency

### Persistence Strategy

**Location**: Local filesystem, committed to git

**Process**:
1. Author runs `generate-skeletons.js` locally
2. Script creates `.json` files in `data/characters/`
3. Author commits to git
4. GitHub Pages deploys automatically

**Frontend handling** (in `character.js`):
- Existing code tries to load character file
- If 404: display message "Character profile not yet created"
- No backend required; generation happens pre-deployment

### Author Workflow

1. **Generation** (local):
   ```bash
   node scripts/generate-skeletons.js
   ```

2. **Editing**:
   - Open `data/characters/{id}.json` in text editor
   - Add description, relations, scenes, gallery
   - Save

3. **Commit & deploy**:
   ```bash
   git add data/characters/
   git commit -m "Add character profiles"
   git push
   ```

4. **Live**:
   - GitHub Pages updates automatically
   - character.html renders complete profiles

---

## Implementation Files

### New: `scripts/generate-skeletons.js`

**Purpose**: Create skeleton `.json` files for characters missing profiles

**Responsibilities**:
1. Read `data/characters/index.json`
2. For each entry, check if `data/characters/{id}.json` exists
3. If missing, create skeleton file from template
4. Log results (created, already exists)

**Dependencies**: Only Node.js `fs` module

**Output example**:
```
Found 28 characters in index.json
Checking for missing profiles...
Created skeleton for: wei-wuxian
Created skeleton for: lan-wangji
Already exists: jin-guangyao
... (23 more)
Total: 2 skeletons created, 26 already exist
```

### Modify: `scripts/process.js`

**Changes**:
1. After `saveCharacterAppearances()`, add check for missing profiles
2. New function `checkMissingCharacterProfiles()`:
   - List characters from `character-appearances.json` with no file
   - Log warning with instructions to run `generate-skeletons.js`

**Impact**: Minimal; reporting only, no generation

### Modify: `js/character.js`

**Changes in `loadChar()` function** (around line 77):
- If fetch returns 404:
  - Show: "Character profile not yet created. Ask the author to add details."
  - In library view: show grayed-out card with "empty" indicator

**Impact**: Graceful degradation for missing files

### Update: `CLAUDE.md`

**Add section "Character Profile Management"**:
- When new characters appear in content, run `process.js`
- Run `generate-skeletons.js` to create skeletons
- Edit `.json` files to fill in data
- Commit and deploy

---

## Critical Files

1. **scripts/generate-skeletons.js** (NEW) — Helper script for skeleton generation
2. **scripts/process.js** (MODIFY) — Add detection hook
3. **js/character.js** (MODIFY) — Graceful 404 handling
4. **data/characters/index.json** (NO CHANGE) — Already has structure
5. **CLAUDE.md** (UPDATE) — Document workflow

---

## Key Design Decisions

| Aspect | Choice | Rationale |
|--------|--------|-----------|
| **Generation trigger** | Manual script (`generate-skeletons.js`) | Explicit control, no surprise writes |
| **Detection timing** | During `process.js` execution | Integrated with existing pipeline |
| **File creation** | Node.js script (pre-deployment) | Offline processing model, no backend needed |
| **Frontend 404 handling** | Graceful message + UI degradation | Supports partial profiles during authoring |
| **Schema** | Template from `example_char.json` | Consistency, MVP scope |
| **Author experience** | Edit JSON directly | Follows "config over hardcode" principle |

---

## Future-Proofing

Supports upgrade to Supabase backend:
- **Today**: Files in git, generated locally
- **Later**: Script adapted to call Supabase API
- **Even later**: Real-time collaborative editing in UI

No frontend rewrites needed; abstraction at data layer.

---

## Workflow Visual

```
Author writes content
        ↓
Run process.js (parse + link characters)
        ↓
process.js reports missing profiles
        ↓
Author runs generate-skeletons.js
        ↓
Skeletons created in data/characters/
        ↓
Author edits .json files manually
        ↓
git add + commit + push
        ↓
GitHub Pages deploys
        ↓
Reader loads and renders complete profiles
```
