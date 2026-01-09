"""
Test to verify FGM attribution is correct after BUG FIX v14.
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

print("Testing FGM attribution after BUG FIX v14...")
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

# Get box score stats
home_stats = result.game_statistics['home_stats']
away_stats = result.game_statistics['away_stats']

# Debug: print structure
print(f"\nDEBUG: home_stats keys: {list(home_stats.keys())[:5]}")
print(f"DEBUG: First player structure: {list(home_stats.items())[0] if home_stats.items() else 'None'}")

print(f"\n{team1['name']} - Point Reconciliation:")
print("=" * 80)
print(f"{'Player':<20} {'Actual':<8} {'FGM':<6} {'3PM':<6} {'FTM':<6} {'Calc':<8} {'Match'}")
print("-" * 80)

home_mismatches = 0
for player_name, stats in home_stats.items():
    # Skip non-player entries (team totals)
    if not isinstance(stats, dict):
        continue

    pts = stats['points']
    fgm = stats['fgm']
    fg3m = stats['fg3m']
    ftm = stats['ftm']

    # Calculate expected: (FGM - 3PM) * 2 + 3PM * 3 + FTM
    calculated = (fgm - fg3m) * 2 + fg3m * 3 + ftm

    match = 'YES' if pts == calculated else f'NO (off by {calculated - pts:+d})'
    if pts != calculated:
        home_mismatches += 1

    print(f"{player_name:<20} {pts:<8} {fgm:<6} {fg3m:<6} {ftm:<6} {calculated:<8} {match}")

print("\n" + "=" * 80)
print(f"{team2['name']} - Point Reconciliation:")
print("=" * 80)
print(f"{'Player':<20} {'Actual':<8} {'FGM':<6} {'3PM':<6} {'FTM':<6} {'Calc':<8} {'Match'}")
print("-" * 80)

away_mismatches = 0
for player_name, stats in away_stats.items():
    # Skip non-player entries (team totals)
    if not isinstance(stats, dict):
        continue

    pts = stats['points']
    fgm = stats['fgm']
    fg3m = stats['fg3m']
    ftm = stats['ftm']

    # Calculate expected: (FGM - 3PM) * 2 + 3PM * 3 + FTM
    calculated = (fgm - fg3m) * 2 + fg3m * 3 + ftm

    match = 'YES' if pts == calculated else f'NO (off by {calculated - pts:+d})'
    if pts != calculated:
        away_mismatches += 1

    print(f"{player_name:<20} {pts:<8} {fgm:<6} {fg3m:<6} {ftm:<6} {calculated:<8} {match}")

print("\n" + "=" * 80)
total_mismatches = home_mismatches + away_mismatches
if total_mismatches == 0:
    print("\n[PASS] All players reconcile correctly!")
else:
    print(f"\n[FAIL] {total_mismatches} players still have discrepancies")
    print(f"  Home: {home_mismatches}, Away: {away_mismatches}")
print("=" * 80)
