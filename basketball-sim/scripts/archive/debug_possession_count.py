"""
Debug possession count issue

The validation shows 61.7 possessions per game vs NBA 95-105.
This script will help diagnose why we're getting so few possessions.

Investigation areas:
1. How many possessions per quarter?
2. How much time is consumed per possession?
3. Is the game clock running correctly?
4. What is the pace implementation doing?
"""

import random
from generate_teams import generate_team
from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

print("=" * 80)
print("POSSESSION COUNT DEBUG")
print("=" * 80)

random.seed(99999)

home_team_data = generate_team(team_name="HomeTeam", overall_rating=70)
away_team_data = generate_team(team_name="AwayTeam", overall_rating=70)

# Test each pace setting
for pace_setting in ['slow', 'standard', 'fast']:
    print(f"\n{'=' * 80}")
    print(f"TESTING PACE: {pace_setting.upper()}")
    print("=" * 80)

    home_tactics = TacticalSettings(
        pace=pace_setting,
        man_defense_pct=50,
        minutes_allotment={p['name']: 24 for p in home_team_data['roster']}
    )

    away_tactics = TacticalSettings(
        pace=pace_setting,
        man_defense_pct=50,
        minutes_allotment={p['name']: 24 for p in away_team_data['roster']}
    )

    game_sim = GameSimulator(
        home_roster=home_team_data['roster'],
        away_roster=away_team_data['roster'],
        tactical_home=home_tactics,
        tactical_away=away_tactics,
        home_team_name=home_team_data['name'],
        away_team_name=away_team_data['name']
    )

    result = game_sim.simulate_game(seed=99999)

    # Analyze possession count by quarter
    total_possessions = 0
    print(f"\nPossessions by quarter:")
    for i, q_result in enumerate(result.quarter_results, 1):
        q_poss = q_result.quarter_statistics.get('possession_count', 0)
        total_possessions += q_poss
        print(f"  Q{i}: {q_poss} possessions")

    print(f"\nTotal game possessions: {total_possessions}")
    print(f"Average per quarter: {total_possessions / 4:.1f}")
    print(f"Expected (NBA): ~100 total, ~25 per quarter")

    # Calculate time per possession
    total_game_time = 48 * 60  # 48 minutes in seconds
    if total_possessions > 0:
        seconds_per_possession = total_game_time / total_possessions
        print(f"\nTime per possession: {seconds_per_possession:.1f} seconds")
        print(f"Expected (NBA): ~28-29 seconds per possession")

    # Show scores
    print(f"\nFinal score: {result.home_score} - {result.away_score}")
    print(f"Total points: {result.home_score + result.away_score}")
    print(f"Points per possession: {(result.home_score + result.away_score) / total_possessions:.2f}")
    print(f"Expected (NBA): ~1.10 PPP")

print("\n" + "=" * 80)
print("ANALYSIS SUMMARY")
print("=" * 80)

print("""
Expected NBA Pace by Setting:
  - Slow pace: ~90-95 possessions per game
  - Standard pace: ~95-100 possessions per game
  - Fast pace: ~100-110 possessions per game

If we're seeing ~60 possessions regardless of pace setting, the issue is likely:
1. Possession loop is terminating too early
2. Time consumption per possession is too high
3. Quarter length calculation is wrong
4. Pace modifier is not being applied correctly
""")
