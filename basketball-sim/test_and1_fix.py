"""
Quick test to verify And-1 scoring fix.
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

print("Testing And-1 scoring fix...")
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

# Count And-1s in play-by-play
and1_count = result.play_by_play_text.count('And-1!')

print(f"\nAnd-1 situations in game: {and1_count}")
print(f"Final Score: {team1['name']} {result.home_score}, {team2['name']} {result.away_score}")

# Verify score consistency
home_stats = result.game_statistics['home_stats']
away_stats = result.game_statistics['away_stats']

# Calculate expected points from FG and FT
home_fg_points = (home_stats['fgm'] - home_stats['fg3m']) * 2 + home_stats['fg3m'] * 3
home_ft_points = home_stats['ftm']
home_calculated = home_fg_points + home_ft_points

away_fg_points = (away_stats['fgm'] - away_stats['fg3m']) * 2 + away_stats['fg3m'] * 3
away_ft_points = away_stats['ftm']
away_calculated = away_fg_points + away_ft_points

print(f"\n{team1['name']}:")
print(f"  Reported points: {result.home_score}")
print(f"  Stats points: {home_stats['points']}")
print(f"  Calculated (FG+FT): {home_calculated}")
print(f"  FGM: {home_stats['fgm']}, 3PM: {home_stats['fg3m']}, FTM: {home_stats['ftm']}")
print(f"  Match: {'YES' if result.home_score == home_stats['points'] == home_calculated else 'NO'}")

print(f"\n{team2['name']}:")
print(f"  Reported points: {result.away_score}")
print(f"  Stats points: {away_stats['points']}")
print(f"  Calculated (FG+FT): {away_calculated}")
print(f"  FGM: {away_stats['fgm']}, 3PM: {away_stats['fg3m']}, FTM: {away_stats['ftm']}")
print(f"  Match: {'YES' if result.away_score == away_stats['points'] == away_calculated else 'NO'}")

if result.home_score == home_calculated and result.away_score == away_calculated:
    print("\n[PASS] And-1 scoring fix VERIFIED - all points reconcile correctly!")
else:
    print("\n[FAIL] PROBLEM - points don't reconcile. And-1 fix may not be complete.")

print("=" * 80)
