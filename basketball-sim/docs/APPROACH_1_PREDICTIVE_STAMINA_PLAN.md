# Approach 1: Predictive Stamina Management - Comprehensive Implementation Plan

## Executive Summary

Implement predictive stamina management to ensure starters can close games without being too exhausted. The system will forecast stamina at Q4 5:00 mark and adjust substitution timing in Q1-Q3 to guarantee starters have 75-85 stamina for crunch time.

**Core Principle**: Starters are closers. The system must plan ahead to ensure the best players finish games fresh.

---

## Problem Statement

### Current Issues
1. **Reactive substitutions**: System only checks current stamina, doesn't anticipate Q4 needs
2. **Last-minute exhaustion**: Starters can arrive at Q4 with 60-70 stamina, forcing substitution during crucial moments
3. **No forward-looking logic**: Coach doesn't "plan ahead" like real NBA coaches do

### User Requirement
> "In basketball the starters are also the closers. We need to add some logic to the substitution system so that the starters can finish the game without being too exhausted."

### Success Criteria
- Starters have 75-85 stamina at Q4 5:00 mark (final 5 minutes)
- No starters subbed out in final 2 minutes of close games (<5 point differential)
- Total minutes allocation still respected (±2 minutes variance acceptable)
- System produces NBA-realistic rotation patterns

---

## Design Overview

### Three-Component System

1. **Stamina Trajectory Predictor**: Forecasts stamina at Q4 5:00 based on current state
2. **Adaptive Substitution Logic**: Extends rest periods in Q1-Q3 if prediction shows Q4 exhaustion
3. **Crunch Time Protection**: Locks starters in during final 5 minutes unless catastrophically fatigued

---

## Component 1: Stamina Trajectory Predictor

### Purpose
Calculate predicted stamina at Q4 5:00 mark for each starter, accounting for:
- Current stamina level
- Remaining game time
- Expected active/bench split (from minutes allocation)
- Stamina drain rate (pace-dependent)
- Stamina recovery rate (exponential curve)

### Algorithm

```python
def predict_stamina_at_q4_5min(
    player: Dict[str, Any],
    current_stamina: float,
    current_quarter: int,
    time_remaining_quarter: int,  # seconds
    minutes_allocation: Dict[str, float],
    pace: str,
    is_scoring_option: bool
) -> Tuple[float, Dict[str, Any]]:
    """
    Predict stamina at Q4 5:00 mark if player continues current rotation.

    Returns:
        (predicted_stamina, debug_info)
    """
```

### Calculation Steps

#### Step 1: Calculate time to Q4 5:00
```python
# Time from now to Q4 5:00 mark
quarters_remaining = 4 - current_quarter
time_in_current_quarter = (12 * 60) - time_remaining_quarter  # seconds elapsed
time_to_q4_5min = (quarters_remaining * 12 * 60) + (7 * 60) - time_in_current_quarter
# ^ This gets us to Q4 5:00 mark (7 minutes into Q4)
```

#### Step 2: Estimate active/bench split
```python
# Use minutes allocation to estimate % time active
player_allocation = minutes_allocation[player['name']]
total_game_minutes = 48.0
expected_play_percentage = player_allocation / total_game_minutes  # e.g., 36/48 = 0.75

# Apply to remaining time
time_to_q4_5min_minutes = time_to_q4_5min / 60.0
estimated_active_minutes = time_to_q4_5min_minutes * expected_play_percentage
estimated_bench_minutes = time_to_q4_5min_minutes * (1 - expected_play_percentage)
```

#### Step 3: Simulate stamina drain
```python
# Use existing stamina cost calculation
# Average possession: ~24 seconds, so possessions per minute = 2.5
possessions_per_minute = 2.5

# Get player-specific drain rate
player_stamina_attr = player.get('stamina', 50)
player_accel = player.get('acceleration', 50)
player_speed = player.get('top_speed', 50)

avg_cost_per_possession = calculate_stamina_cost(
    pace=pace,
    is_scoring_option=is_scoring_option,
    is_transition=False,  # Conservative estimate
    player_stamina_attribute=player_stamina_attr,
    player_acceleration=player_accel,
    player_top_speed=player_speed
)

total_drain = avg_cost_per_possession * possessions_per_minute * estimated_active_minutes
```

