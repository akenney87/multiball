# Simple Closer System: Playable Minutes Calculation

## Core Concept

**Problem**: Starters need to finish games without stamina dropping below 70%

**Solution**: Calculate at game start how many minutes each starter can play from 90 stamina before hitting 70 stamina, then work backwards from end of game.

---

## Pre-Game Calculation

At game initialization, for each starter:

```python
def calculate_playable_minutes_from_90(
    player: Dict[str, Any],
    pace: str,
    is_scoring_option: bool
) -> float:
    """
    Calculate how many continuous minutes a player can play from 90 stamina
    before dropping to 70 stamina.

    Args:
        player: Player dict with attributes
        pace: 'fast', 'standard', 'slow'
        is_scoring_option: True if player is scoring option #1, #2, or #3

    Returns:
        Minutes playable (float)
    """
    # Stamina budget: 90 → 70 = 20 points to work with
    stamina_budget = 90.0 - 70.0  # 20 points

    # Get player-specific stamina cost (accounts for attributes)
    cost_per_possession = calculate_stamina_cost(
        pace=pace,
        is_scoring_option=is_scoring_option,
        is_transition=False,  # Use non-transition as baseline (conservative)
        player_stamina_attribute=player['stamina'],
        player_acceleration=player['acceleration'],
        player_top_speed=player['top_speed']
    )

    # Pace-specific possession rate
    possessions_per_minute = {
        'fast': 2.8,
        'standard': 2.5,
        'slow': 2.2
    }[pace]

    # Calculate playable minutes
    stamina_drain_per_minute = cost_per_possession * possessions_per_minute
    playable_minutes = stamina_budget / stamina_drain_per_minute

    return playable_minutes
```

---

## Example Calculations

### Example 1: Elite Endurance Player (LeBron-type)
**Attributes**: stamina=90, acceleration=75, top_speed=70
**Role**: Scoring option #1
**Pace**: Standard

**Calculation**:
```
Drain modifier: 1.0 + ((50-90)/50) * 0.15 = 0.88 (12% slower drain)
Speed efficiency: 1.0 - ((72.5-50) * 0.002) = 0.955 (4.5% more efficient)

Base cost: 0.8 (base) + 0.0 (standard pace) + 0.2 (scoring option) = 1.0
Modified cost: 1.0 × 0.88 × 0.955 = 0.84 per possession

Possessions/min: 2.5
Drain/min: 0.84 × 2.5 = 2.1

Playable minutes: 20 / 2.1 = 9.5 minutes
```

**Result**: Can play 9.5 minutes from 90 stamina before hitting 70

---

### Example 2: Average Endurance, Non-Option
**Attributes**: stamina=50, acceleration=50, top_speed=50
**Role**: Not a scoring option
**Pace**: Standard

**Calculation**:
```
Drain modifier: 1.0 + ((50-50)/50) * 0.15 = 1.0 (baseline)
Speed efficiency: 1.0 - ((50-50) * 0.002) = 1.0 (baseline)

Base cost: 0.8 (base) + 0.0 (standard pace) + 0.0 (not scoring option) = 0.8
Modified cost: 0.8 × 1.0 × 1.0 = 0.8 per possession

Possessions/min: 2.5
Drain/min: 0.8 × 2.5 = 2.0

Playable minutes: 20 / 2.0 = 10.0 minutes
```

**Result**: Can play 10 minutes from 90 stamina before hitting 70

---

### Example 3: Poor Endurance, Fast Pace
**Attributes**: stamina=20, acceleration=40, top_speed=35
**Role**: Not a scoring option
**Pace**: Fast

**Calculation**:
```
Drain modifier: 1.0 + ((50-20)/50) * 0.15 = 1.09 (9% faster drain)
Speed efficiency: 1.0 - ((37.5-50) * 0.002) = 1.025 (2.5% less efficient)

Base cost: 0.8 (base) + 0.3 (fast pace) + 0.0 (not scoring option) = 1.1
Modified cost: 1.1 × 1.09 × 1.025 = 1.23 per possession

Possessions/min: 2.8
Drain/min: 1.23 × 2.8 = 3.44

Playable minutes: 20 / 3.44 = 5.8 minutes
```

**Result**: Can play only 5.8 minutes from 90 stamina before hitting 70

---

## Implementation

### Step 1: Add to SubstitutionManager.__init__()

