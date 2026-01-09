# End-Game Clock Management - Quick Reference

**For developers implementing end-game strategy systems**

---

## 4 Core Modes

### 1. CLOCK KILL MODE
**When**: Leading team, <2 min, score_diff > 0
**Goal**: Burn clock to minimize opponent possessions
**Shot Clock Target**: 3-8 seconds (based on lead size)
**Override**: Pace, shot distribution (-5% 3PT, +5% rim)

### 2. LAST SECOND SHOT - TIED
**When**: Tied game, <24 seconds
**Goal**: Hold for last shot, prevent opponent possession
**Shot Clock Target**: 3 seconds game clock
**Override**: Force to scoring_option_1, burn 21 seconds

### 3. LAST SECOND SHOT - LOSING
**When**: Trailing, <24 seconds
**Goal**: Hold for last shot, maximize win probability
**Shot Clock Target**: 4 seconds game clock
**Override**: Force 3PT if down 3+, force to scoring_option_1

### 4. INTENTIONAL FOULING (Phase 2)
**When**: Trailing 3-8 points, <60 seconds, opponent has ball
**Goal**: Stop clock, get possession back via FT
**Target**: Worst FT shooter on opponent team
**Override**: Foul immediately (2-4 sec into possession)

---

## Trigger Conditions (Python)

```python
def detect_end_game_mode(score_diff, game_time, shot_clock, quarter):
    """Returns: 'clock_kill', 'last_second_tied', 'last_second_losing',
                'intentional_foul', or None"""

    # PHASE 2: Intentional Foul (check first - defensive action)
    if (score_diff < 0 and game_time < 60 and
        -8 <= score_diff <= -3 and opponent_has_possession):
        return 'intentional_foul'

    # Last Second Shot - Tied
    if score_diff == 0 and game_time <= 24 and quarter == 4:
        return 'last_second_tied'

    # Last Second Shot - Losing
    if score_diff < 0 and game_time <= 24 and quarter == 4:
        return 'last_second_losing'

    # Clock Kill Mode
    if score_diff > 0 and game_time < 120 and game_time > shot_clock:
        # Determine intensity
        if score_diff >= 7 or game_time > 90:
            return 'clock_kill_conservative'  # Shoot at 8 sec
        elif score_diff >= 3 or game_time > 30:
            return 'clock_kill_standard'  # Shoot at 5 sec
        else:
            return 'clock_kill_aggressive'  # Shoot at 3 sec

    return None
```

---

## Shot Clock Consumption Formulas

### Clock Kill
```python
INTENSITY_TARGETS = {
    'aggressive': 3,   # Shoot at 3 sec shot clock
    'standard': 5,     # Shoot at 5 sec shot clock
    'conservative': 8  # Shoot at 8 sec shot clock
}

target = INTENSITY_TARGETS[intensity]
buffer = 1  # Prevent shot clock violation

if game_time < (shot_clock + target):
    # Edge case: game time too short
    time_to_burn = game_time - target - buffer
else:
    # Normal case
    time_to_burn = shot_clock - target - buffer

shot_clock_remaining = max(0, shot_clock - time_to_burn)
```

### Last Second Shot
```python
# Tied game: shoot at 3 seconds game clock
target_game_time = 3

# Losing: shoot at 4 seconds (allows OREB attempt)
if score_diff < 0:
    target_game_time = 4

time_to_burn = game_time - target_game_time
shot_clock_remaining = max(0, shot_clock - time_to_burn)

# Prevent shot clock violation
if shot_clock_remaining < 1:
    shot_clock_remaining = 1
```

---

## Integration Points

### possession.py
```python
def simulate_possession(...):
    # ADD THIS at start of function:
    end_game_mode = detect_end_game_mode(
        possession_context.score_differential,
        possession_context.game_time_remaining,
        possession_context.shot_clock,
        possession_context.quarter
    )

    # Intentional Foul (Phase 2)
    if end_game_mode == 'intentional_foul':
        return execute_intentional_foul(...)

    # Clock Kill / Last Second Shot
    if end_game_mode in ['clock_kill', 'last_second_tied', 'last_second_losing']:
        possession_context.shot_clock = apply_clock_consumption(
            end_game_mode,
            possession_context
        )

        # Force shot selection (last second shots only)
        if 'last_second' in end_game_mode:
            forced_shooter = tactical_offense.scoring_option_1

        # Force 3PT (losing by 3+)
        if end_game_mode == 'last_second_losing' and score_diff <= -3:
            force_shot_type = '3pt'

    # Normal possession flow continues...
```

### PossessionContext (add 2 fields)
```python
@dataclass
class PossessionContext:
    is_transition: bool = False
    shot_clock: int = 24
    score_differential: int = 0
    game_time_remaining: int = 2880

    # NEW FIELDS:
    quarter: int = 1  # Track quarter for end-game logic
    intentional_foul_count: int = 0  # Prevent infinite loops (Phase 2)
```

---

## Shot Distribution Modifiers

### Clock Kill
```python
if end_game_mode == 'clock_kill':
    shot_distribution_modifiers = {
        '3pt': -0.05,      # Slightly less risky
        'midrange': 0.00,  # No change
        'rim': +0.05       # Slightly more safe shots
    }

    # Reduce turnover risk
    base_turnover_rate *= 0.90  # -10%
```

### Last Second Shot - Losing
```python
if end_game_mode == 'last_second_losing':
    if score_diff <= -3:
        # MUST shoot 3PT
        force_shot_type = '3pt'
    elif score_diff == -2:
        # Prefer 3PT
        shot_distribution_modifiers = {
            '3pt': +0.20,
            'rim': +0.05,
            'midrange': -0.25
        }
```

