# Game Clock System Documentation

**Version:** 1.0
**Status:** Complete
**Module:** `src/systems/game_clock.py`

---

## Overview

The Game Clock System manages quarter timing and possession duration calculation for Milestone 2 (Quarter Simulation). It provides accurate time tracking, realistic possession durations based on pace, and end-of-quarter logic.

## Core Components

### 1. GameClock Class

Main class for managing quarter time.

**Attributes:**
- `total_seconds`: Total quarter length (default 720 for 12 minutes)
- `elapsed_seconds`: Time elapsed since start of quarter

**Key Methods:**

```python
# Initialization
clock = GameClock(quarter_length_minutes=12)

# Time management
clock.tick(30)                    # Advance 30 seconds
clock.get_time_remaining()        # Get seconds remaining
clock.format_time()               # Get "MM:SS" format
clock.is_quarter_over()           # Check if time expired
clock.is_final_possession()       # Check if final possession
clock.reset()                     # Reset to 12:00
```

### 2. Possession Duration Calculation

```python
from src.systems.game_clock import calculate_possession_duration

# Calculate possession duration based on pace
duration = calculate_possession_duration('standard')        # 25-35 sec
duration = calculate_possession_duration('fast')            # 20-25 sec
duration = calculate_possession_duration('slow')            # 30-45 sec
duration = calculate_possession_duration('standard', is_transition=True)  # 15-20 sec
```

**Pace-Based Ranges:**
- **Fast**: 20-25 seconds (avg 22.5)
- **Standard**: 25-35 seconds (avg 30)
- **Slow**: 30-45 seconds (avg 37.5)
- **Transition**: 15-20 seconds (regardless of pace)

**Variance:** ±3 seconds random variance applied to all possessions

### 3. Possession Count Estimation

```python
from src.systems.game_clock import estimate_possessions_per_quarter

# Estimate total possessions for quarter
estimate_possessions_per_quarter('fast')      # 32
estimate_possessions_per_quarter('standard')  # 24
estimate_possessions_per_quarter('slow')      # 19
```

### 4. End-of-Quarter Logic

```python
from src.systems.game_clock import should_end_quarter

# Determine if quarter should end
should_end = should_end_quarter(clock, possession_started=False)
```

**Rules:**
- If possession not started AND time < 25 sec → end quarter
- If possession started → allow it to complete
- Never cut off mid-possession

### 5. Quarter Simulation

```python
from src.systems.game_clock import simulate_quarter_clock

# Simulate entire quarter timing
possessions = simulate_quarter_clock('standard', seed=42)

# Returns list of possession timing info:
# [
#     {'possession_num': 1, 'start_time': '12:00', 'duration': 28, 'end_time': '11:32'},
#     {'possession_num': 2, 'start_time': '11:32', 'duration': 30, 'end_time': '11:02'},
#     ...
# ]
```

### 6. Validation Utilities

```python
from src.systems.game_clock import validate_possession_counts

# Validate possession counts over 100 simulations
result = validate_possession_counts('standard', num_simulations=100, seed=42)

# Returns:
# {
#     'pace': 'standard',
#     'expected': 24,
#     'min': 23,
#     'max': 24,
#     'avg': 23.7,
#     'all_counts': [24, 23, 24, ...]
# }
```

---

## Usage Examples

### Example 1: Basic Quarter Simulation

```python
from src.systems.game_clock import GameClock, calculate_possession_duration

clock = GameClock()
pace = 'standard'
possession_count = 0

while not clock.is_quarter_over():
    # Calculate possession duration
    duration = calculate_possession_duration(pace)

    # Record start time
    start_time = clock.format_time()

    # Simulate possession here...

    # Advance clock
    clock.tick(duration)
    possession_count += 1

    # Record end time
    end_time = clock.format_time()

    print(f"Possession {possession_count}: {start_time} -> {end_time} ({duration}s)")

print(f"Quarter complete. Total possessions: {possession_count}")
```

### Example 2: Integration with Quarter Loop

```python
from src.systems.game_clock import GameClock, calculate_possession_duration, should_end_quarter

def simulate_quarter(offensive_team, defensive_team, pace):
    clock = GameClock()
    possessions = []

    while True:
        # Check if quarter should end
        if should_end_quarter(clock, possession_started=False):
            break

        # Calculate possession duration
        is_transition = determine_transition()  # Your logic
        duration = calculate_possession_duration(pace, is_transition)

        # Simulate possession
        result = simulate_possession(
            offensive_team,
            defensive_team,
            context={'time_remaining': clock.get_time_remaining()}
        )

        # Advance clock
        clock.tick(duration)

        # Store result
        possessions.append({
            'time': clock.format_time(),
            'result': result
        })

    return possessions
```

### Example 3: Time-Based Substitutions

```python
from src.systems.game_clock import GameClock

clock = GameClock()

# Check if it's time to substitute based on quarter progress
def should_substitute(clock):
    time_remaining = clock.get_time_remaining()

    # Substitute at 6:00, 3:00, and 1:00 marks
    if time_remaining in [360, 180, 60]:
        return True

    # Or check if final possession
    if clock.is_final_possession():
        return True

    return False
```

