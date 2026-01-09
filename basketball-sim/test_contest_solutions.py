"""
Contest Distance Solution Testing

Tests multiple approaches to achieve target distribution:
- Wide Open (6+ ft): ~30%
- Open (4-6 ft): ~35%
- Tight (2-4 ft): ~25%
- Very Tight (<2 ft): ~10%
"""

import random
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from src.core.probability import calculate_composite, sigmoid
from src.constants import WEIGHTS_CONTEST


def evaluate_distribution(distances, name):
    """Calculate and print distribution statistics."""
    wide_open = sum(1 for d in distances if d >= 6.0) / len(distances) * 100
    open_4_6 = sum(1 for d in distances if 4.0 <= d < 6.0) / len(distances) * 100
    tight_2_4 = sum(1 for d in distances if 2.0 <= d < 4.0) / len(distances) * 100
    very_tight = sum(1 for d in distances if d < 2.0) / len(distances) * 100
    avg = sum(distances) / len(distances)

    print(f"\n{name}:")
    print(f"  Average Distance: {avg:.2f} ft")
    print(f"  Wide Open (6+ ft):  {wide_open:5.1f}%  (target: ~30%)")
    print(f"  Open (4-6 ft):      {open_4_6:5.1f}%  (target: ~35%)")
    print(f"  Tight (2-4 ft):     {tight_2_4:5.1f}%  (target: ~25%)")
    print(f"  Very Tight (<2 ft): {very_tight:5.1f}%  (target: ~10%)")

    # Calculate error from target
    error = (abs(wide_open - 30) + abs(open_4_6 - 35) +
             abs(tight_2_4 - 25) + abs(very_tight - 10))
    print(f"  Total Error: {error:.1f}% (lower is better)")

    return {
        'wide_open': wide_open,
        'open': open_4_6,
        'tight': tight_2_4,
        'very_tight': very_tight,
        'avg_distance': avg,
        'error': error
    }


def solution_a_gaussian_variance(defender, help_chance=0.20, zone_pct=30):
    """Option A: Add Gaussian noise to existing formula."""
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

    # ADD GAUSSIAN VARIANCE (NEW)
    # Standard deviation of 1.5 ft creates realistic spread
    variance = random.gauss(0, 1.5)
    distance += variance

    # Clamp to realistic range
    distance = max(0.5, min(10.0, distance))

    return distance


def solution_b_sigmoid_formula(defender, help_chance=0.20, zone_pct=30):
    """Option B: Replace linear formula with sigmoid-based."""
    composite = calculate_composite(defender, WEIGHTS_CONTEST)

    # NEW FORMULA: Sigmoid-based, centered at 6.0 ft
    # Maps composite 30-70 to distance 2-10 ft with smooth curve
    # sigmoid(x) expects scaled input, so we use k=0.03 manually
    scaled_input = 0.03 * (50 - composite)
    distance = 6.0 + 4.0 * sigmoid(scaled_input)

    # Keep existing modifiers
    accel_mod = (defender['acceleration'] - 50) * -0.02
    distance += accel_mod

    if random.random() < help_chance:
        distance += 3.0

    zone_mod = zone_pct / 100.0 * 1.0
    distance += zone_mod

    patience = 50
    patience_mod = (patience - 50) * 0.02
    distance += patience_mod

    distance = max(0.5, min(10.0, distance))

    return distance


def solution_c_stronger_modifiers(defender, help_chance=0.40, zone_pct=30):
    """Option C: Keep linear formula, strengthen modifiers."""
    composite = calculate_composite(defender, WEIGHTS_CONTEST)

    # Keep existing base formula
    distance = 10.0 - (composite / 10.0)

    accel_mod = (defender['acceleration'] - 50) * -0.02
    distance += accel_mod

    # INCREASED: Help defense 40% instead of 20%
    if random.random() < help_chance:
        distance += 3.0

    # INCREASED: Zone modifier up to +3 ft (was +1 ft)
    zone_mod = zone_pct / 100.0 * 3.0
    distance += zone_mod

    # INCREASED: Patience modifier +/- 2.0 ft (was +/- 0.8 ft)
    patience = random.randint(30, 70)
    patience_mod = (patience - 50) * 0.05  # 0.05 * 40 = 2.0
    distance += patience_mod

    distance = max(0.5, min(10.0, distance))

    return distance


