"""
DIAGNOSTIC ANALYSIS: Shot Quality Distribution

Extract key diagnostic metrics from validation game logs:
1. Shot quality distribution (wide open / contested / heavily contested)
2. Transition possession rate
3. Turnover rate per 100 possessions

This will identify whether inflated shooting percentages are caused by:
- Too many wide open shots
- Too few turnovers (extra possessions)
- Too much transition (bonus shooting)
"""

import os
import re
from typing import Dict, List

def analyze_game_pbp(pbp_file: str) -> Dict:
    """Analyze single game play-by-play for diagnostic metrics."""

    with open(pbp_file, 'r', encoding='utf-8') as f:
        pbp_text = f.read()

    # Count shot attempts by contest level
    wide_open = len(re.findall(r'Wide open!', pbp_text, re.IGNORECASE))
    contested = len(re.findall(r'Contested by .* \(\d+\.\d+ feet', pbp_text))
    heavily_contested = len(re.findall(r'Heavily contested by .* \(<\d+\.\d+ feet', pbp_text))

    # Count transition possessions
    transition = len(re.findall(r'\[TRANSITION\]', pbp_text, re.IGNORECASE))

    # Count turnovers
    turnovers = len(re.findall(r'Turnover!', pbp_text, re.IGNORECASE))

    # Count total possessions (estimate from shot attempts + turnovers)
    # Each team gets ~50% of possessions
    total_shots = wide_open + contested + heavily_contested

    return {
        'wide_open': wide_open,
        'contested': contested,
        'heavily_contested': heavily_contested,
        'total_shots': total_shots,
        'transition': transition,
        'turnovers': turnovers
    }


