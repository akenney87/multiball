"""
Diagnostic Suite for Competitive Balance Analysis

Investigates why blowouts are 38% (vs 15-20% target) and close games are 15% (vs 35-40% target).

Three analyses:
1. Attribute Disparity vs Margin Correlation
2. Contest Rate Distribution
3. Tactical Effectiveness in Blowouts
"""

import json
import os
from pathlib import Path
from typing import List, Dict, Any
import statistics


def load_validation_games(validation_dir: str) -> List[Dict[str, Any]]:
    """Load all game JSONs from validation directory."""
    games = []
    games_dir = Path(validation_dir) / "games"

    if not games_dir.exists():
        print(f"ERROR: Games directory not found: {games_dir}")
        return games

    for game_file in sorted(games_dir.glob("game_*.json")):
        with open(game_file, 'r') as f:
            games.append(json.load(f))

    return games


def load_teams(teams_dir: str) -> Dict[str, Dict[str, Any]]:
    """Load all team JSONs into a dictionary keyed by team name."""
    teams = {}
    teams_path = Path(teams_dir)

    if not teams_path.exists():
        print(f"ERROR: Teams directory not found: {teams_path}")
        return teams

    for team_file in teams_path.glob("Team_*.json"):
        with open(team_file, 'r') as f:
            team_data = json.load(f)
            teams[team_data['name']] = team_data

    return teams


def calculate_team_average_attributes(roster: List[Dict[str, Any]]) -> float:
    """Calculate average of all attributes across all players in roster."""
    all_attributes = [
        'grip_strength', 'arm_strength', 'core_strength', 'agility',
        'acceleration', 'top_speed', 'jumping', 'reactions', 'stamina',
        'balance', 'height', 'durability', 'awareness', 'creativity',
        'determination', 'bravery', 'consistency', 'composure', 'patience',
        'hand_eye_coordination', 'throw_accuracy', 'form_technique',
        'finesse', 'deception', 'teamwork'
    ]

    total = 0
    count = 0

    for player in roster:
        for attr in all_attributes:
            if attr in player:
                total += player[attr]
                count += 1

    return total / count if count > 0 else 0.0


