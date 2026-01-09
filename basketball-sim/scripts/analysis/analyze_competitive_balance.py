"""
Analyze competitive balance issue

Investigate why 65% of games are blowouts (20+ margin) vs NBA 15-20%.
Check:
1. Team rating distribution (are teams too spread out?)
2. Rating gap → score gap correlation
3. Game outcomes by rating difference
"""

import json
import os
from collections import defaultdict

print("=" * 80)
print("COMPETITIVE BALANCE ANALYSIS")
print("=" * 80)

# Load validation results
results_dir = "validation_results_v3/games"
all_games = []

for filename in os.listdir(results_dir):
    if filename.endswith('.json') and not filename.endswith('_pbp.txt'):
        filepath = os.path.join(results_dir, filename)
        with open(filepath, 'r') as f:
            game_data = json.load(f)
            all_games.append(game_data)

print(f"\nLoaded {len(all_games)} games")

# Analyze team ratings
all_ratings = []
for game in all_games:
    all_ratings.append(game['statistics']['home_rating'])
    all_ratings.append(game['statistics']['away_rating'])

avg_rating = sum(all_ratings) / len(all_ratings)
min_rating = min(all_ratings)
max_rating = max(all_ratings)
rating_range = max_rating - min_rating

print(f"\n{'=' * 80}")
print("TEAM RATING DISTRIBUTION")
print("=" * 80)
print(f"Average rating: {avg_rating:.1f}")
print(f"Minimum rating: {min_rating:.1f}")
print(f"Maximum rating: {max_rating:.1f}")
print(f"Rating range: {rating_range:.1f}")

