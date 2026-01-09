# Q4 Closer System - Fixes and Remaining Issues

## Summary
The Q4 closer system has implementation issues preventing starters from finishing close games.

## Test Game Results
**Seed 1003**: Tie game at Q3 (79-79), final score 109-99 (10 points)
- **Issue**: Chris Maestro (starter PG) subbed out at Q3 [05:54], never returned in Q4
- **Result**: Jerry Midrange (backup SG) played entire Q4 instead

## Fixes Applied

### Fix #1: Prevent Starters from Being Subbed in Q4 Close Games
**File**: `src/systems/substitutions.py` (lines 716-728)
**Problem**: Starters were being subbed out in Q4 when stamina dropped below 70
**Solution**: Check Q4 decisions dict; if starter has 'STAY_IN' or 'WILL_FATIGUE' action in close game (±10 points), lower threshold to 50

```python
# Q4 CLOSER FIX: Check if this starter should finish Q4 (close game)
q4_closer_active = False
if quarter_number == 4 and abs(score_differential) <= 10 and is_starter:
    q4_decisions = self.q4_decisions_home if team == 'home' else self.q4_decisions_away
    if player_name in q4_decisions:
        action = q4_decisions[player_name]['action']
        if action in ['STAY_IN', 'WILL_FATIGUE']:
            stamina_threshold = 50.0
            q4_closer_active = True
```

### Fix #2: Bypass 6-Minute Requirement for Q4 INSERT_AT
**File**: `src/systems/substitutions.py` (lines 775-804)
**Problem**: Rule #1 requires active player to have 6+ minutes on court before subbing them out, but in Q4 nobody has 6+ minutes yet
**Solution**: Set `q4_insert_override = True` for benched starters with INSERT_AT actions in close games, allowing immediate substitution

```python
# Q4 CLOSER FIX: Calculate override BEFORE time check
q4_insert_override = False
if quarter_number == 4 and abs(score_differential) <= 10:
    q4_decisions = self.q4_decisions_home if team == 'home' else self.q4_decisions_away
    if bench_player_name in q4_decisions:
        decision = q4_decisions[bench_player_name]
        if decision['action'] == 'INSERT_AT':
            q4_insert_override = True  # Set override for 6-min bypass
            # ... time check logic ...

# Later, use override:
if (q4_insert_override or time_on_court >= 6.0) and self._positions_compatible(...):
```

## Remaining Issue

**Benched starters in Q4 close games are not being re-inserted.**

### Observed Behavior
- Chris Maestro subbed out at Q3 [05:54]
- Q4 starts with 79-79 tie (perfect close game)
- Chris Maestro NEVER returns despite:
  - Having ~8 minutes to recover stamina (should be 90+)
  - Q4 closer system should calculate INSERT_AT time
  - Fixes should bypass 6-minute requirement

### Possible Root Causes
1. **INSERT_AT calculation might be too late**: If system calculates "insert at 1.0 min remaining" but checks happen every ~30 seconds, insertion time might be missed
2. **Stamina not reaching 90**: Unlikely given 8+ minutes of recovery (Q3 rest + 2:10 quarter break)
3. **Q4 decisions not being created**: The _process_q4_start() might not be creating decisions properly
4. **Position compatibility check failing**: Even with override, if there's no compatible position match, insertion fails

### Next Steps for Full Fix

**Option A - Debug Output**:
Add logging to see:
- Q4 decisions dict contents at Q4 start
- Chris Maestro's stamina values during Q4
- INSERT_AT time calculated
- Why Rule #1 isn't triggering

**Option B - Simplified Approach**:
In Q4 close games (±10 points):
- At Q4 start, ensure all starters are on court
- Prevent ALL substitutions in Q4 (not just some)
- Play starters through fatigue with 50 stamina threshold

**Option C - Force Insertion**:
Add new rule: "Q4 close game, benched starter with 90+ stamina → insert immediately, no conditions"
- Skip time check
- Skip position compatibility
- Skip 6-minute check
- Just substitute any active player at that position

## Files Modified
1. `src/constants.py` - Added WEIGHTS_STEAL_DEFENSE (steal fix, unrelated)
2. `src/systems/turnovers.py` - Fixed steal attribution (unrelated)
3. `src/systems/substitutions.py` - Added Q4 closer fixes (lines 716-728, 775-804)

## Recommendation
The Q4 closer system needs more extensive debugging or a simplified approach. Current architecture has multiple failure points that make it fragile.
