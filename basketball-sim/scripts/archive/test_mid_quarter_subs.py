"""
Test script for mid-quarter substitution patterns.

Runs 3 full games and analyzes:
1. Substitution frequency and timing
2. Time-on-court distribution (shift lengths)
3. Minutes allocation adherence
4. Substitution reason breakdown
"""

import sys
import os
sys.path.insert(0, os.path.abspath('.'))

from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings, create_player
import random


def print_section_header(title):
    """Print a formatted section header."""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)


def analyze_substitution_patterns(game_result, game_num):
    """
    Analyze substitution patterns for one game.

    Args:
        game_result: GameResult object
        game_num: Game number (1-3)
    """
    print_section_header(f"GAME {game_num} SUBSTITUTION ANALYSIS")

    # Collect all substitution events across all quarters
    all_subs = []
    for quarter_result in game_result.quarter_results:
        # Access the substitution manager's events through play_by_play_logger
        # (since quarter_result doesn't expose them directly)
        # We'll infer from play-by-play text for now
        pass

    # Track substitution events by reason
    sub_reasons = {}
    sub_times = []

    # Track minutes played by each player
    minutes_played = {}

    # Analyze each quarter
    for q_idx, quarter_result in enumerate(game_result.quarter_results):
        quarter_num = q_idx + 1
        print(f"\n--- Quarter {quarter_num} ---")

        # Count substitutions in play-by-play text
        pbp_lines = quarter_result.play_by_play_text.split('\n')
        quarter_subs = 0
        quarter_sub_reasons = {}

        for line in pbp_lines:
            if 'SUB:' in line:
                quarter_subs += 1

                # Extract reason if present
                if '(stamina)' in line:
                    reason = 'stamina'
                elif '(minutes)' in line:
                    reason = 'minutes'
                elif '(time_on_court_starter)' in line:
                    reason = 'time_on_court_starter'
                elif '(time_on_court_bench)' in line:
                    reason = 'time_on_court_bench'
                elif '(blowout_rest)' in line:
                    reason = 'blowout_rest'
                elif '(foul_out)' in line:
                    reason = 'foul_out'
                else:
                    reason = 'other'

                quarter_sub_reasons[reason] = quarter_sub_reasons.get(reason, 0) + 1

        print(f"  Total substitutions: {quarter_subs}")
        if quarter_sub_reasons:
            print(f"  Breakdown by reason:")
            for reason, count in sorted(quarter_sub_reasons.items()):
                print(f"    - {reason}: {count}")

        # Aggregate to game level
        for reason, count in quarter_sub_reasons.items():
            sub_reasons[reason] = sub_reasons.get(reason, 0) + count

    # Overall game substitution summary
    print(f"\n--- Overall Game Substitutions ---")
    total_subs = sum(sub_reasons.values())
    print(f"Total substitutions: {total_subs}")
    print(f"Breakdown by reason:")
    for reason, count in sorted(sub_reasons.items(), key=lambda x: x[1], reverse=True):
        pct = (count / total_subs * 100) if total_subs > 0 else 0
        print(f"  - {reason}: {count} ({pct:.1f}%)")

    # Analyze minutes played
    print(f"\n--- Minutes Played Analysis ---")

    # Get final minutes from last quarter result
    final_quarter = game_result.quarter_results[-1]
    minutes_played = final_quarter.minutes_played

    # Separate into starters and bench
    # Starters are top 5 for each team by minutes
    home_players = sorted(
        [(name, mins) for name, mins in minutes_played.items() if 'Celtics' in name],
        key=lambda x: x[1],
        reverse=True
    )
    away_players = sorted(
        [(name, mins) for name, mins in minutes_played.items() if 'Warriors' in name],
        key=lambda x: x[1],
        reverse=True
    )

    print(f"\nHome Team (Celtics):")
    print(f"  Starters (Top 5):")
    for name, mins in home_players[:5]:
        print(f"    {name}: {mins:.1f} minutes")
    print(f"  Bench:")
    for name, mins in home_players[5:]:
        print(f"    {name}: {mins:.1f} minutes")

    print(f"\nAway Team (Warriors):")
    print(f"  Starters (Top 5):")
    for name, mins in away_players[:5]:
        print(f"    {name}: {mins:.1f} minutes")
    print(f"  Bench:")
    for name, mins in away_players[5:]:
        print(f"    {name}: {mins:.1f} minutes")

    # Check adherence to target allocation (35 for starters, 13 for bench)
    print(f"\n--- Minutes Allocation Adherence ---")

    # Calculate deviation from target
    starter_target = 35.0
    bench_target = 13.0

    home_starter_dev = sum(abs(mins - starter_target) for _, mins in home_players[:5]) / 5
    home_bench_dev = sum(abs(mins - bench_target) for _, mins in home_players[5:]) / len(home_players[5:]) if len(home_players) > 5 else 0

    away_starter_dev = sum(abs(mins - starter_target) for _, mins in away_players[:5]) / 5
    away_bench_dev = sum(abs(mins - bench_target) for _, mins in away_players[5:]) / len(away_players[5:]) if len(away_players) > 5 else 0

    print(f"Home Team:")
    print(f"  Average starter deviation from 35 min target: {home_starter_dev:.1f} min")
    print(f"  Average bench deviation from 13 min target: {home_bench_dev:.1f} min")

    print(f"Away Team:")
    print(f"  Average starter deviation from 35 min target: {away_starter_dev:.1f} min")
    print(f"  Average bench deviation from 13 min target: {away_bench_dev:.1f} min")


