"""
Phase 1 Validation - Python Reference Outputs

This script generates reference outputs from the Python basketball-sim
for comparison against TypeScript implementation.

Agent 4 will use these outputs to validate TypeScript translation.
"""

import sys
import os
import json

# Add parent directory to path
basketball_sim_path = os.path.join(os.path.dirname(__file__), '..', 'basketball-sim')
sys.path.insert(0, basketball_sim_path)
sys.path.insert(0, os.path.join(basketball_sim_path, 'src'))

from src.core.probability import (
    sigmoid,
    calculate_composite,
    weighted_sigmoid_probability,
    calculate_stamina_penalty,
    set_seed,
    roll_success
)
from src.constants import WEIGHTS_3PT, SIGMOID_K, STAMINA_THRESHOLD


def test_sigmoid():
    """Test sigmoid function with various inputs"""
    print("=" * 80)
    print("TEST 1: SIGMOID FUNCTION")
    print("=" * 80)

    test_cases = [
        ("Zero input", 0),
        ("Positive small", 1),
        ("Positive large", 10),
        ("Positive extreme", 100),
        ("Negative small", -1),
        ("Negative large", -10),
        ("Negative extreme", -100),
    ]

    results = {}
    for name, x in test_cases:
        result = sigmoid(x)
        results[name] = {"input": x, "output": result}
        print(f"{name:20s}: sigmoid({x:6.1f}) = {result:.10f}")

    return results


def test_weighted_sigmoid():
    """Test weighted sigmoid probability formula"""
    print("\n" + "=" * 80)
    print("TEST 2: WEIGHTED SIGMOID PROBABILITY (CRITICAL)")
    print("=" * 80)

    test_cases = [
        ("Neutral matchup", 0.28, 0),
        ("Elite offense +20", 0.28, 20),
        ("Elite offense +40", 0.28, 40),
        ("Elite offense +60 (capped)", 0.28, 60),
        ("Elite defense -20", 0.28, -20),
        ("Elite defense -40", 0.28, -40),
        ("Elite defense -60 (capped)", 0.28, -60),
        ("Extreme +100 (capped at 40)", 0.28, 100),
        ("Extreme -100 (capped at -40)", 0.28, -100),
        ("High base rate neutral", 0.62, 0),
        ("High base rate +30", 0.62, 30),
        ("High base rate -30", 0.62, -30),
    ]

    results = {}
    for name, base_rate, diff in test_cases:
        result = weighted_sigmoid_probability(base_rate, diff, SIGMOID_K)
        results[name] = {
            "base_rate": base_rate,
            "attribute_diff": diff,
            "k": SIGMOID_K,
            "output": result
        }
        print(f"{name:30s}: P({base_rate:.2f}, {diff:4.0f}) = {result:.6f}")

    return results


def test_composite_calculation():
    """Test attribute composite calculation"""
    print("\n" + "=" * 80)
    print("TEST 3: COMPOSITE CALCULATION")
    print("=" * 80)

    test_players = [
        ("All 50s", {attr: 50 for attr in WEIGHTS_3PT.keys()}),
        ("All 80s", {attr: 80 for attr in WEIGHTS_3PT.keys()}),
        ("Mixed attributes", {
            'form_technique': 90,
            'throw_accuracy': 85,
            'finesse': 80,
            'hand_eye_coordination': 75,
            'balance': 70,
            'composure': 65,
            'consistency': 60,
            'agility': 55,
        }),
        ("Elite shooter", {
            'form_technique': 95,
            'throw_accuracy': 92,
            'finesse': 88,
            'hand_eye_coordination': 90,
            'balance': 85,
            'composure': 87,
            'consistency': 84,
            'agility': 80,
        }),
        ("Poor shooter", {
            'form_technique': 20,
            'throw_accuracy': 18,
            'finesse': 15,
            'hand_eye_coordination': 22,
            'balance': 25,
            'composure': 19,
            'consistency': 17,
            'agility': 16,
        }),
    ]

    results = {}
    for name, player in test_players:
        composite = calculate_composite(player, WEIGHTS_3PT)
        results[name] = {
            "attributes": player,
            "weights": WEIGHTS_3PT,
            "composite": composite
        }
        print(f"{name:20s}: composite = {composite:.6f}")

    return results


