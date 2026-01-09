"""
M4 PHASE 2: 100-GAME VALIDATION SUITE

Runs 100 games using randomly generated teams.
Captures box scores, play-by-play, and game statistics for analysis.

Usage:
    python run_validation.py --games 100 --teams-dir teams/ --output validation_results/
"""

import random
import json
import os
import sys
from typing import Dict, List, Any, Tuple
from datetime import datetime

# Import game simulation modules
from src.systems.game_simulation import GameSimulator, GameResult
from src.core.data_structures import TacticalSettings


def load_teams_from_directory(teams_dir: str) -> List[Dict[str, Any]]:
    """Load all team JSON files from directory."""
    teams = []

    for filename in os.listdir(teams_dir):
        if filename.endswith('.json') and filename != '_SUMMARY.json':
            filepath = os.path.join(teams_dir, filename)
            with open(filepath, 'r') as f:
                team = json.load(f)
                teams.append(team)

    return teams


def create_standard_tactical_settings(roster: List[Dict]) -> TacticalSettings:
    """Create standard/baseline tactical settings for validation."""
    # Create standard minutes allocation: 35 for starters, 13 for bench
    minutes_allotment = create_minutes_allotment(roster)

    return TacticalSettings(
        pace='standard',
        man_defense_pct=50,  # 50% man, 50% zone
        scoring_option_1=None,
        scoring_option_2=None,
        scoring_option_3=None,
        minutes_allotment=minutes_allotment,
        rebounding_strategy='standard'
    )


def create_minutes_allotment(roster: List[Dict]) -> Dict[str, int]:
    """Create standard minutes allocation: 35 for starters, 13 for bench."""
    allotment = {}

    # Starters (0-4): 35 minutes each
    for i in range(5):
        allotment[roster[i]['name']] = 35

    # Bench (5-9): 13 minutes each
    for i in range(5, 10):
        allotment[roster[i]['name']] = 13

    return allotment


def extract_game_statistics(game_result: GameResult) -> Dict[str, Any]:
    """
    Extract key statistics from game result for analysis.

    Returns:
        Dict with aggregated team and player statistics
    """
    # GameResult.game_statistics contains home_stats and away_stats at team level
    # We'll also need to compute player-level stats from quarter_results

    home_stats = game_result.game_statistics['home_stats']
    away_stats = game_result.game_statistics['away_stats']

    # Calculate team totals from team_stats dict
    def calculate_team_totals(team_stats: Dict, team_score: int) -> Dict:
        # team_stats already has aggregated values from quarters
        # M4 FIX: Now includes FTM, FTA, STL, BLK, PF
        totals = {
            'points': team_score,
            'fgm': team_stats.get('fgm', 0),
            'fga': team_stats.get('fga', 0),
            'fg3m': team_stats.get('fg3m', 0),
            'fg3a': team_stats.get('fg3a', 0),
            'ftm': team_stats.get('ftm', 0),  # M4: Now tracked
            'fta': team_stats.get('fta', 0),  # M4: Now tracked
            'oreb': team_stats.get('oreb', 0),
            'dreb': team_stats.get('dreb', 0),
            'reb': team_stats.get('oreb', 0) + team_stats.get('dreb', 0),
            'ast': team_stats.get('ast', 0),
            'stl': team_stats.get('stl', 0),  # M4: Now tracked
            'blk': team_stats.get('blk', 0),  # M4: Now tracked
            'tov': team_stats.get('tov', 0),
            'pf': team_stats.get('pf', 0),    # M4: Now tracked
        }

        # Calculate percentages
        totals['fg_pct'] = (totals['fgm'] / totals['fga'] * 100) if totals['fga'] > 0 else 0
        totals['fg3_pct'] = (totals['fg3m'] / totals['fg3a'] * 100) if totals['fg3a'] > 0 else 0
        totals['ft_pct'] = (totals['ftm'] / totals['fta'] * 100) if totals['fta'] > 0 else 0

        # Calculate OREB%
        totals['oreb_pct'] = (totals['oreb'] / totals['reb'] * 100) if totals['reb'] > 0 else 0

        return totals

    home_totals = calculate_team_totals(home_stats, game_result.home_score)
    away_totals = calculate_team_totals(away_stats, game_result.away_score)

    # M4.5 FIX: Use actual possession count instead of NBA formula
    # The NBA formula (FGA + 0.44*FTA + TOV - OREB) is an approximation
    # that significantly undercounts our simulator's actual possessions.
    # Our simulator tracks ACTUAL possessions, so use that value directly.
    total_possessions = game_result.game_statistics.get('total_possessions', 0)
    possessions_per_team = total_possessions / 2.0 if total_possessions > 0 else 0

    return {
        'home_totals': home_totals,
        'away_totals': away_totals,
        'possessions': round(possessions_per_team, 1),  # Possessions per team
        'home_score': game_result.home_score,
        'away_score': game_result.away_score,
        'margin': abs(game_result.home_score - game_result.away_score)
    }