#### Step 4: Simulate stamina recovery
```python
# Use exponential recovery formula
# Assume average stamina during bench time = (current + predicted_after_drain) / 2
# This is a simplification but reasonable for prediction

avg_stamina_during_bench = current_stamina - (total_drain / 2)
avg_stamina_during_bench = max(0, min(100, avg_stamina_during_bench))

# Calculate average recovery rate at that stamina level
avg_recovery_per_minute = 8.0 * (1 - avg_stamina_during_bench / 100.0)

# Apply stamina attribute modifier
stamina_recovery_modifier = 1.0 + ((player_stamina_attr - 50) / 50.0) * 0.13
avg_recovery_per_minute *= stamina_recovery_modifier

total_recovery = avg_recovery_per_minute * estimated_bench_minutes
```

#### Step 5: Calculate predicted stamina
```python
predicted_stamina = current_stamina - total_drain + total_recovery
predicted_stamina = max(0, min(100, predicted_stamina))

# Return with debug info
debug_info = {
    'time_to_q4_5min_minutes': time_to_q4_5min_minutes,
    'estimated_active_minutes': estimated_active_minutes,
    'estimated_bench_minutes': estimated_bench_minutes,
    'total_drain': total_drain,
    'total_recovery': total_recovery,
    'net_change': total_recovery - total_drain
}

return (predicted_stamina, debug_info)
```

### Accuracy Considerations

**Sources of Error**:
1. Actual rotation may differ from allocation percentage (blowouts, foul trouble)
2. Pace changes mid-game (teams speed up when trailing)
3. Transition possessions drain more (not accounted in average)
4. Recovery rate varies with exact stamina trajectory (we use average)

**Mitigation**:
- Use conservative estimates (assume slightly more drain, slightly less recovery)
- Add 5-point buffer to target (predict for 80 stamina, enforce at 75)
- Re-calculate prediction every substitution check (updates with reality)

---

## Component 2: Adaptive Substitution Logic

### Purpose
Modify existing Rule #1 (starter return at 90+ stamina) to include Q4 stamina check.

### Integration Point
File: `src/systems/substitutions.py`
Function: `SubstitutionManager._check_team_substitutions()` (lines 614-751)

### Modified Rule #1 Logic

```python
# RULE #1: Check for starters on bench who are ready to return
for bench_player in bench_players[:]:
    bench_player_name = bench_player['name']
    is_starter = self._is_starter(bench_player_name)
    bench_stamina = stamina_values.get(bench_player_name, 0)

    # Rule #1: Starter with 90+ stamina is ready to return
    if is_starter and bench_stamina >= 90.0:

        # NEW: Q4 Stamina Check (only in Q1-Q3)
        if quarter_number < 4:
            predicted_q4_stamina = self._predict_q4_stamina(
                player=bench_player,
                current_stamina=bench_stamina,
                current_quarter=quarter_number,
                time_remaining_quarter=time_remaining_in_quarter,
                minutes_allocation=minutes_allocation,
                pace=pace,
                is_scoring_option=(bench_player_name in scoring_options)
            )

            # If predicted Q4 stamina < 75, keep resting (extend bench time)
            if predicted_q4_stamina < 75.0:
                # Log decision for debugging
                if debug:
                    print(f"[Q{quarter_number}] {bench_player_name} staying benched "
                          f"(stamina {bench_stamina:.1f}, predicted Q4: {predicted_q4_stamina:.1f})")
                continue  # Skip this player, check next

        # If prediction is OK (or we're in Q4), proceed with normal return logic
        # ... (existing code for finding position match and executing substitution)
```

### Key Features

1. **Only active in Q1-Q3**: No prediction needed in Q4 (already in crunch time)
2. **Conservative threshold**: Predict for 75, but original code requires 90 to return (buffer)
3. **Non-invasive**: Only adds one check, doesn't change existing flow
4. **Debug-friendly**: Logs all decisions for validation

---

## Component 3: Crunch Time Protection

### Purpose
Prevent starters from being subbed out in final 5 minutes of close games.

### Integration Point
File: `src/systems/substitutions.py`
Function: `SubstitutionManager._check_team_substitutions()` (lines 654-703)

### Modified Rule #2 Logic

