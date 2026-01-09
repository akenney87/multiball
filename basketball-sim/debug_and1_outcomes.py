"""
Debug script to track all And-1 possessions and their outcomes.
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

print("Tracking all And-1 possession outcomes...")
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

# Collect all And-1 possessions
and1_possessions = []
for qr in simulator.quarter_results:
    for poss in qr.possession_results:
        if poss.foul_event and poss.foul_event.and_one:
            # And-1 means shot was made (by definition)
            shot_made_in_and1 = poss.foul_event.and_one

            and1_possessions.append({
                'shooter': poss.debug.get('shooter'),
                'shot_type': poss.debug.get('shot_type'),
                'shot_made': shot_made_in_and1,
                'outcome': poss.possession_outcome,
                'points_scored': poss.points_scored,
                'ft_made': poss.free_throw_result.made if poss.free_throw_result else 0,
                'ft_attempts': poss.free_throw_result.attempts if poss.free_throw_result else 0,
            })

print(f"\nFound {len(and1_possessions)} And-1 possessions:\n")
for i, poss in enumerate(and1_possessions, 1):
    print(f"{i}. {poss['shooter']} - {poss['shot_type']} shot")
    print(f"   Shot made: {poss['shot_made']}, Outcome: {poss['outcome']}, Points: {poss['points_scored']}")
    print(f"   FT: {poss['ft_made']}/{poss['ft_attempts']}")

    # Calculate expected points
    expected_points = 0
    if poss['shot_made']:
        expected_points += 3 if poss['shot_type'] == '3pt' else 2
    expected_points += poss['ft_made']

    if expected_points != poss['points_scored']:
        print(f"   MISMATCH! Expected {expected_points}, got {poss['points_scored']}")
    print()

print("=" * 80)
