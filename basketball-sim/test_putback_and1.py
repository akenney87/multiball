"""
Test to find And-1 putback scenarios that might be causing point discrepancy.
"""

import json
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

# Load two teams
with open('teams/team_001.json', 'r') as f:
    team1 = json.load(f)
with open('teams/team_050.json', 'r') as f:
    team2 = json.load(f)

tactics = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    scoring_option_1=None,
    scoring_option_2=None,
    scoring_option_3=None,
    rebounding_strategy='standard'
)

print("Searching for And-1 putback scenarios...")
print("=" * 80)

simulator = GameSimulator(
    home_roster=team1['roster'],
    away_roster=team2['roster'],
    tactical_home=tactics,
    tactical_away=tactics,
    home_team_name=team1['name'],
    away_team_name=team2['name']
)

result = simulator.simulate_game(seed=9999)

# Search for And-1 followed by putback in play-by-play
pbp_lines = result.play_by_play_text.split('\n')
and1_putback_found = False

for i, line in enumerate(pbp_lines):
    if 'And-1!' in line:
        # Check next few lines for "putback"
        context = '\n'.join(pbp_lines[max(0, i):min(len(pbp_lines), i+5)])
        if 'putback' in context.lower():
            print(f"FOUND And-1 + Putback scenario at line {i}:")
            print(context)
            print("-" * 80)
            and1_putback_found = True

if not and1_putback_found:
    print("No And-1 + putback scenarios found in this game.")
    print("\nSearching for any putback after free throw miss...")

    for i, line in enumerate(pbp_lines):
        if 'free throw' in line.lower() and 'miss' in line.lower():
            # Check next few lines for "putback"
            context = '\n'.join(pbp_lines[max(0, i):min(len(pbp_lines), i+5)])
            if 'putback' in context.lower():
                print(f"\nFound FT miss + putback at line {i}:")
                print(context)
                print("-" * 80)
                break

print("\n" + "=" * 80)
