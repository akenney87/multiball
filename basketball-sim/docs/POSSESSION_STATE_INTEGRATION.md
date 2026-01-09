# Possession State Machine - Integration Guide

**Author:** Architecture & Integration Lead
**Date:** 2025-11-06
**Milestone:** M3 - Timeout & Substitution Fix

---

## Overview

The **PossessionState** class is the SINGLE SOURCE OF TRUTH for tracking possession and ball state throughout the game. It solves the core architectural problem causing timeout and substitution violations.

### Problem It Solves

**Before PossessionState:**
- No explicit tracking of who has possession
- No tracking of ball state (LIVE vs DEAD)
- Code tried to infer possession from outcomes → violations
- Teams called timeouts when they didn't have the ball
- Substitutions occurred at illegal times

**After PossessionState:**
- Explicit possession tracking at all times
- Clear ball state (LIVE vs DEAD) with reasons
- Simple API: `can_call_timeout(team)` and `can_substitute()`
- All timeout and substitution logic uses this state

---

## Core Concepts

### Ball State

- **LIVE**: Play is active, ball is in motion
  - Only team with possession can call timeout
  - No substitutions allowed

- **DEAD**: Play is stopped, whistle has blown
  - Either team can call timeout (usually)
  - Substitutions allowed in specific scenarios

### Dead Ball Reasons

Not all dead balls are created equal. The `dead_ball_reason` determines substitution legality:

| Dead Ball Reason | Timeout Legal? | Substitutions Legal? |
|------------------|----------------|----------------------|
| `made_basket`    | Yes (both teams) | **NO** |
| `made_free_throw` | Yes (both teams) | **NO** |
| `foul`           | Yes (both teams) | **YES** |
| `violation`      | Yes (both teams) | **YES** |
| `timeout`        | Yes (both teams) | **YES** |
| `missed_final_ft` | Yes (both teams) | **YES** |
| `quarter_end`    | Yes (both teams) | **YES** |

**Key Insight:** Made baskets and made FTs are dead balls for timeout purposes, but NOT substitution opportunities.

---

## API Reference

### Initialization

```python
from src.systems.possession_state import PossessionState

# Start quarter with home team possession
state = PossessionState(starting_team='home')
```

### Query Methods

```python
# Check if team can call timeout RIGHT NOW
can_timeout = state.can_call_timeout('home')  # True/False

# Check if substitutions are legal RIGHT NOW
can_sub = state.can_substitute()  # True/False

# Get current possession holder
team = state.get_possession_team()  # 'home' or 'away'

# Get ball state
ball_state = state.get_ball_state()  # BallState.LIVE or BallState.DEAD

# Get debug summary
summary = state.get_state_summary()
# Returns: {'possession_team': 'home', 'ball_state': 'LIVE', ...}
```

### State Transition Methods

Call these after each possession outcome:

```python
# After made basket
state.update_after_made_basket(scoring_team='home')

# After defensive rebound (possession changes)
state.update_after_defensive_rebound(rebounding_team='away')

# After offensive rebound (possession continues)
state.update_after_offensive_rebound(rebounding_team='home')

# After turnover
state.update_after_turnover(team_that_got_ball='away')

# After foul
state.update_after_foul(team_with_ball='home')

# After made final free throw
state.update_after_made_ft(shooting_team='home')

# After missed final free throw
state.update_after_missed_ft()

# After violation (out of bounds, travel, etc.)
state.update_after_violation(team_that_got_ball='away')

# After timeout called
state.update_after_timeout()

# Resume play after dead ball (inbound, jump ball)
state.start_new_possession()

# End of quarter
state.end_quarter()
```

---

## Integration with quarter_simulation.py

### Step 1: Initialize at Quarter Start

```python
# At start of simulate_quarter()
from src.systems.possession_state import PossessionState

possession_state = PossessionState(starting_team='home')
```

### Step 2: Update After Each Possession

After simulating each possession, update the state based on outcome:

```python
# After possession.simulate_possession() returns
possession_result = possession.simulate_possession(...)

# Determine outcome and update state
if possession_result.possession_outcome == 'made_shot':
    scoring_team = 'home' if home_has_possession else 'away'
    possession_state.update_after_made_basket(scoring_team)

elif possession_result.possession_outcome == 'missed_shot':
    # Defensive rebound (possession changes)
    rebounding_team = 'away' if home_has_possession else 'home'
    possession_state.update_after_defensive_rebound(rebounding_team)

elif possession_result.possession_outcome == 'offensive_rebound':
    # Offensive rebound (possession continues)
    rebounding_team = 'home' if home_has_possession else 'away'
    possession_state.update_after_offensive_rebound(rebounding_team)

elif possession_result.possession_outcome == 'turnover':
    # Turnover (possession changes)
    team_that_got_ball = 'away' if home_has_possession else 'home'
    possession_state.update_after_turnover(team_that_got_ball)

elif possession_result.possession_outcome == 'foul':
    # Foul occurred
    team_with_ball = 'home' if home_has_possession else 'away'
    possession_state.update_after_foul(team_with_ball)

    # Check FT result
    if possession_result.free_throw_result:
        ft_result = possession_result.free_throw_result
        if ft_result.results[-1]:  # Final FT made
            possession_state.update_after_made_ft(team_with_ball)
        else:  # Final FT missed
            possession_state.update_after_missed_ft()
            # Then update again after rebound
```

### Step 3: Use for Timeout Checks

Replace existing timeout logic with PossessionState checks:

