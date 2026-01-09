"""
Player-Level 3PT Correlation Analysis

Aggregates each player's 3PT performance across many games, then correlates
their shooting percentage with their 3PT composite.

This is the correct way to measure correlation in basketball - by player
performance over a season, not by individual shot outcomes.
"""

import random
import json
import math
from pathlib import Path
from typing import Dict, List, Any
from collections import defaultdict

import sys
sys.path.insert(0, '.')

from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings
from src.utils.probability import calculate_composite
from src.constants import WEIGHTS_3PT


def run_player_level_analysis(num_games: int = 100, min_attempts: int = 50):
    """
    Run player-level correlation analysis.

    Args:
        num_games: Number of games to simulate
        min_attempts: Minimum 3PT attempts required for a player to be included
    """
    print("="*80)
    print("PLAYER-LEVEL 3PT CORRELATION ANALYSIS")
    print("="*80)
    print()
    print(f"Simulating {num_games} games to aggregate player performance")
    print(f"Minimum {min_attempts} attempts required per player")
    print()

    # Set seed for reproducibility
    random.seed(42)

    # Load teams
    print("Loading teams...")
    teams_dir = Path('teams')
    teams = []

    for team_file in sorted(teams_dir.glob('team_*.json')):
        with open(team_file, 'r') as f:
            team_data = json.load(f)
            teams.append(team_data)

    print(f"Loaded {len(teams)} teams")
    print()

    # Track player stats across all games
    player_stats = defaultdict(lambda: {
        'attempts': 0,
        'makes': 0,
        'composite': None,
        'name': None
    })

    # Simulate games
    print(f"Simulating {num_games} games...")

    for game_num in range(num_games):
        # Random matchup
        home_team = random.choice(teams)
        away_team = random.choice([t for t in teams if t['name'] != home_team['name']])

        # Tactical settings (use defaults)
        minutes_allotment = {player['name']: 24 for player in home_team['roster'][:10]}
        home_tactical = TacticalSettings(
            pace='standard',
            man_defense_pct=70,
            scoring_option_1=None,
            scoring_option_2=None,
            scoring_option_3=None,
            minutes_allotment=minutes_allotment,
            rebounding_strategy='standard'
        )

        minutes_allotment = {player['name']: 24 for player in away_team['roster'][:10]}
        away_tactical = TacticalSettings(
            pace='standard',
            man_defense_pct=70,
            scoring_option_1=None,
            scoring_option_2=None,
            scoring_option_3=None,
            minutes_allotment=minutes_allotment,
            rebounding_strategy='standard'
        )

        # Create simulator for this game
        simulator = GameSimulator(
            home_roster=home_team['roster'],
            away_roster=away_team['roster'],
            home_team_name=home_team['name'],
            away_team_name=away_team['name'],
            tactical_home=home_tactical,
            tactical_away=away_tactical
        )

        # Simulate game
        result = simulator.simulate_game()

        # Extract 3PT data from all quarters
        for quarter_result in result.quarter_results:
            for possession in quarter_result.possession_results:
                if 'shot_attempt' not in possession.debug:
                    continue

                shot_info = possession.debug['shot_attempt']

                # Only track 3PT shots
                if shot_info.get('shot_type') != '3pt':
                    continue

                shooter_name = shot_info.get('shooter_name')
                shooter_comp = shot_info.get('shooter_composite')
                made = 1 if shot_info.get('result') == 'make' else 0

                # Aggregate stats
                player_stats[shooter_name]['attempts'] += 1
                player_stats[shooter_name]['makes'] += made
                player_stats[shooter_name]['composite'] = shooter_comp
                player_stats[shooter_name]['name'] = shooter_name

        if (game_num + 1) % 10 == 0:
            print(f"  {game_num + 1}/{num_games} games completed...")

    print()

    # Filter to qualified players
    qualified_players = {
        name: stats for name, stats in player_stats.items()
        if stats['attempts'] >= min_attempts
    }

    print(f"Total players with any 3PT attempts: {len(player_stats)}")
    print(f"Qualified players ({min_attempts}+ attempts): {len(qualified_players)}")
    print()

    if len(qualified_players) < 20:
        print(f"WARNING: Only {len(qualified_players)} qualified players.")
        print(f"Consider running more games or lowering min_attempts threshold.")
        print()

    # Calculate shooting percentages
    for stats in qualified_players.values():
        stats['pct'] = stats['makes'] / stats['attempts']

    # Calculate correlation
    composites = [s['composite'] for s in qualified_players.values()]
    percentages = [s['pct'] for s in qualified_players.values()]

    n = len(composites)
    sum_x = sum(composites)
    sum_y = sum(percentages)
    sum_xy = sum(x * y for x, y in zip(composites, percentages))
    sum_x2 = sum(x * x for x in composites)
    sum_y2 = sum(y * y for y in percentages)

    numerator = n * sum_xy - sum_x * sum_y
    denominator = math.sqrt((n * sum_x2 - sum_x**2) * (n * sum_y2 - sum_y**2))

    correlation = numerator / denominator if denominator != 0 else 0

    # Calculate stats by composite bucket
    buckets = {
        '30-40': [],
        '40-50': [],
        '50-55': [],
        '55-60': [],
        '60-65': [],
        '65-70': [],
        '70-80': [],
        '80+': []
    }

    for stats in qualified_players.values():
        comp = stats['composite']
        pct = stats['pct']

        if comp < 40:
            buckets['30-40'].append(pct)
        elif comp < 50:
            buckets['40-50'].append(pct)
        elif comp < 55:
            buckets['50-55'].append(pct)
        elif comp < 60:
            buckets['55-60'].append(pct)
        elif comp < 65:
            buckets['60-65'].append(pct)
        elif comp < 70:
            buckets['65-70'].append(pct)
        elif comp < 80:
            buckets['70-80'].append(pct)
        else:
            buckets['80+'].append(pct)

    # Print results
    print("="*80)
    print("PLAYER-LEVEL RESULTS")
    print("="*80)
    print()
    print(f"Qualified players: {n}")
    print(f"Total 3PT attempts: {sum(s['attempts'] for s in qualified_players.values())}")
    print(f"Total makes: {sum(s['makes'] for s in qualified_players.values())}")
    print()
    print(f"**Pearson correlation (composite vs aggregated 3PT%): {correlation:.3f}**")
    print()

    # Print bucket analysis
    print("="*80)
    print("AVERAGE 3PT% BY SHOOTER COMPOSITE BUCKET")
    print("="*80)
    print()
    print(f"{'Composite Range':<18} {'Players':>10} {'Avg 3PT%':>12} {'Std Dev':>10}")
    print("-"*80)

    for bucket_name in ['30-40', '40-50', '50-55', '55-60', '60-65', '65-70', '70-80', '80+']:
        pcts = buckets[bucket_name]
        if len(pcts) > 0:
            avg_pct = sum(pcts) / len(pcts)
            if len(pcts) > 1:
                variance = sum((p - avg_pct)**2 for p in pcts) / (len(pcts) - 1)
                std_dev = math.sqrt(variance)
            else:
                std_dev = 0.0
            print(f"{bucket_name:<18} {len(pcts):>10} {avg_pct*100:>11.1f}% {std_dev*100:>9.1f}%")
        else:
            print(f"{bucket_name:<18} {0:>10} {'N/A':>12} {'N/A':>10}")

    print()

    # Calculate spread
    valid_buckets = {k: v for k, v in buckets.items() if len(v) > 0}
    if valid_buckets:
        bucket_avgs = {k: sum(v)/len(v) for k, v in valid_buckets.items()}
        min_pct = min(bucket_avgs.values())
        max_pct = max(bucket_avgs.values())
        spread = (max_pct - min_pct) * 100

        print(f"Spread (lowest to highest bucket average): {spread:.1f} percentage points")
        print()

    # Show top and bottom performers
    sorted_players = sorted(qualified_players.values(), key=lambda x: x['pct'], reverse=True)

    print("="*80)
    print("TOP 10 SHOOTERS (by 3PT%)")
    print("="*80)
    print()
    print(f"{'Player':<30} {'Composite':>10} {'3PT%':>10} {'Attempts':>10}")
    print("-"*80)
    for i, player in enumerate(sorted_players[:10]):
        print(f"{player['name']:<30} {player['composite']:>10.1f} {player['pct']*100:>9.1f}% {player['attempts']:>10}")
    print()

    print("="*80)
    print("BOTTOM 10 SHOOTERS (by 3PT%)")
    print("="*80)
    print()
    print(f"{'Player':<30} {'Composite':>10} {'3PT%':>10} {'Attempts':>10}")
    print("-"*80)
    for i, player in enumerate(sorted_players[-10:]):
        print(f"{player['name']:<30} {player['composite']:>10.1f} {player['pct']*100:>9.1f}% {player['attempts']:>10}")
    print()

    # Interpretation
    print("="*80)
    print("INTERPRETATION")
    print("="*80)
    print()

    if correlation > 0.60:
        print(f"EXCELLENT correlation ({correlation:.3f})")
        print("  -> Player skill strongly predicts 3PT shooting performance")
        print("  -> System is working correctly")
        print("  -> Shot-level correlation being low (0.05-0.10) is EXPECTED variance")
    elif correlation > 0.40:
        print(f"GOOD correlation ({correlation:.3f})")
        print("  -> Player skill moderately predicts performance")
        print("  -> System is mostly working")
        print("  -> May benefit from minor defensive reduction")
    elif correlation > 0.25:
        print(f"MODERATE correlation ({correlation:.3f})")
        print("  -> Player skill has visible but weak impact")
        print("  -> Defensive factors may be too strong")
        print("  -> Consider implementing Option A (reduce defensive impact)")
    else:
        print(f"WEAK correlation ({correlation:.3f})")
        print("  -> Player skill barely predicts performance")
        print("  -> Defensive factors are overwhelming shooter skill")
        print("  -> MUST reduce defensive impact (Option A or C)")

    print()

    # Save detailed results
    output_path = Path('output/PLAYER_LEVEL_CORRELATION.json')
    output_path.parent.mkdir(exist_ok=True)

    output_data = {
        'num_games': num_games,
        'min_attempts': min_attempts,
        'qualified_players': n,
        'correlation': correlation,
        'spread_pp': spread if valid_buckets else 0,
        'bucket_averages': {
            k: sum(v)/len(v) for k, v in buckets.items() if len(v) > 0
        },
        'top_10': [
            {
                'name': p['name'],
                'composite': p['composite'],
                'pct': p['pct'],
                'attempts': p['attempts']
            }
            for p in sorted_players[:10]
        ],
        'bottom_10': [
            {
                'name': p['name'],
                'composite': p['composite'],
                'pct': p['pct'],
                'attempts': p['attempts']
            }
            for p in sorted_players[-10:]
        ]
    }

    with open(output_path, 'w') as f:
        json.dump(output_data, f, indent=2)

    print(f"Detailed results saved to: {output_path}")
    print()


if __name__ == '__main__':
    run_player_level_analysis(num_games=100, min_attempts=30)
