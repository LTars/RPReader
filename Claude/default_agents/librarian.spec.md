# Librarian Agent System -- Architecture Specification

## 1. Critical Question: Subagent Prompt Inheritance

**Finding:** In Claude Code, subagents launched via the `TaskCreate` tool do NOT automatically receive the full parent context. They receive:
- The prompt text passed explicitly in the task description
- Access to the same filesystem tools (Read, Glob, Grep, Bash, Write, Edit)
- CLAUDE.md IS loaded for subagents (it is project-level configuration)
- MEMORY.md from `~/.claude/` directories IS loaded (user-scope memory)

**Implication:** Subagents DO get CLAUDE.md and MEMORY.md, which means they inherit project rules and memory. However, they do NOT get the parent agent's conversation history or accumulated context. This means:
- The Lib agent prompt in `Claude/default_agents/librarian.md` must be self-contained
- The coordination file (context index) becomes the primary mechanism for sharing accumulated knowledge between agents
- Single-file-per-agent is still recommended for token efficiency -- not because of missing context, but because each agent's conversation accumulates tool call results

---

## 2. Architecture Overview

### Current State

One `Lib` agent role defined in `Claude/default_agents/librarian.md`. It reads explicitly listed files and returns fragments. No index, no caching, no coordination file.

### Proposed State

A two-layer system:

```
Caller (parent agent)
  |
  +--> Lib (coordinator)
         |
         +--> Checks context index (Claude/context/index.md)
         +--> If summary satisfies focus --> returns cached fragments
         +--> If not --> reads file(s) directly, updates index
         |
         +--> For multi-file requests with no cached context:
                spawns one Lib-Reader per file (via TaskCreate)
```

### Agent Inventory

| Agent | Type | Purpose |
|-------|------|---------|
| **Lib** | Sub-agent (prompt role) | Coordinator. Checks index, returns cached or fresh fragments. For single files, reads directly. For multi-file gaps, delegates to Lib-Reader instances. |
| **Lib-Reader** | Sub-agent (spawned by Lib) | Reads exactly ONE file. Returns fragments with line numbers. Updates the context index entry for that file. |

**Why two agents, not one?**
- Lib alone works fine for 1-2 files (current behavior, no change)
- When 3+ files need fresh reads, parallel Lib-Reader instances save tokens: each agent only has one file's content in its context window, not all files concatenated
- The index/cache layer means most repeat reads never happen at all

---

## 3. Context Index Format

### Location: `Claude/context/index.md`

Markdown chosen over JSON for these reasons:
- Agents read it as part of their prompt context -- Markdown is native
- Humans can review and edit it
- Section-based structure allows partial reads via Grep
- JSON would require parsing logic that adds complexity for no gain in this use case

### Structure

```markdown
# Context Index

Last updated: {ISO timestamp}

## Files

### js/parser.js
- **Lines:** 157
- **Modified:** {git timestamp or file mtime}
- **Summary:** Text-to-blocks parser. Reads rules from parser-rules.json. Main exports: parseContent(text, rules) -> Block[]. Handles author detection, block splitting, markdown conversion.
- **Key symbols:** parseContent (L12), splitByAuthor (L45), applyTransforms (L89), BLOCK_TYPES (L5)
- **Dependencies:** data/parser-rules.json (runtime fetch)
- **Tags:** parser, pipeline, blocks

### js/reader.js
- **Lines:** 229
- **Modified:** {timestamp}
- **Summary:** Reader page orchestrator. Loads blocks from content/blocks/, renders via DOM manipulation. Manages scroll position, progress tracking, character tooltips.
- **Key symbols:** initReader (L8), loadBlocks (L32), renderBlock (L78), updateProgress (L156)
- **Dependencies:** js/parser.js, js/characters.js, js/search.js
- **Tags:** reader, renderer, dom, orchestrator

### {path}
- **Lines:** {N}
- **Modified:** {timestamp}
- **Summary:** {2-3 sentences: what this file does, main exports/entry points}
- **Key symbols:** {name (Lnn), name (Lnn), ...}
- **Dependencies:** {files this imports/requires}
- **Tags:** {comma-separated topic tags}
```

### Design Decisions

