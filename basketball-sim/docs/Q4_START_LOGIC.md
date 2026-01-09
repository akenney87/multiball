# Q4 Start Logic: Complete Closer System

## Overview

At the start of Q4, evaluate EVERY starter to determine optimal rotation for finishing the game.

**Two Cases**:
1. **Starter on bench**: When can they be inserted?
2. **Starter on court**: Can they finish without dropping below 70? If not, sub them out and calculate recovery time.

---

## Case 1: Starter on Bench

**Question**: When can this starter be inserted so they finish the game at 70+ stamina?

**Calculation**:
```python
def calculate_insertion_time(player, current_stamina, pace, is_scoring_option):
    """
    Calculate when a benched starter can be inserted to finish the game.

    Returns: minutes from Q4 start when player should be inserted
    """
    # Stamina budget: current → 70
    stamina_budget = current_stamina - 70.0

    # Get player-specific drain rate
    cost_per_possession = calculate_stamina_cost(
        pace=pace,
        is_scoring_option=is_scoring_option,
        is_transition=False,
        player_stamina_attribute=player['stamina'],
        player_acceleration=player['acceleration'],
        player_top_speed=player['top_speed']
    )

    # Add transition weighting (20% of possessions)
    cost_transition = calculate_stamina_cost(
        pace=pace,
        is_scoring_option=is_scoring_option,
        is_transition=True,
        player_stamina_attribute=player['stamina'],
        player_acceleration=player['acceleration'],
        player_top_speed=player['top_speed']
    )

    transition_rate = 0.20
    avg_cost = (1 - transition_rate) * cost_per_possession + transition_rate * cost_transition

    # Calculate drain per minute
    possessions_per_minute = {'fast': 2.8, 'standard': 2.5, 'slow': 2.2}[pace]
    drain_per_minute = avg_cost * possessions_per_minute

    # Calculate playable minutes
    playable_minutes = stamina_budget / drain_per_minute

    return playable_minutes
```

**Example 1: Starter at 90 stamina**
```
Budget: 90 - 70 = 20
Drain: 0.9 per possession (with transition)
Possessions/min: 2.5
Drain/min: 2.25
Playable: 20 / 2.25 = 8.9 minutes

Insertion time: Q4 9:00 mark (8.9 ≈ 9 minutes before end)
```