def create_extended_roster(team_name: str, base_rating: int = 75) -> list:
    """Create a 10-player roster with varied attributes."""
    positions = ['PG', 'SG', 'SF', 'PF', 'C', 'PG', 'SG', 'SF', 'PF', 'C']
    players = []

    for i, pos in enumerate(positions):
        is_starter = i < 5
        rating = base_rating + (5 if is_starter else -5)
        variation = random.randint(-5, 5)
        rating = max(50, min(95, rating + variation))

        player = create_player(
            name=f"{team_name}_{i+1}_{pos}",
            position=pos,
            grip_strength=rating,
            arm_strength=rating,
            core_strength=rating,
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
            determination=rating + random.randint(-3, 3),
            bravery=rating,
            consistency=rating + random.randint(-3, 3),
            composure=rating + random.randint(-3, 3),
            patience=rating,
            hand_eye_coordination=rating + random.randint(-3, 3),
            throw_accuracy=rating + random.randint(-3, 3),
            form_technique=rating + random.randint(-3, 3),
            finesse=rating + random.randint(-3, 3),
            deception=rating,
            teamwork=rating
        )
        players.append(player)

    return players


def run_test_games(num_games=3):
    """
    Run multiple test games and analyze substitution patterns.

    Args:
        num_games: Number of games to simulate
    """
    print_section_header("MID-QUARTER SUBSTITUTION PATTERN TEST")
    print(f"Running {num_games} full games to test substitution patterns...")
    print(f"Expected behavior:")
    print(f"  - Starters: 6-10 minute shifts, 3-4 shifts per game")
    print(f"  - Bench: 2-4 minute shifts, 4-5 shifts per game")
    print(f"  - Target: 35 min for starters, 13 min for bench")
    print(f"  - Minimum: 4 minutes on court before substitution")

    # Generate teams
    random.seed(42)
    home_roster = create_extended_roster("Celtics", base_rating=75)
    away_roster = create_extended_roster("Warriors", base_rating=75)

    home_team = {'team_name': 'Celtics', 'players': home_roster}
    away_team = {'team_name': 'Warriors', 'players': away_roster}

    # Configure tactical settings with 35/13 split
    # Top 5 players get 35 minutes, bottom 5 get 13 minutes
    home_minutes = {}
    for i, player in enumerate(home_team['players']):
        if i < 5:
            home_minutes[player['name']] = 35
        else:
            home_minutes[player['name']] = 13

    away_minutes = {}
    for i, player in enumerate(away_team['players']):
        if i < 5:
            away_minutes[player['name']] = 35
        else:
            away_minutes[player['name']] = 13

    tactical_home = TacticalSettings(
        pace='standard',
        man_defense_pct=70,
        scoring_option_1=home_team['players'][0]['name'],
        scoring_option_2=home_team['players'][1]['name'],
        scoring_option_3=home_team['players'][2]['name'],
        minutes_allotment=home_minutes,
        rebounding_strategy='standard',
        closers=[home_team['players'][0]['name'], home_team['players'][1]['name']],
        timeout_strategy='aggressive'
    )

    tactical_away = TacticalSettings(
        pace='standard',
        man_defense_pct=70,
        scoring_option_1=away_team['players'][0]['name'],
        scoring_option_2=away_team['players'][1]['name'],
        scoring_option_3=away_team['players'][2]['name'],
        minutes_allotment=away_minutes,
        rebounding_strategy='standard',
        closers=[away_team['players'][0]['name'], away_team['players'][1]['name']],
        timeout_strategy='aggressive'
    )

    # Run games
    for game_num in range(1, num_games + 1):
        print(f"\n")
        print_section_header(f"Simulating Game {game_num}")

        simulator = GameSimulator(
            home_roster=home_roster,
            away_roster=away_roster,
            tactical_home=tactical_home,
            tactical_away=tactical_away,
            home_team_name="Celtics",
            away_team_name="Warriors"
        )

        game_result = simulator.simulate_game(seed=1000 + game_num)

        # Print basic game result
        print(f"\nFinal Score: Celtics {game_result.home_score} - Warriors {game_result.away_score}")

        # Analyze substitution patterns
        analyze_substitution_patterns(game_result, game_num)

    # Print summary
    print_section_header("TEST COMPLETE")
    print(f"\nSuccessfully simulated {num_games} games.")
    print(f"\nKey findings:")
    print(f"  - Review substitution reasons above")
    print(f"  - Check if 'time_on_court_starter' and 'time_on_court_bench' appear")
    print(f"  - Verify minutes allocation adherence (should be within ±3 minutes)")
    print(f"  - Confirm no player plays entire 12-minute quarter without rest")


if __name__ == "__main__":
    run_test_games(num_games=3)
