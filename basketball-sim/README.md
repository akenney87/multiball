# Basketball Simulator - Milestone 1

Deep, intricate, realistic text-based basketball simulation focused on weighted dice-roll mechanics.

## Project Status

**Current Milestone:** 1 (Single Possession Simulation)
**Status:** COMPLETE - Ready for Validation

## Architecture Overview

### Directory Structure

```
simulator/
├── src/
│   ├── core/                      # Core mathematical systems
│   │   ├── probability.py         # ✅ Sigmoid, composites, weighted rolls
│   │   └── data_structures.py     # ✅ Player, PossessionContext, results
│   ├── systems/                   # Basketball mechanics
│   │   ├── shooting.py            # ✅ Shot selection, success calculations
│   │   ├── possession.py          # ✅ Possession orchestration
│   │   ├── rebounding.py          # ✅ Team/individual rebounding
│   │   ├── turnovers.py           # ✅ Turnover checks and types
│   │   └── defense.py             # ✅ Contest, help defense
│   ├── tactical/                  # User strategy impact
│   │   └── modifiers.py           # ✅ Pace, man/zone, scoring options
│   ├── simulation.py              # ✅ Main simulation engine
│   └── constants.py               # ✅ All BaseRates, weights, modifiers
├── data/
│   └── sample_teams.json          # ✅ Test players (extreme profiles)
├── tests/                         # ✅ Unit and integration tests
├── main.py                        # ✅ CLI entry point
├── requirements.txt               # ✅ Python dependencies
├── basketball_sim.md              # ✅ Complete implementation spec
├── CLAUDE.md                      # ✅ Project guidance
└── README.md                      # This file

✅ = Complete | 🔨 = In Progress | ⏳ = Pending
```

## Completed Foundation

### 1. Core Probability Engine (src/core/probability.py)

**Status:** COMPLETE and VALIDATED

**Capabilities:**
- Weighted sigmoid probability: `P = BaseRate + (1 - BaseRate) * sigmoid(-k * AttributeDiff)`
- Composite attribute calculator with arbitrary weights
- AttributeDiff calculation (offensive - defensive composites)
- Weighted random selection with normalization
- Stamina degradation formula (exponential curve)
- Random seed control for debug mode
- Overflow protection for extreme attribute disparities

**Key Functions:**
- `weighted_sigmoid_probability()` - Core dice-roll mechanic
- `calculate_composite()` - Weighted attribute average
- `roll_success()` - Boolean success/failure
- `weighted_random_choice()` - Select from weighted options
- `apply_stamina_to_player()` - Create degraded player copy

**Edge Cases Handled:**
- Extreme attribute differences (±100)
- Zero/negative weights
- Stamina below threshold (80)
- Probability bounds enforcement [0, 1]

### 2. Constants (src/constants.py)

**Status:** COMPLETE

Single source of truth for:
- All 14 attribute weight tables (3PT, midrange, dunk, layup, rebound, etc.)
- All BaseRates (3PT: 30%, Dunk: 80%, Layup: 62%, etc.)
- All modifiers (pace ±10%, zone +3%/-15%, transition +20%/+12%/+8%)
- Usage distribution (30%/20%/15%/35%)
- Contest penalties (0%/-15%/-25%)
- Stamina formulas (threshold: 80, power: 1.3)

### 3. Data Structures (src/core/data_structures.py)

**Status:** COMPLETE

**Defined:**
- `PossessionContext` - Game state (transition, shot clock, score diff)
- `TacticalSettings` - 5 tactical inputs with validation
- `SigmoidCalculation` - Debug tracking for probability calcs
- `PossessionResult` - Structured output with full debug info
- Player validation (all 25 attributes in [1, 100])
- Team validation (exactly 5 players)

### 4. Sample Team Data (data/sample_teams.json)

**Status:** COMPLETE

**3 Teams with 6 Archetypes:**

