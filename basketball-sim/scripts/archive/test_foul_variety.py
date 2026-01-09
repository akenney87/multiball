"""
Test script for M3 Issue #7: Foul Variety Validation

Runs 20 full games and collects statistics on foul type distribution.
Goal: Verify that non-shooting fouls (reach-in, loose ball, holding) appear
      and that distribution matches NBA reality (~70% shooting, ~20% non-shooting, ~10% offensive).
"""

import os
import sys
import json

# Add project root to path
sys.path.insert(0, os.path.abspath('.'))

from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings, create_player
import random


def analyze_foul_distribution(game_log: str) -> dict:
    """
    Parse game log and extract foul type statistics.

    Returns dict with:
    - total_fouls
    - shooting_fouls
    - non_shooting_fouls (breakdown by subtype)
    - offensive_fouls
    """
    stats = {
        'total_fouls': 0,
        'shooting_fouls': 0,
        'non_shooting_fouls': 0,
        'reach_in_fouls': 0,
        'loose_ball_fouls': 0,
        'holding_fouls': 0,
        'offensive_fouls': 0,
        'and_ones': 0,
        'bonus_situations': 0,
    }

    lines = game_log.split('\n')

    for line in lines:
        # Shooting fouls
        if 'Shooting foul on' in line:
            stats['shooting_fouls'] += 1
            stats['total_fouls'] += 1

        # And-1 situations
        if 'makes the' in line and 'and draws the foul' in line:
            stats['and_ones'] += 1

        # Non-shooting fouls (by subtype)
        if 'Reach-in foul on' in line:
            stats['reach_in_fouls'] += 1
            stats['non_shooting_fouls'] += 1
            stats['total_fouls'] += 1

        if 'Loose ball foul on' in line:
            stats['loose_ball_fouls'] += 1
            stats['non_shooting_fouls'] += 1
            stats['total_fouls'] += 1

        if 'Holding foul on' in line:
            stats['holding_fouls'] += 1
            stats['non_shooting_fouls'] += 1
            stats['total_fouls'] += 1

        # Generic non-shooting foul (catch-all)
        if 'Non-shooting foul on' in line and 'Reach-in' not in line and 'Loose ball' not in line and 'Holding' not in line:
            stats['non_shooting_fouls'] += 1
            stats['total_fouls'] += 1

        # Offensive fouls (charges)
        if 'commits an offensive foul' in line or 'drew the charge' in line:
            stats['offensive_fouls'] += 1
            stats['total_fouls'] += 1

        # Bonus situations
        if 'IN THE BONUS!' in line:
            stats['bonus_situations'] += 1

    return stats


def create_extended_roster(team_name: str, base_rating: int = 75) -> list:
    """Create 10-player roster for testing."""
    positions = ['PG', 'SG', 'SF', 'PF', 'C', 'PG', 'SG', 'SF', 'PF', 'C']
    players = []
    for i, pos in enumerate(positions):
        is_starter = i < 5
        rating = base_rating + (5 if is_starter else -5) + random.randint(-5, 5)
        rating = max(50, min(95, rating))
        player = create_player(
            name=f"{team_name}_{i+1}_{pos}",
            position=pos,
            grip_strength=rating, arm_strength=rating, core_strength=rating,
            agility=rating + random.randint(-3, 3),
            acceleration=rating + random.randint(-3, 3),
            top_speed=rating + random.randint(-3, 3),
            jumping=rating + random.randint(-3, 3),
            reactions=rating + random.randint(-3, 3),
            stamina=rating + random.randint(-3, 3),
            balance=rating + random.randint(-3, 3),
            height=75 if pos in ['PG', 'SG'] else 85 if pos == 'SF' else 90,
            durability=rating,
            awareness=rating + random.randint(-3, 3),
            creativity=rating + random.randint(-3, 3),
            determination=rating,
            bravery=rating,
            consistency=rating + random.randint(-3, 3),
            composure=rating + random.randint(-3, 3),
            patience=rating,
            hand_eye_coordination=rating + random.randint(-3, 3),
            throw_accuracy=rating + random.randint(-3, 3),
            form_technique=rating + random.randint(-3, 3),
            finesse=rating + random.randint(-3, 3),
            deception=rating,
            teamwork=rating,
            discipline=rating + random.randint(-3, 3),
        )
        players.append(player)
    return players