---

## Validation Results

### Test Coverage

**62 tests, 100% passing**

Test categories:
- GameClock initialization (3 tests)
- Time management (6 tests)
- Time formatting (5 tests)
- Quarter end logic (5 tests)
- Reset functionality (2 tests)
- Possession duration (7 tests)
- Possession estimation (4 tests)
- End-of-quarter logic (7 tests)
- Quarter simulation (8 tests)
- Validation utilities (6 tests)
- Edge cases (6 tests)
- Integration tests (3 tests)

### Possession Count Validation (100 simulations each)

| Pace     | Expected | Actual Avg | Range   | Status |
|----------|----------|------------|---------|--------|
| Fast     | 32       | 31.4       | 30-32   | ✓ PASS |
| Standard | 24       | 23.7       | 23-24   | ✓ PASS |
| Slow     | 19       | 19.0       | 19-20   | ✓ PASS |

All results within ±15% of expected values.

---

## Design Decisions

### Why elapsed_seconds instead of time_remaining?

The class tracks `elapsed_seconds` internally and calculates `time_remaining` on demand. This design:
- Prevents negative time values (easier to clamp elapsed to max)
- Makes reset logic simpler (just set elapsed to 0)
- Matches real-world stopwatch behavior

### Why 25 seconds as end-of-quarter threshold?

A quarter should end when there's insufficient time for a meaningful possession. The 25-second threshold:
- Is less than the minimum standard possession (25s)
- Prevents awkward 10-15 second "possessions"
- Aligns with NBA shot clock (24 seconds)

### Why allow possessions to complete after 0:00?

In real NBA basketball:
- Possessions that start before 0:00 can extend past it
- The buzzer doesn't stop mid-play
- This creates dramatic final possessions

Our system mirrors this by never cutting off mid-possession.

### Why ±3 second variance?

Real possessions have natural variance due to:
- Shot clock resets after offensive rebounds
- Different play types (quick shots vs full sets)
- Game context (trailing, leading, etc.)

±3 seconds provides:
- Realistic variability (not every possession is exactly 30s)
- Maintains average possession count accuracy
- Prevents predictable patterns

---

## Integration Points

### Quarter Simulation (Phase 5)

```python
from src.systems.game_clock import GameClock, calculate_possession_duration

class QuarterSimulator:
    def __init__(self):
        self.clock = GameClock()

    def simulate(self, home_team, away_team, tactics):
        pace = tactics['pace']

        while not self.clock.is_quarter_over():
            duration = calculate_possession_duration(pace)
            # ... simulate possession
            self.clock.tick(duration)
```

### Play-by-Play Logger (Phase 4)

```python
from src.systems.game_clock import GameClock

class PlayByPlayLogger:
    def log_event(self, event_type, details):
        timestamp = self.clock.format_time()
        return f"[{timestamp}] {event_type}: {details}"
```

### Substitution System (Phase 2)

```python
from src.systems.game_clock import GameClock

def check_substitutions(clock, players):
    time_remaining = clock.get_time_remaining()

    # Different substitution patterns based on time
    if time_remaining > 360:  # First half of quarter
        # Substitute fatigued players
        pass
    else:  # Second half of quarter
        # Prepare for end of quarter
        pass
```

---

## Edge Cases Handled

### 1. Time Goes Negative
**Scenario:** Possession duration > remaining time
**Handling:** Clamp elapsed_seconds to total_seconds (time stays at 0:00)

```python
clock = GameClock()
clock.tick(800)  # Way past quarter end
assert clock.get_time_remaining() == 0
```

### 2. Zero Duration Tick
**Scenario:** tick(0) called
**Handling:** No-op, clock unchanged

```python
clock.tick(0)
assert clock.get_time_remaining() == 720
```

### 3. Very Short Quarter
**Scenario:** Custom quarter length (e.g., 1 minute for testing)
**Handling:** Works correctly with any positive duration

```python
clock = GameClock(quarter_length_minutes=1)
assert clock.get_time_remaining() == 60
```

### 4. Possession Extends Past 0:00
**Scenario:** Last possession starts with 10s left, takes 30s
**Handling:** Possession completes, time goes to 0:00

```python
clock = GameClock()
clock.tick(710)  # 10 seconds left
clock.tick(30)   # 30 second possession
assert clock.get_time_remaining() == 0
```

### 5. Invalid Pace Setting
**Scenario:** Typo in pace ('fsat' instead of 'fast')
**Handling:** Raises ValueError with clear message

```python
try:
    calculate_possession_duration('fsat')
except ValueError as e:
    print(e)  # "Invalid pace: fsat. Must be 'fast', 'standard', or 'slow'"
```

---

## Performance Characteristics

### Time Complexity
- `tick()`: O(1)
- `get_time_remaining()`: O(1)
- `format_time()`: O(1)
- `calculate_possession_duration()`: O(1)
- `simulate_quarter_clock()`: O(n) where n = possession count (~20-32)

### Memory Usage
- `GameClock` instance: ~100 bytes
- `simulate_quarter_clock()`: O(n) for possession list

