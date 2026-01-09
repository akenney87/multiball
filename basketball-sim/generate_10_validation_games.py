"""
Generate 10 validation games for realism-validation-specialist review.

Each game uses a different seed and saves to a separate output file.
"""

import json
import random
from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

# Load two equal-rated teams
with open('teams/Team_001.json', 'r') as f:
    team1 = json.load(f)

with open('teams/Team_002.json', 'r') as f:
    team2 = json.load(f)

print(f"Generating 10 validation games: {team1['name']} vs {team2['name']}")
print(f"{team1['name']} rating: {team1['actual_overall_rating']}")
print(f"{team2['name']} rating: {team2['actual_overall_rating']}")
print("=" * 80)
print()

# Create default tactical settings
minutes_allotment_home = {player['name']: 24.0 for player in team1['roster'][:10]}
minutes_allotment_away = {player['name']: 24.0 for player in team2['roster'][:10]}

tactical_home = TacticalSettings(
    pace='standard',
    man_defense_pct=70,
    scoring_option_1=team1['roster'][0]['name'],
    scoring_option_2=team1['roster'][1]['name'],
    scoring_option_3=team1['roster'][2]['name'],
    minutes_allotment=minutes_allotment_home,
    rebounding_strategy='standard'
)

tactical_away = TacticalSettings(
    pace='standard',
    man_defense_pct=70,
    scoring_option_1=team2['roster'][0]['name'],
    scoring_option_2=team2['roster'][1]['name'],
    scoring_option_3=team2['roster'][2]['name'],
    minutes_allotment=minutes_allotment_away,
    rebounding_strategy='standard'
)

# Generate 10 games with seeds 8000-8009 (v4 - iteration 8: turnover cap + OREB reduction)
for i in range(10):
    seed = 8000 + i
    random.seed(seed)

    print(f"Game {i+1}/10 (seed {seed})...", end=" ", flush=True)

    # Create simulator
    simulator = GameSimulator(
        home_roster=team1['roster'],
        away_roster=team2['roster'],
        home_team_name=team1['name'],
        away_team_name=team2['name'],
        tactical_home=tactical_home,
        tactical_away=tactical_away
    )

    # Simulate full game
    result = simulator.simulate_game()

    # Save play-by-play
    output_path = f'output/validation_game_{i+1:02d}.txt'
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(result.play_by_play_text)

    print(f"Final: {result.home_score}-{result.away_score} -> {output_path}")

print()
print("=" * 80)
print("All 10 validation games generated!")
print("=" * 80)
print()
print("Files saved:")
for i in range(10):
    print(f"  - output/validation_game_{i+1:02d}.txt")
