# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **text-based basketball simulator** focused on deep, intricate, realistic simulation of basketball mechanics. The project prioritizes realism and complexity over simplicity or gamification.

## Core Design Pillars (Non-Negotiable)

All code must align with these four pillars:

1. **Deep, Intricate, Realistic Simulation**: Not an arcade game. Every action reflects real basketball complexity.
2. **Weighted Dice-Roll Mechanics**: Probabilistic outcomes based on calculated probabilities, never simple random generation.
3. **Attribute-Driven Outcomes**: All 25 player attributes meaningfully impact gameplay.
4. **Tactical Input System**: User strategy influences outcomes through pace, man/zone defense, scoring options, and minutes allocation.

## Architecture

### Implementation Specification

**Primary Reference:** `basketball_sim.md` - This is the master implementation document containing:
- Complete probability formulas (weighted sigmoid with k=0.02)
- All 25 player attributes with exact weights for every action
- Specific BaseRates for all shot types (3PT: 30%, Layup: 62%, Dunk: 80%, etc.)
- Tactical system modifiers (pace: ±10%/±15%, zone: +3%/-15%/-10%, transition: +20%/+12%/+8%)
- Stamina formulas (cost, recovery, degradation)
- Complete edge case handling

**Always consult this document before implementing any game mechanics.**

### Development Roadmap

- **Milestone 1** (Current): Single possession simulation with full debug output
- **Milestone 2**: Full quarter with stamina tracking
- **Milestone 3**: Full game with injury system
- **Milestone 4**: Validation suite (100 games, statistical analysis)
- **Milestone 5**: Random team generator

### Player Attributes (25 Total)

**Physical (12):** grip_strength, arm_strength, core_strength, agility, acceleration, top_speed, jumping, reactions, stamina, balance, height (normalized 1-100), durability

**Mental (7):** awareness, creativity, determination, bravery, consistency, composure, patience

**Technical (6):** hand_eye_coordination, throw_accuracy, form_technique, finesse, deception, teamwork

### Probability System

All game outcomes use **weighted sigmoid formulas**:
```
P = BaseRate + (1 - BaseRate) * (1 / (1 + exp(-k * AttributeDiff)))
where k = 0.02
```

Never use simple random number generation. All probabilities must be attribute-driven with proper weighting.

### Tactical Systems

**5 Core Inputs:**
1. **Pace**: fast/standard/slow (affects possessions and stamina drain)
2. **Man vs Zone**: 0-100% slider (affects contest rates, turnovers, shot distribution)
3. **Scoring Options**: Priority #1, #2, #3 (affects usage distribution: 30%/20%/15%)
4. **Minutes Allocation**: Must total 240, max 48 per player
5. **Rebounding Strategy**: crash_glass/standard/prevent_transition (affects number of rebounders)

## basketball-sim-pm Agent

**Critical:** Use the `basketball-sim-pm` agent (`.claude/agents/basketball-sim-pm.md`) when:
- Implementing any new game mechanic
- Reviewing completed implementations
- Proposing new features
- Validating alignment with core design pillars

This agent provides brutally honest feedback to ensure all code honors the project vision.

**Usage pattern:**
```
@agent-basketball-sim-pm [describe what you need reviewed]
```

## Implementation Guidelines

### Attribute Integration
Every action must use appropriate attributes with correct weights. Example for 3PT shooting:
- Form Technique: 25%
- Throw Accuracy: 20%
- Finesse: 15%
- Hand-Eye Coordination: 12%
- Balance: 10%
- Composure: 8%
- Consistency: 6%
- Agility: 4%

**All weight tables are in `basketball_sim.md` Section 14.**

### Validation Requirements

All implementations must pass:
1. **Probability sanity checks**: All probabilities in [0,1], no NaN, proper normalization
2. **Attribute impact verification**: Higher attributes → better outcomes
3. **Tactical influence**: Settings produce observable, meaningful differences
4. **Edge case handling**: Extreme disparities, unavailable players, etc.

### Testing Philosophy

**Test-driven development** with:
- Unit tests for probability calculations
- Integration tests for full possessions
- Statistical validation against NBA averages
- Edge case coverage

Target: 100 simulations across 100 randomly generated teams for validation.

## Data Structures

### Player Dict
```python
{
    'name': str,
    'position': str,  # PG, SG, SF, PF, C
    # 25 attributes (all 1-100 scale)
}
```

### PossessionContext
```python
{
    'is_transition': bool,
    'shot_clock': int,
    'score_differential': int,
    'game_time_remaining': int
}
```

### Tactical Settings
```python
{
    'pace': str,
    'man_defense_pct': int,  # 0-100
    'scoring_option_1/2/3': str or None,
    'minutes_allotment': dict,
    'rebounding_strategy': str
}
```

## Key Formulas Quick Reference

**Stamina Degradation:**
- Threshold: 80
- Below 80: `penalty = 0.2 * (80 - current_stamina) ** 1.3`
- Applied to ALL attributes

**Stamina Recovery (exponential):**
- Per minute on bench: `recovery = 8 * (1 - current_stamina / 100)`

**Contest Penalties:**
- Wide Open (6+ ft): 0%
- Contested (2-6 ft): -15%
- Heavily Contested (<2 ft): -25%
- Plus defender modifier: ±5% based on defender composite

**Shot Distribution Baseline:**
- 3PT: 40%, Midrange: 20%, Rim: 40%
- Modified by player attributes (±5%) and tactics (±10%)

## Common Pitfalls to Avoid

1. **Simple Random Generation**: Never use `random()` without attribute weighting
2. **Missing Attributes**: Every action needs appropriate attribute weights from the spec
3. **Ignoring Tactics**: All tactical settings must influence outcomes mechanically
4. **Linear Formulas**: Use sigmoid curves, not linear relationships
5. **Arbitrary Constants**: All values must come from `basketball_sim.md` specification
6. **Shallow Mechanics**: Complexity and realism are features, not bugs

## Development Approach for Milestone 1

**Priority order:**
1. Core data structures + probability engine (3-4 hours)
2. Shooting system (6-8 hours)
3. Possession flow + turnovers (4-5 hours)
4. Rebounding (3-4 hours)
5. Tactical systems (3-4 hours)
6. Integration + validation (3-5 hours)

**Estimated total:** 20-30 hours for experienced Python developer

## Random Seed Control

- **Debug mode**: Always use fixed seed (`random.seed(42)`)
- **Production mode**: No seeding

## Future Extensibility

Architecture must support (but not implement yet):
- Multi-game injury tracking
- Season/franchise modes
- Advanced tactical plays
- Shot clock violations
- Fouls and free throws system

Keep these in mind when designing data structures and APIs.
