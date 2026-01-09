"""Test FT composites of random teams."""
import json

# FT weights
FT_WEIGHTS = {
    'form_technique': 0.25,
    'throw_accuracy': 0.20,
    'finesse': 0.15,
    'hand_eye_coordination': 0.12,
    'balance': 0.10,
    'composure': 0.08,
    'consistency': 0.06,
    'agility': 0.04,
}

def calculate_composite(player, weights):
    """Calculate weighted composite."""
    total = sum(player.get(attr, 50) * weight for attr, weight in weights.items())
    return total

# Load a few random teams
print('='*70)
print('RANDOM TEAM FT COMPOSITE ANALYSIS')
print('='*70)
print()

all_composites = []

for team_num in [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]:
    with open(f'teams/Team_{team_num:03d}.json', 'r') as f:
        team = json.load(f)

    team_composites = []
    for player in team['roster']:
        ft_comp = calculate_composite(player, FT_WEIGHTS)
        team_composites.append(ft_comp)
        all_composites.append(ft_comp)

    avg_comp = sum(team_composites) / len(team_composites)
    min_comp = min(team_composites)
    max_comp = max(team_composites)

    print(f'Team_{team_num:03d}: Avg={avg_comp:.1f}, Min={min_comp:.1f}, Max={max_comp:.1f}')

print()
print('OVERALL STATS:')
overall_avg = sum(all_composites) / len(all_composites)
overall_min = min(all_composites)
overall_max = max(all_composites)
print(f'  Average composite: {overall_avg:.1f}')
print(f'  Min: {overall_min:.1f}')
print(f'  Max: {overall_max:.1f}')
print()

# Calculate expected FT% for this average
import math

def sigmoid(x):
    return 1.0 / (1.0 + math.exp(-x))

base_rate = 0.40
k = 0.02
composite_diff = overall_avg - 50.0
sigmoid_input = k * composite_diff
sigmoid_output = sigmoid(sigmoid_input)
attribute_bonus = (1.0 - base_rate) * sigmoid_output
expected_ft_pct = base_rate + attribute_bonus

print(f'Expected FT% for average composite {overall_avg:.1f}:')
print(f'  Formula: 0.40 + 0.60 * sigmoid(0.02 * ({overall_avg:.1f} - 50))')
print(f'  = 0.40 + 0.60 * sigmoid({sigmoid_input:.4f})')
print(f'  = 0.40 + 0.60 * {sigmoid_output:.4f}')
print(f'  = {expected_ft_pct:.3f} = {expected_ft_pct*100:.1f}%')
print()

print('COMPARISON TO VALIDATION:')
print(f'  Phase 2 (low fouls): 66.7% FT')
print(f'  Phase 3 (high fouls): 56.8% FT')
print(f'  Expected (formula): {expected_ft_pct*100:.1f}% FT')
print()

if abs(expected_ft_pct*100 - 56.8) < 5:
    print('CONCLUSION: FT% matches expected value for random team attributes.')
    print('The drop is due to teams having lower-than-NBA attributes.')
else:
    print('CONCLUSION: FT% does NOT match expected. Further investigation needed.')
