"""
Check initial stamina values for all players
"""

import json
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from src.systems.stamina_manager import StaminaTracker

# Load teams
with open('teams/review/team_specialists_a.json', 'r') as f:
    team_a = json.load(f)

with open('teams/review/team_specialists_b.json', 'r') as f:
    team_b = json.load(f)

all_players = team_a['players'] + team_b['players']

# Create stamina tracker
stamina_tracker = StaminaTracker(all_players)

print("Initial Stamina Values:")
print("=" * 80)
for player in all_players:
    name = player['name']
    stamina_attr = player['stamina']
    current_stamina = stamina_tracker.get_current_stamina(name)
    print(f"{name:25s}  Attr: {stamina_attr:3d}  Initial: {current_stamina:.1f}")

print("\n" + "=" * 80)
print(f"All players start at same value: {len(set([stamina_tracker.get_current_stamina(p['name']) for p in all_players])) == 1}")
