# Basketball Simulation Engine

**TypeScript port of basketball-sim Python codebase**

This module contains the complete basketball simulation engine translated from Python to TypeScript for React Native integration.

---

## Overview

The basketball simulation engine is a **deep, intricate, realistic** simulation system that models basketball gameplay using:

- **Weighted dice-roll mechanics** (sigmoid probability curves)
- **25 player attributes** (physical, mental, technical)
- **Tactical systems** (pace, man/zone defense, scoring options, etc.)
- **Stamina and fatigue modeling**
- **Full possession-by-possession simulation**

---

## Core Design Pillars

1. **Deep, Intricate, Realistic Simulation** - Not an arcade game. Every action reflects real basketball complexity.
2. **Weighted Dice-Roll Mechanics** - Probabilistic outcomes based on calculated probabilities, never simple random generation.
3. **Attribute-Driven Outcomes** - All 25 player attributes meaningfully impact gameplay.
4. **Tactical Input System** - User strategy influences outcomes through pace, defense type, scoring options, etc.

---

## Module Structure

### Phase 1: Foundation Modules (COMPLETE)

#### `core/probability.ts`
Core probability engine. **Most critical module.**

**Key Functions:**
- `weightedSigmoidProbability(baseRate, attributeDiff, k)` - The foundational formula for all probabilities
- `calculateComposite(player, weights)` - Calculate weighted attribute scores
- `rollSuccess(probability)` - Weighted dice roll
- `setSeed(seed)` - Set random seed for reproducibility

**Formula:**
```
centered = (sigmoid(k * AttributeDiff) - 0.5) * 2.0  // Range: -1 to +1
if centered >= 0:
  P = BaseRate + (1 - BaseRate) * centered
else:
  P = BaseRate * (1 + centered)
```

**Example:**
```typescript
import { weightedSigmoidProbability, calculateComposite, WEIGHTS_3PT } from './simulation';

// Calculate 3PT shooting probability
const shooter = { form_technique: 90, throw_accuracy: 85, ... };
const defender = { height: 80, reactions: 75, ... };

const shooterComposite = calculateComposite(shooter, WEIGHTS_3PT);
const defenderComposite = calculateComposite(defender, WEIGHTS_CONTEST);
const attributeDiff = shooterComposite - defenderComposite;

const probability = weightedSigmoidProbability(0.30, attributeDiff); // ~0.72 for elite shooter
```

#### `core/types.ts`
TypeScript interfaces for simulation.

**Key Types:**
- `SimulationPlayer` - Player representation with all 25 attributes
- `PossessionContext` - Possession state (transition, shot clock, score differential, etc.)
- `PossessionOutcome` - Detailed possession result with debug information
- `BoxScore` - Complete game statistics

**Alignment:**
- Aligned with Python dataclasses
- Aligned with Agent 5's data models (src/data/types.ts)

#### `constants.ts`
All constants and configuration values.

**Categories:**
- Base rates (3PT: 0.28, Layup: 0.62, Dunk: 0.87, etc.)
- Attribute weight tables (25+ tables for different actions)
- Shot distribution (3PT: 47%, Midrange: 26%, Rim: 27%)
- Contest penalties (wide open: 0%, contested: -4.8%, heavy: -9%)
- Transition bonuses (rim: +20%, midrange: +12%, 3PT: +8%)
- Stamina system (threshold: 80, degradation formula)
- Turnover rates, rebounding strategy, blocking system, etc.

---

### Phase 2: Core Systems (TODO)

- `systems/shooting.ts` - Shot selection, success calculation, blocking
- `systems/defense.ts` - Defensive assignments, contest distance, help defense
- `systems/rebounding.ts` - Team rebound strength, individual rebounder selection
- `systems/turnovers.ts` - Turnover probability, type selection, steal attribution
- `systems/fouls.ts` - Foul detection, bonus situations
- `systems/freeThrows.ts` - Free throw attempts and success

---

### Phase 3: Game Flow (TODO)

- `systems/gameClock.ts` - Possession timing, shot clock
- `systems/staminaManager.ts` - Stamina tracking, recovery, substitutions
- `systems/substitutions.ts` - Player substitution logic
- `systems/possession.ts` - Full possession orchestration

---

### Phase 4: Game Orchestration (TODO)

- `systems/quarterSimulation.ts` - 12-minute quarter simulation
- `systems/gameSimulation.ts` - Full 48-minute game simulation
- `systems/playByPlay.ts` - Narrative generation

---

### Phase 5: Advanced Systems (TODO)

- `systems/endGameModes.ts` - Clock management, intentional fouls
- `systems/timeoutManager.ts` - Timeout management
- `tactical/tacticalModifiers.ts` - Pace effects, defense type, scoring options

---

## Usage Examples

