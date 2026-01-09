# Substitution System Documentation

## Overview

The substitution management system handles player rotations during quarter simulations based on stamina degradation and minutes allocation. It ensures realistic basketball rotation patterns while maintaining always-valid 5-player lineups.

## Architecture

### Core Components

1. **LineupManager** - Manages 5-player active lineup + bench for one team
2. **SubstitutionManager** - Coordinates substitutions for both teams
3. **SubstitutionEvent** - Immutable record of substitution occurrences
4. **Helper Functions** - Position compatibility, trigger checks, substitute selection

## Position Compatibility Rules

Basketball positions have natural compatibility based on similar skill sets:

```
Guards (Interchangeable):
  PG ↔ SG

Wings (Interchangeable):
  SF ↔ PF

Centers (Isolated):
  C ↔ C only
```

### Compatibility Matrix

```
        PG    SG    SF    PF    C
PG      ✓     ✓     ✗     ✗     ✗
SG      ✓     ✓     ✗     ✗     ✗
SF      ✗     ✗     ✓     ✓     ✗
PF      ✗     ✗     ✓     ✓     ✗
C       ✗     ✗     ✗     ✗     ✓
```

## Substitution Triggers

Substitutions are checked **after every possession** with the following priority:

### Priority 1: Stamina Threshold (Highest Priority)
- **Trigger:** Current stamina < 60
- **Reason Code:** `"stamina"`
- **Rationale:** Player is too fatigued to continue effectively

### Priority 2: Minutes Allocation
- **Trigger:** Minutes played >= allocated minutes (+ 0.1 min tolerance)
- **Reason Code:** `"minutes"`
- **Rationale:** Player has exceeded their tactical minutes target

### Priority 3: No Substitution
- **Trigger:** None of the above
- **Action:** Player remains on court

**Note:** If both stamina AND minutes triggers are active, stamina takes priority in the reason code.

## Substitute Selection Logic

When a substitution is needed, the system selects the best available substitute using this algorithm:

```python
1. Filter bench for position-compatible players
   IF compatible players exist:
       Sort by stamina (highest first)
       RETURN highest stamina compatible player
   ELSE:
       Sort all bench by stamina (highest first)
       RETURN highest stamina player (regardless of position)
```

### Selection Priority

1. **Position Match + Highest Stamina** (preferred)
2. **Highest Stamina Overall** (fallback)

### Example Scenarios

**Scenario 1: PG needs substitution**
- Bench: PG (stamina 70), SG (stamina 90), SF (stamina 95)
- Selected: **SG (stamina 90)** - Compatible position, highest stamina among guards

**Scenario 2: C needs substitution**
- Bench: PG (stamina 95), SG (stamina 90), PF (stamina 85)
- Selected: **PG (stamina 95)** - No centers available, highest stamina overall

**Scenario 3: SF needs substitution**
- Bench: SF (stamina 70), PF (stamina 85), C (stamina 90)
- Selected: **PF (stamina 85)** - Compatible position (wing), highest stamina among wings

## Data Structures

### SubstitutionEvent

Immutable record of a substitution occurrence:

```python
@dataclass
class SubstitutionEvent:
    quarter_time: str      # "8:32" - game clock when sub occurred
    player_out: str        # Name of player exiting
    player_in: str         # Name of player entering
    reason: str            # "stamina" | "minutes" | "injury"
    stamina_out: float     # Stamina of exiting player (0-100)
    stamina_in: float      # Stamina of entering player (0-100)
```

## API Reference

### LineupManager

**Constructor:**
```python
LineupManager(team: List[Dict[str, Any]])
```
- **team**: Full roster (10-13 players), first 5 are starters

**Methods:**
- `get_active_players() -> List[Dict]` - Returns current 5-player lineup
- `get_bench_players() -> List[Dict]` - Returns bench players
- `get_player_by_name(name: str) -> Optional[Dict]` - Find player by name
- `substitute(player_out: Dict, player_in: Dict) -> bool` - Execute substitution
- `validate_lineup() -> bool` - Check lineup has exactly 5 players

### SubstitutionManager

**Constructor:**
```python
SubstitutionManager(
    home_roster: List[Dict],
    away_roster: List[Dict],
    minutes_allocation_home: Dict[str, float],
    minutes_allocation_away: Dict[str, float]
)
```

