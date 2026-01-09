"""
Test Contest Distance Variance Impact on Shot-Level Correlation

This script tests the hypothesis that Gaussian variance (sigma=1.9) in contest
distance is destroying shot-level correlation by decoupling defender quality
from contest quality.

We'll measure:
1. Shot-level correlation for different sigma values (0.0, 0.5, 0.9, 1.2, 1.5, 1.9, 2.5)
2. Contest distribution for each sigma value
3. Optimal tradeoff point

Usage:
    python test_contest_variance_impact.py
"""

import json
import random
import statistics
import sys
from pathlib import Path
from typing import Dict, Any, List, Tuple

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.core.probability import calculate_composite, weighted_sigmoid_probability, sigmoid
from src.constants import (
    SIGMOID_K,
    BASE_RATE_3PT,
    WEIGHTS_3PT,
    WEIGHTS_CONTEST,
    CONTEST_DISTANCE_WIDE_OPEN,
    CONTEST_DISTANCE_CONTESTED,
    CONTEST_PENALTIES,
)


def calculate_contest_distance_with_sigma(
    defender_composite: float,
    sigma: float
) -> float:
    """
    Calculate contest distance with configurable Gaussian variance.

    Args:
        defender_composite: Defender composite (1-100)
        sigma: Standard deviation for Gaussian variance

    Returns:
        Contest distance in feet
    """
    # Base distance formula (from defense.py)
    base_distance = 10.0 - (defender_composite / 10.0)

    # Add Gaussian variance
    if sigma > 0:
        variance = random.gauss(0, sigma)
        base_distance += variance

    # Clamp
    return max(0.5, min(10.0, base_distance))


def calculate_contest_penalty(
    contest_distance: float,
    defender_composite: float
) -> float:
    """
    Calculate contest penalty (simplified from shooting.py).

    Args:
        contest_distance: Distance in feet
        defender_composite: Defender composite (1-100)

    Returns:
        Penalty as negative float
    """
    penalties = CONTEST_PENALTIES['3PT']

    if contest_distance >= CONTEST_DISTANCE_WIDE_OPEN:
        base_penalty = penalties['wide_open']  # 0%
    elif contest_distance >= CONTEST_DISTANCE_CONTESTED:
        base_penalty = penalties['contested']  # -8%
    else:
        base_penalty = penalties['heavy']  # -15%

    # Defender modifier (±5%)
    defender_modifier = (defender_composite - 50) * 0.001
    total_penalty = base_penalty - defender_modifier

    return min(0.0, total_penalty)


def simulate_shot(
    shooter_composite: float,
    defender_composite: float,
    sigma: float
) -> Tuple[bool, float, float]:
    """
    Simulate single 3PT shot with specified contest variance.

    Returns:
        (success, contest_distance, final_probability)
    """
    # Calculate base success
    attribute_diff = shooter_composite - defender_composite
    base_success = weighted_sigmoid_probability(
        base_rate=BASE_RATE_3PT,
        attribute_diff=attribute_diff,
        k=SIGMOID_K
    )

    # Calculate contest distance with specified variance
    contest_distance = calculate_contest_distance_with_sigma(defender_composite, sigma)

    # Calculate contest penalty
    contest_penalty = calculate_contest_penalty(contest_distance, defender_composite)

    # Final success rate
    final_success = max(0.0, min(1.0, base_success + contest_penalty))

    # Roll for success
    success = random.random() < final_success

    return success, contest_distance, final_success


