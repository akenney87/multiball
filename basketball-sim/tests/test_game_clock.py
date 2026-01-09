"""
Test Suite for Game Clock System

Tests all game clock functionality including:
- Clock initialization and time tracking
- Possession duration calculation
- End-of-quarter logic
- Time formatting
- Edge cases
"""

import random
import pytest
from src.systems.game_clock import (
    GameClock,
    calculate_possession_duration,
    estimate_possessions_per_quarter,
    should_end_quarter,
    simulate_quarter_clock,
    validate_possession_counts
)


# =============================================================================
# GAMECLOCK CLASS TESTS
# =============================================================================

class TestGameClockInitialization:
    """Test clock initialization."""

    def test_default_initialization(self):
        """Clock should initialize to 12:00 (720 seconds)."""
        clock = GameClock()
        assert clock.get_time_remaining() == 720
        assert clock.total_seconds == 720
        assert clock.elapsed_seconds == 0

    def test_custom_quarter_length(self):
        """Should support custom quarter lengths."""
        clock = GameClock(quarter_length_minutes=10)
        assert clock.get_time_remaining() == 600
        assert clock.total_seconds == 600

    def test_initial_state(self):
        """Quarter should not be over at start."""
        clock = GameClock()
        assert not clock.is_quarter_over()


class TestGameClockTimeManagement:
    """Test clock advancement and time tracking."""

    def test_tick_basic(self):
        """Tick should advance clock correctly."""
        clock = GameClock()
        remaining = clock.tick(30)
        assert remaining == 690
        assert clock.get_time_remaining() == 690

    def test_tick_multiple(self):
        """Multiple ticks should accumulate."""
        clock = GameClock()
        clock.tick(120)
        clock.tick(180)
        assert clock.get_time_remaining() == 420

    def test_tick_to_zero(self):
        """Ticking past zero should clamp to 0."""
        clock = GameClock()
        clock.tick(720)
        assert clock.get_time_remaining() == 0
        assert clock.is_quarter_over()

    def test_tick_beyond_zero(self):
        """Ticking beyond zero should stay at 0."""
        clock = GameClock()
        clock.tick(800)
        assert clock.get_time_remaining() == 0

    def test_tick_after_zero(self):
        """Ticking after reaching zero should stay at 0."""
        clock = GameClock()
        clock.tick(720)
        clock.tick(30)
        assert clock.get_time_remaining() == 0

    def test_advance_clock_alias(self):
        """advance_clock() should work as alias for tick()."""
        clock = GameClock()
        clock.advance_clock(100)
        assert clock.get_time_remaining() == 620


class TestGameClockFormatting:
    """Test time formatting."""

    def test_format_time_start(self):
        """Should format start time as 12:00."""
        clock = GameClock()
        assert clock.format_time() == "12:00"

    def test_format_time_mid_quarter(self):
        """Should format mid-quarter time correctly."""
        clock = GameClock()
        clock.tick(195)  # 525 seconds = 8:45
        assert clock.format_time() == "08:45"

    def test_format_time_single_digit_seconds(self):
        """Should zero-pad single digit seconds."""
        clock = GameClock()
        clock.tick(717)  # 3 seconds = 0:03
        assert clock.format_time() == "00:03"

    def test_format_time_zero(self):
        """Should format zero time as 00:00."""
        clock = GameClock()
        clock.tick(720)
        assert clock.format_time() == "00:00"

    def test_get_time_remaining_formatted(self):
        """get_time_remaining_formatted() should work as alias."""
        clock = GameClock()
        clock.tick(300)
        assert clock.get_time_remaining_formatted() == clock.format_time()


