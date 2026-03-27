# Project

**RPReader** — web reader for roleplay text in chat format. Telegram RP conversations are parsed into blocks and displayed as a chat with bubbles, characters, and search.

**Design pillars:**
- Configuration over hardcode — authors, patterns, transforms live in JSON
- Data separated from presentation — parser doesn't know DOM, renderer doesn't know source format
- Characters are a separate entity — lazy-loaded, not embedded in text
- Content is sacred — authored text is never modified automatically
- Soft on the eyes — dark theme with blue-light-aware palette

**Scale:** MVP rewrite in progress. Next stages: backend (Supabase), auth, comments, bookmarks, offline.

## Language
- Code, commits, documentation: English
- Comments, discussion: Russian
- Minimal comments — code should be self-explanatory

## Structure

Data pipeline:

```
Content (.md) -> Parser (rules.json) -> Blocks[] -> Renderer -> DOM
```

```
css/
  common.css              — variables, reset, shared styles
  reader.css              — reader page
  character.css           — character page
  index.css               — index page

js/
  reader.js               — reader page orchestrator
  parser.js               — text -> blocks, rules from JSON
  characters.js           — character data, tooltip, panel
  search.js               — full-text search
  character.js            — character page logic

content/
  main.md                 — intake: new text goes here
  blocks/                 — processed content blocks

data/
  parser-rules.json       — parsing rules (authors, patterns, transforms)
  characters/
    index.json            — character registry
    {id}.json             — character details

index.html
reader.html
character.html

Claude/                   — workflow definitions and agent roles
```

### Structure rules
- Parser has no DOM knowledge — pure text -> blocks transformation
- Renderer reads blocks only, never parses raw text
- Parsing rules live in `parser-rules.json` — never hardcode in JS
- Content files are authored text — do not modify without approval
- Character data is lazy-loaded on demand
- Styles: per-page CSS files, common styles imported from `common.css`
- All CSS values in custom properties — at the top of the file or in `common.css`
- No inline styles in HTML
- Minimal hardcoded strings in HTML — use data attributes, CSS, or JS

## Code Style

### JavaScript
- `camelCase` variables/functions, `PascalCase` classes, `UPPER_SNAKE_CASE` constants
- `const` by default, `let` only when mutation needed
- ES modules (`import`/`export`), no bundler
- Modern browsers only — no polyfills
- Errors: log or show to user, never swallow silently

### File assembly order (JS)
```
1. Imports
2. Constants
3. Module-level state
4. Functions / Classes
5. Initialization
```

### CSS
- Plain CSS with native nesting — no preprocessor, no build step
- kebab-case class names
- Custom properties (`--var`) for all repeated values
- Per-file structure: variables -> base styles -> components -> states -> responsive

### HTML
- No inline styles
- No inline scripts — extract to JS modules
- Minimal hardcoded strings — content from JS or data attributes

## Architecture Patterns

### Data flow
- One direction: Content -> Parse -> Blocks -> Render -> DOM. No reverse flow
- Renderer never writes to blocks or modifies content
- Derived values (progress, search results) are computed, not stored

### Characters
- Identified by `id`, not by DOM position
- Loaded on demand — index first, details on interaction
- Names wrapped at render time, not stored in content

### Content pipeline
- New text enters through `main.md`
- Checked for duplicates against existing blocks in `content/`
- Unique content split into blocks by parsing rules
- Blocks saved to `content/blocks/`, `main.md` cleared
- Reader loads blocks, not raw intake file

### Constraints
- No external dependencies (npm, bundlers) without discussion
- No build step — deploy directly from source
- Modern browsers only (ES modules, CSS nesting, custom properties)

## Files
- `.css` — edit directly, per-page files + common
- `.html` — can edit, no inline styles or scripts
- `content/*.md` — authored text, do not modify content
- `data/*.json` — configuration, can edit

## Workflow
- Describe approach before writing code, get approval before implementing
- Breaking changes require a separate discussion before any code
- When facing ambiguity — always ask, never assume
- Version control: Git via bash
- Ask before committing
- Never push to remote
- Deploy: standard GitHub Pages directly from main branch
- URL: https://ltars.github.io/RPReader/

## Roadmap

Planned features (from design phase, not yet implemented):

**Content & Navigation:**
- LOD content loading — lazy load blocks to avoid browser lag on large texts
- Content deduplication in processing pipeline
- Scene timeline
- Search filters by context (text / characters / comments)

**Social:**
- Comments — Google Docs style (select text -> comment / question / edit / bookmark)
- Bookmarks — auth: database, guest: localStorage
- Reactions — emoji on lines/paragraphs, auth only

**Modes:**
- Reading mode — UI hides, links and notes styled as plain text
- Editing mode — whitelist only, text editing, reply to comments

**Content update:**
- Paste in browser or send via Telegram bot
- Formatter processes and shows preview -> after approval -> commit via GitHub API
- Append to intake, version control through git

**Infrastructure:**
- Authorization — whitelist (two levels), Supabase backend
- Offline — Service Worker
- Export range to PDF/MD (auth only)
- Reading statistics — personal and aggregate
- Accessibility mode for color blindness
- Bottom sheet swipe gestures on mobile
- Image upload through browser (auth only)
