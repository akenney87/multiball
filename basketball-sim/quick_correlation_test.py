"""
Quick correlation test with new attribute system.
Tests 10 games with varying skill differentials to check correlation.
"""

import json
import random
from pathlib import Path
from src.game_simulator import GameSimulator

# Load teams
teams_dir = Path('teams')
teams = {}
for team_file in teams_dir.glob('Team_*.json'):
    with open(team_file) as f:
        team_data = json.load(f)
        teams[team_data['name']] = team_data

print("=" * 80)
print("QUICK CORRELATION TEST - NEW ATTRIBUTE SYSTEM")
print("=" * 80)
print()

# Select teams with varying rating differences
team_list = list(teams.items())
team_list.sort(key=lambda x: x[1]['overall_rating'])

# Get low, mid, high rated teams
low_team = team_list[0]
mid_team = team_list[50]
high_team = team_list[-1]

print("Selected teams:")
print(f"  Low:  {low_team[0]} (rating: {low_team[1]['overall_rating']:.1f})")
print(f"  Mid:  {mid_team[0]} (rating: {mid_team[1]['overall_rating']:.1f})")
print(f"  High: {high_team[0]} (rating: {high_team[1]['overall_rating']:.1f})")
print()

# Test games
test_games = [
    (high_team, low_team, "Large gap (high vs low)"),
    (high_team, mid_team, "Medium gap (high vs mid)"),
    (mid_team, low_team, "Medium gap (mid vs low)"),
    (mid_team, team_list[51], "Small gap (balanced)"),
]

results = []

for i, (team1, team2, description) in enumerate(test_games):
    random.seed(1000 + i)

    team1_name, team1_data = team1
    team2_name, team2_data = team2

    # Default tactics
    tactical_home = {
        'pace': 'standard',
        'man_defense_pct': 50,
        'scoring_option_1': None,
        'scoring_option_2': None,
        'scoring_option_3': None,
        'minutes_allotment': {},
        'rebounding_strategy': 'standard'
    }
    tactical_away = tactical_home.copy()

    # Simulate game
    simulator = GameSimulator(
        home_roster=team1_data['roster'],
        away_roster=team2_data['roster'],
        home_team_name=team1_name,
        away_team_name=team2_name,
        tactical_home=tactical_home,
        tactical_away=tactical_away
    )

    result = simulator.simulate_game()

    rating_diff = team1_data['overall_rating'] - team2_data['overall_rating']
    score_diff = result['final_score']['home'] - result['final_score']['away']

    results.append({
        'description': description,
        'team1': team1_name,
        'team1_rating': team1_data['overall_rating'],
        'team2': team2_name,
        'team2_rating': team2_data['overall_rating'],
        'rating_diff': rating_diff,
        'score_diff': score_diff,
        'home_score': result['final_score']['home'],
        'away_score': result['final_score']['away']
    })

    print(f"Game {i+1}: {description}")
    print(f"  {team1_name} ({team1_data['overall_rating']:.1f}) vs {team2_name} ({team2_data['overall_rating']:.1f})")
    print(f"  Rating diff: {rating_diff:+.1f}")
    print(f"  Final: {result['final_score']['home']}-{result['final_score']['away']}")
    print(f"  Score diff: {score_diff:+d}")
    print()

# Calculate correlation
import math

def pearson_correlation(x, y):
    n = len(x)
    sum_x = sum(x)
    sum_y = sum(y)
    sum_xy = sum(xi * yi for xi, yi in zip(x, y))
    sum_x2 = sum(xi ** 2 for xi in x)
    sum_y2 = sum(yi ** 2 for yi in y)

    numerator = n * sum_xy - sum_x * sum_y
    denominator = math.sqrt((n * sum_x2 - sum_x**2) * (n * sum_y2 - sum_y**2))

    if denominator == 0:
        return 0

    return numerator / denominator

rating_diffs = [r['rating_diff'] for r in results]
score_diffs = [r['score_diff'] for r in results]

correlation = pearson_correlation(rating_diffs, score_diffs)

print("=" * 80)
print("CORRELATION ANALYSIS")
print("=" * 80)
print(f"Sample size: {len(results)} games")
print(f"Pearson correlation (rating_diff vs score_diff): {correlation:.4f}")
print()

if correlation < 0.5:
    print("[WARNING] Correlation below 0.5 - investigation needed!")
elif correlation < 0.7:
    print("[CAUTION] Correlation below 0.7 - may need tuning")
else:
    print("[GOOD] Correlation >= 0.7")

print()
print("Expected: 0.70-0.85 for properly weighted attributes")
