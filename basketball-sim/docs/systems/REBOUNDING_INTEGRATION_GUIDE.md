# Rebounding System Integration Guide

## Quick Start

### 1. Import the Module

```python
from src.systems.rebounding import simulate_rebound
```

### 2. Basic Usage

```python
# After a missed shot in your possession flow
rebound_result = simulate_rebound(
    offensive_team=offensive_team,           # List[Dict] - 5 players
    defensive_team=defensive_team,           # List[Dict] - 5 players
    offensive_strategy='standard',           # str - rebounding strategy
    defensive_strategy='standard',           # str - rebounding strategy
    shot_type='midrange',                    # str - '3pt', 'midrange', or 'rim'
    shot_made=False                          # bool - True if shot was made
)

# Check who got the rebound
if rebound_result['offensive_rebound']:
    print(f"{rebound_result['rebounder_name']} got the offensive rebound!")
else:
    print(f"{rebound_result['rebounder_name']} got the defensive rebound!")
```

## Integration with Possession Flow

### Step 1: After Shot Attempt

```python
from src.systems.shooting import attempt_shot  # Your shooting system
from src.systems.rebounding import simulate_rebound

# Take a shot
shot_made, shot_debug = attempt_shot(
    shooter=shooter,
    defender=defender,
    shot_type='3pt',
    ...
)

# If shot missed, simulate rebound
if not shot_made:
    rebound_result = simulate_rebound(
        offensive_team=offensive_team,
        defensive_team=defensive_team,
        offensive_strategy=offensive_tactics.rebounding_strategy,
        defensive_strategy=defensive_tactics.rebounding_strategy,
        shot_type='3pt',
        shot_made=False
    )
```

### Step 2: Handle Rebound Outcome

```python
if rebound_result['offensive_rebound']:
    # OFFENSIVE REBOUND
    rebounder = rebound_result['rebounder_name']

    # Check if putback or kickout
    if rebound_result['oreb_outcome'] == 'putback':
        # PUTBACK ATTEMPT
        if rebound_result['putback_made']:
            # SCORE!
            points_scored = 2
            scoring_player = rebounder
            play_by_play = f"{rebounder} MAKES THE PUTBACK! (+2 points)"
            possession_outcome = 'made_shot'
        else:
            # MISSED PUTBACK
            # Continue possession - need another rebound
            play_by_play = f"{rebounder} misses the putback attempt"
            # Recursively handle rebound of putback attempt
            # (or simplify: 50% chance offense retains, 50% defense gets it)

    else:  # kickout
        # KICKOUT - NEW POSSESSION
        shot_clock = rebound_result['shot_clock_reset']  # 14
        play_by_play = f"{rebounder} secures the offensive rebound, kicks out"
        # Continue with new shot selection
        continue_possession = True

else:
    # DEFENSIVE REBOUND
    rebounder = rebound_result['rebounder_name']
    play_by_play = f"{rebounder} secures the defensive rebound"

    # Possession changes to defense
    possession_outcome = 'defensive_rebound'

    # Check if this triggers transition
    # (Based on defensive strategy and rebounder's position)
```

### Step 3: Update Game State

```python
# Update PossessionResult
possession_result = PossessionResult(
    play_by_play_text=play_by_play,
    possession_outcome=possession_outcome,
    scoring_player=scoring_player if points_scored > 0 else None,
    rebound_player=rebound_result['rebounder_name'],
    points_scored=points_scored,
    debug={
        'shot_debug': shot_debug,
        'rebound_debug': rebound_result,
    }
)
```

## Reading Tactical Settings

### From TacticalSettings Dataclass

```python
from src.core.data_structures import TacticalSettings

# Offensive tactics
offensive_tactics = TacticalSettings(
    pace='fast',
    rebounding_strategy='crash_glass',  # ← Read this
    ...
)

# Defensive tactics
defensive_tactics = TacticalSettings(
    pace='standard',
    rebounding_strategy='prevent_transition',  # ← Read this
    ...
)

# Use in simulate_rebound
rebound_result = simulate_rebound(
    offensive_team=offensive_team,
    defensive_team=defensive_team,
    offensive_strategy=offensive_tactics.rebounding_strategy,
    defensive_strategy=defensive_tactics.rebounding_strategy,
    shot_type=shot_type,
    shot_made=shot_made
)
```

## Mapping Shot Types

### From Shot Selection to Rebound Type

```python
def map_shot_to_rebound_type(shot_type: str) -> str:
    """
    Map detailed shot type to rebound shot type.

    Args:
        shot_type: Detailed type from shot selection
                   ('3pt', 'midrange_short', 'midrange_long', 'dunk', 'layup')

    Returns:
        Rebound shot type ('3pt', 'midrange', 'rim')
    """
    if shot_type == '3pt':
        return '3pt'
    elif shot_type in ['midrange_short', 'midrange_long']:
        return 'midrange'
    elif shot_type in ['dunk', 'layup']:
        return 'rim'
    else:
        raise ValueError(f"Unknown shot type: {shot_type}")

# Usage
shot_type_detailed = '3pt'
rebound_shot_type = map_shot_to_rebound_type(shot_type_detailed)

rebound_result = simulate_rebound(
    ...,
    shot_type=rebound_shot_type,
    ...
)
```

