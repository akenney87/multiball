"""
Optimize Solution A: Fine-tune Gaussian variance parameter

Test different standard deviations to find optimal match for:
- Wide Open (6+ ft): ~30%
- Open (4-6 ft): ~35%
- Tight (2-4 ft): ~25%
- Very Tight (<2 ft): ~10%
"""

import random
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from src.core.probability import calculate_composite
from src.constants import WEIGHTS_CONTEST


def solution_a_with_variance(defender, std_dev=1.5, help_chance=0.20, zone_pct=30):
    """Solution A with configurable variance."""
    composite = calculate_composite(defender, WEIGHTS_CONTEST)

    # Existing formula
    distance = 10.0 - (composite / 10.0)

    # Acceleration closeout
    accel_mod = (defender['acceleration'] - 50) * -0.02
    distance += accel_mod

    # Help defense
    if random.random() < help_chance:
        distance += 3.0

    # Zone defense
    zone_mod = zone_pct / 100.0 * 1.0
    distance += zone_mod

    # Patience (average shooter = 50)
    patience = 50
    patience_mod = (patience - 50) * 0.02
    distance += patience_mod

    # Gaussian variance
    variance = random.gauss(0, std_dev)
    distance += variance

    # Clamp to realistic range
    distance = max(0.5, min(10.0, distance))

    return distance


def evaluate_solution(std_dev, n=10000):
    """Evaluate solution with given std_dev."""
    distances = []

    for _ in range(n):
        defender = {
            'height': random.randint(45, 75),
            'reactions': random.randint(45, 75),
            'agility': random.randint(45, 75),
            'balance': random.randint(45, 75),
            'determination': random.randint(45, 75),
            'acceleration': random.randint(45, 75),
        }

        distance = solution_a_with_variance(defender, std_dev=std_dev)
        distances.append(distance)

    # Calculate distribution
    wide_open = sum(1 for d in distances if d >= 6.0) / len(distances) * 100
    open_4_6 = sum(1 for d in distances if 4.0 <= d < 6.0) / len(distances) * 100
    tight_2_4 = sum(1 for d in distances if 2.0 <= d < 4.0) / len(distances) * 100
    very_tight = sum(1 for d in distances if d < 2.0) / len(distances) * 100

    # Calculate error from target
    error = (abs(wide_open - 30) + abs(open_4_6 - 35) +
             abs(tight_2_4 - 25) + abs(very_tight - 10))

    return {
        'wide_open': wide_open,
        'open': open_4_6,
        'tight': tight_2_4,
        'very_tight': very_tight,
        'error': error,
        'avg_distance': sum(distances) / len(distances)
    }


def test_variance_sweep():
    """Test range of std_dev values."""

    print("=" * 80)
    print("OPTIMIZING GAUSSIAN VARIANCE PARAMETER")
    print("=" * 80)
    print()

    # Test std_dev from 1.0 to 2.5 in 0.1 increments
    results = []

    print("Testing std_dev values from 1.0 to 2.5...")
    print()

    for std_dev_raw in range(10, 26):
        std_dev = std_dev_raw / 10.0
        result = evaluate_solution(std_dev)
        results.append((std_dev, result))

        print(f"std_dev={std_dev:.1f}  "
              f"Error={result['error']:5.1f}%  "
              f"Dist: {result['wide_open']:4.1f}% / "
              f"{result['open']:4.1f}% / "
              f"{result['tight']:4.1f}% / "
              f"{result['very_tight']:4.1f}%")

    # Find best solution
    best_std_dev, best_result = min(results, key=lambda x: x[1]['error'])

    print()
    print("=" * 80)
    print("OPTIMAL SOLUTION")
    print("=" * 80)
    print()
    print(f"Best std_dev: {best_std_dev:.1f}")
    print(f"Total Error: {best_result['error']:.1f}%")
    print(f"Average Distance: {best_result['avg_distance']:.2f} ft")
    print()
    print("Distribution:")
    print(f"  Wide Open (6+ ft):  {best_result['wide_open']:5.1f}%  (target: ~30%)")
    print(f"  Open (4-6 ft):      {best_result['open']:5.1f}%  (target: ~35%)")
    print(f"  Tight (2-4 ft):     {best_result['tight']:5.1f}%  (target: ~25%)")
    print(f"  Very Tight (<2 ft): {best_result['very_tight']:5.1f}%  (target: ~10%)")
    print()
    print("=" * 80)
    print("IMPLEMENTATION RECOMMENDATION")
    print("=" * 80)
    print()
    print("Add the following to calculate_contest_distance() in src/systems/defense.py:")
    print()
    print("    # Add Gaussian variance for realistic closeout variability")
    print(f"    variance = random.gauss(0, {best_std_dev})")
    print("    base_distance += variance")
    print()
    print("This should be added AFTER all existing modifiers (help defense, zone, etc.)")
    print("and BEFORE the final clamping to [0.5, 10.0] range.")
    print()


if __name__ == "__main__":
    random.seed(42)
    test_variance_sweep()
