"""
Compare Phase 1 original vs Phase 1 restored using proper weighted ratings.
"""

import json
import numpy as np
from pathlib import Path

# Normalized attribute weights based on actual game mechanics usage
# WITHOUT grip_strength in composites (Phase 1 original)
ATTRIBUTE_WEIGHTS_PHASE1_ORIGINAL = {
    'awareness': 0.1275,  # Will be higher without grip diluting it
    'jumping': 0.1234,
    'height': 0.1101,
    'composure': 0.0889,
    'hand_eye_coordination': 0.0858,
    'finesse': 0.0844,
    'agility': 0.0705,
    'balance': 0.0493,
    'reactions': 0.0428,
    'consistency': 0.0373,
    'form_technique': 0.0359,
    'acceleration': 0.0321,
    'arm_strength': 0.0299,
    'teamwork': 0.0299,
    'throw_accuracy': 0.0283,
    'top_speed': 0.0150,
    'core_strength': 0.0105,  # From WEIGHTS_TRANSITION_SUCCESS
    'creativity': 0.0074,
    'stamina': 0.0074,
    'determination': 0.0067,
    'bravery': 0.0060,
    'deception': 0.0052,
    'grip_strength': 0.0000,  # NOT in any composites
    'durability': 0.0000,
    'patience': 0.0000,
}

# WITH grip_strength in composites (Phase 1 restored)
ATTRIBUTE_WEIGHTS_PHASE1_RESTORED = {
    'awareness': 0.1221,  # Slightly lower due to grip
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
    'grip_strength': 0.0107,  # Now in composites at 1.07%
    'core_strength': 0.0100,
    'creativity': 0.0071,
    'stamina': 0.0071,
    'determination': 0.0064,
    'bravery': 0.0057,
    'deception': 0.0050,
    'durability': 0.0000,
    'patience': 0.0000,
}


def calculate_weighted_player_rating(player, weights):
    """Calculate player's weighted overall rating."""
    rating = 0.0
    for attr, weight in weights.items():
        rating += player.get(attr, 50) * weight
    return rating


def calculate_weighted_team_rating(team, weights):
    """Calculate team's weighted overall rating (starters weighted more)."""
    roster = team['roster']

    # Starters: first 5 players (35 minutes each)
    starter_ratings = [calculate_weighted_player_rating(roster[i], weights) for i in range(5)]
    starter_avg = np.mean(starter_ratings)

    # Bench: next 5 players (13 minutes each)
    bench_ratings = [calculate_weighted_player_rating(roster[i], weights) for i in range(5, 10)]
    bench_avg = np.mean(bench_ratings)

    # Weight by minutes: 175 starter min, 65 bench min
    weighted_rating = (starter_avg * 175 + bench_avg * 65) / 240
    return weighted_rating


def analyze_validation(val_dir_name, teams_dir_name, weights, label):
    """Analyze a validation using given attribute weights."""
    val_dir = Path(val_dir_name) / 'games'
    teams_dir = Path(teams_dir_name)

    # Load teams and calculate weighted ratings
    teams = {}
    for i in range(1, 101):
        with open(teams_dir / f'Team_{i:03d}.json') as f:
            team = json.load(f)
            weighted_rating = calculate_weighted_team_rating(team, weights)
            teams[team['name']] = {
                'simple_rating': team['actual_overall_rating'],
                'weighted_rating': weighted_rating
            }

    # Load games
    games = []
    for i in range(1, 101):
        with open(val_dir / f'game_{i:03d}.json') as f:
            games.append(json.load(f))

    # Calculate gaps and margins
    weighted_gaps = []
    margins = []

    for game in games:
        home_name = game['statistics']['home_team']
        away_name = game['statistics']['away_team']
        margin = game['statistics']['margin']

        weighted_home = teams[home_name]['weighted_rating']
        weighted_away = teams[away_name]['weighted_rating']

        if margin > 0:  # Home won
            weighted_gaps.append(weighted_home - weighted_away)
        else:  # Away won
            weighted_gaps.append(weighted_away - weighted_home)
            margin = abs(margin)

        margins.append(margin)

    # Calculate correlation
    correlation = np.corrcoef(weighted_gaps, margins)[0, 1]

    print(f"{label}:")
    print(f"  Validation: {val_dir_name}")
    print(f"  Teams: {teams_dir_name}")
    print(f"  Correlation: {correlation:.3f}")
    print(f"  Mean rating gap: {np.mean(weighted_gaps):.2f}")
    print(f"  Mean margin: {np.mean(margins):.2f}")
    print()

    return correlation


def main():
    print("=" * 80)
    print("COMPARING PHASE 1 CORRELATIONS WITH PROPER WEIGHTED RATINGS")
    print("=" * 80)
    print()

    # Analyze Phase 1 original (acceleration + top_speed, NO grip in composites)
    corr1 = analyze_validation(
        'validation_phase1',
        'teams_phase1',
        ATTRIBUTE_WEIGHTS_PHASE1_ORIGINAL,
        "PHASE 1 ORIGINAL (NO grip in composites)"
    )

    # Analyze Phase 1 restored (WITH grip in composites at 10%/5%)
    corr2 = analyze_validation(
        'validation_phase1_restored',
        'teams_phase1',
        ATTRIBUTE_WEIGHTS_PHASE1_RESTORED,
        "PHASE 1 RESTORED (WITH grip in composites)"
    )

    print("=" * 80)
    print("COMPARISON:")
    print("=" * 80)
    print(f"Phase 1 Original (no grip):  {corr1:.3f}")
    print(f"Phase 1 Restored (with grip): {corr2:.3f}")
    print(f"Change: {corr2 - corr1:+.3f} ({(corr2/corr1 - 1)*100:+.1f}%)")
    print()

    if abs(corr2 - corr1) < 0.05:
        print("✓ Correlations are very similar - grip integration has minimal impact")
    else:
        print("✗ Significant correlation change - investigating root cause...")


if __name__ == "__main__":
    main()
