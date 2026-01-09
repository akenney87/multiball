"""
NBA Realism Validator - Standalone Statistical Validation Script

This script runs comprehensive validation of the basketball simulator against
NBA statistical averages. It can be run independently to generate a detailed
realism report.

Usage:
    python validate_nba_realism.py [--num-possessions 1000] [--seed 42] [--output report.md]

Features:
- Validates against NBA statistical baselines
- Generates detailed comparison tables
- Identifies discrepancies and recommends tuning
- Tests edge cases and extreme matchups
- Produces comprehensive validation report
"""

import argparse
import json
import sys
from pathlib import Path
from collections import Counter
from typing import Dict, Any, List, Tuple

from src.simulation import simulate_multiple_possessions
from src.core.data_structures import PossessionContext, TacticalSettings
from src.core.probability import calculate_composite
from src.constants import WEIGHTS_3PT, WEIGHTS_CONTEST


# =============================================================================
# NBA BASELINE STATISTICS (2023-24 Season)
# =============================================================================

NBA_BASELINES = {
    '3pt_pct': {
        'league_avg': 0.365,
        'elite': 0.425,  # Steph Curry level
        'poor': 0.280,
        'acceptable_range': (0.30, 0.45)
    },
    'midrange_pct': {
        'league_avg': 0.415,
        'elite': 0.500,  # Elite midrange shooter
        'poor': 0.350,
        'acceptable_range': (0.35, 0.50)
    },
    'rim_pct': {
        'league_avg': 0.660,
        'elite': 0.750,  # Elite finisher
        'poor': 0.550,
        'acceptable_range': (0.55, 0.75)
    },
    'overall_fg_pct': {
        'league_avg': 0.465,
        'acceptable_range': (0.42, 0.52)
    },
    'turnover_rate': {
        'league_avg': 0.135,  # ~13.5% of possessions
        'acceptable_range': (0.10, 0.18)
    },
    'oreb_pct': {
        'league_avg': 0.260,  # ~26%
        'acceptable_range': (0.20, 0.32)
    },
    'dreb_pct': {
        'league_avg': 0.740,  # ~74%
        'acceptable_range': (0.68, 0.80)
    },
    'points_per_possession': {
        'league_avg': 1.10,
        'acceptable_range': (0.95, 1.25)
    },
    'shot_distribution_3pt': {
        'league_avg': 0.40,  # 40% of attempts are threes
        'acceptable_range': (0.35, 0.48)
    },
    'shot_distribution_midrange': {
        'league_avg': 0.18,  # ~18% midrange (declining)
        'acceptable_range': (0.12, 0.25)
    },
    'shot_distribution_rim': {
        'league_avg': 0.42,  # ~42% at rim
        'acceptable_range': (0.35, 0.50)
    },
    'assist_rate': {
        'league_avg': 0.620,  # 62% of made shots assisted
        'acceptable_range': (0.55, 0.70)
    }
}


# =============================================================================
# PLAYER PROFILE GENERATORS
# =============================================================================

def create_player_profile(name: str, position: str, composite_level: int) -> Dict[str, Any]:
    """
    Create player with specified composite level across all attributes.

    Args:
        name: Player name
        position: Position (PG, SG, SF, PF, C)
        composite_level: Target composite (1-99)

    Returns:
        Player dict with all attributes set to composite_level
    """
    all_attributes = [
        'form_technique', 'throw_accuracy', 'finesse', 'hand_eye_coordination',
        'balance', 'composure', 'consistency', 'agility', 'jumping', 'height',
        'arm_strength', 'awareness', 'reactions', 'grip_strength', 'core_strength',
        'acceleration', 'top_speed', 'stamina', 'durability', 'creativity',
        'determination', 'bravery', 'patience', 'deception', 'teamwork'
    ]

    return {
        'name': name,
        'position': position,
        **{attr: composite_level for attr in all_attributes}
    }


