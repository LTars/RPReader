# Workflow Phases

## Phase Overview

| # | Phase | Input | Output | Location |
|---|-------|-------|--------|----------|
| 1 | Requirements | User request + docs | Understanding summary | `Claude/requirements/{feature}.md` |
| 2 | Design | Phase 1 output | Architecture document | `Claude/architecture/{feature}.md` |
| 3 | Planning | Phase 2 output | Implementation plan | `Claude/plans/{feature}.md` |
| 4 | Implementation | Phase 3 output | Source code | project directories per `CLAUDE.md` |
| 5 | Verification | Phase 4 output | Test results | browser + documented |

---

## Phase Transition Rules

### Entry Criteria (ALL must be true to start Phase N)
1. Phase N-1 artifact delivered
2. Phase N-1 checklist PASSED (reported explicitly)
3. User approved transition (explicit "proceed", "continue", "approved", or pre-authorization)

### Pre-Authorization
User may authorize multiple phases upfront:
- "Complete through Phase 3" -> Deliver at Phase 3
- "Implement without stopping" -> Deliver at Phase 4
- "Full implementation with tests" -> Deliver at Phase 5

**Default** (no instruction): Stop after each phase for approval.

### Phase Skip Authorization
User may skip phases by providing artifacts:
- "Here's the architecture" -> Skip Phase 2
- "Just implement this plan" -> Start at Phase 4

**Never skippable**: Checklist verification (always required, even if abbreviated).

---

## Phase 1: Requirements Understanding

### Purpose
Ensure complete understanding before design begins.

### Activities
1. Read all documents referenced by user
2. Identify modules, pages, constraints, interactions
3. List questions for anything unclear
4. Resolve questions via STOP: Uncertainty protocol
5. Produce summary artifact

### Artifact Template
```markdown
# {Feature} - Requirements Summary

## Source Documents
| Document | Coverage |
|----------|----------|
| {path} | {what it defines} |

## Modules Affected
| Module | Impact | Description |
|--------|--------|-------------|
| Parser | {none/read/write} | {what changes} |
| Renderer | {none/read/write} | {what changes} |
| Characters | {none/read/write} | {what changes} |
| Search | {none/read/write} | {what changes} |
| Styles | {none/read/write} | {what changes} |

## Interactions
| ID | Name | Description | Priority |
|----|------|-------------|----------|
| I-01 | {name} | {description} | {must/should/could} |

## Constraints
| ID | Constraint | Source | Rationale |
|----|------------|--------|-----------|
| C-01 | {constraint} | {document/user} | {why} |

## Browser Compatibility
| Concern | Resolution |
|---------|------------|
| {what could break in older browsers} | {how it's handled} |

## Resolved Questions
| # | Question | Answer | Source |
|---|----------|--------|--------|
| Q1 | {question} | {answer} | {user/document} |

## Open Items (if any, requires user decision)
| # | Item | Options | Impact |
|---|------|---------|--------|
| O1 | {item} | {A, B, C} | {what depends on this} |
```

### Exit Checklist
```
PHASE 1 CHECKLIST:
- [ ] All referenced documents read and summarized
- [ ] Affected modules identified
- [ ] All interactions listed with priorities
- [ ] All constraints documented with rationale
- [ ] Browser compatibility assessed
- [ ] No unresolved questions (or explicitly deferred)
- [ ] Universal checklist passed
```

---

## Phase 2: Design

### Purpose
Define system architecture with enough detail to plan implementation.

### Activities
1. Define feature context and boundaries within the data pipeline
2. Identify components and their responsibilities (<=3 each)
3. Define interfaces between components
4. Map data flow through Content -> Parser -> Blocks -> Renderer -> DOM
5. Document architectural decisions with rationale