def solution_d_combination(defender, help_chance=0.20, zone_pct=30):
    """Option D: Widen formula + moderate variance."""
    composite = calculate_composite(defender, WEIGHTS_CONTEST)

    # WIDENED FORMULA: Centers at 6.0 ft instead of 5.0 ft
    # distance = 6.0 + (60 - composite) * 0.08
    # Composite 30: 6.0 + 2.4 = 8.4 ft
    # Composite 60: 6.0 + 0.0 = 6.0 ft
    # Composite 90: 6.0 - 2.4 = 3.6 ft
    distance = 6.0 + (60 - composite) * 0.08

    accel_mod = (defender['acceleration'] - 50) * -0.02
    distance += accel_mod

    if random.random() < help_chance:
        distance += 3.0

    zone_mod = zone_pct / 100.0 * 1.0
    distance += zone_mod

    patience = random.randint(30, 70)
    patience_mod = (patience - 50) * 0.02
    distance += patience_mod

    # MODERATE VARIANCE: std=1.0 (less than Option A)
    variance = random.gauss(0, 1.0)
    distance += variance

    distance = max(0.5, min(10.0, distance))

    return distance


def solution_e_hybrid(defender, help_chance=0.25, zone_pct=30):
    """Option E (HYBRID): Combination of best elements."""
    composite = calculate_composite(defender, WEIGHTS_CONTEST)

    # Slightly widened formula (center at 5.5 ft)
    distance = 5.5 + (55 - composite) * 0.08

    accel_mod = (defender['acceleration'] - 50) * -0.02
    distance += accel_mod

    # Moderate help defense increase (25% instead of 20%)
    if random.random() < help_chance:
        distance += 3.0

    # Moderate zone increase (up to +2 ft instead of +1 ft)
    zone_mod = zone_pct / 100.0 * 2.0
    distance += zone_mod

    # Variable patience based on random shooters
    patience = random.randint(30, 70)
    patience_mod = (patience - 50) * 0.03  # +/- 1.2 ft
    distance += patience_mod

    # Small variance to add realism
    variance = random.gauss(0, 0.8)
    distance += variance

    distance = max(0.5, min(10.0, distance))

    return distance


def test_all_solutions(n=10000):
    """Test all proposed solutions."""

    print("=" * 80)
    print("CONTEST DISTANCE SOLUTION TESTING")
    print("=" * 80)

    solutions = [
        ("Option A: Gaussian Variance (std=1.5)", solution_a_gaussian_variance),
        ("Option B: Sigmoid Formula", solution_b_sigmoid_formula),
        ("Option C: Stronger Modifiers", solution_c_stronger_modifiers),
        ("Option D: Widened Formula + Variance", solution_d_combination),
        ("Option E: HYBRID (Recommended)", solution_e_hybrid),
    ]

    results = {}

    for name, solution_func in solutions:
        distances = []

        for _ in range(n):
            # Create realistic defender
            defender = {
                'height': random.randint(45, 75),
                'reactions': random.randint(45, 75),
                'agility': random.randint(45, 75),
                'balance': random.randint(45, 75),
                'determination': random.randint(45, 75),
                'acceleration': random.randint(45, 75),
            }

            distance = solution_func(defender)
            distances.append(distance)

        results[name] = evaluate_distribution(distances, name)

    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY - RANKED BY TOTAL ERROR")
    print("=" * 80)

    ranked = sorted(results.items(), key=lambda x: x[1]['error'])

    for i, (name, stats) in enumerate(ranked, 1):
        print(f"\n{i}. {name}")
        print(f"   Error: {stats['error']:.1f}%")
        print(f"   Avg Distance: {stats['avg_distance']:.2f} ft")
        print(f"   Distribution: {stats['wide_open']:.0f}% / {stats['open']:.0f}% / {stats['tight']:.0f}% / {stats['very_tight']:.0f}%")

    print("\n" + "=" * 80)
    print("RECOMMENDATION")
    print("=" * 80)
    best_name, best_stats = ranked[0]
    print(f"\n{best_name}")
    print(f"\nThis solution achieves the closest match to NBA-realistic distribution")
    print(f"with a total error of only {best_stats['error']:.1f}%.")
    print()


if __name__ == "__main__":
    random.seed(42)
    test_all_solutions(10000)
