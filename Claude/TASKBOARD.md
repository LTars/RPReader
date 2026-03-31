# RPReader — Task Board

## In Progress
(nothing active)

## Backlog

### Structure Reorg (next session)
- [ ] Move HTML pages to pages/ dir — only index.html stays in root (+ tool config files)
- [ ] Rename js/characters.js and js/character.js — clarify naming (e.g. char-manager/char-page or similar, TBD next session)
- [ ] Block naming: change scheme to `author_<global_raw_idx>_<split_part>` (e.g. tars_003_1.md) — requires reprocessing all blocks
- [ ] Block splitting: cut large blocks to ~1 screen size, invisibly — same visual bubble (no UI divider), split only in content/data; enables true pagination
- [ ] Page index markers: background labels showing "screen/page N" at each block boundary
- [ ] Search: add search-by-page-number alongside full-text search
- [ ] Progress bar: rewrite to total-content-based (loaded blocks / total blocks × their estimated height), not scroll-% of current DOM

### Bugs & Polish
- [x] Fix right bubble alignment (regression from sticky avatar)
- [x] Fix avatar under status bar (bottom: 36px / mobile calc)
- [ ] Rebuild content blocks — посыпались после изменений мёржа (проверить process.js + блоки)
- [ ] LOD: true virtual scrolling — unload DOM nodes >3 screens, reload on demand (placeholder heights)
- [ ] Dialogue detection: comma+lowercase = attribution (partial fix done); deep fix needs formatter preprocessing or explicit markup; Я-false-positive unavoidable without NLP
- [ ] Formatter: Zaveta -text cleanup → normalize to `- Text` standard form
- [x] Clean up project structure (CLAUDE.md outdated — parser.js deleted, scripts/ added)

### Content & Navigation
- [x] LOD content loading — lazy load blocks to avoid browser lag on large texts
- [ ] Sticky author avatars during scroll within a bubble group
- [ ] Content deduplication in processing pipeline
- [ ] Scene timeline
- [ ] Search filters by context (text / characters / comments)

### Social
- [ ] Comments — Google Docs style (select text -> comment / question / edit / bookmark)
- [ ] Bookmarks — auth: database, guest: localStorage
- [ ] Reactions — emoji on lines/paragraphs, auth only

### Modes
- [ ] Reading mode — UI hides, links and notes styled as plain text
- [ ] Editing mode — whitelist only, text editing, reply to comments

### Content Update
- [ ] Paste in browser or send via Telegram bot
- [ ] Formatter: processes and shows preview -> after approval -> commit via GitHub API
- [ ] Append to intake, version control through git

### Infrastructure
- [ ] Authorization — whitelist (two levels), Supabase backend
- [ ] Offline — Service Worker
- [ ] Export range to PDF/MD (auth only)
- [ ] Reading statistics — personal and aggregate
- [ ] Accessibility mode for color blindness
- [ ] Bottom sheet swipe gestures on mobile
- [ ] Image upload through browser (auth only)