### Artifact Template
```markdown
# {Feature} - Architecture

## 1. Purpose
{What this feature does within the reader}

## 2. Scope
{Boundaries — what's in, what's out}

## 3. Constraints
| ID | Constraint | Rationale |
|----|------------|-----------|
| C-01 | {constraint} | {why it exists} |

## 4. Data Flow
### 4.1 Pipeline Position
{Where this feature sits in: Content -> Parser -> Blocks -> Renderer -> DOM}

### 4.2 Data Ownership
| Data | Owner | Readers |
|------|-------|---------|
| {data} | {who writes} | {who reads} |

### 4.3 Data Flow Diagram
```
{Component} -> {Data} -> {Consumer}
```

## 5. Building Blocks

### 5.1 Component Overview
| Component | Responsibility | Location |
|-----------|----------------|----------|
| {name} | {max 3 responsibilities} | {project path} |

### 5.2 Component Details

#### {Component Name}
**Responsibility**: {what it does}
**Interfaces**:
- Provides: {method/event} — {description}
- Requires: {method/event} — {description}

## 6. Runtime View

### 6.1 {Scenario Name}
**Trigger**: {what starts this}
**Flow**:
1. {Event/action}
2. {Component} reads {data}
3. {Component} computes {what}
4. {Component} updates {DOM/state}

## 7. Data Structures

### 7.1 {Entity/Object Name}
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| {field} | {type} | {constraints} | {purpose} |

## 8. Decisions Log
| ID | Decision | Options | Choice | Rationale | Date |
|----|----------|---------|--------|-----------|------|
| D-01 | {decision} | {A, B, C} | {chosen} | {why} | {date} |

## 9. Risks and Technical Debt
| ID | Risk/Debt | Mitigation | Status |
|----|-----------|------------|--------|
| R-01 | {risk} | {mitigation} | {open/mitigated} |
```

### Exit Checklist
```
PHASE 2 CHECKLIST:
- [ ] All interactions from Phase 1 have runtime flows
- [ ] All components have <=3 responsibilities
- [ ] All interfaces fully specified (no TBD)
- [ ] Data flow follows pipeline — no reverse flow
- [ ] Data ownership clear — each piece has one writer
- [ ] All architectural decisions have rationale
- [ ] Universal checklist passed
```

---

## Phase 3: Planning

### Purpose
Break design into implementable tasks with clear acceptance criteria.

### Activities
1. Decompose components into implementation tasks
2. Define task dependencies
3. Specify acceptance criteria (measurable)
4. Define verification method per task

### Artifact Template
```markdown
# {Feature} - Implementation Plan

## Summary
| Metric | Value |
|--------|-------|
| Total tasks | {N} |
| Critical path | Task {X} -> Task {Y} -> Task {Z} |
| Estimated complexity | {Low/Medium/High} |

## Dependency Graph
```
Task 1 (no deps)
Task 2 (no deps)
Task 3 -> depends on: Task 1
Task 4 -> depends on: Task 1, Task 2
Task 5 -> depends on: Task 3, Task 4
```

## Tasks

### Task {N}: {Name}
**Component**: {from design}
**File(s)**: `{path/to/file}`
**Dependencies**: {Task IDs | "none"}

**Description**:
{What this task accomplishes}

**Steps**:
1. {Specific implementation step}
2. {Specific implementation step}
3. {Specific implementation step}

**Acceptance Criteria**:
- [ ] {Measurable criterion}
- [ ] {Measurable criterion}

**Verification**:
- Method: {browser test | manual check | automated}
- Expected: {expected outcome}

---

## Implementation Order
1. {Task N}: {rationale for order}
2. {Task M}: {rationale for order}

## Verification Summary
| Task | Verification Method | Automated |
|------|--------------------| ----------|
| Task 1 | {method} | {yes/no} |
```

### Exit Checklist
```
PHASE 3 CHECKLIST:
- [ ] All components from Phase 2 have tasks
- [ ] All tasks have clear inputs/outputs
- [ ] All tasks have measurable acceptance criteria
- [ ] All tasks have verification method
- [ ] Dependencies form valid DAG (no cycles)
- [ ] No "TBD" or "details later"
- [ ] Universal checklist passed
```

---

## Phase 4: Implementation

### Purpose
Produce working code that satisfies the plan.

### Activities
1. Implement code per task
2. Verify each task against acceptance criteria
3. Report progress for multi-task implementations

