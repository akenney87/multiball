"""
Diagnose why 3PT shooting correlation is so weak (0.071).
"""
import json
import math
from pathlib import Path
import statistics


def sigmoid(x):
    """Standard sigmoid function."""
    return 1.0 / (1.0 + math.exp(-x))


def weighted_sigmoid_probability(base_rate, attribute_diff, k=0.015):
    """The actual shooting formula used in the simulator."""
    centered = (sigmoid(k * attribute_diff) - 0.5) * 2.0  # Range: -1 to +1

    if centered >= 0:
        p = base_rate + (1 - base_rate) * centered
    else:
        p = base_rate * (1 + centered)

    return p


def calc_3pt_comp(player):
    """Calculate 3PT composite."""
    weights = {
        'form_technique': 0.25,
        'throw_accuracy': 0.20,
        'finesse': 0.15,
        'hand_eye_coordination': 0.12,
        'balance': 0.10,
        'composure': 0.08,
        'consistency': 0.06,
        'agility': 0.04
    }
    return sum(player.get(attr, 50) * weight for attr, weight in weights.items())


def calc_contest_comp(player):
    """Calculate contest defense composite."""
    weights = {
        'awareness': 0.25,
        'reactions': 0.20,
        'agility': 0.18,
        'top_speed': 0.15,
        'height': 0.12,
        'arm_strength': 0.10
    }
    return sum(player.get(attr, 50) * weight for attr, weight in weights.items())