class TestGameClockQuarterEnd:
    """Test end-of-quarter logic."""

    def test_is_quarter_over_false(self):
        """Quarter should not be over with time remaining."""
        clock = GameClock()
        clock.tick(600)
        assert not clock.is_quarter_over()

    def test_is_quarter_over_exactly_zero(self):
        """Quarter should be over at exactly 0:00."""
        clock = GameClock()
        clock.tick(720)
        assert clock.is_quarter_over()

    def test_is_final_possession_false(self):
        """Should not be final possession with plenty of time."""
        clock = GameClock()
        assert not clock.is_final_possession()

    def test_is_final_possession_true(self):
        """Should be final possession with < 30 seconds."""
        clock = GameClock()
        clock.tick(695)  # 25 seconds left
        assert clock.is_final_possession()

    def test_is_final_possession_custom_duration(self):
        """Should respect custom possession duration."""
        clock = GameClock()
        clock.tick(660)  # 60 seconds left
        assert not clock.is_final_possession(avg_possession_duration=30)
        assert clock.is_final_possession(avg_possession_duration=70)


class TestGameClockReset:
    """Test clock reset functionality."""

    def test_reset_after_tick(self):
        """Reset should restore clock to start."""
        clock = GameClock()
        clock.tick(300)
        clock.reset()
        assert clock.get_time_remaining() == 720
        assert clock.elapsed_seconds == 0

    def test_reset_after_quarter_end(self):
        """Reset should work even after quarter ends."""
        clock = GameClock()
        clock.tick(720)
        clock.reset()
        assert clock.get_time_remaining() == 720
        assert not clock.is_quarter_over()


# =============================================================================
# POSSESSION DURATION TESTS
# =============================================================================

class TestPossessionDuration:
    """Test possession duration calculation."""

    def test_fast_pace_range(self):
        """Fast pace should produce 20-25 second possessions."""
        random.seed(42)
        durations = [calculate_possession_duration('fast') for _ in range(100)]
        assert all(20 <= d <= 25 for d in durations)

    def test_standard_pace_range(self):
        """Standard pace should produce 25-35 second possessions."""
        random.seed(42)
        durations = [calculate_possession_duration('standard') for _ in range(100)]
        assert all(25 <= d <= 35 for d in durations)

    def test_slow_pace_range(self):
        """Slow pace should produce 30-45 second possessions."""
        random.seed(42)
        durations = [calculate_possession_duration('slow') for _ in range(100)]
        assert all(30 <= d <= 45 for d in durations)

    def test_transition_override(self):
        """Transition should override pace setting."""
        random.seed(42)
        durations = [calculate_possession_duration('slow', is_transition=True) for _ in range(100)]
        assert all(15 <= d <= 20 for d in durations)

    def test_duration_is_integer(self):
        """Duration should always be an integer."""
        random.seed(42)
        for pace in ['fast', 'standard', 'slow']:
            duration = calculate_possession_duration(pace)
            assert isinstance(duration, int)

    def test_invalid_pace(self):
        """Invalid pace should raise ValueError."""
        with pytest.raises(ValueError, match="Invalid pace"):
            calculate_possession_duration('turbo')

    def test_variance_applied(self):
        """Variance should produce different results."""
        random.seed(42)
        durations = [calculate_possession_duration('standard') for _ in range(20)]
        # Should have at least 5 different values
        assert len(set(durations)) >= 5


class TestEstimatePossessions:
    """Test possession count estimation."""

    def test_fast_pace_estimate(self):
        """Fast pace should estimate ~32 possessions."""
        assert estimate_possessions_per_quarter('fast') == 32

    def test_standard_pace_estimate(self):
        """Standard pace should estimate ~24 possessions."""
        assert estimate_possessions_per_quarter('standard') == 24

    def test_slow_pace_estimate(self):
        """Slow pace should estimate ~19 possessions."""
        assert estimate_possessions_per_quarter('slow') == 19

    def test_invalid_pace_estimate(self):
        """Invalid pace should raise ValueError."""
        with pytest.raises(ValueError, match="Invalid pace"):
            estimate_possessions_per_quarter('ultra_slow')


# =============================================================================
# QUARTER FLOW TESTS
# =============================================================================