```python
# RULE #2: Check for starters who need to be subbed out
for player in active_players:
    player_name = player['name']
    current_stamina = stamina_tracker.get_current_stamina(player_name)
    is_starter = self._is_starter(player_name)

    # NEW: Q4 Crunch Time Protection (final 5 minutes, ±10 points)
    is_crunch_time = (
        quarter_number == 4 and
        time_remaining_in_quarter <= 300 and  # 5 minutes = 300 seconds
        abs(score_differential) <= 10
    )

    # Original Rule #3: final 2 min, ±5 pts, threshold = 50
    # NEW: Extend to final 5 min, ±10 pts, threshold = 55
    if is_crunch_time and is_starter:
        stamina_threshold = 55.0  # More lenient than 50 (play fatigued stars)
    else:
        # Normal threshold (existing logic)
        stamina_threshold = 50.0 if (quarter_number == 4 and time_remaining_in_quarter <= 120) else 70.0

    if is_starter and current_stamina < stamina_threshold and bench_players:
        # ... (existing substitution logic)
```

### Thresholds

| Game State | Stamina Threshold | Reasoning |
|------------|-------------------|-----------|
| Q1-Q3 | 70 | Normal rotation, preserve Q4 stamina |
| Q4 5:01+ (blowout >10 pts) | 70 | Normal rotation, game decided |
| Q4 5:00-2:01 (close ±10 pts) | 55 | Crunch time, play fatigued stars |
| Q4 2:00-0:00 (close ±5 pts) | 50 | Final stretch, only sub if catastrophic |

---

## Edge Cases and Handling

### Edge Case 1: Starter in Foul Trouble
**Scenario**: Starter has 4 fouls in Q3, prediction says rest more, but risk fouling out.
**Solution**: Add foul check to prediction. If player has 4+ fouls, allow return even if predicted Q4 stamina < 75.

```python
# Check foul trouble (if foul system implemented)
player_fouls = foul_tracker.get_player_fouls(bench_player_name) if foul_tracker else 0
if player_fouls >= 4:
    # Foul trouble overrides Q4 stamina prediction
    continue  # Proceed with normal return logic
```

### Edge Case 2: Blowout Game
**Scenario**: Game is +25 in Q3, no need to preserve starters for Q4.
**Solution**: Disable Q4 prediction if score differential > 15 points.

```python
# Check blowout
if abs(score_differential) > 15:
    # Blowout, no need for Q4 protection
    continue  # Proceed with normal return logic
```

### Edge Case 3: All Bench Players Fatigued
**Scenario**: Starter has 68 stamina, needs to stay in because all bench < 70.
**Solution**: Existing code already handles this (select_substitute returns None if no valid sub).

### Edge Case 4: Overtime
**Scenario**: Game goes to OT, need to extend Q4 logic to Q5.
**Solution**: Treat Q5 same as Q4 (crunch time throughout, no prediction needed).

```python
is_crunch_time = (
    (quarter_number == 4 and time_remaining_in_quarter <= 300) or
    quarter_number >= 5  # All of OT is crunch time
) and abs(score_differential) <= 10
```

### Edge Case 5: Prediction Error Accumulation
**Scenario**: Prediction is consistently wrong (pace changes, foul trouble), starters arrive at Q4 with 65 stamina.
**Solution**: Validate in testing. If prediction accuracy < 80%, add adaptive correction:

```python
# Track prediction error
self.prediction_errors: List[float] = []

# After each actual Q4 arrival, compare to prediction
actual_q4_stamina = stamina_tracker.get_current_stamina(player_name)
predicted_q4_stamina = self.q4_predictions.get(player_name, actual_q4_stamina)
error = actual_q4_stamina - predicted_q4_stamina
self.prediction_errors.append(error)

# Apply moving average correction to future predictions
if len(self.prediction_errors) > 10:
    avg_error = sum(self.prediction_errors[-10:]) / 10
    # Adjust prediction by average error
    predicted_q4_stamina += avg_error
```

---

## Implementation Plan

### Phase 1: Core Prediction Function (2-3 hours)
**File**: `src/systems/substitutions.py`

1. Add `predict_stamina_at_q4_5min()` method to `SubstitutionManager` class
2. Implement 5-step calculation algorithm
3. Add unit tests for prediction accuracy

**Test Cases**:
- Starter at 100 stamina, Q1 start → predict ~85 at Q4 5:00
- Starter at 80 stamina, Q2 6:00 → predict ~75 at Q4 5:00
- Starter at 70 stamina, Q3 3:00 → predict ~65 at Q4 5:00 (needs extended rest)

### Phase 2: Integrate with Rule #1 (1-2 hours)
**File**: `src/systems/substitutions.py` (lines 709-750)

