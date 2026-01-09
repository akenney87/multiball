"""
Quick correlation calculator for Phase 1 validation results.
"""

import json
import statistics
from pathlib import Path


def calculate_team_avg_attributes(roster):
    """Calculate average of all 25 attributes across roster."""
    all_attrs = [
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
        for attr in all_attrs:
            if attr in player:
                total += player[attr]
                count += 1

    return total / count if count > 0 else 0.0


def load_validation_data(validation_dir, teams_dir):
    """Load games and teams from directories."""
    games = []
    games_path = Path(validation_dir) / "games"

    for game_file in sorted(games_path.glob("game_*.json")):
        with open(game_file, 'r') as f:
            games.append(json.load(f))

    teams = {}
    teams_path = Path(teams_dir)
    for team_file in teams_path.glob("Team_*.json"):
        with open(team_file, 'r') as f:
            team_data = json.load(f)
            teams[team_data['name']] = team_data

    return games, teams


def calculate_correlation(validation_dir, teams_dir):
    """Calculate attribute gap vs margin correlation."""
    games, teams = load_validation_data(validation_dir, teams_dir)

    data_points = []

    for game in games:
        home_team = game.get('home_team')
        away_team = game.get('away_team')

        if home_team not in teams or away_team not in teams:
            continue

        home_avg = calculate_team_avg_attributes(teams[home_team]['roster'])
        away_avg = calculate_team_avg_attributes(teams[away_team]['roster'])

        stats = game.get('statistics', {})
        home_score = stats.get('home_score', 0)
        away_score = stats.get('away_score', 0)
        margin = abs(home_score - away_score)

        if home_score > away_score:
            winner_avg = home_avg
            loser_avg = away_avg
        else:
            winner_avg = away_avg
            loser_avg = home_avg

        attribute_gap = winner_avg - loser_avg
        data_points.append({'gap': attribute_gap, 'margin': margin})

    # Calculate Pearson correlation
    gaps = [d['gap'] for d in data_points]
    margins = [d['margin'] for d in data_points]

    n = len(gaps)
    mean_gap = statistics.mean(gaps)
    mean_margin = statistics.mean(margins)

    numerator = sum((gaps[i] - mean_gap) * (margins[i] - mean_margin) for i in range(n))
    denom_gap = sum((gaps[i] - mean_gap) ** 2 for i in range(n))
    denom_margin = sum((margins[i] - mean_margin) ** 2 for i in range(n))

    correlation = numerator / (denom_gap ** 0.5 * denom_margin ** 0.5) if denom_gap > 0 and denom_margin > 0 else 0.0

    return {
        'correlation': correlation,
        'n_games': n,
        'mean_gap': mean_gap,
        'mean_margin': mean_margin
    }


if __name__ == "__main__":
    print("=" * 80)
    print("PHASE 1 CORRELATION ANALYSIS")
    print("=" * 80)

    # Before Phase 1 (M4.1 baseline)
    print("\nBEFORE Phase 1 (M4.1 baseline):")
    print("  Validation: validation_m41_test1")
    print("  Teams: teams_m41")

    before = calculate_correlation("validation_m41_test1", "teams_m41")
    print(f"  Correlation: {before['correlation']:.3f}")
    print(f"  Games: {before['n_games']}")
    print(f"  Mean attribute gap: {before['mean_gap']:.2f}")
    print(f"  Mean margin: {before['mean_margin']:.2f}")

    # After Phase 1
    print("\nAFTER Phase 1 (acceleration + top_speed integration):")
    print("  Validation: validation_phase1")
    print("  Teams: teams_phase1")

    phase1 = calculate_correlation("validation_phase1", "teams_phase1")
    print(f"  Correlation: {phase1['correlation']:.3f}")
    print(f"  Games: {phase1['n_games']}")
    print(f"  Mean attribute gap: {phase1['mean_gap']:.2f}")
    print(f"  Mean margin: {phase1['mean_margin']:.2f}")

    # After Phase 2 (original aggressive rates)
    print("\nAFTER Phase 2 (grip_strength - AGGRESSIVE rates):")
    print("  Validation: validation_phase2")
    print("  Teams: teams_phase2")

    phase2_aggressive = calculate_correlation("validation_phase2", "teams_phase2")
    print(f"  Correlation: {phase2_aggressive['correlation']:.3f}")
    print(f"  Games: {phase2_aggressive['n_games']}")
    print(f"  Mean attribute gap: {phase2_aggressive['mean_gap']:.2f}")
    print(f"  Mean margin: {phase2_aggressive['mean_margin']:.2f}")

    # After Phase 2 (tuned rates - still broken)
    print("\nAFTER Phase 2 (grip_strength - TUNED rates, broken formula):")
    print("  Validation: validation_phase2_tuned")
    print("  Teams: teams_phase2")

    phase2_tuned = calculate_correlation("validation_phase2_tuned", "teams_phase2")
    print(f"  Correlation: {phase2_tuned['correlation']:.3f}")
    print(f"  Games: {phase2_tuned['n_games']}")
    print(f"  Mean attribute gap: {phase2_tuned['mean_gap']:.2f}")
    print(f"  Mean margin: {phase2_tuned['mean_margin']:.2f}")

    # After Phase 2 (corrected formula)
    print("\nAFTER Phase 2 (grip_strength - CORRECTED multiplicative sigmoid):")
    print("  Validation: validation_phase2_corrected")
    print("  Teams: teams_phase2")

    phase2 = calculate_correlation("validation_phase2_corrected", "teams_phase2")
    print(f"  Correlation: {phase2['correlation']:.3f}")
    print(f"  Games: {phase2['n_games']}")
    print(f"  Mean attribute gap: {phase2['mean_gap']:.2f}")
    print(f"  Mean margin: {phase2['mean_margin']:.2f}")

    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)

    improvement_phase1 = phase1['correlation'] - before['correlation']
    pct_improvement_phase1 = (improvement_phase1 / abs(before['correlation'])) * 100 if before['correlation'] != 0 else 0

    improvement_phase2 = phase2['correlation'] - phase1['correlation']
    pct_improvement_phase2 = (improvement_phase2 / abs(phase1['correlation'])) * 100 if phase1['correlation'] != 0 else 0

    total_improvement = phase2['correlation'] - before['correlation']
    total_pct_improvement = (total_improvement / abs(before['correlation'])) * 100 if before['correlation'] != 0 else 0

    print(f"\nPhase 1: {before['correlation']:.3f} -> {phase1['correlation']:.3f} ({improvement_phase1:+.3f}, {pct_improvement_phase1:+.1f}%)")
    print(f"Phase 2: {phase1['correlation']:.3f} -> {phase2['correlation']:.3f} ({improvement_phase2:+.3f}, {pct_improvement_phase2:+.1f}%)")
    print(f"Total:   {before['correlation']:.3f} -> {phase2['correlation']:.3f} ({total_improvement:+.3f}, {total_pct_improvement:+.1f}%)")

    if phase2['correlation'] >= 0.38:
        print(f"\nStatus: EXCELLENT - Phase 2 correlation reached {phase2['correlation']:.3f} (target: 0.38+)")
        print("Proceed to Phase 3 (creativity + deception + patience) immediately.")
    elif improvement_phase2 > 0:
        print(f"\nStatus: PROGRESS - Phase 2 improved correlation by {improvement_phase2:.3f}")
        print("Continue with Phase 3 to push toward 0.40+ target.")
    else:
        print(f"\nStatus: STALLED - Phase 2 did not improve correlation")
        print("Diagnostic review required before proceeding to Phase 3.")
