"""
Analyze foul rates from 100-game validation data.

Calculates:
- Average fouls per team per game
- Average fouls per 100 possessions
- Distribution (min, max, percentiles)
- FT/Foul ratio
- Comparison to NBA benchmarks
"""

import json
import statistics
from pathlib import Path
from typing import List, Dict, Any

# NBA BENCHMARKS (2020-2025 era)
# Sources:
# - NBA.com stats (team totals)
# - Basketball Reference (league averages)
NBA_FOULS_PER_TEAM_PER_GAME = {
    'min': 17.0,
    'target': 19.5,
    'max': 22.0
}

NBA_FOULS_PER_100_POSSESSIONS = {
    'min': 17.0,
    'target': 19.0,
    'max': 21.0
}

NBA_FT_TO_FOUL_RATIO = {
    'min': 1.0,
    'target': 1.2,
    'max': 1.4
}

def load_game(file_path: Path) -> Dict[str, Any]:
    """Load a single game JSON file."""
    with open(file_path, 'r') as f:
        return json.load(f)

def calculate_percentile(data: List[float], percentile: float) -> float:
    """Calculate percentile of data."""
    sorted_data = sorted(data)
    index = int(len(sorted_data) * (percentile / 100.0))
    return sorted_data[min(index, len(sorted_data) - 1)]