def analysis_1_attribute_disparity(games: List[Dict], teams: Dict[str, Dict]) -> Dict[str, Any]:
    """
    Analysis 1: Attribute Disparity vs Margin Correlation

    For each game, calculate:
    - AttributeGap = mean(winner_attributes) - mean(loser_attributes)
    - Correlation between AttributeGap and FinalMargin
    """
    print("\n" + "="*80)
    print("ANALYSIS 1: ATTRIBUTE DISPARITY VS MARGIN CORRELATION")
    print("="*80)

    data_points = []

    for game in games:
        home_team = game.get('home_team')
        away_team = game.get('away_team')

        # Get team data
        if home_team not in teams or away_team not in teams:
            continue

        home_roster = teams[home_team]['roster']
        away_roster = teams[away_team]['roster']

        # Calculate average attributes
        home_avg = calculate_team_average_attributes(home_roster)
        away_avg = calculate_team_average_attributes(away_roster)

        # Get final scores
        stats = game.get('statistics', {})
        home_score = stats.get('home_score', 0)
        away_score = stats.get('away_score', 0)
        margin = abs(home_score - away_score)

        # Determine winner/loser attributes
        if home_score > away_score:
            winner_avg = home_avg
            loser_avg = away_avg
        else:
            winner_avg = away_avg
            loser_avg = home_avg

        attribute_gap = winner_avg - loser_avg

        data_points.append({
            'attribute_gap': attribute_gap,
            'margin': margin,
            'home_team': home_team,
            'away_team': away_team,
            'home_avg': home_avg,
            'away_avg': away_avg,
            'home_score': home_score,
            'away_score': away_score
        })

    # Calculate correlation
    if len(data_points) < 2:
        print("ERROR: Not enough data points for correlation")
        return {}

    gaps = [d['attribute_gap'] for d in data_points]
    margins = [d['margin'] for d in data_points]

    # Pearson correlation coefficient
    n = len(gaps)
    mean_gap = statistics.mean(gaps)
    mean_margin = statistics.mean(margins)

    numerator = sum((gaps[i] - mean_gap) * (margins[i] - mean_margin) for i in range(n))
    denominator_gap = sum((gaps[i] - mean_gap) ** 2 for i in range(n))
    denominator_margin = sum((margins[i] - mean_margin) ** 2 for i in range(n))

    correlation = numerator / (denominator_gap ** 0.5 * denominator_margin ** 0.5) if denominator_gap > 0 and denominator_margin > 0 else 0.0

    # Categorize games
    blowouts = [d for d in data_points if d['margin'] >= 20]
    close_games = [d for d in data_points if d['margin'] <= 5]

    blowout_avg_gap = statistics.mean([d['attribute_gap'] for d in blowouts]) if blowouts else 0
    close_avg_gap = statistics.mean([d['attribute_gap'] for d in close_games]) if close_games else 0

    print(f"\nTotal Games Analyzed: {len(data_points)}")
    print(f"\nCorrelation Coefficient (AttributeGap vs Margin): {correlation:.3f}")
    print(f"  Interpretation: {'VERY HIGH' if abs(correlation) > 0.7 else 'HIGH' if abs(correlation) > 0.5 else 'MODERATE' if abs(correlation) > 0.3 else 'LOW'}")
    print(f"  {'⚠️  DETERMINISTIC - Attribute advantage too predictive' if abs(correlation) > 0.7 else '✓ Reasonable attribute impact'}")

    print(f"\nAttribute Gap Analysis:")
    print(f"  Mean attribute gap (all games): {statistics.mean(gaps):.2f}")
    print(f"  Median attribute gap: {statistics.median(gaps):.2f}")
    print(f"  Std dev attribute gap: {statistics.stdev(gaps) if len(gaps) > 1 else 0:.2f}")

    print(f"\nBlowouts (20+ margin): {len(blowouts)} games ({len(blowouts)/len(data_points)*100:.1f}%)")
    print(f"  Avg attribute gap in blowouts: {blowout_avg_gap:.2f}")

    print(f"\nClose Games (≤5 margin): {len(close_games)} games ({len(close_games)/len(data_points)*100:.1f}%)")
    print(f"  Avg attribute gap in close games: {close_avg_gap:.2f}")

    if blowouts and close_games:
        gap_ratio = blowout_avg_gap / close_avg_gap if close_avg_gap > 0 else float('inf')
        print(f"\nBlowout Gap / Close Game Gap Ratio: {gap_ratio:.2f}x")
        print(f"  {'⚠️  Talent disparities are runaway' if gap_ratio > 3.0 else '✓ Reasonable disparity distribution'}")

    # Show extreme examples
    print(f"\nMost Lopsided Blowouts (Top 5):")
    sorted_blowouts = sorted(blowouts, key=lambda x: x['margin'], reverse=True)[:5]
    for i, game in enumerate(sorted_blowouts, 1):
        print(f"  {i}. {game['home_team']} vs {game['away_team']}: {game['home_score']}-{game['away_score']} (margin {game['margin']})")
        print(f"     Attribute gap: {game['attribute_gap']:.2f} (Winner avg: {max(game['home_avg'], game['away_avg']):.1f}, Loser avg: {min(game['home_avg'], game['away_avg']):.1f})")

    return {
        'correlation': correlation,
        'mean_gap': statistics.mean(gaps),
        'median_gap': statistics.median(gaps),
        'blowout_avg_gap': blowout_avg_gap,
        'close_avg_gap': close_avg_gap,
        'gap_ratio': gap_ratio if blowouts and close_games else None,
        'data_points': data_points
    }