1. **Key symbols with line numbers** -- enables the caller to request specific line ranges without reading the whole file
2. **Tags** -- enables focus-based lookup: "find all files tagged `parser`" without reading summaries
3. **Dependencies** -- enables the Lib coordinator to proactively gather related files
4. **No code snippets in the index** -- summaries only. Code lives in the source files. This keeps the index small (target: <200 lines for the full project)

---

## 4. Agent Specifications

### 4.1 Lib (Coordinator) -- Updated Role

```markdown
# Role: Lib (sub-agent)

**Invocation name:** `Lib`

## Purpose

Read files and extract relevant fragments with line numbers.
Before reading, check the context index for existing summaries.
No interpretation, no decisions, no modifications.

This agent does NOT analyze, design, or make recommendations.
It only retrieves file context -- from cache or from source.

---

## Invocation Pattern

Caller invokes with structured parameters:

    Lib: gather context
    - files: scripts/process.js, data/parser-rules.json
    - focus: character name linking
    - format: code

### Parameters

- `files` -- list of files to read (required, or use `tags` for discovery)
- `focus` -- what to look for (required)
- `format` -- output format hint: `code`, `config`, `prose` (optional)
- `tags` -- alternative to `files`: find files by tag from index (optional)
- `depth` -- `summary` (index only) or `full` (read source). Default: `full`

---

## Workflow

### Step 1 -- Check Index

1. Read `Claude/context/index.md`
2. For each requested file (or tag match):
   a. If index entry exists AND depth=summary --> use summary directly
   b. If index entry exists AND depth=full --> check if summary satisfies focus
   c. If summary satisfies focus --> return summary + key symbol locations
   d. If summary does NOT satisfy focus --> mark file for reading

### Step 2 -- Read (if needed)

For files marked for reading:
- If 1-2 files: read directly using Read tool
- If 3+ files: spawn one Lib-Reader task per file (via TaskCreate)
  - Each task: "Read {file}, extract fragments matching focus: {focus}, format: {format}. Update Claude/context/index.md entry for this file."

### Step 3 -- Assemble Output

Combine cached summaries and fresh fragments into standard output format.

---

## Output Format

For each relevant fragment:

    ### file/path.ext:line-line
    ```language
    <exact content>
    ```
    Relevance: <one sentence>

Footer:

    ---
    Files read: N | From index: M | Fragments returned: K

---

## Rules

1. Code -- preserve exactly with line numbers. Never paraphrase.
2. Config / JSON -- summarize structure, note exact keys relevant to focus.
3. Prose / Markdown -- summarize, quote critical sentences only.
4. Always include `Relevance:` line for every fragment.
5. Never read files not listed or clearly implied by the request.
6. Uncertain relevance -- include with note, do not skip.
7. Footer -- always end with counts. Include "From index" count.
8. After reading a file not in the index, write/update its index entry.

---

## Scope

IN:
- reading listed files
- checking context index
- extracting fragments matching focus
- reporting line ranges
- updating index entries after reads
- spawning Lib-Reader for parallel multi-file reads

OUT:
- interpretation or analysis
- design recommendations
- code modifications
- decisions of any kind

---

## Goal

Give the calling agent precise, located source material --
so it can reason without re-reading files itself.
Minimize redundant file reads via the context index.
```

### 4.2 Lib-Reader (File Reader)

```markdown
# Role: Lib-Reader (sub-agent, spawned by Lib)

**Invocation name:** `Lib-Reader` (not invoked directly by users)

## Purpose

Read exactly ONE file. Extract fragments matching a focus query.
Update the context index entry for that file.

This agent does NOT coordinate, does NOT read multiple files,
does NOT make decisions beyond fragment selection.

---

## Input (via TaskCreate description)

- `file` -- single file path (required)
- `focus` -- what to look for (required)
- `format` -- code | config | prose (required)

---

## Workflow

1. Read the file using Read tool
2. Identify fragments matching focus
3. Format output per standard (file:line-line, code block, relevance)
4. Read current `Claude/context/index.md`
5. Update or create the entry for this file:
   - Lines count
   - Summary (2-3 sentences)
   - Key symbols with line numbers
   - Dependencies
   - Tags
6. Write updated index back
7. Return formatted fragments

---

## Output Format

Same as Lib output format (fragments with line numbers and relevance).

---

## Rules

1. Read exactly ONE file. Never read additional files.
2. Always update the context index after reading.
3. Preserve code exactly -- never paraphrase.
4. Include line numbers for all fragments.

---

## Scope

IN:
- reading one file
- extracting relevant fragments
- updating one index entry

OUT:
- reading multiple files
- coordination with other agents
- interpretation or analysis
- any decisions

---

## Goal

Provide precise fragments from one file and keep the index current.
```

