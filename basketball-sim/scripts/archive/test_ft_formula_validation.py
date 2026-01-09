"""
Validate the free throw formula against spec expectations.

The spec says elite shooters (90+ composite) should reach ~92%.
Let's verify the math.
"""

import math

def sigmoid(x):
    """Sigmoid function."""
    return 1.0 / (1.0 + math.exp(-x))

def calculate_ft_probability(composite):
    """Calculate FT probability using spec formula."""
    base_rate = 0.40
    k = 0.02
    prob = base_rate + (1.0 - base_rate) * sigmoid(k * (composite - 50))
    return prob

# Test various composites
print("Free Throw Probability by Composite Score")
print("=" * 60)
print(f"{'Composite':<12} {'Probability':<15} {'Make %':<10}")
print("=" * 60)

for composite in [30, 40, 50, 60, 70, 80, 90, 95, 99]:
    prob = calculate_ft_probability(composite)
    print(f"{composite:<12} {prob:<15.4f} {prob*100:.2f}%")

print("=" * 60)
print("\nTo reach 92% FT, we need:")
# Solve for composite where prob = 0.92
# 0.92 = 0.40 + 0.60 * sigmoid(0.02 * (composite - 50))
# 0.52 = 0.60 * sigmoid(0.02 * (composite - 50))
# 0.8667 = sigmoid(0.02 * (composite - 50))
# Let sigmoid(x) = 0.8667
# 1 / (1 + exp(-x)) = 0.8667
# 1 + exp(-x) = 1.1538
# exp(-x) = 0.1538
# -x = ln(0.1538) = -1.872
# x = 1.872
# 0.02 * (composite - 50) = 1.872
# composite - 50 = 93.6
# composite = 143.6

target = 0.92
target_sigmoid = (target - 0.40) / 0.60
x = math.log(target_sigmoid / (1 - target_sigmoid))
composite_needed = (x / 0.02) + 50
print(f"Composite needed for {target*100:.0f}% FT: {composite_needed:.1f}")
print("\nThis is impossible since composites max at 100!")
print("\nLet's check what 99 composite gives:")
prob_99 = calculate_ft_probability(99)
print(f"Composite 99: {prob_99*100:.2f}% FT")
