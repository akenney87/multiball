"""
Single game test with timeout debugging to understand what's happening.
"""

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'src')))

from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

# Simple teams
LAKERS = [
    {'name': 'Lakers_1_PG', 'position': 'PG', 'grip_strength': 65, 'arm_strength': 60, 'core_strength': 70, 'agility': 85, 'acceleration': 80, 'top_speed': 75, 'jumping': 70, 'reactions': 85, 'stamina': 75, 'balance': 80, 'height': 50, 'durability': 70, 'awareness': 80, 'creativity': 75, 'determination': 75, 'bravery': 70, 'consistency': 75, 'composure': 80, 'patience': 70, 'hand_eye_coordination': 85, 'throw_accuracy': 70, 'form_technique': 65, 'finesse': 75, 'deception': 70, 'teamwork': 85},
    {'name': 'Lakers_2_SG', 'position': 'SG', 'grip_strength': 60, 'arm_strength': 65, 'core_strength': 65, 'agility': 80, 'acceleration': 85, 'top_speed': 80, 'jumping': 75, 'reactions': 80, 'stamina': 70, 'balance': 75, 'height': 55, 'durability': 65, 'awareness': 75, 'creativity': 70, 'determination': 70, 'bravery': 75, 'consistency': 70, 'composure': 75, 'patience': 65, 'hand_eye_coordination': 80, 'throw_accuracy': 75, 'form_technique': 70, 'finesse': 70, 'deception': 65, 'teamwork': 70},
    {'name': 'Lakers_3_SF', 'position': 'SF', 'grip_strength': 70, 'arm_strength': 70, 'core_strength': 75, 'agility': 75, 'acceleration': 75, 'top_speed': 75, 'jumping': 80, 'reactions': 75, 'stamina': 75, 'balance': 70, 'height': 65, 'durability': 75, 'awareness': 70, 'creativity': 65, 'determination': 75, 'bravery': 70, 'consistency': 70, 'composure': 70, 'patience': 70, 'hand_eye_coordination': 75, 'throw_accuracy': 65, 'form_technique': 60, 'finesse': 65, 'deception': 70, 'teamwork': 75},
    {'name': 'Lakers_4_PF', 'position': 'PF', 'grip_strength': 75, 'arm_strength': 80, 'core_strength': 80, 'agility': 65, 'acceleration': 65, 'top_speed': 60, 'jumping': 75, 'reactions': 70, 'stamina': 70, 'balance': 65, 'height': 75, 'durability': 80, 'awareness': 65, 'creativity': 60, 'determination': 80, 'bravery': 75, 'consistency': 65, 'composure': 65, 'patience': 75, 'hand_eye_coordination': 70, 'throw_accuracy': 55, 'form_technique': 50, 'finesse': 60, 'deception': 55, 'teamwork': 70},
    {'name': 'Lakers_5_C', 'position': 'C', 'grip_strength': 80, 'arm_strength': 85, 'core_strength': 85, 'agility': 55, 'acceleration': 55, 'top_speed': 50, 'jumping': 70, 'reactions': 65, 'stamina': 65, 'balance': 60, 'height': 85, 'durability': 85, 'awareness': 60, 'creativity': 55, 'determination': 80, 'bravery': 80, 'consistency': 60, 'composure': 60, 'patience': 80, 'hand_eye_coordination': 65, 'throw_accuracy': 50, 'form_technique': 45, 'finesse': 55, 'deception': 50, 'teamwork': 65},
    {'name': 'Lakers_6_Bench1', 'position': 'PG', 'grip_strength': 55, 'arm_strength': 50, 'core_strength': 60, 'agility': 75, 'acceleration': 70, 'top_speed': 65, 'jumping': 60, 'reactions': 75, 'stamina': 70, 'balance': 70, 'height': 45, 'durability': 60, 'awareness': 70, 'creativity': 65, 'determination': 65, 'bravery': 60, 'consistency': 65, 'composure': 70, 'patience': 60, 'hand_eye_coordination': 75, 'throw_accuracy': 60, 'form_technique': 55, 'finesse': 65, 'deception': 60, 'teamwork': 75},
    {'name': 'Lakers_7_Bench2', 'position': 'SG', 'grip_strength': 50, 'arm_strength': 55, 'core_strength': 55, 'agility': 70, 'acceleration': 75, 'top_speed': 70, 'jumping': 65, 'reactions': 70, 'stamina': 65, 'balance': 65, 'height': 50, 'durability': 55, 'awareness': 65, 'creativity': 60, 'determination': 60, 'bravery': 65, 'consistency': 60, 'composure': 65, 'patience': 55, 'hand_eye_coordination': 70, 'throw_accuracy': 65, 'form_technique': 60, 'finesse': 60, 'deception': 55, 'teamwork': 60},
    {'name': 'Lakers_8_Bench3', 'position': 'SF', 'grip_strength': 60, 'arm_strength': 60, 'core_strength': 65, 'agility': 65, 'acceleration': 65, 'top_speed': 65, 'jumping': 70, 'reactions': 65, 'stamina': 70, 'balance': 60, 'height': 60, 'durability': 65, 'awareness': 60, 'creativity': 55, 'determination': 65, 'bravery': 60, 'consistency': 60, 'composure': 60, 'patience': 65, 'hand_eye_coordination': 65, 'throw_accuracy': 55, 'form_technique': 50, 'finesse': 55, 'deception': 60, 'teamwork': 65},
]

