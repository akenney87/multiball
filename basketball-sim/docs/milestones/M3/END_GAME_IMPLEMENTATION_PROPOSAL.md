# End-Game Logic System - Implementation Proposal

## Overview

This document outlines the exact code changes required to implement the 7 end-game modes:

1. **Clock Kill Mode** - Leading team burns clock in final 35 seconds
2. **Last Second Shot - Tied** - Hold for last shot when tied
3. **Last Second Shot - Losing** - Hold for last shot when trailing by 1-3
4. **Desperation Mode** - Increase 3PT volume when down 9+ with <10 mins
5. **Conserve Lead Mode** - Slow pace when up 15+ with <10 mins
6. **Intentional Fouling** - Foul worst FT shooter when down 3-8 with <60 seconds
7. **Desperation Shot Logic** - Penalize shots with <5 seconds remaining

---

## Files to Create/Modify

### NEW FILES

**1. `src/systems/end_game_modes.py`** (~250 lines)
- Core module containing all end-game mode detection logic
- Returns modifiers to be applied to possession behavior

### MODIFIED FILES

**2. `src/systems/possession.py`** (+30 lines)
- Add end-game mode detection at start of `simulate_possession()`
- Apply mode modifiers to shot selection, shot clock usage, pace

**3. `src/core/data_structures.py`** (+15 lines)
- Add `EndGameModifiers` dataclass to hold mode state

**4. `src/systems/shooting.py`** (+10 lines)
- Apply desperation shot penalty for shots with <5 seconds remaining

**5. `src/systems/fouls.py`** (+40 lines)
- Add `trigger_intentional_foul()` method to FoulSystem class

---

## Data Structures

### New: EndGameModifiers (data_structures.py)

```python
@dataclass
class EndGameModifiers:
    """
    Modifiers applied during end-game situations.

    Attributes:
        active_mode: Name of active mode ('clock_kill', 'last_shot_tied', etc.) or None
        shot_clock_target: Target seconds on shot clock to shoot (overrides normal timing)
        shot_distribution_3pt_adj: Additive adjustment to 3PT% (+0.20 = +20%)
        pace_multiplier: Multiplicative adjustment to pace (1.10 = 10% faster)
        force_shot_type: Force specific shot type ('3pt', 'rim', or None)
        force_shooter: Force specific player to shoot (name or None)
        contest_boost: Boost to contest intensity for desperation defense (+0.15 = +15%)
        shot_quality_penalty: Penalty to shot success for desperation shots (-0.10 = -10%)
        trigger_intentional_foul: Boolean flag to trigger foul on this possession
        foul_target: Name of player to foul (worst FT shooter)
    """
    active_mode: Optional[str] = None
    shot_clock_target: Optional[float] = None
    shot_distribution_3pt_adj: float = 0.0
    pace_multiplier: float = 1.0
    force_shot_type: Optional[str] = None
    force_shooter: Optional[str] = None
    contest_boost: float = 0.0
    shot_quality_penalty: float = 0.0
    trigger_intentional_foul: bool = False
    foul_target: Optional[str] = None
```

---

## Function Signatures

### end_game_modes.py

```python
def detect_end_game_mode(
    game_time_remaining: int,
    score_differential: int,
    quarter: int,
    team_has_possession: bool,
    opponent_has_possession: bool,
    scoring_option_1: Optional[str],
    foul_system: Any,
    offensive_roster: List[Dict[str, Any]],
    defensive_roster: List[Dict[str, Any]]
) -> EndGameModifiers:
    """
    Detect active end-game mode and return modifiers.

    Args:
        game_time_remaining: Seconds left in game (0-2880)
        score_differential: Point difference (positive = team ahead)
        quarter: Current quarter (1-4)
        team_has_possession: True if evaluating team has ball
        opponent_has_possession: True if opponent has ball
        scoring_option_1: Name of primary scoring option (for last-second shots)
        foul_system: FoulSystem instance (for intentional fouling)
        offensive_roster: Current offensive team's roster
        defensive_roster: Current defensive team's roster

    Returns:
        EndGameModifiers with appropriate values set
    """
```

```python
def calculate_desperation_magnitude(
    score_differential: int,
    time_remaining_minutes: float
) -> float:
    """
    Calculate desperation magnitude based on deficit and time.

    Formula: abs(score_differential) / (time_remaining_minutes + 1)

    Returns:
        Magnitude value (0.0+, triggers at >1.5)
    """
```

