"""
Debug the anomaly: Why do teams with 3-4 rating advantage only win 43% of the time?
"""

import json
import numpy as np
from pathlib import Path

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
    rating = 0.0
    for attr, weight in ATTRIBUTE_WEIGHTS.items():
        rating += player.get(attr, 50) * weight
    return rating


def calculate_weighted_team_rating(team):
    roster = team['roster']
    starter_ratings = [calculate_weighted_player_rating(roster[i]) for i in range(5)]
    bench_ratings = [calculate_weighted_player_rating(roster[i]) for i in range(5, 10)]
    starter_avg = np.mean(starter_ratings)
    bench_avg = np.mean(bench_ratings)
    return (starter_avg * 175 + bench_avg * 65) / 240


# Load teams
teams_dir = Path('teams_phase1')
teams = {}

for i in range(1, 101):
    with open(teams_dir / f'Team_{i:03d}.json') as f:
        team = json.load(f)
        rating = calculate_weighted_team_rating(team)
        teams[team['name']] = rating

# Load games
val_dir = Path('validation_phase1_restored/games')
games_with_3_4_diff = []

for i in range(1, 101):
    with open(val_dir / f'game_{i:03d}.json') as f:
        game = json.load(f)
        home_name = game['statistics']['home_team']
        away_name = game['statistics']['away_team']
        home_score = game['statistics']['home_score']
        away_score = game['statistics']['away_score']

        home_rating = teams[home_name]
        away_rating = teams[away_name]
        rating_diff = abs(home_rating - away_rating)

        if 3.0 <= rating_diff < 4.0:
            # Determine favorite
            if home_rating > away_rating:
                favorite = 'home'
                favorite_rating = home_rating
                underdog_rating = away_rating
                favorite_score = home_score
                underdog_score = away_score
            else:
                favorite = 'away'
                favorite_rating = away_rating
                underdog_rating = home_rating
                favorite_score = away_score
                underdog_score = home_score

            favorite_won = favorite_score > underdog_score

            games_with_3_4_diff.append({
                'game_num': i,
                'home_team': home_name,
                'away_team': away_name,
                'home_rating': home_rating,
                'away_rating': away_rating,
                'rating_diff': rating_diff,
                'favorite': favorite,
                'favorite_rating': favorite_rating,
                'underdog_rating': underdog_rating,
                'favorite_score': favorite_score,
                'underdog_score': underdog_score,
                'favorite_won': favorite_won,
                'margin': abs(favorite_score - underdog_score),
                'quarter_scores': game['quarter_scores']
            })

print("=" * 80)
print("GAMES WITH 3-4 RATING DIFFERENTIAL")
print("=" * 80)
print(f"Total games: {len(games_with_3_4_diff)}")
print(f"Favorite wins: {sum(g['favorite_won'] for g in games_with_3_4_diff)}")
print(f"Upset wins: {sum(not g['favorite_won'] for g in games_with_3_4_diff)}")
print()

# Show all games
print("ALL GAMES IN THIS RANGE:")
print("-" * 80)
for g in games_with_3_4_diff:
    result = "WIN" if g['favorite_won'] else "LOSS"
    print(f"Game {g['game_num']:3d}: {g['home_team']} ({g['home_rating']:.2f}) vs {g['away_team']} ({g['away_rating']:.2f})")
    print(f"    Favorite: {g['favorite']}, Rating diff: {g['rating_diff']:.2f}")
    print(f"    Score: {g['favorite_score']}-{g['underdog_score']} ({result})")
    print(f"    Quarters: {g['quarter_scores']}")
    print()

# Analyze patterns in upsets
upsets = [g for g in games_with_3_4_diff if not g['favorite_won']]
if upsets:
    print()
    print("=" * 80)
    print(f"ANALYZING {len(upsets)} UPSETS:")
    print("=" * 80)
    print(f"Average rating diff in upsets: {np.mean([g['rating_diff'] for g in upsets]):.2f}")
    print(f"Average upset margin: {np.mean([g['margin'] for g in upsets]):.2f}")
    print()

    # Check for systematic issues
    home_upsets = sum(1 for g in upsets if g['favorite'] == 'away')
    away_upsets = sum(1 for g in upsets if g['favorite'] == 'home')
    print(f"Home underdogs won: {home_upsets}")
    print(f"Away underdogs won: {away_upsets}")
