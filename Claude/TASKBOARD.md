# RPReader — Task Board

## In Progress
(nothing active)

## Backlog

### Content & Navigation
- [x] LOD content loading — lazy load blocks to avoid browser lag on large texts
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
