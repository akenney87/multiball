"""
M4.5 PHASE 2: Test Free Throw Probability Formula

Check if the FT formula is producing expected probabilities.
"""

import sys
import math

def sigmoid(x):
    """Sigmoid function."""
    return 1.0 / (1.0 + math.exp(-x))

def calculate_ft_probability(composite, base_rate=0.40, k=0.02, pressure_modifier=0.0):
    """Calculate FT probability using the formula from free_throws.py."""
    composite_diff = composite - 50.0  # Center around league average
    sigmoid_input = k * composite_diff
    sigmoid_output = sigmoid(sigmoid_input)

    # Weighted sigmoid: multiply by (1 - BaseRate)
    attribute_bonus = (1.0 - base_rate) * sigmoid_output

    # Final probability
    probability = base_rate + attribute_bonus + pressure_modifier

    return max(0.0, min(1.0, probability))

print("="*80)
print("FREE THROW PROBABILITY FORMULA TEST")
print("="*80)
print()
print("Formula: P = BaseRate + (1 - BaseRate) * sigmoid(k * (composite - 50)) + pressure")
print("Current settings: BaseRate=0.40, k=0.02")
print()

# Test with different composite values
test_composites = [30, 40, 50, 60, 70, 75, 80, 90, 95]

print("Composite | Expected (Comments) | Actual Formula | Status")
print("-" * 70)

expected_values = {
    50: 65,  # Poor shooters
    70: 77,  # Average shooters
    75: 80,  # Above average (interpolated)
    90: 92,  # Elite shooters
}

for composite in test_composites:
    actual_prob = calculate_ft_probability(composite)
    actual_pct = actual_prob * 100

    expected_str = f"{expected_values[composite]}%" if composite in expected_values else "N/A"

    print(f"{composite:9d} | {expected_str:19s} | {actual_pct:14.1f}% | ", end="")

    # Check if it matches expected
    if composite in expected_values:
        expected = expected_values[composite]
        diff = abs(actual_pct - expected)
        if diff < 2:
            print("✓ PASS")
        elif diff < 5:
            print("⚠ WARNING")
        else:
            print(f"✗ FAIL (off by {diff:.1f}%)")
    else:
        print("(no expected value)")

print()
print("="*80)
print("ANALYSIS")
print("="*80)
print()

# Check if the formula matches the comments
composite_50_actual = calculate_ft_probability(50) * 100
composite_70_actual = calculate_ft_probability(70) * 100
composite_90_actual = calculate_ft_probability(90) * 100

print(f"For composite=50 (poor): Expected 65%, Actual {composite_50_actual:.1f}%")
print(f"For composite=70 (average): Expected 77%, Actual {composite_70_actual:.1f}%")
print(f"For composite=90 (elite): Expected 92%, Actual {composite_90_actual:.1f}%")
print()

# Calculate what our teams' average composite might be
print("HYPOTHESIS FOR 34% FT% IN VALIDATION:")
print()
print("If validation shows 34% FT%, the average composite would need to be:")
print()

# Solve for composite given target probability
target_prob = 0.34
base_rate = 0.40
k = 0.02

# P = 0.40 + 0.60 * sigmoid(k * (composite - 50))
# 0.34 = 0.40 + 0.60 * sigmoid(0.02 * (composite - 50))
# -0.06 = 0.60 * sigmoid(0.02 * (composite - 50))
# -0.1 = sigmoid(0.02 * (composite - 50))

# This is impossible! Sigmoid is always positive (0 to 1)
# The minimum probability with BaseRate=0.40 is 0.40 * 1.0 = 0.40

print("  Target probability: 0.34 (34%)")
print("  BaseRate: 0.40 (40%)")
print()
print("  PROBLEM DETECTED: Target 0.34 < BaseRate 0.40!")
print()
print("  The formula CANNOT produce probabilities below BaseRate (40%).")
print("  But validation shows 34% FT%.")
print()
print("  Possible causes:")
print("    1. Team composites are extremely low (< 0 ??)")
print("    2. Pressure modifiers are being applied incorrectly")
print("    3. Stats aggregation is counting wrong (FTM / FTA calculation)")
print("    4. Some other system is interfering")
print()

# Let's test what composite would give us exactly 40%
composite_for_40pct = 50  # Should be at the inflection point
actual_40 = calculate_ft_probability(composite_for_40pct) * 100
print(f"  Composite {composite_for_40pct} produces {actual_40:.1f}% (should be near 40%)")
print()

# Test with extremely low composites
print("Testing with extreme low composites:")
for comp in [0, 10, 20, 30]:
    prob = calculate_ft_probability(comp)
    print(f"  Composite {comp}: {prob*100:.1f}%")
print()

print("  Even composite=0 produces {:.1f}% (formula floor is ~40%)".format(
    calculate_ft_probability(0) * 100
))
print()
print("CONCLUSION: The formula itself cannot produce 34% FT%.")
print("The issue must be in stats tracking, aggregation, or another system.")
