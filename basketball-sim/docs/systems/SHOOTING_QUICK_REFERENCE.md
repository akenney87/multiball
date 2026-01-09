# Shooting System - Quick Reference

## Core Functions

### 1. Shot Type Selection
```python
from src.systems.shooting import select_shot_type

shot_type = select_shot_type(
    shooter=player_dict,
    tactical_settings=TacticalSettings(pace='fast'),
    possession_context=PossessionContext(is_transition=True),
    defense_type='zone'  # 'man' or 'zone'
)
# Returns: '3pt', 'midrange', or 'rim'
```

### 2. Shot Attempt (Unified Interface)
```python
from src.systems.shooting import attempt_shot

success, debug = attempt_shot(
    shooter=player_dict,
    defender=player_dict,
    shot_type='3pt',
    contest_distance=4.5,
    possession_context=PossessionContext(),
    defense_type='man'
)
# Returns: (bool, dict)
# success: True if made, False if missed
# debug: Complete debug dictionary
```

### 3. Contest Distance Simulation
```python
from src.systems.shooting import simulate_contest_distance

distance = simulate_contest_distance(
    shooter=player_dict,
    defender=player_dict
)
# Returns: float (0.5 to 10.0 feet)
```

### 4. Help Defense Check
```python
from src.systems.shooting import check_help_defense

help_defender = check_help_defense(
    primary_defender_composite=30.0,
    contest_distance=8.0,
    help_defenders=[defender1, defender2]
)
# Returns: Dict (help defender) or None
```

## Individual Shot Types

### 3-Point Shot
```python
from src.systems.shooting import attempt_3pt_shot

success, debug = attempt_3pt_shot(
    shooter=curry,
    defender=kawhi,
    contest_distance=6.0,
    possession_context=PossessionContext(is_transition=False),
    defense_type='man'
)
```

### Midrange Shot
```python
from src.systems.shooting import attempt_midrange_shot

success, debug = attempt_midrange_shot(
    shooter=player,
    defender=defender,
    contest_distance=4.0,
    possession_context=PossessionContext(),
    range_type='short',  # 'short' (10-16ft) or 'long' (16-23ft)
    defense_type='man'
)
```

### Rim Attempt (Dunk/Layup)
```python
from src.systems.shooting import attempt_rim_shot

success, debug = attempt_rim_shot(
    shooter=shaq,
    defender=opponent,
    contest_distance=2.0,
    possession_context=PossessionContext(is_transition=True),
    attempt_type='dunk',  # 'dunk', 'layup', or None (auto-determine)
    defense_type='man'
)
```

## Key Constants

```python
from src.constants import (
    # Base Rates
    BASE_RATE_3PT,              # 0.30
    BASE_RATE_MIDRANGE_SHORT,   # 0.45
    BASE_RATE_MIDRANGE_LONG,    # 0.37
    BASE_RATE_DUNK,             # 0.80
    BASE_RATE_LAYUP,            # 0.62

    # Contest Distances
    CONTEST_DISTANCE_WIDE_OPEN,     # 6.0 ft
    CONTEST_DISTANCE_CONTESTED,     # 2.0 ft

    # Contest Penalties
    CONTEST_PENALTY_WIDE_OPEN,      # 0.0
    CONTEST_PENALTY_CONTESTED,      # -0.15
    CONTEST_PENALTY_HEAVY,          # -0.25

    # Transition Bonuses
    TRANSITION_BONUS_3PT,       # 0.08
    TRANSITION_BONUS_MIDRANGE,  # 0.12
    TRANSITION_BONUS_RIM,       # 0.20

    # Attribute Weights
    WEIGHTS_3PT,
    WEIGHTS_MIDRANGE,
    WEIGHTS_DUNK,
    WEIGHTS_LAYUP,
    WEIGHTS_CONTEST,
)
```

## Debug Output Structure

