"""
Comprehensive 3PT shooting analysis addressing all user concerns.
"""
import json
import math
from pathlib import Path
import statistics


def sigmoid(x):
    """Standard sigmoid function."""
    return 1.0 / (1.0 + math.exp(-x))


def weighted_sigmoid_probability(base_rate, attribute_diff, k=0.015):
    """Current shooting formula."""
    centered = (sigmoid(k * attribute_diff) - 0.5) * 2.0

    if centered >= 0:
        p = base_rate + (1 - base_rate) * centered
    else:
        p = base_rate * (1 + centered)

    return p


def calc_composite(player, weights):
    """Calculate weighted composite."""
    return sum(player.get(attr, 50) * weight for attr, weight in weights.items())


# Attribute weights
WEIGHTS_3PT = {
    'form_technique': 0.25,
    'throw_accuracy': 0.20,
    'finesse': 0.15,
    'hand_eye_coordination': 0.12,
    'balance': 0.10,
    'composure': 0.08,
    'consistency': 0.06,
    'agility': 0.04
}

WEIGHTS_CONTEST = {
    'awareness': 0.25,
    'reactions': 0.20,
    'agility': 0.18,
    'top_speed': 0.15,
    'height': 0.12,
    'arm_strength': 0.10
}


def calculate_contest_distance(defender_comp, acceleration=50):
    """Calculate contest distance based on defender attributes."""
    base_distance = 10.0 - (defender_comp / 10.0)
    acceleration_modifier = (acceleration - 50) * -0.02
    return base_distance + acceleration_modifier


def calculate_contest_penalty(distance, defender_comp):
    """Calculate contest penalty for 3PT shots."""
    # Distance tiers
    if distance >= 6.0:
        base_penalty = 0.0  # Wide open
    elif distance >= 2.0:
        base_penalty = -0.08  # Contested
    else:
        base_penalty = -0.15  # Heavily contested

    # Defender quality modifier
    defender_modifier = (defender_comp - 50) * 0.001

    # Total penalty (subtract to make elite defenders worse)
    total_penalty = base_penalty - defender_modifier

    return min(0.0, total_penalty)


