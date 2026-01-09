"""
Thorough investigation of why correlation is so low (0.070-0.162).

This script checks:
1. Are all game actions using attribute weights?
2. Is there too much randomness in the simulation?
3. Do team quality differences actually translate to gameplay advantages?
4. Are there any bugs causing random outcomes?
"""

import json
import numpy as np
from pathlib import Path
from collections import defaultdict

# Weighted rating calculation
ATTRIBUTE_WEIGHTS = {
    'awareness': 0.1221,
    'jumping': 0.1179,
    'height': 0.1052,
    'composure': 0.0850,
    'hand_eye_coordination': 0.0821,
    'finesse': 0.0807,
    'agility': 0.0674,
    'balance': 0.0471,
    'reactions': 0.0409,
    'consistency': 0.0357,
    'form_technique': 0.0343,
    'acceleration': 0.0307,
    'arm_strength': 0.0286,
    'teamwork': 0.0286,
    'throw_accuracy': 0.0271,
    'top_speed': 0.0143,
    'grip_strength': 0.0107,
    'core_strength': 0.0100,
    'creativity': 0.0071,
    'stamina': 0.0071,
    'determination': 0.0064,
    'bravery': 0.0057,
    'deception': 0.0050,
    'durability': 0.0000,
    'patience': 0.0000,
}


def calculate_weighted_player_rating(player):
    """Calculate player's weighted overall rating."""
    rating = 0.0
    for attr, weight in ATTRIBUTE_WEIGHTS.items():
        rating += player.get(attr, 50) * weight
    return rating


def calculate_weighted_team_rating(team):
    """Calculate team's weighted overall rating (starters weighted more)."""
    roster = team['roster']

    # Starters: first 5 players (35 minutes each)
    starter_ratings = [calculate_weighted_player_rating(roster[i]) for i in range(5)]
    starter_avg = np.mean(starter_ratings)

    # Bench: next 5 players (13 minutes each)
    bench_ratings = [calculate_weighted_player_rating(roster[i]) for i in range(5, 10)]
    bench_avg = np.mean(bench_ratings)

    # Weight by minutes
    weighted_rating = (starter_avg * 175 + bench_avg * 65) / 240
    return weighted_rating


