# End-Game Clock Management & Intentional Fouling System

**Version:** 1.0
**Date:** 2025-11-13
**Status:** Implementation Specification
**Alignment:** Pillar 4 (Tactical Input System)

This document specifies four critical end-game modes that NBA teams use in real basketball. These systems ensure realistic clock management and strategy during crucial final possessions.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Clock Kill Mode](#2-clock-kill-mode)
3. [Last Second Shot - Tied Game](#3-last-second-shot---tied-game)
4. [Last Second Shot - Losing](#4-last-second-shot---losing)
5. [Intentional Fouling System](#5-intentional-fouling-system)
6. [Integration Strategy](#6-integration-strategy)
7. [Implementation Phases](#7-implementation-phases)
8. [Validation Criteria](#8-validation-criteria)

---

## 1. SYSTEM OVERVIEW

### 1.1 Purpose

NBA end-game strategy involves sophisticated clock management:
- **Winning teams** burn clock to preserve leads
- **Tied teams** hold for last shot to prevent opponent possessions
- **Losing teams** foul intentionally to stop clock and get possession back
- All teams maximize possession value in final seconds

### 1.2 Core Design Principles

1. **Automatic Behavior**: These modes activate automatically based on game state (no user configuration required)
2. **Basketball Logic Priority**: End-game scenarios override normal tactical settings (pace, shot selection)
3. **Realistic Timing**: Shot clock usage and foul timing mirror NBA coaching decisions
4. **Minimal Complexity**: Phase 1 focuses on essential behaviors, Phase 2 adds sophistication

### 1.3 Relationship to Existing Systems

**Integrates with:**
- `PossessionContext` (score_differential, game_time_remaining)
- `FoulSystem` (check_intentional_foul, target selection)
- `TacticalSettings` (overridden during end-game modes)
- `possession.py` (shot clock consumption logic)

**Does NOT require:**
- New user inputs (fully automatic)
- Major refactoring of existing systems
- Changes to core probability engine

---

## 2. CLOCK KILL MODE

### 2.1 Real-World Behavior

When NBA teams have a lead and possession in final 2 minutes:
- **Primary goal**: Burn clock to minimize opponent possessions
- **Shot clock usage**: Use full 24 seconds (or as much time as possible)
- **Shot selection**: Still take good shots, but prioritize clock consumption
- **Risk avoidance**: Avoid turnovers, avoid fast breaks

### 2.2 Trigger Conditions

**PRIMARY TRIGGER:**
```python
score_diff > 0 AND
game_time_remaining < 120 AND  # Under 2 minutes
game_time_remaining > shot_clock AND  # Must have time to burn
offensive_team_has_possession
```

**INTENSITY LEVELS:**

```python
CLOCK_KILL_INTENSITY = {
    'aggressive': {
        'score_diff': 1,  # Any lead
        'time_threshold': 30,  # Final 30 seconds
        'shot_clock_target': 3,  # Shoot at 3 seconds
    },
    'standard': {
        'score_diff': 3,  # 1-possession lead (3 points)
        'time_threshold': 90,  # Final 90 seconds
        'shot_clock_target': 5,  # Shoot at 5 seconds
    },
    'conservative': {
        'score_diff': 7,  # 2-possession lead (7 points)
        'time_threshold': 120,  # Final 2 minutes
        'shot_clock_target': 8,  # Shoot at 8 seconds
    }
}
```

**SELECTION LOGIC:**
- Use most aggressive mode that applies
- Example: Up 1 with 25 seconds left → aggressive (shoot at 3 seconds)
- Example: Up 5 with 100 seconds left → standard (shoot at 5 seconds)

### 2.3 Shot Clock Consumption Logic

**FORMULA:**
```python
if clock_kill_active:
    target_shot_clock = INTENSITY['shot_clock_target']

    # Edge case: game time < shot clock + target
    # Shoot with target seconds left on GAME clock, not shot clock
    if game_time_remaining < (shot_clock + target_shot_clock):
        time_to_burn = game_time_remaining - target_shot_clock
    else:
        time_to_burn = shot_clock - target_shot_clock

    # Burn time, then attempt shot
    shot_clock_remaining = max(0, shot_clock - time_to_burn)
```

**EXAMPLES:**

*Example 1: Normal clock kill*
- Game time: 60 seconds
- Shot clock: 24 seconds
- Lead: 3 points (standard mode)
- **Action**: Burn 19 seconds, shoot at 5 seconds shot clock
- **Result**: Game time = 41 seconds after possession ends

*Example 2: Final possession*
- Game time: 30 seconds
- Shot clock: 24 seconds
- Lead: 1 point (aggressive mode)
- **Action**: Burn 27 seconds, shoot at 3 seconds GAME clock
- **Result**: Game ends before opponent can respond

*Example 3: Edge case*
- Game time: 20 seconds
- Shot clock: 24 seconds (reset after OREB)
- Lead: 1 point (aggressive mode)
- **Action**: Burn 17 seconds, shoot at 3 seconds game clock
- **Result**: Opponent gets 3 seconds if miss (negligible)

### 2.4 Shot Selection Modifications

**NO CHANGES to shot probability** (still attribute-driven)

**SLIGHT CHANGES to shot distribution:**
```python
if clock_kill_active:
    # Slightly favor safer shots
    shot_distribution_modifiers = {
        '3pt': -0.05,  # -5% to 3PT attempts (riskier)
        'midrange': 0.00,  # No change
        'rim': +0.05,  # +5% to rim attempts (safer, higher %)
    }
```

**REASONING:**
- Shot quality still matters (we don't want turnovers or bad misses)
- Clock consumption is PRIMARY goal, shot selection is SECONDARY
- This is realistic: NBA teams take slightly safer shots when protecting leads

### 2.5 Turnover Risk Reduction

**MODIFIER:**
```python
if clock_kill_active:
    base_turnover_rate *= 0.90  # -10% turnover rate
```

**REASONING:**
- Teams are MORE careful with ball (slower pace, less risk)
- Aligns with real NBA behavior (fewer turnovers in final 2 minutes when leading)

---

## 3. LAST SECOND SHOT - TIED GAME

### 3.1 Real-World Behavior

When game is tied with <24 seconds left:
- **Goal**: Hold for last shot to avoid giving opponent a possession
- **Timing**: Shoot with 2-4 seconds left (enough time for tip-in, not enough for opponent possession)
- **Shot selection**: Best player isolation, clear spacing, no rushed shots

### 3.2 Trigger Conditions

```python
score_diff == 0 AND
game_time_remaining <= 24 AND
offensive_team_has_possession AND
quarter == 4  # Only in regulation (OT uses same logic)
```

### 3.3 Shot Clock Consumption Logic

**FORMULA:**
```python
if last_second_shot_tied_active:
    ideal_shot_time = 3  # Shoot with 3 seconds left on game clock

    # Calculate how much time to burn
    time_to_burn = game_time_remaining - ideal_shot_time

    # Consume shot clock accordingly
    shot_clock_remaining = max(0, shot_clock - time_to_burn)
```

**EXAMPLES:**

*Example 1: Full possession*
- Game time: 24 seconds
- Shot clock: 24 seconds
- Score: Tied
- **Action**: Burn 21 seconds, shoot at 3 seconds game clock
- **Result**: Opponent has 3 seconds if miss (very difficult to score)

*Example 2: Short possession (OREB)*
- Game time: 18 seconds
- Shot clock: 14 seconds (reset after OREB)
- Score: Tied
- **Action**: Burn 14 seconds (full shot clock), shoot at 4 seconds game clock
- **Result**: Shot clock violation avoided, opponent has 4 seconds

*Example 3: Very short clock*
- Game time: 10 seconds
- Shot clock: 10 seconds
- Score: Tied
- **Action**: Burn 7 seconds, shoot at 3 seconds game clock
- **Result**: Standard last-second shot timing

### 3.4 Shot Selection Modifications

**PRIORITY SYSTEM:**
```python
if last_second_shot_tied_active:
    # Force shot to scoring option #1 (if available)
    if scoring_option_1 is not None and stamina > 40:
        shooter = scoring_option_1
        usage_boost = 0.50  # 50% boost to usage
    elif scoring_option_2 is not None and stamina > 40:
        shooter = scoring_option_2
        usage_boost = 0.30  # 30% boost
    else:
        # Use best available player (highest offensive composite)
        shooter = max(active_players, key=lambda p: calculate_offensive_composite(p))
        usage_boost = 0.20
```

**REASONING:**
- NBA teams draw up plays for their best players in these situations
- This is a TACTICAL override (user strategy matters via scoring options)
- Still uses attribute-driven probabilities (no fake sliders)

---

## 4. LAST SECOND SHOT - LOSING

### 4.1 Real-World Behavior

When trailing with <24 seconds left:
- **Goal**: Hold for last shot to maximize chance of tying/winning
- **Timing**: Shoot with 2-5 seconds left (enough time for OREB, not enough for opponent to build lead)
- **Shot selection**: Best shot possible (3PT if down 3+, any shot if down 1-2)
- **Risk tolerance**: Higher than tied game (trailing = desperate)

### 4.2 Trigger Conditions

```python
score_diff < 0 AND  # Trailing
game_time_remaining <= 24 AND
offensive_team_has_possession AND
quarter == 4
```

### 4.3 Shot Clock Consumption Logic

**FORMULA:**
```python
if last_second_shot_losing_active:
    # More aggressive timing than tied game (need points desperately)
    ideal_shot_time = 4  # Shoot with 4 seconds left (allows for OREB attempt)

    time_to_burn = game_time_remaining - ideal_shot_time
    shot_clock_remaining = max(0, shot_clock - time_to_burn)
```

**EXAMPLES:**

*Example 1: Down 2, full possession*
- Game time: 24 seconds
- Shot clock: 24 seconds
- Score: Down 2
- **Action**: Burn 20 seconds, shoot at 4 seconds game clock
- **Result**: If miss and OREB, still have 2-3 seconds for tip-in

*Example 2: Down 3, short clock*
- Game time: 15 seconds
- Shot clock: 14 seconds
- Score: Down 3
- **Action**: Burn 11 seconds, shoot 3PT at 4 seconds game clock
- **Result**: If miss and OREB, can attempt another 3PT

### 4.4 Shot Selection Modifications

**PRIORITY SYSTEM (accounts for deficit):**
```python
if last_second_shot_losing_active:
    if score_diff <= -3:
        # MUST attempt 3PT (need 3 to tie)
        force_shot_type = '3pt'
        shooter = best_3pt_shooter_available()
    elif score_diff <= -2:
        # Prefer 3PT, but any shot works
        shot_distribution_modifiers = {
            '3pt': +0.20,  # +20% to 3PT attempts
            'rim': +0.05,  # +5% to rim (high %)
            'midrange': -0.25,  # -25% to midrange (inefficient)
        }
        shooter = scoring_option_1 or best_shooter_available()
    else:  # Down 1
        # Any shot works, prioritize highest %
        shooter = scoring_option_1 or best_scorer_available()
```

**REASONING:**
- Down 3+ = MUST shoot 3PT (mathematical requirement)
- Down 2 = prefer 3PT (can win instead of tie)
- Down 1 = any shot works (tie game with 2PT, win with 3PT)
- This is realistic NBA behavior (e.g., Ray Allen 2013 Finals)

---

## 5. INTENTIONAL FOULING SYSTEM

### 5.1 Real-World Behavior

When NBA teams are trailing with <60 seconds left:
- **Goal**: Stop clock by fouling opponent (non-shooting foul)
- **Trade-off**: Opponent gets 2 free throws, but offense gets possession back quickly
- **Timing**: Foul immediately after opponent inbounds (before shot attempt)
- **Strategy**: Foul worst FT shooter, avoid 3-point plays

### 5.2 Trigger Conditions

**PRIMARY TRIGGER:**
```python
score_diff < 0 AND  # Trailing
game_time_remaining < 60 AND  # Final 60 seconds
opponent_has_possession AND
intentional_foul_makes_sense()
```

**INTENTIONAL FOUL DECISION FUNCTION:**
```python
def intentional_foul_makes_sense(
    score_diff: int,
    game_time: int,
    team_fouls: int,
    opponent_in_bonus: bool
) -> bool:
    """
    Determine if intentional fouling is strategically sound.

    Decision Matrix (based on NBA analytics):
    - Down 1-2 with <30 seconds: NO (just defend, need stop)
    - Down 3-8 with <60 seconds: YES (need possessions)
    - Down 9+ with <60 seconds: NO (game over, conserve energy)
    - Opponent in bonus: YES (already giving FTs, might as well stop clock)
    - Opponent not in bonus: DEPENDS (weigh benefit vs giving bonus)
    """

    # Scenario 1: Down 3-8 points, <60 seconds (CLASSIC FOUL SITUATION)
    if -8 <= score_diff <= -3 and game_time < 60:
        return True

    # Scenario 2: Down 1-2, <30 seconds (TOO CLOSE, just defend)
    if score_diff >= -2 and game_time < 30:
        return False  # One stop wins game

    # Scenario 3: Down 9+, <60 seconds (GAME OVER)
    if score_diff <= -9 and game_time < 60:
        return False  # Need 3+ possessions, not realistic

    # Scenario 4: Down 3-8, 30-60 seconds (DEPENDS ON BONUS)
    if -8 <= score_diff <= -3 and 30 < game_time < 60:
        if opponent_in_bonus:
            return True  # Already giving FTs, stop clock
        else:
            return False  # Don't put opponent in bonus yet

    return False
```

### 5.3 Foul Execution Logic

**WHEN TO FOUL (within possession):**
```python
if intentional_foul_active:
    # Foul IMMEDIATELY after inbound (before shot attempt)
    # NBA teams foul within 3-5 seconds of possession start
    foul_timing = random.uniform(2.0, 4.0)  # 2-4 seconds into possession

    # Check if shot attempt happened before foul window
    if possession_time < foul_timing:
        # Intentional foul occurs
        execute_intentional_foul()
    else:
        # Shot attempt happened too quickly, defend normally
        pass
```

**WHO FOULS:**
```python
def select_fouling_player(defensive_team: List[Dict]) -> Dict:
    """
    Select which player commits intentional foul.

    Priority:
    1. Player with fewest personal fouls (avoid foul-out)
    2. Bench player if possible (save starters)
    3. NOT a player with 5 fouls (would foul out)
    """

    available_foulers = [p for p in defensive_team if personal_fouls[p['name']] < 5]

    if not available_foulers:
        # Emergency: all players have 5 fouls (extremely rare)
        # Foul with starter who has highest stamina
        return max(defensive_team, key=lambda p: p['current_stamina'])

    # Select player with fewest fouls
    return min(available_foulers, key=lambda p: personal_fouls[p['name']])
```

**WHO TO FOUL (target selection):**
```python
def select_foul_target(offensive_team: List[Dict]) -> Dict:
    """
    Select which opponent to foul (worst FT shooter).

    NBA teams scout opponent FT% and target worst shooter.
    We approximate FT skill using attribute composite.
    """

    # Calculate FT composite for each player
    # (uses same weights as free_throws.py)
    ft_composites = {}
    for player in offensive_team:
        ft_composites[player['name']] = calculate_ft_composite(player)

    # Target player with LOWEST FT composite
    worst_ft_shooter = min(offensive_team, key=lambda p: ft_composites[p['name']])

    return worst_ft_shooter
```

### 5.4 Foul Type and Free Throws

**FOUL TYPE:**
- **Non-shooting foul** (intentional holding/grabbing away from ball)
- **NOT a shooting foul** (teams foul before shot attempt)
- **Flagrant foul**: 0.1% chance (intentional fouls are obvious, refs watch closely)

**FREE THROWS AWARDED:**
```python
if opponent_in_bonus:
    free_throws = 2  # Bonus = 2 FT
else:
    free_throws = 0  # No FT, side out
    team_fouls += 1

    # If this puts team in bonus (5 fouls)
    if team_fouls >= 5:
        opponent_in_bonus = True
```

### 5.5 Post-Foul Possession Logic

**AFTER FREE THROWS:**
```python
# Trailing team gets possession back (SIDE OUT)
possession = trailing_team

# Shot clock resets to 24 (full possession)
shot_clock = 24

# Game clock advances by ~4 seconds (FT routine)
game_time_remaining -= 4
```

**FOUL LOOP PREVENTION:**
- After trailing team scores, leading team may get fouled again
- This creates "foul cycle" (realistic in final 30 seconds)
- Limit: Max 3 consecutive intentional fouls per team (prevent infinite loop)

### 5.6 Strategic Depth (Phase 2 - Optional)

**ADVANCED FEATURES (implement later):**
1. **Target switching**: If worst FT shooter is subbed out, re-evaluate target
2. **Foul timing variance**: Foul at 3-5 seconds (not exactly 3 every time)
3. **Foul prevention subs**: Leading team subs in best FT shooters when trailing team fouls
4. **Take foul**: Foul on inbound to prevent fast break (different from intentional foul)
5. **Hail mary defense**: If down 3 with <5 seconds, defend 3PT line heavily

---

## 6. INTEGRATION STRATEGY

### 6.1 Where to Integrate

**PRIMARY INTEGRATION POINT: `possession.py`**

```python
def simulate_possession(
    offensive_team: List[Dict],
    defensive_team: List[Dict],
    tactical_offense: TacticalSettings,
    tactical_defense: TacticalSettings,
    possession_context: PossessionContext,
    foul_system: FoulSystem = None,
    **kwargs
) -> PossessionResult:
    """
    Main possession simulation (M1 system).

    NEW: Check for end-game modes before normal possession flow.
    """

    # ===== NEW: END-GAME MODE DETECTION =====
    end_game_mode = detect_end_game_mode(
        possession_context.score_differential,
        possession_context.game_time_remaining,
        possession_context.shot_clock,
        quarter=possession_context.quarter
    )

    # ===== MODE 1: INTENTIONAL FOUL =====
    if end_game_mode == 'intentional_foul':
        # Defensive team fouls immediately
        foul_result = execute_intentional_foul(
            defensive_team=defensive_team,
            offensive_team=offensive_team,
            foul_system=foul_system,
            possession_context=possession_context
        )
        return foul_result  # Possession ends with foul

    # ===== MODE 2: CLOCK KILL =====
    if end_game_mode == 'clock_kill':
        # Modify shot clock consumption
        modified_shot_clock = apply_clock_kill_logic(
            possession_context.shot_clock,
            possession_context.game_time_remaining,
            possession_context.score_differential
        )
        possession_context.shot_clock = modified_shot_clock

        # Apply slight shot distribution changes
        shot_distribution = modify_shot_distribution_clock_kill(
            base_distribution
        )

    # ===== MODE 3: LAST SECOND SHOT (TIED) =====
    if end_game_mode == 'last_second_tied':
        # Modify shot clock consumption
        modified_shot_clock = apply_last_second_logic(
            possession_context.shot_clock,
            possession_context.game_time_remaining,
            target_time=3
        )
        possession_context.shot_clock = modified_shot_clock

        # Force usage to scoring option #1
        forced_shooter = tactical_offense.scoring_option_1

    # ===== MODE 4: LAST SECOND SHOT (LOSING) =====
    if end_game_mode == 'last_second_losing':
        # Similar to tied, but more aggressive
        modified_shot_clock = apply_last_second_logic(
            possession_context.shot_clock,
            possession_context.game_time_remaining,
            target_time=4
        )
        possession_context.shot_clock = modified_shot_clock

        # Force 3PT if down 3+
        if possession_context.score_differential <= -3:
            force_shot_type = '3pt'

    # ===== NORMAL POSSESSION FLOW =====
    # (All existing M1 logic unchanged)
    ...
```

### 6.2 New Data Structures

**Add to `PossessionContext`:**
```python
@dataclass
class PossessionContext:
    is_transition: bool = False
    shot_clock: int = 24
    score_differential: int = 0
    game_time_remaining: int = 2880

    # NEW FIELDS (M3.5):
    quarter: int = 1  # Track which quarter (for end-game logic)
    intentional_foul_count: int = 0  # Prevent infinite foul loops
```

**New Function Module: `end_game_modes.py`**
```python
# src/systems/end_game_modes.py

def detect_end_game_mode(
    score_diff: int,
    game_time: int,
    shot_clock: int,
    quarter: int
) -> Optional[str]:
    """
    Detect which end-game mode is active (if any).

    Returns:
        'clock_kill', 'last_second_tied', 'last_second_losing',
        'intentional_foul', or None
    """
    ...

def apply_clock_kill_logic(...) -> int:
    """Calculate modified shot clock for clock kill mode."""
    ...

def apply_last_second_logic(...) -> int:
    """Calculate modified shot clock for last second shot."""
    ...

def execute_intentional_foul(...) -> PossessionResult:
    """Execute intentional foul sequence."""
    ...
```

### 6.3 Integration with Existing Systems

**DOES NOT AFFECT:**
- Probability engine (still attribute-driven)
- Shooting system (probabilities unchanged)
- Stamina system (no modifications)
- Substitution system (no conflicts)

**MINIMAL CHANGES TO:**
- `possession.py`: Add mode detection at start
- `PossessionContext`: Add 2 new fields (quarter, intentional_foul_count)
- `FoulSystem`: Add intentional_foul flag to distinguish from normal fouls

**NEW MODULE:**
- `end_game_modes.py`: All logic isolated here (100-200 lines)

---

## 7. IMPLEMENTATION PHASES

### 7.1 Phase 1 (Must-Have - 4-6 hours)

**Goal**: Core end-game behaviors that dramatically improve realism

**Deliverables:**

1. **Clock Kill Mode** (2 hours)
   - Trigger detection
   - Shot clock consumption logic
   - Basic shot distribution modifier
   - Validation: 20 test games with close scores, verify clock usage

2. **Last Second Shot - Tied** (1 hour)
   - Trigger detection
   - Shot clock consumption logic
   - Force usage to scoring option #1
   - Validation: 10 test games with tied score <24 seconds

3. **Last Second Shot - Losing** (1 hour)
   - Trigger detection (similar to tied)
   - Force 3PT if down 3+
   - Shot clock consumption logic
   - Validation: 10 test games with deficit <24 seconds

4. **Integration** (1 hour)
   - Add `end_game_modes.py` module
   - Modify `possession.py` to detect modes
   - Add fields to `PossessionContext`
   - Validation: Full game simulation with all modes

### 7.2 Phase 2 (Nice-to-Have - 3-4 hours)

**Goal**: Intentional fouling system (complex, lower priority)

**Deliverables:**

1. **Intentional Foul Detection** (1.5 hours)
   - Implement `intentional_foul_makes_sense()` decision logic
   - Add foul loop prevention (max 3 consecutive)
   - Validation: 10 games with trailing scenarios

2. **Foul Execution** (1.5 hours)
   - Integrate with `FoulSystem`
   - Target selection (worst FT shooter)
   - Fouler selection (fewest fouls, bench priority)
   - Possession flow after foul
   - Validation: Full game with multiple intentional fouls

3. **Strategic Depth** (1 hour - Optional)
   - Foul timing variance
   - Target switching on substitutions
   - Hail mary defense (down 3, final seconds)

### 7.3 Recommended Approach

**START WITH PHASE 1 (Clock Kill + Last Second Shot)**

**REASONING:**
1. **Simpler to implement** (no FoulSystem integration)
2. **Higher impact** (every close game uses these modes)
3. **Lower risk** (no complex decision trees)
4. **Easier to validate** (just check clock consumption)

**Phase 2 can wait** because:
- Intentional fouling is less frequent (only final 60 seconds when down 3-8)
- Requires complex integration with FoulSystem
- Harder to validate (need perfect FT shooter targeting)
- User may not notice its absence (clock management is more visible)

**SUGGESTED ORDER:**
1. Clock Kill Mode (2 hours) - IMMEDIATE IMPACT
2. Last Second Shot - Tied (1 hour) - HIGH VALUE
3. Last Second Shot - Losing (1 hour) - HIGH VALUE
4. Integration + Validation (1 hour)
5. **STOP HERE** (Phase 1 complete)
6. User review: "Do we need intentional fouling?"
7. If yes → Implement Phase 2 (3-4 hours)

---

## 8. VALIDATION CRITERIA

### 8.1 Clock Kill Mode Validation

**Test Scenario:**
- Simulate 50 games
- Force Q4 scenarios: Up 3 with 90 seconds left
- Verify: Shot clock consumed to 5 seconds (standard mode)

**Success Criteria:**
- Average shot clock at shot attempt: 4-6 seconds (not 12-15 like normal)
- 0% shot clock violations (must avoid violation)
- Turnover rate: 10-15% lower than normal possessions
- Opponent possessions after clock kill: <2 (minimal time left)

### 8.2 Last Second Shot - Tied Validation

**Test Scenario:**
- Simulate 50 games
- Force Q4 tied game with 24 seconds left
- Verify: Shot taken at 2-4 seconds game clock

**Success Criteria:**
- Average shot timing: 3.0 seconds ± 1.0 second
- Scorer: 60%+ should be scoring_option_1 (if set)
- Opponent possessions after miss: 0-1 (minimal time)
- No shot clock violations

### 8.3 Last Second Shot - Losing Validation

**Test Scenario:**
- Simulate 50 games
- Force Q4 down 3 with 24 seconds left
- Verify: 3PT attempt at 3-5 seconds game clock

**Success Criteria:**
- Shot type: 90%+ should be 3PT (when down 3+)
- Shot timing: 4.0 seconds ± 1.5 seconds
- Best 3PT shooter takes shot 60%+ of time
- No shot clock violations

### 8.4 Intentional Foul Validation (Phase 2)

**Test Scenario:**
- Simulate 100 games
- Force Q4 scenarios: Down 5 with 45 seconds left
- Verify: Intentional foul occurs within 4 seconds of opponent possession

**Success Criteria:**
- Foul rate: 80%+ in eligible scenarios (down 3-8, <60 sec)
- Foul target: Worst FT shooter 70%+ of time
- Foul type: Non-shooting foul 95%+ of time
- Foul loop: Max 3 consecutive fouls (no infinite loops)
- Possession return: Trailing team gets ball after FT

### 8.5 Realism Validation

**NBA Benchmark (from real games):**
- Close games (final 2 min, ±5 points): 85% use clock kill mode
- Tied games (final 24 sec): 95% hold for last shot
- Trailing by 3-8 (final 60 sec): 70% intentionally foul

**Simulator Target:**
- Mode activation rate: Match NBA benchmarks ±10%
- Clock consumption: Within 2 seconds of optimal strategy
- Shot selection: >60% force to best player (last second shots)

---

## 9. TACTICAL OVERRIDE RULES

### 9.1 End-Game Modes Override User Settings

**OVERRIDE PRIORITY (highest to lowest):**
1. **Intentional Foul** (defensive strategy)
2. **Last Second Shot** (offensive strategy)
3. **Clock Kill Mode** (offensive strategy)
4. **User Tactical Settings** (pace, scoring options, etc.)

**WHAT GETS OVERRIDDEN:**

```python
# Clock Kill Mode overrides:
- pace (always slow, regardless of user setting)
- shot_clock_usage (burn clock, not fast-paced shots)
- turnover_risk (reduced, more careful)

# Last Second Shot overrides:
- scoring_options (force to option #1)
- shot_distribution (force 3PT if down 3+)
- shot_clock_usage (burn to 3-4 seconds)

# Intentional Foul overrides:
- defensive_strategy (foul immediately, ignore contest logic)
- player_selection (foul with bench player if possible)
```

### 9.2 User Control (Minimal for Realism)

**NO USER CONTROL (automatic):**
- Clock Kill Mode activation (basketball logic dictates)
- Last Second Shot timing (basketball logic dictates)
- Intentional Foul decision (basketball logic dictates)

**USER CONTROL (indirect):**
- Scoring options: Used to select last-second shooter
- Closers: Used to select who stays on court in close games
- Timeout strategy: Can stop clock instead of fouling (existing system)

**REASONING:**
- End-game clock management is UNIVERSAL in NBA (not team-specific)
- No coach would burn clock when trailing (illogical)
- No coach would rush shot when tied (illogical)
- User strategy matters via scoring options (WHO takes shot), not WHETHER to use clock kill

---

## 10. EDGE CASES AND SPECIAL SCENARIOS

### 10.1 Offensive Rebound During Clock Kill

**Scenario:**
- Clock kill active (up 3, 60 seconds left)
- Shot misses, offensive rebound
- Shot clock resets to 14 seconds

**BEHAVIOR:**
```python
if clock_kill_active and offensive_rebound:
    # Re-evaluate clock kill intensity
    new_intensity = determine_clock_kill_intensity(
        score_diff=score_diff,
        game_time=game_time_remaining,  # Now ~50 seconds
        shot_clock=14  # Reset
    )

    # Continue burning clock with new shot clock
    time_to_burn = calculate_time_to_burn(new_intensity, shot_clock=14)
```

**RESULT**: Continue clock kill strategy with 14-second shot clock

### 10.2 Turnover During Last Second Shot

**Scenario:**
- Last second shot active (tied, 15 seconds left)
- Offensive team turns ball over at 10 seconds

**BEHAVIOR:**
```python
if last_second_shot_active and turnover:
    # Opponent now has possession with 10 seconds
    # Opponent enters last_second_tied mode (same as original team)
    opponent_mode = 'last_second_tied'

    # Opponent holds for last shot
    time_to_burn = 10 - 3  # Shoot at 3 seconds
```

**RESULT**: Whichever team has possession in final 24 seconds uses last-second strategy

### 10.3 Intentional Foul Infinite Loop Prevention

**Scenario:**
- Trailing team fouls (game time: 50 sec)
- Leading team makes both FTs (game time: 46 sec)
- Trailing team fouls again (game time: 42 sec)
- Leading team makes both FTs (game time: 38 sec)
- Trailing team fouls AGAIN... (potential infinite loop)

**BEHAVIOR:**
```python
# Track consecutive intentional fouls
if intentional_foul_count >= 3:
    # Stop fouling, play normal defense
    intentional_foul_active = False

# Reset count when trailing team scores
if trailing_team_scores:
    intentional_foul_count = 0
```

**RESULT**: Max 3 consecutive fouls (realistic NBA behavior)

### 10.4 Shot Clock Violation Prevention

**Scenario:**
- Clock kill active (up 5, 35 seconds left)
- Shot clock: 24 seconds
- Target: Shoot at 5 seconds shot clock
- Time to burn: 19 seconds

**EDGE CASE**: What if player hesitates and shot clock runs to 0?

**BEHAVIOR:**
```python
def calculate_shot_clock_with_buffer(
    shot_clock: int,
    target_shot_clock: int
) -> int:
    """
    Add 1-2 second buffer to prevent violations.

    NBA players NEVER intentionally violate shot clock.
    Add buffer to account for human reaction time.
    """
    buffer = 1  # 1 second safety buffer
    time_to_burn = shot_clock - target_shot_clock - buffer

    return max(0, time_to_burn)
```

**RESULT**: Shoot at 6 seconds instead of 5 (0% violation rate)

### 10.5 Tied Game, Under 24 Seconds, Defensive Rebound

**Scenario:**
- Game tied, 20 seconds left
- Opponent misses shot
- Defensive team rebounds at 15 seconds

**BEHAVIOR:**
```python
if score_diff == 0 and game_time_remaining < 24:
    # Rebounding team now on offense
    # Enter last_second_tied mode
    mode = 'last_second_tied'
    target_shot_time = 3

    # Hold for last shot (burn 12 seconds)
    time_to_burn = 15 - 3
```

**RESULT**: Whichever team gets possession in final 24 seconds (tied) holds for last shot

---

## 11. IMPLEMENTATION SUMMARY

### 11.1 File Structure

```
src/systems/
  ├── end_game_modes.py (NEW - 200 lines)
  │   ├── detect_end_game_mode()
  │   ├── apply_clock_kill_logic()
  │   ├── apply_last_second_logic()
  │   ├── execute_intentional_foul() [Phase 2]
  │   ├── intentional_foul_makes_sense() [Phase 2]
  │   ├── select_foul_target() [Phase 2]
  │   └── select_fouling_player() [Phase 2]
  │
  ├── possession.py (MODIFY - add 10 lines)
  │   └── Check end_game_mode at start of simulate_possession()
  │
  └── fouls.py (MODIFY - add 1 flag) [Phase 2 only]
      └── Add is_intentional flag to FoulEvent
```

### 11.2 Lines of Code Estimate

**Phase 1 (Clock Kill + Last Second Shot):**
- `end_game_modes.py`: 150 lines
- Modifications to `possession.py`: 10 lines
- Modifications to `PossessionContext`: 2 lines
- Tests: 100 lines
- **Total: ~260 lines**

**Phase 2 (Intentional Fouling):**
- Additional in `end_game_modes.py`: 80 lines
- Modifications to `fouls.py`: 20 lines
- Tests: 80 lines
- **Total: ~180 lines**

**GRAND TOTAL: ~440 lines** (both phases)

### 11.3 Testing Strategy

**Unit Tests (50 tests):**
- `test_clock_kill_trigger()` (10 scenarios)
- `test_last_second_shot_timing()` (10 scenarios)
- `test_intentional_foul_decision()` (10 scenarios) [Phase 2]
- `test_shot_clock_consumption()` (10 scenarios)
- `test_edge_cases()` (10 scenarios)

**Integration Tests (20 games):**
- 5 games: Clock kill scenarios (various leads)
- 5 games: Last second tied scenarios
- 5 games: Last second losing scenarios (down 1, 2, 3+)
- 5 games: Intentional foul scenarios [Phase 2]

**Validation Suite (100 games):**
- Force end-game scenarios across 100 games
- Measure mode activation rates
- Compare clock consumption to NBA benchmarks
- Verify 0% shot clock violations

---

## 12. CONCLUSION

### 12.1 Why These Systems Matter

**Current State:**
- Trailing teams waste time dribbling when they should foul
- Tied games rush shots with 20 seconds left (giving opponent chance)
- Leading teams shoot at 15 seconds shot clock (allowing comebacks)
- Final possessions look identical to normal possessions (unrealistic)

**After Implementation:**
- Clock management mirrors real NBA strategy
- Last-second shots create dramatic moments
- Close games feel authentic (heart-pounding final possessions)
- User strategy matters (scoring options determine clutch shooters)

### 12.2 Alignment with Core Pillars

**Pillar 1 (Deep, Intricate, Realistic Simulation):**
- End-game strategy is fundamental to NBA basketball
- Clock management separates good coaches from great coaches
- These systems capture real coaching decisions

**Pillar 4 (Tactical Input System):**
- User strategy influences WHO takes last-second shots (scoring options)
- Automatic activation ensures realistic behavior (basketball logic)
- No "fake sliders" - all behaviors are mechanical and observable

### 12.3 Recommended Implementation Order

**PHASE 1 (4-6 hours - DO THIS NOW):**
1. Clock Kill Mode (highest impact, simplest)
2. Last Second Shot - Tied (dramatic, easy to test)
3. Last Second Shot - Losing (completes offensive strategy)

**PHASE 2 (3-4 hours - DO THIS LATER):**
4. Intentional Fouling System (complex, lower priority)

**Total Time Investment: 7-10 hours for complete system**

**Expected Impact:**
- Every close game (30% of games) will have realistic end-game flow
- User will immediately notice improved realism in final 2 minutes
- Play-by-play will read like real NBA games ("Lakers hold for last shot...")
- Validation suite will show clock consumption matching NBA benchmarks

---

**END OF SPECIFICATION**
