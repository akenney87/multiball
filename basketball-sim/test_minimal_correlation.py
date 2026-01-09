"""
Minimal 3PT Formula Test - Isolate Shooter vs Defender Signal

This script tests the hypothesis that defensive variance is washing out shooter skill.

Tests pure sigmoid formula with NO:
- Contest distance variance
- Contest penalties
- Defender modifiers
- Help defense
- Any other noise sources

Just: P(make) = BASE_RATE + weighted_sigmoid(shooter_comp - defender_comp)
"""

import random
import json
from pathlib import Path
from typing import Dict, Any
from statistics import mean
import math

# Import core utilities
import sys
sys.path.insert(0, '.')

from src.core.probability import weighted_sigmoid_probability
from src.utils.probability import calculate_composite
from src.constants import WEIGHTS_3PT, WEIGHTS_CONTEST, BASE_RATE_3PT, SIGMOID_K


def load_teams():
    """Load all teams from JSON files."""
    teams_dir = Path('teams')
    teams = []

    for team_file in sorted(teams_dir.glob('team_*.json')):
        with open(team_file, 'r') as f:
            team_data = json.load(f)
            teams.append(team_data)

    return teams


def attempt_3pt_minimal(shooter: Dict[str, Any], defender: Dict[str, Any]) -> Dict[str, Any]:
    """
    Minimal 3PT attempt with ONLY shooter vs defender composite.

    NO variance, NO contest penalties, NO modifiers.
    Pure attribute-driven probability.
    """
    # Calculate composites
    shooter_comp = calculate_composite(shooter, WEIGHTS_3PT)
    defender_comp = calculate_composite(defender, WEIGHTS_CONTEST)

    # Calculate attribute differential (capped at ±40)
    diff = shooter_comp - defender_comp
    diff = max(-40, min(40, diff))

    # Pure weighted sigmoid - no external factors
    success_rate = weighted_sigmoid_probability(BASE_RATE_3PT, diff, SIGMOID_K)

    # Roll the dice
    made = random.random() < success_rate

    return {
        'shooter_comp': shooter_comp,
        'defender_comp': defender_comp,
        'diff': diff,
        'success_rate': success_rate,
        'made': 1 if made else 0
    }


