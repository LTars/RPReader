# Session 00: Librarian Agent Design

**Status:** plan approved, execution pending
**Task:** create `Claude/librarian.md` — agent for cheap context gathering

## Original request (summary)

Design a sub-agent system with session management for token-efficient workflows:
- Librarian (haiku) — reads files, extracts fragments with line numbers
- Secretary — manages session logs, summaries
- Sessions — auto-detected by complexity, logged in `Claude/sessions/`
- Universal agents in `C:\Users\tarsw\.claude\agents\`, project-specific in `Claude/`
- Session logs: YAML frontmatter + MD, chunked, with index file per session
- Post-session: separate resume file

## Decision: start with Librarian only

Minimum viable piece. Other agents and session infrastructure — later tasks.

## Existing agents (already in Claude/)

| File | Name | Role |
|------|------|------|
| arch.md | Arch | Document versioning, diff review, registry |
| developer.md | Dev | Frontend developer, code implementation |
| tori.md | Tori | Secretary — NOTES.md and REQUIREMENTS.md |
| workflow.md | — | 5-phase workflow (Req → Design → Plan → Impl → Verify) |
| requirements.md | — | Stop conditions, checklists, communication protocol |

## Librarian spec (approved plan)

**Name:** `Lib` | **Model:** haiku | **File:** `Claude/librarian.md`

**Purpose:** Read files, extract relevant fragments with line numbers. No interpretation, no decisions, no modifications.

**Input:**
```
Lib: gather context
- files: scripts/process.js, data/parser-rules.json
- focus: character name linking
- format: code
```

**Output:** fragments with `file:line-line`, exact code, `Relevance:` per fragment, footer with file/fragment count.

**Rules:**
1. Code: preserve exactly with line numbers
2. Config/JSON: summarize structure, note exact keys
3. Prose: summarize, quote critical sentences only
4. Always include Relevance line
5. Never read files not listed/implied
6. Uncertain relevance → include with note, don't skip
7. Footer: file count + fragment count

**Style:** match existing agent definitions (arch.md, tori.md pattern).

## Next steps

1. Create `Claude/librarian.md` following the spec above
2. Test: invoke Lib on a known task
3. Future: session system, secretary evolution, universal agent placement