def run_validation_suite(num_games: int = 20):
    """
    Run validation suite and save results.
    """
    print(f"Running {num_games} games to validate foul variety...")
    print("=" * 80)

    # Aggregate statistics
    aggregate_stats = {
        'total_fouls': 0,
        'shooting_fouls': 0,
        'non_shooting_fouls': 0,
        'reach_in_fouls': 0,
        'loose_ball_fouls': 0,
        'holding_fouls': 0,
        'offensive_fouls': 0,
        'and_ones': 0,
        'bonus_situations': 0,
    }

    game_stats_list = []

    for game_num in range(1, num_games + 1):
        print(f"\nSimulating game {game_num}/{num_games}...")

        # Create teams
        home_roster = create_extended_roster('Home', base_rating=75)
        away_roster = create_extended_roster('Away', base_rating=75)

        # Create tactical settings
        home_tactical = TacticalSettings(
            pace='standard',
            man_defense_pct=70,
            scoring_option_1='Home_1_PG',
            scoring_option_2='Home_2_SG',
            scoring_option_3='Home_3_SF',
            rebounding_strategy='standard',
            minutes_allotment={
                'Home_1_PG': 32, 'Home_2_SG': 32, 'Home_3_SF': 32, 'Home_4_PF': 32, 'Home_5_C': 32,
                'Home_6_PG': 16, 'Home_7_SG': 16, 'Home_8_SF': 16, 'Home_9_PF': 16, 'Home_10_C': 16
            },
            timeout_strategy='normal'
        )

        away_tactical = TacticalSettings(
            pace='standard',
            man_defense_pct=70,
            scoring_option_1='Away_1_PG',
            scoring_option_2='Away_2_SG',
            scoring_option_3='Away_3_SF',
            rebounding_strategy='standard',
            minutes_allotment={
                'Away_1_PG': 32, 'Away_2_SG': 32, 'Away_3_SF': 32, 'Away_4_PF': 32, 'Away_5_C': 32,
                'Away_6_PG': 16, 'Away_7_SG': 16, 'Away_8_SF': 16, 'Away_9_PF': 16, 'Away_10_C': 16
            },
            timeout_strategy='normal'
        )

        # Simulate game
        simulator = GameSimulator(
            home_roster=home_roster,
            away_roster=away_roster,
            tactical_home=home_tactical,
            tactical_away=away_tactical,
            home_team_name='Home',
            away_team_name='Away'
        )

        game_result = simulator.simulate_game()

        # Save game log
        output_path = f'output/foul_variety_validation_game_{game_num}.txt'
        os.makedirs('output', exist_ok=True)

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(game_result.play_by_play_text)

        # Analyze foul distribution
        game_stats = analyze_foul_distribution(game_result.play_by_play_text)
        game_stats_list.append(game_stats)

        # Aggregate
        for key in aggregate_stats:
            aggregate_stats[key] += game_stats[key]

        # Print game summary
        print(f"  Game {game_num} fouls: {game_stats['total_fouls']} total")
        print(f"    Shooting: {game_stats['shooting_fouls']}")
        print(f"    Non-shooting: {game_stats['non_shooting_fouls']} (reach-in: {game_stats['reach_in_fouls']}, loose ball: {game_stats['loose_ball_fouls']}, holding: {game_stats['holding_fouls']})")
        print(f"    Offensive: {game_stats['offensive_fouls']}")

    print("\n" + "=" * 80)
    print("VALIDATION RESULTS")
    print("=" * 80)

    # Calculate percentages
    total = aggregate_stats['total_fouls']
    if total > 0:
        shooting_pct = (aggregate_stats['shooting_fouls'] / total) * 100
        non_shooting_pct = (aggregate_stats['non_shooting_fouls'] / total) * 100
        offensive_pct = (aggregate_stats['offensive_fouls'] / total) * 100

        print(f"\nTotal games: {num_games}")
        print(f"Average fouls per game: {total / num_games:.1f}")
        print(f"\nFoul Type Distribution:")
        print(f"  Shooting fouls: {aggregate_stats['shooting_fouls']} ({shooting_pct:.1f}%)")
        print(f"  Non-shooting fouls: {aggregate_stats['non_shooting_fouls']} ({non_shooting_pct:.1f}%)")
        print(f"    - Reach-in: {aggregate_stats['reach_in_fouls']}")
        print(f"    - Loose ball: {aggregate_stats['loose_ball_fouls']}")
        print(f"    - Holding: {aggregate_stats['holding_fouls']}")
        print(f"  Offensive fouls: {aggregate_stats['offensive_fouls']} ({offensive_pct:.1f}%)")
        print(f"\nAnd-1 situations: {aggregate_stats['and_ones']}")
        print(f"Bonus situations: {aggregate_stats['bonus_situations']}")

        # NBA Reality Check
        print(f"\n" + "=" * 80)
        print("NBA REALITY CHECK")
        print("=" * 80)
        print(f"Target: 70-75% shooting, 20-25% non-shooting, 5-10% offensive")
        print(f"Actual: {shooting_pct:.1f}% shooting, {non_shooting_pct:.1f}% non-shooting, {offensive_pct:.1f}% offensive")

        # Determine pass/fail
        shooting_ok = 65 <= shooting_pct <= 80
        non_shooting_ok = 15 <= non_shooting_pct <= 30
        offensive_ok = 3 <= offensive_pct <= 15

        if shooting_ok and non_shooting_ok and offensive_ok:
            print(f"\nVERDICT: PASS - Distribution matches NBA reality")
        else:
            print(f"\nVERDICT: NEEDS TUNING")
            if not shooting_ok:
                print(f"  - Shooting fouls: {shooting_pct:.1f}% (target: 70-75%)")
            if not non_shooting_ok:
                print(f"  - Non-shooting fouls: {non_shooting_pct:.1f}% (target: 20-25%)")
            if not offensive_ok:
                print(f"  - Offensive fouls: {offensive_pct:.1f}% (target: 5-10%)")

    # Save detailed statistics to JSON
    summary_path = 'output/foul_variety_validation_summary.json'
    with open(summary_path, 'w', encoding='utf-8') as f:
        json.dump({
            'num_games': num_games,
            'aggregate_stats': aggregate_stats,
            'game_stats': game_stats_list,
            'percentages': {
                'shooting': shooting_pct,
                'non_shooting': non_shooting_pct,
                'offensive': offensive_pct,
            }
        }, f, indent=2)

    print(f"\nDetailed statistics saved to: {summary_path}")
    print(f"Game logs saved to: output/foul_variety_validation_game_1.txt through _20.txt")
    print("=" * 80)


if __name__ == '__main__':
    # Start with 5 games for testing, then run full 20
    import sys
    num_games = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    run_validation_suite(num_games=num_games)