**Methods:**
- `check_and_execute_substitutions(stamina_tracker, game_time_str) -> List[SubstitutionEvent]`
  - Checks both teams for substitution needs
  - Executes all necessary substitutions
  - Returns list of events that occurred

- `get_home_active() -> List[Dict]` - Get home team active lineup
- `get_away_active() -> List[Dict]` - Get away team active lineup
- `get_home_bench() -> List[Dict]` - Get home team bench
- `get_away_bench() -> List[Dict]` - Get away team bench
- `get_all_substitution_events() -> List[SubstitutionEvent]` - Get all recorded events

### Helper Functions

**check_substitution_needed:**
```python
check_substitution_needed(
    player: Dict,
    current_stamina: float,
    minutes_played: float,
    minutes_allocation: float,
    stamina_threshold: float = 60.0
) -> Tuple[bool, str]
```
Returns `(needs_sub, reason)` tuple.

**select_substitute:**
```python
select_substitute(
    bench_players: List[Dict],
    position_out: str,
    stamina_values: Dict[str, float]
) -> Optional[Dict]
```
Returns best substitute player or None if bench empty.

**is_position_compatible:**
```python
is_position_compatible(
    position_out: str,
    position_in: str
) -> bool
```
Returns True if positions are interchangeable.

**calculate_quarter_allocations:**
```python
calculate_quarter_allocations(
    total_allocations: Dict[str, int],
    quarter_number: int
) -> Dict[str, float]
```
Converts 48-minute game allocations to per-quarter targets (divide by 4).

**validate_minutes_allocation:**
```python
validate_minutes_allocation(
    allocations: Dict[str, int],
    team_size: int
) -> Tuple[bool, str]
```
Validates allocation dict (must sum to 240, no player > 48 min).

## Integration with Quarter Simulation

### Main Loop Integration

```python
# After each possession:

# 1. Apply stamina cost to active players
stamina_tracker.apply_possession_cost(active_players, pace, scoring_options)

# 2. Recover bench stamina
stamina_tracker.recover_bench_stamina(bench_players, minutes_elapsed)

# 3. Update minutes played
for player in active_players:
    stamina_tracker.add_minutes(player['name'], possession_duration_seconds)

# 4. Check for substitutions
game_time_str = clock.format_time()
events = sub_manager.check_and_execute_substitutions(
    stamina_tracker=stamina_tracker,
    game_time_str=game_time_str
)

# 5. Log substitution events
for event in events:
    log_substitution(event)

# 6. Get updated lineups for next possession
home_active = sub_manager.get_home_active()
away_active = sub_manager.get_away_active()
```

## Edge Cases

### 1. Bench Exhausted
**Scenario:** Player needs substitution but bench is empty (5-player roster).

**Behavior:**
- No substitution occurs
- Player remains on court despite low stamina/exceeded minutes
- No error thrown

**Rationale:** Cannot field invalid lineup (< 5 players).

### 2. Multiple Simultaneous Substitutions
**Scenario:** Multiple players on same team need substitution at same time.

**Behavior:**
- All substitutions are checked and executed in single call
- Each substitution updates bench list before next selection
- Order: Iterate through active lineup sequentially

**Example:**
```
Possession 17: Check all 5 active players
  Player1: stamina 55 → SUB with Player6
  Player2: stamina 58 → SUB with Player7
  Player3: stamina 59 → SUB with Player8

Result: 3 substitution events returned
```

### 3. No Position Match Available
**Scenario:** PG needs sub, but only SF/PF/C on bench.

**Behavior:**
- Fallback to highest stamina overall
- Position mismatch accepted (better than keeping exhausted player)

### 4. Substitute Also Needs Substitution
**Scenario:** Bench player comes in at low stamina, immediately needs sub.

**Behavior:**
- Will be checked on **next** possession
- Each possession only checks current active lineup
- Iterative substitution handling prevents infinite loops

## Realistic Rotation Patterns

### Typical NBA Rotation (48-minute game)

**Starters:** 32-36 minutes
**6th Man:** 20-28 minutes
**Bench:** 12-20 minutes
**Deep Bench:** 0-12 minutes

### Quarter Allocation (12 minutes)

**Starters:** 8-9 minutes
**6th Man:** 5-7 minutes
**Bench:** 3-5 minutes

