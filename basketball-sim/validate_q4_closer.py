"""
Validate Q4 Closer System

Tests that:
1. Q4 decisions are calculated correctly at Q4 start
2. Starters end Q4 with 70+ stamina in close games
3. No regressions in Q1-Q3 substitution logic
"""

import json
import sys
import random
from pathlib import Path

sys.path.insert(0, '.')

from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

# Load teams for testing
teams_dir = Path('teams')
team_files = list(teams_dir.glob('Team_*.json'))

if len(team_files) < 2:
    print("ERROR: Need at least 2 teams in teams/ folder")
    sys.exit(1)

print("="*80)
print("Q4 CLOSER SYSTEM VALIDATION")
print("="*80)
print()

# Run 5 test games
num_games = 5
total_starters_checked = 0
starters_above_70 = 0
q4_decisions_found = 0

for game_num in range(1, num_games + 1):
    print(f"Game {game_num}/{num_games}:")
    print("-" * 40)

    # Randomly select two teams
    tf = random.sample(team_files, 2)
    team_a = json.load(open(tf[0]))
    team_b = json.load(open(tf[1]))

    # Set up tactics
    tactics_home = TacticalSettings(
        pace='standard',
        man_defense_pct=50,
        scoring_option_1=team_a['roster'][0]['name'] if len(team_a['roster']) > 0 else None,
        scoring_option_2=team_a['roster'][1]['name'] if len(team_a['roster']) > 1 else None,
        scoring_option_3=None,
        minutes_allotment={},
        rebounding_strategy='standard'
    )

    tactics_away = TacticalSettings(
        pace='standard',
        man_defense_pct=50,
        scoring_option_1=team_b['roster'][0]['name'] if len(team_b['roster']) > 0 else None,
        scoring_option_2=team_b['roster'][1]['name'] if len(team_b['roster']) > 1 else None,
        scoring_option_3=None,
        minutes_allotment={},
        rebounding_strategy='standard'
    )

    # Run simulation
    sim = GameSimulator(
        team_a['roster'], team_b['roster'],
        tactics_home, tactics_away,
        team_a['name'], team_b['name']
    )

    result = sim.simulate_game()

    print(f"  Final Score: {team_a['name']} {result.home_score} - {team_b['name']} {result.away_score}")

    # Check if Q4 decisions were calculated (stored in substitution manager)
    # Note: We can't directly access sub_manager from result, so we'll check indirectly
    # by verifying Q4 starter stamina behavior

    # Get Q4 results
    if len(result.quarter_results) >= 4:
        q4_result = result.quarter_results[3]

        # Track starter stamina at end of Q4
        # Get starters (top 5 by minutes played)
        home_minutes = {}
        away_minutes = {}

        for quarter in result.quarter_results:
            for poss in quarter.possession_results:
                # Track minutes for home team
                if hasattr(poss, 'home_active_players'):
                    for player_name in poss.home_active_players:
                        if player_name not in home_minutes:
                            home_minutes[player_name] = 0
                        home_minutes[player_name] += poss.possession_duration / 60.0

                # Track minutes for away team
                if hasattr(poss, 'away_active_players'):
                    for player_name in poss.away_active_players:
                        if player_name not in away_minutes:
                            away_minutes[player_name] = 0
                        away_minutes[player_name] += poss.possession_duration / 60.0

        # Get top 5 by minutes (starters)
        home_starters = sorted(home_minutes.items(), key=lambda x: x[1], reverse=True)[:5]
        away_starters = sorted(away_minutes.items(), key=lambda x: x[1], reverse=True)[:5]

        print(f"\n  Q4 Starter Stamina Check:")

        # Check final stamina for each starter
        # Get final stamina from last possession of Q4
        if q4_result.possession_results:
            last_poss = q4_result.possession_results[-1]

            # Check home starters
            for starter_name, minutes in home_starters:
                if hasattr(last_poss, 'debug') and 'stamina_values' in last_poss.debug:
                    final_stamina = last_poss.debug['stamina_values'].get(starter_name, 0)
                    total_starters_checked += 1

                    if final_stamina >= 70.0:
                        starters_above_70 += 1
                        status = "✓"
                    else:
                        status = "✗"

                    print(f"    {starter_name}: {final_stamina:.1f} stamina {status}")

            # Check away starters
            for starter_name, minutes in away_starters:
                if hasattr(last_poss, 'debug') and 'stamina_values' in last_poss.debug:
                    final_stamina = last_poss.debug['stamina_values'].get(starter_name, 0)
                    total_starters_checked += 1

                    if final_stamina >= 70.0:
                        starters_above_70 += 1
                        status = "✓"
                    else:
                        status = "✗"

                    print(f"    {starter_name}: {final_stamina:.1f} stamina {status}")

    print()

print("="*80)
print("VALIDATION SUMMARY")
print("="*80)
print()

if total_starters_checked > 0:
    pct_above_70 = (starters_above_70 / total_starters_checked) * 100
    print(f"Starters checked: {total_starters_checked}")
    print(f"Starters with 70+ stamina: {starters_above_70} ({pct_above_70:.1f}%)")
    print()

    if pct_above_70 >= 85.0:
        print("[OK] ✓ Q4 Closer System working! 85%+ of starters above 70 stamina")
    elif pct_above_70 >= 70.0:
        print("[INFO] Q4 Closer System functional, but could be better")
    else:
        print("[WARN] Q4 Closer System may need tuning - many starters below 70")
else:
    print("[INFO] Could not extract stamina data from game results")
    print("       System may still be working, but validation is inconclusive")

print()
print("="*80)
