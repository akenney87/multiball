"""
Contest Distance Variance System - Gaussian Noise Validation

This script validates the REVISED approach using additive Gaussian noise
instead of Beta distribution sampling.

Author: Chief Probability & Mathematics Engineer
Date: 2025-11-10
Version: 2.0 (Gaussian noise)
"""

import random
import math
from typing import Dict, Any
from collections import defaultdict


def calculate_contest_distance_gaussian(
    defender_composite: float,
    acceleration: float = 50.0,
    is_help_defense: bool = False,
    zone_pct: float = 0.0,
    patience: float = 50.0,
    sigma: float = 1.8,
    random_seed: int = None
) -> Dict[str, Any]:
    """
    Calculate contest distance using additive Gaussian noise.

    Args:
        defender_composite: Defender's contest composite (0-100)
        acceleration: Defender's acceleration attribute (0-100)
        is_help_defense: Whether this is help defense
        zone_pct: Zone defense percentage (0-100)
        patience: Shooter's patience attribute (0-100)
        sigma: Standard deviation of Gaussian noise (feet)
        random_seed: Optional seed for reproducibility

    Returns:
        Dict with 'distance', 'baseline', 'noise', 'before_clamp'
    """
    # Step 1: Calculate attribute-driven baseline
    base_distance = 10.0 - (defender_composite / 10.0)

    # Acceleration closeout modifier
    acceleration_modifier = (acceleration - 50.0) * -0.02
    base_distance += acceleration_modifier

    # Help defense penalty
    if is_help_defense:
        base_distance += 3.0

    # Zone penalty
    if zone_pct > 0:
        zone_modifier = zone_pct / 100.0
        zone_penalty = 1.0 * zone_modifier
        base_distance += zone_penalty

    # Patience modifier
    patience_modifier = (patience - 50.0) * 0.02
    base_distance += patience_modifier

    # Clamp baseline to valid range
    baseline_clamped = max(0.5, min(10.0, base_distance))

    # Step 2: Sample Gaussian noise
    if random_seed is not None:
        random.seed(random_seed)

    noise = random.gauss(0, sigma)

    # Step 3: Add noise to baseline
    sampled_distance = baseline_clamped + noise

    # Step 4: Reflect at boundaries
    if sampled_distance < 0.5:
        sampled_distance = 0.5 + (0.5 - sampled_distance)
    elif sampled_distance > 10.0:
        sampled_distance = 10.0 - (sampled_distance - 10.0)

    # Step 5: Final hard clamp
    final_distance = max(0.5, min(10.0, sampled_distance))

    return {
        'distance': final_distance,
        'baseline': baseline_clamped,
        'noise': noise,
        'before_clamp': baseline_clamped + noise,
        'after_reflection': sampled_distance
    }


def calculate_contest_distance_deterministic(
    defender_composite: float,
    acceleration: float = 50.0,
    is_help_defense: bool = False,
    zone_pct: float = 0.0,
    patience: float = 50.0
) -> float:
    """Current deterministic contest distance calculation."""
    base_distance = 10.0 - (defender_composite / 10.0)
    acceleration_modifier = (acceleration - 50.0) * -0.02
    base_distance += acceleration_modifier

    if is_help_defense:
        base_distance += 3.0

    if zone_pct > 0:
        zone_modifier = zone_pct / 100.0
        zone_penalty = 1.0 * zone_modifier
        base_distance += zone_penalty

    patience_modifier = (patience - 50.0) * 0.02
    base_distance += patience_modifier

    return max(0.5, min(10.0, base_distance))


def classify_contest(distance: float) -> str:
    """Classify contest distance into tiers."""
    if distance >= 6.0:
        return "Wide Open (6+ ft)"
    elif distance >= 4.0:
        return "Open (4-6 ft)"
    elif distance >= 2.0:
        return "Tight (2-4 ft)"
    else:
        return "Very Tight (<2 ft)"