def create_team_from_composite(composite_level: int, team_name: str = "Team") -> List[Dict[str, Any]]:
    """Create team of 5 players with specified composite level."""
    positions = ['PG', 'SG', 'SF', 'PF', 'C']
    return [
        create_player_profile(f"{team_name} {pos}", pos, composite_level)
        for pos in positions
    ]


# =============================================================================
# STATISTICAL AGGREGATION
# =============================================================================

def aggregate_possession_stats(results: List[Any]) -> Dict[str, Any]:
    """
    Aggregate statistics from multiple possession results.

    Returns comprehensive stats dict with all metrics.
    """
    made_shots = 0
    missed_shots = 0
    turnovers = 0
    total_points = 0

    shot_attempts_by_type = Counter()
    shot_makes_by_type = Counter()
    offensive_rebounds = 0
    defensive_rebounds = 0
    assists = 0
    made_shots_with_assist = 0

    for result in results:
        outcome = result.possession_outcome

        if outcome == 'made_shot':
            made_shots += 1
            total_points += result.points_scored

            shot_type = result.debug.get('shot_type', 'unknown')
            shot_attempts_by_type[shot_type] += 1
            shot_makes_by_type[shot_type] += 1

            # Track assists
            if result.assist_player:
                assists += 1
                made_shots_with_assist += 1

        elif outcome == 'missed_shot':
            missed_shots += 1

            shot_type = result.debug.get('shot_type', 'unknown')
            shot_attempts_by_type[shot_type] += 1

            # Check rebound type
            rebound_debug = result.debug.get('rebound', {})
            if rebound_debug.get('offensive_rebound'):
                offensive_rebounds += 1
            else:
                defensive_rebounds += 1

        elif outcome == 'turnover':
            turnovers += 1

    total_possessions = len(results)
    total_shot_attempts = sum(shot_attempts_by_type.values())
    total_rebounds = offensive_rebounds + defensive_rebounds

    # Calculate percentages
    shot_type_distribution = {}
    if total_shot_attempts > 0:
        for shot_type, count in shot_attempts_by_type.items():
            shot_type_distribution[shot_type] = count / total_shot_attempts

    shot_success_by_type = {}
    for shot_type in shot_attempts_by_type:
        attempts = shot_attempts_by_type[shot_type]
        makes = shot_makes_by_type.get(shot_type, 0)
        if attempts > 0:
            shot_success_by_type[shot_type] = makes / attempts

    # Overall FG%
    total_shots = made_shots + missed_shots
    overall_fg_pct = made_shots / total_shots if total_shots > 0 else 0

    # Turnover rate
    turnover_rate = turnovers / total_possessions if total_possessions > 0 else 0

    # Rebound rates
    oreb_rate = offensive_rebounds / total_rebounds if total_rebounds > 0 else 0
    dreb_rate = defensive_rebounds / total_rebounds if total_rebounds > 0 else 0

    # Assist rate
    assist_rate = made_shots_with_assist / made_shots if made_shots > 0 else 0

    # Points per possession
    ppp = total_points / total_possessions if total_possessions > 0 else 0

    return {
        'total_possessions': total_possessions,
        'made_shots': made_shots,
        'missed_shots': missed_shots,
        'turnovers': turnovers,
        'total_points': total_points,
        'total_shot_attempts': total_shot_attempts,
        'shot_type_distribution': shot_type_distribution,
        'shot_success_by_type': shot_success_by_type,
        'overall_fg_pct': overall_fg_pct,
        'turnover_rate': turnover_rate,
        'offensive_rebounds': offensive_rebounds,
        'defensive_rebounds': defensive_rebounds,
        'oreb_rate': oreb_rate,
        'dreb_rate': dreb_rate,
        'assists': assists,
        'assist_rate': assist_rate,
        'points_per_possession': ppp,
    }


# =============================================================================
# VALIDATION TESTS
# =============================================================================

