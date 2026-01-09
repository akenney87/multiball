"""
Analyze blowout rates by team skill differential

This will help determine if blowouts are happening for the right reasons
(large skill gaps) or if variance is excessive even in balanced matchups.
"""

import json
import os

# Load all team files to get ratings
teams = {}
for i in range(1, 101):
    team_file = f'teams/Team_{i:03d}.json'
    if os.path.exists(team_file):
        with open(team_file, 'r') as f:
            team_data = json.load(f)
            teams[team_data['name']] = team_data['actual_overall_rating']

# Load validation summary
with open('validation/correlation_test/VALIDATION_SUMMARY.json', 'r') as f:
    summary = json.load(f)

# Load individual game results
game_results = []
for i in range(1, 101):
    game_file = f'validation/correlation_test/games/game_{i:03d}.json'
    if os.path.exists(game_file):
        with open(game_file, 'r') as f:
            game_data = json.load(f)
            game_results.append(game_data)

print("=" * 80)
print("BLOWOUT ANALYSIS BY SKILL DIFFERENTIAL")
print("=" * 80)
print()

# Categorize games by skill differential
skill_buckets = {
    'Very Balanced (0-5 pts)': [],
    'Balanced (5-10 pts)': [],
    'Moderate Gap (10-15 pts)': [],
    'Large Gap (15-20 pts)': [],
    'Huge Gap (20+ pts)': []
}

for game in game_results:
    home_team = game['home_team']
    away_team = game['away_team']
    home_score = game['final_score']['home']
    away_score = game['final_score']['away']

    # Get team ratings
    home_rating = teams.get(home_team, 60)  # Default to 60 if not found
    away_rating = teams.get(away_team, 60)

    skill_diff = abs(home_rating - away_rating)
    score_diff = abs(home_score - away_score)

    # Categorize by skill differential
    if skill_diff < 5:
        bucket = 'Very Balanced (0-5 pts)'
    elif skill_diff < 10:
        bucket = 'Balanced (5-10 pts)'
    elif skill_diff < 15:
        bucket = 'Moderate Gap (10-15 pts)'
    elif skill_diff < 20:
        bucket = 'Large Gap (15-20 pts)'
    else:
        bucket = 'Huge Gap (20+ pts)'

    skill_buckets[bucket].append({
        'home_team': home_team,
        'away_team': away_team,
        'home_rating': home_rating,
        'away_rating': away_rating,
        'skill_diff': skill_diff,
        'home_score': home_score,
        'away_score': away_score,
        'score_diff': score_diff,
        'is_blowout': score_diff >= 20
    })

# Analyze each bucket
print("BLOWOUT RATES BY SKILL TIER:")
print("-" * 80)

total_blowouts = 0
total_games = 0

for bucket_name in ['Very Balanced (0-5 pts)', 'Balanced (5-10 pts)', 'Moderate Gap (10-15 pts)', 'Large Gap (15-20 pts)', 'Huge Gap (20+ pts)']:
    games = skill_buckets[bucket_name]
    if not games:
        continue

    blowouts = sum(1 for g in games if g['is_blowout'])
    blowout_rate = (blowouts / len(games) * 100) if games else 0
    avg_skill_diff = sum(g['skill_diff'] for g in games) / len(games)
    avg_score_diff = sum(g['score_diff'] for g in games) / len(games)

    total_blowouts += blowouts
    total_games += len(games)

    print(f"{bucket_name}:")
    print(f"  Games: {len(games)}")
    print(f"  Blowouts (20+ pts): {blowouts} ({blowout_rate:.1f}%)")
    print(f"  Avg skill differential: {avg_skill_diff:.1f}")
    print(f"  Avg score differential: {avg_score_diff:.1f}")
    print()

print("=" * 80)
if total_games > 0:
    print(f"OVERALL: {total_blowouts}/{total_games} games were blowouts ({total_blowouts/total_games*100:.1f}%)")
else:
    print("No games found in validation data")
print("=" * 80)
print()

# Detailed analysis of very balanced games (0-5 skill difference)
very_balanced = skill_buckets['Very Balanced (0-5 pts)']
if very_balanced:
    print("DETAILED ANALYSIS: VERY BALANCED GAMES (0-5 skill diff)")
    print("-" * 80)
    print(f"{'Home Team':<15} {'Away Team':<15} {'Skill Diff':<12} {'Score':<15} {'Margin':<10} {'Blowout?'}")
    print("-" * 80)

    for game in very_balanced:
        blowout_flag = "YES" if game['is_blowout'] else "No"
        score_str = f"{game['home_score']}-{game['away_score']}"
        print(f"{game['home_team']:<15} {game['away_team']:<15} {game['skill_diff']:<12.1f} {score_str:<15} {game['score_diff']:<10} {blowout_flag}")

    print()
    print(f"Blowout rate in very balanced games: {sum(1 for g in very_balanced if g['is_blowout'])}/{len(very_balanced)}")
    print()

# Check correlation between skill diff and score diff
print("CORRELATION CHECK:")
print("-" * 80)

all_games_data = []
for bucket_games in skill_buckets.values():
    all_games_data.extend(bucket_games)

if all_games_data:
    # Simple correlation coefficient
    n = len(all_games_data)
    sum_x = sum(g['skill_diff'] for g in all_games_data)
    sum_y = sum(g['score_diff'] for g in all_games_data)
    sum_xy = sum(g['skill_diff'] * g['score_diff'] for g in all_games_data)
    sum_x2 = sum(g['skill_diff'] ** 2 for g in all_games_data)
    sum_y2 = sum(g['score_diff'] ** 2 for g in all_games_data)

    numerator = n * sum_xy - sum_x * sum_y
    denominator = ((n * sum_x2 - sum_x**2) * (n * sum_y2 - sum_y**2)) ** 0.5

    if denominator > 0:
        correlation = numerator / denominator
        print(f"Correlation between skill differential and score differential: {correlation:.3f}")
        print()

        if correlation > 0.7:
            print("[OK] STRONG positive correlation - blowouts are happening for the right reasons")
        elif correlation > 0.4:
            print("[MODERATE] Moderate correlation - some variance but generally proportional")
        else:
            print("[ISSUE] WEAK correlation - blowouts may not be proportional to skill gaps")

print()
print("=" * 80)
