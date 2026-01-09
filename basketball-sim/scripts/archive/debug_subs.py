"""
Debug script to check if time-on-court tracking is working.
"""

import sys
sys.path.insert(0, '.')

from src.systems.quarter_simulation import QuarterSimulator
from src.core.data_structures import TacticalSettings, create_player
import random


def create_roster(team_name, size=10):
    """Create simple roster."""
    roster = []
    for i in range(size):
        pos = ['PG', 'SG', 'SF', 'PF', 'C'][i % 5]
        player = create_player(
            name=f"{team_name}_{i+1}_{pos}",
            position=pos,
            grip_strength=75,
            arm_strength=75,
            core_strength=75,
            agility=75,
            acceleration=75,
            top_speed=75,
            jumping=75,
            reactions=75,
            stamina=75,
            balance=75,
            height=80,
            durability=75,
            awareness=75,
            creativity=75,
            determination=75,
            bravery=75,
            consistency=75,
            composure=75,
            patience=75,
            hand_eye_coordination=75,
            throw_accuracy=75,
            form_technique=75,
            finesse=75,
            deception=75,
            teamwork=75
        )
        roster.append(player)
    return roster


# Create teams
home_roster = create_roster("Home")
away_roster = create_roster("Away")

# Create minutes allocation (35 for starters, 13 for bench)
home_minutes = {}
away_minutes = {}
for i in range(10):
    if i < 5:
        home_minutes[home_roster[i]['name']] = 35
        away_minutes[away_roster[i]['name']] = 35
    else:
        home_minutes[home_roster[i]['name']] = 13
        away_minutes[away_roster[i]['name']] = 13

# Create tactical settings
tactical_home = TacticalSettings(
    pace='standard',
    man_defense_pct=70,
    scoring_option_1=home_roster[0]['name'],
    scoring_option_2=home_roster[1]['name'],
    scoring_option_3=home_roster[2]['name'],
    minutes_allotment=home_minutes,
    rebounding_strategy='standard',
    closers=[home_roster[0]['name']],
    timeout_strategy='aggressive'
)

tactical_away = TacticalSettings(
    pace='standard',
    man_defense_pct=70,
    scoring_option_1=away_roster[0]['name'],
    scoring_option_2=away_roster[1]['name'],
    scoring_option_3=away_roster[2]['name'],
    minutes_allotment=away_minutes,
    rebounding_strategy='standard',
    closers=[away_roster[0]['name']],
    timeout_strategy='aggressive'
)

# Simulate one quarter
print("Simulating Quarter 1...")
simulator = QuarterSimulator(
    home_roster=home_roster,
    away_roster=away_roster,
    tactical_home=tactical_home,
    tactical_away=tactical_away,
    home_team_name="Home",
    away_team_name="Away",
    quarter_number=1
)

result = simulator.simulate_quarter(seed=42)

# Check time on court tracking
print("\n=== Time On Court Tracking ===")
print(f"Time on court dict keys: {list(simulator.substitution_manager.time_on_court.keys())[:5]}...")
print(f"\nSample time on court values:")
for player_name in list(simulator.substitution_manager.time_on_court.keys())[:5]:
    time_val = simulator.substitution_manager.time_on_court[player_name]
    print(f"  {player_name}: {time_val:.2f} minutes")

# Check starter identification
print(f"\n=== Starter Identification ===")
print(f"Home starters: {simulator.substitution_manager.home_starters}")
print(f"Away starters: {simulator.substitution_manager.away_starters}")

# Check substitution events
print(f"\n=== Substitution Events ===")
sub_events = simulator.substitution_manager.get_all_substitution_events()
print(f"Total substitutions: {len(sub_events)}")
for event in sub_events[:10]:  # First 10
    print(f"  {event.quarter_time}: {event.player_out} -> {event.player_in} ({event.reason})")

# Check play-by-play for substitutions
print(f"\n=== Play-by-Play Check (first 50 lines) ===")
pbp_lines = result.play_by_play_text.split('\n')
sub_count = 0
for line in pbp_lines[:50]:
    if 'SUB:' in line:
        print(line)
        sub_count += 1

if sub_count == 0:
    print("NO SUBSTITUTIONS FOUND IN PLAY-BY-PLAY")

print(f"\n=== Quarter Summary ===")
print(f"Possessions: {result.possession_count}")
print(f"Score: Home {result.home_score} - Away {result.away_score}")
print(f"Total substitutions: {len(sub_events)}")
