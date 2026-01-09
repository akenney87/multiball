"""
Test the fixed sigmoid formula with realistic NBA-average player attributes.
"""
import math

def sigmoid(x):
    return 1 / (1 + math.exp(-x))

def centered_weighted_sigmoid(base_rate, attr_diff, k=0.02):
    """Current formula in probability.py"""
    sigmoid_output = sigmoid(k * attr_diff)
    centered = (sigmoid_output - 0.5) * 2.0

    if centered >= 0:
        probability = base_rate + (1.0 - base_rate) * centered
    else:
        probability = base_rate * (1.0 + centered)

    # Apply floor and ceiling
    probability = max(0.05, min(0.95, probability))
    return probability

# Simulate realistic shooting scenarios
print("=" * 80)
print("REALISTIC SHOOTING SCENARIOS (NBA-Average Players)")
print("=" * 80)

# Average shooter (composite ~60) vs average defender (composite ~60)
# For 3PT shot, typical attributes: form_technique, throw_accuracy, etc. ~50-70
# Composite would be around 55-65

# TEST 1: Equal players (diff = 0)
print("\nTEST 1: Equal Players (diff = 0)")
print("-" * 80)
for base_rate, shot_type in [(0.30, "3PT"), (0.62, "Layup"), (0.80, "Dunk")]:
    prob = centered_weighted_sigmoid(base_rate, 0)
    print(f"{shot_type:10} base {base_rate:.0%}: Equal players get {prob:.1%}")

# TEST 2: Small advantage (+5 composite difference)
print("\nTEST 2: Small Advantage (diff = +5)")
print("-" * 80)
for base_rate, shot_type in [(0.30, "3PT"), (0.62, "Layup"), (0.80, "Dunk")]:
    prob = centered_weighted_sigmoid(base_rate, 5)
    print(f"{shot_type:10} base {base_rate:.0%}: +5 advantage gets {prob:.1%}")

# TEST 3: With heavy contest penalty (-15%)
print("\nTEST 3: Equal Players + Heavy Contest (-15% penalty)")
print("-" * 80)
for base_rate, shot_type in [(0.30, "3PT"), (0.62, "Layup"), (0.80, "Dunk")]:
    prob = centered_weighted_sigmoid(base_rate, 0)
    contested_prob = prob - 0.15
    print(f"{shot_type:10} base {base_rate:.0%}: Equal + contest gets {contested_prob:.1%}")

# TEST 4: Average shooter vs good defender (diff = -10)
print("\nTEST 4: Average vs Good Defender (diff = -10)")
print("-" * 80)
for base_rate, shot_type in [(0.30, "3PT"), (0.62, "Layup"), (0.80, "Dunk")]:
    prob = centered_weighted_sigmoid(base_rate, -10)
    print(f"{shot_type:10} base {base_rate:.0%}: -10 disadvantage gets {prob:.1%}")

# TEST 5: With contest on top
print("\nTEST 5: Average vs Good Defender + Heavy Contest")
print("-" * 80)
for base_rate, shot_type in [(0.30, "3PT"), (0.62, "Layup"), (0.80, "Dunk")]:
    prob = centered_weighted_sigmoid(base_rate, -10)
    contested_prob = prob - 0.15
    print(f"{shot_type:10} base {base_rate:.0%}: diff=-10 + contest gets {contested_prob:.1%}")

# TEST 6: Check if formula centers correctly at diff=0
print("\n" + "=" * 80)
print("FORMULA VERIFICATION: Does diff=0 give base_rate?")
print("=" * 80)
for base_rate in [0.10, 0.30, 0.50, 0.70, 0.90]:
    result = centered_weighted_sigmoid(base_rate, 0)
    matches = "✓" if abs(result - base_rate) < 0.001 else "✗"
    print(f"Base {base_rate:.0%}: diff=0 gives {result:.4f} {matches}")
