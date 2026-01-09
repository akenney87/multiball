"""
Trace-level debug: modify quarter_simulation to log why subs aren't happening.
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

print(f"\nQuarter complete: Home {result.home_score} - Away {result.away_score}")
print(f"Possessions: {result.possession_count}")

# Check substitution attempts
print(f"\n=== Substitution Analysis ===")
print(f"Total substitution events: {len(simulator.substitution_manager.get_all_substitution_events())}")

# Check time on court for starters
print(f"\n=== Time On Court (Starters) ===")
home_starters = list(simulator.substitution_manager.home_starters)[:5]
for player_name in home_starters:
    time = simulator.substitution_manager.time_on_court.get(player_name, 0)
    print(f"{player_name}: {time:.2f} minutes")

# Check if any player reached 8+ minutes
max_time = max(simulator.substitution_manager.time_on_court.values())
print(f"\nMax time on court: {max_time:.2f} minutes")
if max_time >= 8.0:
    print("EXPECTED: Substitutions should have happened at 8+ minutes!")
else:
    print(f"Players never reached 8 minutes, so no time-based subs expected.")

# Count dead balls (substitution opportunities)
print(f"\n=== Dead Ball Count ===")
pbp = result.play_by_play_text
made_baskets = pbp.count("makes")
fouls = pbp.count("FOUL:")
timeouts = pbp.count("TIMEOUT:")
print(f"Made baskets: {made_baskets} (each is a substitution opportunity)")
print(f"Fouls: {fouls}")
print(f"Timeouts: {timeouts}")
print(f"Total substitution opportunities: {made_baskets + fouls + timeouts}")

if made_baskets + fouls + timeouts > 10:
    print("\nPLENTY of substitution opportunities! Substitutions should be triggering.")
