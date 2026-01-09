"""
Find possessions where FGM is counted but no points were scored.
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

print("Searching for possessions where FGM counted but no points scored...")
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

# Check all possessions
issues = []
for qr in simulator.quarter_results:
    for poss in qr.possession_results:
        # Check if this would be counted as FGM
        is_and_one = poss.foul_event and poss.foul_event.and_one if poss.foul_event else False
        is_made_shot = poss.possession_outcome == 'made_shot'

        would_count_as_fgm = is_and_one or is_made_shot

        if would_count_as_fgm and poss.points_scored == 0:
            issues.append({
                'shooter': poss.scoring_player or poss.debug.get('shooter'),
                'outcome': poss.possession_outcome,
                'is_and_one': is_and_one,
                'points': poss.points_scored,
                'shot_type': poss.debug.get('shot_type'),
                'pbp': poss.play_by_play_text[:200]
            })

print(f"\nFound {len(issues)} possessions where FGM counted but no points scored:\n")
for i, issue in enumerate(issues, 1):
    print(f"{i}. {issue['shooter']} - {issue['shot_type']}")
    print(f"   Outcome: {issue['outcome']}, And-1: {issue['is_and_one']}, Points: {issue['points']}")
    print(f"   PBP: {issue['pbp']}")
    print()

if not issues:
    print("No such possessions found. All FGM resulted in points.")

print("=" * 80)
