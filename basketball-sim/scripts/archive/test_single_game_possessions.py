"""
Quick test to see what possession count we get with current code
"""

import random
from generate_teams import generate_team
from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

random.seed(12345)

home_team_data = generate_team(team_name="TestHome", overall_rating=70)
away_team_data = generate_team(team_name="TestAway", overall_rating=70)

home_tactics = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    minutes_allotment={p['name']: 24 for p in home_team_data['roster']}
)

away_tactics = TacticalSettings(
    pace='standard',
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

result = game_sim.simulate_game(seed=12345)

print("=" * 80)
print("POSSESSION COUNT TEST")
print("=" * 80)

# Get total possessions from game_statistics
total_poss = result.game_statistics.get('total_possessions', 0)
print(f"\nTotal possessions (from game_statistics): {total_poss}")
print(f"Possessions per team: {total_poss / 2:.1f}")

# Count possessions by quarter
q_possessions = []
for i, qr in enumerate(result.quarter_results, 1):
    q_poss = qr.possession_count
    q_possessions.append(q_poss)
    print(f"Q{i}: {q_poss} possessions")

print(f"\nSum of quarter possessions: {sum(q_possessions)}")

# Calculate using NBA formula
home_stats = result.game_statistics['home_stats']
away_stats = result.game_statistics['away_stats']

home_fga = home_stats.get('fga', 0)
home_fta = home_stats.get('fta', 0)
home_tov = home_stats.get('tov', 0)
home_oreb = home_stats.get('oreb', 0)

away_fga = away_stats.get('fga', 0)
away_fta = away_stats.get('fta', 0)
away_tov = away_stats.get('tov', 0)
away_oreb = away_stats.get('oreb', 0)

home_nba_formula = home_fga + 0.44 * home_fta + home_tov - home_oreb
away_nba_formula = away_fga + 0.44 * away_fta + away_tov - away_oreb
avg_nba_formula = (home_nba_formula + away_nba_formula) / 2

print(f"\nNBA Formula Calculation:")
print(f"Home: {home_fga} FGA + 0.44×{home_fta} FTA + {home_tov} TOV - {home_oreb} OREB = {home_nba_formula:.1f}")
print(f"Away: {away_fga} FGA + 0.44×{away_fta} FTA + {away_tov} TOV - {away_oreb} OREB = {away_nba_formula:.1f}")
print(f"Average: {avg_nba_formula:.1f} possessions per team")

print(f"\nComparison:")
print(f"Actual (per team): {total_poss / 2:.1f}")
print(f"NBA Formula: {avg_nba_formula:.1f}")
print(f"Difference: {(total_poss / 2) - avg_nba_formula:.1f}")

print(f"\nFinal Score: {result.home_score} - {result.away_score}")
print(f"Total Points: {result.home_score + result.away_score}")
print(f"PPP (actual): {(result.home_score + result.away_score) / total_poss:.2f}")
print(f"PPP (formula): {(result.home_score + result.away_score) / (avg_nba_formula * 2):.2f}")