def measure_correlation_for_sigma(
    sigma: float,
    n_shots_per_bucket: int = 500,
    seed: int = 42
) -> Dict[str, Any]:
    """
    Measure shot-level correlation for specific sigma value.

    Args:
        sigma: Contest distance variance (standard deviation)
        n_shots_per_bucket: Number of shots per composite bucket
        seed: Random seed for reproducibility

    Returns:
        Dict with correlation, spread, and contest distribution
    """
    random.seed(seed)

    # Define composite buckets
    buckets = [
        (40, 45),
        (45, 50),
        (50, 55),
        (55, 60),
        (60, 65),
        (65, 70),
        (70, 75),
        (75, 80),
    ]

    # Fixed average defender
    defender_composite = 50.0

    # Results storage
    bucket_results = []
    all_contest_distances = []

    for bucket_min, bucket_max in buckets:
        bucket_midpoint = (bucket_min + bucket_max) / 2.0

        # Simulate shots
        makes = 0
        contest_distances = []

        for _ in range(n_shots_per_bucket):
            # Random shooter within bucket
            shooter_composite = random.uniform(bucket_min, bucket_max)

            # Simulate shot
            success, distance, prob = simulate_shot(shooter_composite, defender_composite, sigma)

            if success:
                makes += 1
            contest_distances.append(distance)
            all_contest_distances.append(distance)

        make_rate = (makes / n_shots_per_bucket) * 100.0
        avg_contest_distance = statistics.mean(contest_distances)

        bucket_results.append({
            'composite': bucket_midpoint,
            'make_rate': make_rate,
            'avg_contest_distance': avg_contest_distance,
            'n_shots': n_shots_per_bucket
        })

    # Calculate Pearson correlation
    composites = [b['composite'] for b in bucket_results]
    make_rates = [b['make_rate'] for b in bucket_results]

    n = len(composites)
    mean_comp = statistics.mean(composites)
    mean_rate = statistics.mean(make_rates)

    numerator = sum((composites[i] - mean_comp) * (make_rates[i] - mean_rate) for i in range(n))
    denom_comp = sum((composites[i] - mean_comp) ** 2 for i in range(n))
    denom_rate = sum((make_rates[i] - mean_rate) ** 2 for i in range(n))

    correlation = numerator / (denom_comp ** 0.5 * denom_rate ** 0.5) if denom_comp > 0 and denom_rate > 0 else 0.0

    # Calculate spread
    spread = max(make_rates) - min(make_rates)

    # Calculate contest distribution
    wide_open = sum(1 for d in all_contest_distances if d >= 6.0) / len(all_contest_distances) * 100
    open_4_6 = sum(1 for d in all_contest_distances if 4.0 <= d < 6.0) / len(all_contest_distances) * 100
    tight_2_4 = sum(1 for d in all_contest_distances if 2.0 <= d < 4.0) / len(all_contest_distances) * 100
    very_tight = sum(1 for d in all_contest_distances if d < 2.0) / len(all_contest_distances) * 100

    # Calculate error from target (30/35/25/10)
    distribution_error = (
        abs(wide_open - 30) +
        abs(open_4_6 - 35) +
        abs(tight_2_4 - 25) +
        abs(very_tight - 10)
    )

    return {
        'sigma': sigma,
        'correlation': correlation,
        'spread': spread,
        'min_make_rate': min(make_rates),
        'max_make_rate': max(make_rates),
        'bucket_results': bucket_results,
        'contest_distribution': {
            'wide_open': wide_open,
            'open_4_6': open_4_6,
            'tight_2_4': tight_2_4,
            'very_tight': very_tight,
            'distribution_error': distribution_error
        }
    }


