"""
Create a close game scenario to test intentional fouling with correct possession.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from src.game_simulator import GameSimulator
from src.core.tactical_settings import TacticalSettings

# Create two balanced teams
balanced_team_a = {
    'team_name': 'Balanced_A',
    'roster': []
}

balanced_team_b = {
    'team_name': 'Balanced_B',
    'roster': []
}

# Create 5 balanced players for each team (all 70s across the board)
positions = ['PG', 'SG', 'SF', 'PF', 'C']
for i, pos in enumerate(positions):
    # Team A
    player_a = {
        'name': f'Player_A{i+1}',
        'position': pos,
        # Physical
        'grip_strength': 70, 'arm_strength': 70, 'core_strength': 70,
        'agility': 70, 'acceleration': 70, 'top_speed': 70,
        'jumping': 70, 'reactions': 70, 'stamina': 85,
        'balance': 70, 'height': 70, 'durability': 70,
        # Mental
        'awareness': 70, 'creativity': 70, 'determination': 70,
        'bravery': 70, 'consistency': 70, 'composure': 70, 'patience': 70,
        # Technical
        'hand_eye_coordination': 70, 'throw_accuracy': 70,
        'form_technique': 70, 'finesse': 70, 'deception': 70, 'teamwork': 70
    }
    balanced_team_a['roster'].append(player_a)

    # Team B (identical stats)
    player_b = {
        'name': f'Player_B{i+1}',
        'position': pos,
        # Physical
        'grip_strength': 70, 'arm_strength': 70, 'core_strength': 70,
        'agility': 70, 'acceleration': 70, 'top_speed': 70,
        'jumping': 70, 'reactions': 70, 'stamina': 85,
        'balance': 70, 'height': 70, 'durability': 70,
        # Mental
        'awareness': 70, 'creativity': 70, 'determination': 70,
        'bravery': 70, 'consistency': 70, 'composure': 70, 'patience': 70,
        # Technical
        'hand_eye_coordination': 70, 'throw_accuracy': 70,
        'form_technique': 70, 'finesse': 70, 'deception': 70, 'teamwork': 70
    }
    balanced_team_b['roster'].append(player_b)

# Standard tactical settings
tactical_settings = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    scoring_option_1=None,
    scoring_option_2=None,
    scoring_option_3=None,
    minutes_allotment={
        f'Player_A{i+1}': 48 for i in range(5)
    },
    rebounding_strategy='standard'
)

tactical_settings_b = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    scoring_option_1=None,
    scoring_option_2=None,
    scoring_option_3=None,
    minutes_allotment={
        f'Player_B{i+1}': 48 for i in range(5)
    },
    rebounding_strategy='standard'
)

print("Simulating balanced teams game (checking for intentional foul scenarios)...\n")

# Simulate game
game_sim = GameSimulator(
    home_team=balanced_team_a,
    away_team=balanced_team_b,
    tactical_home=tactical_settings,
    tactical_away=tactical_settings_b
)

result = game_sim.simulate_game()

# Save detailed output
with open('output/BALANCED_GAME.txt', 'w') as f:
    f.write(result.detailed_game_log)

print(f"Final Score: {balanced_team_a['team_name']} {result.home_score}, {balanced_team_b['team_name']} {result.away_score}")
print(f"\nDetailed game log saved to output/BALANCED_GAME.txt")
print("\nSearching for intentional fouls...")

# Check for intentional fouls in the output
with open('output/BALANCED_GAME.txt', 'r') as f:
    lines = f.readlines()

intentional_fouls = []
for i, line in enumerate(lines):
    if 'intentionally fouls' in line:
        # Get context: previous line (possession), current line (foul), next line (FT result)
        context_start = max(0, i-1)
        context_end = min(len(lines), i+3)
        intentional_fouls.append({
            'line_num': i+1,
            'context': lines[context_start:context_end]
        })

if intentional_fouls:
    print(f"Found {len(intentional_fouls)} intentional foul(s):")
    for foul in intentional_fouls:
        print(f"\n--- Line {foul['line_num']} ---")
        print(''.join(foul['context']))
else:
    print("No intentional fouls occurred (game may not have been close enough)")