```python
def select_foul_target(
    defensive_roster: List[Dict[str, Any]]
) -> str:
    """
    Select worst FT shooter on opponent team.

    Calculates FT composite for each player:
    - throw_accuracy: 40%
    - composure: 25%
    - consistency: 20%
    - hand_eye_coordination: 15%

    Returns:
        Name of player with lowest FT composite
    """
```

```python
def select_fouler(
    offensive_roster: List[Dict[str, Any]],
    foul_system: Any
) -> str:
    """
    Select player to commit intentional foul.

    Prioritizes:
    1. Players with 0-3 fouls
    2. Bench players (if available)
    3. Avoid players with 5 fouls (would foul out)

    Returns:
        Name of player to commit foul
    """
```

### fouls.py (addition to FoulSystem class)

```python
def trigger_intentional_foul(
    self,
    fouling_player: str,
    fouled_player: str,
    fouling_team: str,
    quarter: int,
    game_time: str
) -> FoulEvent:
    """
    Trigger an intentional foul (non-shooting).

    Always awards FTs if in bonus, otherwise side out.

    Args:
        fouling_player: Name of player committing foul
        fouled_player: Name of player being fouled
        fouling_team: 'Home' or 'Away'
        quarter: Current quarter
        game_time: Game clock

    Returns:
        FoulEvent with appropriate FT allocation
    """
```

---

## Integration Points

### 1. possession.py Integration

**Location:** Start of `simulate_possession()` function

**Current Flow:**
```python
def simulate_possession(self, context: PossessionContext) -> PossessionResult:
    # Initialize possession state
    # Select initial lineup
    # Drive or perimeter logic
    # ...
```

**Modified Flow:**
```python
def simulate_possession(self, context: PossessionContext) -> PossessionResult:
    # NEW: Detect end-game mode
    from .end_game_modes import detect_end_game_mode

    endgame_mods = detect_end_game_mode(
        game_time_remaining=context.game_time_remaining,
        score_differential=context.score_differential,  # positive = home ahead
        quarter=context.quarter,
        team_has_possession=(context.offensive_team == 'home'),
        opponent_has_possession=(context.offensive_team == 'away'),
        scoring_option_1=self.tactical_settings.scoring_option_1,
        foul_system=self.foul_system,
        offensive_roster=self.offensive_roster,
        defensive_roster=self.defensive_roster
    )

    # NEW: Check for intentional foul (opponent fouls us before we can shoot)
    if endgame_mods.trigger_intentional_foul:
        # Trigger intentional foul immediately
        # Return possession result with foul event
        # (Implementation in separate section below)
        pass

    # Initialize possession state
    # Select initial lineup

    # NEW: Apply shot clock target override
    if endgame_mods.shot_clock_target is not None:
        target_shot_clock = endgame_mods.shot_clock_target
    else:
        target_shot_clock = # ... normal logic

    # Drive or perimeter logic
    # ...

    # NEW: Apply shot distribution adjustments
    shot_distribution = calculate_shot_distribution(...)
    shot_distribution['3pt'] += endgame_mods.shot_distribution_3pt_adj
    # Renormalize to sum to 1.0

    # NEW: Apply forced shot type
    if endgame_mods.force_shot_type:
        shot_type = endgame_mods.force_shot_type
    else:
        shot_type = select_shot_type(shot_distribution)

    # NEW: Apply forced shooter
    if endgame_mods.force_shooter:
        shooter = get_player_by_name(endgame_mods.force_shooter)
    else:
        shooter = select_shooter(...)
```

### 2. shooting.py Integration

**Location:** In shot probability calculation

**Current Flow:**
```python
def calculate_shot_probability(...):
    base_prob = get_base_rate(shot_type)
    # Apply attribute modifiers
    # Apply contest penalties
    # Return final probability
```

**Modified Flow:**
```python
def calculate_shot_probability(..., game_time_remaining: int):
    base_prob = get_base_rate(shot_type)
    # Apply attribute modifiers
    # Apply contest penalties

    # NEW: Apply desperation shot penalty if <5 seconds
    if game_time_remaining < 5:
        desperation_penalty = 0.10  # -10% for desperation heaves
        base_prob -= desperation_penalty

    # Return final probability
```

### 3. PossessionContext Additions

**Current PossessionContext:**
```python
@dataclass
class PossessionContext:
    is_transition: bool
    shot_clock: int
    score_differential: int
    game_time_remaining: int
```

**Need to Add:**
```python
@dataclass
class PossessionContext:
    is_transition: bool
    shot_clock: int
    score_differential: int
    game_time_remaining: int
    quarter: int  # NEW: Need this for end-game mode detection
    offensive_team: str  # NEW: Need to know which team has possession ('home' or 'away')
```

---

## Implementation Order

