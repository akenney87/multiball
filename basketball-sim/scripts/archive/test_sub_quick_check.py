"""Quick check for illegal substitutions after made baskets."""
import sys
import random
sys.path.insert(0, '.')

from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings, create_player

def create_extended_roster(team_name, base_rating=75):
    positions = ['PG', 'SG', 'SF', 'PF', 'C', 'PG', 'SG', 'SF', 'PF', 'C']
    players = []
    for i, pos in enumerate(positions):
        is_starter = i < 5
        rating = base_rating + (5 if is_starter else -5)
        player = create_player(
            name=f'{team_name}_{i+1}_{pos}',
            position=pos,
            grip_strength=rating, arm_strength=rating, core_strength=rating,
            agility=rating, acceleration=rating, top_speed=rating,
            jumping=rating, reactions=rating, stamina=rating,
            balance=rating, height=75 if pos in ['PG', 'SG'] else 85 if pos == 'SF' else 90,
            durability=rating, awareness=rating, creativity=rating,
            determination=rating, bravery=rating, consistency=rating,
            composure=rating, patience=rating, hand_eye_coordination=rating,
            throw_accuracy=rating, form_technique=rating,
            finesse=rating, deception=rating, teamwork=rating
        )
        players.append(player)
    return players

def create_minutes_allotment(roster):
    allotment = {}
    for i in range(5):
        allotment[roster[i]['name']] = 32
    for i in range(5, 8):
        allotment[roster[i]['name']] = 18
    for i in range(8, 10):
        allotment[roster[i]['name']] = 13
    return allotment

random.seed(1000)
home_roster = create_extended_roster('Lakers', 75)
away_roster = create_extended_roster('Warriors', 75)

tactical_home = TacticalSettings(
    pace='standard', man_defense_pct=50,
    scoring_option_1=home_roster[0]['name'],
    scoring_option_2=home_roster[1]['name'],
    scoring_option_3=home_roster[2]['name'],
    minutes_allotment=create_minutes_allotment(home_roster),
    rebounding_strategy='standard',
    timeout_strategy='balanced',
    closers=[home_roster[0]['name'], home_roster[1]['name'], home_roster[2]['name']]
)

tactical_away = TacticalSettings(
    pace='standard', man_defense_pct=50,
    scoring_option_1=away_roster[0]['name'],
    scoring_option_2=away_roster[1]['name'],
    scoring_option_3=away_roster[2]['name'],
    minutes_allotment=create_minutes_allotment(away_roster),
    rebounding_strategy='standard',
    timeout_strategy='balanced',
    closers=[away_roster[0]['name'], away_roster[1]['name'], away_roster[2]['name']]
)

game_sim = GameSimulator(
    home_roster=home_roster,
    away_roster=away_roster,
    tactical_home=tactical_home,
    tactical_away=tactical_away,
    home_team_name='Lakers',
    away_team_name='Warriors'
)

result = game_sim.simulate_game(seed=1000)

# Write to file
with open('output/sub_quick_check.txt', 'w', encoding='utf-8') as f:
    f.write(result.play_by_play_text)

# Check for illegal subs (after made baskets without timeout)
lines = result.play_by_play_text.split('\n')
illegal_subs = []

for i in range(len(lines)):
    line = lines[i].strip()
    if 'Substitution' in line and '→' in line:
        # Check previous line
        if i > 0:
            prev = lines[i-1].strip()
            # Check if previous was a made basket
            if 'MAKES IT' in prev and 'Timeout' not in prev:
                # Check if there's a timeout between
                timeout_between = False
                for j in range(max(0, i-5), i):
                    if 'Timeout' in lines[j]:
                        timeout_between = True
                        break

                if not timeout_between:
                    illegal_subs.append({
                        'sub': line,
                        'previous': prev,
                        'line_num': i+1
                    })

print(f"Game completed. Play-by-play written to output/sub_quick_check.txt")
print(f"\nChecking for illegal substitutions after made baskets...")
print(f"Total substitutions: {result.play_by_play_text.count('Substitution')}")
print(f"Illegal subs (after made basket without timeout): {len(illegal_subs)}")

if illegal_subs:
    print("\nILLEGAL SUBSTITUTIONS DETECTED:")
    for sub in illegal_subs[:10]:  # Show first 10
        print(f"\nLine {sub['line_num']}:")
        print(f"  Previous: {sub['previous']}")
        print(f"  Sub: {sub['sub']}")
else:
    print("\n✓ SUCCESS: No illegal substitutions detected!")
