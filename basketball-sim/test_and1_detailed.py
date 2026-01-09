"""
Detailed And-1 debugging - check play-by-play parsing.
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

print("Detailed And-1 analysis...")
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

# Parse play-by-play to find And-1s and track their points
pbp_lines = result.play_by_play_text.split('\n')
and1_events = []

for i, line in enumerate(pbp_lines):
    if 'And-1!' in line:
        # Extract player name and shot type
        # Format: "Player makes the ShotType and draws the foul on Defender! And-1! ..."
        parts = line.split(' makes the ')
        if len(parts) >= 2:
            player = parts[0].strip()
            shot_type = parts[1].split(' and draws')[0].strip()

            # Look ahead for FT result
            ft_line = pbp_lines[i] if 'FT' in pbp_lines[i] else pbp_lines[i+1] if i+1 < len(pbp_lines) else ""

            and1_events.append({
                'player': player,
                'shot_type': shot_type,
                'ft_line': ft_line
            })

print(f"\nFound {len(and1_events)} And-1 events:\n")
for i, event in enumerate(and1_events, 1):
    print(f"{i}. {event['player']} - {event['shot_type']}")
    print(f"   FT: {event['ft_line'][:100]}")

print("\n" + "=" * 80)
print("STATS VERIFICATION")
print("=" * 80)

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
print(f"  FG breakdown: {home_stats['fgm']} makes ({home_stats['fgm'] - home_stats['fg3m']} 2PM + {home_stats['fg3m']} 3PM)")
print(f"  FG points: {home_fg_points} (2PT:{(home_stats['fgm'] - home_stats['fg3m']) * 2} + 3PT:{home_stats['fg3m'] * 3})")
print(f"  FT points: {home_ft_points} ({home_stats['ftm']}/{home_stats['fta']})")
print(f"  Calculated total: {home_calculated}")
print(f"  Difference: {home_calculated - result.home_score}")

print(f"\n{team2['name']}:")
print(f"  Reported points: {result.away_score}")
print(f"  Stats points: {away_stats['points']}")
print(f"  FG breakdown: {away_stats['fgm']} makes ({away_stats['fgm'] - away_stats['fg3m']} 2PM + {away_stats['fg3m']} 3PM)")
print(f"  FG points: {away_fg_points} (2PT:{(away_stats['fgm'] - away_stats['fg3m']) * 2} + 3PT:{away_stats['fg3m'] * 3})")
print(f"  FT points: {away_ft_points} ({away_stats['ftm']}/{away_stats['fta']})")
print(f"  Calculated total: {away_calculated}")
print(f"  Difference: {away_calculated - result.away_score}")

print("\n" + "=" * 80)