class TestShouldEndQuarter:
    """Test end-of-quarter decision logic."""

    def test_plenty_of_time_no_possession(self):
        """Should not end with plenty of time."""
        clock = GameClock()
        clock.tick(300)
        assert not should_end_quarter(clock, possession_started=False)

    def test_minimal_time_no_possession(self):
        """Should end with < 25 seconds and no possession."""
        clock = GameClock()
        clock.tick(700)  # 20 seconds left
        assert should_end_quarter(clock, possession_started=False)

    def test_minimal_time_possession_started(self):
        """Should not end mid-possession."""
        clock = GameClock()
        clock.tick(700)  # 20 seconds left
        assert not should_end_quarter(clock, possession_started=True)

    def test_time_expired_no_possession(self):
        """Should end when time expired."""
        clock = GameClock()
        clock.tick(720)
        assert should_end_quarter(clock, possession_started=False)

    def test_time_expired_possession_started(self):
        """Should allow possession to finish even after time expired."""
        clock = GameClock()
        clock.tick(720)
        assert not should_end_quarter(clock, possession_started=True)

    def test_boundary_25_seconds(self):
        """25 seconds is the boundary (should not end yet)."""
        clock = GameClock()
        clock.tick(695)  # Exactly 25 seconds left
        assert not should_end_quarter(clock, possession_started=False)

    def test_boundary_24_seconds(self):
        """24 seconds should trigger end."""
        clock = GameClock()
        clock.tick(696)  # 24 seconds left
        assert should_end_quarter(clock, possession_started=False)


class TestSimulateQuarterClock:
    """Test quarter clock simulation."""

    def test_standard_pace_possession_count(self):
        """Standard pace should produce ~24 possessions."""
        random.seed(42)
        possessions = simulate_quarter_clock('standard', seed=42)
        # Should be close to 24 (within ±3)
        assert 21 <= len(possessions) <= 27

    def test_fast_pace_possession_count(self):
        """Fast pace should produce ~32 possessions."""
        random.seed(42)
        possessions = simulate_quarter_clock('fast', seed=42)
        # Should be close to 32 (within ±4)
        assert 28 <= len(possessions) <= 36

    def test_slow_pace_possession_count(self):
        """Slow pace should produce ~19 possessions."""
        random.seed(42)
        possessions = simulate_quarter_clock('slow', seed=42)
        # Should be close to 19 (within ±3)
        assert 16 <= len(possessions) <= 22

    def test_possession_structure(self):
        """Each possession should have correct structure."""
        possessions = simulate_quarter_clock('standard', seed=42)
        for p in possessions:
            assert 'possession_num' in p
            assert 'start_time' in p
            assert 'duration' in p
            assert 'end_time' in p
            assert isinstance(p['possession_num'], int)
            assert isinstance(p['start_time'], str)
            assert isinstance(p['duration'], int)
            assert isinstance(p['end_time'], str)

    def test_possession_numbers_sequential(self):
        """Possession numbers should be sequential starting at 1."""
        possessions = simulate_quarter_clock('standard', seed=42)
        for i, p in enumerate(possessions):
            assert p['possession_num'] == i + 1

    def test_first_possession_starts_at_1200(self):
        """First possession should start at 12:00."""
        possessions = simulate_quarter_clock('standard', seed=42)
        assert possessions[0]['start_time'] == '12:00'

    def test_time_progresses_correctly(self):
        """End time of one possession should be near start of next."""
        possessions = simulate_quarter_clock('standard', seed=42)
        for i in range(len(possessions) - 1):
            # End time should match next start time
            assert possessions[i]['end_time'] == possessions[i + 1]['start_time']

    def test_seed_reproducibility(self):
        """Same seed should produce identical results."""
        possessions1 = simulate_quarter_clock('standard', seed=42)
        possessions2 = simulate_quarter_clock('standard', seed=42)
        assert len(possessions1) == len(possessions2)
        for p1, p2 in zip(possessions1, possessions2):
            assert p1 == p2


# =============================================================================
# VALIDATION TESTS
# =============================================================================

