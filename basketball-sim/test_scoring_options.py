"""
Test Scoring Options Usage Distribution

Verifies that scoring_option_1/2/3 properly influence shooter selection.
"""

import json
import sys
import os
from collections import Counter

sys.path.insert(0, os.path.dirname(__file__))

from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

# Load teams
with open('teams/review/team_specialists_a.json', 'r') as f:
    team_a = json.load(f)

with open('teams/review/team_specialists_b.json', 'r') as f:
    team_b = json.load(f)

# Get player names
print("Team Alpha Players:")
for i, player in enumerate(team_a['players'][:5], 1):
    print(f"  {i}. {player['name']} ({player['position']})")

print("\nTeam Beta Players:")
for i, player in enumerate(team_b['players'][:5], 1):
    print(f"  {i}. {player['name']} ({player['position']})")

# TEST 1: No scoring options (equal distribution expected)
print("\n" + "="*80)
print("TEST 1: No Scoring Options (Expected: ~20% per player)")
print("="*80)

tactics_equal = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    scoring_option_1=None,
    scoring_option_2=None,
    scoring_option_3=None,
    minutes_allotment={},
    rebounding_strategy='standard'
)

game_sim = GameSimulator(
    home_roster=team_a['players'],
    away_roster=team_b['players'],
    tactical_home=tactics_equal,
    tactical_away=tactics_equal,
    home_team_name=team_a['team_name'],
    away_team_name=team_b['team_name']
)

result = game_sim.simulate_game(seed=42)

# Count shot attempts per player for Team Alpha
shot_attempts_alpha = Counter()
for quarter in result.quarter_results:
    for poss in quarter.possession_results:
        if poss.offensive_team == 'home':  # Team Alpha is home
            shooter = poss.debug.get('shooter')
            if shooter:
                shot_attempts_alpha[shooter] += 1

print(f"\nTeam Alpha Shot Distribution (Total: {sum(shot_attempts_alpha.values())} shots):")
for player, attempts in shot_attempts_alpha.most_common():
    pct = (attempts / sum(shot_attempts_alpha.values())) * 100
    print(f"  {player:<20} {attempts:>3} shots ({pct:>5.1f}%)")

# TEST 2: With scoring options
print("\n" + "="*80)
print("TEST 2: With Scoring Options")
print("  Option 1 (30%): Ray Sniper")
print("  Option 2 (20%): Marcus Slasher")
print("  Option 3 (15%): Dennis Boardman")
print("  Others (35%): Chris Maestro, Hassan Swatter (17.5% each)")
print("="*80)

tactics_options = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    scoring_option_1='Ray Sniper',
    scoring_option_2='Marcus Slasher',
    scoring_option_3='Dennis Boardman',
    minutes_allotment={},
    rebounding_strategy='standard'
)

game_sim = GameSimulator(
    home_roster=team_a['players'],
    away_roster=team_b['players'],
    tactical_home=tactics_options,
    tactical_away=tactics_equal,
    home_team_name=team_a['team_name'],
    away_team_name=team_b['team_name']
)

result = game_sim.simulate_game(seed=99)

# Count shot attempts per player for Team Alpha
shot_attempts_alpha = Counter()
for quarter in result.quarter_results:
    for poss in quarter.possession_results:
        if poss.offensive_team == 'home':  # Team Alpha is home
            shooter = poss.debug.get('shooter')
            if shooter:
                shot_attempts_alpha[shooter] += 1

print(f"\nTeam Alpha Shot Distribution (Total: {sum(shot_attempts_alpha.values())} shots):")
for player, attempts in shot_attempts_alpha.most_common():
    pct = (attempts / sum(shot_attempts_alpha.values())) * 100
    expected = ""
    if player == "Ray Sniper":
        expected = " [Expected: ~30%]"
    elif player == "Marcus Slasher":
        expected = " [Expected: ~20%]"
    elif player == "Dennis Boardman":
        expected = " [Expected: ~15%]"
    else:
        expected = " [Expected: ~17.5%]"
    print(f"  {player:<20} {attempts:>3} shots ({pct:>5.1f}%){expected}")

print("\n" + "="*80)
print("VERIFICATION COMPLETE")
print("="*80)
