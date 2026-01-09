"""Quick test for single game with seed 601 to debug timeout issue."""
import sys
import os
sys.path.insert(0, os.path.abspath('.'))

from src.core.data_structures import TacticalSettings, create_player
from src.systems.game_simulation import GameSimulator
import random

def create_extended_roster(team_name: str, base_rating: int = 75) -> list:
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
    allotment = {}
    for i in range(5):
        allotment[roster[i]['name']] = 32
    for i in range(5, 8):
        allotment[roster[i]['name']] = 18
    for i in range(8, 10):
        allotment[roster[i]['name']] = 13
    return allotment

# Seed 601 - same as validation_game_1
random.seed(601)

home_roster = create_extended_roster("Celtics", base_rating=75 + random.randint(-3, 3))
away_roster = create_extended_roster("Heat", base_rating=75 + random.randint(-3, 3))

tactical_home = TacticalSettings(
    pace='standard',
    man_defense_pct=50 + random.randint(-10, 10),
    scoring_option_1=home_roster[0]['name'],
    scoring_option_2=home_roster[1]['name'],
    scoring_option_3=home_roster[2]['name'],
    minutes_allotment=create_minutes_allotment(home_roster),
    rebounding_strategy='standard',
    closers=[p['name'] for p in home_roster[:7]],
    timeout_strategy='aggressive'
)

tactical_away = TacticalSettings(
    pace='standard',
    man_defense_pct=50 + random.randint(-10, 10),
    scoring_option_1=away_roster[0]['name'],
    scoring_option_2=away_roster[1]['name'],
    scoring_option_3=away_roster[2]['name'],
    minutes_allotment=create_minutes_allotment(away_roster),
    rebounding_strategy='standard',
    closers=[p['name'] for p in away_roster[:7]],
    timeout_strategy='standard'
)

tactical_home.validate()
tactical_away.validate()

game_sim = GameSimulator(
    home_roster=home_roster,
    away_roster=away_roster,
    tactical_home=tactical_home,
    tactical_away=tactical_away,
    home_team_name="Celtics",
    away_team_name="Heat"
)

print("Running Game 1 (seed 601) with debug output...")
game_result = game_sim.simulate_game(seed=601)
print(f"\nFinal: Celtics {game_result.home_score}, Heat {game_result.away_score}")
