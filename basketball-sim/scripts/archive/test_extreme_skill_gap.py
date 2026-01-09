"""
EXTREME SKILL GAP TEST

Test: All-90 team vs All-50 team, run 10 games

Purpose: Verify that attributes actually affect outcomes with maximum contrast

Expected Results:
- All-90 team wins >90% of games (9-10 wins)
- Average margin: 25-35 points
- No upsets (All-50 team should never win or only win due to extreme luck)

If Results Differ:
- Indicates core mechanics aren't respecting attribute differences
- Suggests probability formulas may be broken or too flat
"""

import sys
import os
import random

sys.path.insert(0, os.path.abspath('.'))

from src.core.data_structures import TacticalSettings
from src.systems.game_simulation import GameSimulator

print("=" * 80)
print("EXTREME SKILL GAP TEST")
print("=" * 80)
print()
print("Testing attribute impact by simulating games between:")
print("  - Elite Team (all attributes = 90)")
print("  - Weak Team (all attributes = 50)")
print()

def create_player(name: str, position: str, attribute_level: int):
    """Create a player with all attributes set to the same level."""
    return {
        'name': name,
        'position': position,
        # Physical
        'grip_strength': attribute_level,
        'arm_strength': attribute_level,
        'core_strength': attribute_level,
        'agility': attribute_level,
        'acceleration': attribute_level,
        'top_speed': attribute_level,
        'jumping': attribute_level,
        'reactions': attribute_level,
        'stamina': attribute_level,
        'balance': attribute_level,
        'height': attribute_level,
        'durability': attribute_level,
        # Mental
        'awareness': attribute_level,
        'creativity': attribute_level,
        'determination': attribute_level,
        'bravery': attribute_level,
        'consistency': attribute_level,
        'composure': attribute_level,
        'patience': attribute_level,
        # Technical
        'hand_eye_coordination': attribute_level,
        'throw_accuracy': attribute_level,
        'form_technique': attribute_level,
        'finesse': attribute_level,
        'deception': attribute_level,
        'teamwork': attribute_level
    }

# All-90 Team roster
elite_roster = [
    create_player('Elite_PG_1', 'PG', 90),
    create_player('Elite_SG_2', 'SG', 90),
    create_player('Elite_SF_3', 'SF', 90),
    create_player('Elite_PF_4', 'PF', 90),
    create_player('Elite_C_5', 'C', 90),
    create_player('Elite_PG_6', 'PG', 90),
    create_player('Elite_SG_7', 'SG', 90),
    create_player('Elite_SF_8', 'SF', 90),
    create_player('Elite_PF_9', 'PF', 90),
    create_player('Elite_C_10', 'C', 90),
]

# All-50 Team roster
weak_roster = [
    create_player('Weak_PG_1', 'PG', 50),
    create_player('Weak_SG_2', 'SG', 50),
    create_player('Weak_SF_3', 'SF', 50),
    create_player('Weak_PF_4', 'PF', 50),
    create_player('Weak_C_5', 'C', 50),
    create_player('Weak_PG_6', 'PG', 50),
    create_player('Weak_SG_7', 'SG', 50),
    create_player('Weak_SF_8', 'SF', 50),
    create_player('Weak_PF_9', 'PF', 50),
    create_player('Weak_C_10', 'C', 50),
]

print("Step 1: Verify Team Compositions")
print("-" * 80)
print(f"  Elite Team: All attributes = 90")
print(f"  Weak Team: All attributes = 50")
print(f"  Attribute Difference: 40 points across all 25 attributes")
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
elite_wins = 0
weak_wins = 0
margins = []