def test_1_attribute_correlation():
    """Test that elite defenders generate tighter contests than poor defenders."""
    print("\n" + "="*80)
    print("TEST 1: ATTRIBUTE CORRELATION (Gaussian Noise)")
    print("="*80)

    scenarios = [
        ("Elite defender", 85, 70),
        ("Good defender", 70, 60),
        ("Average defender", 50, 50),
        ("Below avg defender", 40, 45),
        ("Poor defender", 30, 40),
    ]

    results = {}
    n_samples = 10000

    print(f"\nRunning {n_samples:,} simulations per scenario (sigma=1.8)...")
    print()

    for label, composite, accel in scenarios:
        distances = []
        baselines = []
        tiers = defaultdict(int)

        for _ in range(n_samples):
            result = calculate_contest_distance_gaussian(
                defender_composite=composite,
                acceleration=accel,
                sigma=1.8
            )
            distance = result['distance']
            baseline = result['baseline']
            distances.append(distance)
            baselines.append(baseline)
            tiers[classify_contest(distance)] += 1

        avg_distance = sum(distances) / len(distances)
        avg_baseline = sum(baselines) / len(baselines)
        std_distance = math.sqrt(sum((d - avg_distance)**2 for d in distances) / len(distances))

        results[label] = {
            'composite': composite,
            'avg_baseline': avg_baseline,
            'avg_distance': avg_distance,
            'std_distance': std_distance,
            'tiers': {tier: count / n_samples * 100 for tier, count in tiers.items()}
        }

        print(f"{label:25s} (comp={composite:2d}, accel={accel:2d})")
        print(f"  Baseline: {avg_baseline:.2f} ft")
        print(f"  Avg distance: {avg_distance:.2f} ft (±{std_distance:.2f})")
        print(f"  Distribution:")
        for tier in ["Very Tight (<2 ft)", "Tight (2-4 ft)", "Open (4-6 ft)", "Wide Open (6+ ft)"]:
            pct = results[label]['tiers'].get(tier, 0)
            print(f"    {tier:25s}: {pct:5.1f}%")
        print()

    # Validation checks
    print("VALIDATION CHECKS:")
    print("-"*80)

    elite_avg = results["Elite defender"]["avg_distance"]
    avg_avg = results["Average defender"]["avg_distance"]
    poor_avg = results["Poor defender"]["avg_distance"]

    check_1 = elite_avg < avg_avg < poor_avg
    print(f"[CHECK] Elite < Average < Poor: {check_1}")
    print(f"  Elite: {elite_avg:.2f} ft | Average: {avg_avg:.2f} ft | Poor: {poor_avg:.2f} ft")

    check_2 = elite_avg < 2.5
    print(f"[CHECK] Elite defender avg < 2.5 ft: {check_2}")
    print(f"  Actual: {elite_avg:.2f} ft")

    elite_very_tight = results["Elite defender"]["tiers"].get("Very Tight (<2 ft)", 0)
    check_3 = elite_very_tight > 55.0
    print(f"[CHECK] Elite defender very tight contests > 55%: {check_3}")
    print(f"  Actual: {elite_very_tight:.1f}%")

    poor_wide = results["Poor defender"]["tiers"].get("Wide Open (6+ ft)", 0)
    check_4 = poor_wide > 55.0
    print(f"[CHECK] Poor defender wide open > 55%: {check_4}")
    print(f"  Actual: {poor_wide:.1f}%")

    avg_in_range = 4.0 < avg_avg < 6.0
    print(f"[CHECK] Average defender in range [4.0, 6.0] ft: {avg_in_range}")
    print(f"  Actual: {avg_avg:.2f} ft")

    print()

    all_checks = check_1 and check_2 and check_3 and check_4 and avg_in_range

    if all_checks:
        print("[PASS] TEST 1 PASSED: Attributes properly influence contest tightness")
    else:
        print("[FAIL] TEST 1 FAILED: Attribute correlation not maintained")

    return all_checks


