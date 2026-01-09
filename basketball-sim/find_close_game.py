"""
Find a close game to test Q4 closer system.

Runs multiple simulations until we find a game with a close 4th quarter
(within 10 points going into Q4).
"""

import json
import sys
import os
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))

from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

# Load teams
with open('teams/review/team_specialists_a.json', 'r') as f:
    team_a = json.load(f)

with open('teams/review/team_specialists_b.json', 'r') as f:
    team_b = json.load(f)

# Tactical settings (standard)
tactics = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    scoring_option_1=None,
    scoring_option_2=None,
    scoring_option_3=None,
    minutes_allotment={},
    rebounding_strategy='standard'
)

print("=" * 100)
print("SEARCHING FOR CLOSE GAME TO TEST Q4 CLOSER SYSTEM")
print("=" * 100)
print()

# Try different seeds until we find a close game
seed = 2000
max_attempts = 50
found_close_game = False

for attempt in range(max_attempts):
    print(f"Attempt {attempt + 1}: Simulating with seed {seed}...", end=" ")

    game_sim = GameSimulator(
        home_roster=team_a['players'],
        away_roster=team_b['players'],
        tactical_home=tactics,
        tactical_away=tactics,
        home_team_name=team_a['team_name'],
        away_team_name=team_b['team_name']
    )

    result = game_sim.simulate_game(seed=seed)

    # Check Q3 score to see if Q4 will be close
    # We want to enter Q4 with a close game (within 10 points)
    q1_home = result.quarter_results[0].home_score
    q1_away = result.quarter_results[0].away_score
    q2_home = result.quarter_results[1].home_score
    q2_away = result.quarter_results[1].away_score
    q3_home = result.quarter_results[2].home_score
    q3_away = result.quarter_results[2].away_score

    home_after_q3 = q1_home + q2_home + q3_home
    away_after_q3 = q1_away + q2_away + q3_away

    diff_after_q3 = abs(home_after_q3 - away_after_q3)

    print(f"After Q3: {home_after_q3}-{away_after_q3} (diff: {diff_after_q3})", end=" ")

    # Check if game stays close in Q4
    # Look for games within 10 points after Q3
    if diff_after_q3 <= 10:
        print("CLOSE GAME FOUND!")
        found_close_game = True

        # Write to review file
        output_file = Path('output/REVIEW_GAME_PROPER.txt')
        output_file.parent.mkdir(exist_ok=True)

        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(result.play_by_play_text)

        print()
        print("=" * 100)
        print(f"CLOSE GAME FOUND (seed={seed})")
        print("=" * 100)
        print(f"Final Score: {team_a['team_name']} {result.home_score} - {team_b['team_name']} {result.away_score}")
        print(f"Score after Q3: {home_after_q3}-{away_after_q3} (diff: {diff_after_q3})")
        print(f"Final margin: {abs(result.home_score - result.away_score)}")
        print()
        print(f"Review game written to: {output_file}")
        print("=" * 100)
        break
    else:
        print("(blowout)")

    seed += 1

if not found_close_game:
    print()
    print(f"Could not find a close game after {max_attempts} attempts.")
    print("You may need to run this script again or adjust the threshold.")
