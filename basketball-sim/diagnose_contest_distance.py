"""
Contest Distance Distribution Diagnostic

Analyzes why defenders close out too effectively (96% contested shots).
Target: 30% wide open, 35% open, 25% tight, 10% very tight
"""

import random
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from src.core.probability import calculate_composite
from src.constants import WEIGHTS_CONTEST


def simulate_contest_distribution(num_simulations=10000):
    """Simulate contest distance with current formula."""

    print("=" * 80)
    print("CONTEST DISTANCE DIAGNOSTIC")
    print("=" * 80)
    print()

    # Simulate realistic NBA defender attributes
    # Most NBA players: 45-75 range, with position variance
    distances = []
    distances_by_scenario = {
        'base': [],
        'with_accel': [],
        'with_help': [],
        'with_zone': [],
        'full_game': []
    }

    for i in range(num_simulations):
        # Create realistic defender
        defender = {
            'height': random.randint(45, 75),
            'reactions': random.randint(45, 75),
            'agility': random.randint(45, 75),
            'balance': random.randint(45, 75),
            'determination': random.randint(45, 75),
            'acceleration': random.randint(45, 75),
        }

        # Calculate composite
        composite = calculate_composite(defender, WEIGHTS_CONTEST)

        # 1. Base formula only
        dist_base = 10.0 - (composite / 10.0)
        distances_by_scenario['base'].append(dist_base)

        # 2. With acceleration modifier
        accel_mod = (defender['acceleration'] - 50) * -0.02
        dist_accel = dist_base + accel_mod
        distances_by_scenario['with_accel'].append(dist_accel)

        # 3. With help defense (20% of shots)
        dist_help = dist_accel + (3.0 if random.random() < 0.20 else 0.0)
        distances_by_scenario['with_help'].append(dist_help)

        # 4. With zone defense (30% average)
        zone_pct = 30
        zone_mod = zone_pct / 100.0 * 1.0
        dist_zone = dist_accel + zone_mod
        distances_by_scenario['with_zone'].append(dist_zone)

        # 5. Full game simulation (help + zone + patience)
        # Help defense: 20% chance
        # Zone: 30% average
        # Patience: average shooter (50) = no modifier
        dist_full = dist_accel
        if random.random() < 0.20:
            dist_full += 3.0
        dist_full += zone_mod
        distances_by_scenario['full_game'].append(dist_full)

        # Add patience modifier for random shooters
        patience = random.randint(30, 70)
        patience_mod = (patience - 50) * 0.02  # PATIENCE_DISTANCE_MODIFIER_SCALE
        dist_full += patience_mod

        # Clamp to [0.5, 10.0]
        dist_full = max(0.5, min(10.0, dist_full))
        distances.append(dist_full)

    # Analyze each scenario
    print("SCENARIO ANALYSIS:")
    print("-" * 80)

    scenarios = [
        ('Base Formula Only', distances_by_scenario['base']),
        ('Base + Acceleration', distances_by_scenario['with_accel']),
        ('Base + Accel + Help (20%)', distances_by_scenario['with_help']),
        ('Base + Accel + Zone (30%)', distances_by_scenario['with_zone']),
        ('Full Game Sim (Help + Zone + Patience)', distances),
    ]

    for scenario_name, dist_list in scenarios:
        print(f"\n{scenario_name}:")
        print(f"  {'Metric':<25} {'Value':>10}")
        print(f"  {'-'*25} {'-'*10}")

        # Calculate statistics
        avg = sum(dist_list) / len(dist_list)
        min_d = min(dist_list)
        max_d = max(dist_list)

        # Distribution
        wide_open = sum(1 for d in dist_list if d >= 6.0) / len(dist_list) * 100
        open_4_6 = sum(1 for d in dist_list if 4.0 <= d < 6.0) / len(dist_list) * 100
        tight_2_4 = sum(1 for d in dist_list if 2.0 <= d < 4.0) / len(dist_list) * 100
        very_tight = sum(1 for d in dist_list if d < 2.0) / len(dist_list) * 100

        print(f"  {'Average Distance':<25} {avg:>9.2f}ft")
        print(f"  {'Min / Max':<25} {min_d:>4.2f} / {max_d:>4.2f}")
        print(f"  {'Wide Open (6+ ft)':<25} {wide_open:>9.1f}%")
        print(f"  {'Open (4-6 ft)':<25} {open_4_6:>9.1f}%")
        print(f"  {'Tight (2-4 ft)':<25} {tight_2_4:>9.1f}%")
        print(f"  {'Very Tight (<2 ft)':<25} {very_tight:>9.1f}%")

    print()
    print("=" * 80)
    print("TARGET DISTRIBUTION (NBA-REALISTIC):")
    print("=" * 80)
    print(f"  Wide Open (6+ ft):  ~30%")
    print(f"  Open (4-6 ft):      ~35%")
    print(f"  Tight (2-4 ft):     ~25%")
    print(f"  Very Tight (<2 ft): ~10%")
    print()

    print("=" * 80)
    print("DIAGNOSIS:")
    print("=" * 80)
    print()
    print("PROBLEM IDENTIFIED:")
    print("  The formula 'distance = 10 - (composite / 10)' is too deterministic.")
    print()
    print("  With typical NBA defenders (composite 50-60):")
    print("    - Composite 50 -> 5.0 ft (contested)")
    print("    - Composite 60 -> 4.0 ft (tight)")
    print("    - Composite 70 -> 3.0 ft (tight)")
    print()
    print("  This creates a narrow band (2.3 - 5.2 ft) with NO wide open shots.")
    print()
    print("ROOT CAUSES:")
    print("  1. No randomness/variance in closeout success")
    print("  2. Formula maps linearly (1 composite point = 0.1 ft)")
    print("  3. No shooter skill impact on creating separation")
    print("  4. Help defense only adds +3ft to 20% of shots")
    print("  5. Zone only adds +0.3ft on average (too small)")
    print()
    print("PROPOSED SOLUTIONS:")
    print()
    print("Option A: Add Stochastic Variance (RECOMMENDED)")
    print("  - Add Gaussian noise: N(0, std=1.5) to contest distance")
    print("  - Keeps attribute-driven base, adds realistic variance")
    print("  - Elite defenders still close out better on average")
    print("  - But shooters can sometimes get space even vs good defenders")
    print()
    print("Option B: Modify Base Formula")
    print("  - Change from linear to sigmoid-based distance")
    print("  - Example: distance = 6.0 + 4.0 * sigmoid(50 - composite, k=0.03)")
    print("  - Centers around 6.0 ft (wide open), ranges 2-10 ft")
    print()
    print("Option C: Increase Modifier Impact")
    print("  - Zone modifier: 0-100% zone -> +0 to +3 ft (currently +0 to +1)")
    print("  - Help defense: 40% chance instead of 20%")
    print("  - Patience: increase scale from +/- 0.8ft to +/- 2.0ft")
    print()
    print("Option D: Combination Approach")
    print("  - Widen base formula: distance = 6.0 + (60 - composite) * 0.08")
    print("  - Add moderate variance: N(0, std=1.0)")
    print("  - Keep current modifiers")
    print()


if __name__ == "__main__":
    random.seed(42)
    simulate_contest_distribution(10000)
