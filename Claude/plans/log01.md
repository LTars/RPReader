# Session 01: Creator Agent Design

**Status:** plan approved, execution pending
**Task:** create `Claude/creator.md` — meta-agent that creates other agents

## Original request (summary)

Design an agent (Creator) that uses other agents and its own directives to create new agents:
- Uses Lib for context gathering (existing agents, project rules, domain knowledge)
- Follows the common agent definition template (Role, Purpose, Responsibilities, Workflow, Rules, Scope, Goal)
- Validates new agents against Agent Checklist before writing
- Model: sonnet

Additional: add Lib file-reading convention as line 1 of CLAUDE.md.

## Context gathered

### Existing agents (Claude/)

| File | Name | Role | Lines |
|------|------|------|-------|
| arch.md | Arch | Document versioning, diff review, registry | 271 |
| developer.md | Dev | Frontend developer, code implementation | 84 |
| tori.md | Tori | Secretary — NOTES.md and REQUIREMENTS.md | 199 |
| librarian.md | Lib | Read files, extract fragments with line numbers | 88 |
| workflow.md | — | 5-phase workflow (Req → Design → Plan → Impl → Verify) | 450 |
| requirements.md | — | Stop conditions, checklists, communication protocol | 311 |

### Common agent template (extracted from all definitions)

Required sections: Role header + invocation name, Purpose (with negative scope), Responsibilities, Rules, Scope (IN/OUT), Goal (Ensure:).
Optional sections: Default Context, Communication, Workflow, Invocation Pattern, References, Glossary.

### Key orchestration rules (from requirements.md)

- Sub-agent delegation: "Delegating to **{name}**: {task}"
- Q&A forwarding one at a time
- Verify output against checklists
- Conflict hierarchy: User > STOP > CLAUDE.md > workflow.md > best practices

### Librarian lifecycle

- Input: files, focus, format
- Process: read → extract fragments with line numbers → relevance notes
- Output: fragment blocks (file:line + content + relevance) + footer
- Constraints: read-only, listed files only, no interpretation

## Decision: Creator agent spec

- 5-phase workflow: Concept → Context (via Lib) → Draft → Validate (Agent Checklist) → Present
- Agent Checklist: 13 points (unique name, no scope overlap, all sections present, no CLAUDE.md conflicts)
- Model: sonnet
- Scope IN: creating new agents, context via Lib, validation
- Scope OUT: modifying existing agents, implementing features, architecture

## Next steps

1. Write `Claude/log01.md` (this file)
2. Create `Claude/creator.md` following the spec
3. Add Lib convention to line 1 of `CLAUDE.md`
4. Verify: template compliance, self-applicable checklist, dry-run on "code review agent"