WARRIORS = [
    {'name': 'Warriors_1_PG', 'position': 'PG', 'grip_strength': 60, 'arm_strength': 55, 'core_strength': 65, 'agility': 90, 'acceleration': 85, 'top_speed': 80, 'jumping': 65, 'reactions': 90, 'stamina': 80, 'balance': 85, 'height': 45, 'durability': 65, 'awareness': 85, 'creativity': 80, 'determination': 70, 'bravery': 65, 'consistency': 80, 'composure': 85, 'patience': 75, 'hand_eye_coordination': 90, 'throw_accuracy': 75, 'form_technique': 70, 'finesse': 80, 'deception': 75, 'teamwork': 90},
    {'name': 'Warriors_2_SG', 'position': 'SG', 'grip_strength': 55, 'arm_strength': 60, 'core_strength': 60, 'agility': 85, 'acceleration': 90, 'top_speed': 85, 'jumping': 70, 'reactions': 85, 'stamina': 75, 'balance': 80, 'height': 50, 'durability': 60, 'awareness': 80, 'creativity': 75, 'determination': 65, 'bravery': 70, 'consistency': 75, 'composure': 80, 'patience': 70, 'hand_eye_coordination': 85, 'throw_accuracy': 80, 'form_technique': 75, 'finesse': 75, 'deception': 70, 'teamwork': 75},
    {'name': 'Warriors_3_SF', 'position': 'SF', 'grip_strength': 65, 'arm_strength': 65, 'core_strength': 70, 'agility': 80, 'acceleration': 80, 'top_speed': 80, 'jumping': 85, 'reactions': 80, 'stamina': 80, 'balance': 75, 'height': 60, 'durability': 70, 'awareness': 75, 'creativity': 70, 'determination': 70, 'bravery': 65, 'consistency': 75, 'composure': 75, 'patience': 75, 'hand_eye_coordination': 80, 'throw_accuracy': 70, 'form_technique': 65, 'finesse': 70, 'deception': 75, 'teamwork': 80},
    {'name': 'Warriors_4_PF', 'position': 'PF', 'grip_strength': 70, 'arm_strength': 75, 'core_strength': 75, 'agility': 70, 'acceleration': 70, 'top_speed': 65, 'jumping': 80, 'reactions': 75, 'stamina': 75, 'balance': 70, 'height': 70, 'durability': 75, 'awareness': 70, 'creativity': 65, 'determination': 75, 'bravery': 70, 'consistency': 70, 'composure': 70, 'patience': 80, 'hand_eye_coordination': 75, 'throw_accuracy': 60, 'form_technique': 55, 'finesse': 65, 'deception': 60, 'teamwork': 75},
    {'name': 'Warriors_5_C', 'position': 'C', 'grip_strength': 75, 'arm_strength': 80, 'core_strength': 80, 'agility': 60, 'acceleration': 60, 'top_speed': 55, 'jumping': 75, 'reactions': 70, 'stamina': 70, 'balance': 65, 'height': 80, 'durability': 80, 'awareness': 65, 'creativity': 60, 'determination': 75, 'bravery': 75, 'consistency': 65, 'composure': 65, 'patience': 85, 'hand_eye_coordination': 70, 'throw_accuracy': 55, 'form_technique': 50, 'finesse': 60, 'deception': 55, 'teamwork': 70},
    {'name': 'Warriors_6_Bench1', 'position': 'PG', 'grip_strength': 50, 'arm_strength': 45, 'core_strength': 55, 'agility': 80, 'acceleration': 75, 'top_speed': 70, 'jumping': 55, 'reactions': 80, 'stamina': 75, 'balance': 75, 'height': 40, 'durability': 55, 'awareness': 75, 'creativity': 70, 'determination': 60, 'bravery': 55, 'consistency': 70, 'composure': 75, 'patience': 65, 'hand_eye_coordination': 80, 'throw_accuracy': 65, 'form_technique': 60, 'finesse': 70, 'deception': 65, 'teamwork': 80},
    {'name': 'Warriors_7_Bench2', 'position': 'SG', 'grip_strength': 45, 'arm_strength': 50, 'core_strength': 50, 'agility': 75, 'acceleration': 80, 'top_speed': 75, 'jumping': 60, 'reactions': 75, 'stamina': 70, 'balance': 70, 'height': 45, 'durability': 50, 'awareness': 70, 'creativity': 65, 'determination': 55, 'bravery': 60, 'consistency': 65, 'composure': 70, 'patience': 60, 'hand_eye_coordination': 75, 'throw_accuracy': 70, 'form_technique': 65, 'finesse': 65, 'deception': 60, 'teamwork': 65},
    {'name': 'Warriors_8_Bench3', 'position': 'SF', 'grip_strength': 55, 'arm_strength': 55, 'core_strength': 60, 'agility': 70, 'acceleration': 70, 'top_speed': 70, 'jumping': 75, 'reactions': 70, 'stamina': 75, 'balance': 65, 'height': 55, 'durability': 60, 'awareness': 65, 'creativity': 60, 'determination': 60, 'bravery': 55, 'consistency': 65, 'composure': 65, 'patience': 70, 'hand_eye_coordination': 70, 'throw_accuracy': 60, 'form_technique': 55, 'finesse': 60, 'deception': 65, 'teamwork': 70},
]