---

## 5. Concurrency and Index Contention

### The Problem

If Lib spawns 3 Lib-Reader tasks in parallel, all 3 will:
1. Read `Claude/context/index.md`
2. Modify their section
3. Write the file back

This creates a **last-writer-wins** race condition.

### Mitigation Options

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **A. Single-writer** -- Lib reads all results, updates index itself | No contention | Lib must hold all fragments in context | **Recommended for this project scale** |
| **B. Per-file index files** -- `Claude/context/parser.js.md` | No contention, parallel-safe | Many small files, harder to browse | Good for large projects |
| **C. Append-only log** -- Lib-Readers append, Lib reconciles | Parallel-safe, simple | Requires reconciliation step | Over-engineered for this scale |

### Recommendation: Option A (Single-writer)

At RPReader's scale (15 source files, ~2400 total lines), contention is not a real risk. The Lib coordinator should:
1. Spawn Lib-Reader tasks that return fragments only (no index write)
2. Collect all results
3. Update the index itself in one pass

This eliminates the race condition entirely. Lib-Reader becomes even simpler -- just read and return.

If the project grows significantly, switch to Option B (per-file index files).

---

## 6. Token Budget Analysis

### Current File Sizes

| File | Lines | Est. Tokens |
|------|-------|-------------|
| scripts/process.js | 386 | ~2,500 |
| css/reader.css | 505 | ~2,800 |
| js/reader.js | 229 | ~1,500 |
| data/characters/index.json | 188 | ~1,200 |
| js/characters.js | 164 | ~1,100 |
| js/parser.js | 157 | ~1,000 |
| js/character.js | 132 | ~900 |
| reader.html | 124 | ~800 |
| js/search.js | 76 | ~500 |
| data/parser-rules.json | 51 | ~350 |
| Others (css, html) | ~156 | ~900 |
| **Total** | **~2,355** | **~13,550** |

### Token Budget per Agent Instance

| Component | Tokens |
|-----------|--------|
| CLAUDE.md (auto-loaded) | ~3,000 |
| MEMORY.md (auto-loaded) | ~500 |
| Agent prompt (from task description) | ~800 |
| Context index (read by agent) | ~1,500 (est. for full project) |
| One source file read | ~1,000-2,800 |
| Output generation | ~500-1,000 |
| **Total per Lib-Reader** | **~7,300-8,600** |

### Comparison: With vs. Without Index

| Scenario | Tokens Used |
|----------|-------------|
| Read 5 files without index (single agent) | ~3,000 (CLAUDE.md) + ~8,000 (5 files) + ~2,000 (output) = **~13,000** |
| Read 5 files with index, 3 cached | ~3,000 (CLAUDE.md) + ~1,500 (index) + ~3,500 (2 fresh reads) + ~1,500 (output) = **~9,500** |
| Read 5 files, all cached (summary depth) | ~3,000 (CLAUDE.md) + ~1,500 (index) + ~500 (output) = **~5,000** |

The index pays for itself after ~2 repeated queries for the same files.

---

## 7. Refresh Strategy

### When to Update Index Entries

| Trigger | Action |
|---------|--------|
| Lib-Reader reads a file | Lib updates that file's index entry |
| File modified (detected by line count change or git status) | Mark entry stale, re-read on next access |
| Manual request | User says "Lib: refresh index" |
| Index file missing | Lib builds from scratch on first invocation |

### Staleness Detection

Simple approach appropriate for this project:
1. When Lib reads the index, check `Lines` count against actual file
2. If mismatch --> entry is stale, must re-read
3. No timestamp comparison needed at this scale (line count is sufficient proxy)

More robust approach (for future):
- Compare `Modified` timestamp against `git log -1 --format=%ci -- {file}`
- Only needed when files change frequently between agent invocations

---

## 8. Integration with Existing System

### CLAUDE.md Reference

Current instruction:
> **File reading:** Delegate to `Lib` (`Claude/librarian.md`) -- pass `files`, `focus`, `format`; receive fragments with line numbers.

