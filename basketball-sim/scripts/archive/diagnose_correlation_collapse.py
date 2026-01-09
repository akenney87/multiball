"""
URGENT DIAGNOSTIC: Correlation Collapse Investigation

This script will:
1. Generate fresh teams
2. Run 20 games with current code
3. Calculate correlation
4. Analyze attribute impact on game outcomes
5. Compare with expected behavior
"""

import json
import random
import sys
from pathlib import Path
import numpy as np

# Import simulator
sys.path.insert(0, str(Path(__file__).parent))

from src.systems.game_simulation import simulate_game
from src.core.data_structures import TacticalSettings

# Import team generator
from generate_teams import generate_team, ALL_ATTRIBUTES


def calculate_team_avg_rating(team):
    """Simple average of all attributes across top 8 players."""
    top_8 = team['roster'][:8]
    all_values = []
    for player in top_8:
        for attr in ALL_ATTRIBUTES:
            if attr in player:
                all_values.append(player[attr])
    return np.mean(all_values) if all_values else 50.0


def run_diagnostic_test():
    """Run comprehensive diagnostic on correlation."""
    print("=" * 80)
    print("CORRELATION COLLAPSE DIAGNOSTIC")
    print("=" * 80)
    print()

    # Set seed for reproducibility
    random.seed(12345)

    print("STEP 1: Generating Fresh Teams")
    print("-" * 80)

    # Generate 6 teams with varying quality
    teams = []
    quality_levels = [57, 59, 61, 63, 65, 67]  # Tight range like current generator

    for i, quality in enumerate(quality_levels):
        team = generate_team(f"Team_{i+1:03d}", quality)
        rating = calculate_team_avg_rating(team)
        teams.append(team)
        print(f"  Team {i+1}: Target={quality}, Actual Rating={rating:.2f}")

    print()

    # Verify team variance
    ratings = [calculate_team_avg_rating(t) for t in teams]
    print(f"  Team Quality Range: {min(ratings):.2f} - {max(ratings):.2f}")
    print(f"  Std Dev: {np.std(ratings):.2f}")
    print()

    if np.std(ratings) < 1.5:
        print("  WARNING: Very low team variance! This will hurt correlation.")
        print()

    print("STEP 2: Running Matchups")
    print("-" * 80)

    # Run 15 games with varying quality gaps
    matchups = [
        (0, 1),  # 57 vs 59 (close)
        (0, 2),  # 57 vs 61 (moderate)
        (0, 3),  # 57 vs 63 (significant)
        (0, 4),  # 57 vs 65 (large)
        (0, 5),  # 57 vs 67 (very large)
        (1, 2),  # 59 vs 61
        (1, 3),  # 59 vs 63
        (1, 4),  # 59 vs 65
        (1, 5),  # 59 vs 67
        (2, 3),  # 61 vs 63
        (2, 4),  # 61 vs 65
        (2, 5),  # 61 vs 67
        (3, 4),  # 63 vs 65
        (3, 5),  # 63 vs 67
        (4, 5),  # 65 vs 67
    ]

    results = []

    # Default tactical settings
    tactical_home = TacticalSettings(
        pace='standard',
        man_defense_pct=100,
        scoring_option_1=None,
        scoring_option_2=None,
        scoring_option_3=None,
        minutes_allotment={},
        rebounding_strategy='standard'
    )
    tactical_away = tactical_home

    for idx, (home_idx, away_idx) in enumerate(matchups, 1):
        home_team = teams[home_idx]
        away_team = teams[away_idx]

        home_rating = ratings[home_idx]
        away_rating = ratings[away_idx]
        rating_gap = home_rating - away_rating

        print(f"  Game {idx:2d}: {home_team['name']} ({home_rating:.1f}) vs {away_team['name']} ({away_rating:.1f}), Gap={rating_gap:+.1f}")

        # Run game
        game_result = simulate_game(
            home_team=home_team,
            away_team=away_team,
            tactical_settings_home=tactical_home,
            tactical_settings_away=tactical_away,
            random_seed=1000 + idx
        )

        home_score = game_result['statistics']['home_score']
        away_score = game_result['statistics']['away_score']
        margin = home_score - away_score

        print(f"           Score: {home_score}-{away_score}, Margin={margin:+d}")

        # Check if better team won
        expected_winner = 'home' if rating_gap > 0 else 'away' if rating_gap < 0 else 'even'
        actual_winner = 'home' if margin > 0 else 'away' if margin < 0 else 'tie'

        upset = False
        if expected_winner == 'home' and actual_winner == 'away':
            upset = True
        elif expected_winner == 'away' and actual_winner == 'home':
            upset = True

        if upset:
            print(f"           UPSET: Underdog won!")

        results.append({
            'home_team': home_team['name'],
            'away_team': away_team['name'],
            'home_rating': home_rating,
            'away_rating': away_rating,
            'rating_gap': rating_gap,
            'home_score': home_score,
            'away_score': away_score,
            'margin': margin,
            'upset': upset
        })

        print()

    print()
    print("STEP 3: Correlation Analysis")
    print("-" * 80)

    # Calculate correlation
    rating_gaps = [r['rating_gap'] for r in results]
    margins = [r['margin'] for r in results]

    # Pearson correlation
    correlation = np.corrcoef(rating_gaps, margins)[0, 1]

    print(f"  Pearson Correlation: {correlation:.4f}")
    print()

    # Expected correlation analysis
    if correlation < 0:
        print("  CRITICAL: NEGATIVE CORRELATION!")
        print("  This means better teams are LOSING more often.")
        print("  This is completely broken.")
    elif correlation < 0.15:
        print("  CRITICAL: Near-zero correlation!")
        print("  Team quality has almost no impact on outcomes.")
    elif correlation < 0.30:
        print("  WARNING: Very low correlation.")
        print("  Team quality has weak impact.")
    elif correlation < 0.40:
        print("  OK: Moderate correlation (acceptable range).")
    else:
        print("  EXCELLENT: Strong correlation!")

    print()

    # Analyze upsets
    upsets = [r for r in results if r['upset']]
    print(f"  Upsets: {len(upsets)}/{len(results)} ({len(upsets)/len(results)*100:.1f}%)")
    print()

    # Expected vs actual winner analysis
    print("STEP 4: Quality vs Outcome Analysis")
    print("-" * 80)

    # Group by rating gap magnitude
    small_gap = [r for r in results if abs(r['rating_gap']) < 2.0]
    medium_gap = [r for r in results if 2.0 <= abs(r['rating_gap']) < 4.0]
    large_gap = [r for r in results if abs(r['rating_gap']) >= 4.0]

    def analyze_group(group, label):
        if not group:
            return

        favorites_won = sum(1 for r in group if (r['rating_gap'] > 0 and r['margin'] > 0) or (r['rating_gap'] < 0 and r['margin'] < 0))
        win_rate = favorites_won / len(group) * 100
        avg_margin = np.mean([abs(r['margin']) for r in group])

        print(f"  {label}:")
        print(f"    Games: {len(group)}")
        print(f"    Favorite Win Rate: {win_rate:.1f}%")
        print(f"    Average Margin: {avg_margin:.1f} points")
        print()

    analyze_group(small_gap, "Small Gap (<2 points)")
    analyze_group(medium_gap, "Medium Gap (2-4 points)")
    analyze_group(large_gap, "Large Gap (4+ points)")

    print()
    print("STEP 5: Diagnostic Summary")
    print("-" * 80)

    # Check for red flags
    red_flags = []

    if correlation < 0.15:
        red_flags.append("Correlation near zero or negative")

    if np.std(ratings) < 1.5:
        red_flags.append("Team quality variance too low")

    if len(upsets) / len(results) > 0.50:
        red_flags.append("Over 50% upsets (random outcomes)")

    # Check if margins are too small/large
    avg_margin = np.mean([abs(r['margin']) for r in results])
    if avg_margin < 5:
        red_flags.append(f"Average margin too small ({avg_margin:.1f} points)")
    elif avg_margin > 20:
        red_flags.append(f"Average margin too large ({avg_margin:.1f} points)")

    if red_flags:
        print("  RED FLAGS DETECTED:")
        for flag in red_flags:
            print(f"    - {flag}")
    else:
        print("  No major red flags detected.")

    print()
    print("=" * 80)
    print("DIAGNOSIS COMPLETE")
    print("=" * 80)

    return correlation, results


if __name__ == "__main__":
    correlation, results = run_diagnostic_test()

    # Save results
    output = {
        'correlation': float(correlation),
        'games': results
    }

    with open('diagnostic_correlation_results.json', 'w') as f:
        json.dump(output, f, indent=2)

    print()
    print(f"Results saved to: diagnostic_correlation_results.json")
    print(f"Final Correlation: {correlation:.4f}")