### Example Rotation Pattern (1 Quarter)

```
Minutes 12:00-8:00 (4 min):
  Starters on court
  Stamina depletes: 100 → 86

Minutes 8:00-4:00 (4 min):
  Starters hit 8-min allocation
  All 5 substituted → Bench players enter
  Bench stamina: 100 (fresh)

Minutes 4:00-0:00 (4 min):
  Bench completes quarter
  Final stamina: 86
```

## Testing

### Test Coverage

**39 comprehensive tests covering:**
- Position compatibility (8 tests)
- Substitution triggers (6 tests)
- Substitute selection (5 tests)
- LineupManager functionality (9 tests)
- SubstitutionManager integration (6 tests)
- Helper functions (4 tests)
- Edge cases (1 test)

**Run tests:**
```bash
pytest tests/test_substitutions.py -v
```

### Demo Script

**Interactive demonstration:**
```bash
python demo_substitutions.py
```

**Demonstrations include:**
1. Position compatibility matrix
2. Substitution trigger logic
3. Substitute selection scenarios
4. LineupManager operations
5. Full quarter simulation with realistic rotations

## Performance Considerations

### Computational Complexity

- **Substitution check:** O(n) where n = active players (always 5)
- **Substitute selection:** O(m) where m = bench size (typically 5-8)
- **Total per possession:** O(1) - constant time for fixed roster sizes

### Memory Usage

- **LineupManager:** Stores references to 10-13 player dicts
- **SubstitutionEvent:** 6 fields per event (~24 possessions = ~10-20 events/quarter)
- **Total:** Negligible memory footprint

## Future Extensions (Milestone 3+)

### Planned Features

1. **Injury Substitutions**
   - New reason code: `"injury"`
   - Forced immediate substitution (no reversal)
   - Player marked as unavailable for remainder of game

2. **Tactical Substitutions**
   - Reason code: `"tactical"`
   - User-initiated substitutions (pause game, make change)
   - Overrides automatic rotation logic

3. **Foul Trouble**
   - Reason code: `"fouls"`
   - Substitute when player reaches 5 fouls
   - Re-enter later if fouls allow

4. **Hot Hand / Cold Shooter**
   - Reason code: `"performance"`
   - Substitute based on recent performance metrics
   - Adaptive rotation patterns

## Validation Metrics

### Success Criteria (Milestone 2)

- ✅ All tests pass (39/39)
- ✅ No invalid lineups (always 5 players)
- ✅ Position compatibility respected
- ✅ Stamina threshold enforced (< 60 triggers sub)
- ✅ Minutes allocation respected (±0.5 min tolerance)
- ✅ Substitution events tracked accurately
- ✅ Edge cases handled gracefully

### Realism Checks

**Quarter simulation validation:**
- Starters: 7-9 minutes played ✅
- Bench: 3-5 minutes played ✅
- Total possessions: 20-28 (pace-dependent) ✅
- Substitutions: 8-12 per quarter ✅

## Common Issues & Solutions

### Issue: Player substituted too early
**Cause:** Minutes allocation set too low.
**Solution:** Increase player's allocation in tactical settings.

### Issue: Player never substituted despite low stamina
**Cause:** No bench players available (5-player roster).
**Solution:** Ensure rosters have 10+ players for realistic rotations.

### Issue: Too many substitutions
**Cause:** Very low minutes allocations (< 4 min per player).
**Solution:** Ensure allocations sum to 240 (5 players * 48 minutes).

### Issue: Position mismatch (C playing PG)
**Cause:** No compatible substitutes on bench.
**Solution:** Balanced roster composition (2 guards, 2 wings, 1-2 centers).

## References

- **MILESTONE_2_PLAN.md** - Phase 2: Substitution System
- **basketball_sim.md** - Section 10.4: Minutes Allocation
- **src/systems/stamina_manager.py** - Stamina tracking integration
- **src/systems/game_clock.py** - Time management

## Version History

**v1.0.0** (2025-11-05)
- Initial implementation for Milestone 2
- LineupManager + SubstitutionManager
- Position compatibility system
- Stamina and minutes-based triggers
- 39 comprehensive tests
- Demo script with 5 scenarios

---

**Last Updated:** 2025-11-05
**Status:** Complete, Integration-Ready for Phase 5