def run_validation_suite(
    num_games: int,
    teams_dir: str,
    output_dir: str,
    seed: int = None
) -> Dict[str, Any]:
    """
    Run validation suite with N games.

    Args:
        num_games: Number of games to simulate
        teams_dir: Directory containing team JSON files
        output_dir: Directory to save results
        seed: Random seed for reproducibility

    Returns:
        Dict with aggregated results and statistics
    """
    # Set random seed if provided
    if seed is not None:
        random.seed(seed)
        print(f"Using random seed: {seed}\n")

    # Load teams
    print(f"Loading teams from {teams_dir}...")
    teams = load_teams_from_directory(teams_dir)
    print(f"Loaded {len(teams)} teams\n")

    if len(teams) < 2:
        raise ValueError("Need at least 2 teams to run validation")

    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(os.path.join(output_dir, 'games'), exist_ok=True)

    # Track all game results
    all_game_stats = []

    print(f"{'='*80}")
    print(f"RUNNING {num_games}-GAME VALIDATION SUITE")
    print(f"{'='*80}\n")

    for game_num in range(1, num_games + 1):
        # Select two random teams
        home_team, away_team = random.sample(teams, 2)

        print(f"Game {game_num}/{num_games}: {home_team['name']} vs {away_team['name']}")
        print(f"  Ratings: {home_team['actual_overall_rating']:.1f} vs {away_team['actual_overall_rating']:.1f}")

        # Create tactical settings (standard baseline for validation)
        # TacticalSettings includes minutes_allotment
        home_tactical = create_standard_tactical_settings(home_team['roster'])
        away_tactical = create_standard_tactical_settings(away_team['roster'])

        # Run game simulation
        try:
            # Create game simulator
            game_sim = GameSimulator(
                home_roster=home_team['roster'],
                away_roster=away_team['roster'],
                tactical_home=home_tactical,
                tactical_away=away_tactical,
                home_team_name=home_team['name'],
                away_team_name=away_team['name']
            )

            # Simulate game
            game_result = game_sim.simulate_game(seed=None)

            # Extract statistics
            game_stats = extract_game_statistics(game_result)
            game_stats['game_number'] = game_num
            game_stats['home_team'] = home_team['name']
            game_stats['away_team'] = away_team['name']
            game_stats['home_rating'] = home_team['actual_overall_rating']
            game_stats['away_rating'] = away_team['actual_overall_rating']

            all_game_stats.append(game_stats)

            # Save game details to file
            game_file = os.path.join(output_dir, 'games', f'game_{game_num:03d}.json')
            game_output = {
                'game_number': game_num,
                'home_team': home_team['name'],
                'away_team': away_team['name'],
                'final_score': {
                    'home': game_result.home_score,
                    'away': game_result.away_score
                },
                'quarter_scores': game_result.quarter_scores,
                'game_statistics': game_result.game_statistics,
                'statistics': game_stats
            }

            with open(game_file, 'w') as f:
                json.dump(game_output, f, indent=2)

            # Save play-by-play
            pbp_file = os.path.join(output_dir, 'games', f'game_{game_num:03d}_pbp.txt')
            with open(pbp_file, 'w', encoding='utf-8') as f:
                f.write(game_result.play_by_play_text)

            print(f"  Final: {game_stats['home_score']}-{game_stats['away_score']} | " +
                  f"Poss: {game_stats['possessions']}")
            print(f"  Saved to: {game_file}\n")

        except Exception as e:
            print(f"  ERROR: Game {game_num} failed with: {str(e)}\n")
            continue

    # Calculate aggregate statistics
    print(f"\n{'='*80}")
    print("CALCULATING AGGREGATE STATISTICS")
    print(f"{'='*80}\n")

    summary = calculate_summary_statistics(all_game_stats)

    # Save summary
    summary_file = os.path.join(output_dir, 'VALIDATION_SUMMARY.json')
    summary['metadata'] = {
        'total_games': num_games,
        'successful_games': len(all_game_stats),
        'timestamp': datetime.now().isoformat(),
        'seed': seed
    }

    with open(summary_file, 'w') as f:
        json.dump(summary, f, indent=2)

    print(f"Summary saved to: {summary_file}")

    return summary