def run_minimal_test(num_shots: int = 10000):
    """Run minimal correlation test with specified number of shots."""
    print("="*80)
    print("MINIMAL 3PT FORMULA TEST")
    print("="*80)
    print()
    print(f"Testing pure shooter vs defender signal with {num_shots} shots")
    print(f"Formula: P = BASE_RATE + sigmoid(k × (shooter_comp - defender_comp))")
    print(f"BASE_RATE: {BASE_RATE_3PT}")
    print(f"SIGMOID_K: {SIGMOID_K}")
    print()

    # Set seed for reproducibility
    random.seed(42)

    # Load teams
    print("Loading teams...")
    teams = load_teams()
    print(f"Loaded {len(teams)} teams")
    print()

    # Collect all players
    all_players = []
    for team in teams:
        all_players.extend(team['roster'])

    print(f"Total players: {len(all_players)}")
    print()

    # Simulate shots
    print(f"Simulating {num_shots} shots...")
    shots = []

    for i in range(num_shots):
        # Random shooter and defender
        shooter = random.choice(all_players)
        defender = random.choice(all_players)

        # Attempt shot
        result = attempt_3pt_minimal(shooter, defender)
        shots.append(result)

        if (i + 1) % 1000 == 0:
            print(f"  {i + 1}/{num_shots}...")

    print()

    # Calculate correlation
    shooter_comps = [s['shooter_comp'] for s in shots]
    outcomes = [s['made'] for s in shots]

    # Pearson correlation
    n = len(shots)
    sum_x = sum(shooter_comps)
    sum_y = sum(outcomes)
    sum_xy = sum(x * y for x, y in zip(shooter_comps, outcomes))
    sum_x2 = sum(x * x for x in shooter_comps)
    sum_y2 = sum(y * y for y in outcomes)

    numerator = n * sum_xy - sum_x * sum_y
    denominator = math.sqrt((n * sum_x2 - sum_x**2) * (n * sum_y2 - sum_y**2))

    correlation = numerator / denominator if denominator != 0 else 0

    # Overall stats
    total_makes = sum(outcomes)
    overall_pct = total_makes / n

    # Stats by composite bucket
    buckets = {
        '30-40': [],
        '40-50': [],
        '50-55': [],
        '55-60': [],
        '60-65': [],
        '65-70': [],
        '70-80': [],
        '80+': []
    }

    for shot in shots:
        comp = shot['shooter_comp']
        outcome = shot['made']

        if comp < 40:
            buckets['30-40'].append(outcome)
        elif comp < 50:
            buckets['40-50'].append(outcome)
        elif comp < 55:
            buckets['50-55'].append(outcome)
        elif comp < 60:
            buckets['55-60'].append(outcome)
        elif comp < 65:
            buckets['60-65'].append(outcome)
        elif comp < 70:
            buckets['65-70'].append(outcome)
        elif comp < 80:
            buckets['70-80'].append(outcome)
        else:
            buckets['80+'].append(outcome)

    # Print results
    print("="*80)
    print("RESULTS")
    print("="*80)
    print()
    print(f"Total shots: {n}")
    print(f"Total makes: {total_makes}")
    print(f"Overall 3PT%: {overall_pct * 100:.1f}%")
    print()
    print(f"**Pearson correlation (shooter_comp vs outcome): {correlation:.3f}**")
    print()

    print("="*80)
    print("FG% BY SHOOTER COMPOSITE")
    print("="*80)
    print()
    print(f"{'Composite Range':<18} {'Attempts':>10} {'Makes':>10} {'FG%':>10}")
    print("-"*80)

    for bucket_name in ['30-40', '40-50', '50-55', '55-60', '60-65', '65-70', '70-80', '80+']:
        outcomes_list = buckets[bucket_name]
        if len(outcomes_list) > 0:
            attempts = len(outcomes_list)
            makes = sum(outcomes_list)
            pct = makes / attempts
            print(f"{bucket_name:<18} {attempts:>10} {makes:>10} {pct*100:>9.1f}%")
        else:
            print(f"{bucket_name:<18} {0:>10} {0:>10} {'N/A':>10}")

    print()

    # Calculate spread
    valid_buckets = {k: v for k, v in buckets.items() if len(v) > 0}
    if valid_buckets:
        bucket_pcts = {k: sum(v)/len(v) for k, v in valid_buckets.items()}
        min_pct = min(bucket_pcts.values())
        max_pct = max(bucket_pcts.values())
        spread = (max_pct - min_pct) * 100

        print(f"Spread (min to max bucket): {spread:.1f} percentage points")
        print()

    # Interpretation
    print("="*80)
    print("INTERPRETATION")
    print("="*80)
    print()

    if correlation > 0.25:
        print(f"✓ STRONG correlation ({correlation:.3f})")
        print("  → Shooter skill signal is clear WITHOUT defensive noise")
        print("  → Hypothesis CONFIRMED: Defensive variance was washing out signal")
        print("  → Next step: Gradually add back defensive factors at reduced scales")
    elif correlation > 0.15:
        print(f"✓ MODERATE correlation ({correlation:.3f})")
        print("  → Shooter skill signal is visible but weak")
        print("  → Defensive variance was part of the problem")
        print("  → May also need to increase SIGMOID_K or adjust formula")
    elif correlation > 0.08:
        print(f"△ WEAK correlation ({correlation:.3f})")
        print("  → Marginal improvement over full formula")
        print("  → Defensive variance was contributing but not the only issue")
        print("  → Need to investigate sigmoid formula and measurement methodology")
    else:
        print(f"✗ VERY WEAK correlation ({correlation:.3f})")
        print("  → No improvement - hypothesis REJECTED")
        print("  → Problem is not defensive variance")
        print("  → Issue is with sigmoid formula, measurement, or sample size")

    print()

    # Save detailed results
    output_path = Path('output/MINIMAL_FORMULA_TEST.json')
    output_path.parent.mkdir(exist_ok=True)

    output_data = {
        'num_shots': n,
        'correlation': correlation,
        'overall_pct': overall_pct,
        'base_rate': BASE_RATE_3PT,
        'sigmoid_k': SIGMOID_K,
        'spread_pp': spread if valid_buckets else 0,
        'bucket_stats': {
            k: {
                'attempts': len(v),
                'makes': sum(v),
                'pct': sum(v)/len(v) if len(v) > 0 else 0
            }
            for k, v in buckets.items()
            if len(v) > 0
        }
    }

    with open(output_path, 'w') as f:
        json.dump(output_data, f, indent=2)

    print(f"Detailed results saved to: {output_path}")
    print()


if __name__ == '__main__':
    run_minimal_test(num_shots=10000)