def analysis_2_contest_rate_distribution(games: List[Dict]) -> Dict[str, Any]:
    """
    Analysis 2: Contest Rate Distribution

    Pull shot contest data from game logs to determine:
    - % of shots that are Wide Open (6+ ft)
    - % of shots that are Contested (2-6 ft)
    - % of shots that are Heavily Contested (<2 ft)

    Target: ~25% wide open, ~45% contested, ~30% heavily contested (NBA distribution)
    """
    print("\n" + "="*80)
    print("ANALYSIS 2: CONTEST RATE DISTRIBUTION")
    print("="*80)

    print("\n⚠️  NOTE: This analysis requires shot-level data from game logs.")
    print("Current validation JSON files contain aggregated statistics only.")
    print("To perform this analysis, we need to:")
    print("  1. Modify game_simulation.py to export shot-level data")
    print("  2. OR run diagnostic games with verbose logging")
    print("  3. OR sample 10 games and parse play-by-play output")

    print("\n❌ SKIPPING - Requires implementation of shot-level data export")

    return {
        'skipped': True,
        'reason': 'Requires shot-level data not present in validation JSONs'
    }


def analysis_3_tactical_effectiveness(games: List[Dict], teams: Dict[str, Dict]) -> Dict[str, Any]:
    """
    Analysis 3: Tactical Effectiveness in Blowouts

    For games decided by 20+ points:
    - Did losing team's tactical settings differ from winning team?
    - If tactics were similar, are they decorative?
    - If tactics differed, did they create observable differences in stats?
    """
    print("\n" + "="*80)
    print("ANALYSIS 3: TACTICAL EFFECTIVENESS")
    print("="*80)

    print("\n⚠️  NOTE: This analysis requires tactical settings data from games.")
    print("Current validation JSON files do not store tactical settings used.")
    print("Tactical settings are defined in demo scripts but not logged in game output.")

    print("\n❌ SKIPPING - Requires tactical settings logging in game simulation")

    return {
        'skipped': True,
        'reason': 'Tactical settings not logged in validation game JSONs'
    }


def main():
    """Run all diagnostic analyses."""
    print("\n" + "="*80)
    print("COMPETITIVE BALANCE DIAGNOSTIC SUITE")
    print("="*80)
    print("\nTarget: Identify root cause of competitive balance issues")
    print("  - Blowouts (20+): 38% (target 15-20%)")
    print("  - Close games (<=5): 15% (target 35-40%)")
    print("  - Average margin: 17.6 (target 11-13)")

    # Load data
    validation_dir = "validation_m41_test1"
    teams_dir = "teams_m41"

    print(f"\nLoading data from:")
    print(f"  Validation: {validation_dir}")
    print(f"  Teams: {teams_dir}")

    games = load_validation_games(validation_dir)
    teams = load_teams(teams_dir)

    print(f"\nLoaded: {len(games)} games, {len(teams)} teams")

    if not games or not teams:
        print("\n❌ ERROR: Could not load validation data")
        return

    # Run analyses
    results = {}

    # Analysis 1: Attribute Disparity (can run with current data)
    results['attribute_disparity'] = analysis_1_attribute_disparity(games, teams)

    # Analysis 2: Contest Rate Distribution (needs shot-level data)
    results['contest_distribution'] = analysis_2_contest_rate_distribution(games)

    # Analysis 3: Tactical Effectiveness (needs tactical settings logging)
    results['tactical_effectiveness'] = analysis_3_tactical_effectiveness(games, teams)

    # Save results
    output_file = "diagnostic_competitive_balance_results.json"
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)

    print("\n" + "="*80)
    print("DIAGNOSTIC SUITE COMPLETE")
    print("="*80)
    print(f"\nResults saved to: {output_file}")
    print("\nNext steps:")
    print("  1. Review correlation coefficient (>0.7 indicates determinism problem)")
    print("  2. Check attribute gap ratio (blowouts vs close games)")
    print("  3. Implement shot-level logging for Analysis 2")
    print("  4. Implement tactical settings logging for Analysis 3")


if __name__ == "__main__":
    main()
