"""
Run multiple games with different random seeds to verify intentional foul fixes.
"""
import sys
import os
import random
sys.path.insert(0, os.path.dirname(__file__))

from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

# Load specialized teams from JSON files
import json

print("=" * 80)
print("TESTING INTENTIONAL FOUL FIXES ACROSS MULTIPLE GAMES")
print("=" * 80)

# Run 5 games with different random seeds
num_games = 5
games_with_fouls = 0
foul_details = []

for game_num in range(1, num_games + 1):
    # Set different random seed for each game
    seed = 1000 + game_num
    random.seed(seed)

    print(f"\n{'=' * 80}")
    print(f"GAME {game_num} (Seed: {seed})")
    print(f"{'=' * 80}")

    # Load teams from JSON files
    with open('teams/specialized/team_a.json', 'r') as f:
        team_a = json.load(f)
    with open('teams/specialized/team_b.json', 'r') as f:
        team_b = json.load(f)

    # Standard tactical settings
    tactical_a = TacticalSettings(
        pace='standard',
        man_defense_pct=50,
        scoring_option_1=None,
        scoring_option_2=None,
        scoring_option_3=None,
        minutes_allotment={p['name']: 48 for p in team_a['players']},
        rebounding_strategy='standard'
    )

    tactical_b = TacticalSettings(
        pace='standard',
        man_defense_pct=50,
        scoring_option_1=None,
        scoring_option_2=None,
        scoring_option_3=None,
        minutes_allotment={p['name']: 48 for p in team_b['players']},
        rebounding_strategy='standard'
    )

    # Simulate game
    game_sim = GameSimulator(
        home_roster=team_a['players'],
        away_roster=team_b['players'],
        tactical_home=tactical_a,
        tactical_away=tactical_b
    )

    result = game_sim.simulate_game()

    # Save to file
    filename = f'output/GAME_{game_num}.txt'
    with open(filename, 'w') as f:
        f.write(result.play_by_play_text)

    # Check for intentional fouls
    fouls_found = result.play_by_play_text.count('intentionally fouls')

    print(f"Final Score: {team_a['team_name']} {result.home_score}, {team_b['team_name']} {result.away_score}")
    print(f"Intentional fouls: {fouls_found}")

    if fouls_found > 0:
        games_with_fouls += 1

        # Extract details
        lines = result.play_by_play_text.split('\n')
        for i, line in enumerate(lines):
            if 'intentionally fouls' in line:
                # Get context: score from previous line
                score_line = lines[i-1] if i > 0 else ""

                # Parse score
                if 'Score:' in score_line:
                    score_part = score_line.split('Score:')[1].strip()
                    score_a, score_b = map(int, score_part.split('-'))
                    margin = abs(score_a - score_b)

                    # Get possession info
                    possession_line = lines[i-2] if i > 1 else ""
                    time = ""
                    if '[' in possession_line:
                        time = possession_line.split('[')[1].split(']')[0]

                    foul_details.append({
                        'game': game_num,
                        'time': time,
                        'score': f"{score_a}-{score_b}",
                        'margin': margin,
                        'foul_line': line.strip()
                    })

                    print(f"  → Time: {time}, Score: {score_a}-{score_b}, Margin: {margin}")

                    # Validate margin
                    if margin > 6:
                        print(f"  ⚠ WARNING: Foul at margin {margin} (should only be 2-6)")
                    elif margin < 2:
                        print(f"  ⚠ WARNING: Foul at margin {margin} (should only be 2-6)")
                    else:
                        print(f"  ✓ Margin {margin} is correct (within 2-6)")

print(f"\n{'=' * 80}")
print("SUMMARY")
print(f"{'=' * 80}")
print(f"Games run: {num_games}")
print(f"Games with intentional fouls: {games_with_fouls}")
print(f"Total intentional fouls: {len(foul_details)}")

if foul_details:
    print(f"\nDetailed foul breakdown:")
    for detail in foul_details:
        status = "✓" if 2 <= detail['margin'] <= 6 else "⚠"
        print(f"  {status} Game {detail['game']}: {detail['time']} at {detail['score']} (margin: {detail['margin']})")

# Check for any violations
violations = [d for d in foul_details if d['margin'] < 2 or d['margin'] > 6]
if violations:
    print(f"\n⚠ {len(violations)} VIOLATION(S) FOUND:")
    for v in violations:
        print(f"  Game {v['game']}: Margin {v['margin']} outside 2-6 range")
else:
    print(f"\n✓ ALL INTENTIONAL FOULS HAD CORRECT MARGINS (2-6 points)")

print(f"\n{'=' * 80}")
