"""
Basketball Simulator - M3 USER REVIEW GAME GENERATOR
"""

import sys
import os
sys.path.insert(0, os.path.abspath('.'))

from src.core.data_structures import TacticalSettings, create_player
from src.systems.game_simulation import GameSimulator
import random
import json


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


def create_minutes_allotment(roster: list) -> dict:
    """Create realistic minutes allocation (must sum to 240)."""
    allotment = {}
    for i in range(5):
        allotment[roster[i]['name']] = 32
    for i in range(5, 8):
        allotment[roster[i]['name']] = 18
    for i in range(8, 10):
        allotment[roster[i]['name']] = 13

    total = sum(allotment.values())
    assert total == 240, f"Minutes must sum to 240, got {total}"
    return allotment


def generate_game(seed: int, scenario: str) -> tuple:
    """Generate a single game with specific scenario."""
    random.seed(seed)

    # Create rosters based on scenario
    if scenario == 'close':
        # Evenly matched teams
        home_roster = create_extended_roster("Warriors", base_rating=75)
        away_roster = create_extended_roster("Lakers", base_rating=75)
    elif scenario == 'blowout':
        # Mismatched teams
        home_roster = create_extended_roster("Warriors", base_rating=82)
        away_roster = create_extended_roster("Lakers", base_rating=68)
    elif scenario == 'defensive':
        # Lower offensive ratings
        home_roster = create_extended_roster("Warriors", base_rating=70)
        away_roster = create_extended_roster("Lakers", base_rating=70)
    else:
        home_roster = create_extended_roster("Warriors", base_rating=75)
        away_roster = create_extended_roster("Lakers", base_rating=75)

    # Create tactical settings
    home_tactics = TacticalSettings(
        pace='standard',
        man_defense_pct=70,
        scoring_option_1=home_roster[0]['name'],
        scoring_option_2=home_roster[1]['name'],
        scoring_option_3=home_roster[2]['name'],
        minutes_allotment=create_minutes_allotment(home_roster),
        rebounding_strategy='standard'
    )

    away_tactics = TacticalSettings(
        pace='standard',
        man_defense_pct=70,
        scoring_option_1=away_roster[0]['name'],
        scoring_option_2=away_roster[1]['name'],
        scoring_option_3=away_roster[2]['name'],
        minutes_allotment=create_minutes_allotment(away_roster),
        rebounding_strategy='standard'
    )

    # Run simulation
    sim = GameSimulator(
        home_roster=home_roster,
        away_roster=away_roster,
        tactical_home=home_tactics,
        tactical_away=away_tactics,
        home_team_name="Warriors",
        away_team_name="Lakers"
    )

    result = sim.simulate_game()
    return result


if __name__ == '__main__':
    print("Running quick test...")
    result = generate_game(12345, 'close')
    print(f"Game completed: Warriors {result.home_score} - Lakers {result.away_score}")
    print(f"Play-by-play length: {len(result.play_by_play_text)} characters")
