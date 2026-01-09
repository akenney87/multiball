"""
Quick validation script for Game Clock System

Validates all key requirements are met before Phase 5 integration.
"""

import random
from src.systems.game_clock import (
    GameClock,
    calculate_possession_duration,
    estimate_possessions_per_quarter,
    simulate_quarter_clock,
    validate_possession_counts as validate_counts_func
)


def validate_basic_functionality():
    """Test basic GameClock functionality."""
    print("1. Testing basic GameClock functionality...")

    clock = GameClock()
    assert clock.get_time_remaining() == 720, "Clock should start at 720 seconds"
    assert clock.format_time() == "12:00", "Should format as 12:00"
    assert not clock.is_quarter_over(), "Quarter should not be over at start"

    clock.tick(360)
    assert clock.get_time_remaining() == 360, "Should have 360 seconds after 6 minutes"
    assert clock.format_time() == "06:00", "Should format as 06:00"

    clock.tick(360)
    assert clock.get_time_remaining() == 0, "Should be at 0 after 12 minutes"
    assert clock.is_quarter_over(), "Quarter should be over"

    print("   [PASS] Basic functionality")


def validate_possession_durations():
    """Test possession duration calculations."""
    print("2. Testing possession duration calculations...")

    random.seed(42)

    # Test ranges
    for _ in range(100):
        fast = calculate_possession_duration('fast')
        assert 20 <= fast <= 25, f"Fast pace out of range: {fast}"

        standard = calculate_possession_duration('standard')
        assert 25 <= standard <= 35, f"Standard pace out of range: {standard}"

        slow = calculate_possession_duration('slow')
        assert 30 <= slow <= 45, f"Slow pace out of range: {slow}"

        transition = calculate_possession_duration('standard', is_transition=True)
        assert 15 <= transition <= 20, f"Transition out of range: {transition}"

    print("   [PASS] Possession duration ranges")


def validate_possession_counts():
    """Test possession count estimates."""
    print("3. Testing possession count estimates...")

    assert estimate_possessions_per_quarter('fast') == 32, "Fast should be 32"
    assert estimate_possessions_per_quarter('standard') == 24, "Standard should be 24"
    assert estimate_possessions_per_quarter('slow') == 19, "Slow should be 19"

    print("   [PASS] Possession count estimates")


def validate_quarter_simulation():
    """Test full quarter simulation."""
    print("4. Testing quarter simulation...")

    # Standard pace
    possessions = simulate_quarter_clock('standard', seed=42)
    assert 21 <= len(possessions) <= 27, f"Standard pace count out of range: {len(possessions)}"
    assert possessions[0]['start_time'] == '12:00', "Should start at 12:00"
    assert possessions[0]['possession_num'] == 1, "Should start at possession 1"

    # Fast pace
    possessions = simulate_quarter_clock('fast', seed=42)
    assert 28 <= len(possessions) <= 36, f"Fast pace count out of range: {len(possessions)}"

    # Slow pace
    possessions = simulate_quarter_clock('slow', seed=42)
    assert 16 <= len(possessions) <= 22, f"Slow pace count out of range: {len(possessions)}"

    print("   [PASS] Quarter simulation")


def validate_edge_cases():
    """Test edge case handling."""
    print("5. Testing edge cases...")

    # Negative time protection
    clock = GameClock()
    clock.tick(800)
    assert clock.get_time_remaining() == 0, "Should clamp to 0"

    # Zero tick
    clock.reset()
    clock.tick(0)
    assert clock.get_time_remaining() == 720, "Zero tick should be no-op"

    # Custom quarter length
    clock = GameClock(quarter_length_minutes=10)
    assert clock.get_time_remaining() == 600, "Custom length should work"

    # Invalid pace
    try:
        calculate_possession_duration('invalid')
        assert False, "Should raise ValueError"
    except ValueError:
        pass

    print("   [PASS] Edge cases")


def validate_statistical_accuracy():
    """Test statistical accuracy over 100 simulations."""
    print("6. Testing statistical accuracy (100 simulations)...")

    for pace, expected in [('fast', 32), ('standard', 24), ('slow', 19)]:
        result = validate_counts_func(pace, num_simulations=100, seed=42)

        # Check within ±15% of expected
        lower = expected * 0.85
        upper = expected * 1.15

        assert lower <= result['avg'] <= upper, \
            f"{pace} average {result['avg']} outside range [{lower}, {upper}]"

        print(f"   {pace.capitalize()}: {result['avg']:.1f} possessions (expected {expected}) [OK]")

    print("   [PASS] Statistical accuracy")


def validate_time_formatting():
    """Test time formatting edge cases."""
    print("7. Testing time formatting...")

    test_cases = [
        (0, "12:00"),
        (60, "11:00"),
        (75, "10:45"),
        (195, "08:45"),
        (360, "06:00"),
        (717, "00:03"),
        (720, "00:00")
    ]

    clock = GameClock()
    for elapsed, expected in test_cases:
        clock.reset()
        clock.tick(elapsed)
        actual = clock.format_time()
        assert actual == expected, f"Expected {expected}, got {actual} for {elapsed}s elapsed"

    print("   [PASS] Time formatting")


def main():
    """Run all validations."""
    print("=" * 60)
    print("GAME CLOCK SYSTEM VALIDATION")
    print("=" * 60)
    print()

    try:
        validate_basic_functionality()
        validate_possession_durations()
        validate_possession_counts()
        validate_quarter_simulation()
        validate_edge_cases()
        validate_statistical_accuracy()
        validate_time_formatting()

        print()
        print("=" * 60)
        print("ALL VALIDATIONS PASSED")
        print("=" * 60)
        print()
        print("Game Clock System is READY for Phase 5 integration.")
        print()
        return 0

    except AssertionError as e:
        print()
        print("=" * 60)
        print(f"VALIDATION FAILED: {e}")
        print("=" * 60)
        return 1


if __name__ == '__main__':
    exit(main())