```python
{
    'shot_type': '3pt',              # Shot type
    'shooter_name': 'Stephen Curry',
    'defender_name': 'Kawhi Leonard',
    'shooter_composite': 95.52,      # Weighted average
    'defender_composite': 89.00,
    'attribute_diff': 6.52,          # shooter - defender
    'base_rate': 0.30,               # Uncontested BaseRate
    'base_success': 0.673,           # After sigmoid
    'contest_distance': 4.5,         # Feet
    'contest_penalty': -0.189,       # Negative value
    'transition_bonus': 0.0,         # 0 or positive
    'final_success_rate': 0.484,     # Clamped [0,1]
    'roll_value': 0.6767,            # Random roll
    'result': 'miss',                # 'make' or 'miss'
    'defense_type': 'man'            # 'man' or 'zone'
}
```

## Quick Validation

```python
from src.core.probability import set_seed

# Reproducible results
set_seed(42)

# Expected outcomes:
# - Elite shooter (95) vs poor defender (30), wide open: ~80-85% make
# - Poor shooter (30) vs elite defender (95), contested: ~15-20% make
# - Transition rim: +20% vs halfcourt
# - Zone defense: +5% 3PT attempts
```

## Common Patterns

### Full Possession Shot Sequence
```python
# 1. Select shot type
shot_type = select_shot_type(shooter, tactics, context, defense_type)

# 2. Simulate contest
contest_distance = simulate_contest_distance(shooter, defender)

# 3. Check help defense (if needed)
if contest_distance < 2.0:  # Close contest
    help_defender = check_help_defense(
        primary_defender_composite=calculate_composite(defender, WEIGHTS_CONTEST),
        contest_distance=contest_distance,
        help_defenders=available_help_defenders
    )
    if help_defender:
        defender = help_defender  # Switch to help defender
        contest_distance = simulate_contest_distance(shooter, defender)

# 4. Attempt shot
success, debug = attempt_shot(
    shooter, defender, shot_type,
    contest_distance, context, defense_type
)

# 5. Process result
if success:
    points = 3 if shot_type == '3pt' else 2
    print(f"MAKE! +{points} points")
else:
    print("MISS - rebound opportunity")
```

## Validation Scenarios

### Run Quick Test
```bash
python validate_shooting.py
```

### Run Full Demo
```bash
python demo_shooting.py
```

### Run Unit Tests (if pytest installed)
```bash
python -m pytest tests/test_shooting.py -v
```

## Expected Success Rates

| Matchup | Distance | Expected Range |
|---------|----------|----------------|
| Elite vs Poor | Wide Open | 70-85% |
| Elite vs Elite | Contested | 40-55% |
| Poor vs Elite | Heavy Contest | 10-20% |
| Dunk (transition) | Any | 85-100% |
| Layup (halfcourt) | Contested | 50-70% |

## Integration Checklist

- [x] Import from `src.systems.shooting`
- [x] Use `PossessionContext` for transition tracking
- [x] Use `TacticalSettings` for pace/strategy
- [x] Pass defense_type ('man' or 'zone')
- [x] Process debug output for play-by-play
- [x] Check `success` boolean for make/miss
- [x] Award points: 3 for '3pt', 2 for others

## Common Issues

### Issue: Success rates too low
**Cause:** Negative sigmoid (old bug)
**Fix:** Ensure `src/core/probability.py` uses `sigmoid_input = k * attribute_diff` (no negative)

### Issue: Probabilities > 1 or < 0
**Cause:** Missing clamp
**Fix:** Already handled with `max(0.0, min(1.0, probability))`

### Issue: Elite shooters missing too often
**Cause:** Contest distance too close
**Fix:** Check `simulate_contest_distance()` - elite defenders should average ~4ft, not <2ft

### Issue: Zone defense not affecting shots
**Cause:** Not passing `defense_type` parameter
**Fix:** Always pass `defense_type='zone'` when zone defense is active

## Performance Notes

- Each shot attempt: ~0.5ms
- Composite calculation: ~0.1ms
- No performance concerns for single possession simulation
- For 1000+ possessions, consider caching composites

## File Locations

```
src/
  systems/
    shooting.py          # Main implementation
  core/
    probability.py       # Sigmoid calculations
    data_structures.py   # PossessionContext, etc.
  constants.py           # All BaseRates and weights

tests/
  test_shooting.py       # Unit tests

validate_shooting.py     # Standalone validation
demo_shooting.py         # Interactive demo
```
