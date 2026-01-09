"""
M4.5 PHASE 4: Test substitution counts in live game

Target: ~20 substitutions per team per game
"""

import random
from generate_teams import generate_team
from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

print("=" * 80)
print("SUBSTITUTION COUNT TEST")
print("=" * 80)

random.seed(88888)

home_team_data = generate_team(team_name="TestHome", overall_rating=75)
away_team_data = generate_team(team_name="TestAway", overall_rating=75)

home_tactics = TacticalSettings(
    minutes_allotment={p['name']: 24 for p in home_team_data['roster']}
)
away_tactics = TacticalSettings(
    minutes_allotment={p['name']: 24 for p in away_team_data['roster']}
)

print("\nRunning full game with teams rated ~75...")
print(f"Home: {home_team_data['name']} ({home_team_data['actual_overall_rating']:.1f})")
print(f"Away: {away_team_data['name']} ({away_team_data['actual_overall_rating']:.1f})")

game_sim = GameSimulator(
    home_roster=home_team_data['roster'],
    away_roster=away_team_data['roster'],
    tactical_home=home_tactics,
    tactical_away=away_tactics,
    home_team_name=home_team_data['name'],
    away_team_name=away_team_data['name']
)

result = game_sim.simulate_game(seed=88888)

# Access substitution events from game simulator
# The GameSimulator stores all quarter simulators with their substitution managers
print("\n" + "=" * 80)
print("SUBSTITUTION BREAKDOWN BY QUARTER")
print("=" * 80)

total_home_subs = 0
total_away_subs = 0

# Access substitution count from quarter statistics
for i, q_result in enumerate(result.quarter_results, 1):
    # Get substitution count from quarter statistics
    sub_count = q_result.quarter_statistics.get('substitution_count', 0)

    # For now, just show total per quarter (we don't have team breakdown easily accessible)
    print(f"\nQuarter {i}: {sub_count} total substitutions (both teams)")

    # Rough estimate: divide by 2 for per-team average
    total_home_subs += sub_count / 2
    total_away_subs += sub_count / 2

print("\n" + "=" * 80)
print("FULL GAME TOTALS")
print("=" * 80)
print(f"\nHome team (TestHome): {total_home_subs} substitutions")
print(f"Away team (TestAway): {total_away_subs} substitutions")
print(f"Total (both teams): {total_home_subs + total_away_subs} substitutions")
print(f"\nAverage per team: {(total_home_subs + total_away_subs) / 2:.1f}")
print(f"\nTarget: ~20 substitutions per team per game")

avg_per_team = (total_home_subs + total_away_subs) / 2
if 18 <= avg_per_team <= 22:
    print("\nSTATUS: [GOOD] Within target range!")
elif 15 <= avg_per_team <= 25:
    print("\nSTATUS: [OK] Close to target")
else:
    print(f"\nSTATUS: [OFF TARGET] Expected ~20, got {avg_per_team:.1f}")

print(f"\nFinal Score: {result.home_score} - {result.away_score}")
