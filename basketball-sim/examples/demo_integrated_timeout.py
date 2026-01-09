"""
Basketball Simulator - M3 Phase 2c Integration Demo

Full game demonstration with integrated timeout system.
Creates comprehensive logs for M3 sign-off review.

This demo runs a complete 48-minute game with:
- Timeout system fully integrated
- Momentum detection (8-0, 10-2, 12-0 runs)
- End-game timeout strategy
- Complete play-by-play logs
- Statistical validation

Output: Detailed game logs saved to 'output/integrated_timeout_game.txt'
"""

import sys
import os
sys.path.insert(0, os.path.abspath('.'))

from src.core.data_structures import TacticalSettings, create_player
from src.systems.game_simulation import GameSimulator
import random


def create_extended_roster(team_name: str, base_rating: int = 75) -> list:
    """
    Create a 10-player roster with varied attributes.

    Args:
        team_name: Team name prefix
        base_rating: Base attribute rating (65-85)

    Returns:
        List of 10 player dicts
    """
    positions = ['PG', 'SG', 'SF', 'PF', 'C', 'PG', 'SG', 'SF', 'PF', 'C']
    players = []

    for i, pos in enumerate(positions):
        # Starters (0-4) slightly better than bench (5-9)
        is_starter = i < 5
        rating = base_rating + (5 if is_starter else -5)

        # Add variation
        variation = random.randint(-5, 5)
        rating += variation

        # Normalize to 1-100 range
        rating = max(50, min(95, rating))

        # Create player with all 25 attributes
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


def create_minutes_allotment(roster: list) -> dict:
    """
    Create realistic minutes allocation for a 10-player rotation.

    Starters (0-4): 32 minutes
    Key bench (5-7): 18 minutes
    Deep bench (8-9): 13 minutes

    Must sum to exactly 240.
    """
    allotment = {}

    # Starters: 5 × 32 = 160
    for i in range(5):
        allotment[roster[i]['name']] = 32

    # Key bench: 3 × 18 = 54
    for i in range(5, 8):
        allotment[roster[i]['name']] = 18

    # Deep bench: 2 × 13 = 26
    for i in range(8, 10):
        allotment[roster[i]['name']] = 13

    # Total: 160 + 54 + 26 = 240 ✓
    total = sum(allotment.values())
    assert total == 240, f"Minutes must sum to 240, got {total}"

    return allotment


