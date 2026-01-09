"""
Visualization script comparing k=0.015 vs k=0.030 sigmoid curves.

Shows how doubling k increases attribute impact on shooting probability.
"""
import math


def sigmoid(x):
    """Standard sigmoid function."""
    if x > 100:
        return 1.0
    if x < -100:
        return 0.0
    return 1.0 / (1.0 + math.exp(-x))


def weighted_sigmoid_probability(base_rate, attribute_diff, k):
    """Two-stage weighted sigmoid."""
    centered = (sigmoid(k * attribute_diff) - 0.5) * 2.0

    if centered >= 0:
        p = base_rate + (1 - base_rate) * centered
    else:
        p = base_rate * (1 + centered)

    return max(0.0, min(1.0, p))


def main():
    print("="*80)
    print("SIGMOID CURVE COMPARISON: k=0.015 vs k=0.030")
    print("="*80)

    base_rate = 0.33

    print(f"\nBASE_RATE_3PT = {base_rate} (33%)")
    print("\nAttribute differential sweep: -40 to +40 (shooter_comp - defender_comp)")

    # Table header
    print(f"\n{'Diff':>6} {'Shooter':>10} {'Defender':>10} | {'k=0.015':>10} {'k=0.030':>10} | {'Delta':>10}")
    print("-"*80)

    # Sweep attribute differentials
    for diff in range(-40, 41, 5):
        # Example composites
        shooter_comp = 58 + diff
        defender_comp = 58

        p_current = weighted_sigmoid_probability(base_rate, diff, k=0.015)
        p_proposed = weighted_sigmoid_probability(base_rate, diff, k=0.030)
        delta = p_proposed - p_current

        print(f"{diff:>6} {shooter_comp:>10.0f} {defender_comp:>10.0f} | "
              f"{p_current*100:>9.1f}% {p_proposed*100:>9.1f}% | "
              f"{delta*100:>9.1f}%")

    # Highlight key ranges
    print("\n" + "="*80)
    print("KEY RANGES")
    print("="*80)

    ranges = [
        ("Poor shooter vs elite defender", -30, -20),
        ("Below average matchup", -10, -5),
        ("Average matchup", -2, 2),
        ("Above average matchup", 5, 10),
        ("Elite shooter vs poor defender", 20, 30),
    ]

    for label, diff_min, diff_max in ranges:
        p_min_curr = weighted_sigmoid_probability(base_rate, diff_min, k=0.015)
        p_max_curr = weighted_sigmoid_probability(base_rate, diff_max, k=0.015)
        p_min_prop = weighted_sigmoid_probability(base_rate, diff_min, k=0.030)
        p_max_prop = weighted_sigmoid_probability(base_rate, diff_max, k=0.030)

        spread_curr = p_max_curr - p_min_curr
        spread_prop = p_max_prop - p_min_prop

        print(f"\n{label}:")
        print(f"  Diff range: {diff_min} to {diff_max}")
        print(f"  k=0.015: {p_min_curr*100:.1f}% to {p_max_curr*100:.1f}% (spread: {spread_curr*100:.1f}%)")
        print(f"  k=0.030: {p_min_prop*100:.1f}% to {p_max_prop*100:.1f}% (spread: {spread_prop*100:.1f}%)")
        print(f"  Spread increase: {spread_curr*100:.1f}% -> {spread_prop*100:.1f}% (x{spread_prop/spread_curr:.2f})")

    # ASCII visualization
    print("\n" + "="*80)
    print("ASCII VISUALIZATION")
    print("="*80)
    print("\nProbability vs Attribute Differential")
    print("(Each row is 5% probability band)")
    print("\nLegend: '.' = k=0.015, '#' = k=0.030, '*' = both")
    print()

    # Create ASCII plot
    for prob_pct in range(95, 4, -5):  # 95% down to 5%
        prob = prob_pct / 100.0
        line = f"{prob_pct:>3}% |"

        # Check each diff value
        for diff in range(-40, 41, 2):
            p_curr = weighted_sigmoid_probability(base_rate, diff, k=0.015)
            p_prop = weighted_sigmoid_probability(base_rate, diff, k=0.030)

            # Check if current or proposed falls in this band
            in_curr = (prob - 0.025 <= p_curr < prob + 0.025)
            in_prop = (prob - 0.025 <= p_prop < prob + 0.025)

            if in_curr and in_prop:
                line += "*"
            elif in_curr:
                line += "."
            elif in_prop:
                line += "#"
            else:
                line += " "

        print(line)

    # X-axis
    print("     +" + "-"*41)
    print("      -40    -20      0      20     40  (Attribute Diff)")

    print("\n" + "="*80)
    print("INTERPRETATION")
    print("="*80)

    print("\nKey observations:")
    print("  1. At diff=0, both curves intersect at BASE_RATE (33%)")
    print("  2. k=0.030 curve is STEEPER (more vertical)")
    print("  3. Steeper curve = attributes matter MORE")
    print("  4. k=0.030 reaches higher ceilings and lower floors faster")
    print("  5. This creates better differentiation between skill levels")

    print("\nMathematical property:")
    print(f"  Slope at origin (diff=0):")
    print(f"    k=0.015: {(1-base_rate)*0.015/2:.6f} per point = {(1-base_rate)*0.015/2*100:.2f}% per point")
    print(f"    k=0.030: {(1-base_rate)*0.030/2:.6f} per point = {(1-base_rate)*0.030/2*100:.2f}% per point")
    print(f"    Ratio: 2.00x (exactly double)")

    print("\nConclusion:")
    print("  Doubling k from 0.015 to 0.030 doubles the impact of attributes")
    print("  on shooting probability, making the system more attribute-driven.")


if __name__ == '__main__':
    main()
