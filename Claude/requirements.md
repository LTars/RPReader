# Claude Requirements for Forever World

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

❌ Design violation:
```
Topology generation will probably use Perlin noise for heightmaps.
```

❌ Plan violation:
```
Step 3: Implement economy tick (details TBD)
```

❌ Code violation:
```gdscript
# TODO: replace with real RNG
var height: float = randf()
```

✅ Correct behavior:
```
[I don't know] Which noise algorithm to use for heightmap generation.

Context: Cannot implement TopologyProvider without this.
Question: Perlin, Simplex, or OpenSimplex2? Each has different artifact patterns.
Options:
A) OpenSimplex2 — fewer directional artifacts, built into Godot (FastNoiseLite)
B) Perlin — classic, well-documented, but grid-aligned artifacts
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

Interpretation A: {description} → {implications}
Interpretation B: {description} → {implications}

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
2. **Ask early**: Request missing information before starting work. Use STOP: Missing Information protocol.
3. **One question at a time**: Ask questions step by step. Wait for the answer before asking the next.
4. **Data boundaries**: Do not fetch files I haven't explicitly pointed to.
   - Use the file as an entrypoint and include all files referenced programmatically or in text.

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
- [ ] All components have defined responsibilities (≤3 each)
- [ ] All interfaces fully specified (no TBD)
- [ ] All decisions have documented rationale
- [ ] Data flow respects C3 Pipeline (Generate → State ↔ Simulate → Present)
- [ ] No reverse data flow (Present never writes to State)
- [ ] Determinism preserved (no randf(), no static state, no real-time dependencies)
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
- [ ] No randf() or Time.get_unix_time() — only RNG from Core/Random/ and State/Time/
- [ ] All variables typed
- [ ] No static variables in Simulate/ or Generate/
- [ ] Compiles without warnings
- [ ] Tick functions hold no state between calls
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
- **Always announce sub-agent**: Before delegating, always state the sub-agent name. Format: "Delegating to **{agent-name}** sub-agent: {brief task description}"
- **Sub-agent requirements**: Every sub-agent should follow [Problem-Solving](#problem-solving) and [Communication](#communication) sections.
- **Forward questions**: If a sub-agent has a question, forward it to me and pass back an answer.
- **One question at a time**: Sub-agents must ask questions step by step. Wait for the answer, then ask follow-up if needed.
- **Verify output**: Verify sub-agent output against CHECKPOINTS before accepting.

---

## Problem-Solving
1. **Simple over complex**: Choose the straightforward solution.
   - Avoid defining variables used in a single place; inject values directly.
   - Use inline lambdas for simple one-off operations.
   ```gdscript
   # complex:
   var multiplier: float = 2.0
   var result: float = amount * multiplier

   # simple:
   var result: float = amount * 2.0
   ```
   ```gdscript
   # complex:
   func _double(x: float) -> float:
       return x * 2.0
   var results: Array = values.map(_double)

   # simple:
   var results: Array = values.map(func(x: float) -> float: return x * 2.0)
   ```

2. **Complex over complicated**: When complexity is needed, keep it structured — not convoluted.
   - Adopt early bail-out to handle simple cases first and return.
   - Focus functions on a single responsibility. Keep them small.
   - Use Cyclomatic Complexity (CC) for evaluation:

   | CC Score | Level | Action |
   |----------|-------|--------|
   | 1-6 | Low | Acceptable |
   | 7-12 | Complex | Review for simplification |
   | 13+ | High | Refactor unless necessary; add descriptive comment explaining necessity |

3. **Scope confirmation**: Confirm scope before starting each workflow phase.

### Quality Metrics

| Metric | Target | Exceeded Action |
|--------|--------|-----------------|
| Cyclomatic Complexity | ≤ 6 | Refactor or justify with comment |
| Function length | ≤ 30 lines | Split responsibilities |
| Nesting depth | ≤ 3 levels | Use early bail-out |
| Component responsibilities | ≤ 3 | Split component |

---

## Technology Stack
- **Engine**: Godot 4.x
- **Language**: GDScript
- **Testing**: GUT (Godot Unit Testing)
- **Version Control**: Git
- **Code Style**: See `CLAUDE.md` — Code Style section

---

## Coding Standards

Defined in `CLAUDE.md`. Key points:
- snake_case variables/functions, PascalCase classes/nodes, UPPER_SNAKE_CASE constants
- All variables typed
- Signals past tense: `health_changed`, `player_died`
- Booleans state a fact: `is_flooded`, `has_river`
- No magic numbers — extract to named constants

---

## Testing Standards

### Framework: GUT
- Test scenes: `res://tests/`
- Test scripts: `test_*.gd`
- GUT runner: via editor plugin or CLI

### Test Structure
```gdscript
extends GutTest

var _topology_provider: TopologyProvider

func before_each() -> void:
    _topology_provider = TopologyProvider.new()

func after_each() -> void:
    _topology_provider.free()

func test_same_seed_produces_same_heightmap() -> void:
    # Arrange
    var seed_a: int = 42
    var seed_b: int = 42

    # Act
    var result_a: Array = _topology_provider.generate(seed_a)
    var result_b: Array = _topology_provider.generate(seed_b)

    # Assert
    assert_eq(result_a, result_b, "Same seed must produce identical heightmaps")

func test_different_seeds_produce_different_heightmaps() -> void:
    var result_a: Array = _topology_provider.generate(42)
    var result_b: Array = _topology_provider.generate(99)

    assert_ne(result_a, result_b, "Different seeds should produce different heightmaps")
```

### Determinism Tests
Every generator and tick must have a determinism test:
```gdscript
func test_ecology_tick_is_deterministic() -> void:
    var state_a: EcologyState = _create_test_state()
    var state_b: EcologyState = _create_test_state()

    EcologyTick.execute(state_a)
    EcologyTick.execute(state_b)

    assert_eq(state_a, state_b, "Same input state must produce same output")
```

### Test Naming
- Test scripts: `test_{domain}.gd` (e.g., `test_topology_provider.gd`)
- Test functions: `test_{what_it_verifies}` (e.g., `test_same_seed_produces_same_heightmap`)
- Helpers: `_create_test_{thing}` (e.g., `_create_test_state`)

---

## Execution
1. **Delegate via sub-agents**: Use sub-agents for parallelizable work.
   - Always explicitly name the sub-agent (e.g., "Delegating to **explore** sub-agent").
   - Sub-agents ask questions before they start work.
   - Ask one question at a time, wait for an answer, then ask follow-up if needed.
   - Format: `[Sub-Agent name] asks: {question}`

2. **Incremental delivery**: Show progress per workflow phase. Iterate based on feedback.

3. **Verification**: Include how to test/verify every change.
   ```bash
   # Run all tests via CLI
   godot --headless -s addons/gut/gut_cmdln.gd

   # Run specific test
   godot --headless -s addons/gut/gut_cmdln.gd -gtest=res://tests/test_topology_provider.gd
   ```

4. **Data fetching**: Always ask before fetching data online.
   - This includes sub-agents: do NOT delegate web fetches without asking permission first.
   - Format: "May I fetch [URL]?" and wait for approval.
   - Multiple URLs: Ask explicitly for each. If >5 URLs, split into chunks by logical purpose.

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
When resolving conflicts, apply in this order:
1. User's explicit instruction in current conversation
2. STOP CONDITIONS in this file
3. `CLAUDE.md` — Architecture and code style rules
4. `Claude/workflow.md` definitions
5. General best practices