## Handling Putback Rebounds

### Simplified Approach (Recommended for Milestone 1)

After a missed putback, simplify by assigning possession probabilistically:

```python
if rebound_result['oreb_outcome'] == 'putback':
    if not rebound_result['putback_made']:
        # Missed putback - simplified rebound
        # 70% chance defense gets it (close to basket, defense has advantage)
        import random
        if random.random() < 0.7:
            possession_changes = True
            play_by_play += "\nDefense secures the rebound"
        else:
            # Offense retains
            shot_clock = 14
            play_by_play += "\nOffense retains possession"
            continue_possession = True
```

### Full Recursive Approach (Milestone 2+)

For full realism, simulate rebound of putback attempt:

```python
if rebound_result['oreb_outcome'] == 'putback':
    if not rebound_result['putback_made']:
        # Simulate rebound of putback
        putback_rebound = simulate_rebound(
            offensive_team=offensive_team,
            defensive_team=defensive_team,
            offensive_strategy='standard',  # No strategy on putback rebounds
            defensive_strategy='standard',
            shot_type='rim',  # Putbacks are always rim attempts
            shot_made=False
        )

        # Handle second-level rebound
        # (Could recurse further, but typically stop at 2 levels)
```

## Debug Output

### Minimal Output

```python
rebound_result = simulate_rebound(...)

print(f"Rebounder: {rebound_result['rebounder_name']}")
print(f"Offensive: {rebound_result['offensive_rebound']}")
```

### Full Debug Output

```python
from src.systems.rebounding import format_rebound_debug

rebound_result = simulate_rebound(...)

print(format_rebound_debug(rebound_result))
```

Output:
```
=== REBOUND DEBUG ===

Shot Type: midrange
Offensive Strategy: standard
Defensive Strategy: standard

[REBOUNDERS]
Offensive (2): Player1, Player2
Defensive (3): Player3, Player4, Player5

[TEAM STRENGTH]
Offensive Composite: 65.40
Defensive Composite: 57.50 (includes 15% advantage)

[OREB PROBABILITY]
Base Rate: 27.0%
Shot Type Modifier: +0.0%
Strategy Modifier: +0.0%
Strength Probability: 53.2%
Final OREB Probability: 37.5%

[RESULT]
Roll: 0.234
Outcome: OFFENSIVE REBOUND
Rebounder: Player1 (PG)
Rebounder Composite: 68.50

[OFFENSIVE REBOUND OUTCOME]
Putback Attempted: NO (height 72 <= 75)
Outcome: KICKOUT (new possession)
Shot Clock Reset: 14 seconds
```

## Common Integration Patterns

### Pattern 1: Simple Possession Flow

```python
def simulate_possession(offensive_team, defensive_team, tactics_off, tactics_def):
    # Shot selection
    shooter = select_shooter(offensive_team, tactics_off)
    shot_type = select_shot_type(shooter, tactics_off)

    # Shot attempt
    defender = get_defender(shooter, defensive_team)
    shot_made, shot_debug = attempt_shot(shooter, defender, shot_type)

    if shot_made:
        return PossessionResult(
            possession_outcome='made_shot',
            points_scored=2 if shot_type != '3pt' else 3,
            scoring_player=shooter['name'],
        )

    # Rebound
    rebound_result = simulate_rebound(
        offensive_team, defensive_team,
        tactics_off.rebounding_strategy,
        tactics_def.rebounding_strategy,
        map_shot_type(shot_type),
        False
    )

    if rebound_result['offensive_rebound']:
        if rebound_result['oreb_outcome'] == 'putback' and rebound_result['putback_made']:
            return PossessionResult(
                possession_outcome='made_shot',
                points_scored=2,
                scoring_player=rebound_result['rebounder_name'],
                rebound_player=rebound_result['rebounder_name'],
            )
        else:
            # Continue possession (recursive or iterative)
            return simulate_possession(offensive_team, defensive_team, tactics_off, tactics_def)
    else:
        return PossessionResult(
            possession_outcome='defensive_rebound',
            rebound_player=rebound_result['rebounder_name'],
        )
```

### Pattern 2: Transition Check After Rebound

