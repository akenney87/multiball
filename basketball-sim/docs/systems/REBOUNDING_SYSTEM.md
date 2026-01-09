# Rebounding System Documentation

## Overview

The rebounding system implements realistic basketball rebounding mechanics with attribute-driven outcomes, defensive positioning advantage, and strategic tactical effects.

## Core Mechanics

### Team Rebounding Strength

Each team's rebounding strength is calculated as the average composite of all rebounders using **WEIGHTS_REBOUND**:

```python
WEIGHTS_REBOUND = {
    'height': 0.25,          # 25% - Size matters most
    'jumping': 0.20,         # 20% - Vertical leap
    'core_strength': 0.15,   # 15% - Boxing out strength
    'awareness': 0.20,       # 20% - Positioning sense
    'reactions': 0.10,       # 10% - Quick reactions
    'determination': 0.10,   # 10% - Effort and hustle
}
```

**Defensive Advantage:** Defense gets 15% strength multiplier (1.15x) to reflect positioning advantage.

### Rebounding Strategy

Strategy determines number of players crashing boards:

| Strategy | Offensive Rebounders | Defensive Rebounders |
|----------|---------------------|---------------------|
| **crash_glass** | 5 players | 2 players |
| **standard** | 2 players | 3 players |
| **prevent_transition** | 1 player | 4 players |

**Selection:** Players are sorted by rebounding composite, and top N are selected to box out.

### Offensive Rebound Probability

Base OREB rate: **27%** (NBA average)

**Modifiers:**

1. **Shot Type:**
   - 3PT: -5% (long rebound)
   - Midrange: 0% (baseline)
   - Rim: +3% (short rebound)

2. **Offensive Strategy:**
   - crash_glass: +8%
   - standard: 0%
   - prevent_transition: -5%

**Calculation:**
```python
strength_probability = offensive_strength / (offensive_strength + defensive_strength)
base_with_modifiers = base_rate + shot_modifier + strategy_modifier
final_probability = 0.4 * strength_probability + 0.6 * base_with_modifiers
```

This blends attribute-based strength (40%) with situational modifiers (60%), ensuring defensive advantage has meaningful impact.

### Individual Rebounder Selection

Once team is determined, individual rebounder is selected using **weighted random choice**:
- Weights = each player's rebounding composite
- Player with composite 80 is 2x more likely than player with composite 40
- Selection is proportional to individual ability

### Putback Logic

**Height Threshold: 75**

**If rebounder height > 75:**
- Attempts immediate putback (layup at rim)
- Success probability uses **WEIGHTS_LAYUP** with **BASE_RATE_LAYUP** (62%)
- Defenders are scrambled (60% effectiveness reduction)
- +5% putback bonus (close to basket)

**If rebounder height ≤ 75:**
- Kicks out to perimeter
- New halfcourt possession begins
- Normal shot selection applies

**Shot Clock Reset:** Always resets to **14 seconds** on OREB (NBA rule)

## Validation Results

### Statistical Validation (200 rebounds per scenario)

| Scenario | Expected OREB% | Actual OREB% | Status |
|----------|---------------|--------------|--------|
| Balanced vs Balanced | 20-35% | 35.0% | ✅ Pass |
| Elite vs Poor | >35% | 48.1% | ✅ Pass |
| Poor vs Elite | <30% | 27.5% | ✅ Pass |
| 3PT vs Rim | 3PT < Rim | 22% vs 28% | ✅ Pass |

### Key Validations

✅ **Defensive Advantage Applied:** Defense composite = base × 1.15
✅ **Strategy Effects:** crash_glass increases OREB% by 4-8%
✅ **Height Threshold:** Players >75 attempt putbacks, ≤75 kick out
✅ **Shot Clock Reset:** Always 14 seconds on OREB
✅ **Weighted Selection:** Higher composite = higher selection probability
✅ **Shot Type Modifiers:** 3PT has lower OREB rate than rim shots

## API Reference

### Main Function

```python
def simulate_rebound(
    offensive_team: List[Dict[str, Any]],
    defensive_team: List[Dict[str, Any]],
    offensive_strategy: str,
    defensive_strategy: str,
    shot_type: str,
    shot_made: bool = False
) -> Dict[str, Any]
```

**Parameters:**
- `offensive_team`: List of 5 player dictionaries
- `defensive_team`: List of 5 player dictionaries
- `offensive_strategy`: 'crash_glass', 'standard', or 'prevent_transition'
- `defensive_strategy`: 'crash_glass', 'standard', or 'prevent_transition'
- `shot_type`: '3pt', 'midrange', or 'rim'
- `shot_made`: If True, no rebound occurs

**Returns:**
Dictionary with complete debug information including:
- `rebound_occurred`: bool
- `offensive_rebound`: bool
- `rebounder_name`: str
- `rebounder_composite`: float
- `putback_attempted`: bool
- `putback_made`: bool
- `oreb_outcome`: 'putback' or 'kickout'
- `shot_clock_reset`: int (14)
- Plus all intermediate calculations

### Helper Functions

