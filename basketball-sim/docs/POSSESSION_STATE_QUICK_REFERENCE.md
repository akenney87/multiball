# Possession State - Quick Reference Card

**For:** Developers integrating PossessionState into quarter_simulation.py
**Author:** Architecture & Integration Lead

---

## One-Page Quick Reference

### Import

```python
from src.systems.possession_state import PossessionState
```

### Initialize

```python
# At start of quarter
possession_state = PossessionState(starting_team='home')
```

---

## State Updates (After Each Possession)

### Made Basket

```python
possession_state.update_after_made_basket(scoring_team='home')
# Result: away gets ball, DEAD, NO subs
```

### Defensive Rebound

```python
possession_state.update_after_defensive_rebound(rebounding_team='away')
# Result: away gets ball, LIVE, NO subs
```

### Offensive Rebound

```python
possession_state.update_after_offensive_rebound(rebounding_team='home')
# Result: home keeps ball, LIVE, NO subs
```

### Turnover

```python
possession_state.update_after_turnover(team_that_got_ball='away')
# Result: away gets ball, DEAD (violation), YES subs
```

### Foul

```python
possession_state.update_after_foul(team_with_ball='home')
# Result: home keeps ball, DEAD, YES subs
```

### Made Free Throw (final)

```python
possession_state.update_after_made_ft(shooting_team='home')
# Result: away gets ball, DEAD, NO subs
```

### Missed Free Throw (final)

```python
possession_state.update_after_missed_ft()
# Result: TBD (rebound determines), DEAD, YES subs
# Then call update_after_offensive_rebound() or update_after_defensive_rebound()
```

### Timeout

```python
possession_state.update_after_timeout()
# Result: same team, DEAD, YES subs
```

### Resume Play

```python
possession_state.start_new_possession()
# Result: LIVE, NO subs
```

---

## Queries (Check Before Acting)

### Can Team Call Timeout?

```python
if possession_state.can_call_timeout('home'):
    # LEGAL: Call timeout
    timeout_manager.call_timeout('home', ...)
    possession_state.update_after_timeout()
```

### Can Substitute?

```python
if possession_state.can_substitute():
    # LEGAL: Execute substitutions
    substitution_manager.check_and_execute_substitutions(...)
```

### Get Current Possession

```python
team = possession_state.get_possession_team()  # 'home' or 'away'
```

### Get Ball State

```python
state = possession_state.get_ball_state()  # BallState.LIVE or BallState.DEAD
```

---

## Integration Pattern (quarter_simulation.py)

```python
# 1. Initialize at start
possession_state = PossessionState('home')

# 2. After each possession
possession_result = possession.simulate_possession(...)

# 3. Update state based on outcome
if possession_result.possession_outcome == 'made_shot':
    scoring_team = 'home' if home_has_possession else 'away'
    possession_state.update_after_made_basket(scoring_team)
elif possession_result.possession_outcome == 'missed_shot':
    rebounding_team = 'away' if home_has_possession else 'home'
    possession_state.update_after_defensive_rebound(rebounding_team)
elif possession_result.possession_outcome == 'offensive_rebound':
    rebounding_team = 'home' if home_has_possession else 'away'
    possession_state.update_after_offensive_rebound(rebounding_team)
elif possession_result.possession_outcome == 'turnover':
    team_that_got_ball = 'away' if home_has_possession else 'home'
    possession_state.update_after_turnover(team_that_got_ball)
elif possession_result.possession_outcome == 'foul':
    team_with_ball = 'home' if home_has_possession else 'away'
    possession_state.update_after_foul(team_with_ball)

    # Check FT result
    if possession_result.free_throw_result:
        ft_result = possession_result.free_throw_result
        if ft_result.results[-1]:  # Final FT made
            possession_state.update_after_made_ft(team_with_ball)
        else:  # Final FT missed
            possession_state.update_after_missed_ft()
            # Rebound will update state again

# 4. Check timeout legality
should_call_home, reason_home = timeout_manager.check_momentum_timeout(...)
if should_call_home and possession_state.can_call_timeout('home'):
    timeout_event = timeout_manager.call_timeout('home', ...)
    possession_state.update_after_timeout()

# 5. Check substitution legality
if possession_state.can_substitute():
    sub_events = substitution_manager.check_and_execute_substitutions(...)
```

---

## Common Mistakes to Avoid

❌ **DON'T:**
```python
# Inferring possession from outcomes
current_possession = 'away' if result.outcome == 'missed_shot' else 'home'

# Allowing timeouts without checking
if should_call_timeout:
    call_timeout()

# Allowing subs based on complex conditions
if possession_count == 0 or timeout_occurred or last_result.outcome == 'foul':
    allow_subs = True
```

✅ **DO:**
```python
# Always query PossessionState
current_possession = possession_state.get_possession_team()

# Always check legality
if should_call_timeout and possession_state.can_call_timeout(team):
    call_timeout()
    possession_state.update_after_timeout()

# Simple substitution check
if possession_state.can_substitute():
    check_and_execute_substitutions()
```

---

## Debugging

### Print Current State

```python
print(possession_state)
# Output: PossessionState(possession=home, ball=LIVE, reason=None)
```

### Get Detailed Summary

```python
summary = possession_state.get_state_summary()
print(summary)
# Output: {'possession_team': 'home', 'ball_state': 'LIVE', ...}
```

---

## Rules Quick Reference

### Timeout Legality

| Ball State | Has Possession | Can Timeout? |
|------------|----------------|--------------|
| LIVE       | Yes            | ✅           |
| LIVE       | No             | ❌           |
| DEAD       | Either         | ✅           |

### Substitution Legality

| Dead Ball Reason | Subs Legal? |
|------------------|-------------|
| made_basket      | ❌          |
| made_free_throw  | ❌          |
| foul             | ✅          |
| violation        | ✅          |
| timeout          | ✅          |
| missed_final_ft  | ✅          |
| quarter_end      | ✅          |
| LIVE ball        | ❌          |

---

## Tests

### Run Unit Tests

```bash
pytest tests/test_possession_state.py -v
```

### Run Demo

```bash
python examples/possession_state_demo.py
```

---

## Key Insight

**Made baskets and made FTs are dead balls for timeout purposes, but NOT substitution opportunities.**

This is the most common source of bugs.

---

**Full Documentation:** `docs/POSSESSION_STATE_INTEGRATION.md`
**Working Example:** `examples/possession_state_demo.py`
**Test Suite:** `tests/test_possession_state.py`
