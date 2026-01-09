"""
Generate a detailed game for manual verification.
"""

import json
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

# Load specialized teams
with open('teams/specialized/team_a.json', 'r') as f:
    team1 = json.load(f)
with open('teams/specialized/team_b.json', 'r') as f:
    team2 = json.load(f)

tactics = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    scoring_option_1=None,
    scoring_option_2=None,
    scoring_option_3=None,
    rebounding_strategy='standard'
)

tactics2 = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    scoring_option_1=None,
    scoring_option_2=None,
    scoring_option_3=None,
    rebounding_strategy='standard'
)

print("Running game simulation with specialized players...\n")

simulator = GameSimulator(
    home_roster=team1['players'],
    away_roster=team2['players'],
    tactical_home=tactics,
    tactical_away=tactics2,
    home_team_name=team1['team_name'],
    away_team_name=team2['team_name']
)

result = simulator.simulate_game(seed=9999)

# Save play-by-play
with open('output/DETAILED_GAME.txt', 'w') as f:
    f.write(result.play_by_play_text)

print("Game complete! Results saved to output/DETAILED_GAME.txt")
print(f"Final Score: {team1['name']} {result.home_score}, {team2['name']} {result.away_score}")