def calculate_summary_statistics(all_game_stats: List[Dict]) -> Dict[str, Any]:
    """Calculate aggregate statistics across all games."""

    if not all_game_stats:
        return {}

    # Aggregate team statistics
    all_points = []
    all_fg_pct = []
    all_fg3_pct = []
    all_ft_pct = []
    all_fg3a = []
    all_fta = []
    all_reb = []
    all_oreb = []
    all_oreb_pct = []
    all_ast = []
    all_tov = []
    all_stl = []
    all_blk = []
    all_pf = []
    all_poss = []
    all_margins = []

    for game in all_game_stats:
        # Home team
        all_points.append(game['home_totals']['points'])
        all_fg_pct.append(game['home_totals']['fg_pct'])
        all_fg3_pct.append(game['home_totals']['fg3_pct'])
        all_ft_pct.append(game['home_totals']['ft_pct'])
        all_fg3a.append(game['home_totals']['fg3a'])
        all_fta.append(game['home_totals']['fta'])
        all_reb.append(game['home_totals']['reb'])
        all_oreb.append(game['home_totals']['oreb'])
        all_oreb_pct.append(game['home_totals']['oreb_pct'])
        all_ast.append(game['home_totals']['ast'])
        all_tov.append(game['home_totals']['tov'])
        all_stl.append(game['home_totals']['stl'])
        all_blk.append(game['home_totals']['blk'])
        all_pf.append(game['home_totals']['pf'])

        # Away team
        all_points.append(game['away_totals']['points'])
        all_fg_pct.append(game['away_totals']['fg_pct'])
        all_fg3_pct.append(game['away_totals']['fg3_pct'])
        all_ft_pct.append(game['away_totals']['ft_pct'])
        all_fg3a.append(game['away_totals']['fg3a'])
        all_fta.append(game['away_totals']['fta'])
        all_reb.append(game['away_totals']['reb'])
        all_oreb.append(game['away_totals']['oreb'])
        all_oreb_pct.append(game['away_totals']['oreb_pct'])
        all_ast.append(game['away_totals']['ast'])
        all_tov.append(game['away_totals']['tov'])
        all_stl.append(game['away_totals']['stl'])
        all_blk.append(game['away_totals']['blk'])
        all_pf.append(game['away_totals']['pf'])

        # Game-level stats
        all_poss.append(game['possessions'])
        all_margins.append(game['margin'])

    def avg(lst):
        return sum(lst) / len(lst) if lst else 0

    return {
        'averages': {
            'points_per_game': round(avg(all_points), 1),
            'fg_pct': round(avg(all_fg_pct), 1),
            'fg3_pct': round(avg(all_fg3_pct), 1),
            'ft_pct': round(avg(all_ft_pct), 1),
            'fg3a_per_game': round(avg(all_fg3a), 1),
            'fta_per_game': round(avg(all_fta), 1),
            'reb_per_game': round(avg(all_reb), 1),
            'oreb_per_game': round(avg(all_oreb), 1),
            'oreb_pct': round(avg(all_oreb_pct), 1),
            'ast_per_game': round(avg(all_ast), 1),
            'tov_per_game': round(avg(all_tov), 1),
            'stl_per_game': round(avg(all_stl), 1),
            'blk_per_game': round(avg(all_blk), 1),
            'pf_per_game': round(avg(all_pf), 1),
            'possessions_per_game': round(avg(all_poss), 1),
            'avg_margin': round(avg(all_margins), 1)
        },
        'distributions': {
            'blowouts_20_plus': sum(1 for m in all_margins if m >= 20),
            'close_games_5_or_less': sum(1 for m in all_margins if m <= 5),
            'high_scoring_120_plus': sum(1 for p in all_points if p >= 120),
            'low_scoring_80_or_less': sum(1 for p in all_points if p <= 80)
        }
    }


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Run validation suite')
    parser.add_argument('--games', type=int, default=100,
                        help='Number of games to simulate (default: 100)')
    parser.add_argument('--teams-dir', type=str, default='teams',
                        help='Directory containing team JSON files (default: teams/)')
    parser.add_argument('--output', type=str, default='validation_results',
                        help='Output directory (default: validation_results/)')
    parser.add_argument('--seed', type=int, default=None,
                        help='Random seed for reproducibility (default: random)')

    args = parser.parse_args()

    # Run validation
    try:
        summary = run_validation_suite(
            num_games=args.games,
            teams_dir=args.teams_dir,
            output_dir=args.output,
            seed=args.seed
        )

        print(f"\n{'='*80}")
        print("VALIDATION SUITE COMPLETE")
        print(f"{'='*80}")
        print("\nKey Statistics:")
        print(f"  Points per game: {summary['averages']['points_per_game']}")
        print(f"  FG%: {summary['averages']['fg_pct']}%")
        print(f"  3PT%: {summary['averages']['fg3_pct']}%")
        print(f"  FT%: {summary['averages']['ft_pct']}%")
        print(f"  Possessions: {summary['averages']['possessions_per_game']}")
        print(f"  OREB%: {summary['averages']['oreb_pct']}%")

    except Exception as e:
        print(f"\nERROR: Validation suite failed: {str(e)}")
        sys.exit(1)
