"""
Quick validation test after tuning adjustments.
Tests 10 games to verify:
- 3PA increased from 30.0 → ~35.0
- Steals increased from 5.0 → ~7.5
- Blocks increased from 2.6 → ~4.0
"""

import json
import random
import sys
import os

# Add src to path
sys.path.insert(0, os.path.dirname(__file__))

from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

# Load test teams
with open('teams/team_001.json', 'r') as f:
    team1 = json.load(f)
with open('teams/team_002.json', 'r') as f:
    team2 = json.load(f)

# Default tactical settings
tactics = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    scoring_option_1=None,
    scoring_option_2=None,
    scoring_option_3=None,
    rebounding_strategy='standard'
)

# Run 10 games
total_3pa = 0
total_steals = 0
total_blocks = 0
num_games = 10

print("Testing tuning changes...")
print("=" * 60)

for i in range(num_games):
    seed = 5000 + i

    simulator = GameSimulator(
        home_roster=team1['roster'],
        away_roster=team2['roster'],
        tactical_home=tactics,
        tactical_away=tactics,
        home_team_name=team1['name'],
        away_team_name=team2['name']
    )

    result = simulator.simulate_game(seed=seed)

    # Extract stats
    home_stats = result.game_statistics['home_stats']
    away_stats = result.game_statistics['away_stats']

    game_3pa = home_stats['fg3a'] + away_stats['fg3a']
    game_steals = home_stats['stl'] + away_stats['stl']
    game_blocks = home_stats['blk'] + away_stats['blk']

    total_3pa += game_3pa
    total_steals += game_steals
    total_blocks += game_blocks

    print(f"Game {i+1}: 3PA={game_3pa}, STL={game_steals}, BLK={game_blocks}")

print("=" * 60)
print(f"AVERAGES OVER {num_games} GAMES:")
print(f"  3PA per game:    {total_3pa / num_games:.1f} (target: 35.0, was 30.0)")
print(f"  Steals per game: {total_steals / num_games:.1f} (target: 7.5, was 5.0)")
print(f"  Blocks per game: {total_blocks / num_games:.1f} (target: 4.0, was 2.6)")
print("=" * 60)