# Distribution by 5-point buckets
buckets = defaultdict(int)
for rating in all_ratings:
    bucket = int(rating // 5) * 5
    buckets[bucket] += 1

print(f"\nRating Distribution (5-point buckets):")
for bucket in sorted(buckets.keys()):
    count = buckets[bucket]
    bar = '#' * (count // 2)
    print(f"  {bucket}-{bucket+4}: {count:3d} teams {bar}")

# Analyze rating gap -> score gap correlation
print(f"\n{'=' * 80}")
print("RATING GAP -> SCORE GAP CORRELATION")
print("=" * 80)

gaps_by_rating_diff = defaultdict(list)

for game in all_games:
    home_rating = game['statistics']['home_rating']
    away_rating = game['statistics']['away_rating']
    home_score = game['statistics']['home_score']
    away_score = game['statistics']['away_score']

    rating_diff = abs(home_rating - away_rating)
    score_diff = abs(home_score - away_score)

    # Bucket by 2-point rating differences
    bucket = int(rating_diff // 2) * 2
    gaps_by_rating_diff[bucket].append(score_diff)

print("\nAverage Score Margin by Rating Difference:")
print(f"{'Rating Diff':<15} {'Avg Margin':<12} {'Games':<8} {'Blowouts (20+)'}")
print("-" * 60)

for bucket in sorted(gaps_by_rating_diff.keys()):
    margins = gaps_by_rating_diff[bucket]
    avg_margin = sum(margins) / len(margins)
    blowouts = sum(1 for m in margins if m >= 20)
    blowout_pct = 100 * blowouts / len(margins)

    print(f"{bucket}-{bucket+1} pts{'':<6} {avg_margin:6.1f}{'':<6} {len(margins):4d}    {blowouts:3d} ({blowout_pct:.0f}%)")

# Find worst blowouts
print(f"\n{'=' * 80}")
print("WORST BLOWOUTS (Top 10)")
print("=" * 80)

blowouts = []
for game in all_games:
    margin = abs(game['statistics']['home_score'] - game['statistics']['away_score'])
    if margin >= 30:
        blowouts.append({
            'game_num': game['game_number'],
            'home_team': game['home_team'],
            'away_team': game['away_team'],
            'home_rating': game['statistics']['home_rating'],
            'away_rating': game['statistics']['away_rating'],
            'rating_diff': abs(game['statistics']['home_rating'] - game['statistics']['away_rating']),
            'home_score': game['statistics']['home_score'],
            'away_score': game['statistics']['away_score'],
            'margin': margin
        })

blowouts_sorted = sorted(blowouts, key=lambda x: x['margin'], reverse=True)

for i, game in enumerate(blowouts_sorted[:10], 1):
    print(f"\n{i}. Game #{game['game_num']}: {game['home_team']} vs {game['away_team']}")
    print(f"   Ratings: {game['home_rating']:.1f} vs {game['away_rating']:.1f} (diff: {game['rating_diff']:.1f})")
    print(f"   Score: {game['home_score']} - {game['away_score']} (margin: {game['margin']})")

# Analyze close games
print(f"\n{'=' * 80}")
print("CLOSE GAMES ANALYSIS (≤5 margin)")
print("=" * 80)

close_games = []
for game in all_games:
    margin = abs(game['statistics']['home_score'] - game['statistics']['away_score'])
    if margin <= 5:
        close_games.append({
            'game_num': game['game_number'],
            'rating_diff': abs(game['statistics']['home_rating'] - game['statistics']['away_rating']),
            'margin': margin
        })

if close_games:
    avg_rating_diff = sum(g['rating_diff'] for g in close_games) / len(close_games)
    print(f"Total close games: {len(close_games)} (12%)")
    print(f"Average rating difference in close games: {avg_rating_diff:.1f}")

    # Distribution
    close_by_rating = defaultdict(int)
    for game in close_games:
        bucket = int(game['rating_diff'] // 2) * 2
        close_by_rating[bucket] += 1

    print(f"\nClose game distribution by rating difference:")
    for bucket in sorted(close_by_rating.keys()):
        count = close_by_rating[bucket]
        print(f"  {bucket}-{bucket+1} pts rating diff: {count} games")
else:
    print("No close games found!")

# Summary statistics
print(f"\n{'=' * 80}")
print("SUMMARY STATISTICS")
print("=" * 80)

margins = [abs(g['statistics']['home_score'] - g['statistics']['away_score']) for g in all_games]
avg_margin = sum(margins) / len(margins)
max_margin = max(margins)
min_margin = min(margins)

blowout_20 = sum(1 for m in margins if m >= 20)
blowout_30 = sum(1 for m in margins if m >= 30)
blowout_40 = sum(1 for m in margins if m >= 40)
close_5 = sum(1 for m in margins if m <= 5)
close_10 = sum(1 for m in margins if m <= 10)

print(f"Average margin: {avg_margin:.1f} points (NBA: ~11-12)")
print(f"Maximum margin: {max_margin} points")
print(f"Minimum margin: {min_margin} points")
print(f"\nGame distribution:")
print(f"  Blowouts (20+): {blowout_20} ({100*blowout_20/len(margins):.0f}%) - NBA: 15-20%")
print(f"  Massive (30+): {blowout_30} ({100*blowout_30/len(margins):.0f}%)")
print(f"  Absurd (40+): {blowout_40} ({100*blowout_40/len(margins):.0f}%)")
print(f"  Close (≤5): {close_5} ({100*close_5/len(margins):.0f}%) - NBA: 35-40%")
print(f"  Competitive (≤10): {close_10} ({100*close_10/len(margins):.0f}%) - NBA: 55-60%")

# Recommendations
print(f"\n{'=' * 80}")
print("DIAGNOSIS")
print("=" * 80)

# Check if rating range is too wide
if rating_range > 25:
    print(f"\n🔴 ISSUE: Rating range is TOO WIDE ({rating_range:.1f} points)")
    print(f"   NBA teams typically cluster within 15-20 point range (70-85 OVR)")
    print(f"   Our teams span {rating_range:.1f} points ({min_rating:.1f} to {max_rating:.1f})")
    print(f"   RECOMMENDATION: Constrain team generation to 60-80 OVR range")

# Check rating diff → margin correlation
avg_margins_by_diff = {}
for bucket in sorted(gaps_by_rating_diff.keys()):
    margins = gaps_by_rating_diff[bucket]
    avg_margins_by_diff[bucket] = sum(margins) / len(margins)

# If large rating diffs produce huge margins
if len(avg_margins_by_diff) > 0:
    large_diff_buckets = [b for b in avg_margins_by_diff.keys() if b >= 10]
    if large_diff_buckets:
        large_diff_avg = sum(avg_margins_by_diff[b] for b in large_diff_buckets) / len(large_diff_buckets)
        if large_diff_avg > 25:
            print(f"\n🔴 ISSUE: Large rating differences produce HUGE margins")
            print(f"   Rating diffs ≥10 produce avg margins of {large_diff_avg:.1f}")
            print(f"   This is 2-3x higher than NBA reality")
            print(f"   RECOMMENDATION: Add variance/upset mechanics to reduce determinism")

print("\n" + "=" * 80)
