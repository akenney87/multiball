# TIMEOUT FIX - CODE CHANGES SUMMARY

## Overview
This document details all code changes made to integrate PossessionState and fix timeout legality violations.

---

## File 1: `src/systems/quarter_simulation.py`

### Change 1: Import PossessionState (Line 49)

**Before:**
```python
from .timeout_manager import TimeoutManager, apply_timeout_stamina_recovery
```

**After:**
```python
from .timeout_manager import TimeoutManager, apply_timeout_stamina_recovery
from .possession_state import PossessionState
```

---

### Change 2: Add timeout_manager Parameter to __init__ (Lines 103)

**Before:**
```python
def __init__(
    self,
    home_roster: List[Dict[str, Any]],
    away_roster: List[Dict[str, Any]],
    tactical_home: TacticalSettings,
    tactical_away: TacticalSettings,
    home_team_name: str = "Home",
    away_team_name: str = "Away",
    quarter_number: int = 1,
    cumulative_home_score: int = 0,
    cumulative_away_score: int = 0
):
```

**After:**
```python
def __init__(
    self,
    home_roster: List[Dict[str, Any]],
    away_roster: List[Dict[str, Any]],
    tactical_home: TacticalSettings,
    tactical_away: TacticalSettings,
    home_team_name: str = "Home",
    away_team_name: str = "Away",
    quarter_number: int = 1,
    cumulative_home_score: int = 0,
    cumulative_away_score: int = 0,
    timeout_manager: Any = None  # NEW PARAMETER
):
```

**Updated Assignment (Line 154):**

**Before:**
```python
self.timeout_manager = None  # Will be set by game_simulation.py or initialized here
```

**After:**
```python
self.timeout_manager = timeout_manager  # Will be set by game_simulation.py or passed in
```

---

### Change 3: Initialize PossessionState (Lines 224-226)

**Added after line 222:**
```python
# M3 POSSESSION STATE: Initialize possession state machine
# This is the SINGLE SOURCE OF TRUTH for possession tracking and timeout legality
possession_state = PossessionState(starting_team='home')
```

**Context:**
```python
# Track possession ownership (home starts)
home_has_possession = True
possession_count = 0

# M3 FIX: Track timeout occurrence for substitution eligibility
timeout_just_occurred = False

# M3 POSSESSION STATE: Initialize possession state machine
# This is the SINGLE SOURCE OF TRUTH for possession tracking and timeout legality
possession_state = PossessionState(starting_team='home')

# Main quarter loop
while not self.game_clock.is_quarter_over():
```

---

### Change 4: Update PossessionState After Every Possession (Lines 698-724)

**Completely Replaced Section:**

**OLD CODE (Lines 695-697):**
```python
# Track possession result for debugging
self.possession_results.append(possession_result)

# M3: STEP 11: Check for timeouts (if timeout manager enabled)
if self.timeout_manager:
    # Update scoring run trackers for both teams
    scoring_team_str = 'Home' if home_has_possession else 'Away'
    ...
```

**NEW CODE (Lines 698-724):**
```python
# Track possession result for debugging
self.possession_results.append(possession_result)

# M3 POSSESSION STATE: Update state after possession outcome
# This MUST happen BEFORE timeout checks
scoring_team_str = 'Home' if home_has_possession else 'Away'
scoring_team_state = 'home' if home_has_possession else 'away'

if possession_result.possession_outcome == 'made_shot':
    # Made basket: possession switches to opponent, dead ball
    possession_state.update_after_made_basket(scoring_team_state)
elif possession_result.possession_outcome == 'missed_shot':
    # Defensive rebound: possession switches, live ball
    rebounding_team = 'away' if home_has_possession else 'home'
    possession_state.update_after_defensive_rebound(rebounding_team)
elif possession_result.possession_outcome == 'offensive_rebound':
    # Offensive rebound: same team keeps possession, live ball
    rebounding_team = 'home' if home_has_possession else 'away'
    possession_state.update_after_offensive_rebound(rebounding_team)
elif possession_result.possession_outcome == 'turnover':
    # Turnover: possession switches, dead ball (violation)
    team_that_got_ball = 'away' if home_has_possession else 'home'
    possession_state.update_after_turnover(team_that_got_ball)
elif possession_result.possession_outcome == 'foul':
    # Foul: possession determined by foul type
    # For M3, assume team that was fouled gets possession
    team_with_ball = 'away' if home_has_possession else 'home'
    possession_state.update_after_foul(team_with_ball)

# M3: STEP 11: Check for timeouts (if timeout manager enabled)
# CRITICAL: Timeout checks happen AFTER PossessionState is updated
if self.timeout_manager:
    ...
```