### Phase 1: Foundation (30 minutes)

1. **Add EndGameModifiers dataclass** to `data_structures.py`
2. **Add quarter and offensive_team fields** to PossessionContext
3. **Update all PossessionContext creation sites** to include new fields

### Phase 2: Core Mode Detection (60 minutes)

4. **Create `end_game_modes.py`** with skeleton functions
5. **Implement `detect_end_game_mode()`** with all 7 mode checks
6. **Implement helper functions:**
   - `calculate_desperation_magnitude()`
   - `select_foul_target()`
   - `select_fouler()`

### Phase 3: Integration (45 minutes)

7. **Integrate mode detection into `possession.py`**
   - Add import
   - Call `detect_end_game_mode()` at start
   - Apply shot clock target override
   - Apply shot distribution adjustments
   - Apply forced shot type/shooter
8. **Add desperation shot penalty to `shooting.py`**
9. **Add `trigger_intentional_foul()` to `fouls.py`**

### Phase 4: Intentional Fouling Logic (30 minutes)

10. **Implement intentional foul possession flow** in `possession.py`
    - Detect foul trigger
    - Call `foul_system.trigger_intentional_foul()`
    - Return possession result with foul event
    - Handle FT shooting or side out

### Phase 5: Testing (45 minutes)

11. **Create test script** `test_end_game_modes.py`
12. **Test each mode individually:**
    - Clock Kill: Up 5 with 30 sec → verify shot at 6 sec shot clock
    - Last Shot Tied: Tied with 20 sec → verify shot at 3 sec game clock
    - Last Shot Losing: Down 3 with 20 sec → verify shot at 7 sec, 3PT forced
    - Desperation: Down 12 with 5 min → verify +20% 3PT attempts
    - Conserve: Up 18 with 8 min → verify slower pace
    - Intentional Foul: Down 5 with 45 sec → verify foul on worst FT shooter
    - Desperation Shot: 3 sec remaining → verify -10% shot penalty

### Phase 6: Validation (30 minutes)

13. **Run full validation game** with close finish
14. **Verify play-by-play shows:**
    - "Lakers hold for last shot..."
    - "Celtics force up a desperation 3PT..."
    - "Heat intentionally foul poor free throw shooter..."
15. **Check box score for realistic outcomes**

**Total Estimated Time: 3.5 hours**

---

## Detailed Mode Logic

### Mode 1: Clock Kill Mode

**Trigger:**
```python
if (
    quarter == 4 and
    game_time_remaining <= 35 and
    game_time_remaining > shot_clock and
    score_differential >= 1 and
    score_differential <= 8 and
    team_has_possession
):
    active_mode = 'clock_kill'
```

**Modifiers:**
```python
# Shot clock target varies by lead size
if score_differential >= 7:
    shot_clock_target = 3.0  # Larger lead = more aggressive
elif score_differential >= 4:
    shot_clock_target = 5.0
else:
    shot_clock_target = 7.0  # Small lead = conservative
```

**Expected Behavior:**
- Team holds ball until shot clock reaches target
- Play-by-play: "Lakers hold for last shot. Shot clock at 6..."

---

### Mode 2: Last Second Shot - Tied

**Trigger:**
```python
if (
    quarter == 4 and
    game_time_remaining <= 24 and
    score_differential == 0 and
    team_has_possession
):
    active_mode = 'last_shot_tied'
```

**Modifiers:**
```python
shot_clock_target = 3.0  # Shoot at 3 seconds game clock
force_shooter = scoring_option_1  # Give ball to best player
```

**Expected Behavior:**
- Hold until 3 seconds on game clock
- Primary scorer takes shot
- Play-by-play: "Game tied, 10 seconds left. Lakers hold for last shot..."

---

### Mode 3: Last Second Shot - Losing

**Trigger:**
```python
if (
    quarter == 4 and
    game_time_remaining <= 24 and
    score_differential >= -3 and
    score_differential <= -1 and
    team_has_possession
):
    active_mode = 'last_shot_losing'
```

**Modifiers:**
```python
# Shoot at 5-8 seconds to allow putback/foul opportunity
shot_clock_target = random.uniform(5.0, 8.0)

# Force 3PT if down 3
if score_differential == -3:
    force_shot_type = '3pt'

force_shooter = scoring_option_1
```

**Expected Behavior:**
- Hold until 5-8 seconds (enough time to rebound and foul)
- If down 3, must shoot 3PT
- Play-by-play: "Celtics down 3, 18 seconds left. They'll hold for last shot..."

---

### Mode 4: Desperation Mode

