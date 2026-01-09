"""
Generate a single sample game with new teams and refactored attributes.
"""

import json
import random
from pathlib import Path
from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

# Load two teams
team1_file = Path('teams/Team_001.json')
team2_file = Path('teams/Team_050.json')

with open(team1_file) as f:
    team1 = json.load(f)

with open(team2_file) as f:
    team2 = json.load(f)

print(f"Selected teams:")
print(f"  {team1['name']}: Rating {team1['actual_overall_rating']:.1f}")
print(f"  {team2['name']}: Rating {team2['actual_overall_rating']:.1f}")
print(f"  Rating differential: {abs(team1['actual_overall_rating'] - team2['actual_overall_rating']):.1f}")
print()

# Create standard minutes allocation
def create_minutes_allotment(roster):
    minutes = {}
    for i, player in enumerate(roster):
        if i < 5:  # Starters
            minutes[player['name']] = 35
        else:  # Bench
            minutes[player['name']] = 13
    return minutes

# Standard tactical settings
tactical_home = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    scoring_option_1=None,
    scoring_option_2=None,
    scoring_option_3=None,
    minutes_allotment=create_minutes_allotment(team1['roster']),
    rebounding_strategy='standard'
)

tactical_away = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    scoring_option_1=None,
    scoring_option_2=None,
    scoring_option_3=None,
    minutes_allotment=create_minutes_allotment(team2['roster']),
    rebounding_strategy='standard'
)

# Set seed for reproducibility
random.seed(12345)

print("Simulating game...")
simulator = GameSimulator(
    home_roster=team1['roster'],
    away_roster=team2['roster'],
    home_team_name=team1['name'],
    away_team_name=team2['name'],
    tactical_home=tactical_home,
    tactical_away=tactical_away
)

result = simulator.simulate_game()

# Save play-by-play
output_file = 'output/SAMPLE_GAME_NEW_ATTRIBUTES.txt'
with open(output_file, 'w', encoding='utf-8') as f:
    f.write(result.play_by_play_text)

# Save box score
box_score_file = 'output/SAMPLE_GAME_BOX_SCORE.json'
with open(box_score_file, 'w') as f:
    json.dump({
        'teams': {
            'home': team1['name'],
            'away': team2['name']
        },
        'ratings': {
            'home': team1['actual_overall_rating'],
            'away': team2['actual_overall_rating']
        },
        'final_score': {
            'home': result.home_score,
            'away': result.away_score
        },
        'quarter_scores': result.quarter_scores,
        'statistics': result.game_statistics
    }, f, indent=2)

print(f"\\nGame complete!")
print(f"Final Score: {team1['name']} {result.home_score}, {team2['name']} {result.away_score}")
print(f"Margin: {abs(result.home_score - result.away_score)} points")
print()
print(f"Play-by-play saved to: {output_file}")
print(f"Box score saved to: {box_score_file}")