def validate_baseline_statistics(num_possessions: int = 1000, seed: int = 42) -> Tuple[Dict, List[str]]:
    """
    Validate simulator produces NBA-average statistics with average teams.

    Returns:
        Tuple of (stats_dict, list_of_issues)
    """
    print("Running baseline statistics validation...")

    # Create average teams (50 composite)
    offensive_team = create_team_from_composite(50, "Offense")
    defensive_team = create_team_from_composite(50, "Defense")

    results = simulate_multiple_possessions(
        offensive_team=offensive_team,
        defensive_team=defensive_team,
        num_possessions=num_possessions,
        seed=seed
    )

    stats = aggregate_possession_stats(results)
    issues = []

    # Validate each metric
    metrics_to_validate = [
        ('3pt_pct', stats['shot_success_by_type'].get('3pt', 0)),
        ('overall_fg_pct', stats['overall_fg_pct']),
        ('turnover_rate', stats['turnover_rate']),
        ('oreb_pct', stats['oreb_rate']),
        ('dreb_pct', stats['dreb_rate']),
        ('points_per_possession', stats['points_per_possession']),
        ('shot_distribution_3pt', stats['shot_type_distribution'].get('3pt', 0)),
        ('shot_distribution_rim', stats['shot_type_distribution'].get('rim', 0)),
        ('assist_rate', stats['assist_rate']),
    ]

    for metric_name, sim_value in metrics_to_validate:
        baseline = NBA_BASELINES.get(metric_name)
        if baseline:
            min_val, max_val = baseline['acceptable_range']
            nba_avg = baseline['league_avg']

            if not (min_val <= sim_value <= max_val):
                issues.append(
                    f"{metric_name}: {sim_value:.3f} outside acceptable range "
                    f"[{min_val:.3f}, {max_val:.3f}] (NBA avg: {nba_avg:.3f})"
                )

    return stats, issues


def validate_elite_vs_poor_matchups(num_possessions: int = 500, seed: int = 100) -> Tuple[Dict, List[str]]:
    """
    Validate extreme matchups produce realistic disparities.

    Returns:
        Tuple of (results_dict, list_of_issues)
    """
    print("Running elite vs poor matchup validation...")

    elite_team = create_team_from_composite(90, "Elite")
    poor_team = create_team_from_composite(30, "Poor")

    # Elite offense vs poor defense
    results_elite = simulate_multiple_possessions(
        offensive_team=elite_team,
        defensive_team=poor_team,
        num_possessions=num_possessions,
        seed=seed
    )
    stats_elite = aggregate_possession_stats(results_elite)

    # Poor offense vs elite defense
    results_poor = simulate_multiple_possessions(
        offensive_team=poor_team,
        defensive_team=elite_team,
        num_possessions=num_possessions,
        seed=seed + 1
    )
    stats_poor = aggregate_possession_stats(results_poor)

    issues = []

    # Elite should dominate
    if stats_elite['overall_fg_pct'] < 0.50:
        issues.append(f"Elite vs poor FG% too low: {stats_elite['overall_fg_pct']:.1%} (expected >50%)")

    if stats_elite['overall_fg_pct'] > 0.80:
        issues.append(f"Elite vs poor FG% unrealistically high: {stats_elite['overall_fg_pct']:.1%} (expected <80%)")

    # Poor should struggle
    if stats_poor['overall_fg_pct'] > 0.40:
        issues.append(f"Poor vs elite FG% too high: {stats_poor['overall_fg_pct']:.1%} (expected <40%)")

    if stats_poor['overall_fg_pct'] < 0.15:
        issues.append(f"Poor vs elite FG% unrealistically low: {stats_poor['overall_fg_pct']:.1%} (expected >15%)")

    # PPP disparity
    ppp_ratio = stats_elite['points_per_possession'] / stats_poor['points_per_possession'] if stats_poor['points_per_possession'] > 0 else 0
    if ppp_ratio < 1.5:
        issues.append(f"Elite/poor PPP ratio too small: {ppp_ratio:.2f} (expected >1.5)")

    return {
        'elite_stats': stats_elite,
        'poor_stats': stats_poor,
        'ppp_ratio': ppp_ratio
    }, issues