**Example 2: Starter at 85 stamina** (didn't fully recover in Q3)
```
Budget: 85 - 70 = 15
Drain/min: 2.25
Playable: 15 / 2.25 = 6.7 minutes

Insertion time: Q4 7:00 mark (6.7 ≈ 7 minutes before end)
```

**Example 3: Starter at 75 stamina** (played late in Q3)
```
Budget: 75 - 70 = 5
Drain/min: 2.25
Playable: 5 / 2.25 = 2.2 minutes

Insertion time: Q4 2:00 mark (final 2 minutes only)
```

---

## Case 2: Starter on Court

**Question**: Can this starter play all 12 minutes of Q4 without dropping below 70?

### Scenario A: Can Finish (Stay In)

```python
def can_finish_quarter(player, current_stamina, pace, is_scoring_option):
    """
    Check if active starter can play all of Q4 (12 minutes) and stay above 70.

    Returns: (can_finish: bool, minutes_playable: float)
    """
    # Calculate playable minutes from current stamina
    playable_minutes = calculate_insertion_time(player, current_stamina, pace, is_scoring_option)

    # Q4 is 12 minutes
    if playable_minutes >= 12.0:
        return (True, playable_minutes)
    else:
        return (False, playable_minutes)
```

**Example: Starter at 95 stamina**
```
Budget: 95 - 70 = 25
Drain/min: 2.25
Playable: 25 / 2.25 = 11.1 minutes

Result: Cannot finish (11.1 < 12.0)
Action: Sub out and calculate recovery time
```

**Example: Starter at 100 stamina**
```
Budget: 100 - 70 = 30
Drain/min: 2.25
Playable: 30 / 2.25 = 13.3 minutes

Result: Can finish (13.3 > 12.0)
Action: Keep in for entire Q4
```

### Scenario B: Cannot Finish (Sub Out)

**Question**: How long does this starter need to rest on the bench before they can play the REST of Q4?

**Calculation**:
```python
def calculate_required_bench_time(player, current_stamina, time_remaining_in_q4, pace, is_scoring_option):
    """
    Calculate how long a starter needs to rest before they can finish Q4.

    Args:
        current_stamina: Player's current stamina (e.g., 78)
        time_remaining_in_q4: Minutes remaining in Q4 (e.g., 12.0 at start)

    Returns: minutes needed on bench
    """
    # Step 1: Calculate drain rate
    cost_per_possession = calculate_stamina_cost(...)
    cost_transition = calculate_stamina_cost(..., is_transition=True)
    avg_cost = 0.8 * cost_per_possession + 0.2 * cost_transition

    possessions_per_minute = {'fast': 2.8, 'standard': 2.5, 'slow': 2.2}[pace]
    drain_per_minute = avg_cost * possessions_per_minute

    # Step 2: Calculate target stamina needed
    # To play time_remaining_in_q4 minutes and end at 70:
    stamina_needed = 70.0 + (drain_per_minute * time_remaining_in_q4)

    # Step 3: Calculate stamina deficit
    stamina_deficit = stamina_needed - current_stamina

    if stamina_deficit <= 0:
        # Already have enough stamina
        return 0.0

    # Step 4: Calculate recovery rate
    # Recovery is exponential: 8 * (1 - current/100)
    player_stamina_attr = player.get('stamina', 50)
    recovery_modifier = 1.0 + ((player_stamina_attr - 50) / 50.0) * 0.13

    # Use average stamina during recovery (current → stamina_needed)
    avg_stamina_during_recovery = (current_stamina + stamina_needed) / 2.0
    avg_recovery_rate = 8.0 * (1 - avg_stamina_during_recovery / 100.0) * recovery_modifier

    # Step 5: Calculate time needed
    bench_time_needed = stamina_deficit / avg_recovery_rate

    return bench_time_needed
```

**Example: Starter at 78 stamina, Q4 start (12 min remaining)**

**Step 1: Calculate drain rate**
```
avg_cost = 0.9 per possession
possessions/min = 2.5
drain/min = 2.25
```

**Step 2: Calculate target stamina**
```
To play 12 minutes and end at 70:
stamina_needed = 70 + (2.25 × 12) = 70 + 27 = 97 stamina
```

**Step 3: Calculate deficit**
```
Current: 78
Needed: 97
Deficit: 97 - 78 = 19 stamina points
```

**Step 4: Calculate recovery rate**
```
Player stamina attr: 50 (average)
Recovery modifier: 1.0
Avg stamina during recovery: (78 + 97) / 2 = 87.5
Avg recovery rate: 8 × (1 - 0.875) × 1.0 = 1.0 per minute
```

**Step 5: Calculate bench time**
```
Bench time needed: 19 / 1.0 = 19 minutes
```

**PROBLEM**: Need 19 minutes on bench, but Q4 is only 12 minutes!

**Solution**: This player CANNOT finish all of Q4. Calculate what they CAN do:
- They can play their current playable minutes: (78-70)/2.25 = 3.6 minutes
- Sub out after 3.6 minutes (Q4 8:30 mark)
- Let them recover on bench for remaining 8.5 minutes
- Re-insert at Q4 0:00 (they won't be fresh, but best we can do)

---

## Complete Q4 Start Algorithm

```python
def handle_q4_start(
    sub_manager: SubstitutionManager,
    stamina_tracker: StaminaTracker,
    lineup_manager: LineupManager,
    pace: str,
    scoring_options: List[str]
):
    """
    At Q4 start (time_remaining = 720 seconds = 12 minutes),
    evaluate every starter and make optimal rotation decisions.
    """
    active_players = lineup_manager.get_active_players()
    bench_players = lineup_manager.get_bench_players()

    decisions = []

    # Evaluate each starter
    for starter_name in sub_manager.home_starters:  # Do same for away
        player = sub_manager._find_player_in_roster(starter_name, home_roster)
        current_stamina = stamina_tracker.get_current_stamina(starter_name)
        is_scoring_option = starter_name in scoring_options

        # Check if starter is on court or bench
        is_active = any(p['name'] == starter_name for p in active_players)

        if is_active:
            # CASE 2: Starter on court
            can_finish, playable_minutes = can_finish_quarter(
                player, current_stamina, pace, is_scoring_option
            )

            if can_finish:
                # Can play all 12 minutes - leave them in
                decision = {
                    'player': starter_name,
                    'action': 'STAY_IN',
                    'reason': f'Can finish Q4 ({playable_minutes:.1f} min playable)',
                    'current_stamina': current_stamina
                }
                decisions.append(decision)
            else:
                # Cannot finish - need to sub out and calculate bench time
                bench_time_needed = calculate_required_bench_time(
                    player, current_stamina, 12.0, pace, is_scoring_option
                )

                if bench_time_needed > 12.0:
                    # Cannot recover enough in Q4 - manage strategically
                    # Play current playable minutes, then rest
                    decision = {
                        'player': starter_name,
                        'action': 'SUB_OUT_PARTIAL',
                        'reason': f'Insufficient stamina for full Q4 (playable: {playable_minutes:.1f} min)',
                        'play_until': 12.0 - playable_minutes,  # Minutes into Q4 to sub out
                        'current_stamina': current_stamina
                    }
                else:
                    # Can recover - sub out now, return later
                    return_time = 12.0 - bench_time_needed
                    decision = {
                        'player': starter_name,
                        'action': 'SUB_OUT_NOW',
                        'reason': f'Need {bench_time_needed:.1f} min bench time to finish Q4',
                        'return_at': return_time,  # Q4 time to re-insert
                        'current_stamina': current_stamina
                    }
                decisions.append(decision)

        else:
            # CASE 1: Starter on bench
            insertion_time = calculate_insertion_time(
                player, current_stamina, pace, is_scoring_option
            )

            decision = {
                'player': starter_name,
                'action': 'INSERT_AT',
                'reason': f'Insert to play final {insertion_time:.1f} minutes',
                'insert_at': 12.0 - insertion_time,  # Q4 time to insert
                'current_stamina': current_stamina
            }
            decisions.append(decision)

    return decisions
```

---

## Decision Examples

### Example 1: All Starters Fresh
**Q4 Start State**:
- PG: On court, 100 stamina → playable 13.3 min → **STAY_IN**
- SG: On court, 98 stamina → playable 12.4 min → **STAY_IN**
- SF: On bench, 95 stamina → playable 11.1 min → **INSERT_AT Q4 1:00**
- PF: On bench, 92 stamina → playable 9.8 min → **INSERT_AT Q4 2:00**
- C: On court, 96 stamina → playable 11.6 min → **SUB_OUT_NOW, return at Q4 0:30**

**Rotation**:
- Q4 12:00-0:30: PG, SG stay in. SF inserts at 11:00, PF at 10:00. C subs out immediately.
- Q4 0:30-0:00: All 5 starters on court for final stretch.

### Example 2: Starters Fatigued
**Q4 Start State**:
- PG: On court, 85 stamina → playable 6.7 min → **SUB_OUT_NOW, return at Q4 5:30**
- SG: On court, 82 stamina → playable 5.3 min → **SUB_OUT_NOW, return at Q4 6:30**
- SF: On bench, 78 stamina → playable 3.6 min → **INSERT_AT Q4 4:00**
- PF: On bench, 88 stamina → playable 8.0 min → **INSERT_AT Q4 4:00**
- C: On court, 90 stamina → playable 8.9 min → **SUB_OUT_NOW, return at Q4 3:30**

**Rotation**:
- Q4 12:00-6:30: Bench unit plays while starters recover
- Q4 6:30-4:00: PG, SG return. Bench unit continues.
- Q4 4:00-3:30: SF, PF insert. C still resting.
- Q4 3:30-0:00: All 5 starters on court for final stretch.

### Example 3: Mixed State
**Q4 Start State**:
- PG: On bench, 95 stamina → playable 11.1 min → **INSERT_AT Q4 1:00**
- SG: On court, 100 stamina → playable 13.3 min → **STAY_IN**
- SF: On court, 92 stamina → playable 9.8 min → **SUB_OUT_NOW, return at Q4 2:30**
- PF: On bench, 88 stamina → playable 8.0 min → **INSERT_AT Q4 4:00**
- C: On court, 75 stamina → playable 2.2 min → **SUB_OUT_PARTIAL, play until Q4 10:00**

**Rotation**:
- Q4 12:00-11:00: SG, C stay in. SF subs out. Bench fills.
- Q4 11:00-10:00: PG inserts. C continues.
- Q4 10:00: C subs out (played his 2 min). Bench C enters.
- Q4 4:00-2:30: PF inserts. SF returns.
- Q4 2:30-0:00: All 5 starters on court.

---

## Implementation Integration

Add this to `SubstitutionManager`:

```python
class SubstitutionManager:
    def __init__(self, ...):
        # ... existing init ...

        # Track Q4 decisions (calculated at Q4 start)
        self.q4_decisions: Dict[str, Dict] = {}
        self.q4_start_processed = False

    def check_and_execute_substitutions(
        self,
        stamina_tracker,
        game_time_str,
        time_remaining_in_quarter: int = 0,
        quarter_number: int = 1,
        # ... other params ...
    ):
        # At Q4 start (first check in Q4)
        if quarter_number == 4 and not self.q4_start_processed:
            self.q4_start_processed = True
            self._process_q4_start(stamina_tracker, lineup_manager, pace, scoring_options)

        # ... existing substitution logic ...

        # Check Q4 decisions
        if quarter_number == 4:
            self._execute_q4_decisions(time_remaining_in_quarter, stamina_tracker, lineup_manager)

    def _process_q4_start(self, stamina_tracker, lineup_manager, pace, scoring_options):
        """Calculate Q4 rotation decisions for all starters."""
        # Run handle_q4_start() algorithm
        # Store decisions in self.q4_decisions
        pass

    def _execute_q4_decisions(self, time_remaining, stamina_tracker, lineup_manager):
        """Execute Q4 decisions at appropriate times."""
        time_remaining_min = time_remaining / 60.0

        for starter_name, decision in self.q4_decisions.items():
            if decision['action'] == 'INSERT_AT':
                if time_remaining_min <= decision['insert_at'] + 0.1:  # Small tolerance
                    # Execute insertion
                    pass

            elif decision['action'] == 'SUB_OUT_NOW':
                # Already executed at Q4 start
                # Check if time to return
                if time_remaining_min <= decision['return_at'] + 0.1:
                    # Execute return
                    pass

            elif decision['action'] == 'SUB_OUT_PARTIAL':
                if time_remaining_min <= decision['play_until'] + 0.1:
                    # Execute sub out
                    pass
```

---

## Summary

**At Q4 start, for EACH starter:**

1. **If on bench**: Calculate when to insert (playable minutes from current stamina)
2. **If on court**:
   - **Can finish?** (playable >= 12 min) → Stay in
   - **Cannot finish?** → Calculate bench time needed:
     - **Can recover in time?** → Sub out now, return later
     - **Cannot recover?** → Play current playable minutes, then rest

**Result**: Every starter has an optimal Q4 rotation plan calculated at Q4 start, based on their ACTUAL stamina and individual attributes.

---

## Validation

Test scenarios:
1. All starters at 95+ stamina → should all be inserted/kept in for full Q4
2. All starters at 75-85 stamina → should have staggered insertions/recoveries
3. Mix of fresh and fatigued → should have complex rotation plan
4. One starter at 60 stamina → should sit most of Q4, maybe play final 1-2 min

Success: 95%+ of starters in close games end Q4 with 70+ stamina.