**Trigger:**
```python
magnitude = abs(score_differential) / (game_time_remaining / 60 + 1)

if (
    quarter == 4 and
    game_time_remaining < 600 and
    score_differential <= -9 and
    magnitude > 1.5 and
    team_has_possession
):
    active_mode = 'desperation'
```

**Modifiers:**
```python
# Scale by magnitude (max out at magnitude = 3.5)
strength = min(1.0, (magnitude - 1.5) / 2.0)

shot_distribution_3pt_adj = strength * 0.20  # Up to +20%
pace_multiplier = 1.0 + (strength * 0.10)    # Up to +10%
```

**Expected Behavior:**
- Increase 3PT attempts significantly
- Play faster
- Play-by-play: "Heat desperate, down 14 with 4 minutes. They launch a 3PT..."

---

### Mode 5: Conserve Lead Mode

**Trigger:**
```python
magnitude = score_differential / (game_time_remaining / 60 + 1)

if (
    quarter == 4 and
    game_time_remaining < 600 and
    score_differential >= 15 and
    magnitude > 1.5 and
    team_has_possession
):
    active_mode = 'conserve_lead'
```

**Modifiers:**
```python
strength = min(1.0, (magnitude - 1.5) / 2.0)

shot_distribution_3pt_adj = -(strength * 0.10)  # Up to -10%
pace_multiplier = 1.0 - (strength * 0.15)       # Up to -15%
```

**Expected Behavior:**
- Slow down, milk clock
- Fewer 3PT attempts, more high-% shots
- Play-by-play: "Lakers comfortably ahead, taking their time..."

---

### Mode 6: Intentional Fouling

**Trigger:**
```python
if (
    quarter == 4 and
    game_time_remaining <= 60 and
    score_differential <= -3 and
    score_differential >= -8 and
    opponent_has_possession  # KEY: Opponent has ball
):
    active_mode = 'intentional_foul'
```

**Modifiers:**
```python
trigger_intentional_foul = True
foul_target = select_foul_target(defensive_roster)  # Worst FT shooter
```

**Expected Behavior:**
- Trailing team fouls immediately when opponent has ball
- Target worst FT shooter
- Play-by-play: "Heat intentionally foul poor free throw shooter Drummond!"

**Implementation in possession.py:**
```python
if endgame_mods.trigger_intentional_foul:
    # Select fouler
    fouler = select_fouler(defensive_roster, foul_system)

    # Trigger foul
    foul_event = foul_system.trigger_intentional_foul(
        fouling_player=fouler,
        fouled_player=endgame_mods.foul_target,
        fouling_team='away' if context.offensive_team == 'home' else 'home',
        quarter=context.quarter,
        game_time=format_game_time(context.game_time_remaining)
    )

    # Generate play-by-play
    play_by_play = f"{fouler} intentionally fouls {endgame_mods.foul_target}!"

    # If in bonus, shoot FTs
    if foul_event.free_throws_awarded > 0:
        ft_result = execute_free_throws(...)
        # Return possession result with FT outcome
    else:
        # Side out
        # Return possession result with turnover
```

---

### Mode 7: Desperation Shot Logic

**Trigger:**
```python
if game_time_remaining < 5:
    # Apply penalties
```

**Modifiers:**
```python
shot_quality_penalty = 0.10  # -10% to shot success
contest_boost = 0.15         # +15% to contest intensity (defenders play tighter)
```

**Expected Behavior:**
- Shots with <5 seconds are harder
- Defenders contest more aggressively
- Play-by-play: "2 seconds left! Forced to shoot... MISSES!"

---

## Testing Strategy

### Unit Tests

Create `tests/test_end_game_modes.py`:

```python
def test_clock_kill_detection():
    """Verify clock kill mode triggers correctly."""
    mods = detect_end_game_mode(
        game_time_remaining=30,
        score_differential=5,
        quarter=4,
        team_has_possession=True,
        opponent_has_possession=False,
        ...
    )
    assert mods.active_mode == 'clock_kill'
    assert mods.shot_clock_target == 5.0

def test_intentional_foul_target_selection():
    """Verify worst FT shooter is selected."""
    roster = [
        {'name': 'Good_FT', 'throw_accuracy': 90, 'composure': 85, ...},
        {'name': 'Bad_FT', 'throw_accuracy': 45, 'composure': 50, ...},
    ]
    target = select_foul_target(roster)
    assert target == 'Bad_FT'

def test_desperation_magnitude():
    """Verify desperation magnitude calculation."""
    # Down 12 with 4 minutes left: 12 / 5 = 2.4
    mag = calculate_desperation_magnitude(-12, 4.0)
    assert mag == 2.4
    assert mag > 1.5  # Should trigger desperation mode
```