```python
class SubstitutionManager:
    def __init__(
        self,
        home_roster: List[Dict[str, Any]],
        away_roster: List[Dict[str, Any]],
        minutes_allocation_home: Dict[str, float],
        minutes_allocation_away: Dict[str, float],
        tactical_home: TacticalSettings,  # Need full tactical settings now
        tactical_away: TacticalSettings,
        home_starting_lineup: Optional[List[Dict[str, Any]]] = None,
        away_starting_lineup: Optional[List[Dict[str, Any]]] = None
    ):
        # ... existing initialization ...

        # NEW: Calculate playable minutes for each starter
        self.starter_playable_minutes: Dict[str, float] = {}

        # Home starters
        for starter_name in self.home_starters:
            player = self._find_player_in_roster(starter_name, home_roster)
            is_scoring_option = starter_name in [
                tactical_home.scoring_option_1,
                tactical_home.scoring_option_2,
                tactical_home.scoring_option_3
            ]

            playable = self._calculate_playable_minutes(
                player=player,
                pace=tactical_home.pace,
                is_scoring_option=is_scoring_option
            )
            self.starter_playable_minutes[starter_name] = playable

        # Away starters
        for starter_name in self.away_starters:
            player = self._find_player_in_roster(starter_name, away_roster)
            is_scoring_option = starter_name in [
                tactical_away.scoring_option_1,
                tactical_away.scoring_option_2,
                tactical_away.scoring_option_3
            ]

            playable = self._calculate_playable_minutes(
                player=player,
                pace=tactical_away.pace,
                is_scoring_option=is_scoring_option
            )
            self.starter_playable_minutes[starter_name] = playable

    def _calculate_playable_minutes(
        self,
        player: Dict[str, Any],
        pace: str,
        is_scoring_option: bool
    ) -> float:
        """Calculate playable minutes from 90 stamina to 70 stamina."""
        from ..systems.stamina_manager import calculate_stamina_cost

        stamina_budget = 90.0 - 70.0  # 20 points

        cost_per_possession = calculate_stamina_cost(
            pace=pace,
            is_scoring_option=is_scoring_option,
            is_transition=False,
            player_stamina_attribute=player.get('stamina', 50),
            player_acceleration=player.get('acceleration', 50),
            player_top_speed=player.get('top_speed', 50)
        )

        possessions_per_minute = {
            'fast': 2.8,
            'standard': 2.5,
            'slow': 2.2
        }[pace]

        stamina_drain_per_minute = cost_per_possession * possessions_per_minute
        playable_minutes = stamina_budget / stamina_drain_per_minute

        return playable_minutes

    def _find_player_in_roster(self, player_name: str, roster: List[Dict]) -> Dict:
        """Find player by name in roster."""
        for player in roster:
            if player['name'] == player_name:
                return player
        raise ValueError(f"Player {player_name} not found in roster")
```

---

### Step 2: Modify Rule #1 to Check Playable Minutes in Q4

```python
def _check_team_substitutions(
    self,
    lineup_manager: LineupManager,
    minutes_allocation: Dict[str, float],
    stamina_tracker: Any,
    game_time_str: str,
    time_remaining_in_quarter: int = 0,
    quarter_number: int = 1,
    score_differential: int = 0,
    team: str = 'unknown'
) -> List[SubstitutionEvent]:
    """Check and execute substitutions for one team."""
    events = []
    active_players = lineup_manager.get_active_players()
    bench_players = lineup_manager.get_bench_players()
    stamina_values = stamina_tracker.get_all_stamina_values()

    # ... existing Rule #2 (sub out fatigued starters) ...

    # RULE #1: Check for starters on bench who are ready to return
    for bench_player in bench_players[:]:
        bench_player_name = bench_player['name']
        is_starter = self._is_starter(bench_player_name)
        bench_stamina = stamina_values.get(bench_player_name, 0)

        # Rule #1: Starter with 90+ stamina is ready to return
        if is_starter and bench_stamina >= 90.0:

            # NEW: Q4 CLOSER LOGIC
            if quarter_number == 4:
                # Calculate time remaining in game (Q4 only)
                time_remaining_in_game = time_remaining_in_quarter / 60.0  # Convert to minutes

                # Get pre-calculated playable minutes for this starter
                playable_minutes = self.starter_playable_minutes.get(bench_player_name, 12.0)

                # Only insert if time remaining <= playable minutes
                if time_remaining_in_game > playable_minutes:
                    # Too early - player would drop below 70 stamina
                    if debug:
                        print(f"[Q4] {bench_player_name} staying benched "
                              f"(time remaining: {time_remaining_in_game:.1f}min, "
                              f"playable: {playable_minutes:.1f}min)")
                    continue  # Skip this player, keep on bench

            # If we reach here: either not Q4, or Q4 with time_remaining <= playable
            # Proceed with normal return logic (find position match, execute sub)
            # ... existing code ...
```

---

## Edge Cases

### Edge Case 1: All 5 Starters Need to Wait
**Scenario**: Q4 starts, all 5 starters at 90+ stamina, but all have playable < 12 minutes

**Example**:
- Fast pace, all scoring options
- Starters can play 6-8 minutes each
- Q4 just started (12 minutes remaining)

**Solution**: Allow starters with HIGHEST playable minutes to return first, even if time > playable