def main():
    print("=" * 80)
    print("CORRELATION INVESTIGATION")
    print("=" * 80)
    print()

    # Load teams
    teams_dir = Path('teams_phase1')
    teams = {}
    team_ratings = []

    for i in range(1, 101):
        with open(teams_dir / f'Team_{i:03d}.json') as f:
            team = json.load(f)
            rating = calculate_weighted_team_rating(team)
            teams[team['name']] = {
                'rating': rating,
                'data': team
            }
            team_ratings.append(rating)

    print("STEP 1: Team Quality Distribution")
    print("-" * 80)
    print(f"Team Ratings (weighted by attribute importance):")
    print(f"  Mean: {np.mean(team_ratings):.2f}")
    print(f"  Std Dev: {np.std(team_ratings):.2f}")
    print(f"  Min: {min(team_ratings):.2f}")
    print(f"  Max: {max(team_ratings):.2f}")
    print(f"  Range: {max(team_ratings) - min(team_ratings):.2f}")
    print()

    # Check if there's meaningful variance
    if np.std(team_ratings) < 2.0:
        print("  WARNING: Very low variance in team quality!")
        print("  Teams may be too similar for quality to matter.")
    else:
        print("  OK: Decent variance in team quality.")
    print()

    # Load games and analyze outcomes
    print("STEP 2: Do Better Teams Win More Often?")
    print("-" * 80)

    val_dir = Path('validation_phase1_restored/games')
    games = []

    for i in range(1, 101):
        with open(val_dir / f'game_{i:03d}.json') as f:
            games.append(json.load(f))

    # Analyze games by rating differential
    rating_diffs = []
    results = []  # 1 if favorite won, 0 if underdog won
    margins = []

    for game in games:
        home_name = game['statistics']['home_team']
        away_name = game['statistics']['away_team']
        home_score = game['statistics']['home_score']
        away_score = game['statistics']['away_score']

        home_rating = teams[home_name]['rating']
        away_rating = teams[away_name]['rating']

        rating_diff = abs(home_rating - away_rating)
        rating_diffs.append(rating_diff)

        # Did the favorite win?
        if home_rating > away_rating:
            favorite_won = home_score > away_score
        else:
            favorite_won = away_score > home_score

        results.append(1 if favorite_won else 0)
        margins.append(abs(home_score - away_score))

    # Group by rating differential
    buckets = {
        'Very Close (0-1)': [],
        'Close (1-2)': [],
        'Moderate (2-3)': [],
        'Large (3-4)': [],
        'Very Large (4+)': []
    }

    for i, diff in enumerate(rating_diffs):
        if diff < 1:
            buckets['Very Close (0-1)'].append(results[i])
        elif diff < 2:
            buckets['Close (1-2)'].append(results[i])
        elif diff < 3:
            buckets['Moderate (2-3)'].append(results[i])
        elif diff < 4:
            buckets['Large (3-4)'].append(results[i])
        else:
            buckets['Very Large (4+)'].append(results[i])

    print("Favorite Win Rate by Rating Differential:")
    for bucket_name, bucket_results in buckets.items():
        if bucket_results:
            win_rate = np.mean(bucket_results) * 100
            count = len(bucket_results)
            print(f"  {bucket_name:<25} {win_rate:>5.1f}% ({count:>2} games)")
    print()

    overall_favorite_win_rate = np.mean(results) * 100
    print(f"Overall Favorite Win Rate: {overall_favorite_win_rate:.1f}%")
    print()

    if overall_favorite_win_rate < 55:
        print("  WARNING: Favorites barely win more than 50%!")
        print("  Team quality may not be translating to game performance.")
    elif overall_favorite_win_rate < 65:
        print("  CONCERN: Favorites should win more often in a good simulation.")
    else:
        print("  OK: Favorites win at reasonable rate.")
    print()

    # Analyze correlation
    print("STEP 3: Correlation Analysis")
    print("-" * 80)

    weighted_gaps = []
    for i, game in enumerate(games):
        home_name = game['statistics']['home_team']
        away_name = game['statistics']['away_team']
        margin = game['statistics']['margin']

        home_rating = teams[home_name]['rating']
        away_rating = teams[away_name]['rating']

        if margin > 0:  # Home won
            weighted_gaps.append(home_rating - away_rating)
        else:  # Away won
            weighted_gaps.append(away_rating - home_rating)

    correlation = np.corrcoef(weighted_gaps, margins)[0, 1]
    print(f"Correlation (Rating Gap vs Margin): {correlation:.3f}")
    print()

    if correlation < 0.20:
        print("  CRITICAL: Correlation is very low!")
        print("  Rating differences barely predict margin.")
    elif correlation < 0.30:
        print("  WARNING: Correlation is low.")
    elif correlation < 0.40:
        print("  OK: Decent correlation.")
    else:
        print("  EXCELLENT: Strong correlation.")
    print()

    # Check for specific issues
    print("STEP 4: Potential Issues")
    print("-" * 80)

    # Check if upsets (underdog wins) have patterns
    upsets = [i for i, r in enumerate(results) if r == 0]
    upset_rating_diffs = [rating_diffs[i] for i in upsets]
    upset_margins = [margins[i] for i in upsets]

    print(f"Total Upsets (underdog wins): {len(upsets)}/100")
    if len(upsets) > 0:
        print(f"  Average rating diff in upsets: {np.mean(upset_rating_diffs):.2f}")
        print(f"  Average upset margin: {np.mean(upset_margins):.2f}")
    print()

    # Check variance in margins
    print(f"Margin Statistics:")
    print(f"  Mean margin: {np.mean(margins):.2f}")
    print(f"  Std dev margin: {np.std(margins):.2f}")
    print()

    # Suggest next steps
    print("=" * 80)
    print("DIAGNOSTIC RECOMMENDATIONS")
    print("=" * 80)
    print()

    if np.std(team_ratings) < 2.0:
        print("1. TEAM GENERATION ISSUE:")
        print("   Teams have insufficient quality variance.")
        print("   -> Increase spread in team generation")
        print()

    if overall_favorite_win_rate < 60:
        print("2. GAME MECHANICS ISSUE:")
        print("   Better teams don't win enough.")
        print("   -> Check if attribute weights are too weak")
        print("   -> Check for excessive randomness in game mechanics")
        print()

    if correlation < 0.25:
        print("3. CORRELATION ISSUE:")
        print("   Rating gap doesn't predict margin well.")
        print("   -> Margin may be too random (blowouts/comebacks)")
        print("   -> Check for quarter-to-quarter variance")
        print()


if __name__ == "__main__":
    main()
