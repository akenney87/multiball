"""
Trace And-1 points through the system to find where they're getting lost.
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

print("Tracing And-1 points...")
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

# Parse play-by-play to manually count And-1 points
pbp_lines = result.play_by_play_text.split('\n')

# Track And-1 events
and1_team1_points = 0
and1_team2_points = 0
and1_team1_baskets = 0
and1_team2_baskets = 0
and1_team1_fts = 0
and1_team2_fts = 0

for line in pbp_lines:
    if 'And-1!' in line:
        # Extract shot type to determine basket points
        if '3Pt' in line:
            basket_pts = 3
        elif 'Dunk' in line or 'Layup' in line:
            basket_pts = 2
        else:  # Midrange
            basket_pts = 2

        # Determine which team
        # The line format is "Player makes the Shot... "
        # We need to check the next line for FT result
        idx = pbp_lines.index(line)
        ft_line = line if 'FT' in line else (pbp_lines[idx+1] if idx+1 < len(pbp_lines) else "")

        # Count FT makes (GOOD vs MISS)
        ft_pts = ft_line.count('GOOD') if 'FT' in ft_line else 0

        # Determine team (rough heuristic: check if Team_001 players are mentioned)
        # This is approximate - for a real test we'd need to parse better
        is_team1 = any(p['name'] in line for p in team1['roster'])

        if is_team1:
            and1_team1_baskets += 1
            and1_team1_points += basket_pts + ft_pts
            and1_team1_fts += ft_pts
        else:
            and1_team2_baskets += 1
            and1_team2_points += basket_pts + ft_pts
            and1_team2_fts += ft_pts

print(f"\nAnd-1 Analysis (from play-by-play):")
print(f"{team1['name']}: {and1_team1_baskets} And-1 baskets, {and1_team1_fts} FTs made, Total: {and1_team1_points} pts")
print(f"{team2['name']}: {and1_team2_baskets} And-1 baskets, {and1_team2_fts} FTs made, Total: {and1_team2_points} pts")

print("\n" + "=" * 80)
print("STATS COMPARISON")
print("=" * 80)

home_stats = result.game_statistics['home_stats']
away_stats = result.game_statistics['away_stats']

print(f"\n{team1['name']}:")
print(f"  Total points (reported): {result.home_score}")
print(f"  Total points (stats): {home_stats['points']}")
print(f"  FGM: {home_stats['fgm']} (24 2PM + {home_stats['fg3m']} 3PM)")
print(f"  FTM: {home_stats['ftm']}")
print(f"  And-1 baskets: {and1_team1_baskets}")
print(f"  And-1 FTs: {and1_team1_fts}")
print(f"  And-1 total points: {and1_team1_points}")

non_and1_fgm = home_stats['fgm'] - and1_team1_baskets
non_and1_ftm = home_stats['ftm'] - and1_team1_fts
print(f"\n  Non-And-1 FGM: {non_and1_fgm}")
print(f"  Non-And-1 FTM: {non_and1_ftm}")
print(f"  Non-And-1 FG points: {(non_and1_fgm - home_stats['fg3m']) * 2 + home_stats['fg3m'] * 3}")
print(f"  Non-And-1 FT points: {non_and1_ftm}")
print(f"  Expected total: {(non_and1_fgm - home_stats['fg3m']) * 2 + home_stats['fg3m'] * 3 + non_and1_ftm + and1_team1_points}")

print(f"\n{team2['name']}:")
print(f"  Total points (reported): {result.away_score}")
print(f"  Total points (stats): {away_stats['points']}")
print(f"  FGM: {away_stats['fgm']} ({away_stats['fgm'] - away_stats['fg3m']} 2PM + {away_stats['fg3m']} 3PM)")
print(f"  FTM: {away_stats['ftm']}")
print(f"  And-1 baskets: {and1_team2_baskets}")
print(f"  And-1 FTs: {and1_team2_fts}")
print(f"  And-1 total points: {and1_team2_points}")

print("\n" + "=" * 80)
