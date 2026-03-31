# Task: Bootstrap Context Index for Librarian System

**Date:** 2026-03-28
**Status:** pending
**Assigned to:** Lib agent (first invocation)

## Goal

Create `Claude/context/index.md` — a coordination file that catalogs all project files with summaries, key symbols, and line counts. This enables the Lib agent to check cached summaries before reading files, reducing token usage by ~27%.

## Scope

**In scope:**
- All source code files: `js/*.js`, `css/*.css`, `html/*.html`
- All config/data files: `data/*.json`, `content/*.md`
- Total: ~15 files, ~2,400 lines

**Out of scope:**
- Generated content: `content/blocks/`
- Node.js artifacts: `node_modules/`, package files
- Git internals: `.git/`
- This log file and agent role definitions

## Format

Markdown file at `Claude/context/index.md` with entries like:

```markdown
## js/parser.js

**Lines:** 180 (as of 2026-03-28)
**Summary:** Parses text blocks by rules. Takes raw MD content and parser-rules.json config, returns blocks[] with HTML and metadata. No DOM knowledge.
**Key exports:**
- `parseContent(rawText, rules)` — L15: main entry point
- `linkCharacters(text, chars)` — L45: character name resolution with clan lookup
- `splitBySegments(text, rules)` — L78: segment splitting logic

**Dependencies:** data/parser-rules.json, data/characters/index.json
**Tags:** parser, pipeline, character-linking
```

## Stale Detection

Line count mismatch = entry is stale, file needs re-read. Simple and effective at this scale.

## Priority

**High:** Bootstrap must complete before Lib can effectively reduce token usage. This is phase 1 of the librarian system rollout.

## Notes

- Bootstrap can be done manually by reviewing each file once, or by Lib itself during first invocation
- After bootstrap, index auto-refreshes when stale entries are encountered
- Lib handles all index writes (single writer, no race conditions)