1. Add Q4 stamina check to Rule #1 loop
2. Add debug logging for decisions
3. Test with 5-game sample to verify no regressions

**Validation**:
- Run 5 games with debug=True
- Check that starters with predicted Q4 stamina < 75 stay benched
- Verify they eventually return when prediction improves

### Phase 3: Extend Crunch Time Protection (1 hour)
**File**: `src/systems/substitutions.py` (lines 654-703)

1. Modify Rule #2 to use 55 threshold in Q4 5:00-2:01 (close games)
2. Keep existing 50 threshold for Q4 2:00-0:00
3. Add debug logging

**Validation**:
- Run 5 games with close Q4 scenarios
- Verify starters stay in during final 5 minutes

### Phase 4: Edge Case Handling (2 hours)
**File**: `src/systems/substitutions.py`

1. Add foul trouble check (if foul system exists)
2. Add blowout detection (score differential > 15)
3. Add overtime handling (quarter >= 5)
4. Test each edge case with targeted scenarios

### Phase 5: Integration Testing (3-4 hours)
**Validation Script**: `validate_substitution_closers.py`

1. Run 50 games with diverse scenarios:
   - 20 close games (±10 pts most of game)
   - 20 blowouts (>15 pts for extended periods)
   - 10 comeback games (lead changes in Q4)
2. Measure:
   - Average starter stamina at Q4 5:00 (target: 78-85)
   - % of games where starters play final 2 min (target: >90% if close)
   - Minutes allocation variance (target: ±2 minutes)
   - Substitution frequency in Q4 (target: <2 per team in close games)

### Phase 6: Documentation and Tuning (1-2 hours)

1. Document prediction algorithm in code comments
2. Add debug output mode for coaches to understand decisions
3. Tune threshold values based on validation results
4. Update CLAUDE.md with new substitution logic

**Total Estimated Time: 10-14 hours**

---

## Validation Metrics

### Primary Metrics (Must Achieve)

1. **Q4 Stamina**: Average starter stamina at Q4 5:00 mark = 78-85
2. **Closer Availability**: 95%+ of close games have starters play final 2 minutes
3. **Minutes Accuracy**: Minutes allocation variance ≤ ±2 minutes per player

### Secondary Metrics (Monitor)

4. **Prediction Accuracy**: Within ±10 stamina points 80%+ of the time
5. **Substitution Frequency**: Q1-Q3 substitutions increase by 10-20% (more proactive rest)
6. **Rotation Naturalness**: No "artificial" patterns noticed in game logs

### Validation Script Structure

```python
# validate_substitution_closers.py
results = {
    'q4_5min_stamina': [],  # List of (player, stamina) at Q4 5:00
    'closer_playtime': [],  # List of (player, minutes_in_final_2min)
    'minutes_variance': [], # List of (player, allocated, actual, variance)
    'prediction_accuracy': [], # List of (predicted, actual, error)
}

for game_num in range(50):
    # Simulate game with debug output
    result = simulate_game(debug=True)

    # Extract Q4 5:00 stamina for starters
    # Extract closer playtime in final 2 min
    # Calculate minutes variance
    # Compare predictions to actual

    # Store in results
    ...

# Analyze results
print("="*80)
print("SUBSTITUTION SYSTEM VALIDATION - APPROACH 1")
print("="*80)
print(f"Average Q4 5:00 Stamina (starters): {mean(q4_stamina):.1f} (target: 78-85)")
print(f"Closer Availability (close games): {pct_closers_available:.1f}% (target: >95%)")
print(f"Minutes Variance: ±{mean(abs_variance):.1f} (target: ≤2.0)")
print(f"Prediction Accuracy: {pct_within_10:.1f}% within ±10 (target: >80%)")
```

---

## Risks and Mitigations

### Risk 1: Over-Engineering
**Risk**: System becomes too complex, hard to debug, introduces bugs.
**Mitigation**: Keep prediction algorithm simple (5 steps, clear logic). Add extensive debug logging. Validate after each phase.

### Risk 2: Prediction Inaccuracy
**Risk**: Predictions are consistently wrong, system makes bad decisions.
**Mitigation**: Use conservative estimates. Add 5-point buffer. Re-calculate every substitution check. Track error and add adaptive correction if needed (Phase 5 contingency).

### Risk 3: User Experience Degradation
**Risk**: Rotations feel artificial, users notice "weird" patterns.
**Mitigation**: Extensive playtesting. Compare to NBA box scores for rotation patterns. Add randomness if patterns are too rigid (±2 minute jitter on thresholds).