def test_stamina_degradation():
    """Test stamina degradation formula"""
    print("\n" + "=" * 80)
    print("TEST 4: STAMINA DEGRADATION")
    print("=" * 80)

    test_cases = [
        ("Full stamina", 100),
        ("At threshold", 80),
        ("Above threshold", 85),
        ("Below threshold", 75),
        ("Moderate fatigue", 60),
        ("Significant fatigue", 40),
        ("Exhausted", 20),
        ("Fully exhausted", 0),
    ]

    results = {}
    for name, stamina in test_cases:
        penalty = calculate_stamina_penalty(stamina)
        results[name] = {
            "stamina": stamina,
            "penalty": penalty,
            "threshold": STAMINA_THRESHOLD
        }
        print(f"{name:25s}: stamina={stamina:3d} -> penalty={penalty:.6f} ({penalty*100:.2f}%)")

    return results


def test_random_seeding():
    """Test deterministic random number generation with seeding"""
    print("\n" + "=" * 80)
    print("TEST 5: RANDOM SEED DETERMINISM")
    print("=" * 80)

    # Test with seed 42
    set_seed(42)
    rolls_seed_42 = [roll_success(0.5) for _ in range(20)]

    # Reset and try again
    set_seed(42)
    rolls_seed_42_repeat = [roll_success(0.5) for _ in range(20)]

    # Try different seed
    set_seed(123)
    rolls_seed_123 = [roll_success(0.5) for _ in range(20)]

    match = rolls_seed_42 == rolls_seed_42_repeat
    different = rolls_seed_42 != rolls_seed_123

    results = {
        "seed_42_first": rolls_seed_42,
        "seed_42_repeat": rolls_seed_42_repeat,
        "seed_123": rolls_seed_123,
        "reproducible": match,
        "different_seeds_differ": different
    }

    print(f"Seed 42 (first run):  {rolls_seed_42[:10]}")
    print(f"Seed 42 (repeat):     {rolls_seed_42_repeat[:10]}")
    print(f"Seed 123:             {rolls_seed_123[:10]}")
    print(f"\nReproducible: {match}")
    print(f"Different seeds differ: {different}")

    return results


def test_edge_cases():
    """Test edge cases and boundary conditions"""
    print("\n" + "=" * 80)
    print("TEST 6: EDGE CASES")
    print("=" * 80)

    edge_cases = []

    # Test attribute diff = exactly 0
    result1 = weighted_sigmoid_probability(0.30, 0)
    edge_cases.append(("diff=0 returns base_rate", 0.30, result1, abs(result1 - 0.30) < 0.01))

    # Test floor (5%)
    result2 = weighted_sigmoid_probability(0.30, -200)
    edge_cases.append(("floor at 5%", 0.05, result2, result2 >= 0.05))

    # Test ceiling (95%)
    result3 = weighted_sigmoid_probability(0.30, 200)
    edge_cases.append(("ceiling at 95%", 0.95, result3, result3 <= 0.95))

    # Test capping at +40
    result4a = weighted_sigmoid_probability(0.30, 40)
    result4b = weighted_sigmoid_probability(0.30, 100)
    edge_cases.append(("cap at +40", result4a, result4b, abs(result4a - result4b) < 0.001))

    # Test capping at -40
    result5a = weighted_sigmoid_probability(0.30, -40)
    result5b = weighted_sigmoid_probability(0.30, -100)
    edge_cases.append(("cap at -40", result5a, result5b, abs(result5a - result5b) < 0.001))

    results = {}
    for i, (name, expected, actual, passes) in enumerate(edge_cases):
        results[name] = {
            "expected": expected,
            "actual": actual,
            "passes": passes
        }
        status = "[PASS]" if passes else "[FAIL]"
        print(f"{status} {name:30s}: expected={expected:.6f}, actual={actual:.6f}")

    return results


def run_all_tests():
    """Run all validation tests and save outputs"""
    print("\n")
    print("+" + "=" * 78 + "+")
    print("|" + " " * 20 + "PHASE 1 PYTHON VALIDATION" + " " * 33 + "|")
    print("|" + " " * 15 + "Basketball-Sim Reference Outputs" + " " * 31 + "|")
    print("+" + "=" * 78 + "+")
    print("\n")

    all_results = {
        "sigmoid": test_sigmoid(),
        "weighted_sigmoid": test_weighted_sigmoid(),
        "composite": test_composite_calculation(),
        "stamina": test_stamina_degradation(),
        "random_seed": test_random_seeding(),
        "edge_cases": test_edge_cases(),
    }

    # Save to JSON for comparison
    output_file = os.path.join(os.path.dirname(__file__), 'python_reference_outputs.json')
    with open(output_file, 'w') as f:
        json.dump(all_results, f, indent=2)

    print("\n" + "=" * 80)
    print("VALIDATION COMPLETE")
    print("=" * 80)
    print(f"Reference outputs saved to: {output_file}")
    print("\nNext: Run TypeScript validation and compare outputs")

    return all_results


if __name__ == "__main__":
    run_all_tests()
