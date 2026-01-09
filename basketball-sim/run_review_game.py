"""
Run Review Game - Using Existing Play-by-Play System
"""

import json
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

# Load teams
with open('teams/review/team_specialists_a.json', 'r') as f:
    team_a = json.load(f)

with open('teams/review/team_specialists_b.json', 'r') as f:
    team_b = json.load(f)

# Tactical settings with scoring options
tactics_alpha = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    scoring_option_1='Chris Maestro',    # Option #1 (30%)
    scoring_option_2='Ray Sniper',       # Option #2 (20%)
    scoring_option_3='Marcus Slasher',   # Option #3 (15%)
    minutes_allotment={},
    rebounding_strategy='standard'
)

tactics_beta = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    scoring_option_1='Steve Facilitator',  # Option #1 (30%)
    scoring_option_2='Reggie Shooter',     # Option #2 (20%)
    scoring_option_3='Dwyane Slasher',     # Option #3 (15%)
    minutes_allotment={},
    rebounding_strategy='standard'
)

print("Running game simulation with specialized players...")
print()
print("TEAM ALPHA SCORING OPTIONS:")
print(f"  Option #1 (30%): {tactics_alpha.scoring_option_1}")
print(f"  Option #2 (20%): {tactics_alpha.scoring_option_2}")
print(f"  Option #3 (15%): {tactics_alpha.scoring_option_3}")
print()
print("TEAM BETA SCORING OPTIONS:")
print(f"  Option #1 (30%): {tactics_beta.scoring_option_1}")
print(f"  Option #2 (20%): {tactics_beta.scoring_option_2}")
print(f"  Option #3 (15%): {tactics_beta.scoring_option_3}")
print()

# Run simulation
game_sim = GameSimulator(
    home_roster=team_a['players'],
    away_roster=team_b['players'],
    tactical_home=tactics_alpha,
    tactical_away=tactics_beta,
    home_team_name=team_a['team_name'],
    away_team_name=team_b['team_name']
)

result = game_sim.simulate_game(seed=None)  # Random seed for each run

# Write the existing play_by_play_text to file with UTF-8 encoding
with open('output/REVIEW_GAME_PROPER.txt', 'w', encoding='utf-8') as f:
    f.write(result.play_by_play_text)

print("Play-by-play written to output/REVIEW_GAME_PROPER.txt")