**Elite Shooters:**
- Stephen Curry (PG) - 95+ shooting composite
- Klay Thompson (SG) - 90+ shooting, elite consistency
- Kevin Durant (SF) - 90+ shooting, 90 height
- Shaquille O'Neal (C) - 98 height, 95+ dunk composite

**Elite Defenders:**
- Draymond Green (PF) - 95+ awareness, 95 teamwork
- Kawhi Leonard (SF) - 95+ reactions/awareness
- Dennis Rodman (PF) - 95+ rebounding composite
- Gary Payton (PG) - 95 reactions, elite perimeter defense
- Rudy Gobert (C) - 95 height, 90+ rim protection

**G-League Rookies:**
- 5 generic players with 25-40 attributes (edge case testing)

**Tactical Presets:**
- Aggressive (fast pace, 80% man, crash glass)
- Balanced (standard pace, 50% man, standard rebound)
- Conservative (slow pace, 30% man, prevent transition)

## Next Steps (Delegated Tasks)

### Immediate (Phase 2): Game Mechanics

**Priority 1: Shooting System** (systems/shooting.py)
- Shot type selection (weighted by player attributes + tactics)
- 3PT shooting (two-stage: base success → contest penalty)
- Midrange (short/long range variants)
- Dunk mechanics (height + jumping composite)
- Layup mechanics (finesse + hand-eye)
- Contest penalty calculator (distance tiers + defender modifier)
- Help defense rotation check

**Priority 2: Defense System** (systems/defense.py)
- Primary defender assignment
- Contest distance calculation
- Help defense awareness check
- Zone vs man defense selection

**Priority 3: Turnover System** (systems/turnovers.py)
- Base turnover check (8%, modified by pace)
- Turnover type selection (bad pass 40%, lost ball 30%, foul 20%, violation 10%)
- Transition trigger logic (all except violations)

**Priority 4: Rebounding System** (systems/rebounding.py)
- Team rebound strength (average of rebounders + 15% defensive advantage)
- Individual rebounder selection (weighted by composite)
- OREB logic (putback if height > 75, else kickout)
- Rebounding strategy application (3/4/5 players)

### Phase 3: Integration

**Tactical Modifiers** (tactical/modifiers.py)
- Apply pace effects (possession count, stamina drain)
- Apply zone defense modifiers (+3% TO, -15% 3PT contest, -10% drive)
- Calculate shooter selection (usage distribution with fallback)

**Possession Coordinator** (systems/possession.py)
- Orchestrate full possession flow
- Track assist timing (2-second rule)
- Handle drive-to-rim outcomes (4-way sigmoid: dunk/layup/kickout/turnover)
- Manage shot clock

### Phase 4: Simulation Engine

**Main Engine** (simulation.py)
- Input validation
- Random seed control
- Debug output generation
- Play-by-play text formatting

**CLI Entry Point** (main.py)
- Argument parsing (teams, seed, debug flag)
- JSON team loading
- Pretty-print results

### Phase 5: Validation

**Unit Tests** (tests/)
- Sigmoid with extreme diffs (±100)
- Composite calculation accuracy
- Contest penalty tiers
- Stamina degradation curve
- Normalization edge cases

**Integration Tests**
- Elite vs weak (verify ~80% success)
- Weak vs elite (verify ~15% success)
- Zone defense (verify modifiers apply)
- Transition (verify +20% rim bonus)

## Core Design Principles

### 1. Deep, Intricate, Realistic Simulation
- All 25 player attributes meaningfully impact gameplay
- Biological realism (exponential stamina recovery, degradation curve)
- Possession-level detail with context awareness

### 2. Weighted Dice-Roll Mechanics
- All outcomes use sigmoid probability curves
- No simple random() calls without attribute weighting
- Diminishing returns at extremes (95 vs 100 smaller than 50 vs 55)

### 3. Attribute-Driven Outcomes
- 14 action-specific weight tables defined
- Player specialization through attribute profiles
- Every action uses appropriate attributes