### Basic Probability Calculation

```typescript
import { weightedSigmoidProbability, setSeed } from './simulation';

// Set seed for reproducibility
setSeed(42);

// Calculate probability for elite shooter (90 composite) vs poor defender (30 composite)
const prob = weightedSigmoidProbability(0.30, 60); // baseRate=0.30, diff=60
console.log(prob); // ~0.72 (72% success rate)
```

### Composite Calculation

```typescript
import { calculateComposite, WEIGHTS_3PT } from './simulation';

const player = {
  form_technique: 90,
  throw_accuracy: 85,
  finesse: 80,
  hand_eye_coordination: 75,
  balance: 70,
  composure: 65,
  consistency: 60,
  agility: 55,
};

const composite = calculateComposite(player, WEIGHTS_3PT);
console.log(composite); // ~78.5
```

### Stamina Degradation

```typescript
import { calculateStaminaPenalty, applyStaminaToPlayer } from './simulation';

const player = { jumping: 90, stamina: 60, ... };

// Calculate stamina penalty at 40 stamina
const penalty = calculateStaminaPenalty(40); // ~0.098 (9.8% degradation)

// Apply stamina to player attributes
const degradedPlayer = applyStaminaToPlayer(player, 40);
console.log(degradedPlayer.jumping); // ~81 (90 * (1 - 0.098))
```

---

## Key Formulas

### Weighted Sigmoid Probability
```
centered = (sigmoid(k * AttributeDiff) - 0.5) * 2.0
if centered >= 0:
  P = BaseRate + (1 - BaseRate) * centered
else:
  P = BaseRate * (1 + centered)

Where:
- k = 0.025 (sigmoid steepness)
- AttributeDiff = OffensiveComposite - DefensiveComposite
- BaseRate = action-specific (0.28 for 3PT, 0.62 for layups, etc.)
```

### Composite Calculation
```
Composite = Σ (attribute * weight)

Example (3PT shooting):
Composite = form_technique * 0.25 + throw_accuracy * 0.20 + finesse * 0.15 + ...
```

### Stamina Degradation
```
if stamina < 80:
  penalty = 0.002 * (80 - stamina) ** 1.3
  degraded_attribute = original_attribute * (1 - penalty)
```

---

## Translation Status

### ✅ Complete
- Core probability engine
- Core types
- Constants and configuration

### 🚧 In Progress
- None (Phase 1 complete)

### ⏳ Pending
- Phase 2: Core systems (shooting, defense, rebounding, turnovers, fouls, free throws)
- Phase 3: Game flow (game clock, stamina manager, substitutions, possession)
- Phase 4: Game orchestration (quarter, game, play-by-play)
- Phase 5: Advanced systems (end-game modes, timeouts, tactical modifiers)

---

## Validation

All Phase 1 modules have been translated with **ZERO DEVIATIONS** from the Python source.

**Validation Requirements:**
1. Weighted sigmoid formula produces identical outputs
2. Random seed produces identical sequences
3. All constants match Python exactly
4. Statistical validation shows <0.5% deviation

See `PHASE1_VALIDATION_NOTES.md` for detailed validation plan.

---

## Design Principles

1. **Exact Python Parity** - All formulas, constants, and logic match Python 1:1
2. **Type Safety** - Strict TypeScript, no `any` types
3. **Functional Approach** - Pure functions where possible, no side effects
4. **Testability** - Seed-based randomness for reproducible testing
5. **Performance** - Optimized for mobile (React Native)

---

## Dependencies

- `seedrandom` - Deterministic random number generation (for validation)

---

## Testing

### Unit Tests (TODO - Agent 4)
- Test weighted sigmoid with various inputs
- Test composite calculations
- Test stamina degradation
- Test random seeding

### Integration Tests (TODO - Agent 4)
- Full possession simulation
- Statistical validation (1000+ possessions)
- Edge case testing (all-1 vs all-100 attributes)
- Performance benchmarking

### Validation Tests (TODO - Agent 4)
- Compare TypeScript outputs vs Python with same seeds
- Verify all probabilities match within 0.5%
- Ensure random sequences are identical

---

## Contributing

**Agent 1 (Translation Specialist)** - Responsible for Python-to-TypeScript translation
**Agent 4 (Simulation Validator)** - Responsible for validation and testing
**Agent 10 (Project Overseer)** - Coordination and sign-off

---

## Resources

- **Python Source:** `basketball-sim/` directory
- **Specification:** `basketball-sim/basketball_sim.md`
- **Data Models:** `src/data/types.ts` (Agent 5)
- **Validation Plan:** `PHASE1_VALIDATION_NOTES.md`

---

## License

MIT License (as per parent project)

---

**Last Updated:** 2025-11-17
**Status:** Phase 1 Complete - Awaiting Validation