**No change needed.** The caller interface remains identical. The index layer is internal to Lib.

### New Parameters (Backward-Compatible)

| Parameter | Default | Effect |
|-----------|---------|--------|
| `tags` | (none) | Discovery mode: find files by topic tag instead of explicit path |
| `depth` | `full` | `summary` returns index data only; `full` reads source if needed |

Existing invocations (`files` + `focus` + `format`) continue to work unchanged.

### Workflow Integration

The CLAUDE.md "Agent Pipeline" Phase 1 (Initial Understanding) currently says:
> Use Explore agent for unknown areas...

Lib with tags becomes a lighter alternative for focused discovery:
```
Lib: gather context
- tags: parser, pipeline
- focus: block splitting logic
- depth: summary
```

This returns relevant file summaries without reading source -- useful for Phase 1 orientation.

---

## 9. Implementation Roadmap

### Phase 1: Context Index Bootstrap (Low effort)

1. Create `Claude/context/` directory
2. Manually write initial `Claude/context/index.md` with entries for all 15 source files
3. Populate summaries, key symbols, dependencies, tags by reading each file once

**Deliverable:** A complete index file that Lib can consult.

### Phase 2: Update Lib Agent Definition (Low effort)

1. Update `Claude/default_agents/librarian.md` with the new workflow (check index first)
2. Add `tags` and `depth` parameters
3. Add index-update responsibility after fresh reads
4. Update footer format to include "From index" count

**Deliverable:** Updated librarian.md that is backward-compatible.

### Phase 3: Lib-Reader Agent Definition (Low effort)

1. Create `Claude/default_agents/lib-reader.md`
2. Single-file-read agent, returns fragments only (no index write per Option A)

**Deliverable:** New agent definition file.

### Phase 4: Validate with Real Queries (Medium effort)

1. Test: `Lib: gather context` with files that ARE in the index
2. Test: `Lib: gather context` with tags
3. Test: `Lib: gather context` with depth=summary
4. Test: Multi-file request triggering Lib-Reader spawn
5. Verify index gets updated after fresh reads

**Deliverable:** Validated system, any prompt adjustments.

### Phase 5: Index Maintenance (Ongoing)

- After any code change, Lib naturally refreshes stale entries
- Periodic manual review if entries drift

---

## 10. Trade-offs and Alternatives Considered

### Alternative A: JSON Index Instead of Markdown

**Rejected.** JSON would be more precise for programmatic access, but agents don't run code -- they read text. Markdown is natively readable in the agent context window with zero parsing overhead.

### Alternative B: One Agent Reads All Files (No Lib-Reader)

**Partially accepted.** For 1-2 files, Lib reads directly. Lib-Reader only activates for 3+ files needing fresh reads. At RPReader's scale (max file is 505 lines), even reading all files in one agent is feasible. The Lib-Reader pattern is preparation for scale, not a current necessity.

### Alternative C: Persistent Vector Index

**Rejected.** Would require external dependencies (embedding model, vector store). Violates the "no external dependencies" constraint. Overkill for 15 files.

### Alternative D: Git-based Staleness (Compare Hashes)

**Deferred.** Line count comparison is sufficient for current scale. Git hash comparison adds robustness but also a Bash call per file on every index check. Can be added later if staleness becomes a problem.

### Alternative E: Per-file Summary Files Instead of Single Index

**Deferred.** Good for large projects (50+ files) where the single index exceeds useful context size. At ~15 files, the entire index fits in ~1,500 tokens -- well within budget.

---

## 11. System Prompt Skeleton Notes

For whoever writes the final Lib prompt:

1. **First action must always be:** Read `Claude/context/index.md`
2. **Decision tree:** Index has entry? -> Summary satisfies focus? -> Return cached : Read file -> Update index
3. **Never hallucinate line numbers.** If returning from index, say "from index" and note that line numbers may have shifted since last read
4. **Quality gate:** Before returning, verify every fragment has a file path, line range, and relevance note
5. **Self-verification:** Count files requested vs. files covered in output. Footer must match.
6. **Index update format:** Follow the exact Markdown structure from Section 3. Do not invent new fields.
7. **Parallel spawn trigger:** Only when 3+ files need fresh reads AND caller hasn't specified `depth: summary`