### 4. Tactical Input System
- 5 tactical settings with mechanical impact
- Pace: ±10% possessions, ±15% stamina
- Man/Zone: +3% TO, -15% 3PT contest, -10% drive (zone)
- Scoring options: 30%/20%/15% usage
- Rebounding: 3/4/5 players box out

## Running the Simulation

Milestone 1 is now complete and fully operational!

### Installation

```bash
# Install dependencies
pip install -r requirements.txt
```

### CLI Usage

```bash
# Basic possession simulation
python main.py -o "Elite Shooters" -d "Elite Defenders"

# With debug output (shows all probability calculations)
python main.py -o "Elite Shooters" -d "Elite Defenders" --seed 42 --debug

# Transition possession
python main.py -o "Elite Shooters" -d "Elite Defenders" --transition

# Compact output (single line, useful for scripting)
python main.py -o "Elite Shooters" -d "Elite Defenders" --compact

# JSON output (for analysis)
python main.py -o "Elite Shooters" -d "Elite Defenders" --json --seed 42

# Custom shot clock
python main.py -o "Elite Shooters" -d "Elite Defenders" --shot-clock 14
```

### Available Teams

- **Elite Shooters**: Stephen Curry, Klay Thompson, Kyle Lowry, Kevin Durant, Shaquille O'Neal
- **Elite Defenders**: Draymond Green, Kawhi Leonard, Dennis Rodman, Gary Payton, Rudy Gobert
- **G-League Rookies**: Generic players with 25-40 attributes (for edge case testing)

### CLI Arguments

| Argument | Short | Description | Default |
|----------|-------|-------------|---------|
| `--offensive-team` | `-o` | Name of offensive team (required) | - |
| `--defensive-team` | `-d` | Name of defensive team (required) | - |
| `--seed` | `-s` | Random seed for reproducibility | Random |
| `--debug` | - | Include full debug output | False |
| `--compact` | - | Single-line output | False |
| `--json` | - | Output raw JSON | False |
| `--transition` | `-t` | Set as transition possession | False |
| `--shot-clock` | - | Shot clock seconds (14 or 24) | 24 |
| `--team-data` | - | Path to team JSON file | data/sample_teams.json |

### Example Output

**Standard Output:**
```
==================================================
POSSESSION START
==================================================

Stephen Curry attempts a 3-pointer from the top of the key.
Contested by Kawhi Leonard (3.5 feet away - Contested).

STEPHEN CURRY MAKES THE THREE-POINTER!
+3 Points

Assist: Draymond Green

==================================================
POSSESSION END
==================================================

Outcome: made_shot
Points: 3
Scorer: Stephen Curry
Assist: Draymond Green
```

**Compact Output:**
```
MADE: Stephen Curry 3PT (+3) | Assist: Draymond Green
```

**With Debug Flag:**
Includes complete probability calculations, sigmoid inputs/outputs, attribute composites, and all decision points.

## Validation Criteria (Milestone 1)

**Must Pass:**
1. All probabilities in [0, 1] (no NaN, no overflow)
2. Composites calculate correctly (weighted sums)
3. Higher attributes → better outcomes (attribute impact verified)
4. Tactical settings produce observable differences
5. Edge cases handled (extreme disparities, unavailable players, etc.)

**Statistical Validation:**
- Run 100 possessions
- Elite shooter vs poor defender: ~70-80% success (3PT)
- Poor shooter vs elite defender: ~10-20% success (3PT)
- Zone defense: Higher 3PT attempts, lower 3PT success
- Transition: +20% rim success vs halfcourt

## Contact / Issues

This is a specification-driven implementation. All design decisions documented in:
- `basketball_sim.md` - Complete implementation spec
- `CLAUDE.md` - Development guidelines
- `BACKLOG.md` - Deferred features (Milestone 3+)

For questions about implementation, consult the spec or use the PM agent.

---

**Version:** Milestone 1 - COMPLETE
**Last Updated:** 2025-11-04
**Status:** All systems operational, ready for statistical validation