### Risk 4: Minutes Allocation Conflict
**Risk**: Q4 stamina preservation conflicts with user's minutes allocation, players get fewer minutes.
**Mitigation**: System only adjusts TIMING of minutes, not total. Starters still get 36-40 minutes, just distributed differently (more Q1/early Q2, rest mid-Q2/Q3, full Q4). Validate total minutes are within ±2.

### Risk 5: Integration Breakage
**Risk**: Changes break existing substitution logic, cause regressions.
**Mitigation**: Unit test every function. Run regression suite (existing games) before and after. Use feature flag to disable new logic if issues found.

---

## Testing Strategy

### Unit Tests (pytest)

```python
# test_substitution_prediction.py

def test_predict_stamina_q4_basic():
    """Test basic prediction at Q1 start."""
    player = create_test_player(stamina=50, accel=50, speed=50)
    predicted, debug = predict_stamina_at_q4_5min(
        player, current_stamina=100, current_quarter=1,
        time_remaining_quarter=720, minutes_allocation={player['name']: 36},
        pace='standard', is_scoring_option=True
    )
    # After 36 minutes with standard pace, scoring option
    # Expected: ~80-85 stamina at Q4 5:00
    assert 78 <= predicted <= 87, f"Expected 78-87, got {predicted}"

def test_predict_stamina_q3_low():
    """Test prediction in Q3 with low stamina (needs extended rest)."""
    player = create_test_player(stamina=50, accel=50, speed=50)
    predicted, debug = predict_stamina_at_q4_5min(
        player, current_stamina=70, current_quarter=3,
        time_remaining_quarter=360, minutes_allocation={player['name']: 36},
        pace='standard', is_scoring_option=False
    )
    # Starting at 70 in Q3, should predict ~65-70 at Q4 5:00
    # System should extend rest to raise prediction
    assert 60 <= predicted <= 75

def test_predict_stamina_edge_case_blowout():
    """Test that blowout disables Q4 protection."""
    # (test implementation)
    pass
```

### Integration Tests (game simulations)

```python
# test_substitution_integration.py

def test_starters_available_q4_close_game():
    """Test that starters are fresh in Q4 of close game."""
    game = create_close_game_scenario()  # Score stays within ±8 all game
    result = simulate_game(game)

    # Check Q4 5:00 stamina for all starters
    for starter in result.home_starters:
        stamina_at_q4_5min = get_stamina_at_time(result, starter, quarter=4, time_remaining=300)
        assert stamina_at_q4_5min >= 75, f"{starter} had only {stamina_at_q4_5min} at Q4 5:00"

def test_minutes_allocation_respected():
    """Test that total minutes still match allocation."""
    game = create_test_game()
    result = simulate_game(game)

    for player in game.home_roster:
        allocated = game.minutes_allocation[player['name']]
        actual = result.get_minutes_played(player['name'])
        variance = abs(actual - allocated)
        assert variance <= 2.0, f"{player['name']}: allocated {allocated}, played {actual}"
```

### Validation Tests (statistical)

```python
# validate_substitution_closers.py

# Run 50 games, measure:
# 1. Average Q4 5:00 stamina (target: 78-85)
# 2. % of close games with starters playing final 2 min (target: >95%)
# 3. Minutes allocation variance (target: ≤±2)
# 4. Prediction accuracy (target: >80% within ±10)

# Generate report with pass/fail criteria
```

---

## Alignment with Design Pillars

### Pillar 1: Deep, Intricate, Realistic Simulation
**✓ EXCELLENT**
- Mimics NBA coaching strategy (plan ahead for Q4)
- Produces realistic rotation patterns (starters rest in Q3, play full Q4)
- Accounts for game state (close vs blowout)

### Pillar 2: Weighted Dice-Roll Mechanics
**✓ ALIGNED**
- Prediction uses calculated probabilities (drain rates, recovery rates)
- No randomness in substitution logic (deterministic based on state)

### Pillar 3: Attribute-Driven Outcomes
**✓ EXCELLENT**
- Stamina attribute affects drain rate and recovery rate
- Acceleration + top_speed affect efficiency
- Predictions personalized per player

### Pillar 4: Tactical Input System
**✓ EXCELLENT**
- Respects minutes allocation (total minutes unchanged)
- Only adjusts TIMING of minutes, not total
- Responds to pace setting (affects drain prediction)
- User's scoring options affect prediction (is_scoring_option flag)

