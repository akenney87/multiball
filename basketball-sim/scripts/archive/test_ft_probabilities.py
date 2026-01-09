"""
Test FT probability calculation directly
"""
import json
import math

def sigmoid(x):
    return 1.0 / (1.0 + math.exp(-x))

def calculate_composite(player, weights):
    total = sum(player.get(attr, 50) * weight for attr, weight in weights.items())
    return total

FREE_THROW_WEIGHTS = {
    'form_technique': 0.25,
    'throw_accuracy': 0.20,
    'finesse': 0.15,
    'hand_eye_coordination': 0.12,
    'balance': 0.10,
    'composure': 0.08,
    'consistency': 0.06,
    'agility': 0.04,
}

FREE_THROW_BASE_RATE = 0.40
FREE_THROW_K = 0.02

def calc_ft_prob(player):
    """Calculate FT probability - matches free_throws.py implementation"""
    ft_composite = calculate_composite(player, FREE_THROW_WEIGHTS)

    composite_diff = ft_composite - 50.0
    sigmoid_input = FREE_THROW_K * composite_diff
    sigmoid_output = sigmoid(sigmoid_input)

    attribute_bonus = (1.0 - FREE_THROW_BASE_RATE) * sigmoid_output

    probability = FREE_THROW_BASE_RATE + attribute_bonus + 0.0  # normal situation

    return probability, ft_composite

# Load Team_042 (high-rated)
with open('teams/Team_042.json', 'r') as f:
    team = json.load(f)

print("="*70)
print("TESTING FT PROBABILITY CALCULATION")
print("="*70)
print()

for player in team['roster']:
    prob, composite = calc_ft_prob(player)
    print(f"{player['name']:<20} Composite: {composite:5.1f}  Probability: {prob*100:5.1f}%")

print()
print("These probabilities should match what free_throws.py calculates.")
print("If actual game FT% is much lower, there's a bug in the execution logic.")