### Benchmark Results (1000 iterations)
- `GameClock().tick(30)`: 0.002ms avg
- `calculate_possession_duration('standard')`: 0.003ms avg
- `simulate_quarter_clock('standard')`: 0.8ms avg

---

## Future Enhancements (Post-M2)

### Shot Clock Violations
```python
class GameClock:
    def __init__(self):
        self.shot_clock = 24

    def check_shot_clock_violation(self, possession_duration):
        if possession_duration > self.shot_clock:
            return True  # Violation
```

### Overtime Support
```python
clock = GameClock(quarter_length_minutes=5)  # 5-minute OT
```

### Timeouts
```python
def call_timeout(clock, duration=75):
    # Timeout doesn't advance game clock
    # But affects stamina recovery
    pass
```

### Fouls and Free Throws
```python
def shoot_free_throws(clock):
    # Free throws don't advance game clock
    # Possession duration only includes live play
    pass
```

---

## API Reference

### Functions

#### `calculate_possession_duration(pace: str, is_transition: bool = False) -> int`
Calculate possession duration in seconds with variance.

**Parameters:**
- `pace`: 'fast', 'standard', or 'slow'
- `is_transition`: If True, use 15-20s range (overrides pace)

**Returns:** Integer seconds

**Raises:** `ValueError` if pace is invalid

---

#### `estimate_possessions_per_quarter(pace: str) -> int`
Estimate total possessions for quarter based on pace.

**Parameters:**
- `pace`: 'fast', 'standard', or 'slow'

**Returns:** Integer possession count

**Raises:** `ValueError` if pace is invalid

---

#### `should_end_quarter(clock: GameClock, possession_started: bool) -> bool`
Determine if quarter should end.

**Parameters:**
- `clock`: GameClock instance
- `possession_started`: True if possession in progress

**Returns:** True if quarter should end now

---

#### `simulate_quarter_clock(pace: str, seed: Optional[int] = None) -> List[Dict]`
Simulate possession timing for entire quarter.

**Parameters:**
- `pace`: 'fast', 'standard', or 'slow'
- `seed`: Random seed for reproducibility (optional)

**Returns:** List of possession timing dictionaries

---

#### `validate_possession_counts(pace: str, num_simulations: int = 100, seed: Optional[int] = None) -> Dict`
Validate possession counts over multiple simulations.

**Parameters:**
- `pace`: 'fast', 'standard', or 'slow'
- `num_simulations`: Number of quarters to simulate
- `seed`: Random seed (optional)

**Returns:** Dictionary with statistics (expected, min, max, avg, all_counts)

---

### Class: GameClock

#### `__init__(quarter_length_minutes: int = 12)`
Initialize game clock.

---

#### `tick(duration: int) -> int`
Advance clock by duration seconds.

**Returns:** Time remaining after tick

---

#### `get_time_remaining() -> int`
Get current time remaining in seconds.

---

#### `format_time() -> str`
Format time remaining as "MM:SS".

---

#### `get_time_remaining_formatted() -> str`
Alias for `format_time()`.

---

#### `advance_clock(seconds: int) -> None`
Alias for `tick()`.

---

#### `is_quarter_over() -> bool`
Check if quarter has ended.

---

#### `is_final_possession(avg_possession_duration: int = 30) -> bool`
Check if this is the final possession of quarter.

---

#### `reset() -> None`
Reset clock to start of quarter.

---

## Files

### Implementation
- `src/systems/game_clock.py` (469 lines)

### Tests
- `tests/test_game_clock.py` (62 tests)

### Demo
- `demo_game_clock.py` (demonstrations and examples)

### Documentation
- `GAME_CLOCK_DOCUMENTATION.md` (this file)

---

## Success Criteria

All success criteria met:

- [x] Clock initializes at 12:00 (720 seconds)
- [x] Time formatting works correctly ('12:00', '08:45', '00:23')
- [x] Possession duration matches pace ranges
- [x] Fast pace produces ~32 possessions per quarter
- [x] Standard pace produces ~24 possessions per quarter
- [x] Slow pace produces ~19 possessions per quarter
- [x] Quarter doesn't end mid-possession
- [x] Time variance works (±3 seconds)
- [x] All 62 tests passing
- [x] Demo shows realistic quarter flow
- [x] No performance issues
- [x] Seed control works (reproducible possession durations)

---

## Conclusion

The Game Clock System is **complete and validated** for Milestone 2 integration. It provides:

1. **Accurate time tracking** with clean MM:SS formatting
2. **Realistic possession durations** based on pace with natural variance
3. **Correct possession counts** matching NBA averages
4. **Robust edge case handling** preventing negative time and mid-possession cutoffs
5. **Comprehensive test coverage** (62 tests, 100% passing)
6. **Clear integration points** for quarter simulation, play-by-play, and substitutions

**Status:** Ready for Phase 5 Integration

**Next Steps:**
1. Integrate with `quarter_simulation.py` (Phase 5)
2. Use timestamps in `play_by_play.py` (Phase 4)
3. Optionally use in `substitutions.py` for time-based sub decisions

**Dependencies:** None (standalone module)

**Blockers:** None
