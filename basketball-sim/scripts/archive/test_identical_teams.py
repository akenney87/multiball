"""
IDENTICAL TEAMS VARIANCE TEST

USER REQUEST: Test 2 teams with IDENTICAL player attributes (different names only)
Play 10 games between them to measure baseline variance.

Expected Results:
- Win rate should be ~50% (each team wins ~5 games)
- Margins should be small (average ±5 points)
- No systematic advantage for either team

If Results Differ:
- Reveals excessive "pure randomness" in the system
- Indicates game mechanics aren't properly deterministic given equal inputs
"""

import sys
import os
import random

sys.path.insert(0, os.path.abspath('.'))

from src.core.data_structures import TacticalSettings
from src.systems.game_simulation import GameSimulator

print("=" * 80)
print("IDENTICAL TEAMS VARIANCE TEST")
print("=" * 80)
print()
print("Testing baseline randomness by simulating games between two teams")
print("with IDENTICAL player attributes.")
print()

# Create two teams with identical attributes
# Using average NBA player attributes (around 50-55 in key stats)
IDENTICAL_PLAYER_TEMPLATE = {
    # Physical
    'grip_strength': 50,
    'arm_strength': 50,
    'core_strength': 50,
    'agility': 52,
    'acceleration': 52,
    'top_speed': 52,
    'jumping': 52,
    'reactions': 52,
    'stamina': 52,
    'balance': 52,
    'height': 50,
    'durability': 50,
    # Mental
    'awareness': 52,
    'creativity': 50,
    'determination': 52,
    'bravery': 50,
    'consistency': 52,
    'composure': 52,
    'patience': 50,
    # Technical
    'hand_eye_coordination': 52,
    'throw_accuracy': 52,
    'form_technique': 52,
    'finesse': 52,
    'deception': 50,
    'teamwork': 52
}

def create_identical_player(name: str, position: str):
    """Create a player with identical attributes."""
    player = {'name': name, 'position': position}
    player.update(IDENTICAL_PLAYER_TEMPLATE)
    return player

# Team A roster
team_a_roster = [
    create_identical_player('TeamA_PG_1', 'PG'),
    create_identical_player('TeamA_SG_2', 'SG'),
    create_identical_player('TeamA_SF_3', 'SF'),
    create_identical_player('TeamA_PF_4', 'PF'),
    create_identical_player('TeamA_C_5', 'C'),
    create_identical_player('TeamA_PG_6', 'PG'),
    create_identical_player('TeamA_SG_7', 'SG'),
    create_identical_player('TeamA_SF_8', 'SF'),
    create_identical_player('TeamA_PF_9', 'PF'),
    create_identical_player('TeamA_C_10', 'C'),
]

# Team B roster (IDENTICAL attributes, different names)
team_b_roster = [
    create_identical_player('TeamB_PG_1', 'PG'),
    create_identical_player('TeamB_SG_2', 'SG'),
    create_identical_player('TeamB_SF_3', 'SF'),
    create_identical_player('TeamB_PF_4', 'PF'),
    create_identical_player('TeamB_C_5', 'C'),
    create_identical_player('TeamB_PG_6', 'PG'),
    create_identical_player('TeamB_SG_7', 'SG'),
    create_identical_player('TeamB_SF_8', 'SF'),
    create_identical_player('TeamB_PF_9', 'PF'),
    create_identical_player('TeamB_C_10', 'C'),
]

# Verify attributes are identical
print("Step 1: Verify Attribute Equality")
print("-" * 80)
player_a = team_a_roster[0]
player_b = team_b_roster[0]
all_match = True
for key in IDENTICAL_PLAYER_TEMPLATE:
    if player_a[key] != player_b[key]:
        print(f"  MISMATCH: {key} - TeamA={player_a[key]}, TeamB={player_b[key]}")
        all_match = False

if all_match:
    print("  [OK] All attributes verified identical")
    print(f"  Sample attribute values: agility={player_a['agility']}, height={player_a['height']}, awareness={player_a['awareness']}")
else:
    print("  ERROR: Attributes do not match!")
    sys.exit(1)

print()

# Default tactics (identical for both teams)
default_tactics = TacticalSettings(
    pace='standard',
    man_defense_pct=100,
    scoring_option_1=None,
    scoring_option_2=None,
    scoring_option_3=None,
    minutes_allotment={},
    rebounding_strategy='standard'
)

print("Step 2: Simulate 10 Games")
print("-" * 80)

results = []
team_a_wins = 0
team_b_wins = 0
margins = []