for game_num in range(1, 11):
    # Alternate home/away
    if game_num % 2 == 1:
        home_roster = elite_roster
        away_roster = weak_roster
        home_name = "Elite"
        away_name = "Weak"
    else:
        home_roster = weak_roster
        away_roster = elite_roster
        home_name = "Weak"
        away_name = "Elite"

    simulator = GameSimulator(
        home_roster=home_roster,
        away_roster=away_roster,
        tactical_home=default_tactics,
        tactical_away=default_tactics,
        home_team_name=home_name,
        away_team_name=away_name
    )

    game_result = simulator.simulate_game(seed=6000 + game_num)

    home_score = game_result.home_score
    away_score = game_result.away_score

    # Determine winner and margin (from Elite team's perspective)
    if game_num % 2 == 1:  # Elite was home
        elite_score = home_score
        weak_score = away_score
        margin = elite_score - weak_score
        if home_score > away_score:
            elite_wins += 1
            winner = "Elite"
        else:
            weak_wins += 1
            winner = "Weak (UPSET!)"
    else:  # Elite was away
        elite_score = away_score
        weak_score = home_score
        margin = elite_score - weak_score
        if away_score > home_score:
            elite_wins += 1
            winner = "Elite"
        else:
            weak_wins += 1
            winner = "Weak (UPSET!)"

    margins.append(margin)

    print(f"  Game {game_num:2d}: {home_name:5s} {home_score:3d} - {away_score:3d} {away_name:5s}  |  Elite Margin: {margin:+3d}  |  Winner: {winner}")

    results.append({
        'game': game_num,
        'elite_score': elite_score,
        'weak_score': weak_score,
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

print(f"Elite Team Wins: {elite_wins}/10 ({elite_wins*10}%)")
print(f"Weak Team Wins: {weak_wins}/10 ({weak_wins*10}%)")
print()
print(f"Average Elite Margin: {avg_margin:+.1f} points")
print(f"Max Elite Margin: {max_margin:+d} points")
print(f"Min Elite Margin: {min_margin:+d} points")
print()

print("=" * 80)
print("INTERPRETATION")
print("=" * 80)
print()

# Evaluate results
issues = []

# Check win rate
if elite_wins < 9:
    issues.append(f"CRITICAL: Elite team only won {elite_wins}/10 games (expected 9-10)")
    print(f"  [X] Win rate: {elite_wins*10}% (UNACCEPTABLE - expected >90%)")
else:
    print(f"  [OK] Win rate: {elite_wins*10}% (expected >90%)")

# Check average margin
if avg_margin < 20:
    issues.append(f"CONCERN: Average margin is too small ({avg_margin:+.1f} points)")
    print(f"  [!] Average margin: {avg_margin:+.1f} points (expected 25-35)")
elif avg_margin > 40:
    issues.append(f"CONCERN: Average margin is too large ({avg_margin:+.1f} points)")
    print(f"  [!] Average margin: {avg_margin:+.1f} points (expected 25-35)")
else:
    print(f"  [OK] Average margin: {avg_margin:+.1f} points (within expected range)")

# Check for upsets
if weak_wins > 0:
    issues.append(f"CRITICAL: Weak team won {weak_wins} game(s) - should be nearly impossible")
    print(f"  [X] Upsets: {weak_wins} (with 40-point attribute gap, should be 0)")
else:
    print(f"  [OK] No upsets (0 games)")

# Check min margin
if min_margin < 10:
    issues.append(f"CONCERN: Closest game was only {min_margin:+d} points")
    print(f"  [!] Closest margin: {min_margin:+d} points (expected >10)")
else:
    print(f"  [OK] Closest margin: {min_margin:+d} points (acceptable)")

print()

if issues:
    print("=" * 80)
    print("DIAGNOSIS: ATTRIBUTES NOT AFFECTING OUTCOMES")
    print("=" * 80)
    print()
    print("With a 40-point gap across ALL attributes, the elite team should")
    print("dominate every game. If they don't, it means:")
    print()
    print("  1. Probability formulas are too flat (not enough sigmoid effect)")
    print("  2. Attribute composites aren't being calculated correctly")
    print("  3. Base rates are too high (diminishing returns kick in too early)")
    print("  4. Random elements are overwhelming skill differences")
    print()
    print("Issues detected:")
    for issue in issues:
        print(f"  - {issue}")
    print()
else:
    print("=" * 80)
    print("DIAGNOSIS: ATTRIBUTES ARE WORKING CORRECTLY")
    print("=" * 80)
    print()
    print("The elite team dominated as expected, showing that:")
    print("  ✓ Probability formulas properly reward high attributes")
    print("  ✓ Attribute composites are being calculated correctly")
    print("  ✓ Skill differences translate to game outcomes")
    print()
    print("If correlation is still low, the problem is likely:")
    print("  - Team rating calculation not reflecting true skill")
    print("  - Insufficient attribute variation in normal team generation")
    print()

print("=" * 80)
print("TECHNICAL DETAILS")
print("=" * 80)
print()
print("Expected behavior with sigmoid formula P = BaseRate + (1-BaseRate) * sigmoid(k * diff):")
print()
print("  3PT Shooting (BaseRate = 30%):")
print("    Elite vs Weak: diff = +40")
print("    P = 0.30 + 0.70 * sigmoid(0.02 * 40)")
print("    P = 0.30 + 0.70 * sigmoid(0.8) ~= 0.30 + 0.70 * 0.69 ~= 78%")
print()
print("  Layup (BaseRate = 62%):")
print("    Elite vs Weak: diff = +40")
print("    P = 0.62 + 0.38 * sigmoid(0.8) ~= 0.62 + 0.26 ~= 88%")
print()
print("With these shooting percentages, the Elite team should score significantly")
print(f"more than the Weak team, resulting in margins of 25-35 points.")
print()

if issues:
    print("Actual margins are inconsistent with expected formula behavior.")
    print("This suggests a bug in the probability calculation code.")
else:
    print("Actual margins are consistent with expected formula behavior.")
    print("Probability system is working as designed.")