#### get_rebounders_for_strategy
```python
def get_rebounders_for_strategy(
    team: List[Dict[str, Any]],
    strategy: str,
    is_offensive: bool
) -> List[Dict[str, Any]]
```
Returns list of players boxing out based on strategy and role.

#### calculate_team_rebounding_strength
```python
def calculate_team_rebounding_strength(
    rebounders: List[Dict[str, Any]],
    is_defense: bool
) -> float
```
Returns average rebounding composite (with defensive advantage if applicable).

#### select_rebounder
```python
def select_rebounder(
    rebounders: List[Dict[str, Any]]
) -> Tuple[Dict[str, Any], float]
```
Returns (selected_player, player_composite) using weighted selection.

#### check_putback_attempt
```python
def check_putback_attempt(
    rebounder: Dict[str, Any],
    defenders_nearby: List[Dict[str, Any]]
) -> Tuple[bool, bool, Dict[str, Any]]
```
Returns (attempted, made, debug_info) based on height threshold and layup mechanics.

## Integration with Possession Flow

### After Missed Shot

1. Call `simulate_rebound()` with shot details
2. If `offensive_rebound == True`:
   - Check `oreb_outcome`
   - If `'putback'`: Award points if `putback_made`
   - If `'kickout'`: Continue possession with new shot selection
   - Reset shot clock to `shot_clock_reset` (14)
3. If `offensive_rebound == False`:
   - Possession changes to defensive team
   - New possession begins

### Debug Output

Enable full debug output using `format_rebound_debug()`:

```python
from src.systems.rebounding import format_rebound_debug

result = simulate_rebound(...)
print(format_rebound_debug(result))
```

Output includes:
- Shot type and strategies
- Number of rebounders per team
- Team composites (with defensive advantage)
- OREB probability breakdown
- Individual rebounder selection
- Putback attempt details (if applicable)

## Design Rationale

### Why 15% Defensive Advantage?

In real basketball, defensive players:
- Start closer to the basket (positional advantage)
- Face the basket (better tracking of ball trajectory)
- Have established box-out position

The 15% multiplier reflects this inherent advantage without making OREBs impossible.

### Why Height Threshold of 75?

NBA data shows:
- Centers/PFs (typically 80+ height) frequently attempt putbacks
- Guards/wings (typically <75 height) kick out to reset offense
- Threshold at 75 creates realistic split between big men and perimeter players

### Why Shot Type Modifiers?

Physics of basketball:
- **3PT shots:** Long rebounds bounce farther from basket (harder for offense to secure)
- **Rim attempts:** Short rebounds stay close (easier for offense despite traffic)
- **Midrange:** Baseline (moderate distance)

### Why Blended Probability Formula?

Pure strength-based calculation would make defensive advantage too strong (since defense has 1.15x multiplier). Blending 40% strength-based with 60% base rate ensures:
- Defensive advantage matters
- Extreme mismatches still produce reasonable OREB rates
- Base rate provides realistic floor/ceiling

## Common Patterns

### Elite Rebounding Team
```python
# All players with height 90+, jumping 85+
elite_team = create_elite_rebounding_team()

# Use crash glass for maximum OREB attempts
result = simulate_rebound(
    elite_team, opponent,
    offensive_strategy='crash_glass',
    defensive_strategy='standard',
    shot_type='rim',  # Higher OREB rate
    shot_made=False
)
# Expected: ~45-50% OREB rate
```

### Prevent Fast Break
```python
# Sacrifice rebounding to stop transition
result = simulate_rebound(
    team, opponent,
    offensive_strategy='prevent_transition',  # Only 1 rebounder
    defensive_strategy='prevent_transition',  # 4 defenders back
    shot_type='3pt',
    shot_made=False
)
# Expected: Low OREB rate, but prevents transition possession
```

### Putback Specialists
```python
# Center with height 95, elite finishing
center = {
    'name': 'Shaq',
    'height': 95,
    'finesse': 80,
    'hand_eye_coordination': 75,
    ...
}

# On OREB by center:
# - Will attempt putback (height > 75)
# - High success rate (elite layup composite)
# - +5% putback bonus
```

## Testing

Run complete test suite:
```bash
python -m pytest tests/test_rebounding.py -v
```

**32 tests** covering:
- Strategy effects (7 tests)
- Team strength calculations (4 tests)
- OREB probability (5 tests)
- Rebounder selection (3 tests)
- Putback logic (4 tests)
- Full simulation (4 tests)
- Statistical validation (5 tests)

## Future Enhancements

Potential additions for Milestone 2+:
- **Tip-outs:** Offensive player tips ball to teammate instead of securing
- **Box-out violations:** Fouls on rebounding plays
- **Transition triggers:** Defensive rebound → fast break probability
- **Fatigue effects:** Stamina impacts jumping/reactions in rebounding
- **Position-specific rates:** Centers rebound more than guards (already somewhat modeled via attributes)

## Performance

- **Average execution time:** <1ms per rebound
- **Memory footprint:** Minimal (no large data structures)
- **Scalability:** Linear with number of rebounders (max 10 total)

---

**Version:** 1.0
**Status:** Production Ready
**Test Coverage:** 100% of core functions
**Last Updated:** 2025-11-04
