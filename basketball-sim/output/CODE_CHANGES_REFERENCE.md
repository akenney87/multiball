# Code Changes Reference - Stamina Spread Fix

## Quick Restore Guide

If you need to restore context after a restart, these are the exact code changes made:

---

## Change 1: Increase Stamina Drain Rate Modifier

**File**: `src/constants.py`
**Line**: 478
**Status**: ✓ APPLIED

### BEFORE:
```python
STAMINA_DRAIN_RATE_MAX_MODIFIER = 0.15    # ±15% drain rate at extremes
```

### AFTER:
```python
STAMINA_DRAIN_RATE_MAX_MODIFIER = 0.50    # ±50% drain rate at extremes (4x spread)
```

### Impact:
- Spread between fastest/slowest draining players: 2.3 min → 12 min
- Low stamina players (16): Need rest at ~8 minutes
- High stamina players (95): Need rest at ~20 minutes

---

## Change 2: Allow Substitutions After Offensive Fouls

**File**: `src/systems/possession_state.py`
**Line**: 174
**Status**: ✓ APPLIED

### BEFORE:
```python
# Dead ball: check reason
# SIMPLIFIED SUBSTITUTION RULES (per user request):
# Substitutions allowed ONLY during:
# - Timeouts
# - Violations (turnovers, out of bounds)
# - Quarter breaks
# NOT after shooting fouls, free throws, or made baskets
legal_sub_reasons = [
    DeadBallReason.TIMEOUT,
    DeadBallReason.VIOLATION,
    DeadBallReason.QUARTER_END,
]

return self.dead_ball_reason in legal_sub_reasons
```

### AFTER:
```python
# Dead ball: check reason
# SIMPLIFIED SUBSTITUTION RULES (per user request):
# Substitutions allowed ONLY during:
# - Timeouts
# - Violations (turnovers, out of bounds)
# - Offensive fouls (dead ball turnovers)
# - Quarter breaks
# NOT after shooting fouls, free throws, or made baskets
legal_sub_reasons = [
    DeadBallReason.TIMEOUT,
    DeadBallReason.VIOLATION,
    DeadBallReason.FOUL,  # FIX: Allow subs after offensive fouls (dead ball)
    DeadBallReason.QUARTER_END,
]

return self.dead_ball_reason in legal_sub_reasons
```

### Impact:
- Offensive fouls at [01:25] Q1 now trigger substitutions
- Prevents all starters from waiting until [00:02] Q1 to sub
- Eliminates mass substitution events

---

## Change 3: Pass Tactical Settings to SubstitutionManager

**File**: `src/systems/quarter_simulation.py`
**Lines**: 162-163
**Status**: ✓ APPLIED

### BEFORE:
```python
self.substitution_manager = SubstitutionManager(
    home_roster=home_roster,
    away_roster=away_roster,
    minutes_allocation_home=self._extract_minutes_allocation(tactical_home),
    minutes_allocation_away=self._extract_minutes_allocation(tactical_away),
    home_starting_lineup=home_starting,
    away_starting_lineup=away_starting
)
```

### AFTER:
```python
self.substitution_manager = SubstitutionManager(
    home_roster=home_roster,
    away_roster=away_roster,
    minutes_allocation_home=self._extract_minutes_allocation(tactical_home),
    minutes_allocation_away=self._extract_minutes_allocation(tactical_away),
    home_starting_lineup=home_starting,
    away_starting_lineup=away_starting,
    tactical_home=tactical_home,  # ADDED
    tactical_away=tactical_away   # ADDED
)
```

### Impact:
- Q4 closer system can now access pace and scoring options
- Enables accurate stamina cost calculations for optimal insertion times
- Required for Q4 closer system to function

---

## Verification Commands

### Test the changes:
```bash
python generate_review_game.py
```

### Check substitution patterns:
```bash
grep "Substitution" output/REVIEW_GAME_PROPER.txt | head -20
```

### Verify stamina spread (theoretical):
```bash
python check_new_spread.py
```

---

## Expected Results

### Substitution Timeline (Q1):
```
[04:21] Chris Maestro OUT (stamina=16)
[01:21] Ray Sniper OUT (stamina=40)
[01:21] Steve Facilitator OUT (stamina=52)
```

### Substitution Timeline (Q2):
```
[10:29] Mutombo Blocker OUT (stamina=67)
[10:13] Marcus Slasher OUT (stamina=65)
[07:12] Dennis Boardman, Dwyane Slasher, Andre Rebounder OUT (stamina=78-84)
[04:27] Hassan Swatter, Reggie Shooter OUT (stamina=93-95)
```

### Key Metrics:
- Spread between low/high stamina players: ~12 minutes
- Q1 substitution time points: 2 (vs 1 before)
- Q2 substitution time points: 5
- No mass substitution events

---

## Rollback Instructions (If Needed)

### To rollback Change 1:
```python
# In src/constants.py line 478:
STAMINA_DRAIN_RATE_MAX_MODIFIER = 0.15    # Original value
```

### To rollback Change 2:
```python
# In src/systems/possession_state.py line 174:
# Remove DeadBallReason.FOUL from legal_sub_reasons list
legal_sub_reasons = [
    DeadBallReason.TIMEOUT,
    DeadBallReason.VIOLATION,
    # DeadBallReason.FOUL,  # REMOVE THIS LINE
    DeadBallReason.QUARTER_END,
]
```

### To rollback Change 3:
```python
# In src/systems/quarter_simulation.py lines 162-163:
# Remove tactical_home and tactical_away parameters
self.substitution_manager = SubstitutionManager(
    home_roster=home_roster,
    away_roster=away_roster,
    minutes_allocation_home=self._extract_minutes_allocation(tactical_home),
    minutes_allocation_away=self._extract_minutes_allocation(tactical_away),
    home_starting_lineup=home_starting,
    away_starting_lineup=away_starting
    # Remove: tactical_home=tactical_home
    # Remove: tactical_away=tactical_away
)
```

---

## Related Files (Read-Only Reference)

These files were analyzed but NOT modified:

### `src/systems/substitutions.py`
- Contains 3-rule substitution logic
- Contains Q4 closer system implementation
- Lines 704-747: Rule #2 (stamina management)
- Lines 760-776: Q4 closer integration

### `src/systems/stamina_manager.py`
- Contains stamina cost calculation
- Lines 31-116: calculate_stamina_cost() function
- Uses STAMINA_DRAIN_RATE_MAX_MODIFIER from constants.py

### `basketball_sim.md`
- Master implementation specification
- Contains all formulas and base rates
- Reference for stamina system design

---

## Team Rosters (For Testing)

### Team Alpha Starters:
```
Chris Maestro (PG) - stamina: 16
Ray Sniper (SG) - stamina: 40
Marcus Slasher (SF) - stamina: 65
Dennis Boardman (PF) - stamina: 84
Hassan Swatter (C) - stamina: 95
```

### Team Beta Starters:
```
Steve Facilitator (PG) - stamina: 52
Reggie Shooter (SG) - stamina: 93
Dwyane Slasher (SF) - stamina: 78
Andre Rebounder (PF) - stamina: 78
Mutombo Blocker (C) - stamina: 67
```

These teams provide good stamina variation (16-95 range) for testing.

---

**End of Code Changes Reference**
