"""
Test the centered sigmoid formula to understand the overcorrection.
"""
import math

def sigmoid(x):
    """Standard sigmoid function."""
    return 1 / (1 + math.exp(-x))

def old_weighted_sigmoid(base_rate, attr_diff, k=0.02):
    """OLD broken formula that inflates probabilities."""
    sigmoid_output = sigmoid(k * attr_diff)
    probability = base_rate + (1.0 - base_rate) * sigmoid_output
    return probability

def new_centered_sigmoid(base_rate, attr_diff, k=0.02):
    """NEW centered formula."""
    sigmoid_output = sigmoid(k * attr_diff)
    centered = (sigmoid_output - 0.5) * 2.0

    if centered >= 0:
        probability = base_rate + (1.0 - base_rate) * centered
    else:
        probability = base_rate * (1.0 + centered)

    return probability

# Test with 3PT shot (30% base rate)
base_rate = 0.30
print("=" * 60)
print("3PT Shot (30% base rate)")
print("=" * 60)

test_diffs = [0, 5, 10, 15, 20, -5, -10, -15, -20]

print(f"\n{'Diff':<8} {'Old Formula':<15} {'New Formula':<15} {'Change':<10}")
print("-" * 60)
for diff in test_diffs:
    old_prob = old_weighted_sigmoid(base_rate, diff)
    new_prob = new_centered_sigmoid(base_rate, diff)
    change = new_prob - old_prob
    print(f"{diff:<8} {old_prob:<15.3f} {new_prob:<15.3f} {change:+.3f}")

# Test with layup (62% base rate)
base_rate = 0.62
print("\n" + "=" * 60)
print("Layup (62% base rate)")
print("=" * 60)

print(f"\n{'Diff':<8} {'Old Formula':<15} {'New Formula':<15} {'Change':<10}")
print("-" * 60)
for diff in test_diffs:
    old_prob = old_weighted_sigmoid(base_rate, diff)
    new_prob = new_centered_sigmoid(base_rate, diff)
    change = new_prob - old_prob
    print(f"{diff:<8} {old_prob:<15.3f} {new_prob:<15.3f} {change:+.3f}")

# Test with dunk (80% base rate)
base_rate = 0.80
print("\n" + "=" * 60)
print("Dunk (80% base rate)")
print("=" * 60)

print(f"\n{'Diff':<8} {'Old Formula':<15} {'New Formula':<15} {'Change':<10}")
print("-" * 60)
for diff in test_diffs:
    old_prob = old_weighted_sigmoid(base_rate, diff)
    new_prob = new_centered_sigmoid(base_rate, diff)
    change = new_prob - old_prob
    print(f"{diff:<8} {old_prob:<15.3f} {new_prob:<15.3f} {change:+.3f}")