def main():
    print("=" * 80)
    print("CONTEST DISTANCE VARIANCE IMPACT ON SHOT-LEVEL CORRELATION")
    print("=" * 80)
    print()
    print("Hypothesis: Gaussian variance (sigma=1.9) is destroying correlation by")
    print("decoupling defender quality from contest quality.")
    print()
    print("Test Plan:")
    print("  - Simulate 500 shots per composite bucket (40-80)")
    print("  - Fixed defender composite = 50")
    print("  - Vary sigma from 0.0 to 2.5")
    print("  - Measure correlation, spread, and contest distribution")
    print("  - Find optimal tradeoff point")
    print()

    # Test different sigma values
    sigma_values = [0.0, 0.5, 0.9, 1.2, 1.5, 1.9, 2.5]
    results = []

    print("Running simulations...")
    print()

    for sigma in sigma_values:
        print(f"Testing sigma = {sigma:.1f}...", end=" ")
        result = measure_correlation_for_sigma(sigma, n_shots_per_bucket=500, seed=42)
        results.append(result)
        print(f"r={result['correlation']:.3f}, spread={result['spread']:.1f}pp, dist_error={result['contest_distribution']['distribution_error']:.1f}%")

    print()
    print("=" * 80)
    print("RESULTS SUMMARY")
    print("=" * 80)
    print()

    # Table header
    print(f"{'sigma':<6} {'Correlation':<12} {'Spread':<10} {'Min%':<8} {'Max%':<8} {'Dist Error':<12}")
    print("-" * 80)

    for result in results:
        print(
            f"{result['sigma']:<6.1f} "
            f"{result['correlation']:<12.3f} "
            f"{result['spread']:<10.1f} "
            f"{result['min_make_rate']:<8.1f} "
            f"{result['max_make_rate']:<8.1f} "
            f"{result['contest_distribution']['distribution_error']:<12.1f}"
        )

    print()
    print("=" * 80)
    print("CONTEST DISTRIBUTION BREAKDOWN")
    print("=" * 80)
    print()
    print(f"{'sigma':<6} {'Wide Open':<12} {'Open':<10} {'Tight':<10} {'Very Tight':<12}")
    print(f"{'':6} {'(6+ ft)':<12} {'(4-6 ft)':<10} {'(2-4 ft)':<10} {'(<2 ft)':<12}")
    print("-" * 80)

    for result in results:
        dist = result['contest_distribution']
        print(
            f"{result['sigma']:<6.1f} "
            f"{dist['wide_open']:<12.1f} "
            f"{dist['open_4_6']:<10.1f} "
            f"{dist['tight_2_4']:<10.1f} "
            f"{dist['very_tight']:<12.1f}"
        )

    print()
    print("Target:  30.0         35.0       25.0       10.0")
    print()

    # Analysis
    print("=" * 80)
    print("ANALYSIS")
    print("=" * 80)
    print()

    # Find sigma with best correlation
    best_corr_result = max(results, key=lambda r: r['correlation'])
    print(f"Best Correlation: sigma={best_corr_result['sigma']:.1f}, r={best_corr_result['correlation']:.3f}")

    # Find sigma with best distribution
    best_dist_result = min(results, key=lambda r: r['contest_distribution']['distribution_error'])
    print(f"Best Distribution: sigma={best_dist_result['sigma']:.1f}, error={best_dist_result['contest_distribution']['distribution_error']:.1f}%")

    # Find optimal tradeoff (weighted score)
    # Normalize correlation (target: 0.40) and distribution error (target: 0)
    for result in results:
        corr_score = result['correlation'] / 0.40  # Normalize to target
        dist_score = 1.0 - (result['contest_distribution']['distribution_error'] / 100.0)  # Invert error
        result['combined_score'] = (corr_score * 0.6) + (dist_score * 0.4)  # Weight correlation 60%, dist 40%

    optimal_result = max(results, key=lambda r: r['combined_score'])
    print(f"Optimal Tradeoff: sigma={optimal_result['sigma']:.1f}, combined_score={optimal_result['combined_score']:.3f}")
    print()

    # Interpretation
    print("=" * 80)
    print("INTERPRETATION")
    print("=" * 80)
    print()

    # Compare sigma=0.0 vs sigma=1.9
    sigma_0 = next(r for r in results if r['sigma'] == 0.0)
    sigma_current = next(r for r in results if r['sigma'] == 1.9)

    corr_loss = sigma_0['correlation'] - sigma_current['correlation']
    corr_loss_pct = (corr_loss / sigma_0['correlation']) * 100

    print(f"Impact of sigma=1.9 (current implementation):")
    print(f"  Correlation loss: {corr_loss:.3f} ({corr_loss_pct:.1f}% reduction)")
    print(f"  Contest distribution error: {sigma_current['contest_distribution']['distribution_error']:.1f}%")
    print()

    if corr_loss > 0.2:
        print("CONCLUSION: Gaussian variance is SEVERELY hurting correlation.")
        print("The contest distribution benefit does NOT justify the correlation loss.")
        print()
        print("RECOMMENDATION:")
        print(f"  1. Try sigma={optimal_result['sigma']:.1f} (optimal tradeoff)")
        print(f"     - Correlation: {optimal_result['correlation']:.3f} (target: 0.40)")
        print(f"     - Distribution error: {optimal_result['contest_distribution']['distribution_error']:.1f}% (acceptable)")
        print()
        print("  2. Implement attribute-dependent variance (Option B from diagnosis)")
        print("     - sigma = 2.5 - (defender_composite / 100.0) * 1.5")
        print("     - Elite defenders: lower variance (more consistent)")
        print("     - Poor defenders: higher variance (inconsistent)")
    elif corr_loss > 0.1:
        print("CONCLUSION: Gaussian variance is moderately hurting correlation.")
        print("Consider reducing sigma or implementing attribute-dependent variance.")
    else:
        print("CONCLUSION: Gaussian variance impact is minimal.")
        print("The problem may lie elsewhere (k-value, base rates, etc.).")

    print()
    print("=" * 80)

    # Save detailed results to JSON
    output_path = Path(__file__).parent.parent.parent / 'contest_variance_analysis.json'
    with open(output_path, 'w') as f:
        json.dump({
            'test_config': {
                'n_shots_per_bucket': 500,
                'seed': 42,
                'defender_composite': 50,
                'sigmoid_k': SIGMOID_K,
                'base_rate_3pt': BASE_RATE_3PT
            },
            'results': results
        }, f, indent=2)

    print(f"Detailed results saved to: {output_path}")
    print()


if __name__ == "__main__":
    main()