class TestValidatePossessionCounts:
    """Test possession count validation."""

    def test_validation_structure(self):
        """Validation should return correct structure."""
        result = validate_possession_counts('standard', num_simulations=10, seed=42)
        assert 'pace' in result
        assert 'expected' in result
        assert 'min' in result
        assert 'max' in result
        assert 'avg' in result
        assert 'all_counts' in result

    def test_validation_standard_pace(self):
        """Standard pace validation should match expected."""
        result = validate_possession_counts('standard', num_simulations=100, seed=42)
        assert result['pace'] == 'standard'
        assert result['expected'] == 24
        # Average should be close to 24 (within 3)
        assert 21 <= result['avg'] <= 27

    def test_validation_fast_pace(self):
        """Fast pace validation should match expected."""
        result = validate_possession_counts('fast', num_simulations=100, seed=42)
        assert result['pace'] == 'fast'
        assert result['expected'] == 32
        # Average should be close to 32 (within 4)
        assert 28 <= result['avg'] <= 36

    def test_validation_slow_pace(self):
        """Slow pace validation should match expected."""
        result = validate_possession_counts('slow', num_simulations=100, seed=42)
        assert result['pace'] == 'slow'
        assert result['expected'] == 19
        # Average should be close to 19 (within 3)
        assert 16 <= result['avg'] <= 22

    def test_validation_counts_length(self):
        """Should return correct number of simulations."""
        result = validate_possession_counts('standard', num_simulations=50, seed=42)
        assert len(result['all_counts']) == 50

    def test_validation_min_max(self):
        """Min/max should be from actual simulations."""
        result = validate_possession_counts('standard', num_simulations=100, seed=42)
        assert result['min'] == min(result['all_counts'])
        assert result['max'] == max(result['all_counts'])


# =============================================================================
# EDGE CASE TESTS
# =============================================================================

class TestEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_very_short_quarter(self):
        """Should handle 1-minute quarter."""
        clock = GameClock(quarter_length_minutes=1)
        assert clock.get_time_remaining() == 60
        clock.tick(30)
        assert clock.format_time() == "00:30"

    def test_negative_duration_protection(self):
        """Should not accept negative time."""
        clock = GameClock()
        clock.tick(800)  # Way past quarter end
        assert clock.get_time_remaining() >= 0

    def test_zero_duration_tick(self):
        """Ticking zero seconds should work."""
        clock = GameClock()
        remaining = clock.tick(0)
        assert remaining == 720

    def test_very_long_possession(self):
        """Should handle possession longer than remaining time."""
        clock = GameClock()
        clock.tick(710)  # 10 seconds left
        clock.tick(30)   # 30 second possession
        assert clock.get_time_remaining() == 0

    def test_format_time_all_values(self):
        """Format should work for all possible times."""
        clock = GameClock()
        for seconds in range(0, 721, 17):
            clock.reset()
            clock.tick(seconds)
            formatted = clock.format_time()
            assert len(formatted) == 5
            assert formatted[2] == ':'

    def test_possession_duration_consistency(self):
        """Same seed should give same durations."""
        random.seed(42)
        d1 = calculate_possession_duration('standard')
        random.seed(42)
        d2 = calculate_possession_duration('standard')
        assert d1 == d2


# =============================================================================
# INTEGRATION TESTS
# =============================================================================

class TestIntegration:
    """Test integration between components."""

    def test_full_quarter_simulation_completes(self):
        """Full quarter simulation should complete without errors."""
        possessions = simulate_quarter_clock('standard', seed=42)
        assert len(possessions) > 0
        assert possessions[0]['start_time'] == '12:00'

    def test_all_paces_complete_quarter(self):
        """All pace settings should complete quarter."""
        for pace in ['fast', 'standard', 'slow']:
            possessions = simulate_quarter_clock(pace, seed=42)
            assert len(possessions) > 0

    def test_validation_runs_without_errors(self):
        """Validation should run for all paces."""
        for pace in ['fast', 'standard', 'slow']:
            result = validate_possession_counts(pace, num_simulations=10, seed=42)
            assert result['avg'] > 0


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