def test_2_target_distribution():
    """Test that overall distribution matches targets across realistic defender mix."""
    print("\n" + "="*80)
    print("TEST 2: TARGET DISTRIBUTION (Gaussian Noise)")
    print("="*80)

    n_samples = 10000
    distances = []
    tiers = defaultdict(int)

    print(f"\nRunning {n_samples:,} simulations with realistic defender mix...")
    print("(Defender composites: mean=58, std=12, clamped to [20, 95])")
    print("(Sigma = 1.8 ft)")
    print()

    for _ in range(n_samples):
        # Sample defender composite from normal distribution
        defender_composite = random.gauss(58, 12)
        defender_composite = max(20, min(95, defender_composite))

        # Sample acceleration from normal distribution
        acceleration = random.gauss(50, 15)
        acceleration = max(20, min(95, acceleration))

        result = calculate_contest_distance_gaussian(
            defender_composite=defender_composite,
            acceleration=acceleration,
            sigma=1.8
        )
        distance = result['distance']
        distances.append(distance)
        tiers[classify_contest(distance)] += 1

    # Calculate distribution
    print("OVERALL DISTRIBUTION:")
    print("-"*80)
    print(f"{'Tier':<25s} {'Actual':>10s} {'Target':>10s} {'Status':>10s}")
    print("-"*80)

    targets = {
        "Wide Open (6+ ft)": 30.0,
        "Open (4-6 ft)": 35.0,
        "Tight (2-4 ft)": 25.0,
        "Very Tight (<2 ft)": 10.0
    }

    checks = []
    for tier in ["Very Tight (<2 ft)", "Tight (2-4 ft)", "Open (4-6 ft)", "Wide Open (6+ ft)"]:
        actual = tiers[tier] / n_samples * 100
        target = targets[tier]
        tolerance = 5.0  # ±5% acceptable
        in_range = abs(actual - target) <= tolerance
        checks.append(in_range)

        status = "[OK]" if in_range else "[!!]"
        print(f"{tier:<25s} {actual:>9.1f}% {target:>9.1f}% {status:>10s}")

    print()
    if all(checks):
        print("[PASS] TEST 2 PASSED: Distribution matches targets (+-5% tolerance)")
    else:
        print("[FAIL] TEST 2 FAILED: Distribution outside target ranges")

    return all(checks)


def test_3_sigma_comparison():
    """Compare different sigma values to find optimal."""
    print("\n" + "="*80)
    print("TEST 3: SIGMA TUNING")
    print("="*80)

    sigma_values = [1.4, 1.8, 2.2]
    n_samples = 5000

    print(f"\nComparing sigma values with {n_samples:,} samples each...")
    print("(Using realistic defender mix: mean=58, std=12)")
    print()

    best_sigma = None
    best_error = float('inf')

    for sigma in sigma_values:
        print(f"SIGMA = {sigma:.1f} ft")
        print("-"*80)

        tiers = defaultdict(int)

        for _ in range(n_samples):
            defender_composite = random.gauss(58, 12)
            defender_composite = max(20, min(95, defender_composite))

            acceleration = random.gauss(50, 15)
            acceleration = max(20, min(95, acceleration))

            result = calculate_contest_distance_gaussian(
                defender_composite=defender_composite,
                acceleration=acceleration,
                sigma=sigma
            )
            distance = result['distance']
            tiers[classify_contest(distance)] += 1

        print(f"{'Tier':<25s} {'Actual':>10s} {'Target':>10s}")
        print("-"*40)

        targets = {
            "Wide Open (6+ ft)": 30.0,
            "Open (4-6 ft)": 35.0,
            "Tight (2-4 ft)": 25.0,
            "Very Tight (<2 ft)": 10.0
        }

        total_error = 0
        for tier in ["Very Tight (<2 ft)", "Tight (2-4 ft)", "Open (4-6 ft)", "Wide Open (6+ ft)"]:
            actual = tiers[tier] / n_samples * 100
            target = targets[tier]
            error = abs(actual - target)
            total_error += error
            print(f"{tier:<25s} {actual:>9.1f}% {target:>9.1f}%")

        print(f"\nTotal absolute error: {total_error:.2f}%")
        print()

        if total_error < best_error:
            best_error = total_error
            best_sigma = sigma

    print(f"RECOMMENDATION: sigma = {best_sigma:.1f} ft (lowest total error: {best_error:.2f}%)")
    print()


