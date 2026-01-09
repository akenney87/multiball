"""
All Shot Types Player-Level Correlation Analysis

Tests correlation for 3PT, Midrange, and Rim shots to validate if defensive
reduction is needed across all shot types.
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
from src.constants import WEIGHTS_3PT, WEIGHTS_MIDRANGE, WEIGHTS_LAYUP, WEIGHTS_DUNK


def run_all_shot_types_analysis(num_games: int = 100, min_attempts: int = 20):
    """
    Run player-level correlation analysis for ALL shot types.

    Args:
        num_games: Number of games to simulate
        min_attempts: Minimum attempts required per player per shot type
    """
    print("="*80)
    print("ALL SHOT TYPES PLAYER-LEVEL CORRELATION ANALYSIS")
    print("="*80)
    print()
    print(f"Simulating {num_games} games to aggregate player performance")
    print(f"Minimum {min_attempts} attempts required per player per shot type")
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

    # Track player stats by shot type
    shot_types_to_track = {
        '3pt': {'weight': WEIGHTS_3PT, 'stats': defaultdict(lambda: {'attempts': 0, 'makes': 0, 'composite': None, 'name': None})},
        'midrange_short': {'weight': WEIGHTS_MIDRANGE, 'stats': defaultdict(lambda: {'attempts': 0, 'makes': 0, 'composite': None, 'name': None})},
        'midrange_long': {'weight': WEIGHTS_MIDRANGE, 'stats': defaultdict(lambda: {'attempts': 0, 'makes': 0, 'composite': None, 'name': None})},
        'layup': {'weight': WEIGHTS_LAYUP, 'stats': defaultdict(lambda: {'attempts': 0, 'makes': 0, 'composite': None, 'name': None})},
        'dunk': {'weight': WEIGHTS_DUNK, 'stats': defaultdict(lambda: {'attempts': 0, 'makes': 0, 'composite': None, 'name': None})}
    }

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

        # Extract shot data from all quarters
        for quarter_result in result.quarter_results:
            for possession in quarter_result.possession_results:
                if 'shot_attempt' not in possession.debug:
                    continue

                shot_info = possession.debug['shot_attempt']
                shot_type = shot_info.get('shot_type')

                # Track if it's a shot type we're monitoring
                if shot_type in shot_types_to_track:
                    shooter_name = shot_info.get('shooter_name')
                    made = 1 if shot_info.get('result') == 'make' else 0

                    # Get shooter from roster to calculate composite
                    shooter = None
                    for player in home_team['roster'] + away_team['roster']:
                        if player['name'] == shooter_name:
                            shooter = player
                            break

                    if shooter:
                        # Calculate composite with appropriate weights
                        weights = shot_types_to_track[shot_type]['weight']
                        shooter_comp = calculate_composite(shooter, weights)

                        # Aggregate stats
                        stats = shot_types_to_track[shot_type]['stats']
                        stats[shooter_name]['attempts'] += 1
                        stats[shooter_name]['makes'] += made
                        stats[shooter_name]['composite'] = shooter_comp
                        stats[shooter_name]['name'] = shooter_name

        if (game_num + 1) % 10 == 0:
            print(f"  {game_num + 1}/{num_games} games completed...")

    print()

    # Analyze each shot type
    results = {}

    for shot_type, data in shot_types_to_track.items():
        print("="*80)
        print(f"SHOT TYPE: {shot_type.upper()}")
        print("="*80)
        print()

        player_stats = data['stats']

        # Filter to qualified players
        qualified_players = {
            name: stats for name, stats in player_stats.items()
            if stats['attempts'] >= min_attempts
        }

        total_players = len(player_stats)
        qualified_count = len(qualified_players)

        print(f"Total players with any {shot_type} attempts: {total_players}")
        print(f"Qualified players ({min_attempts}+ attempts): {qualified_count}")
        print()

        if qualified_count < 5:
            print(f"WARNING: Only {qualified_count} qualified players.")
            print(f"Insufficient sample size for reliable correlation.")
            print()
            results[shot_type] = {
                'correlation': 0.0,
                'qualified_players': qualified_count,
                'total_attempts': 0,
                'overall_pct': 0.0,
                'status': 'INSUFFICIENT_SAMPLE'
            }
            continue

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

        # Overall stats
        total_attempts = sum(s['attempts'] for s in qualified_players.values())
        total_makes = sum(s['makes'] for s in qualified_players.values())
        overall_pct = total_makes / total_attempts if total_attempts > 0 else 0

        print(f"Qualified players: {n}")
        print(f"Total attempts: {total_attempts}")
        print(f"Total makes: {total_makes}")
        print(f"Overall FG%: {overall_pct * 100:.1f}%")
        print()
        print(f"**Pearson correlation (composite vs FG%): {correlation:.3f}**")
        print()

        # Interpretation
        if correlation > 0.60:
            status = "EXCELLENT - System working correctly"
        elif correlation > 0.40:
            status = "GOOD - Mostly working"
        elif correlation > 0.25:
            status = "MODERATE - Defensive factors may be too strong"
        else:
            status = "WEAK - Defensive washout likely"

        print(f"Assessment: {status}")
        print()

        results[shot_type] = {
            'correlation': correlation,
            'qualified_players': qualified_count,
            'total_attempts': total_attempts,
            'total_makes': total_makes,
            'overall_pct': overall_pct,
            'status': status
        }

    # Summary comparison
    print("="*80)
    print("SUMMARY - ALL SHOT TYPES COMPARISON")
    print("="*80)
    print()
    print(f"{'Shot Type':<20} {'Correlation':>12} {'Players':>10} {'FG%':>10} {'Status':<30}")
    print("-"*80)

    for shot_type, data in results.items():
        if data['status'] == 'INSUFFICIENT_SAMPLE':
            print(f"{shot_type:<20} {'N/A':>12} {data['qualified_players']:>10} {'N/A':>10} {data['status']:<30}")
        else:
            print(f"{shot_type:<20} {data['correlation']:>12.3f} {data['qualified_players']:>10} {data['overall_pct']*100:>9.1f}% {data['status']:<30}")

    print()

    # Save results
    output_path = Path('output/ALL_SHOT_TYPES_CORRELATION.json')
    output_path.parent.mkdir(exist_ok=True)

    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2)

    print(f"Results saved to: {output_path}")
    print()

    return results


if __name__ == '__main__':
    run_all_shot_types_analysis(num_games=100, min_attempts=20)
