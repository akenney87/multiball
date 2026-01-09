"""
Generate 5 complete validation games with 10-player rosters for M3 final user review.

This script creates games with proper bench rotations to validate:
1. Timeout timing (before possession, not after)
2. Substitution timing (dead balls only)
3. Mid-quarter substitutions (6-10 min starters, 2-4 min bench)
"""

import sys
import os
sys.path.insert(0, os.path.abspath('.'))

from src.core.data_structures import TacticalSettings, create_player
from src.systems.game_simulation import GameSimulator
import random

def create_extended_roster(team_name, base_rating=75):
    """
    Create 10-player roster (5 starters + 5 bench).

    Args:
        team_name: Name prefix for players (e.g., "Warriors")
        base_rating: Base attribute rating (50-95)

    Returns:
        List of 10 player dicts
    """
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
            agility=rating+random.randint(-3,3),
            acceleration=rating+random.randint(-3,3),
            top_speed=rating+random.randint(-3,3),
            jumping=rating+random.randint(-3,3),
            reactions=rating+random.randint(-3,3),
            stamina=rating+random.randint(-3,3),
            balance=rating+random.randint(-3,3),
            height=75 if pos in ['PG','SG'] else 85 if pos=='SF' else 90,
            durability=rating,
            awareness=rating+random.randint(-3,3),
            creativity=rating+random.randint(-3,3),
            determination=rating+random.randint(-3,3),
            bravery=rating,
            consistency=rating+random.randint(-3,3),
            composure=rating+random.randint(-3,3),
            patience=rating,
            hand_eye_coordination=rating+random.randint(-3,3),
            throw_accuracy=rating+random.randint(-3,3),
            form_technique=rating+random.randint(-3,3),
            finesse=rating+random.randint(-3,3),
            deception=rating,
            teamwork=rating
        )
        players.append(player)

    return players


def create_minutes_allotment(roster):
    """
    Create minutes allocation that sums to 240.

    Distribution:
    - 5 starters: 32 min each = 160 min
    - 3 bench: 18 min each = 54 min
    - 2 bench: 13 min each = 26 min
    Total: 240 minutes

    Args:
        roster: List of 10 players

    Returns:
        Dict mapping player_name -> minutes
    """
    allotment = {}

    # Starters (0-4): 32 minutes each
    for i in range(5):
        allotment[roster[i]['name']] = 32

    # Primary bench (5-7): 18 minutes each
    for i in range(5, 8):
        allotment[roster[i]['name']] = 18

    # Deep bench (8-9): 13 minutes each
    for i in range(8, 10):
        allotment[roster[i]['name']] = 13

    return allotment


def run_validation_game(seed, home_rating, away_rating, home_name, away_name):
    """
    Run a single validation game with 10-player rosters.

    Args:
        seed: Random seed for reproducibility
        home_rating: Home team base rating (50-95)
        away_rating: Away team base rating (50-95)
        home_name: Home team name
        away_name: Away team name

    Returns:
        GameResult
    """
    random.seed(seed)

    # Create 10-player rosters
    home_roster = create_extended_roster(home_name, home_rating)
    away_roster = create_extended_roster(away_name, away_rating)

    # Create tactical settings
    home_tactics = TacticalSettings(
        pace='standard',
        man_defense_pct=70,
        scoring_option_1=home_roster[0]['name'],  # Starter 1
        scoring_option_2=home_roster[1]['name'],  # Starter 2
        scoring_option_3=home_roster[2]['name'],  # Starter 3
        minutes_allotment=create_minutes_allotment(home_roster),
        rebounding_strategy='standard',
        timeout_strategy='standard'
    )

    away_tactics = TacticalSettings(
        pace='standard',
        man_defense_pct=70,
        scoring_option_1=away_roster[0]['name'],
        scoring_option_2=away_roster[1]['name'],
        scoring_option_3=away_roster[2]['name'],
        minutes_allotment=create_minutes_allotment(away_roster),
        rebounding_strategy='standard',
        timeout_strategy='standard'
    )

    # Create and run game simulator
    sim = GameSimulator(
        home_roster=home_roster,
        away_roster=away_roster,
        tactical_home=home_tactics,
        tactical_away=away_tactics,
        home_team_name=home_name,
        away_team_name=away_name
    )

    return sim.simulate_game()


def main():
    """Generate 5 validation games for M3 final user review."""
    print("=" * 80)
    print("GENERATING M3 FINAL VALIDATION GAMES")
    print("=" * 80)
    print()
    print("Creating 5 complete games with 10-player rosters...")
    print("Each game will demonstrate:")
    print("  - Timeouts at correct moments")
    print("  - Substitutions during dead balls")
    print("  - Mid-quarter rotation (6-10 min stretches for starters)")
    print()

    games = [
        (12345, 75, 75, "Warriors", "Lakers", "Close game (evenly matched)"),
        (67890, 80, 68, "Celtics", "Heat", "Moderate blowout (strong home team)"),
        (111213, 70, 78, "Rockets", "Spurs", "Comeback scenario (weak home team)"),
        (141516, 82, 81, "Nets", "76ers", "High-scoring battle"),
        (171819, 73, 73, "Bulls", "Knicks", "Defensive grinder"),
    ]

    for i, (seed, home_rating, away_rating, home_name, away_name, description) in enumerate(games, 1):
        print(f"\n{'=' * 80}")
        print(f"GAME {i}/5: {home_name} vs {away_name}")
        print(f"Scenario: {description}")
        print(f"{'=' * 80}")
        print(f"Simulating...")

        result = run_validation_game(seed, home_rating, away_rating, home_name, away_name)

        # Save to file
        filename = f"output/FINAL_VALIDATION_GAME_{i}.txt"
        with open(filename, 'w', encoding='utf-8') as f:
            f.write("=" * 80 + "\n")
            f.write(f"M3 FINAL VALIDATION GAME {i} - {description.upper()}\n")
            f.write(f"{home_name} vs {away_name}\n")
            f.write("=" * 80 + "\n\n")
            f.write(result.play_by_play_text)

        # Count timeouts and substitutions
        pbp = result.play_by_play_text
        timeout_count = pbp.count("TIMEOUT")
        sub_count = pbp.count("Substitution")

        print(f"Complete! Final score: {result.home_score}-{result.away_score}")
        print(f"Timeouts: {timeout_count}")
        print(f"Substitutions: {sub_count}")
        print(f"Saved to: {filename}")

    print()
    print("=" * 80)
    print("ALL 5 VALIDATION GAMES GENERATED SUCCESSFULLY")
    print("=" * 80)
    print()
    print("Files saved:")
    for i in range(1, 6):
        print(f"  - output/FINAL_VALIDATION_GAME_{i}.txt")
    print()
    print("Please review these games to verify:")
    print("  1. Timeouts occur BEFORE possessions (not after turnovers)")
    print("  2. Substitutions occur during dead balls only")
    print("  3. Substitutions at quarter starts happen BEFORE first possession")
    print("  4. Players play realistic stretches (6-10 min for starters)")
    print()


if __name__ == '__main__':
    main()