def test_4_comparison_deterministic_vs_gaussian():
    """Compare deterministic system vs Gaussian noise system."""
    print("\n" + "="*80)
    print("TEST 4: DETERMINISTIC VS GAUSSIAN COMPARISON")
    print("="*80)

    n_samples = 5000

    print(f"\nComparing systems with {n_samples:,} samples...")
    print("(Using realistic defender mix: mean=58, std=12)")
    print()

    # Current deterministic system
    print("CURRENT SYSTEM (Deterministic):")
    print("-"*80)

    tiers_det = defaultdict(int)
    for _ in range(n_samples):
        defender_composite = random.gauss(58, 12)
        defender_composite = max(20, min(95, defender_composite))

        acceleration = random.gauss(50, 15)
        acceleration = max(20, min(95, acceleration))

        distance = calculate_contest_distance_deterministic(
            defender_composite=defender_composite,
            acceleration=acceleration
        )
        tiers_det[classify_contest(distance)] += 1

    for tier in ["Very Tight (<2 ft)", "Tight (2-4 ft)", "Open (4-6 ft)", "Wide Open (6+ ft)"]:
        actual = tiers_det[tier] / n_samples * 100
        print(f"{tier:<25s}: {actual:>6.1f}%")

    # New Gaussian noise system
    print("\nNEW SYSTEM (Gaussian Noise, sigma=1.8 ft):")
    print("-"*80)

    tiers_gauss = defaultdict(int)
    for _ in range(n_samples):
        defender_composite = random.gauss(58, 12)
        defender_composite = max(20, min(95, defender_composite))

        acceleration = random.gauss(50, 15)
        acceleration = max(20, min(95, acceleration))

        result = calculate_contest_distance_gaussian(
            defender_composite=defender_composite,
            acceleration=acceleration,
            sigma=1.8
        )
        tiers_gauss[classify_contest(result['distance'])] += 1

    for tier in ["Very Tight (<2 ft)", "Tight (2-4 ft)", "Open (4-6 ft)", "Wide Open (6+ ft)"]:
        actual = tiers_gauss[tier] / n_samples * 100
        print(f"{tier:<25s}: {actual:>6.1f}%")

    print()


def test_5_seed_reproducibility():
    """Test that same seed produces same output."""
    print("\n" + "="*80)
    print("TEST 5: SEED REPRODUCIBILITY")
    print("="*80)

    defender_composite = 58
    acceleration = 50

    print("\nTesting seed reproducibility...")
    print()

    # Test 1: Same seed, same output
    result1 = calculate_contest_distance_gaussian(
        defender_composite=defender_composite,
        acceleration=acceleration,
        sigma=1.8,
        random_seed=42
    )

    result2 = calculate_contest_distance_gaussian(
        defender_composite=defender_composite,
        acceleration=acceleration,
        sigma=1.8,
        random_seed=42
    )

    same_seed_check = result1['distance'] == result2['distance']
    print(f"Same seed (42) produces same output: {same_seed_check}")
    print(f"  Result 1: {result1['distance']:.4f} ft")
    print(f"  Result 2: {result2['distance']:.4f} ft")

    # Test 2: Different seeds, different outputs (high probability)
    result3 = calculate_contest_distance_gaussian(
        defender_composite=defender_composite,
        acceleration=acceleration,
        sigma=1.8,
        random_seed=43
    )

    diff_seed_check = result1['distance'] != result3['distance']
    print(f"\nDifferent seed (43) produces different output: {diff_seed_check}")
    print(f"  Result with seed 42: {result1['distance']:.4f} ft")
    print(f"  Result with seed 43: {result3['distance']:.4f} ft")

    print()
    if same_seed_check and diff_seed_check:
        print("[PASS] TEST 5 PASSED: Seed control works correctly")
    else:
        print("[FAIL] TEST 5 FAILED: Seed control not working")

    return same_seed_check and diff_seed_check


def main():
    """Run all validation tests."""
    print("="*80)
    print("CONTEST DISTANCE GAUSSIAN NOISE VALIDATION")
    print("="*80)
    print("\nValidating Gaussian noise approach for contest distance variance")
    print()

    results = []

    # Run all tests
    results.append(("Test 1: Attribute Correlation", test_1_attribute_correlation()))
    results.append(("Test 2: Target Distribution", test_2_target_distribution()))

    # Additional analysis tests (not pass/fail)
    test_3_sigma_comparison()
    test_4_comparison_deterministic_vs_gaussian()

    # Reproducibility test
    results.append(("Test 5: Seed Reproducibility", test_5_seed_reproducibility()))

    # Summary
    print("\n" + "="*80)
    print("VALIDATION SUMMARY")
    print("="*80)
    print()

    for test_name, passed in results:
        status = "[PASS]" if passed else "[FAIL]"
        print(f"{test_name:40s}: {status}")

    print()

    if all(passed for _, passed in results):
        print("="*80)
        print("[SUCCESS] ALL VALIDATION TESTS PASSED")
        print("="*80)
        print("\nThe Gaussian noise approach is mathematically sound and ready for implementation.")
        print("\nRecommended parameters:")
        print("  - sigma = 1.8 ft")
        print("  - Use reflection at boundaries")
        print("  - Add seed control for debug mode")
    else:
        print("="*80)
        print("[ERROR] SOME VALIDATION TESTS FAILED")
        print("="*80)
        print("\nFurther tuning required before implementation.")


if __name__ == '__main__':
    main()
