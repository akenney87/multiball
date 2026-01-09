import sys
import os
sys.path.insert(0, os.path.abspath('.'))

from src.core.data_structures import TacticalSettings, create_player
from src.systems.game_simulation import GameSimulator
import random

def create_extended_roster(team_name, base_rating=75):
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
            grip_strength=rating, arm_strength=rating, core_strength=rating,
            agility=rating+random.randint(-3,3), acceleration=rating+random.randint(-3,3),
            top_speed=rating+random.randint(-3,3), jumping=rating+random.randint(-3,3),
            reactions=rating+random.randint(-3,3), stamina=rating+random.randint(-3,3),
            balance=rating+random.randint(-3,3), height=75 if pos in ['PG','SG'] else 85 if pos=='SF' else 90,
            durability=rating, awareness=rating+random.randint(-3,3), creativity=rating+random.randint(-3,3),
            determination=rating+random.randint(-3,3), bravery=rating, consistency=rating+random.randint(-3,3),
            composure=rating+random.randint(-3,3), patience=rating, hand_eye_coordination=rating+random.randint(-3,3),
            throw_accuracy=rating+random.randint(-3,3), form_technique=rating+random.randint(-3,3),
            finesse=rating+random.randint(-3,3), deception=rating, teamwork=rating
        )
        players.append(player)
    return players

def create_minutes(roster):
    allotment = {}
    for i in range(5): allotment[roster[i]['name']] = 32
    for i in range(5,8): allotment[roster[i]['name']] = 18
    for i in range(8,10): allotment[roster[i]['name']] = 13
    return allotment

def run_game(seed, home_rating, away_rating, home_name, away_name):
    random.seed(seed)
    home_roster = create_extended_roster(home_name, home_rating)
    away_roster = create_extended_roster(away_name, away_rating)
    
    home_tactics = TacticalSettings(
        pace='standard', man_defense_pct=70,
        scoring_option_1=home_roster[0]['name'],
        scoring_option_2=home_roster[1]['name'],
        scoring_option_3=home_roster[2]['name'],
        minutes_allotment=create_minutes(home_roster),
        rebounding_strategy='standard'
    )
    away_tactics = TacticalSettings(
        pace='standard', man_defense_pct=70,
        scoring_option_1=away_roster[0]['name'],
        scoring_option_2=away_roster[1]['name'],
        scoring_option_3=away_roster[2]['name'],
        minutes_allotment=create_minutes(away_roster),
        rebounding_strategy='standard'
    )
    
    sim = GameSimulator(
        home_roster=home_roster, away_roster=away_roster,
        tactical_home=home_tactics, tactical_away=away_tactics,
        home_team_name=home_name, away_team_name=away_name
    )
    return sim.simulate_game()

print("Generating Game 1: Close game (evenly matched)")
result1 = run_game(12345, 75, 75, "Warriors", "Lakers")
with open('output/M3_USER_REVIEW_GAME_1.txt', 'w', encoding='utf-8') as f:
    f.write("="*80 + "\n")
    f.write("M3 USER REVIEW GAME 1 - CLOSE GAME SCENARIO\n")
    f.write("="*80 + "\n\n")
    f.write(result1.play_by_play_text)
print(f"Game 1: {result1.home_score}-{result1.away_score}")

print("\nGenerating Game 2: Moderate blowout")
result2 = run_game(67890, 80, 68, "Celtics", "Heat")
with open('output/M3_USER_REVIEW_GAME_2.txt', 'w', encoding='utf-8') as f:
    f.write("="*80 + "\n")
    f.write("M3 USER REVIEW GAME 2 - MODERATE BLOWOUT SCENARIO\n")
    f.write("="*80 + "\n\n")
    f.write(result2.play_by_play_text)
print(f"Game 2: {result2.home_score}-{result2.away_score}")

print("\nGenerating Game 3: Defensive battle")
result3 = run_game(11111, 70, 70, "Bucks", "Nets")
with open('output/M3_USER_REVIEW_GAME_3.txt', 'w', encoding='utf-8') as f:
    f.write("="*80 + "\n")
    f.write("M3 USER REVIEW GAME 3 - DEFENSIVE BATTLE SCENARIO\n")
    f.write("="*80 + "\n\n")
    f.write(result3.play_by_play_text)
print(f"Game 3: {result3.home_score}-{result3.away_score}")

print("\nAll games generated successfully!")