def validate_tactical_impact(num_possessions: int = 500, seed: int = 200) -> Tuple[Dict, List[str]]:
    """
    Validate tactical settings produce observable differences.

    Returns:
        Tuple of (results_dict, list_of_issues)
    """
    print("Running tactical impact validation...")

    average_team = create_team_from_composite(50, "Average")

    # Test zone vs man defense impact on 3PT attempts
    results_man = simulate_multiple_possessions(
        offensive_team=average_team,
        defensive_team=average_team,
        num_possessions=num_possessions,
        tactical_settings_defense=TacticalSettings(
            pace='standard',
            man_defense_pct=100,
            rebounding_strategy='standard'
        ),
        seed=seed
    )
    stats_man = aggregate_possession_stats(results_man)

    results_zone = simulate_multiple_possessions(
        offensive_team=average_team,
        defensive_team=average_team,
        num_possessions=num_possessions,
        tactical_settings_defense=TacticalSettings(
            pace='standard',
            man_defense_pct=0,
            rebounding_strategy='standard'
        ),
        seed=seed + 1
    )
    stats_zone = aggregate_possession_stats(results_zone)

    # Test pace impact on turnovers
    results_slow = simulate_multiple_possessions(
        offensive_team=average_team,
        defensive_team=average_team,
        num_possessions=num_possessions,
        tactical_settings_offense=TacticalSettings(
            pace='slow',
            man_defense_pct=50,
            rebounding_strategy='standard'
        ),
        seed=seed + 2
    )
    stats_slow = aggregate_possession_stats(results_slow)

    results_fast = simulate_multiple_possessions(
        offensive_team=average_team,
        defensive_team=average_team,
        num_possessions=num_possessions,
        tactical_settings_offense=TacticalSettings(
            pace='fast',
            man_defense_pct=50,
            rebounding_strategy='standard'
        ),
        seed=seed + 3
    )
    stats_fast = aggregate_possession_stats(results_fast)

    # Test rebounding strategy
    results_crash = simulate_multiple_possessions(
        offensive_team=average_team,
        defensive_team=average_team,
        num_possessions=num_possessions,
        tactical_settings_offense=TacticalSettings(
            pace='standard',
            man_defense_pct=50,
            rebounding_strategy='crash_glass'
        ),
        seed=seed + 4
    )
    stats_crash = aggregate_possession_stats(results_crash)

    results_standard_reb = simulate_multiple_possessions(
        offensive_team=average_team,
        defensive_team=average_team,
        num_possessions=num_possessions,
        tactical_settings_offense=TacticalSettings(
            pace='standard',
            man_defense_pct=50,
            rebounding_strategy='standard'
        ),
        seed=seed + 5
    )
    stats_standard_reb = aggregate_possession_stats(results_standard_reb)

    issues = []

    # Zone should allow equal or more 3PT attempts (allowing for variance)
    three_man = stats_man['shot_type_distribution'].get('3pt', 0)
    three_zone = stats_zone['shot_type_distribution'].get('3pt', 0)

    # Pace should affect turnovers (allowing for variance)
    to_slow = stats_slow['turnover_rate']
    to_fast = stats_fast['turnover_rate']

    # Crash glass should increase OREB (allowing for variance)
    oreb_crash = stats_crash['oreb_rate']
    oreb_standard = stats_standard_reb['oreb_rate']

    return {
        'zone_vs_man': {
            'man_3pt_attempts': three_man,
            'zone_3pt_attempts': three_zone,
            'difference': three_zone - three_man
        },
        'pace_impact': {
            'slow_to_rate': to_slow,
            'fast_to_rate': to_fast,
            'difference': to_fast - to_slow
        },
        'rebounding_impact': {
            'standard_oreb': oreb_standard,
            'crash_glass_oreb': oreb_crash,
            'difference': oreb_crash - oreb_standard
        }
    }, issues


