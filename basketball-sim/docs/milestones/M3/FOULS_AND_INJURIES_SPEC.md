# M3 Systems Specification: Fouls, Injuries, End-Game Logic, and Timeouts

**Version:** 1.0
**Date:** 2025-01-05
**Status:** Draft for Implementation

This document specifies four major systems for M3 (Full 48-minute game simulation):

1. **Fouls & Free Throws System**
2. **Injury System**
3. **End-Game Substitution Logic**
4. **Timeout Strategy System**

All specifications are grounded in NBA rules and statistical patterns observed across thousands of games.

---

## Table of Contents

1. [End-Game Substitution Logic](#1-end-game-substitution-logic)
2. [Timeout Strategy System](#2-timeout-strategy-system)
3. [Fouls & Free Throws System](#3-fouls--free-throws-system)
4. [Injury System](#4-injury-system)
5. [Implementation Plan](#5-implementation-plan)
6. [Validation Suite](#6-validation-suite)

---

## 1. END-GAME SUBSTITUTION LOGIC

### 1.1 Overview

NBA teams manage late-game substitutions based on game competitiveness:
- **Blowout games**: Rest starters to prevent injury and fatigue
- **Close games**: Keep best players on floor regardless of stamina
- **Comeback detection**: Re-insert starters if blowout becomes competitive

### 1.2 Game State Classification

**Score Differential Thresholds:**

```python
BLOWOUT_THRESHOLDS = {
    'Q4_10:00+': 25,  # Early 4th quarter: need 25+ point lead
    'Q4_06:00': 20,   # Under 6 minutes: 20+ point lead
    'Q4_04:00': 18,   # Under 4 minutes: 18+ point lead
    'Q4_02:00': 15,   # Under 2 minutes: 15+ point lead
}

CLOSE_GAME_THRESHOLDS = {
    'Q4_05:00+': 10,  # 5+ minutes left: <10 points = close
    'Q4_03:00': 8,    # Under 3 minutes: <8 points = close
    'Q4_01:00': 5,    # Under 1 minute: <5 points = close
}

GARBAGE_TIME_THRESHOLD = {
    'Q4_02:00': 30,   # 30+ point lead with <2 min = garbage time
}
```

**Game State Categories:**
1. **Blowout (Winning)**: Score differential exceeds BLOWOUT_THRESHOLD
2. **Close Game**: Score differential within CLOSE_GAME_THRESHOLD
3. **Comfortable Lead**: Between close and blowout (7-15 points)
4. **Garbage Time**: Outcome decided, pure rest mode

### 1.3 Substitution Triggers

**Blowout Substitution:**
- Q4, <6 min, +20 points → Bench top 3-4 highest-minute players
- Q4, <4 min, +18 points → Bench top 3-4 highest-minute players
- Q4, <2 min, +15 points → Bench top 3-4 highest-minute players
- Q4, <2 min, +30 points → **Garbage time**: Bench all 5 starters

**Close Game Insertion:**
- Q4, <5 min, ±10 points → Keep closers on floor
- Q4, <3 min, ±8 points → Keep closers on floor
- Q4, <2 min, ±5 points → Insert closers if benched, override stamina thresholds

**Comeback Detection:**
- Lead shrinks by 10+ points → Re-insert starters immediately
- Lead drops below blowout threshold → Re-insert starters

### 1.4 Player Selection

**Blowout Bench Candidates:**
1. Players with highest minutes played (fatigue prevention)
2. Players marked as "starters" in tactical settings
3. Keep 1-2 regular rotation players for continuity

**Blowout Substitutes:**
1. End-of-bench players (lowest minutes)
2. Maintain position balance
3. Youngest players (development opportunity)

**Closers** (user-configurable):
- Top 5 players by attribute composite or minutes allocation
- Stay in game during close situations even if stamina < 60 (minimum 50)

### 1.5 Integration with M2 Substitution System

**Override Priority:**
1. **Injury** (immediate, forced)
2. **Foul out** (immediate, forced)
3. **Stamina critical** (<40, emergency)
4. **Blowout rest** (strategic)
5. **Close game insert** (strategic)
6. **Stamina low** (<60, normal)
7. **Minutes allocation** (normal)

**Key Behaviors:**
- Close games **override stamina thresholds**: Closers play with stamina 50-60
- Blowout subs **override minutes allocation**: Starters benched early
- Comeback detection **triggers immediate substitution**

### 1.6 Validation Criteria

**Blowout Games (20+ differential in Q4):**
- Starters average 28-32 minutes (vs normal 32-36)
- Bench players average 8-12 minutes (vs normal 4-6)
- Leading scorer benched in final 4 minutes

**Close Games (<5 points in final 2 min):**
- Top 5 players on court
- Stamina threshold relaxed to 50
- Rare substitutions in final 1 minute

**Garbage Time (30+ differential, <2 min):**
- All starters benched
- End-of-bench players log minutes

---

## 2. TIMEOUT STRATEGY SYSTEM

### 2.1 NBA Timeout Rules

**Allocation per Team:**
- 7 full timeouts (75 seconds each)
- 1 short timeout (20 seconds)
- **Total: 8 timeouts per team per game**

**Usage Restrictions:**
- Max 4 timeouts per quarter
- Max 2 timeouts in final 3 minutes of Q4
- Can advance ball to frontcourt after timeout

**Overtime:**
- +2 timeouts per OT period

### 2.2 Momentum-Based Timeouts

**Scoring Run Detection:**

Timeout-worthy run patterns:
- **8-0 run** (standard momentum timeout)
- **10-2 run** (standard momentum timeout)
- **12-0 run** (emergency timeout, always call if available)
- **7-0 run in final 5 minutes** (late-game urgency)

**Timeout Decision Logic:**

```python
def should_call_momentum_timeout(
    timeouts_remaining: int,
    quarter: int,
    time_remaining_seconds: int,
    scoring_run: tuple[int, int],  # (opponent_points, own_points)
    currently_losing: bool
) -> bool:
    # Emergency run (12-0) → always call
    if scoring_run[0] >= 12:
        return True

    # Q4 end-game: preserve timeouts (save 1-2)
    if quarter == 4 and time_remaining_seconds <= 180:
        if scoring_run[0] >= 10 and timeouts_remaining >= 2:
            return True
        return False

    # Standard 8-0 or 10-2 run
    if scoring_run == (8, 0) or scoring_run[0] >= 10:
        if currently_losing and timeouts_remaining >= 3:
            return True
        elif timeouts_remaining >= 4:
            return True

    return False
```

### 2.3 Substitution-Window Timeouts

**Triggers:**
- 3+ players below stamina 55 (critical mass fatigue)
- Star player at stamina 45 (emergency rest)
- No natural dead ball in 90+ seconds (unusual)

**Logic:**
- Only call if timeouts remaining >= 3 (preserve end-game timeouts)
- Only in Q1-Q3 (Q4 is different due to end-game strategy)

### 2.4 End-Game Timeout Strategy

**Common Patterns:**

1. **Down 3, <30 seconds** → Timeout to draw up 3PT play
2. **After opponent score in final minute** → Timeout to advance ball (save time)
3. **Down 1-2, <10 seconds** → Timeout for last possession setup
4. **Opponent has ball, <5 seconds, losing** → Timeout to prevent clock runout

**Timeout Hoarding:**

Timeouts become exponentially more valuable as Q4 progresses:
- Q4, >5 min: Value = 0.4 (medium value)
- Q4, 3-5 min: Value = 0.6 (high value)
- Q4, 1-3 min: Value = 0.8 (very high value)
- Q4, <1 min: Value = 1.0 (maximum value)

Teams should save 1-2 timeouts for final 3 minutes of close games.

### 2.5 Timeout Effects

**Stamina Recovery:**
- All players (bench and active) recover +5 stamina during timeout
- Short timeout (20s): +3 stamina
- Full timeout (75s): +5 stamina

**Game Clock:**
- Deduct timeout duration from game clock

**Substitution Window:**
- Allow free substitutions during timeout (no dead ball required)

**Momentum Reset:**
- Clear scoring run tracker after timeout

### 2.6 User Control (TacticalSettings)

**Timeout Strategy Options:**

```python
timeout_strategy = {
    'aggressive': {
        'momentum_threshold': 8,   # Call timeout after 8-0 run
        'save_for_endgame': 2,     # Save 2 timeouts for Q4
    },
    'standard': {
        'momentum_threshold': 10,  # Call timeout after 10-0 run
        'save_for_endgame': 1,     # Save 1 timeout for Q4
    },
    'conservative': {
        'momentum_threshold': 12,  # Only call after 12-0 run
        'save_for_endgame': 3,     # Save 3 timeouts for Q4
    }
}
```

### 2.7 Validation Criteria

**Expected Patterns:**
- Average timeouts used per game: 5-6 per team (10-12 total)
- Timeouts remaining at end of Q4: 1-2 per team
- Timeout distribution: Q1 (0-1), Q2 (1-2), Q3 (0-1), Q4 (3-4)
- 35-40% of timeouts are momentum stops (after scoring runs)
- 30% of timeouts are end-game strategic

**Realism Checks:**
- Teams should NOT use all 8 timeouts every game
- Teams should NOT call timeout when up 20+ with 1 minute left
- Teams SHOULD call timeout after 10-0 run in Q4
- Teams SHOULD save 1-2 timeouts for final 2 minutes of close games

---

## 3. FOULS & FREE THROWS SYSTEM

### 3.1 Overview

NBA fouls system includes:
- Personal fouls (6 fouls = foul out)
- Team fouls (bonus at 5 per quarter, double bonus at 10)
- Foul types: shooting, non-shooting, flagrant, technical
- Free throw allocation based on foul type

### 3.2 Foul Types and Probabilities

**Shooting Fouls:**

Trigger: Contested shots (<6 ft) have foul check

```python
# Base rates
SHOOTING_FOUL_BASE_RATES = {
    'contested': 0.08,         # 8% for contested (2-6 ft)
    'heavily_contested': 0.15, # 15% for heavily contested (<2 ft)
    'wide_open': 0.02,         # 2% for wide open (6+ ft, rare)
}

# Attribute weights (defender - inverse, offensive player)
SHOOTING_FOUL_WEIGHTS = {
    'defender': {
        'composure': 0.30,      # Higher = fewer fouls
        'awareness': 0.25,      # Higher = better positioning
        'discipline': 0.20,     # NEW ATTRIBUTE (need to add)
        'agility': 0.15,        # Higher = fewer reach-ins
        'reactions': 0.10,
    },
    'offensive': {
        'bravery': 0.40,        # Drawing contact
        'agility': 0.30,        # Creating contact situations
        'strength': 0.30,       # Finishing through contact
    }
}
```

**Probability Formula:**

```python
P_foul = BaseRate + (BaseRate * AttributeModifier)
where AttributeModifier = (OffenseComposite - DefenseComposite) * 0.01 * k
k = 0.015  # Slightly lower than shooting k (fouls are rarer)
```

**Free Throw Allocation (Shooting Fouls):**
- 2PT shot: 2 free throws
- 3PT shot: 3 free throws
- And-1: If shot made, 1 free throw

**Non-Shooting Fouls:**

Trigger: During drives, post-ups, rebounds, off-ball movement

```python
NON_SHOOTING_FOUL_BASE_RATE = 0.05  # 5% per possession (overall)

# Higher rates during specific actions:
ACTION_FOUL_RATES = {
    'drive': 0.08,          # 8% during drives
    'post_up': 0.06,        # 6% during post-ups
    'rebound': 0.04,        # 4% during rebound battles
    'off_ball': 0.02,       # 2% during off-ball movement
}
```

**Bonus Rules:**
- Team fouls 1-4: Non-shooting fouls = side out (no free throws)
- Team fouls 5-9: Non-shooting fouls = bonus (2 free throws)
- Team fouls 10+: Double bonus (always 2 free throws, no 1-and-1)

**Flagrant/Technical Fouls:**

```python
FLAGRANT_FOUL_RATE = 0.005   # 0.5% per game (very rare)
TECHNICAL_FOUL_RATE = 0.003  # 0.3% per game (very rare)

# Linked to player temperament
TEMPERAMENT_MODIFIER = {
    'high_determination': +0.002,  # More likely to get techs
    'low_composure': +0.003,       # More likely to get flagrants
    'high_bravery': +0.001,        # Slightly more physical
}
```

**Free Throw Allocation:**
- Flagrant: 2 free throws + possession
- Technical: 1 free throw + possession

### 3.3 Free Throw Shooting

**Formula** (from basketball_sim.md Section 4.7):

```python
# BaseRate: 40% (lower than game shooting due to pressure)
FREE_THROW_BASE_RATE = 0.40

# Same attribute weights as 3PT shooting
FREE_THROW_WEIGHTS = {
    'form_technique': 0.25,
    'throw_accuracy': 0.20,
    'finesse': 0.15,
    'hand_eye_coordination': 0.12,
    'balance': 0.10,
    'composure': 0.08,
    'consistency': 0.06,
    'agility': 0.04,
}

# Pressure modifier
PRESSURE_SITUATIONS = {
    'bonus': -0.03,          # Slight pressure (-3%)
    'clutch': -0.05,         # Q4, <2 min, close game (-5%)
    'and_1': +0.05,          # Confidence boost (+5%)
}
```

**Probability Formula:**

```python
FT_Composite = weighted_sum(shooter_attributes, FREE_THROW_WEIGHTS)
Pressure_Modifier = PRESSURE_SITUATIONS.get(situation, 0.0)

P_make = FREE_THROW_BASE_RATE + sigmoid(FT_Composite, k=0.02) + Pressure_Modifier
P_make = clamp(P_make, 0.0, 1.0)
```

**Expected Outcome:**
- NBA average: 75-77% free throw percentage
- Simulator target: 70-80% (acceptable range given attribute variation)

### 3.4 Foul Out and Automatic Substitution

**Foul Out:**
- Player reaches 6 personal fouls → Automatic substitution
- Must be replaced immediately (no option to play without 5 players)

**Substitution Priority:**
- Select best available bench player by position
- If no bench player available, select best player from different position
- **Edge case**: If entire team fouls out (extremely rare), forfeit game

### 3.5 Validation Criteria

**Expected Patterns:**
- Fouls per game: 18-24 per team (NBA average: 20.5)
- Free throw attempts per game: 18-25 per team (NBA average: 22)
- Free throw %: 70-80% (NBA average: 77%)
- Players fouling out: 1-2 per 10 games (rare but happens)
- And-1 opportunities: 8-12% of made shots at rim

---

## 4. INJURY SYSTEM

### 4.1 Overview

Injuries occur based on durability attribute and action intensity:
- **In-game injuries**: Player exits mid-game
- **Multi-game injuries**: Player unavailable for future games (M4+ scope)

### 4.2 Injury Probability

**Base Injury Rate:**

```python
INJURY_RATE_PER_POSSESSION = 0.001  # 0.1% per possession (1 in 1000)

# Higher risk during high-impact actions
HIGH_IMPACT_ACTIONS = {
    'dunk': +0.0005,       # +0.05% additional risk
    'drive': +0.0003,      # +0.03%
    'rebound': +0.0002,    # +0.02%
    'contested_shot': +0.0002,  # +0.02%
}
```

**Durability Impact:**

```python
def calculate_injury_probability(
    base_rate: float,
    durability: int,  # 1-100
    action_type: str
) -> float:
    # Durability modifier
    if durability >= 80:
        durability_mod = 0.5   # -50% injury risk
    elif durability >= 60:
        durability_mod = 0.8   # -20% injury risk
    elif durability >= 40:
        durability_mod = 1.0   # Baseline
    else:  # durability < 40
        durability_mod = 2.0   # +100% injury risk

    # Action modifier
    action_mod = HIGH_IMPACT_ACTIONS.get(action_type, 0.0)

    # Final probability
    P_injury = (base_rate + action_mod) * durability_mod

    return P_injury
```

**Expected Frequency:**
- ~1 injury per 2-3 games (NBA average: ~0.4 injuries per game, includes minor)
- Contact injuries: 60% (during contested actions)
- Non-contact injuries: 40% (fatigue-related, random)

### 4.3 Injury Severity

**Severity Tiers:**

```python
INJURY_SEVERITY_DISTRIBUTION = {
    'minor': 0.70,      # 70%: 1-2 games out
    'moderate': 0.25,   # 25%: 3-7 games out
    'severe': 0.05,     # 5%: 8+ games out
}

INJURY_DURATION = {
    'minor': (1, 2),       # 1-2 games
    'moderate': (3, 7),    # 3-7 games
    'severe': (8, 20),     # 8-20 games
}
```

**In-Game Behavior:**
- When injury occurs, player immediately exits game
- Automatic substitution triggered (same as foul out)
- Injury logged in player history (for M4+ multi-game tracking)

### 4.4 Injury Types

**Contact Injuries** (60%):
- Occur during contested actions (shots, drives, rebounds)
- Slightly higher severity (more moderate/severe injuries)

**Non-Contact Injuries** (40%):
- Fatigue-related (more likely when stamina < 60)
- More common as game progresses (Q4 has 1.5x risk)

```python
def get_fatigue_injury_modifier(
    stamina: float,
    quarter: int
) -> float:
    # Stamina modifier
    if stamina < 50:
        stamina_mod = 2.0   # 2x risk
    elif stamina < 60:
        stamina_mod = 1.5   # 1.5x risk
    else:
        stamina_mod = 1.0

    # Quarter modifier (fatigue accumulates)
    quarter_mod = 1.0 + (quarter - 1) * 0.15  # Q1: 1.0, Q2: 1.15, Q3: 1.3, Q4: 1.45

    return stamina_mod * quarter_mod
```

### 4.5 Edge Cases

**Player Injury During Foul:**
- Foul is still assessed
- Free throws are shot by injured player (unless they cannot continue)
- If player cannot shoot, coach selects replacement shooter (worst FT shooter on court leaves)

**Multiple Injuries:**
- If multiple players injured and bench depleted, team plays with fewer than 5 players (extremely rare)
- Game continues unless team has <3 players (forfeit)

**Injury Recovery** (M4+ scope):
- Multi-game injuries tracked in player history
- Gradual recovery (attributes slightly reduced for 1-2 games after return)

### 4.6 Validation Criteria

**Expected Patterns:**
- Injuries per game: ~0.3-0.5 (roughly 1 injury per 2-3 games)
- Severity distribution: 70% minor, 25% moderate, 5% severe
- High-durability players: 50% fewer injuries than low-durability players
- Q4 injuries: 1.4-1.5x more frequent than Q1 (fatigue factor)

---

## 5. IMPLEMENTATION PLAN

### 5.1 Phase Breakdown

#### Phase 1: Full Game Coordinator (4-5 hours)

**Deliverables:**
- `src/systems/game_simulation.py` - GameSimulator class
- 4-quarter simulation loop
- Halftime integration (stamina recovery, bench rest)
- Quarter-to-quarter state management
- Final box score aggregation
- `tests/test_game_simulation.py`

**Success Criteria:**
- 4 quarters run sequentially
- Stamina resets at halftime
- Score progression accurate
- Box score totals match quarter aggregates

**Polish Items:**
- Fix minutes display bug
- Add blocked shots to box score

---

#### Phase 2a: Fouls & Free Throws (8-10 hours)

**Deliverables:**
- `src/systems/fouls.py` - FoulSystem class
  - Personal foul tracking (6 fouls = foul out)
  - Team foul tracking (bonus at 5, double bonus at 10)
  - Foul types: shooting, non-shooting, flagrant, technical
  - Free throw allocation
- `src/systems/free_throws.py` - FreeThrowShooter class
  - Free throw formula with pressure modifiers
  - And-1 handling
- Integration with possession flow
- `tests/test_fouls.py`, `tests/test_free_throws.py`

**Success Criteria:**
- Personal fouls tracked per player
- Bonus/double bonus states trigger correctly
- Free throw % aligns with NBA average (~75-77%)
- Fouled-out players substituted automatically
- Fouls per game: 18-24 per team

---

#### Phase 2b: End-Game Substitution Logic (3-4 hours)

**Deliverables:**
- Extend `src/systems/substitutions.py` with blowout detection
- Add `check_blowout_substitution()` and `check_close_game_substitution()`
- Implement comeback detection logic
- Add `is_closer` flag to TacticalSettings
- `tests/test_endgame_substitutions.py`

**Success Criteria:**
- Blowouts trigger at correct thresholds (6 min/+20, 4 min/+18, etc.)
- Closers inserted in final 2 minutes of close games
- Comeback detection re-inserts starters
- Blowout games: starters average 28-32 minutes

---

#### Phase 2c: Timeout Strategy System (4-5 hours)

**Deliverables:**
- `src/systems/timeout_manager.py` - TimeoutManager class
- Scoring run detection (8-0, 10-2, 12-0)
- Momentum timeout logic
- Substitution-window timeout logic
- End-game timeout strategy
- Timeout effects (stamina recovery, momentum reset)
- User control via TacticalSettings
- `tests/test_timeout_manager.py`

**Success Criteria:**
- Timeouts allocated correctly (7 full + 1 short)
- Momentum timeouts called after 8-0 runs
- End-game timeouts saved (1-2 remaining in Q4)
- Timeouts per game: 5-6 per team (10-12 total)

---

#### Phase 3: Injury System (6-8 hours)

**Deliverables:**
- `src/systems/injuries.py` - InjuryManager class
  - Durability-based injury checks
  - Injury severity calculation
  - In-game injury handling (player exits)
  - Multi-game injury tracking (for M4+)
- Contact vs non-contact injury mechanics
- Fatigue-injury correlation
- `tests/test_injuries.py`

**Success Criteria:**
- Injuries occur at realistic rates (~1 per 2-3 games)
- Durability impact: high durability = 50% fewer injuries
- Severity distribution: 70% minor, 25% moderate, 5% severe
- Injured players auto-substituted

---

#### Phase 4: Play-by-Play Enhancements (3-4 hours)

**Deliverables:**
- Enhanced turnover descriptions (stolen by X, out of bounds, offensive foul)
- Blocked shot attribution (blocked by X)
- Transition/fast break indicators ("on the fast break")
- Specific violation types (traveling, shot clock, backcourt)
- Foul descriptions ("shooting foul on X, sending Y to the line")
- Timeout descriptions ("Timeout called by Home (reason: momentum)")

**Success Criteria:**
- All 5 lower-priority items addressed
- Play-by-play reads like ESPN game log
- User approves narrative quality

---

#### Phase 5: Full Game Integration & Validation (5-6 hours)

**Deliverables:**
- `demo_full_game.py` - Full 48-minute game demo
- `validate_full_game.py` - Single game validation script
- M3 validation report (NOT 100-game suite, that's M4)
- Updated documentation

**Success Criteria:**
- Full 48-minute game runs without crashes
- Final box score matches NBA structure
- PPP with free throws: 1.05-1.15 (was 1.026 without FTs)
- All systems integrated seamlessly

---

#### Phase 6: Tuning & Statistical Checks (3-4 hours)

**Deliverables:**
- Re-tune base rates if needed (free throws added)
- Run 10-game sample for statistical consistency
- Document remaining known issues for M4

**Validation Gates for M3:**
- [ ] 4-quarter game completes successfully
- [ ] Fouls tracked correctly (6 = foul out)
- [ ] Free throw % 70-82% (NBA range)
- [ ] Injuries occur at realistic rates
- [ ] Timeouts used: 5-6 per team per game
- [ ] End-game substitutions: blowouts rest starters, close games keep closers
- [ ] PPP 1.05-1.15 (with FTs)
- [ ] No crashes or NaN errors

---

### 5.2 Total Estimated Time

| Phase | Hours |
|-------|-------|
| 1 - Full Game Coordinator | 4-5 |
| 2a - Fouls & Free Throws | 8-10 |
| 2b - End-Game Substitutions | 3-4 |
| 2c - Timeout Strategy | 4-5 |
| 3 - Injury System | 6-8 |
| 4 - Play-by-Play Enhancement | 3-4 |
| 5 - Integration & Validation | 5-6 |
| 6 - Tuning & Statistical Checks | 3-4 |

**TOTAL: 36-46 hours**

---

## 6. VALIDATION SUITE

### 6.1 Unit Tests

**End-Game Substitution Tests:**
- `test_blowout_triggers_at_correct_threshold()`
- `test_close_game_insert_closers()`
- `test_comeback_detection()`

**Timeout Tests:**
- `test_momentum_timeout_8_0_run()`
- `test_endgame_timeout_down_3()`
- `test_timeout_allocation_rules()`

**Foul Tests:**
- `test_shooting_foul_probability()`
- `test_bonus_triggers_at_5_fouls()`
- `test_foul_out_automatic_substitution()`

**Injury Tests:**
- `test_injury_probability_with_durability()`
- `test_injury_severity_distribution()`
- `test_fatigue_increases_injury_risk()`

### 6.2 Integration Tests

**100-Game Validation** (M4 scope, but preliminary 10-game check in M3 Phase 6):

```python
def validate_full_game_statistics():
    """Run 10 games and verify all M3 systems produce realistic patterns."""
    results = []

    for _ in range(10):
        game = simulate_full_game(...)

        results.append({
            # Foul stats
            'fouls_per_team': game.total_fouls / 2,
            'foul_outs': game.foul_out_count,
            'ft_percentage': game.ft_made / game.ft_attempted,

            # Timeout stats
            'timeouts_used': game.timeouts_used_per_team,
            'timeouts_remaining': game.timeouts_remaining_per_team,

            # End-game stats
            'blowout_games': game.was_blowout,
            'starters_minutes_blowout': game.starters_avg_minutes if game.was_blowout else None,

            # Injury stats
            'injuries': game.injury_count,
            'injury_severity': game.injury_severities,
        })

    # Validate ranges
    assert 18 <= np.mean([r['fouls_per_team'] for r in results]) <= 24
    assert 0.70 <= np.mean([r['ft_percentage'] for r in results]) <= 0.82
    assert 5 <= np.mean([r['timeouts_used'] for r in results]) <= 6
    # ... etc.
```

---

## 7. NEW ATTRIBUTE: DISCIPLINE

**Required for Foul System:**

The foul system requires a "discipline" attribute to model defenders' ability to avoid committing fouls.

**Attribute Definition:**

```python
DISCIPLINE = {
    'name': 'discipline',
    'category': 'mental',
    'description': 'Ability to avoid committing fouls, stay composed under pressure',
    'scale': 1-100,
    'impact_areas': [
        'Shooting foul probability (inverse: high discipline = fewer fouls)',
        'Non-shooting foul probability (inverse)',
        'Technical foul probability (inverse)',
        'Bonus situation behavior (high discipline = more careful)',
    ]
}
```

**Implementation:**
- Add `discipline` to all player dictionaries (default: 50 for generic players)
- Use in foul probability calculations (high discipline reduces foul probability by up to 30%)

**Validation:**
- High-discipline defenders (80+) should commit 20-30% fewer fouls than low-discipline defenders (40-)

---

## 8. SUMMARY

### 8.1 Key Systems

1. **End-Game Substitutions**: Blowouts rest starters, close games keep closers on floor
2. **Timeout Strategy**: Momentum control (8-0 run), end-game tactics, substitution windows
3. **Fouls & Free Throws**: Personal/team fouls, bonus rules, free throw shooting
4. **Injury System**: Durability-based injuries, severity tiers, in-game exits

### 8.2 Key Thresholds (Quick Reference)

**Blowout Thresholds:**
- 6 min left, +20 → bench starters
- 4 min left, +18 → bench starters
- 2 min left, +15 → bench starters
- 2 min left, +30 → garbage time

**Close Game Thresholds:**
- 5 min left, ±10 → close game
- 3 min left, ±8 → close game
- 1 min left, ±5 → insert closers

**Timeout Triggers:**
- 8-0 run → momentum timeout
- 10-2 run → momentum timeout
- 12-0 run → emergency timeout
- Down 3, <30 sec → end-game timeout

**Foul Rates:**
- Contested shot: 8% shooting foul chance
- Heavily contested: 15% shooting foul chance
- General possession: 5% non-shooting foul chance
- Fouls per game: 18-24 per team

**Injury Rates:**
- Base: 0.1% per possession
- High-impact action: +0.05%
- Low durability (<40): 2x risk
- Expected: ~1 injury per 2-3 games

### 8.3 Integration Points

- **SubstitutionManager**: Add end-game logic
- **TimeoutManager**: New system, checks after every possession
- **FoulSystem**: New system, checks during shots/drives/rebounds
- **InjuryManager**: New system, checks during high-impact actions
- **GameSimulator**: Orchestrates all M3 systems

---

## Files Modified/Created

**New Files:**
- `src/systems/timeout_manager.py`
- `src/systems/fouls.py`
- `src/systems/free_throws.py`
- `src/systems/injuries.py`
- `src/systems/game_simulation.py`
- `tests/test_timeout_manager.py`
- `tests/test_fouls.py`
- `tests/test_free_throws.py`
- `tests/test_injuries.py`
- `tests/test_game_simulation.py`
- `tests/test_endgame_substitutions.py`
- `demo_full_game.py`
- `validate_full_game.py`

**Extended Files:**
- `src/systems/substitutions.py` (end-game logic)
- `src/systems/play_by_play.py` (enhanced descriptions, foul/timeout logging)
- `src/core/data_structures.py` (TimeoutEvent, InjuryEvent, FoulEvent)
- `basketball_sim.md` (add M3 section reference)

---

**Specification Version 1.0 Complete**

This specification is ready for M3 implementation. All systems are grounded in NBA patterns and include validation criteria to ensure realistic simulation outcomes.
