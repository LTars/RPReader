# Claude Requirements for RPReader

## MANDATORY CONTEXT
Before starting ANY work, verify these files are loaded:
- `CLAUDE.md` — Architecture, code style, structure rules
- `Claude/requirements.md` — This file (working rules)
- `Claude/workflow.md` — Phase definitions and artifact templates

**Action**: If a mandatory file is not in context, state:
```
MISSING CONTEXT: {filename} is required but not loaded.
Please provide this file or confirm I should proceed without it.
```

---

## STOP CONDITIONS
These HALT work immediately. Do not produce output until resolved.

### STOP: Uncertainty
**Trigger**: About to produce ANY output without 100% certainty

**Detection signals** (if you're thinking these, STOP):
| Artifact | Signals |
|----------|---------|
| Design | "probably", "likely", "should work", "I assume", "typically" |
| Plan | "might need", "possibly", "TBD", "to be determined", "details later" |
| Code | "would use", "in production", "TODO", "placeholder", "stub", "mock" |

**Action**:
```
[I don't know] {specific uncertainty}

Context: {why this blocks progress}
Question: {specific question to resolve it}
Options (if applicable):
A) {option} - {tradeoff}
B) {option} - {tradeoff}
```

**Wait for answer. Do not proceed.**

**Violation examples**:

Bad — Design:
```
The parser will probably use regex for author detection.
```

Bad — Plan:
```
Step 3: Implement character panel (details TBD)
```

Bad — Code:
```js
// TODO: replace with real loading
const blocks = [];
```

Good:
```
[I don't know] How to split content into blocks for LOD loading.

Context: Cannot implement lazy loading without a splitting strategy.
Question: Split by scene dividers, by block count, or by byte size?
Options:
A) Scene dividers — natural breaks, variable size
B) Fixed block count — predictable, may split mid-scene
```

---

### STOP: Missing Information
**Trigger**: Need information not provided in context

**Action**:
```
MISSING INFORMATION:
- Need: {what's missing}
- Reason: {why it's required}
- Request: Please provide {X} or point me to documentation.
```

**Wait for answer. Do not proceed.**

### STOP: Scope Ambiguity
**Trigger**: Task/requirement has multiple valid interpretations

**Action**:
```
SCOPE AMBIGUITY: {what's ambiguous}

Interpretation A: {description} -> {implications}
Interpretation B: {description} -> {implications}

Which interpretation should I follow?
```

**Wait for answer. Do not proceed.**

### STOP: Conflict Detected
**Trigger**: Requirements, constraints, or instructions contradict

**Action**:
```
CONFLICT: {requirement A} vs {requirement B}
Source A: {where it comes from}
Source B: {where it comes from}

Which takes precedence?
```

**Wait for answer. Do not proceed.**

---

## Communication
1. **No hallucination**: Never guess or fabricate. Use STOP: Uncertainty protocol above.
2. **Ask early**: Request missing information before starting work.
3. **One question at a time**: Ask questions step by step. Wait for the answer before asking the next.
4. **Data boundaries**: Do not fetch files I haven't explicitly pointed to.

### Communication Protocol

**Before Starting Work:**
```
STARTING: {phase/task name}
Input: {what I'm working from}
Output: {what I will deliver}
```

**Phase Completion:**
```
PHASE COMPLETE: {phase name}

Artifact: {location/name}
Checklist: {PASSED | FAILED - details}

Ready for: {next phase} (awaiting approval)
```

**Progress (for long tasks):**
```
PROGRESS: {X}% complete
Done: {items completed}
Current: {current item}
Remaining: {items left}
Blocked: {nothing | blocker}
```

**End of Response:**
Every response ends with:
```
---
Context: {files currently loaded}
Phase: {current phase or N/A}
Status: {working | blocked | awaiting approval}
Next: {what happens next}
```

---

## CHECKPOINTS
Verify before delivering ANY artifact. Failure = STOP and report.

### Universal Checklist (ALL artifacts)
```
DELIVERY CHECKLIST:
- [ ] No uncertainty signals in output (search: probably, likely, TBD, TODO, assume, might)
- [ ] All [I don't know] items were resolved via Q&A
- [ ] Each original requirement is addressed
- [ ] No placeholders or deferred items without explicit user approval
```

### Design Checklist (in addition to Universal)
```
- [ ] All components have defined responsibilities (<=3 each)
- [ ] All interfaces fully specified (no TBD)
- [ ] All decisions have documented rationale
- [ ] Data flow respects pipeline (Content -> Parser -> Blocks -> Renderer -> DOM)
- [ ] No reverse data flow (Renderer never modifies blocks or content)
```

### Plan Checklist (in addition to Universal)
```
- [ ] Every step has clear inputs and outputs
- [ ] Dependencies are explicit
- [ ] Verification method defined per step
```

### Code Checklist (in addition to Universal)
```
- [ ] No TODO/FIXME comments
- [ ] No stub implementations
- [ ] No inline styles or scripts in HTML
- [ ] No hardcoded paths — use BASE_URL
- [ ] No silently swallowed errors
- [ ] Modern browser APIs only — no polyfills
- [ ] CSS values in custom properties
- [ ] File assembly order followed (imports -> constants -> state -> functions -> init)
- [ ] Runs without console errors or warnings
```

**Checklist failure action**:
```
CHECKLIST FAILED:
- [ ] {failed item}: {what's wrong}

How should I proceed?
```

---

## Orchestrating Sub-Agents
- **Delegate via sub-agents**: Use sub-agents for parallelizable work. Focus on orchestration and critical decisions.
- **Always announce sub-agent**: Before delegating, state the sub-agent name. Format: "Delegating to **{agent-name}** sub-agent: {brief task description}"
- **Sub-agent requirements**: Every sub-agent follows Problem-Solving and Communication sections.
- **Forward questions**: If a sub-agent has a question, forward it to me and pass back an answer.
- **One question at a time**: Sub-agents ask questions step by step. Wait for the answer before asking the next.
- **Verify output**: Verify sub-agent output against CHECKPOINTS before accepting.

---

## Problem-Solving
1. **Simple over complex**: Choose the straightforward solution.
   ```js
   // complex:
   const multiplier = 2.0;
   const result = amount * multiplier;

   // simple:
   const result = amount * 2.0;
   ```

2. **Complex over complicated**: When complexity is needed, keep it structured.
   - Early bail-out for simple cases
   - Functions focused on single responsibility
   - Cyclomatic Complexity:

   | CC Score | Level | Action |
   |----------|-------|--------|
   | 1-6 | Low | Acceptable |
   | 7-12 | Complex | Review for simplification |
   | 13+ | High | Refactor unless necessary; add comment explaining |

3. **Scope confirmation**: Confirm scope before starting each workflow phase.

### Quality Metrics

| Metric | Target | Exceeded Action |
|--------|--------|-----------------|
| Cyclomatic Complexity | <= 6 | Refactor or justify with comment |
| Function length | <= 30 lines | Split responsibilities |
| Nesting depth | <= 3 levels | Use early bail-out |
| Component responsibilities | <= 3 | Split component |

---

## Technology Stack
- **Language**: JavaScript (ES modules)
- **Styles**: Plain CSS (native nesting, custom properties)
- **Markup**: HTML5
- **Deploy**: GitHub Pages (direct from main branch)
- **Version Control**: Git
- **Code Style**: See `CLAUDE.md` — Code Style section

---

## Coding Standards

Defined in `CLAUDE.md`. Key points:
- camelCase variables/functions, PascalCase classes, UPPER_SNAKE_CASE constants
- const by default, let when mutation needed
- No inline styles or scripts in HTML
- CSS values in custom properties
- File assembly order: imports -> constants -> state -> functions -> init

---

## Execution
1. **Delegate via sub-agents**: Use sub-agents for parallelizable work.
   - Always explicitly name the sub-agent.
   - Sub-agents ask questions before they start work.
   - One question at a time, wait for answer.

2. **Incremental delivery**: Show progress per workflow phase. Iterate based on feedback.

3. **Data fetching**: Always ask before fetching data online.
   - This includes sub-agents.
   - Format: "May I fetch [URL]?" and wait for approval.

---

## Conflict Resolution

When requirements conflict, explicitly state:
```
CONFLICT: {requirement A} vs {requirement B}
Source A: {where it comes from}
Source B: {where it comes from}

Which takes precedence?
```

### Priority Hierarchy
1. User's explicit instruction in current conversation
2. STOP CONDITIONS in this file
3. `CLAUDE.md` — Architecture and code style rules
4. `Claude/workflow.md` definitions
5. General best practices
