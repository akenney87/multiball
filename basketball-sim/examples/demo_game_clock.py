"""
Game Clock System Demo

Demonstrates quarter clock management with different pace settings.

Shows:
- Fast pace quarter (~32 possessions)
- Standard pace quarter (~24 possessions)
- Slow pace quarter (~19 possessions)
- Time formatting examples
- Possession count validation
"""

import random
from src.systems.game_clock import (
    GameClock,
    calculate_possession_duration,
    estimate_possessions_per_quarter,
    simulate_quarter_clock,
    validate_possession_counts
)


def print_separator(char='=', length=80):
    """Print a separator line."""
    print(char * length)


def demo_basic_clock():
    """Demonstrate basic clock operations."""
    print_separator()
    print("DEMO 1: BASIC CLOCK OPERATIONS")
    print_separator()

    clock = GameClock()
    print(f"\nInitial state:")
    print(f"  Time remaining: {clock.get_time_remaining()} seconds")
    print(f"  Formatted: {clock.format_time()}")
    print(f"  Quarter over: {clock.is_quarter_over()}")

    print(f"\nAfter 3 minutes (180 seconds):")
    clock.tick(180)
    print(f"  Time remaining: {clock.get_time_remaining()} seconds")
    print(f"  Formatted: {clock.format_time()}")

    print(f"\nAfter 6 more minutes (360 seconds):")
    clock.tick(360)
    print(f"  Time remaining: {clock.get_time_remaining()} seconds")
    print(f"  Formatted: {clock.format_time()}")

    print(f"\nAfter reaching end of quarter:")
    clock.tick(180)
    print(f"  Time remaining: {clock.get_time_remaining()} seconds")
    print(f"  Formatted: {clock.format_time()}")
    print(f"  Quarter over: {clock.is_quarter_over()}")

    print(f"\nAfter reset:")
    clock.reset()
    print(f"  Time remaining: {clock.get_time_remaining()} seconds")
    print(f"  Formatted: {clock.format_time()}")


def demo_possession_duration():
    """Demonstrate possession duration calculation."""
    print_separator()
    print("DEMO 2: POSSESSION DURATION CALCULATION")
    print_separator()

    random.seed(42)

    for pace in ['fast', 'standard', 'slow']:
        print(f"\n{pace.upper()} PACE:")
        durations = [calculate_possession_duration(pace) for _ in range(10)]
        print(f"  10 sample possessions: {durations}")
        print(f"  Average: {sum(durations) / len(durations):.1f} seconds")
        print(f"  Min: {min(durations)}, Max: {max(durations)}")

    print(f"\nTRANSITION POSSESSIONS (pace-independent):")
    durations = [calculate_possession_duration('standard', is_transition=True) for _ in range(10)]
    print(f"  10 sample possessions: {durations}")
    print(f"  Average: {sum(durations) / len(durations):.1f} seconds")


def demo_quarter_simulation(pace: str, seed: int = 42):
    """Demonstrate full quarter simulation."""
    print_separator()
    print(f"DEMO: {pace.upper()} PACE QUARTER SIMULATION")
    print_separator()

    possessions = simulate_quarter_clock(pace, seed=seed)
    expected = estimate_possessions_per_quarter(pace)

    print(f"\nExpected possessions: {expected}")
    print(f"Actual possessions: {len(possessions)}")
    print(f"\nFirst 5 possessions:")

    for p in possessions[:5]:
        print(f"  #{p['possession_num']:2d} | {p['start_time']} -> {p['end_time']} "
              f"({p['duration']:2d} sec)")

    print(f"\n  ... ({len(possessions) - 10} possessions omitted) ...\n")

    print(f"Last 5 possessions:")
    for p in possessions[-5:]:
        print(f"  #{p['possession_num']:2d} | {p['start_time']} -> {p['end_time']} "
              f"({p['duration']:2d} sec)")

    # Calculate total time
    total_time = sum(p['duration'] for p in possessions)
    print(f"\nTotal time: {total_time} seconds ({total_time // 60}:{total_time % 60:02d})")