### Progress Reporting (for multi-task implementations)
After each task:
```
TASK COMPLETE: Task {N} - {Name}

Acceptance Criteria:
- [x] {criterion 1}
- [x] {criterion 2}

Verification:
- Method: {method}
- Result: {PASS | FAIL - details}

Progress: {completed}/{total} tasks
Next: Task {M} - {Name}
```

### Exit Checklist
```
PHASE 4 CHECKLIST:
- [ ] All tasks from Phase 3 implemented
- [ ] All acceptance criteria met (per task)
- [ ] All task verifications passed
- [ ] No TODO/FIXME comments
- [ ] No stub implementations
- [ ] No inline styles or scripts in HTML
- [ ] No hardcoded paths
- [ ] No silently swallowed errors
- [ ] CSS values in custom properties
- [ ] File assembly order followed
- [ ] Code runs without console errors
- [ ] Universal checklist passed
```

---

## Phase 5: Verification

### Purpose
Confirm implementation meets requirements.

### Activities
1. Test in all target browsers
2. Test responsive layout
3. Trace requirements to verification results
4. Document any issues

### Artifact Template
```markdown
# {Feature} - Verification Results

## Browser Testing
| Browser | Version | Result |
|---------|---------|--------|
| Chrome | latest | {PASS/FAIL} |
| Firefox | latest | {PASS/FAIL} |
| Safari | latest | {PASS/FAIL} |
| Mobile viewport | 375px | {PASS/FAIL} |

## Requirements Traceability
| Requirement | Verification | Status |
|-------------|-------------|--------|
| I-01 | {how verified} | {pass/fail} |
| C-01 | {how verified} | {pass/fail} |

## Performance Check
| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Page load | {target} | {actual} | {pass/fail} |
| Large content | {target} | {actual} | {pass/fail} |

## Failed Tests (if any)
| Test | Failure Reason | Severity |
|------|----------------|----------|
| {test} | {reason} | {critical/high/medium/low} |

## Issues Discovered
| ID | Issue | Severity | Resolution |
|----|-------|----------|------------|
| I-01 | {issue} | {severity} | {fixed/deferred/wontfix} |

## Verification Summary
- Overall: {PASS | FAIL}
- Requirements coverage: {100% | X% — missing: ...}
- Browser compatibility: {all pass | failures: ...}
```

### Exit Checklist
```
PHASE 5 CHECKLIST:
- [ ] All target browsers pass
- [ ] Responsive layout verified
- [ ] All requirements have verification
- [ ] No critical/high severity issues unresolved
- [ ] Universal checklist passed
```

---

## Iteration Rules

### Backward Iteration (later phase reveals earlier phase error)
```
ITERATION REQUIRED:
- Current phase: {N}
- Issue in phase: {M} (where M < N)
- Issue: {description}
- Impact: {what needs to change}

Request: Permission to update Phase {M} artifact and re-execute subsequent phases.
```

Wait for approval before iterating.

### Forward Reference (need to validate design with prototype)
```
FORWARD REFERENCE NEEDED:
- Current phase: {N}
- Need to prototype: {what}
- Reason: {why design can't be finalized without this}
- Scope: {limited prototype scope}

Request: Permission for limited implementation to validate design.
```

Wait for approval. If approved:
1. Implement minimal prototype
2. Learn and document findings
3. Update design
4. Discard prototype (or note if kept)

---

## Directory Structure

Project structure defined in `CLAUDE.md`. Workflow artifacts:

```
Claude/
  requirements.md              — working rules (this project)
  workflow.md                  — this file
  developer.md                 — developer sub-agent definition
  arch.md                      — document version control agent
  tori.md                      — secretary sub-agent
  requirements/
    {feature}.md               — Phase 1 artifacts
  architecture/
    {feature}.md               — Phase 2 artifacts
  plans/
    {feature}.md               — Phase 3 artifacts
```

**Naming conventions**:
- `{feature}`: kebab-case (e.g., `content-pipeline`, `character-panel`)
