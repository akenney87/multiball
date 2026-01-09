"""
Calculate total gameplay weights for all 25 attributes across all game actions.

This script tallies up how much each attribute is used across all the different
game mechanics (shooting, rebounding, turnovers, etc.) as defined in Section 14.2
of basketball_sim.md.

This will be used to fix the team rating calculation in generate_teams.py.
"""

# From Section 14.2: All Attribute Weight Tables

# 3-Point Shooting (weight in shot selection: ~40% of attempts)
three_pt_weights = {
    'form_technique': 0.25,
    'throw_accuracy': 0.20,
    'finesse': 0.15,
    'hand_eye_coordination': 0.12,
    'balance': 0.10,
    'composure': 0.08,
    'consistency': 0.06,
    'agility': 0.04
}

# Midrange Shooting (weight in shot selection: ~20% of attempts)
midrange_weights = {
    'form_technique': 0.23,
    'throw_accuracy': 0.18,
    'finesse': 0.20,
    'hand_eye_coordination': 0.13,
    'balance': 0.11,
    'composure': 0.08,
    'consistency': 0.05,
    'agility': 0.02
}

# Dunking (weight in rim attempts: ~15-20% of possessions)
dunk_weights = {
    'jumping': 0.40,
    'height': 0.30,
    'arm_strength': 0.20,
    'agility': 0.10
}

# Layups (weight in rim attempts: ~20-25% of possessions)
layup_weights = {
    'finesse': 0.35,
    'hand_eye_coordination': 0.30,
    'balance': 0.20,
    'jumping': 0.15
}

# Rebounding (occurs on all missed shots: ~45% of possessions)
rebounding_weights = {
    'height': 0.25,
    'jumping': 0.20,
    'core_strength': 0.15,
    'awareness': 0.20,
    'reactions': 0.10,
    'determination': 0.10
}

# Contest Defense (occurs on nearly all shots)
contest_weights = {
    'height': 0.3333,
    'reactions': 0.3333,
    'agility': 0.3334  # rounding
}

# Turnover Prevention (occurs on ~15% of possessions)
turnover_weights = {
    'awareness': 0.40,
    'composure': 0.30,
    'consistency': 0.20,
    'hand_eye_coordination': 0.10
}

# Drive Outcomes - Kick-out path (affects assists/extra passing)
kickout_weights = {
    'teamwork': 0.40,
    'awareness': 0.35,
    'composure': 0.25
}

# Free Throws (occurs on ~25% of possessions due to fouls)
# Using similar weights to shooting
free_throw_weights = {
    'form_technique': 0.28,
    'throw_accuracy': 0.25,
    'composure': 0.18,
    'consistency': 0.15,
    'hand_eye_coordination': 0.10,
    'balance': 0.04
}

# Calculate occurrence frequency for each system
# These are rough estimates of how often each system is invoked per game
SYSTEM_FREQUENCIES = {
    'three_pt_shooting': 0.25,      # ~40% of shots, 60% FG attempts per game
    'midrange_shooting': 0.12,      # ~20% of shots
    'dunking': 0.10,                # ~17% of shots
    'layup': 0.13,                  # ~22% of shots
    'rebounding': 0.25,             # Every missed shot (~45% miss rate)
    'contest_defense': 0.50,        # Nearly every shot gets contested
    'turnover_prevention': 0.15,    # ~15 turnovers per 100 possessions
    'kickout': 0.08,                # Assists on ~25% of made baskets
    'free_throw': 0.20,             # ~20-25 FT attempts per game
}

# Initialize total weights
total_weights = {}
ALL_ATTRIBUTES = [
    # Physical
    'grip_strength', 'arm_strength', 'core_strength', 'agility',
    'acceleration', 'top_speed', 'jumping', 'reactions',
    'stamina', 'balance', 'height', 'durability',
    # Mental
    'awareness', 'creativity', 'determination', 'bravery',
    'consistency', 'composure', 'patience',
    # Technical
    'hand_eye_coordination', 'throw_accuracy', 'form_technique',
    'finesse', 'deception', 'teamwork'
]

for attr in ALL_ATTRIBUTES:
    total_weights[attr] = 0.0

# Accumulate weights
weight_tables = [
    (three_pt_weights, SYSTEM_FREQUENCIES['three_pt_shooting']),
    (midrange_weights, SYSTEM_FREQUENCIES['midrange_shooting']),
    (dunk_weights, SYSTEM_FREQUENCIES['dunking']),
    (layup_weights, SYSTEM_FREQUENCIES['layup']),
    (rebounding_weights, SYSTEM_FREQUENCIES['rebounding']),
    (contest_weights, SYSTEM_FREQUENCIES['contest_defense']),
    (turnover_weights, SYSTEM_FREQUENCIES['turnover_prevention']),
    (kickout_weights, SYSTEM_FREQUENCIES['kickout']),
    (free_throw_weights, SYSTEM_FREQUENCIES['free_throw'])
]

for weight_table, frequency in weight_tables:
    for attr, weight in weight_table.items():
        total_weights[attr] += weight * frequency

# Normalize to sum to 1.0
total_sum = sum(total_weights.values())
for attr in total_weights:
    total_weights[attr] /= total_sum

# Sort by weight descending
sorted_weights = sorted(total_weights.items(), key=lambda x: x[1], reverse=True)

print("=" * 80)
print("TOTAL ATTRIBUTE GAMEPLAY WEIGHTS")
print("=" * 80)
print()
print("These weights represent how much each attribute affects overall gameplay,")
print("accounting for both its importance in specific actions AND how often those")
print("actions occur in a typical game.")
print()
print("-" * 80)

# Group by tier
print("\nTOP TIER (>8%):")
for attr, weight in sorted_weights:
    if weight > 0.08:
        print(f"  {attr:25s}: {weight:6.2%}  ({weight:.4f})")

print("\nHIGH TIER (5-8%):")
for attr, weight in sorted_weights:
    if 0.05 <= weight <= 0.08:
        print(f"  {attr:25s}: {weight:6.2%}  ({weight:.4f})")

print("\nMEDIUM TIER (2-5%):")
for attr, weight in sorted_weights:
    if 0.02 <= weight < 0.05:
        print(f"  {attr:25s}: {weight:6.2%}  ({weight:.4f})")

print("\nLOW TIER (<2%):")
for attr, weight in sorted_weights:
    if weight < 0.02:
        print(f"  {attr:25s}: {weight:6.2%}  ({weight:.4f})")

print()
print("=" * 80)
print("PYTHON DICT FOR generate_teams.py")
print("=" * 80)
print()
print("ATTRIBUTE_GAMEPLAY_WEIGHTS = {")
for attr, weight in sorted_weights:
    print(f"    '{attr}': {weight:.4f},")
print("}")
print()

# Verification
print("=" * 80)
print("VERIFICATION")
print("=" * 80)
print(f"Sum of all weights: {sum(total_weights.values()):.6f}")
print(f"Number of attributes with weight > 0: {sum(1 for w in total_weights.values() if w > 0)}")
print(f"Number of attributes with weight = 0: {sum(1 for w in total_weights.values() if w == 0)}")
print()