def analyze_validation_suite(validation_dir: str, num_games: int = 10) -> None:
    """
    Analyze first N games from validation suite.

    Args:
        validation_dir: Path to validation results directory
        num_games: Number of games to analyze (default 10)
    """

    games_dir = os.path.join(validation_dir, 'games')

    all_results = []

    print(f"{'='*80}")
    print(f"SHOT QUALITY DIAGNOSTIC ANALYSIS - {num_games} GAMES")
    print(f"{'='*80}\n")

    for i in range(1, num_games + 1):
        pbp_file = os.path.join(games_dir, f'game_{i:03d}_pbp.txt')

        if not os.path.exists(pbp_file):
            print(f"Warning: {pbp_file} not found, skipping")
            continue

        result = analyze_game_pbp(pbp_file)
        all_results.append(result)

        # Calculate percentages
        total_shots = result['total_shots']
        if total_shots > 0:
            wide_pct = result['wide_open'] / total_shots * 100
            contested_pct = result['contested'] / total_shots * 100
            heavy_pct = result['heavily_contested'] / total_shots * 100
        else:
            wide_pct = contested_pct = heavy_pct = 0

        print(f"Game {i}:")
        print(f"  Total Shots: {total_shots}")
        print(f"  Wide Open: {result['wide_open']} ({wide_pct:.1f}%)")
        print(f"  Contested: {result['contested']} ({contested_pct:.1f}%)")
        print(f"  Heavily Contested: {result['heavily_contested']} ({heavy_pct:.1f}%)")
        print(f"  Transition Possessions: {result['transition']}")
        print(f"  Turnovers: {result['turnovers']}")
        print()

    # Calculate aggregates
    if not all_results:
        print("No games analyzed")
        return

    total_wide = sum(r['wide_open'] for r in all_results)
    total_contested = sum(r['contested'] for r in all_results)
    total_heavy = sum(r['heavily_contested'] for r in all_results)
    total_shots = sum(r['total_shots'] for r in all_results)
    total_transition = sum(r['transition'] for r in all_results)
    total_turnovers = sum(r['turnovers'] for r in all_results)

    avg_turnovers_per_game = total_turnovers / len(all_results)

    # Estimate possessions per game (100 possessions per team = 200 total)
    # Turnovers per 100 possessions
    avg_poss_per_game = 200  # Hardcoded from validation results
    tov_per_100 = (total_turnovers / len(all_results)) / (avg_poss_per_game / 100)

    # Transition rate
    transition_rate = (total_transition / (avg_poss_per_game * len(all_results))) * 100

    print(f"{'='*80}")
    print("AGGREGATE RESULTS")
    print(f"{'='*80}\n")

    print(f"SHOT QUALITY DISTRIBUTION ({len(all_results)} games):")
    print(f"  Total Shots: {total_shots}")
    print(f"  Wide Open: {total_wide} ({total_wide/total_shots*100:.1f}%)")
    print(f"  Contested: {total_contested} ({total_contested/total_shots*100:.1f}%)")
    print(f"  Heavily Contested: {total_heavy} ({total_heavy/total_shots*100:.1f}%)")
    print()

    print("NBA COMPARISON (Shot Quality):")
    print("  NBA Typical: Wide Open ~35%, Contested ~50%, Heavily Contested ~15%")
    print(f"  Simulator:   Wide Open ~{total_wide/total_shots*100:.1f}%, " +
          f"Contested ~{total_contested/total_shots*100:.1f}%, " +
          f"Heavily Contested ~{total_heavy/total_shots*100:.1f}%")
    print()

    print(f"TURNOVERS:")
    print(f"  Avg per game: {avg_turnovers_per_game:.1f}")
    print(f"  Per 100 possessions: {tov_per_100:.1f}")
    print(f"  NBA Typical: 13-15 turnovers per game, ~13-14 per 100 possessions")
    print()

    print(f"TRANSITION RATE:")
    print(f"  Total transition possessions: {total_transition}")
    print(f"  Transition rate: {transition_rate:.1f}%")
    print(f"  NBA Typical: 12-15% of possessions")
    print()

    # DIAGNOSTIC VERDICT
    print(f"{'='*80}")
    print("DIAGNOSTIC VERDICT")
    print(f"{'='*80}\n")

    # Check if wide open rate is too high
    wide_open_pct = (total_wide / total_shots * 100)
    if wide_open_pct > 40:
        print(f"[ISSUE] Wide Open Shot Rate: {wide_open_pct:.1f}% (Expected ~35%)")
        print("  IMPACT: Generates too many uncontested shots with no penalty")
        print("  RECOMMENDATION: Review defensive assignment logic")
        print()
    elif wide_open_pct > 35:
        print(f"[BORDERLINE] Wide Open Shot Rate: {wide_open_pct:.1f}% (Expected ~35%)")
        print("  IMPACT: Slightly elevated uncontested shot rate")
        print()
    else:
        print(f"[OK] Wide Open Shot Rate: {wide_open_pct:.1f}% (Expected ~35%)")
        print()

    # Check if turnovers are too low
    if avg_turnovers_per_game < 11:
        print(f"[ISSUE] Turnover Rate: {avg_turnovers_per_game:.1f} per game (Expected 13-15)")
        print("  IMPACT: Creates 3-5 extra possessions per game → inflated scoring")
        print("  RECOMMENDATION: Review turnover probability formulas")
        print()
    elif avg_turnovers_per_game < 13:
        print(f"[BORDERLINE] Turnover Rate: {avg_turnovers_per_game:.1f} per game (Expected 13-15)")
        print("  IMPACT: Creates 1-2 extra possessions per game")
        print()
    else:
        print(f"[OK] Turnover Rate: {avg_turnovers_per_game:.1f} per game (Expected 13-15)")
        print()

    # Check if transition rate is too high
    if transition_rate > 18:
        print(f"[ISSUE] Transition Rate: {transition_rate:.1f}% (Expected 12-15%)")
        print("  IMPACT: Too many possessions get +20% shooting bonus")
        print("  RECOMMENDATION: Review transition trigger logic")
        print()
    elif transition_rate > 15:
        print(f"[BORDERLINE] Transition Rate: {transition_rate:.1f}% (Expected 12-15%)")
        print("  IMPACT: Slightly elevated transition frequency")
        print()
    else:
        print(f"[OK] Transition Rate: {transition_rate:.1f}% (Expected 12-15%)")
        print()

    print(f"{'='*80}")
    print("NEXT STEPS")
    print(f"{'='*80}\n")

    print("Based on diagnostic results:")
    print("1. If shot quality is the issue → Adjust defensive assignment logic")
    print("2. If turnovers are too low → Increase turnover base rates")
    print("3. If transition is too high → Reduce transition trigger probability")
    print("4. If all metrics are OK → Contest penalties need further tuning")
    print()


if __name__ == '__main__':
    import sys

    if len(sys.argv) < 2:
        print("Usage: python analyze_shot_quality.py <validation_dir> [num_games]")
        print("Example: python analyze_shot_quality.py validation_m4_iteration9 10")
        sys.exit(1)

    validation_dir = sys.argv[1]
    num_games = int(sys.argv[2]) if len(sys.argv) > 2 else 10

    analyze_validation_suite(validation_dir, num_games)