for game_num in range(1, 11):
    # Alternate home/away to eliminate home court bias
    if game_num % 2 == 1:
        home_roster = team_a_roster
        away_roster = team_b_roster
        home_name = "Team_A"
        away_name = "Team_B"
    else:
        home_roster = team_b_roster
        away_roster = team_a_roster
        home_name = "Team_B"
        away_name = "Team_A"

    simulator = GameSimulator(
        home_roster=home_roster,
        away_roster=away_roster,
        tactical_home=default_tactics,
        tactical_away=default_tactics,
        home_team_name=home_name,
        away_team_name=away_name
    )

    game_result = simulator.simulate_game(seed=5000 + game_num)

    home_score = game_result.home_score
    away_score = game_result.away_score
    margin = abs(home_score - away_score)
    margins.append(margin)

    # Track wins for Team A
    if game_num % 2 == 1:  # Team A was home
        if home_score > away_score:
            team_a_wins += 1
            winner = "Team_A"
        else:
            team_b_wins += 1
            winner = "Team_B"
    else:  # Team A was away
        if away_score > home_score:
            team_a_wins += 1
            winner = "Team_A"
        else:
            team_b_wins += 1
            winner = "Team_B"

    print(f"  Game {game_num:2d}: {home_name} {home_score:3d} - {away_score:3d} {away_name}  |  Margin: {margin:2d}  |  Winner: {winner}")

    results.append({
        'game': game_num,
        'home_score': home_score,
        'away_score': away_score,
        'margin': margin,
        'winner': winner
    })

print()
print("=" * 80)
print("RESULTS ANALYSIS")
print("=" * 80)
print()

avg_margin = sum(margins) / len(margins)
max_margin = max(margins)
min_margin = min(margins)

print(f"Team A Wins: {team_a_wins}/10 ({team_a_wins*10}%)")
print(f"Team B Wins: {team_b_wins}/10 ({team_b_wins*10}%)")
print()
print(f"Average Margin: {avg_margin:.1f} points")
print(f"Max Margin: {max_margin} points")
print(f"Min Margin: {min_margin} points")
print()

print("=" * 80)
print("INTERPRETATION")
print("=" * 80)
print()

# Evaluate results
issues = []

# Check win distribution
if team_a_wins < 3 or team_a_wins > 7:
    issues.append(f"CONCERN: Win distribution is skewed ({team_a_wins}-{team_b_wins})")
    print(f"  [!] Win distribution: {team_a_wins}-{team_b_wins} (expected ~5-5)")
else:
    print(f"  [OK] Win distribution: {team_a_wins}-{team_b_wins} (reasonable variance)")

# Check average margin
if avg_margin > 10:
    issues.append(f"CONCERN: Average margin is too high ({avg_margin:.1f} points)")
    print(f"  [!] Average margin: {avg_margin:.1f} points (expected <10)")
else:
    print(f"  [OK] Average margin: {avg_margin:.1f} points (acceptable)")

# Check max margin
if max_margin > 20:
    issues.append(f"CONCERN: Maximum margin is excessive ({max_margin} points)")
    print(f"  [!] Maximum margin: {max_margin} points (expected <20)")
else:
    print(f"  [OK] Maximum margin: {max_margin} points (acceptable)")

print()

if issues:
    print("=" * 80)
    print("DIAGNOSIS: EXCESSIVE BASELINE RANDOMNESS")
    print("=" * 80)
    print()
    print("When two teams have IDENTICAL attributes, games should be close and")
    print("win distribution should be roughly 50-50. Deviations indicate that")
    print("random variation is dominating over skill-based outcomes.")
    print()
    print("Issues detected:")
    for issue in issues:
        print(f"  - {issue}")
    print()
else:
    print("=" * 80)
    print("DIAGNOSIS: BASELINE VARIANCE IS ACCEPTABLE")
    print("=" * 80)
    print()
    print("Games between identical teams show expected close margins and")
    print("balanced win distribution. This suggests randomness is within")
    print("acceptable bounds and skill differences should matter.")
    print()

print("=" * 80)
print("NEXT STEPS")
print("=" * 80)
print()
if issues:
    print("1. Investigate game mechanics for excessive randomness")
    print("2. Check if probability formulas are being applied correctly")
    print("3. Verify sigmoid functions aren't creating too much variance")
    print("4. Review contest distance and defensive calculations")
else:
    print("Baseline variance is acceptable. If correlation is still low,")
    print("the issue is likely in:")
    print("  1. Team rating calculation (not reflecting true skill)")
    print("  2. Attribute impact being too weak in game mechanics")
    print("  3. Missing attribute weights in key systems")