```python
# BEFORE (INCORRECT):
# can_call_timeout_home = (home_has_possession or is_dead_ball)

# AFTER (CORRECT):
can_call_timeout_home = possession_state.can_call_timeout('home')
can_call_timeout_away = possession_state.can_call_timeout('away')

# Check timeout decision
should_call_home, reason_home = timeout_manager.check_momentum_timeout(...)

# Only execute if legal
if should_call_home and can_call_timeout_home:
    timeout_event = timeout_manager.call_timeout(...)
    possession_state.update_after_timeout()
    timeout_just_occurred = True  # Enable subs on next iteration
```

### Step 4: Use for Substitution Checks

Replace existing substitution logic with PossessionState checks:

```python
# BEFORE (INCORRECT):
# allow_substitutions = (possession_count == 0 or timeout_just_occurred or ...)

# AFTER (CORRECT):
allow_substitutions = False

# First possession always legal (quarter start)
if possession_count == 0:
    allow_substitutions = True
# Timeout just occurred
elif timeout_just_occurred:
    allow_substitutions = True
    timeout_just_occurred = False
# Check possession state
else:
    allow_substitutions = possession_state.can_substitute()

# Execute substitutions only if legal
if allow_substitutions:
    sub_events = substitution_manager.check_and_execute_substitutions(...)
```

---

## Example: Complete Possession Flow

```python
# Initialize
state = PossessionState('home')
assert state.can_substitute() == False  # Live ball

# Home attempts shot
# ... shooting logic ...

# Shot misses, away gets defensive rebound
state.update_after_defensive_rebound('away')
assert state.get_possession_team() == 'away'
assert state.can_call_timeout('away') == True  # Has ball
assert state.can_call_timeout('home') == False  # Doesn't have ball
assert state.can_substitute() == False  # Live ball

# Away team calls timeout
if timeout_manager.should_call_timeout('away'):
    if state.can_call_timeout('away'):  # LEGAL CHECK
        state.update_after_timeout()
        assert state.can_substitute() == True  # Subs allowed during timeout

# Substitutions occur
if state.can_substitute():
    substitution_manager.check_and_execute_substitutions(...)

# Resume play
state.start_new_possession()
assert state.can_substitute() == False  # Live ball again
```

---

## Testing

Comprehensive unit tests in `tests/test_possession_state.py` cover:

- ✅ All state transitions
- ✅ Timeout legality (live vs dead ball)
- ✅ Substitution legality (all scenarios)
- ✅ Complex possession flows
- ✅ Edge cases and validation
- ✅ Regression tests for known bugs

**Run tests:**
```bash
pytest tests/test_possession_state.py -v
```

**Expected:** 32 tests passing

---

## NBA Rules Reference

### Timeout Rules

1. **Live Ball Timeout:**
   - Only team with possession can call timeout
   - Examples: After defensive rebound, during offensive rebound

2. **Dead Ball Timeout:**
   - Either team can call timeout
   - Examples: After made basket, after foul, after violation

### Substitution Rules

1. **Legal Substitution Opportunities:**
   - Before free throws (after foul whistle)
   - After timeout
   - After violation (out of bounds, travel)
   - Between quarters
   - After missed final free throw (before rebound)

2. **ILLEGAL Substitution Opportunities:**
   - After made basket (unless timeout called)
   - After made free throw
   - During live play (defensive rebound, offensive rebound)

---

## Next Steps (For Other Agents)

1. **Timeout Logic Agent:**
   - Replace timeout legality checks with `possession_state.can_call_timeout(team)`
   - Ensure timeouts are only called when legal

2. **Substitution Logic Agent:**
   - Replace substitution legality checks with `possession_state.can_substitute()`
   - Remove complex inference logic (now handled by PossessionState)

3. **Integration Testing Agent:**
   - Add integration tests that verify timeout/sub violations are fixed
   - Test edge cases (e.g., turnover → timeout, made basket → timeout)

---

## Common Pitfalls to Avoid

❌ **DON'T infer possession from outcomes:**
```python
# WRONG
current_possession = 'away' if last_result.possession_outcome == 'missed_shot' else 'home'
```

✅ **DO use PossessionState:**
```python
# CORRECT
current_possession = possession_state.get_possession_team()
```

❌ **DON'T treat all dead balls the same:**
```python
# WRONG
if is_dead_ball:
    allow_substitutions = True
```

✅ **DO check dead ball reason:**
```python
# CORRECT
allow_substitutions = possession_state.can_substitute()
```

❌ **DON'T allow timeouts without checking state:**
```python
# WRONG
if should_call_timeout:
    call_timeout()
```

✅ **DO check legality first:**
```python
# CORRECT
if should_call_timeout and possession_state.can_call_timeout(team):
    call_timeout()
    possession_state.update_after_timeout()
```

---

## Debugging

### Print State Summary

```python
print(possession_state.get_state_summary())
# Output:
# {
#     'possession_team': 'home',
#     'ball_state': 'DEAD',
#     'dead_ball_reason': 'foul',
#     'can_timeout_home': True,
#     'can_timeout_away': True,
#     'can_substitute': True
# }
```

### String Representation

```python
print(possession_state)
# Output: PossessionState(possession=home, ball=DEAD, reason=foul)
```

---

## Summary

The **PossessionState** class is a simple but critical architectural fix:

✅ **Single source of truth** for possession tracking
✅ **Explicit ball state** (LIVE vs DEAD)
✅ **Clear API** for timeout and substitution legality
✅ **Well-tested** (32 unit tests)
✅ **Easy to integrate** (minimal changes to quarter_simulation.py)

By using PossessionState, we eliminate the root cause of timeout and substitution violations and provide a solid foundation for future game flow improvements.