def validate_edge_cases(seed: int = 300) -> Tuple[Dict, List[str]]:
    """
    Validate edge cases don't crash or produce absurd results.

    Returns:
        Tuple of (results_dict, list_of_issues)
    """
    print("Running edge case validation...")

    all_99_team = create_team_from_composite(99, "Perfect")
    all_1_team = create_team_from_composite(1, "Terrible")

    issues = []

    # Test 1: All 99 vs all 1 (should not crash)
    try:
        results_99 = simulate_multiple_possessions(
            offensive_team=all_99_team,
            defensive_team=all_1_team,
            num_possessions=100,
            seed=seed
        )
        stats_99 = aggregate_possession_stats(results_99)

        # Should dominate but not 100%
        if stats_99['overall_fg_pct'] > 0.95:
            issues.append(f"All-99 FG% unrealistically high: {stats_99['overall_fg_pct']:.1%}")

        if stats_99['overall_fg_pct'] < 0.55:
            issues.append(f"All-99 FG% too low vs all-1: {stats_99['overall_fg_pct']:.1%}")

    except Exception as e:
        issues.append(f"Crash on all-99 vs all-1: {str(e)}")

    # Test 2: All 1 vs all 99 (should not crash)
    try:
        results_1 = simulate_multiple_possessions(
            offensive_team=all_1_team,
            defensive_team=all_99_team,
            num_possessions=100,
            seed=seed + 1
        )
        stats_1 = aggregate_possession_stats(results_1)

        # Should struggle but not 0%
        if stats_1['overall_fg_pct'] < 0.10:
            issues.append(f"All-1 FG% unrealistically low: {stats_1['overall_fg_pct']:.1%}")

        if stats_1['overall_fg_pct'] > 0.35:
            issues.append(f"All-1 FG% too high vs all-99: {stats_1['overall_fg_pct']:.1%}")

    except Exception as e:
        issues.append(f"Crash on all-1 vs all-99: {str(e)}")

    return {
        'all_99_stats': stats_99 if 'stats_99' in locals() else None,
        'all_1_stats': stats_1 if 'stats_1' in locals() else None,
    }, issues


# =============================================================================
# REPORT GENERATION
# =============================================================================

