"""
Generate Play-by-Play for User Review

Simulates one game between two specialized teams with full play-by-play output.
Uses the built-in play_by_play_text from GameResult.

Writes output to: output/REVIEW_GAME_PROPER.txt
"""

import json
import sys
import os
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))

from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

# Load teams
with open('teams/review/team_specialists_a.json', 'r') as f:
    team_a = json.load(f)

with open('teams/review/team_specialists_b.json', 'r') as f:
    team_b = json.load(f)

# Tactical settings (standard)
tactics = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    scoring_option_1=None,
    scoring_option_2=None,
    scoring_option_3=None,
    minutes_allotment={},
    rebounding_strategy='standard'
)

print("=" * 100)
print("BASKETBALL SIMULATOR - GENERATING REVIEW GAME")
print("=" * 100)
print()
print(f"HOME: {team_a['team_name']}")
print(f"AWAY: {team_b['team_name']}")
print()
print("Simulating game...")

# Run simulation
game_sim = GameSimulator(
    home_roster=team_a['players'],
    away_roster=team_b['players'],
    tactical_home=tactics,
    tactical_away=tactics,
    home_team_name=team_a['team_name'],
    away_team_name=team_b['team_name']
)

result = game_sim.simulate_game(seed=1003)

print(f"Game complete: {team_a['team_name']} {result.home_score} - {team_b['team_name']} {result.away_score}")
print()

# Write the built-in play-by-play text to file
output_file = Path('output/REVIEW_GAME_PROPER.txt')
output_file.parent.mkdir(exist_ok=True)

with open(output_file, 'w', encoding='utf-8') as f:
    f.write(result.play_by_play_text)

print(f"Review game written to: {output_file}")
print(f"Final Score: {team_a['team_name']} {result.home_score} - {team_b['team_name']} {result.away_score}")
print()
print("=" * 100)