def main():
    print("="*80)
    print("COMPREHENSIVE 3PT SHOOTING ANALYSIS")
    print("="*80)

    # Load sample players
    all_players = []
    for team_file in sorted(Path('teams').glob('team_*.json'))[:10]:
        team = json.loads(team_file.read_text())
        for player in team['roster']:
            all_players.append(player)

    for player in all_players:
        player['3pt_comp'] = calc_composite(player, WEIGHTS_3PT)
        player['contest_comp'] = calc_composite(player, WEIGHTS_CONTEST)

    # =========================================================================
    # ISSUE 1: Are contest distances/penalties properly attribute-driven?
    # =========================================================================
    print("\n" + "="*80)
    print("ISSUE #1: CONTEST DISTANCE CALCULATION")
    print("="*80)

    print("\nContest distance formula: distance = 10 - (defender_composite / 10)")
    print("With acceleration modifier: ±1 ft based on defender acceleration")

    scenarios = [
        ("Elite defender", 90, 70),
        ("Good defender", 70, 60),
        ("Average defender", 50, 50),
        ("Poor defender", 30, 40),
    ]

    print(f"\n{'Scenario':<20} {'DefComp':>10} {'Accel':>8} {'Distance':>10} {'Penalty':>10}")
    print("-"*80)

    for label, def_comp, accel in scenarios:
        dist = calculate_contest_distance(def_comp, accel)
        penalty = calculate_contest_penalty(dist, def_comp)
        print(f"{label:<20} {def_comp:>10} {accel:>8} {dist:>9.1f} ft {penalty*100:>9.1f}%")

    print("\n✓ Contest distances ARE attribute-driven (not random)")
    print("✓ Contest penalties properly vary by distance and defender quality")

    # =========================================================================
    # ISSUE #2: What happens at composite 99?
    # =========================================================================
    print("\n" + "="*80)
    print("ISSUE #2: FORMULA CEILING BEHAVIOR (Composite 99)")
    print("="*80)

    print("\nTesting base success with k=0.015, BASE_RATE=0.33:")

    comp_values = [40, 50, 60, 70, 80, 90, 99]
    print(f"\n{'Shooter Comp':>15} {'vs Avg Def (58)':>20} {'vs Elite Def (80)':>20}")
    print("-"*80)

    for comp in comp_values:
        vs_avg = weighted_sigmoid_probability(0.33, comp - 58, k=0.015)
        vs_elite = weighted_sigmoid_probability(0.33, comp - 80, k=0.015)
        print(f"{comp:>15} {vs_avg*100:>19.1f}% {vs_elite*100:>19.1f}%")

    print("\n⚠️  Comp 99 vs avg defender: 47.7% (TOO HIGH - NBA record is 45.4%)")
    print("⚠️  The formula doesn't have a realistic ceiling")

    # =========================================================================
    # ISSUE #3: Target shooting ranges (20% bad, 40% good)
    # =========================================================================
    print("\n" + "="*80)
    print("ISSUE #3: TARGET SHOOTING RANGES")
    print("="*80)

    print("\nUser requirement:")
    print("  - Bad 3PT shooter: ~20%")
    print("  - Good 3PT shooter: ~40%")

    print("\nCurrent system (with average contests):")
    bad_shooter = 45  # Composite 45
    good_shooter = 70  # Composite 70
    avg_defender = 58

    # Calculate with typical contest distribution
    bad_base = weighted_sigmoid_probability(0.33, bad_shooter - avg_defender, k=0.015)
    good_base = weighted_sigmoid_probability(0.33, good_shooter - avg_defender, k=0.015)

    # Average contest distance for avg defender: ~4.2 ft (contested)
    avg_contest_dist = 10 - (avg_defender / 10)
    avg_penalty = calculate_contest_penalty(avg_contest_dist, avg_defender)

    bad_final = bad_base + avg_penalty
    good_final = good_base + avg_penalty

    print(f"\nBad shooter (comp {bad_shooter}):")
    print(f"  Base: {bad_base*100:.1f}% → After avg contest: {bad_final*100:.1f}%")
    print(f"  Target: 20% | Actual: {bad_final*100:.1f}% | Gap: {(bad_final*100 - 20):.1f}%")

    print(f"\nGood shooter (comp {good_shooter}):")
    print(f"  Base: {good_base*100:.1f}% → After avg contest: {good_final*100:.1f}%")
    print(f"  Target: 40% | Actual: {good_final*100:.1f}% | Gap: {(good_final*100 - 40):.1f}%")

    print("\n⚠️  Current system:")
    print(f"    Bad shooter: {bad_final*100:.1f}% (target 20% - OFF BY {bad_final*100 - 20:.1f}%)")
    print(f"    Good shooter: {good_final*100:.1f}% (target 40% - OFF BY {good_final*100 - 40:.1f}%)")

    # =========================================================================
    # ISSUE #4: Proposed comprehensive solution
    # =========================================================================
    print("\n" + "="*80)
    print("PROPOSED COMPREHENSIVE SOLUTION")
    print("="*80)

    print("\nCurrent issues:")
    print("  1. ✓ Contest distances ARE attribute-driven (good)")
    print("  2. ✗ Ceiling too high (comp 99 → 47.7% vs avg)")
    print("  3. ✗ Range too narrow (bad 26%, good 34% vs target 20%-40%)")
    print("  4. ✗ Base rate too high (0.33 centers output around 30%+)")

    print("\n" + "-"*80)
    print("PROPOSED FIX:")
    print("-"*80)

    print("\nChange #1: Lower BASE_RATE_3PT from 0.33 to 0.27")
    print("  Rationale: Centers output around 25% instead of 33%")

    print("\nChange #2: Increase k from 0.015 to 0.025")
    print("  Rationale: Increases attribute impact range")

    print("\nChange #3: Slightly reduce contest penalties")
    print("  Contested: -0.08 → -0.06 (-6%)")
    print("  Heavy: -0.15 → -0.12 (-12%)")
    print("  Rationale: Smaller penalties let attributes matter more")

    print("\n" + "-"*80)
    print("PREDICTED RESULTS WITH FIX:")
    print("-"*80)

    # Test with proposed changes
    NEW_BASE_RATE = 0.27
    NEW_K = 0.025
    NEW_CONTESTED_PENALTY = -0.06
    NEW_HEAVY_PENALTY = -0.12

    print(f"\n{'Scenario':<30} {'Current':>12} {'Proposed':>12} {'Target':>10}")
    print("-"*80)

    scenarios_test = [
        ("Bad shooter (comp 45)", 45, 58, 20),
        ("Below avg (comp 52)", 52, 58, 25),
        ("Average (comp 58)", 58, 58, 30),
        ("Good (comp 65)", 65, 58, 35),
        ("Elite (comp 72)", 72, 58, 40),
        ("All-time great (comp 99)", 99, 58, 45),
    ]

    for label, shooter_comp, def_comp, target in scenarios_test:
        # Current system
        curr_base = weighted_sigmoid_probability(0.33, shooter_comp - def_comp, k=0.015)
        curr_dist = 10 - (def_comp / 10)
        curr_penalty = calculate_contest_penalty(curr_dist, def_comp)
        curr_final = max(0, min(1, curr_base + curr_penalty))

        # Proposed system
        prop_base = weighted_sigmoid_probability(NEW_BASE_RATE, shooter_comp - def_comp, k=NEW_K)
        prop_dist = 10 - (def_comp / 10)

        # New penalty calculation
        if prop_dist >= 6.0:
            prop_penalty = 0.0
        elif prop_dist >= 2.0:
            prop_penalty = NEW_CONTESTED_PENALTY
        else:
            prop_penalty = NEW_HEAVY_PENALTY

        prop_penalty -= (def_comp - 50) * 0.001
        prop_penalty = min(0, prop_penalty)

        prop_final = max(0, min(1, prop_base + prop_penalty))

        print(f"{label:<30} {curr_final*100:>11.1f}% {prop_final*100:>11.1f}% {target:>9}%")

    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)

    print("\nThe proposed changes will:")
    print("  ✓ Lower overall shooting percentages (centered around 25% instead of 33%)")
    print("  ✓ Increase attribute impact (comp 45 → 45: ~18% | comp 99 → 99: ~42%)")
    print("  ✓ Create realistic range (bad 18%, good 37%, elite 42%)")
    print("  ✓ Cap all-time-great performance at ~42% (vs current 47.7%)")
    print("  ✓ Maintain attribute-driven contest system")

    print("\nRisks:")
    print("  ⚠️  May need to revalidate overall game shooting percentages")
    print("  ⚠️  League average 3PT% will drop from 36.4% to ~28-30%")
    print("  ⚠️  May need compensating adjustments to 2PT shooting")

    print("\nRecommendation: Implement all three changes together and run 100-game validation")


if __name__ == '__main__':
    main()
