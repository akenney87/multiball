"""
Randomize stamina attributes across a wider range to prevent mass substitutions
"""
import json
import random

# Set seed for reproducibility (but different from game seed)
random.seed(99999)

# Load both teams
with open('teams/review/team_specialists_a.json', 'r') as f:
    team_a = json.load(f)

with open('teams/review/team_specialists_b.json', 'r') as f:
    team_b = json.load(f)

# Randomize stamina for Team Alpha
print("Team Alpha stamina changes:")
for player in team_a['players']:
    old_stamina = player['stamina']
    # Random stamina between 1 and 99
    new_stamina = random.randint(1, 99)
    player['stamina'] = new_stamina
    print(f"  {player['name']:20s}: {old_stamina} -> {new_stamina}")

print()

# Randomize stamina for Team Beta
print("Team Beta stamina changes:")
for player in team_b['players']:
    old_stamina = player['stamina']
    # Random stamina between 1 and 99
    new_stamina = random.randint(1, 99)
    player['stamina'] = new_stamina
    print(f"  {player['name']:20s}: {old_stamina} -> {new_stamina}")

# Write back
with open('teams/review/team_specialists_a.json', 'w') as f:
    json.dump(team_a, f, indent=2)

with open('teams/review/team_specialists_b.json', 'w') as f:
    json.dump(team_b, f, indent=2)

print("\nStamina values randomized successfully!")
