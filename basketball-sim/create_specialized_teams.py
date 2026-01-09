"""
Create two evenly-matched teams with specialized players
Each player represents a distinct archetype/specialty
"""

import json
import os

def create_specialized_player(name, position, archetype):
    """Create a player with specialized attributes based on archetype."""

    # Base attributes (average)
    base_attrs = {
        'grip_strength': 50, 'arm_strength': 50, 'core_strength': 50,
        'agility': 50, 'acceleration': 50, 'top_speed': 50,
        'jumping': 50, 'reactions': 50, 'stamina': 75,
        'balance': 50, 'height': 50, 'durability': 75,
        'awareness': 50, 'creativity': 50, 'determination': 50,
        'bravery': 50, 'consistency': 50, 'composure': 50, 'patience': 50,
        'hand_eye_coordination': 50, 'throw_accuracy': 50, 'form_technique': 50,
        'finesse': 50, 'deception': 50, 'teamwork': 50,
    }

    # Apply archetype-specific attributes
    if archetype == 'elite_3pt_shooter':
        # Elite shooting, poor rim finishing
        base_attrs.update({
            'form_technique': 95, 'throw_accuracy': 95, 'finesse': 95,
            'hand_eye_coordination': 90, 'balance': 90, 'composure': 90,
            'consistency': 85, 'agility': 85,
            # Poor rim finishing
            'jumping': 30, 'core_strength': 30, 'top_speed': 30,
            'acceleration': 30, 'grip_strength': 30, 'arm_strength': 30,
        })

    elif archetype == 'rim_finisher':
        # Elite rim finishing, poor 3PT
        base_attrs.update({
            'jumping': 95, 'core_strength': 95, 'top_speed': 95,
            'acceleration': 95, 'grip_strength': 90, 'arm_strength': 90,
            'bravery': 85, 'determination': 85,
            # Poor 3PT
            'form_technique': 25, 'throw_accuracy': 25, 'finesse': 25,
            'hand_eye_coordination': 30, 'balance': 30,
        })

    elif archetype == 'playmaker':
        # Elite passing, balanced shooting
        base_attrs.update({
            'creativity': 95, 'awareness': 95, 'teamwork': 95,
            'hand_eye_coordination': 90, 'patience': 90, 'composure': 90,
            # Balanced shooting (60s)
            'form_technique': 60, 'throw_accuracy': 60, 'finesse': 60,
            'jumping': 60, 'core_strength': 60,
        })

    elif archetype == 'shot_blocker':
        # Elite shot blocking, poor 3PT (center build)
        base_attrs.update({
            'jumping': 95, 'height': 95, 'reactions': 95,
            'awareness': 90, 'determination': 90, 'grip_strength': 90,
            'core_strength': 85, 'arm_strength': 85,
            # Poor 3PT
            'form_technique': 20, 'throw_accuracy': 20, 'finesse': 20,
            'balance': 30, 'agility': 35,
        })

    elif archetype == 'perimeter_defender':
        # Elite perimeter defense, balanced offense
        base_attrs.update({
            'agility': 95, 'reactions': 95, 'acceleration': 95,
            'top_speed': 95, 'awareness': 90, 'determination': 90,
            'stamina': 90, 'teamwork': 85,
            # Balanced offense (55s)
            'form_technique': 55, 'throw_accuracy': 55, 'finesse': 55,
            'jumping': 55, 'core_strength': 55,
        })

    player = {'name': name, 'position': position}
    player.update(base_attrs)
    return player

# Calculate overall rating for a player (simple average of all attributes)
def calculate_rating(player):
    attrs = [v for k, v in player.items() if k not in ['name', 'position']]
    return sum(attrs) / len(attrs)

# Create Team A
team_a_players = [
    create_specialized_player('Elite_3PT_Shooter', 'SG', 'elite_3pt_shooter'),
    create_specialized_player('Rim_Finisher', 'SF', 'rim_finisher'),
    create_specialized_player('Playmaker', 'PG', 'playmaker'),
    create_specialized_player('Shot_Blocker', 'C', 'shot_blocker'),
    create_specialized_player('Perimeter_Defender', 'SF', 'perimeter_defender'),
]

# Create Team B (same archetypes, different names)
team_b_players = [
    create_specialized_player('Sharpshooter', 'SG', 'elite_3pt_shooter'),
    create_specialized_player('Slasher', 'SF', 'rim_finisher'),
    create_specialized_player('Floor_General', 'PG', 'playmaker'),
    create_specialized_player('Rim_Protector', 'C', 'shot_blocker'),
    create_specialized_player('Lockdown_Defender', 'SF', 'perimeter_defender'),
]

# Calculate team ratings
team_a_rating = sum(calculate_rating(p) for p in team_a_players) / len(team_a_players)
team_b_rating = sum(calculate_rating(p) for p in team_b_players) / len(team_b_players)

print(f"Team A overall rating: {team_a_rating:.2f}")
print(f"Team B overall rating: {team_b_rating:.2f}")
print()

# Create team JSONs
team_a = {
    'team_name': 'Team_Specialized_A',
    'players': team_a_players
}

team_b = {
    'team_name': 'Team_Specialized_B',
    'players': team_b_players
}

# Save to teams/specialized directory
os.makedirs('teams/specialized', exist_ok=True)

with open('teams/specialized/team_a.json', 'w') as f:
    json.dump(team_a, f, indent=2)

with open('teams/specialized/team_b.json', 'w') as f:
    json.dump(team_b, f, indent=2)

print("Team A players:")
for p in team_a_players:
    print(f"  {p['name']} ({p['position']}) - Rating: {calculate_rating(p):.1f}")
    print(f"    3PT shooting: {(p['form_technique'] + p['throw_accuracy'] + p['finesse'])/3:.1f}")
    print(f"    Rim finishing: {(p['jumping'] + p['core_strength'] + p['top_speed'])/3:.1f}")

print()
print("Team B players:")
for p in team_b_players:
    print(f"  {p['name']} ({p['position']}) - Rating: {calculate_rating(p):.1f}")
    print(f"    3PT shooting: {(p['form_technique'] + p['throw_accuracy'] + p['finesse'])/3:.1f}")
    print(f"    Rim finishing: {(p['jumping'] + p['core_strength'] + p['top_speed'])/3:.1f}")

print()
print("Specialized teams created in teams/specialized/")
