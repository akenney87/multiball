"""
Calculate correlation for the final recalibrated validation.
"""
import json
import os
from scipy import stats

# Load validation results - ratings are in game stats
validation_dir = 'validation_final_recalibrated/games'
rating_gaps = []
margins = []

for i in range(1, 101):
    game_file = os.path.join(validation_dir, f'game_{i:03d}.json')
    with open(game_file) as f:
        game = json.load(f)

    # Get ratings from game statistics
    home_rating = game['statistics']['home_rating']
    away_rating = game['statistics']['away_rating']
    rating_gap = home_rating - away_rating

    # Get margin (positive if home won, negative if home lost)
    margin = game['statistics']['margin']
    if game['statistics']['home_score'] < game['statistics']['away_score']:
        margin = -margin

    rating_gaps.append(rating_gap)
    margins.append(margin)

# Calculate correlation
correlation, p_value = stats.pearsonr(rating_gaps, margins)

print("=" * 80)
print("FINAL CORRELATION ANALYSIS - RECALIBRATED SYSTEM")
print("=" * 80)
print(f"\nCorrelation: {correlation:.4f}")
print(f"P-value: {p_value:.6f}")
print(f"Sample size: {len(rating_gaps)} games")

# Compare with previous
print("\n" + "=" * 80)
print("COMPARISON")
print("=" * 80)
print(f"Before fix (broken formula): 0.162")
print(f"After fix (recalibrated):    {correlation:.3f}")
print(f"Improvement: {(correlation - 0.162) / 0.162 * 100:+.1f}%")
print("\nTarget range: 0.35 - 0.50")
if correlation >= 0.35:
    print("✓ ACHIEVED TARGET!")
else:
    print(f"Still below target by {(0.35 - correlation):.3f}")