---

## Intentional Foul Logic (Phase 2)

### Decision Function
```python
def intentional_foul_makes_sense(score_diff, game_time, team_fouls):
    """Returns True if intentional foul is strategically sound."""

    # Classic foul situation
    if -8 <= score_diff <= -3 and game_time < 60:
        # Check if already in bonus (no downside to fouling)
        if opponent_in_bonus:
            return True
        # Not in bonus, only foul in final 30 seconds
        elif game_time < 30:
            return True

    # Down 1-2: Don't foul (just defend)
    if score_diff >= -2:
        return False

    # Down 9+: Game over, don't foul
    if score_diff <= -9:
        return False

    return False
```

### Target Selection
```python
def select_foul_target(offensive_team):
    """Return worst FT shooter on opponent team."""

    ft_composites = {
        p['name']: calculate_ft_composite(p)
        for p in offensive_team
    }

    worst_ft_shooter = min(offensive_team, key=lambda p: ft_composites[p['name']])
    return worst_ft_shooter
```

### Foul Execution
```python
def execute_intentional_foul(defensive_team, offensive_team, foul_system):
    """Execute intentional foul sequence."""

    # Select who fouls (fewest personal fouls, <5)
    fouling_player = min(
        [p for p in defensive_team if foul_system.personal_fouls[p['name']] < 5],
        key=lambda p: foul_system.personal_fouls[p['name']]
    )

    # Select target (worst FT shooter)
    fouled_player = select_foul_target(offensive_team)

    # Create foul event
    foul_event = foul_system.register_intentional_foul(
        fouling_player=fouling_player,
        fouled_player=fouled_player,
        quarter=quarter,
        game_time=game_time
    )

    # Award free throws (2 if in bonus, 0 if not)
    if opponent_in_bonus:
        free_throws = 2
    else:
        free_throws = 0

    # Possession returns to trailing team after FT
    return PossessionResult(
        possession_outcome='foul',
        foul_event=foul_event,
        free_throw_result=execute_free_throws(fouled_player, free_throws),
        next_possession='trailing_team'
    )
```

---

## Edge Cases

### 1. Offensive Rebound During Clock Kill
**Behavior**: Re-evaluate intensity with new shot clock (14 sec), continue burning

### 2. Turnover During Last Second Shot
**Behavior**: Opponent enters same mode (last second tied/losing based on new score)

### 3. Shot Clock Violation Prevention
**Behavior**: Add 1-second buffer to all calculations (shoot at 6 instead of 5)

### 4. Intentional Foul Infinite Loop
**Behavior**: Max 3 consecutive fouls, then stop (prevent infinite foul cycle)

### 5. Game Time < Shot Clock
**Behavior**: Burn time based on GAME clock, not shot clock
```python
if game_time < shot_clock + target:
    time_to_burn = game_time - target - buffer
```

---

## Validation Targets

### Clock Kill
- Average shot clock at attempt: 4-6 seconds (not 12-15)
- Turnover rate: 10-15% lower than normal
- Opponent possessions after: <2

### Last Second Shot - Tied
- Shot timing: 3.0 ± 1.0 seconds game clock
- Scorer: 60%+ should be scoring_option_1
- No shot clock violations

### Last Second Shot - Losing
- Shot type: 90%+ 3PT when down 3+
- Shot timing: 4.0 ± 1.5 seconds game clock
- No shot clock violations

### Intentional Foul (Phase 2)
- Foul rate: 80%+ in eligible scenarios
- Target: Worst FT shooter 70%+ of time
- Foul type: Non-shooting 95%+
- Max 3 consecutive fouls

---

## Implementation Checklist

**Phase 1 (4-6 hours):**
- [ ] Create `src/systems/end_game_modes.py`
- [ ] Implement `detect_end_game_mode()`
- [ ] Implement `apply_clock_kill_logic()`
- [ ] Implement `apply_last_second_logic()`
- [ ] Add `quarter` and `intentional_foul_count` to `PossessionContext`
- [ ] Modify `possession.py` to check modes at start
- [ ] Write unit tests (30 tests)
- [ ] Run integration tests (20 games)
- [ ] Validate clock consumption (100 games)

**Phase 2 (3-4 hours):**
- [ ] Implement `intentional_foul_makes_sense()`
- [ ] Implement `select_foul_target()`
- [ ] Implement `select_fouling_player()`
- [ ] Implement `execute_intentional_foul()`
- [ ] Add `is_intentional` flag to `FoulEvent`
- [ ] Integrate with `FoulSystem`
- [ ] Write unit tests (20 tests)
- [ ] Run integration tests (20 games)
- [ ] Validate foul targeting (100 games)

---

## Priority Recommendation

**DO PHASE 1 IMMEDIATELY:**
- Clock Kill + Last Second Shot are high-value, low-complexity
- Every close game benefits (30% of games)
- Easy to test and validate
- Dramatic improvement in realism

**DO PHASE 2 LATER (or skip):**
- Intentional Fouling is complex, lower frequency
- Only applies to final 60 seconds when down 3-8
- Harder to validate (FT shooter targeting)
- User may not notice its absence

**Estimated ROI:**
- Phase 1: 4-6 hours → Improves 100% of close games
- Phase 2: 3-4 hours → Improves 20% of close games (final 60 sec scenarios)

---

**END OF QUICK REFERENCE**