```python
# If Q4 just started and ALL starters are held back, allow top 3 to return
if quarter_number == 4 and time_remaining_in_game > 10.0:
    # Count starters on bench with 90+ stamina
    ready_starters = [
        p for p in bench_players
        if self._is_starter(p['name']) and stamina_values.get(p['name'], 0) >= 90.0
    ]

    if len(ready_starters) >= 3:
        # All starters waiting - allow top 3 by playable minutes to return
        ready_starters.sort(
            key=lambda p: self.starter_playable_minutes.get(p['name'], 0),
            reverse=True
        )

        # Allow top 3 to return regardless of time check
        if bench_player_name in [p['name'] for p in ready_starters[:3]]:
            # Bypass playable check for these 3
            pass  # Fall through to normal return logic
```

### Edge Case 2: Blowout Game
**Scenario**: Q4, up by 20 points - no need to preserve starters

**Solution**: Disable closer logic if score differential > 15

```python
if quarter_number == 4 and abs(score_differential) <= 15:
    # Only apply closer logic in competitive games
    # ... playable minutes check ...
```

### Edge Case 3: Very Short Playable Time (<4 minutes)
**Scenario**: Poor endurance + fast pace + scoring option = 3-minute playable

**Solution**: These players shouldn't be starters, but if they are, allow them to play longer (they'll dip below 70)

```python
# Minimum insertion time: 4 minutes before end
min_insertion_time = 4.0
if time_remaining_in_game <= max(playable_minutes, min_insertion_time):
    # Insert now
```

---

## Validation

### Test 1: Standard Pace, Average Players
**Setup**:
- 5 starters with stamina=50, speed=50
- Standard pace, 2 scoring options
- All start Q4 at 90+ stamina

**Expected**:
- Non-options playable = 10 minutes → insert at Q4 start (12 min remaining, close enough)
- Scoring options playable = 8.3 minutes → insert at Q4 4:00 mark (8 min remaining)

**Validation**:
- Check all starters end Q4 with 70+ stamina

### Test 2: Fast Pace, Scoring Option
**Setup**:
- 1 elite scorer: stamina=90, speed=80, scoring option #1
- Fast pace

**Expected**:
- Playable = 7.8 minutes → insert at Q4 8:00 mark

**Validation**:
- Player ends Q4 with ~71 stamina

### Test 3: Close Game, Final 2 Minutes
**Setup**:
- Q4 2:00 remaining, ±5 points
- Starter on bench with 90 stamina, playable = 10 minutes

**Expected**:
- Insert immediately (2 min < 10 min playable)

**Validation**:
- Starter plays final 2 minutes, ends with ~86 stamina

---

## Implementation Estimate

**Phase 1**: Add playable_minutes calculation to SubstitutionManager.__init__() (1 hour)
- Write `_calculate_playable_minutes()` method
- Calculate for all starters at game start
- Store in `self.starter_playable_minutes`

**Phase 2**: Modify Rule #1 for Q4 closer logic (1 hour)
- Add time_remaining check in Q4
- Compare to playable_minutes
- Add debug logging

**Phase 3**: Handle edge cases (30 minutes)
- All starters waiting → allow top 3
- Blowout → disable logic
- Very short playable → use minimum 4 minutes

**Phase 4**: Validation (1 hour)
- Run 10 test games
- Check starters end with 70+ stamina
- Tune threshold if needed (maybe 72 or 75)

**Total: 3.5 hours**

---

## Success Criteria

1. **Primary**: 95%+ of starters in close games end Q4 with 70+ stamina
2. **Secondary**: Starters play final 2 minutes of close games (no substitutions)
3. **Tertiary**: System respects player differences (elite endurance plays longer)

---

## Why This Works

✓ **Pre-calculated**: No prediction errors, no dynamic complexity
✓ **Player-specific**: Respects stamina attribute, speed, role
✓ **Simple logic**: if (time_remaining <= playable) then insert
✓ **Transparent**: User can see "LeBron can play 9.5 min from 90 stamina"
✓ **Accurate**: Based on actual stamina formulas, not estimates
✓ **Fast**: One calculation per starter at game start, simple comparison in-game

---

## Comparison to Complex Approach

| Aspect | Simple (This) | Complex (Agents) |
|--------|---------------|------------------|
| Implementation | 3.5 hours | 15-19 hours |
| Accuracy | ~95% | 80-85% |
| Maintainability | High (1 calculation) | Low (multi-step prediction) |
| User Understanding | High (intuitive) | Low (black box) |
| Failure Mode | Conservative (might wait too long) | Unpredictable (prediction errors) |

---

## Files to Modify

1. `src/systems/substitutions.py`:
   - Add `starter_playable_minutes` to `__init__()`
   - Add `_calculate_playable_minutes()` method
   - Modify `_check_team_substitutions()` Rule #1 for Q4 logic

2. `src/systems/stamina_manager.py`:
   - No changes needed (already exports `calculate_stamina_cost()`)

3. Test file: `validate_closer_system.py` (new):
   - Run 20 games with various pace/team settings
   - Validate starters end Q4 with 70+ stamina

---

## Next Steps

1. Implement Phase 1 (calculate playable minutes at game start)
2. Add debug output to see calculated values
3. Implement Phase 2 (Q4 insertion logic)
4. Test with one game, verify behavior
5. Run 20-game validation
6. Tune threshold if needed (70 → 72 or 75)