def analyze_foul_rates():
    """Analyze foul rates from 100-game validation data."""

    validation_dir = Path("validation/turnover_fix_final/games")

    # Storage for all game data
    home_fouls: List[int] = []
    away_fouls: List[int] = []
    total_fouls: List[int] = []
    home_possessions: List[int] = []
    away_possessions: List[int] = []
    home_fta: List[int] = []
    away_fta: List[int] = []

    # Load all games
    game_files = sorted(validation_dir.glob("game_*.json"))

    print(f"Loading {len(game_files)} games...")

    for game_file in game_files:
        game = load_game(game_file)

        # Extract team stats from game_statistics
        game_stats = game['game_statistics']
        home_stats = game_stats['home_stats']
        away_stats = game_stats['away_stats']

        # Fouls
        home_pf = home_stats.get('pf', 0)
        away_pf = away_stats.get('pf', 0)
        home_fouls.append(home_pf)
        away_fouls.append(away_pf)
        total_fouls.append(home_pf + away_pf)

        # Possessions
        total_poss = game_stats.get('total_possessions', 0)
        # Approximate each team gets half
        home_poss = total_poss // 2
        away_poss = total_poss - home_poss
        home_possessions.append(home_poss)
        away_possessions.append(away_poss)

        # Free throw attempts
        home_fta.append(home_stats.get('fta', 0))
        away_fta.append(away_stats.get('fta', 0))

    # Calculate statistics
    print("\n" + "="*80)
    print("FOUL RATE ANALYSIS - 100 GAME VALIDATION")
    print("="*80)

    # Per-team fouls per game
    all_team_fouls = home_fouls + away_fouls
    avg_fouls_per_team = statistics.mean(all_team_fouls)
    median_fouls_per_team = statistics.median(all_team_fouls)
    stdev_fouls_per_team = statistics.stdev(all_team_fouls)

    print("\n1. FOULS PER TEAM PER GAME")
    print(f"   Average:  {avg_fouls_per_team:.2f}")
    print(f"   Median:   {median_fouls_per_team:.2f}")
    print(f"   Std Dev:  {stdev_fouls_per_team:.2f}")
    print(f"   Min:      {min(all_team_fouls)}")
    print(f"   Max:      {max(all_team_fouls)}")
    print(f"   25th %ile: {calculate_percentile(all_team_fouls, 25):.2f}")
    print(f"   75th %ile: {calculate_percentile(all_team_fouls, 75):.2f}")
    print(f"\n   NBA Benchmark: {NBA_FOULS_PER_TEAM_PER_GAME['target']:.1f} " +
          f"(range: {NBA_FOULS_PER_TEAM_PER_GAME['min']:.1f}-{NBA_FOULS_PER_TEAM_PER_GAME['max']:.1f})")

    # Determine pass/fail
    if NBA_FOULS_PER_TEAM_PER_GAME['min'] <= avg_fouls_per_team <= NBA_FOULS_PER_TEAM_PER_GAME['max']:
        print(f"   STATUS: PASS (within NBA range)")
    else:
        gap = avg_fouls_per_team - NBA_FOULS_PER_TEAM_PER_GAME['target']
        print(f"   STATUS: FAIL (gap: {gap:+.2f} fouls per team)")

    # Total fouls per game
    avg_total_fouls = statistics.mean(total_fouls)
    print(f"\n2. TOTAL FOULS PER GAME (Both Teams)")
    print(f"   Average:  {avg_total_fouls:.2f}")
    print(f"   Min:      {min(total_fouls)}")
    print(f"   Max:      {max(total_fouls)}")
    print(f"   NBA Benchmark: ~{NBA_FOULS_PER_TEAM_PER_GAME['target']*2:.1f} total")

    # Fouls per 100 possessions
    all_possessions = home_possessions + away_possessions
    fouls_per_100_poss = []
    for fouls, poss in zip(all_team_fouls, all_possessions):
        if poss > 0:
            fouls_per_100_poss.append((fouls / poss) * 100)

    avg_fouls_per_100 = statistics.mean(fouls_per_100_poss)
    median_fouls_per_100 = statistics.median(fouls_per_100_poss)
    stdev_fouls_per_100 = statistics.stdev(fouls_per_100_poss)

    print(f"\n3. FOULS PER 100 POSSESSIONS")
    print(f"   Average:  {avg_fouls_per_100:.2f}")
    print(f"   Median:   {median_fouls_per_100:.2f}")
    print(f"   Std Dev:  {stdev_fouls_per_100:.2f}")
    print(f"   Min:      {min(fouls_per_100_poss):.2f}")
    print(f"   Max:      {max(fouls_per_100_poss):.2f}")
    print(f"   25th %ile: {calculate_percentile(fouls_per_100_poss, 25):.2f}")
    print(f"   75th %ile: {calculate_percentile(fouls_per_100_poss, 75):.2f}")
    print(f"\n   NBA Benchmark: {NBA_FOULS_PER_100_POSSESSIONS['target']:.1f} " +
          f"(range: {NBA_FOULS_PER_100_POSSESSIONS['min']:.1f}-{NBA_FOULS_PER_100_POSSESSIONS['max']:.1f})")

    if NBA_FOULS_PER_100_POSSESSIONS['min'] <= avg_fouls_per_100 <= NBA_FOULS_PER_100_POSSESSIONS['max']:
        print(f"   STATUS: PASS (within NBA range)")
    else:
        gap = avg_fouls_per_100 - NBA_FOULS_PER_100_POSSESSIONS['target']
        print(f"   STATUS: FAIL (gap: {gap:+.2f} fouls per 100 poss)")

    # FT/Foul ratio
    all_fta = home_fta + away_fta
    ft_foul_ratios = []
    for fta, fouls in zip(all_fta, all_team_fouls):
        if fouls > 0:
            ft_foul_ratios.append(fta / fouls)

    avg_ft_foul_ratio = statistics.mean(ft_foul_ratios)
    median_ft_foul_ratio = statistics.median(ft_foul_ratios)

    print(f"\n4. FREE THROW ATTEMPTS / PERSONAL FOULS RATIO")
    print(f"   Average:  {avg_ft_foul_ratio:.2f}")
    print(f"   Median:   {median_ft_foul_ratio:.2f}")
    print(f"   Min:      {min(ft_foul_ratios):.2f}")
    print(f"   Max:      {max(ft_foul_ratios):.2f}")
    print(f"\n   NBA Benchmark: {NBA_FT_TO_FOUL_RATIO['target']:.2f} " +
          f"(range: {NBA_FT_TO_FOUL_RATIO['min']:.2f}-{NBA_FT_TO_FOUL_RATIO['max']:.2f})")
    print(f"   (Each shooting foul should generate 2-3 FTA on average)")

    if NBA_FT_TO_FOUL_RATIO['min'] <= avg_ft_foul_ratio <= NBA_FT_TO_FOUL_RATIO['max']:
        print(f"   STATUS: PASS (within NBA range)")
    else:
        print(f"   STATUS: FAIL (outside NBA range)")

    # Shooting vs Non-Shooting breakdown
    print(f"\n5. FOUL TYPE DISTRIBUTION")
    print(f"   (Note: This requires accessing foul_events in game data)")

    # Sample a few games to check shooting vs non-shooting
    shooting_fouls_total = 0
    non_shooting_fouls_total = 0
    offensive_fouls_total = 0
    sample_count = 0

    for game_file in game_files[:20]:  # Sample first 20 games
        game = load_game(game_file)
        if 'foul_events' in game:
            for foul in game['foul_events']:
                if foul['foul_type'] == 'shooting':
                    shooting_fouls_total += 1
                elif foul['foul_type'] == 'non_shooting':
                    non_shooting_fouls_total += 1
                elif foul['foul_type'] == 'offensive':
                    offensive_fouls_total += 1
            sample_count += 1

    if sample_count > 0:
        total_sample_fouls = shooting_fouls_total + non_shooting_fouls_total + offensive_fouls_total
        print(f"   (Sample: {sample_count} games)")
        print(f"   Shooting fouls:     {shooting_fouls_total} ({shooting_fouls_total/total_sample_fouls*100:.1f}%)")
        print(f"   Non-shooting fouls: {non_shooting_fouls_total} ({non_shooting_fouls_total/total_sample_fouls*100:.1f}%)")
        print(f"   Offensive fouls:    {offensive_fouls_total} ({offensive_fouls_total/total_sample_fouls*100:.1f}%)")
        print(f"\n   NBA Typical: ~50-60% shooting, ~30-40% non-shooting, ~5-10% offensive")

    # Overall assessment
    print("\n" + "="*80)
    print("OVERALL ASSESSMENT")
    print("="*80)

    pass_count = 0
    total_checks = 3

    if NBA_FOULS_PER_TEAM_PER_GAME['min'] <= avg_fouls_per_team <= NBA_FOULS_PER_TEAM_PER_GAME['max']:
        pass_count += 1

    if NBA_FOULS_PER_100_POSSESSIONS['min'] <= avg_fouls_per_100 <= NBA_FOULS_PER_100_POSSESSIONS['max']:
        pass_count += 1

    if NBA_FT_TO_FOUL_RATIO['min'] <= avg_ft_foul_ratio <= NBA_FT_TO_FOUL_RATIO['max']:
        pass_count += 1

    print(f"\nPassed: {pass_count}/{total_checks} checks")

    if pass_count == total_checks:
        print("VERDICT: PASS - Foul rates are within NBA realistic ranges")
    else:
        print("VERDICT: FAIL - Foul rates need adjustment")

        print("\nRECOMMENDED ADJUSTMENTS:")

        if avg_fouls_per_team > NBA_FOULS_PER_TEAM_PER_GAME['max']:
            reduction_needed = avg_fouls_per_team - NBA_FOULS_PER_TEAM_PER_GAME['target']
            reduction_pct = (reduction_needed / avg_fouls_per_team) * 100
            print(f"   - Reduce overall foul rate by ~{reduction_pct:.1f}%")
            print(f"     (from {avg_fouls_per_team:.1f} to {NBA_FOULS_PER_TEAM_PER_GAME['target']:.1f} per team)")

        if avg_fouls_per_team < NBA_FOULS_PER_TEAM_PER_GAME['min']:
            increase_needed = NBA_FOULS_PER_TEAM_PER_GAME['target'] - avg_fouls_per_team
            increase_pct = (increase_needed / avg_fouls_per_team) * 100
            print(f"   - Increase overall foul rate by ~{increase_pct:.1f}%")
            print(f"     (from {avg_fouls_per_team:.1f} to {NBA_FOULS_PER_TEAM_PER_GAME['target']:.1f} per team)")

        if avg_ft_foul_ratio > NBA_FT_TO_FOUL_RATIO['max']:
            print(f"   - FT/Foul ratio too high ({avg_ft_foul_ratio:.2f})")
            print(f"     Likely cause: Too many shooting fouls relative to non-shooting fouls")
            print(f"     Solution: Reduce shooting foul rates OR increase non-shooting foul rates")

        if avg_ft_foul_ratio < NBA_FT_TO_FOUL_RATIO['min']:
            print(f"   - FT/Foul ratio too low ({avg_ft_foul_ratio:.2f})")
            print(f"     Likely cause: Too many non-shooting fouls relative to shooting fouls")
            print(f"     Solution: Increase shooting foul rates OR reduce non-shooting foul rates")

    print("\n" + "="*80)

if __name__ == "__main__":
    analyze_foul_rates()