---

## Success Criteria

### Must Have (P0)
- [x] Starters have 75+ stamina at Q4 5:00 in 90%+ of close games
- [x] No starters subbed out in final 2 min of close games (catastrophic stamina only)
- [x] Minutes allocation variance ≤ ±2 minutes
- [x] No gameplay regressions (existing tests pass)

### Should Have (P1)
- [x] Prediction accuracy >80% (within ±10 stamina)
- [x] Debug logging for all substitution decisions
- [x] Edge cases handled (foul trouble, blowout, OT)

### Nice to Have (P2)
- [ ] Adaptive prediction correction (if accuracy < 80%)
- [ ] User-configurable thresholds (advanced settings)
- [ ] Visual dashboard for rotation patterns (future UI)

---

## Appendix: Constants and Formulas

### Stamina Drain (per possession)
```python
base_cost = 0.8
pace_modifier = {'fast': +0.3, 'standard': 0.0, 'slow': -0.3}
scoring_option_bonus = 0.2 if is_scoring_option else 0.0
transition_bonus = 0.1 if is_transition else 0.0

# Player modifiers
stamina_drain_modifier = 1.0 + ((50 - stamina_attr) / 50) * 0.15
speed_efficiency_modifier = 1.0 - ((avg_speed - 50) * 0.002)

total_cost = (base_cost + pace_modifier + scoring_option_bonus + transition_bonus)
             * stamina_drain_modifier * speed_efficiency_modifier
```

### Stamina Recovery (per minute on bench)
```python
recovery_per_minute = 8.0 * (1 - current_stamina / 100) * recovery_rate_modifier

# Player modifier
recovery_rate_modifier = 1.0 + ((stamina_attr - 50) / 50) * 0.13
```

### Substitution Thresholds
```python
# Rule #1: Starter return (bench → active)
return_threshold = 90.0  # Must reach 90+ stamina to be eligible
predicted_q4_threshold = 75.0  # Must predict 75+ at Q4 5:00 to return

# Rule #2: Starter exit (active → bench)
exit_threshold_normal = 70.0  # Q1-Q3 or Q4 blowout
exit_threshold_crunch = 55.0  # Q4 5:00-2:01, close game ±10 pts
exit_threshold_final = 50.0   # Q4 2:00-0:00, close game ±5 pts
```

---

## Implementation Checklist

### Pre-Implementation
- [x] Design document reviewed by basketball-sim-pm
- [ ] Design document reviewed by stamina-and-biology-engineer
- [ ] Design document reviewed by architecture-and-integration-lead
- [ ] All agents approve plan
- [ ] User approves plan

### Phase 1: Core Prediction
- [ ] Implement `predict_stamina_at_q4_5min()` method
- [ ] Add unit tests (3 test cases minimum)
- [ ] Validate prediction accuracy (±10 target)

### Phase 2: Rule #1 Integration
- [ ] Modify Rule #1 to check Q4 prediction
- [ ] Add debug logging
- [ ] Run 5 test games, verify no regressions

### Phase 3: Crunch Time Protection
- [ ] Modify Rule #2 thresholds for Q4 5:00-2:01
- [ ] Add debug logging
- [ ] Run 5 test games with close Q4 scenarios

### Phase 4: Edge Cases
- [ ] Add foul trouble check
- [ ] Add blowout detection
- [ ] Add overtime handling
- [ ] Test each edge case

### Phase 5: Validation
- [ ] Create `validate_substitution_closers.py` script
- [ ] Run 50 games (20 close, 20 blowout, 10 comeback)
- [ ] Measure all 6 metrics
- [ ] Verify all success criteria met

### Phase 6: Documentation
- [ ] Add docstrings to all new functions
- [ ] Update CLAUDE.md with new logic
- [ ] Create debug output guide for users
- [ ] Commit changes with comprehensive message

---

## Conclusion

Approach 1 (Predictive Stamina Management) provides the most NBA-realistic solution to the "starters are closers" problem. By forecasting stamina at Q4 5:00 and adjusting substitution timing proactively, the system ensures stars finish games fresh without compromising user control or minutes allocation.

**Estimated Implementation Time**: 10-14 hours
**Risk Level**: Medium (complexity offset by phased approach and extensive testing)
**Alignment with Pillars**: Excellent (4/4 pillars strongly supported)

**Recommendation**: Proceed with implementation after agent review and user approval.