def demo_validation():
    """Demonstrate possession count validation."""
    print_separator()
    print("DEMO 4: POSSESSION COUNT VALIDATION (100 simulations)")
    print_separator()

    for pace in ['fast', 'standard', 'slow']:
        result = validate_possession_counts(pace, num_simulations=100, seed=42)

        print(f"\n{pace.upper()} PACE:")
        print(f"  Expected: {result['expected']} possessions")
        print(f"  Actual average: {result['avg']:.1f} possessions")
        print(f"  Range: {result['min']} - {result['max']}")
        print(f"  Within expected range: ", end='')

        # Check if within ±15% of expected
        lower_bound = result['expected'] * 0.85
        upper_bound = result['expected'] * 1.15

        if lower_bound <= result['avg'] <= upper_bound:
            print("[YES]")
        else:
            print("[NO]")


def demo_time_formatting():
    """Demonstrate time formatting."""
    print_separator()
    print("DEMO 5: TIME FORMATTING EXAMPLES")
    print_separator()

    clock = GameClock()
    examples = [
        (0, "Start of quarter"),
        (75, "After 1:15"),
        (195, "After 3:15"),
        (360, "Halftime of quarter"),
        (695, "Final 25 seconds"),
        (717, "Final 3 seconds"),
        (720, "End of quarter")
    ]

    print("\nTime    | Elapsed | Remaining | Description")
    print("-" * 60)

    for elapsed, description in examples:
        clock.reset()
        clock.tick(elapsed)
        remaining = clock.get_time_remaining()
        print(f"{clock.format_time()} | {elapsed:3d} sec | {remaining:3d} sec  | {description}")


def demo_pace_comparison():
    """Compare all three pace settings side by side."""
    print_separator()
    print("DEMO 6: PACE COMPARISON (Same seed for all)")
    print_separator()

    results = {}
    for pace in ['fast', 'standard', 'slow']:
        possessions = simulate_quarter_clock(pace, seed=99)
        results[pace] = possessions

    print(f"\n{'Possession':<12} | {'Fast':<20} | {'Standard':<20} | {'Slow':<20}")
    print("-" * 80)

    max_possessions = max(len(p) for p in results.values())

    for i in range(min(10, max_possessions)):
        row = f"#{i+1:<11} |"

        for pace in ['fast', 'standard', 'slow']:
            if i < len(results[pace]):
                p = results[pace][i]
                row += f" {p['start_time']} ({p['duration']:2d}s) |"
            else:
                row += " " * 21 + "|"

        print(row)

    print(f"\nTotal possessions: Fast={len(results['fast'])}, "
          f"Standard={len(results['standard'])}, "
          f"Slow={len(results['slow'])}")


def main():
    """Run all demos."""
    print("\n")
    print_separator('*')
    print("BASKETBALL SIMULATOR - GAME CLOCK SYSTEM DEMO")
    print_separator('*')

    # Run all demos
    demo_basic_clock()
    print("\n")

    demo_possession_duration()
    print("\n")

    demo_quarter_simulation('fast', seed=42)
    print("\n")

    demo_quarter_simulation('standard', seed=42)
    print("\n")

    demo_quarter_simulation('slow', seed=42)
    print("\n")

    demo_validation()
    print("\n")

    demo_time_formatting()
    print("\n")

    demo_pace_comparison()
    print("\n")

    print_separator('*')
    print("DEMO COMPLETE")
    print_separator('*')
    print("\nKey Takeaways:")
    print("  - Fast pace: ~32 possessions per quarter")
    print("  - Standard pace: ~24 possessions per quarter")
    print("  - Slow pace: ~19 possessions per quarter")
    print("  - Time formatting: MM:SS (e.g., 08:45)")
    print("  - Quarter ends at 0:00 or when < 25 seconds remain")
    print("  - Possession durations have realistic variance (±3 seconds)")
    print()


if __name__ == '__main__':
    main()
