"""
Complete audit of how stats are aggregated vs actual points.
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

print("Auditing stats aggregation...")
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

# Manually track stats
home_points = 0
home_fgm = 0
home_3pm = 0
home_ftm = 0

away_points = 0
away_fgm = 0
away_3pm = 0
away_ftm = 0

# Process all possessions
for qr in simulator.quarter_results:
    for poss in qr.possession_results:
        # Determine team
        if poss.offensive_team == 'home':
            points_ref = 'home'
        else:
            points_ref = 'away'

        # Add points
        if points_ref == 'home':
            home_points += poss.points_scored
        else:
            away_points += poss.points_scored

        # Check for FGM
        is_and_one = poss.foul_event and poss.foul_event.and_one if poss.foul_event else False
        is_made_shot = poss.possession_outcome == 'made_shot'

        if is_and_one or is_made_shot:
            shot_type = poss.debug.get('shot_type')
            is_3pt = (shot_type == '3pt')

            if points_ref == 'home':
                home_fgm += 1
                if is_3pt:
                    home_3pm += 1
            else:
                away_fgm += 1
                if is_3pt:
                    away_3pm += 1

        # Check for FTM
        if poss.free_throw_result:
            ft_made = poss.free_throw_result.made
            if points_ref == 'home':
                home_ftm += ft_made
            else:
                away_ftm += ft_made

print(f"\nManual count (from possessions):")
print(f"  {team1['name']}: {home_points} pts, {home_fgm} FGM, {home_3pm} 3PM, {home_ftm} FTM")
home_calc = (home_fgm - home_3pm) * 2 + home_3pm * 3 + home_ftm
print(f"    Calculated from stats: {home_calc}")

print(f"  {team2['name']}: {away_points} pts, {away_fgm} FGM, {away_3pm} 3PM, {away_ftm} FTM")
away_calc = (away_fgm - away_3pm) * 2 + away_3pm * 3 + away_ftm
print(f"    Calculated from stats: {away_calc}")

print(f"\nReported game result:")
print(f"  {team1['name']}: {result.home_score}")
print(f"  {team2['name']}: {result.away_score}")

print(f"\nReported stats:")
home_stats = result.game_statistics['home_stats']
away_stats = result.game_statistics['away_stats']
print(f"  {team1['name']}: {home_stats['points']} pts, {home_stats['fgm']} FGM, {home_stats['fg3m']} 3PM, {home_stats['ftm']} FTM")
print(f"  {team2['name']}: {away_stats['points']} pts, {away_stats['fgm']} FGM, {away_stats['fg3m']} 3PM, {away_stats['ftm']} FTM")

print("\n" + "=" * 80)
