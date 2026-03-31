# RPReader — Status

Last updated: 2026-03-31 (session 004)

## Currently Working
Nothing active.

## Known Issues (backlog)
- Content blocks need rebuild check (посыпались)
- LOD needs true virtual scrolling (unload far DOM)
- Progress bar counts scroll %, should be total-content-based

## Recent Completions
- Full project structure reorg (session 004):
  - raw/ for source/reference content (Zaveta_RP.md, names.json)
  - Claude/ split into agents/, docs/, plans/, sessions/
  - PLAN*.md, CODE_REVIEW.md, log00-04 moved to Claude/plans/
  - CSS: .panel/.panel-icon/.main extracted from reader.css → common.css
  - character.html no longer imports reader.css
  - character-appearances.json moved data/ → content/
  - CLAUDE.md structure updated
- Fix right bubble alignment (align-items: flex-end on .right .bubbles)
- Fix sticky avatar under status bar (bottom: 36px desktop, calc mobile)
- Unit tests for process.js (scripts/test.js, 21/21, node:test)
- CLAUDE.md: content protection hard rule + commit format directive
- LOD cross-batch divider merge (leading + trailing; _extendLastBubble)
- Dialogue detection rewrite: Zaveta (-text), Tars (- after ^|[,.!?])

## Blockers
None.

## Notes
MVP rewrite in progress. Backend (Supabase), auth, comments, bookmarks planned for next stage.
