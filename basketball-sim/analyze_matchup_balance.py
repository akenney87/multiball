"""
Analyze matchup balance in validation games.
Check if blowouts are happening in balanced vs mismatched games.
"""

import json
from pathlib import Path

games_dir = Path('validation/correlation_test/games')

# Categorize games by rating differential
very_balanced = []  # 0-5 rating difference
balanced = []       # 5-10 rating difference
moderate = []       # 10-15 rating difference
large_gap = []      # 15+ rating difference

for game_file in sorted(games_dir.glob('game_*.json')):
    with open(game_file) as f:
        game = json.load(f)

    home_rating = game['statistics']['home_rating']
    away_rating = game['statistics']['away_rating']
    home_score = game['statistics']['home_score']
    away_score = game['statistics']['away_score']

    rating_diff = abs(home_rating - away_rating)
    score_diff = abs(home_score - away_score)
    is_blowout = score_diff >= 20

    game_data = {
        'game': game_file.name,
        'home': game['statistics']['home_team'],
        'away': game['statistics']['away_team'],
        'home_rating': home_rating,
        'away_rating': away_rating,
        'rating_diff': rating_diff,
        'home_score': home_score,
        'away_score': away_score,
        'score_diff': score_diff,
        'is_blowout': is_blowout
    }

    if rating_diff < 5:
        very_balanced.append(game_data)
    elif rating_diff < 10:
        balanced.append(game_data)
    elif rating_diff < 15:
        moderate.append(game_data)
    else:
        large_gap.append(game_data)

print("=" * 80)
print("MATCHUP BALANCE ANALYSIS")
print("=" * 80)
print()

print(f"Total games: 100")
print()

categories = [
    ("Very Balanced (0-5 rating pts)", very_balanced),
    ("Balanced (5-10 rating pts)", balanced),
    ("Moderate Gap (10-15 rating pts)", moderate),
    ("Large Gap (15+ rating pts)", large_gap)
]

for category_name, games in categories:
    if not games:
        continue

    blowouts = sum(1 for g in games if g['is_blowout'])
    blowout_pct = (blowouts / len(games)) * 100 if games else 0
    avg_score_diff = sum(g['score_diff'] for g in games) / len(games)
    avg_rating_diff = sum(g['rating_diff'] for g in games) / len(games)

    print(f"{category_name}:")
    print(f"  Games: {len(games)}")
    print(f"  Avg rating diff: {avg_rating_diff:.1f}")
    print(f"  Avg score margin: {avg_score_diff:.1f}")
    print(f"  Blowouts (20+ pts): {blowouts}/{len(games)} ({blowout_pct:.1f}%)")
    print()

# Show sample blowouts from very balanced games
print("=" * 80)
print("SAMPLE BLOWOUTS FROM VERY BALANCED MATCHUPS (0-5 rating diff)")
print("=" * 80)
print()

very_balanced_blowouts = [g for g in very_balanced if g['is_blowout']]
if very_balanced_blowouts:
    for game in very_balanced_blowouts[:5]:
        print(f"{game['home']} ({game['home_rating']:.1f}) vs {game['away']} ({game['away_rating']:.1f})")
        print(f"  Rating diff: {game['rating_diff']:.1f}")
        print(f"  Final: {game['home_score']}-{game['away_score']} (Margin: {game['score_diff']})")
        print()
else:
    print("No blowouts in very balanced matchups")
print()

print("=" * 80)
print("CRITICAL FINDING")
print("=" * 80)
if very_balanced and sum(1 for g in very_balanced if g['is_blowout']) / len(very_balanced) > 0.3:
    print("[WARNING] >30% of balanced matchups (0-5 rating diff) are blowouts!")
    print("This suggests excessive variance/randomness overwhelming skill.")
else:
    print("[OK] Blowout rate in balanced matchups seems reasonable.")