### Integration Test

Create `test_end_game_integration.py`:

```python
def test_close_game_finish():
    """
    Simulate close game to verify end-game modes activate.

    Setup:
    - Start Q4 with home up 2
    - Run final 2 minutes
    - Verify clock management, last-second shots
    """
    # Create teams
    # Set initial score (home 98, away 96)
    # Simulate final 120 seconds
    # Verify:
    #   - Last possession uses clock kill mode
    #   - Shot clock drained to ~5 seconds
    #   - No early shooting
```

---

## Risk Assessment

### Low Risk
- ✅ Mode detection logic (simple conditionals)
- ✅ Shot clock target override (existing infrastructure)
- ✅ Shot distribution adjustments (existing infrastructure)
- ✅ Desperation shot penalties (simple modifier)

### Medium Risk
- ⚠️ Intentional fouling flow (new possession path)
- ⚠️ Forced shooter selection (requires player lookup)
- ⚠️ PossessionContext modifications (many creation sites)

### Mitigation
- Test intentional fouling in isolation before integration
- Create helper function for player lookup by name
- Use find-all-references to update PossessionContext sites

---

## Success Criteria

### Functional Requirements
1. ✅ All 7 modes trigger under correct conditions
2. ✅ Modifiers correctly applied to possession behavior
3. ✅ No crashes or exceptions during normal gameplay
4. ✅ Modes do not interfere with each other (mutual exclusivity)

### Realism Requirements
1. ✅ Leading teams burn clock in final 35 seconds
2. ✅ Trailing teams hold for last shot when appropriate
3. ✅ Intentional fouling targets worst FT shooter 80%+ of time
4. ✅ Desperation mode increases 3PT frequency observably
5. ✅ Play-by-play text reflects end-game situations naturally

### Performance Requirements
1. ✅ Mode detection adds <5ms per possession
2. ✅ No memory leaks from EndGameModifiers objects
3. ✅ Full game simulation time increases <2%

---

## Open Questions for Agent Review

1. **PossessionContext Modification:** We need to add `quarter` and `offensive_team` fields. This will require updating all creation sites. Is there a cleaner way to pass this context?

2. **Intentional Foul Timing:** Should intentional foul happen BEFORE possession starts, or during possession simulation? Current proposal is before (early return).

3. **Mode Priority:** If multiple modes could trigger (e.g., desperation + last shot losing), which takes priority? Proposal: Most specific mode wins (last shot > desperation).

4. **Shot Clock vs Game Clock:** Clock kill mode uses shot clock target, last shot modes use game clock. Is this clear enough in the implementation?

5. **Forced Shooter Availability:** What if `scoring_option_1` is not on court? Fallback to highest-scoring player on floor?

6. **FT Composite Calculation:** Using throw_accuracy 40%, composure 25%, consistency 20%, hand_eye 15%. Does this match existing FT system?

7. **Desperation Shot Penalty Application:** Should -10% be applied to base rate or final probability? Proposal: Final probability (after all modifiers).

---

## Implementation Checklist

- [ ] Create EndGameModifiers dataclass
- [ ] Add quarter/offensive_team to PossessionContext
- [ ] Update all PossessionContext creation sites
- [ ] Create end_game_modes.py skeleton
- [ ] Implement detect_end_game_mode()
- [ ] Implement calculate_desperation_magnitude()
- [ ] Implement select_foul_target()
- [ ] Implement select_fouler()
- [ ] Integrate mode detection into possession.py
- [ ] Apply shot clock target override
- [ ] Apply shot distribution adjustments
- [ ] Apply forced shot type/shooter
- [ ] Add desperation shot penalty to shooting.py
- [ ] Add trigger_intentional_foul() to fouls.py
- [ ] Implement intentional foul possession flow
- [ ] Create unit tests
- [ ] Create integration test
- [ ] Run validation game
- [ ] Verify play-by-play quality
- [ ] Check performance impact

---

## Conclusion

This implementation proposal provides a complete, detailed plan for adding realistic end-game logic to the basketball simulator. The approach:

- **Keeps existing systems intact** (minimal invasive changes)
- **Uses existing infrastructure** (shot clock, shot distribution, foul system)
- **Adds clear, testable logic** (simple conditionals, no complex state)
- **Respects user agency** (uses scoring_options for shooter selection)
- **Maintains performance** (lightweight detection, minimal overhead)

Total implementation time: **3.5 hours**
Total new code: **~250 lines** (mostly in new file)
Risk level: **Low-Medium**

Ready for agent review.