```python
def check_transition_opportunity(rebound_result, defensive_tactics):
    """
    Determine if defensive rebound triggers fast break.

    Args:
        rebound_result: Result from simulate_rebound
        defensive_tactics: Defensive team's tactical settings

    Returns:
        bool: True if transition triggered
    """
    # Only defensive rebounds can trigger transition
    if rebound_result['offensive_rebound']:
        return False

    # Prevent transition strategy reduces transition chance
    if defensive_tactics.rebounding_strategy == 'prevent_transition':
        # More defenders back, but offense also retreating
        transition_chance = 0.30  # 30% chance
    elif defensive_tactics.rebounding_strategy == 'crash_glass':
        # Defense committed to boards, easier to push
        transition_chance = 0.60  # 60% chance
    else:  # standard
        transition_chance = 0.45  # 45% chance

    # Check rebounder's position/speed for outlet pass
    rebounder = next(p for p in defensive_team if p['name'] == rebound_result['rebounder_name'])

    if rebounder['position'] in ['PG', 'SG']:
        # Guards more likely to push
        transition_chance += 0.15

    return random.random() < transition_chance
```

### Pattern 3: Stamina Integration

```python
from src.core.probability import apply_stamina_to_player

# Before rebound simulation, apply stamina degradation
offensive_team_fatigued = [
    apply_stamina_to_player(p, current_stamina=player_stamina[p['name']])
    for p in offensive_team
]

defensive_team_fatigued = [
    apply_stamina_to_player(p, current_stamina=player_stamina[p['name']])
    for p in defensive_team
]

# Now simulate with fatigued players
rebound_result = simulate_rebound(
    offensive_team_fatigued,
    defensive_team_fatigued,
    ...
)

# Deduct stamina cost for rebounding
for player in [offensive_team, defensive_team]:
    if player['name'] == rebound_result['rebounder_name']:
        player_stamina[player['name']] -= STAMINA_COST_REBOUND  # 0.8
```

## Error Handling

### Validation

```python
from src.core.data_structures import validate_team

# Validate teams before simulation
try:
    validate_team(offensive_team)
    validate_team(defensive_team)
except ValueError as e:
    print(f"Invalid team: {e}")
    # Handle error
```

### Strategy Validation

```python
valid_strategies = ['crash_glass', 'standard', 'prevent_transition']

if offensive_strategy not in valid_strategies:
    raise ValueError(f"Invalid offensive_strategy: {offensive_strategy}")

if defensive_strategy not in valid_strategies:
    raise ValueError(f"Invalid defensive_strategy: {defensive_strategy}")
```

### Shot Type Validation

```python
valid_shot_types = ['3pt', 'midrange', 'rim']

if shot_type not in valid_shot_types:
    raise ValueError(f"Invalid shot_type: {shot_type}")
```

## Performance Considerations

### Caching Composites (Optional)

For high-frequency simulations, consider caching rebounding composites:

```python
from src.core.probability import calculate_composite
from src.constants import WEIGHTS_REBOUND

# Pre-calculate composites once
def precompute_rebounding_composites(team):
    for player in team:
        player['_rebound_composite'] = calculate_composite(player, WEIGHTS_REBOUND)
    return team

offensive_team = precompute_rebounding_composites(offensive_team)
defensive_team = precompute_rebounding_composites(defensive_team)

# Modify select_rebounder to use cached composites
```

Note: Current implementation is fast enough (<1ms) that caching is unnecessary for Milestone 1.

## Testing Your Integration

### Unit Test Template

```python
def test_possession_with_rebound():
    """Test full possession flow including rebound."""
    from src.core.probability import set_seed

    set_seed(42)

    # Setup
    offensive_team = create_test_team('Offense')
    defensive_team = create_test_team('Defense')

    # Simulate
    result = simulate_possession(
        offensive_team,
        defensive_team,
        offensive_tactics,
        defensive_tactics
    )

    # Verify
    assert result.possession_outcome in ['made_shot', 'defensive_rebound']
    if result.rebound_player:
        assert result.rebound_player in [p['name'] for p in offensive_team + defensive_team]
```

## Troubleshooting

### Issue: OREB rates too high/low

**Check:**
1. Are you using the correct rebounding strategy from tactics?
2. Are composites calculated correctly (all 6 attributes)?
3. Is defensive advantage applied (1.15x)?

**Debug:**
```python
print(format_rebound_debug(rebound_result))
# Check "Defensive Composite" line - should show "(includes 15% advantage)"
```

### Issue: Putbacks not occurring

**Check:**
1. Are offensive rebounders tall enough (height > 75)?
2. Is the rebounder getting selected (check `rebounder_name`)?

**Debug:**
```python
print(f"Rebounder height: {rebound_result['putback_debug']['rebounder_height']}")
print(f"Threshold: {rebound_result['putback_debug']['height_threshold']}")
```

### Issue: Shot clock not resetting

**Check:**
1. Are you reading `shot_clock_reset` from result?
2. Is it only on offensive rebounds?

**Fix:**
```python
if rebound_result['offensive_rebound']:
    shot_clock = rebound_result['shot_clock_reset']  # Always 14
```

## Complete Example

See `demo_rebounding.py` for complete working examples.

---

**Questions or Issues?**
Consult `REBOUNDING_SYSTEM.md` for detailed documentation.

**Test Coverage:**
Run `python -m pytest tests/test_rebounding.py -v` to verify implementation.
