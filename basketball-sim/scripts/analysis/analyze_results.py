"""
M4 PHASE 3: STATISTICAL ANALYSIS SCRIPT

Analyzes validation results and compares against NBA benchmarks.
Generates comprehensive report with pass/fail for each metric.

Usage:
    python analyze_results.py --input validation_results/VALIDATION_SUMMARY.json --output VALIDATION_REPORT.md
"""

import json
import sys
from typing import Dict, Any, List, Tuple


# NBA BENCHMARKS (2023-24 season averages)
NBA_BENCHMARKS = {
    'points_per_game': {'target': 112.5, 'min': 110, 'max': 115, 'tolerance': 5},
    'fg_pct': {'target': 46.5, 'min': 45, 'max': 48, 'tolerance': 2},
    'fg3_pct': {'target': 36.5, 'min': 35, 'max': 38, 'tolerance': 2},
    'ft_pct': {'target': 77.5, 'min': 76, 'max': 79, 'tolerance': 2},
    'fg3a_per_game': {'target': 36, 'min': 34, 'max': 38, 'tolerance': 3},
    'fta_per_game': {'target': 22, 'min': 20, 'max': 24, 'tolerance': 3},
    'reb_per_game': {'target': 44, 'min': 42, 'max': 46, 'tolerance': 3},
    'oreb_per_game': {'target': 10.5, 'min': 9, 'max': 12, 'tolerance': 2},
    'oreb_pct': {'target': 24, 'min': 22, 'max': 27, 'tolerance': 3},
    'ast_per_game': {'target': 26, 'min': 24, 'max': 28, 'tolerance': 3},
    'tov_per_game': {'target': 14, 'min': 12, 'max': 16, 'tolerance': 2},
    'stl_per_game': {'target': 7.5, 'min': 6.5, 'max': 8.5, 'tolerance': 1.5},
    'blk_per_game': {'target': 4.5, 'min': 4, 'max': 5.5, 'tolerance': 1},
    'pf_per_game': {'target': 20, 'min': 18, 'max': 22, 'tolerance': 2},
    'possessions_per_game': {'target': 100, 'min': 96, 'max': 104, 'tolerance': 4},
}


def load_validation_summary(filepath: str) -> Dict[str, Any]:
    """Load validation summary JSON."""
    with open(filepath, 'r') as f:
        return json.load(f)


def check_metric(metric_name: str, actual_value: float, benchmark: Dict[str, float]) -> Tuple[str, str]:
    """
    Check if metric is within acceptable range.

    Returns:
        Tuple of (status, explanation)
        status: 'PASS', 'WARNING', or 'FAIL'
    """
    target = benchmark['target']
    min_val = benchmark['min']
    max_val = benchmark['max']
    tolerance = benchmark.get('tolerance', (max_val - min_val) / 2)

    if min_val <= actual_value <= max_val:
        return 'PASS', f"Within range [{min_val}, {max_val}]"
    elif target - tolerance <= actual_value <= target + tolerance:
        return 'WARNING', f"Outside ideal range but within tolerance (±{tolerance})"
    else:
        diff = actual_value - target
        return 'FAIL', f"Outside acceptable range by {abs(diff):.1f}"


