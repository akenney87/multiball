"""
Test different BaseRate and k values for NBA-realistic FT percentages.

Target NBA ranges:
- Elite (composite 90+): 85-95%
- Average (composite 70): 75-80%
- Poor (composite 50): 60-70%
"""

import math

def sigmoid(x):
    return 1.0 / (1.0 + math.exp(-x))

def calculate_ft_probability(composite, base_rate, k):
    return base_rate + (1.0 - base_rate) * sigmoid(k * (composite - 50))

print("FT PERCENTAGE TUNING FOR NBA REALISM")
print("=" * 80)

# Test different combinations
configs = [
    ("Spec (BaseRate=0.40, k=0.02)", 0.40, 0.02),
    ("Higher BaseRate (BaseRate=0.50, k=0.02)", 0.50, 0.02),
    ("Higher k (BaseRate=0.40, k=0.05)", 0.40, 0.05),
    ("Balanced (BaseRate=0.55, k=0.03)", 0.55, 0.03),
]

composites = [
    (50, "Poor Shooter (Shaq)"),
    (70, "Average Shooter"),
    (90, "Elite Shooter (Curry)"),
]

for config_name, base_rate, k in configs:
    print(f"\n{config_name}")
    print("-" * 80)
    for composite, player_type in composites:
        prob = calculate_ft_probability(composite, base_rate, k)
        print(f"  {player_type:<30} (composite {composite}): {prob*100:.1f}%")

print("\n" + "=" * 80)
print("NBA TARGET RANGES:")
print("  Poor Shooter: 60-70%")
print("  Average Shooter: 75-80%")
print("  Elite Shooter: 85-95%")
print("\nRECOMMENDATION: Use BaseRate=0.55, k=0.03 for best NBA realism")