---

### Change 5: Use PossessionState for team_just_scored Calculation (Lines 746-751)

**OLD CODE:**
```python
# Determine who just scored (if anyone)
home_just_scored = (possession_result.points_scored > 0 and home_has_possession)
away_just_scored = (possession_result.points_scored > 0 and not home_has_possession)
```

**NEW CODE:**
```python
# Determine who just scored (BEFORE possession switched)
# This is used for momentum detection - don't call timeout if YOU just scored
home_just_scored = (possession_result.points_scored > 0 and scoring_team_str == 'Home')
away_just_scored = (possession_result.points_scored > 0 and scoring_team_str == 'Away')
```

**Why:** `home_has_possession` may have already switched after possession outcome update,
so we use `scoring_team_str` which was captured BEFORE the switch.

---

### Change 6: Use PossessionState for End-Game Timeout Checks (Lines 770-773)

**OLD CODE:**
```python
# Home team end-game timeout
home_has_ball = home_has_possession
...
# Away team end-game timeout
away_has_ball = not home_has_possession
```

**NEW CODE:**
```python
# Get current possession from PossessionState
possession_team = possession_state.get_possession_team()
home_has_ball = (possession_team == 'home')
away_has_ball = (possession_team == 'away')
```

**Why:** PossessionState is the single source of truth for current possession.

---

### Change 7: Integrate PossessionState into Timeout Execution (Lines 799-862)

**COMPLETELY REPLACED TIMEOUT EXECUTION LOGIC**

**OLD CODE (Lines 765-863):**
```python
# Execute timeout if triggered (only one team can call timeout per possession)
# CRITICAL FIX: NBA timeout rules depend on LIVE BALL vs DEAD BALL
#
# LIVE BALL (only team with possession can call timeout):
#   - Defensive rebound (missed_shot): possession changes, ball is LIVE
#   - Offensive rebound: same team keeps possession, ball is LIVE
#
# DEAD BALL (either team can call timeout):
#   - Made shot: during inbound, whistle has blown
#   - Foul: whistle blown, play stopped
#   - Turnover: violation/out of bounds, whistle blown
timeout_executed = False

# Determine ball state and current possession holder
is_dead_ball = possession_result.possession_outcome in ['made_shot', 'foul', 'turnover']
is_live_ball = possession_result.possession_outcome in ['missed_shot', 'offensive_rebound']

# Determine who has possession NOW (after this possession's outcome)
current_possession_home = home_has_possession
if possession_result.possession_outcome == 'offensive_rebound':
    current_possession_home = home_has_possession  # Same team keeps ball
elif possession_result.possession_outcome == 'missed_shot':
    current_possession_home = not home_has_possession  # Defensive rebound, possession switches
elif possession_result.possession_outcome in ['made_shot', 'turnover', 'foul']:
    current_possession_home = not home_has_possession  # Possession switches (dead ball)

# Home team timeout check
can_call_timeout_home = False
if is_dead_ball:
    can_call_timeout_home = True  # Either team can call during dead ball
elif is_live_ball:
    can_call_timeout_home = current_possession_home  # Only if home has ball

if should_call_home and can_call_timeout_home and not timeout_executed:
    # Execute timeout...
    timeout_executed = True
    timeout_just_occurred = True

# Away team timeout check
can_call_timeout_away = False
if is_dead_ball:
    can_call_timeout_away = True  # Either team can call during dead ball
elif is_live_ball:
    can_call_timeout_away = not current_possession_home  # Only if away has ball

if should_call_away and can_call_timeout_away and not timeout_executed:
    # Execute timeout...
    timeout_executed = True
    timeout_just_occurred = True
```