def run_integrated_timeout_demo(seed: int = 500):
    """
    Run full game with integrated timeout system.

    Args:
        seed: Random seed for reproducibility
    """
    print("=" * 80)
    print("M3 PHASE 2C - INTEGRATED TIMEOUT SYSTEM DEMO")
    print("=" * 80)
    print()
    print("This demo demonstrates:")
    print("- Full 48-minute game simulation")
    print("- Integrated timeout detection and execution")
    print("- Momentum timeout strategy")
    print("- End-game timeout strategy")
    print("- Complete play-by-play with timeout events")
    print()
    print(f"Random seed: {seed}")
    print()

    # Set seed
    random.seed(seed)

    # Create rosters
    print("Creating rosters...")
    home_roster = create_extended_roster("Warriors", base_rating=78)
    away_roster = create_extended_roster("Lakers", base_rating=76)

    # Create minutes allocation
    home_minutes = create_minutes_allotment(home_roster)
    away_minutes = create_minutes_allotment(away_roster)

    # Define closers (top 5-7 players for close games)
    home_closers = [p['name'] for p in home_roster[:7]]
    away_closers = [p['name'] for p in away_roster[:7]]

    # Create tactical settings with AGGRESSIVE timeout strategy for more timeout events
    tactical_home = TacticalSettings(
        pace='standard',
        man_defense_pct=60,
        scoring_option_1=home_roster[0]['name'],
        scoring_option_2=home_roster[1]['name'],
        scoring_option_3=home_roster[2]['name'],
        minutes_allotment=home_minutes,
        rebounding_strategy='standard',
        closers=home_closers,
        timeout_strategy='aggressive'  # M3: Aggressive strategy (threshold 8)
    )

    tactical_away = TacticalSettings(
        pace='standard',
        man_defense_pct=50,
        scoring_option_1=away_roster[0]['name'],
        scoring_option_2=away_roster[1]['name'],
        scoring_option_3=away_roster[2]['name'],
        minutes_allotment=away_minutes,
        rebounding_strategy='standard',
        closers=away_closers,
        timeout_strategy='standard'  # M3: Standard strategy (threshold 10)
    )

    # Validate tactical settings
    tactical_home.validate()
    tactical_away.validate()

    print("Tactical Settings:")
    print(f"  Home (Warriors): Aggressive timeout strategy")
    print(f"  Away (Lakers): Standard timeout strategy")
    print()

    # Create game simulator
    print("Initializing game simulator...")
    game_sim = GameSimulator(
        home_roster=home_roster,
        away_roster=away_roster,
        tactical_home=tactical_home,
        tactical_away=tactical_away,
        home_team_name="Warriors",
        away_team_name="Lakers"
    )

    # Simulate game
    print("=" * 80)
    print("STARTING FULL GAME SIMULATION")
    print("=" * 80)
    game_result = game_sim.simulate_game(seed=seed)

    # Print summary to console
    print()
    print("=" * 80)
    print("GAME COMPLETE - SUMMARY")
    print("=" * 80)
    print(f"Final Score: Warriors {game_result.home_score}, Lakers {game_result.away_score}")
    print()

    # Quarter scores
    print("Scoring by Quarter:")
    print(f"  Q1: Warriors {game_result.quarter_scores[0][0]}, Lakers {game_result.quarter_scores[0][1]}")
    print(f"  Q2: Warriors {game_result.quarter_scores[1][0]}, Lakers {game_result.quarter_scores[1][1]}")
    print(f"  Q3: Warriors {game_result.quarter_scores[2][0]}, Lakers {game_result.quarter_scores[2][1]}")
    print(f"  Q4: Warriors {game_result.quarter_scores[3][0]}, Lakers {game_result.quarter_scores[3][1]}")
    print()

    # Parse timeout events from play-by-play text
    print("=" * 80)
    print("TIMEOUT SYSTEM STATISTICS")
    print("=" * 80)

    # Count TIMEOUT lines in the play-by-play
    pbp_text = game_result.play_by_play_text
    timeout_lines = [line for line in pbp_text.split('\n') if 'TIMEOUT' in line and 'timeouts remaining' in line]

    total_home_timeouts = len([line for line in timeout_lines if 'Warriors' in line])
    total_away_timeouts = len([line for line in timeout_lines if 'Lakers' in line])

    print(f"Total Timeouts Used:")
    print(f"  Warriors (Aggressive): {total_home_timeouts} / 7")
    print(f"  Lakers (Standard): {total_away_timeouts} / 7")
    print()

    if total_home_timeouts + total_away_timeouts > 0:
        print(f"[OK] Timeout system is working! Found {total_home_timeouts + total_away_timeouts} timeout events in play-by-play.")
    else:
        print(f"[WARN] No timeout events found. This may be expected if no scoring runs occurred.")
    print()

    # Game statistics
    stats = game_result.game_statistics
    total_poss = stats['total_possessions']
    total_score = stats['home_score'] + stats['away_score']
    ppp = total_score / total_poss if total_poss > 0 else 0

    print("=" * 80)
    print("GAME STATISTICS")
    print("=" * 80)
    print(f"Total Possessions: {total_poss}")
    print(f"Total Score: {total_score}")
    print(f"Points per Possession: {ppp:.3f} (Target: 1.05-1.15)")
    print()

    # Save complete play-by-play to file
    output_dir = 'output'
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    output_file = os.path.join(output_dir, 'integrated_timeout_game.txt')
    print(f"Saving complete play-by-play to: {output_file}")

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(game_result.play_by_play_text)

    print()
    print("=" * 80)
    print("DEMO COMPLETE")
    print("=" * 80)
    print()
    print(f"Full game log saved to: {output_file}")
    print()
    print("Please review the log file for M3 sign-off.")
    print()
    print("Key things to look for in the log:")
    print("  1. Timeout events appear in play-by-play with reason and timeouts remaining")
    print("  2. Timeouts occur after scoring runs (8-0, 10-2, etc.)")
    print("  3. End-game timeouts in Q4 (final 2 minutes)")
    print("  4. Aggressive strategy (Warriors) calls more timeouts than Standard (Lakers)")
    print("  5. Game completes successfully with no crashes")
    print()


if __name__ == '__main__':
    run_integrated_timeout_demo(seed=500)
