"""
Recalculate correlation using WEIGHTED overall ratings based on actual attribute importance.
"""

import json
import numpy as np
from pathlib import Path

# Normalized attribute weights based on actual game mechanics usage
# (from analyze_attribute_usage.py)
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
    """Calculate player's weighted overall rating based on attribute importance."""
    rating = 0.0
    for attr, weight in ATTRIBUTE_WEIGHTS.items():
        rating += player.get(attr, 50) * weight
    return rating


def calculate_weighted_team_rating(team):
    """
    Calculate team's weighted overall rating.
    Weights starters (35 min) more than bench (13 min).
    """
    roster = team['roster']

    # Starters: first 5 players (35 minutes each)
    starter_ratings = [calculate_weighted_player_rating(roster[i]) for i in range(5)]
    starter_avg = np.mean(starter_ratings)

    # Bench: next 5 players (13 minutes each)
    bench_ratings = [calculate_weighted_player_rating(roster[i]) for i in range(5, 10)]
    bench_avg = np.mean(bench_ratings)

    # Weight by minutes: starters 35min, bench 13min
    # Total minutes = 5*35 + 5*13 = 175 + 65 = 240
    weighted_rating = (starter_avg * 175 + bench_avg * 65) / 240

    return weighted_rating


def main():
    print("=" * 80)
    print("RECALCULATING CORRELATION WITH PROPER WEIGHTED RATINGS")
    print("=" * 80)
    print()

    # Load validation results
    val_dir = Path('validation_phase1_restored/games')
    teams_dir = Path('teams_phase1')

    # Load teams and calculate weighted ratings
    teams = {}
    for i in range(1, 101):
        with open(teams_dir / f'Team_{i:03d}.json') as f:
            team = json.load(f)
            weighted_rating = calculate_weighted_team_rating(team)
            teams[team['name']] = {
                'simple_rating': team['actual_overall_rating'],
                'weighted_rating': weighted_rating
            }

    # Load games and calculate correlations
    games = []
    for i in range(1, 101):
        with open(val_dir / f'game_{i:03d}.json') as f:
            games.append(json.load(f))

    # Calculate attribute gaps and margins using BOTH rating methods
    simple_gaps = []
    weighted_gaps = []
    margins = []

    for game in games:
        home_name = game['statistics']['home_team']
        away_name = game['statistics']['away_team']
        margin = game['statistics']['margin']

        # Simple rating (old method)
        simple_home = game['statistics']['home_rating']
        simple_away = game['statistics']['away_rating']

        # Weighted rating (new method)
        weighted_home = teams[home_name]['weighted_rating']
        weighted_away = teams[away_name]['weighted_rating']

        # Winner's rating advantage
        if margin > 0:  # Home won
            simple_gaps.append(simple_home - simple_away)
            weighted_gaps.append(weighted_home - weighted_away)
        else:  # Away won
            simple_gaps.append(simple_away - simple_home)
            weighted_gaps.append(weighted_away - weighted_home)
            margin = abs(margin)

        margins.append(margin)

    # Calculate correlations
    simple_correlation = np.corrcoef(simple_gaps, margins)[0, 1]
    weighted_correlation = np.corrcoef(weighted_gaps, margins)[0, 1]

    print(f"VALIDATION: validation_phase1_restored (Phase 2 revised with grip in composites)")
    print(f"Teams: teams_phase1")
    print(f"Games: {len(games)}")
    print()
    print(f"SIMPLE RATING (average of all 25 attributes):")
    print(f"  Correlation: {simple_correlation:.3f}")
    print(f"  Mean rating gap: {np.mean(simple_gaps):.2f}")
    print(f"  Mean margin: {np.mean(margins):.2f}")
    print()
    print(f"WEIGHTED RATING (based on actual gameplay importance):")
    print(f"  Correlation: {weighted_correlation:.3f}")
    print(f"  Mean rating gap: {np.mean(weighted_gaps):.2f}")
    print(f"  Mean margin: {np.mean(margins):.2f}")
    print()
    print(f"Improvement: {weighted_correlation - simple_correlation:+.3f} ({(weighted_correlation/simple_correlation - 1)*100:+.1f}%)")
    print()

    # Compare to what correlation SHOULD be (Phase 1 without grip in composites)
    print("=" * 80)
    print("IMPORTANT: This is Phase 2 revised (with grip_strength in composites)")
    print("We expect weighted correlation to be HIGHER than simple (0.139)")
    print("But Phase 1 baseline (without grip in composites) was 0.339")
    print("=" * 80)


if __name__ == "__main__":
    main()