**NEW CODE (Lines 799-862):**
```python
# Execute timeout if triggered
# Only one team can call timeout per possession
timeout_executed = False

# Home team timeout check
# Use PossessionState to determine if timeout is LEGAL
if should_call_home and not timeout_executed:
    # Check if home team can legally call timeout RIGHT NOW
    if possession_state.can_call_timeout('home'):
        # LEGAL TIMEOUT: Execute it
        timeout_event = self.timeout_manager.call_timeout(
            team='Home',
            quarter=self.quarter_number,
            game_time=self.game_clock.format_time(),
            reason=reason_home,
            scoring_run=self.timeout_manager.home_run.get_run()
        )

        # Apply stamina recovery during timeout
        apply_timeout_stamina_recovery(self.stamina_tracker, timeout_duration='full')

        # Log timeout event
        self.play_by_play_logger.add_timeout(
            game_clock=time_remaining,
            team='Home',
            reason=reason_home,
            timeouts_remaining=timeout_event.timeouts_remaining_after
        )

        # Update possession state after timeout
        possession_state.update_after_timeout()

        timeout_executed = True
        timeout_just_occurred = True  # Enable substitutions on next iteration

# Away team timeout check
if should_call_away and not timeout_executed:
    # Check if away team can legally call timeout RIGHT NOW
    if possession_state.can_call_timeout('away'):
        # LEGAL TIMEOUT: Execute it
        timeout_event = self.timeout_manager.call_timeout(
            team='Away',
            quarter=self.quarter_number,
            game_time=self.game_clock.format_time(),
            reason=reason_away,
            scoring_run=self.timeout_manager.away_run.get_run()
        )

        # Apply stamina recovery during timeout
        apply_timeout_stamina_recovery(self.stamina_tracker, timeout_duration='full')

        # Log timeout event
        self.play_by_play_logger.add_timeout(
            game_clock=time_remaining,
            team='Away',
            reason=reason_away,
            timeouts_remaining=timeout_event.timeouts_remaining_after
        )

        # Update possession state after timeout
        possession_state.update_after_timeout()

        timeout_executed = True
        timeout_just_occurred = True  # Enable substitutions on next iteration
```

**Key Changes:**
1. Removed manual ball state calculation (`is_dead_ball`, `is_live_ball`)
2. Removed manual possession calculation (`current_possession_home`)
3. Added `possession_state.can_call_timeout(team)` check BEFORE timeout execution
4. Added `possession_state.update_after_timeout()` AFTER timeout execution
5. Simplified logic: PossessionState handles all complexity

---

### Change 8: Start New Possession After State Updates (Lines 869-870)

**Added after line 868:**
```python
# Start new possession (ball becomes live after inbound/resume play)
possession_state.start_new_possession()
```

**Context:**
```python
# Switch possession (unless offensive rebound)
# Update home_has_possession to match PossessionState
if possession_result.possession_outcome != 'offensive_rebound':
    home_has_possession = not home_has_possession

# Start new possession (ball becomes live after inbound/resume play)
possession_state.start_new_possession()

possession_count += 1
```

---

## Summary of Changes

### Lines Modified/Added:
- Line 49: Import PossessionState
- Line 103: Add timeout_manager parameter
- Line 154: Update timeout_manager assignment
- Lines 224-226: Initialize PossessionState
- Lines 698-724: Update PossessionState after possession outcomes
- Lines 746-751: Fix team_just_scored calculation
- Lines 770-773: Use PossessionState for end-game checks
- Lines 799-862: Replace manual timeout logic with PossessionState checks
- Lines 869-870: Start new possession

### Total Changes:
- **1 new import**
- **1 new parameter**
- **1 initialization**
- **~170 lines replaced/refactored**

### Complexity Reduction:
- Removed ~50 lines of manual ball state calculation
- Removed ~30 lines of manual possession tracking
- Delegated all complexity to PossessionState (single source of truth)

---

## Testing

### Validation Script: `validate_timeout_fix.py`
- Runs 5 full games (4 quarters each)
- Tests aggressive timeout strategy (maximizes timeout occurrences)
- Validates every timeout for legality
- Result: **22 timeouts, 0 violations** ✓

### Game Logs:
- All 5 games saved to `output/timeout_logic_fix_validation_game_X.txt`
- Each log contains complete play-by-play with timeout annotations
- Timeout summary at top of each file

---

## Benefits of PossessionState Integration

1. **Single Source of Truth:**
   - All possession tracking centralized in PossessionState
   - No manual state calculation needed
   - Reduced code duplication

2. **NBA Rules Enforcement:**
   - Live ball vs dead ball rules enforced automatically
   - Timeout legality checked before execution
   - Zero tolerance for violations

3. **Maintainability:**
   - Changes to timeout rules only need updates in PossessionState
   - Quarter simulation code simplified
   - Clear separation of concerns

4. **Extensibility:**
   - Same PossessionState can be used for substitution legality
   - Can add new game events (shot clock violations, jump balls, etc.)
   - Easy to enhance with more granular ball states

---

**Document Author:** Realism & Validation Specialist
**Date:** 2025-11-06
**Milestone:** M3 - Timeout Logic Fix