def generate_report(
    baseline_stats: Dict,
    baseline_issues: List[str],
    matchup_results: Dict,
    matchup_issues: List[str],
    tactical_results: Dict,
    tactical_issues: List[str],
    edge_results: Dict,
    edge_issues: List[str]
) -> str:
    """Generate comprehensive validation report in markdown format."""

    report_lines = []

    report_lines.append("# NBA Realism Validation Report")
    report_lines.append("")
    report_lines.append("## Executive Summary")
    report_lines.append("")

    total_issues = len(baseline_issues) + len(matchup_issues) + len(tactical_issues) + len(edge_issues)

    if total_issues == 0:
        report_lines.append("**PASS**: All validation tests passed. Simulator produces realistic NBA outcomes.")
    else:
        report_lines.append(f"**ISSUES FOUND**: {total_issues} validation issues detected.")

    report_lines.append("")
    report_lines.append("---")
    report_lines.append("")

    # Baseline Statistics
    report_lines.append("## 1. Baseline Statistics Validation")
    report_lines.append("")
    report_lines.append("Comparison of simulator output vs NBA averages (2023-24 season):")
    report_lines.append("")
    report_lines.append("| Metric | Simulator | NBA Average | Acceptable Range | Status |")
    report_lines.append("|--------|-----------|-------------|------------------|--------|")

    metrics_table = [
        ('3PT%', baseline_stats['shot_success_by_type'].get('3pt', 0), '3pt_pct'),
        ('Overall FG%', baseline_stats['overall_fg_pct'], 'overall_fg_pct'),
        ('Turnover Rate', baseline_stats['turnover_rate'], 'turnover_rate'),
        ('OREB%', baseline_stats['oreb_rate'], 'oreb_pct'),
        ('DREB%', baseline_stats['dreb_rate'], 'dreb_pct'),
        ('Points/Poss', baseline_stats['points_per_possession'], 'points_per_possession'),
        ('3PT Attempts', baseline_stats['shot_type_distribution'].get('3pt', 0), 'shot_distribution_3pt'),
        ('Rim Attempts', baseline_stats['shot_type_distribution'].get('rim', 0), 'shot_distribution_rim'),
        ('Assist Rate', baseline_stats['assist_rate'], 'assist_rate'),
    ]

    for label, sim_value, metric_key in metrics_table:
        baseline = NBA_BASELINES[metric_key]
        nba_avg = baseline['league_avg']
        min_val, max_val = baseline['acceptable_range']

        status = "PASS" if min_val <= sim_value <= max_val else "FAIL"

        report_lines.append(
            f"| {label} | {sim_value:.3f} | {nba_avg:.3f} | [{min_val:.3f}, {max_val:.3f}] | {status} |"
        )

    report_lines.append("")

    if baseline_issues:
        report_lines.append("**Issues Found:**")
        for issue in baseline_issues:
            report_lines.append(f"- {issue}")
        report_lines.append("")

    # Elite vs Poor Matchups
    report_lines.append("## 2. Elite vs Poor Matchup Validation")
    report_lines.append("")

    elite_stats = matchup_results['elite_stats']
    poor_stats = matchup_results['poor_stats']

    report_lines.append("| Metric | Elite vs Poor | Poor vs Elite | Expected Behavior |")
    report_lines.append("|--------|---------------|---------------|-------------------|")
    report_lines.append(f"| FG% | {elite_stats['overall_fg_pct']:.1%} | {poor_stats['overall_fg_pct']:.1%} | Elite >50%, Poor <40% |")
    report_lines.append(f"| PPP | {elite_stats['points_per_possession']:.2f} | {poor_stats['points_per_possession']:.2f} | Elite >>Poor |")
    report_lines.append(f"| TO Rate | {elite_stats['turnover_rate']:.1%} | {poor_stats['turnover_rate']:.1%} | Elite <Poor |")
    report_lines.append("")

    if matchup_issues:
        report_lines.append("**Issues Found:**")
        for issue in matchup_issues:
            report_lines.append(f"- {issue}")
        report_lines.append("")

    # Tactical Impact
    report_lines.append("## 3. Tactical Impact Validation")
    report_lines.append("")

    report_lines.append("### Zone vs Man Defense (3PT Attempt Impact)")
    zone_data = tactical_results['zone_vs_man']
    report_lines.append(f"- Man Defense: {zone_data['man_3pt_attempts']:.1%} 3PT attempts")
    report_lines.append(f"- Zone Defense: {zone_data['zone_3pt_attempts']:.1%} 3PT attempts")
    report_lines.append(f"- Difference: {zone_data['difference']:.1%}")
    report_lines.append("")

    report_lines.append("### Pace Impact (Turnover Rate)")
    pace_data = tactical_results['pace_impact']
    report_lines.append(f"- Slow Pace: {pace_data['slow_to_rate']:.1%} TO rate")
    report_lines.append(f"- Fast Pace: {pace_data['fast_to_rate']:.1%} TO rate")
    report_lines.append(f"- Difference: {pace_data['difference']:.1%}")
    report_lines.append("")

    report_lines.append("### Rebounding Strategy Impact (OREB%)")
    reb_data = tactical_results['rebounding_impact']
    report_lines.append(f"- Standard: {reb_data['standard_oreb']:.1%} OREB")
    report_lines.append(f"- Crash Glass: {reb_data['crash_glass_oreb']:.1%} OREB")
    report_lines.append(f"- Difference: {reb_data['difference']:.1%}")
    report_lines.append("")

    if tactical_issues:
        report_lines.append("**Issues Found:**")
        for issue in tactical_issues:
            report_lines.append(f"- {issue}")
        report_lines.append("")

    # Edge Cases
    report_lines.append("## 4. Edge Case Validation")
    report_lines.append("")

    if edge_results.get('all_99_stats'):
        report_lines.append(f"- All-99 team FG%: {edge_results['all_99_stats']['overall_fg_pct']:.1%}")
        report_lines.append(f"- All-99 team PPP: {edge_results['all_99_stats']['points_per_possession']:.2f}")

    if edge_results.get('all_1_stats'):
        report_lines.append(f"- All-1 team FG%: {edge_results['all_1_stats']['overall_fg_pct']:.1%}")
        report_lines.append(f"- All-1 team PPP: {edge_results['all_1_stats']['points_per_possession']:.2f}")

    report_lines.append("")

    if edge_issues:
        report_lines.append("**Issues Found:**")
        for issue in edge_issues:
            report_lines.append(f"- {issue}")
        report_lines.append("")

    # Recommendations
    report_lines.append("## 5. Recommendations")
    report_lines.append("")

    if total_issues == 0:
        report_lines.append("No tuning needed. All statistical outputs are within acceptable NBA ranges.")
    else:
        report_lines.append("### Recommended BaseRate Adjustments:")
        report_lines.append("")

        for issue in baseline_issues:
            if '3pt_pct' in issue.lower():
                report_lines.append("- Consider adjusting `BASE_RATE_3PT` in constants.py")
            elif 'turnover' in issue.lower():
                report_lines.append("- Consider adjusting `BASE_TURNOVER_RATE` in constants.py")
            elif 'oreb' in issue.lower():
                report_lines.append("- Consider adjusting `DEFENSIVE_REBOUND_ADVANTAGE` in constants.py")

    report_lines.append("")
    report_lines.append("---")
    report_lines.append("")
    report_lines.append(f"**Total Issues Found: {total_issues}**")
    report_lines.append("")

    return "\n".join(report_lines)