def generate_report(summary: Dict[str, Any]) -> str:
    """Generate markdown validation report."""
    lines = []

    # Header
    lines.append("# M4 VALIDATION REPORT")
    lines.append("")
    lines.append("## Overview")
    lines.append("")
    lines.append(f"**Total Games Simulated:** {summary['metadata']['successful_games']}")
    lines.append(f"**Timestamp:** {summary['metadata']['timestamp']}")
    lines.append(f"**Random Seed:** {summary['metadata']['seed']}")
    lines.append("")

    # Extract averages
    avgs = summary['averages']
    dists = summary['distributions']

    # Metrics Comparison Table
    lines.append("## NBA Statistical Benchmarks Comparison")
    lines.append("")
    lines.append("| Metric | Simulator | NBA Target | NBA Range | Status | Notes |")
    lines.append("|--------|-----------|------------|-----------|--------|-------|")

    results = {}
    for metric, benchmark in NBA_BENCHMARKS.items():
        if metric in avgs:
            actual = avgs[metric]
            status, explanation = check_metric(metric, actual, benchmark)
            results[metric] = status

            # Format row
            metric_display = metric.replace('_', ' ').title()
            sim_value = f"{actual:.1f}"
            target = f"{benchmark['target']:.1f}"
            range_val = f"[{benchmark['min']:.1f}, {benchmark['max']:.1f}]"
            status_emoji = "✅" if status == 'PASS' else ("⚠️" if status == 'WARNING' else "❌")

            lines.append(f"| {metric_display} | {sim_value} | {target} | {range_val} | {status_emoji} {status} | {explanation} |")

    lines.append("")

    # Summary Statistics
    pass_count = sum(1 for s in results.values() if s == 'PASS')
    warn_count = sum(1 for s in results.values() if s == 'WARNING')
    fail_count = sum(1 for s in results.values() if s == 'FAIL')
    total_count = len(results)

    lines.append("## Summary")
    lines.append("")
    lines.append(f"- ✅ **PASS:** {pass_count}/{total_count} metrics ({pass_count/total_count*100:.1f}%)")
    lines.append(f"- ⚠️ **WARNING:** {warn_count}/{total_count} metrics ({warn_count/total_count*100:.1f}%)")
    lines.append(f"- ❌ **FAIL:** {fail_count}/{total_count} metrics ({fail_count/total_count*100:.1f}%)")
    lines.append("")

    # Distribution Analysis
    lines.append("## Game Distribution Analysis")
    lines.append("")
    lines.append("### Score Distributions")
    lines.append("")
    lines.append(f"- **Blowouts (20+ point margin):** {dists['blowouts_20_plus']} games ({dists['blowouts_20_plus']/summary['metadata']['successful_games']*100:.1f}%)")
    lines.append(f"  - NBA Average: ~10-15%")
    blowout_status = "✅ PASS" if 8 <= dists['blowouts_20_plus'] <= 18 else "⚠️ WARNING"
    lines.append(f"  - Status: {blowout_status}")
    lines.append("")
    lines.append(f"- **Close Games (5 or less):** {dists['close_games_5_or_less']} games ({dists['close_games_5_or_less']/summary['metadata']['successful_games']*100:.1f}%)")
    lines.append(f"  - NBA Average: ~25-30%")
    close_status = "✅ PASS" if 20 <= dists['close_games_5_or_less'] <= 35 else "⚠️ WARNING"
    lines.append(f"  - Status: {close_status}")
    lines.append("")
    lines.append(f"- **High Scoring (120+ points):** {dists['high_scoring_120_plus']} team performances ({dists['high_scoring_120_plus']/(summary['metadata']['successful_games']*2)*100:.1f}%)")
    lines.append(f"  - NBA Average: ~15-20%")
    high_status = "✅ PASS" if 25 <= dists['high_scoring_120_plus'] <= 45 else "⚠️ WARNING"
    lines.append(f"  - Status: {high_status}")
    lines.append("")
    lines.append(f"- **Low Scoring (80 or less):** {dists['low_scoring_80_or_less']} team performances ({dists['low_scoring_80_or_less']/(summary['metadata']['successful_games']*2)*100:.1f}%)")
    lines.append(f"  - NBA Average: ~5-10%")
    low_status = "✅ PASS" if dists['low_scoring_80_or_less'] <= 20 else "⚠️ WARNING"
    lines.append(f"  - Status: {low_status}")
    lines.append("")

    # Critical Issues
    critical_failures = [m for m, s in results.items() if s == 'FAIL']
    if critical_failures:
        lines.append("## 🚨 Critical Issues Requiring Tuning")
        lines.append("")
        for metric in critical_failures:
            actual = avgs[metric]
            benchmark = NBA_BENCHMARKS[metric]
            diff = actual - benchmark['target']
            pct_diff = (diff / benchmark['target']) * 100

            lines.append(f"### {metric.replace('_', ' ').title()}")
            lines.append(f"- **Current:** {actual:.1f}")
            lines.append(f"- **Target:** {benchmark['target']:.1f}")
            lines.append(f"- **Difference:** {diff:+.1f} ({pct_diff:+.1f}%)")
            lines.append("")

            # Tuning recommendations
            if metric == 'points_per_game':
                if actual < benchmark['min']:
                    lines.append("**Recommended Actions:**")
                    lines.append("- Increase BaseRates for all shot types (3PT, midrange, layup, dunk)")
                    lines.append("- Verify possessions per game are ~100 (currently too low may indicate pace issues)")
                    lines.append("- Check if FT system is working (FT% showing 0.0 suggests FTs not being awarded)")
                else:
                    lines.append("**Recommended Actions:**")
                    lines.append("- Decrease BaseRates for all shot types")
            elif metric == 'possessions_per_game':
                if actual < benchmark['min']:
                    lines.append("**Recommended Actions:**")
                    lines.append("- Increase pace multipliers (fast/standard/slow)")
                    lines.append("- Check turnover rates (too many turnovers reduce possessions)")
                    lines.append("- Verify shot clock is functioning correctly")
            elif metric == 'fg_pct':
                if actual < benchmark['min']:
                    lines.append("**Recommended Actions:**")
                    lines.append("- Increase BaseRates slightly across all shot types")
                else:
                    lines.append("**Recommended Actions:**")
                    lines.append("- Decrease BaseRates slightly across all shot types")
            elif metric == 'oreb_pct':
                if actual < benchmark['min']:
                    lines.append("**Recommended Actions:**")
                    lines.append("- Increase OREB_BASE_RATE in rebounding.py")
                else:
                    lines.append("**Recommended Actions:**")
                    lines.append("- Decrease OREB_BASE_RATE in rebounding.py (currently set to 0.14)")

            lines.append("")

    # Warnings
    warnings = [m for m, s in results.items() if s == 'WARNING']
    if warnings:
        lines.append("## ⚠️ Metrics Needing Minor Adjustment")
        lines.append("")
        for metric in warnings:
            actual = avgs[metric]
            benchmark = NBA_BENCHMARKS[metric]
            lines.append(f"- **{metric.replace('_', ' ').title()}:** {actual:.1f} (target: {benchmark['target']:.1f})")
        lines.append("")

    # Overall Assessment
    lines.append("## Overall Assessment")
    lines.append("")
    if fail_count == 0 and warn_count <= 2:
        lines.append("✅ **EXCELLENT:** Simulator produces NBA-realistic statistics across all key metrics.")
        lines.append("")
        lines.append("**Recommendation:** Proceed to M5 or additional feature development.")
    elif fail_count <= 2:
        lines.append("⚠️ **GOOD WITH MINOR TUNING NEEDED:** Most metrics are realistic but some require adjustment.")
        lines.append("")
        lines.append("**Recommendation:** Perform targeted tuning on failed metrics, then re-validate with 20 games.")
    else:
        lines.append("❌ **REQUIRES SIGNIFICANT TUNING:** Multiple metrics are outside acceptable ranges.")
        lines.append("")
        lines.append("**Recommendation:** Systematic tuning pass required. Address critical issues first (points, possessions), then re-validate.")

    lines.append("")

    # Next Steps
    lines.append("## Recommended Next Steps")
    lines.append("")
    if critical_failures:
        lines.append("1. **Address Critical Failures:**")
        for metric in critical_failures[:3]:  # Top 3 issues
            lines.append(f"   - Fix {metric.replace('_', ' ')}")
        lines.append("")
        lines.append("2. **Re-run Validation:** Generate 20 new games to verify tuning")
        lines.append("")
        lines.append("3. **Iterate:** Repeat tuning/validation cycle until all metrics PASS")
    else:
        lines.append("1. **Review sample games manually** for qualitative realism")
        lines.append("2. **Run attribute impact tests** (M4 Phase 4)")
        lines.append("3. **Run tactical impact tests** (M4 Phase 5)")
        lines.append("4. **User sign-off on M4 validation**")

    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("*Report generated by M4 Statistical Analysis Script*")

    return "\n".join(lines)


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Analyze validation results')
    parser.add_argument('--input', type=str, required=True,
                        help='Path to VALIDATION_SUMMARY.json')
    parser.add_argument('--output', type=str, default='VALIDATION_REPORT.md',
                        help='Output report path (default: VALIDATION_REPORT.md)')

    args = parser.parse_args()

    try:
        # Load summary
        summary = load_validation_summary(args.input)

        # Generate report
        report = generate_report(summary)

        # Save report
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(report)

        print(f"Validation report generated: {args.output}")

        # Print summary to console
        print("\n" + "="*80)
        print("VALIDATION SUMMARY")
        print("="*80)
        print(f"Games: {summary['metadata']['successful_games']}")
        print(f"Points/Game: {summary['averages']['points_per_game']:.1f} (NBA: 110-115)")
        print(f"FG%: {summary['averages']['fg_pct']:.1f}% (NBA: 45-48%)")
        print(f"3PT%: {summary['averages']['fg3_pct']:.1f}% (NBA: 35-38%)")
        print(f"Possessions: {summary['averages']['possessions_per_game']:.1f} (NBA: 96-104)")
        print(f"OREB%: {summary['averages']['oreb_pct']:.1f}% (NBA: 22-27%)")

    except Exception as e:
        print(f"ERROR: Analysis failed: {str(e)}")
        sys.exit(1)