def create_tactical_settings(team_roster):
    """Create standard tactical settings."""
    players_with_avg = []
    for player in team_roster:
        attrs = [v for k, v in player.items() if k not in ['name', 'position']]
        avg = sum(attrs) / len(attrs) if attrs else 0
        players_with_avg.append((player['name'], avg))

    players_with_avg.sort(key=lambda x: x[1], reverse=True)
    top_5 = [p[0] for p in players_with_avg[:5]]

    minutes_allotment = {}
    for player in team_roster:
        if player['name'] in top_5:
            minutes_allotment[player['name']] = 36
        else:
            minutes_allotment[player['name']] = 12

    return TacticalSettings(
        pace='standard',
        man_defense_pct=70,
        scoring_option_1=top_5[0] if len(top_5) > 0 else None,
        scoring_option_2=top_5[1] if len(top_5) > 1 else None,
        scoring_option_3=top_5[2] if len(top_5) > 2 else None,
        minutes_allotment=minutes_allotment,
        rebounding_strategy='standard'
    )

if __name__ == '__main__':
    lakers_tactical = create_tactical_settings(LAKERS)
    warriors_tactical = create_tactical_settings(WARRIORS)

    simulator = GameSimulator(
        home_roster=LAKERS,
        away_roster=WARRIORS,
        tactical_home=lakers_tactical,
        tactical_away=warriors_tactical,
        home_team_name='Lakers',
        away_team_name='Warriors'
    )

    # Use same seed as validation game 1
    result = simulator.simulate_game(seed=None)

    # Save output
    os.makedirs('output', exist_ok=True)
    with open('output/debug_timeout_test.txt', 'w', encoding='utf-8') as f:
        f.write(result.play_by_play_text)

    print("Game simulated. Check output/debug_timeout_test.txt")
    print(f"Final score: Lakers {result.home_score}, Warriors {result.away_score}")

    # Search for timeouts
    lines = result.play_by_play_text.split('\n')
    timeout_count = 0
    for i, line in enumerate(lines):
        if 'TIMEOUT' in line:
            timeout_count += 1
            # Print context (3 lines before, timeout line, 2 lines after)
            print(f"\n=== TIMEOUT #{timeout_count} ===")
            for j in range(max(0, i-3), min(len(lines), i+3)):
                print(lines[j])

    print(f"\nTotal timeouts: {timeout_count}")