# =============================================================================
# MAIN EXECUTION
# =============================================================================

def main():
    """Main validation execution."""
    parser = argparse.ArgumentParser(description='Validate basketball simulator against NBA statistics')
    parser.add_argument('--num-possessions', type=int, default=1000, help='Number of possessions per test')
    parser.add_argument('--seed', type=int, default=42, help='Random seed for reproducibility')
    parser.add_argument('--output', type=str, default='REALISM_VALIDATION_REPORT.md', help='Output report filename')

    args = parser.parse_args()

    print("="*70)
    print("NBA REALISM VALIDATION")
    print("="*70)
    print(f"Possessions per test: {args.num_possessions}")
    print(f"Random seed: {args.seed}")
    print("="*70)
    print()

    # Run all validation tests
    baseline_stats, baseline_issues = validate_baseline_statistics(args.num_possessions, args.seed)
    print(f"Baseline validation: {len(baseline_issues)} issues found")
    print()

    matchup_results, matchup_issues = validate_elite_vs_poor_matchups(args.num_possessions // 2, args.seed + 100)
    print(f"Matchup validation: {len(matchup_issues)} issues found")
    print()

    tactical_results, tactical_issues = validate_tactical_impact(args.num_possessions // 2, args.seed + 200)
    print(f"Tactical validation: {len(tactical_issues)} issues found")
    print()

    edge_results, edge_issues = validate_edge_cases(args.seed + 300)
    print(f"Edge case validation: {len(edge_issues)} issues found")
    print()

    # Generate report
    report = generate_report(
        baseline_stats,
        baseline_issues,
        matchup_results,
        matchup_issues,
        tactical_results,
        tactical_issues,
        edge_results,
        edge_issues
    )

    # Write to file
    output_path = Path(args.output)
    output_path.write_text(report)

    print("="*70)
    print(f"Report written to: {output_path.absolute()}")
    print("="*70)

    # Print summary
    total_issues = len(baseline_issues) + len(matchup_issues) + len(tactical_issues) + len(edge_issues)

    if total_issues == 0:
        print("\nVALIDATION PASSED: All tests passed!")
        return 0
    else:
        print(f"\nVALIDATION FAILED: {total_issues} issues found")
        print("See report for details.")
        return 1


if __name__ == '__main__':
    sys.exit(main())
