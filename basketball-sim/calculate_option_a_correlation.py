"""
Calculate correlation from Option A validation games.
"""

import json
import math
from pathlib import Path

games_dir = Path('validation/option_a_test/games')

rating_diffs = []
score_diffs = []

for game_file in sorted(games_dir.glob('game_*.json')):
    with open(game_file) as f:
        game = json.load(f)

    # Use ratings stored in game file (from simulation time)
    home_rating = game['statistics']['home_rating']
    away_rating = game['statistics']['away_rating']

    home_score = game['statistics']['home_score']
    away_score = game['statistics']['away_score']

    rating_diff = home_rating - away_rating
    score_diff = home_score - away_score

    rating_diffs.append(rating_diff)
    score_diffs.append(score_diff)

# Calculate Pearson correlation
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

correlation = pearson_correlation(rating_diffs, score_diffs)

print("=" * 80)
print("VALIDATION GAMES CORRELATION (After Option A)")
print("=" * 80)
print(f"Games analyzed: {len(rating_diffs)}")
print(f"Pearson correlation (rating_diff vs score_diff): {correlation:.4f}")
print()
print("Rating distribution:")
print(f"  Min rating diff: {min(rating_diffs):.1f}")
print(f"  Max rating diff: {max(rating_diffs):.1f}")
print(f"  Avg rating diff: {sum([abs(r) for r in rating_diffs])/len(rating_diffs):.1f}")
print()
print("Score distribution:")
print(f"  Min score diff: {min(score_diffs)}")
print(f"  Max score diff: {max(score_diffs)}")
print(f"  Avg margin: {sum([abs(s) for s in score_diffs])/len(score_diffs):.1f}")
print()
print("Blowout analysis:")
blowouts = sum(1 for s in score_diffs if abs(s) >= 20)
print(f"  Blowouts (20+ points): {blowouts}/100 ({blowouts}%)")
print()

if correlation >= 0.80:
    print("[EXCELLENT] Correlation >= 0.80 - Attributes properly weighted!")
elif correlation >= 0.70:
    print("[GOOD] Correlation >= 0.70 - Working well")
elif correlation >= 0.50:
    print("[CAUTION] Correlation 0.50-0.70 - May need tuning")
else:
    print("[WARNING] Correlation < 0.50 - Investigation needed!")