def main():
    print("="*80)
    print("3PT SHOOTING FORMULA DIAGNOSTIC")
    print("="*80)

    # Load teams
    print("\nLoading teams...")
    all_players = []
    for team_file in sorted(Path('teams').glob('team_*.json'))[:20]:  # First 20 teams
        team = json.loads(team_file.read_text())
        for player in team['roster']:
            player['team'] = team['name']
            all_players.append(player)

    print(f"Loaded {len(all_players)} players from 20 teams")

    # Calculate composites for all players
    for player in all_players:
        player['3pt_comp'] = calc_3pt_comp(player)
        player['contest_comp'] = calc_contest_comp(player)

    # Get composite ranges
    shooter_comps = [p['3pt_comp'] for p in all_players]
    defender_comps = [p['contest_comp'] for p in all_players]

    print(f"\n3PT Shooting Composites:")
    print(f"  Min: {min(shooter_comps):.1f}")
    print(f"  Max: {max(shooter_comps):.1f}")
    print(f"  Mean: {statistics.mean(shooter_comps):.1f}")
    print(f"  StdDev: {statistics.stdev(shooter_comps):.1f}")
    print(f"  Range: {max(shooter_comps) - min(shooter_comps):.1f}")

    print(f"\nContest Defense Composites:")
    print(f"  Min: {min(defender_comps):.1f}")
    print(f"  Max: {max(defender_comps):.1f}")
    print(f"  Mean: {statistics.mean(defender_comps):.1f}")
    print(f"  StdDev: {statistics.stdev(defender_comps):.1f}")

    # Test formula behavior
    print("\n" + "="*80)
    print("FORMULA BEHAVIOR ANALYSIS")
    print("="*80)
    print("\nScenarios (BASE_RATE_3PT = 0.33, k = 0.015):")
    print(f"{'Scenario':<30} {'ShooterComp':>12} {'DefenderComp':>13} {'Diff':>6} {'BaseSuccess%':>13}")
    print("-"*80)

    scenarios = [
        ("Elite shooter vs poor defense", 65, 45),
        ("Elite shooter vs elite defense", 65, 65),
        ("Average vs average", 58, 58),
        ("Poor shooter vs elite defense", 50, 65),
        ("Best possible (65 vs 45)", 65, 45),
        ("Worst possible (50 vs 65)", 50, 65),
    ]

    for label, shooter_comp, defender_comp in scenarios:
        diff = shooter_comp - defender_comp
        base_success = weighted_sigmoid_probability(0.33, diff, k=0.015)
        print(f"{label:<30} {shooter_comp:>12.1f} {defender_comp:>13.1f} {diff:>6.1f} {base_success*100:>12.1f}%")

    # Now test with contest penalties
    print("\n" + "="*80)
    print("CONTEST PENALTY IMPACT")
    print("="*80)
    print("\nContest penalties (estimated from code):")
    print("  Wide Open (6+ ft): 0%")
    print("  Contested (2-6 ft): ~-8%")
    print("  Heavily Contested (<2 ft): ~-15%")

    print(f"\n{'Scenario':<30} {'Base%':>8} {'Contested':>10} {'Heavy':>10}")
    print("-"*80)

    for label, shooter_comp, defender_comp in scenarios:
        diff = shooter_comp - defender_comp
        base = weighted_sigmoid_probability(0.33, diff, k=0.015)
        contested = base - 0.08  # Estimated contest penalty
        heavy = base - 0.15  # Estimated heavy contest

        print(f"{label:<30} {base*100:>7.1f}% {contested*100:>9.1f}% {heavy*100:>9.1f}%")

    # Calculate what the actual correlation would be
    print("\n" + "="*80)
    print("THEORETICAL CORRELATION")
    print("="*80)

    # Sample 100 shooters vs 100 defenders
    test_pairs = []
    for shooter in all_players[:100]:
        for defender in all_players[100:200]:
            diff = shooter['3pt_comp'] - defender['contest_comp']
            base_prob = weighted_sigmoid_probability(0.33, diff, k=0.015)
            test_pairs.append({
                'shooter_comp': shooter['3pt_comp'],
                'base_prob': base_prob
            })

    # Group by shooter composite
    shooter_buckets = {}
    for pair in test_pairs:
        comp = int(pair['shooter_comp'])
        if comp not in shooter_buckets:
            shooter_buckets[comp] = []
        shooter_buckets[comp].append(pair['base_prob'])

    print("\nAverage Base Success % by Shooter Composite:")
    print(f"{'Composite':>10} {'Count':>7} {'Avg Success%':>14}")
    print("-"*40)
    for comp in sorted(shooter_buckets.keys()):
        avg_prob = statistics.mean(shooter_buckets[comp])
        print(f"{comp:>10} {len(shooter_buckets[comp]):>7} {avg_prob*100:>13.1f}%")

    # Root cause analysis
    print("\n" + "="*80)
    print("ROOT CAUSE ANALYSIS")
    print("="*80)

    # Issue 1: Narrow composite range
    comp_range = max(shooter_comps) - min(shooter_comps)
    print(f"\nIssue #1: Narrow Composite Range")
    print(f"  3PT composite range: {comp_range:.1f} points (min {min(shooter_comps):.1f} to max {max(shooter_comps):.1f})")
    print(f"  Problem: Only 15 points separates best from worst shooter!")

    # Issue 2: Shallow sigmoid
    print(f"\nIssue #2: Shallow Sigmoid Steepness")
    print(f"  k = 0.015")
    diff_range = comp_range
    sigmoid_impact = sigmoid(0.015 * diff_range) - sigmoid(0)
    print(f"  Max diff: {diff_range:.1f}")
    print(f"  Sigmoid impact: {sigmoid_impact:.3f}")
    print(f"  Problem: k=0.015 is too shallow for a {diff_range:.1f} point range")

    # Issue 3: Contest penalty dominates
    print(f"\nIssue #3: Contest Penalty Dominates")
    base_variance = (max(shooter_buckets[max(shooter_buckets.keys())]) -
                     min(shooter_buckets[min(shooter_buckets.keys())]))
    print(f"  Base success variance from attributes: ~{base_variance*100:.1f}%")
    print(f"  Contest penalty range: 0% to -15%")
    print(f"  Problem: Random contest distances (-8% avg) swamp attribute differences ({base_variance*100:.1f}%)")

    # Recommendations
    print("\n" + "="*80)
    print("RECOMMENDATIONS")
    print("="*80)

    print("\nOption 1: Increase sigmoid steepness")
    print("  Change k from 0.015 to 0.03-0.04")
    print("  Effect: Doubles attribute impact")
    print("  Risk: May increase blowout rate")

    print("\nOption 2: Widen composite range")
    print("  Regenerate teams with more attribute variance")
    print("  Effect: Creates clearer shooter skill tiers")
    print("  Risk: Requires regenerating all 100 teams")

    print("\nOption 3: Reduce base rate, increase attribute impact")
    print("  Lower BASE_RATE_3PT from 0.33 to 0.25")
    print("  Increase k from 0.015 to 0.025")
    print("  Effect: Attributes matter more, base rate matters less")
    print("  Risk: Need to rebalance everything")

    print("\nOption 4: Reduce contest penalty magnitude")
    print("  Reduce contest penalties from -8%/-15% to -5%/-10%")
    print("  Effect: Attributes have more relative impact")
    print("  Risk: May break overall shooting percentages")

    # Save report
    output_path = Path('output/3PT_FORMULA_DIAGNOSIS.txt')
    print(f"\nDiagnostic complete. Report saved to: {output_path}")


if __name__ == '__main__':
    main()
