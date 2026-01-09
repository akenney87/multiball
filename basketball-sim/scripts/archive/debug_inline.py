"""
Inline debug: directly test the substitution manager's check function.
"""

import sys
sys.path.insert(0, '.')

from src.systems.substitutions import SubstitutionManager
from src.systems.stamina_manager import StaminaTracker
from src.core.data_structures import TacticalSettings, create_player


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
        home_minutes[home_roster[i]['name']] = 35 / 4.0  # Per-quarter
        away_minutes[away_roster[i]['name']] = 35 / 4.0
    else:
        home_minutes[home_roster[i]['name']] = 13 / 4.0
        away_minutes[away_roster[i]['name']] = 13 / 4.0

# Create substitution manager
sub_manager = SubstitutionManager(
    home_roster=home_roster,
    away_roster=away_roster,
    minutes_allocation_home=home_minutes,
    minutes_allocation_away=away_minutes
)

# Create stamina tracker
stamina_tracker = StaminaTracker(home_roster + away_roster)

# Simulate 8 minutes on court for starters
print("=== Setting up: 8 minutes on court for all starters ===")
for player in home_roster[:5] + away_roster[:5]:
    sub_manager.time_on_court[player['name']] = 8.0
    stamina_tracker.add_minutes(player['name'], 8.0 * 60)  # Convert to seconds

print("\n=== Calling check_and_execute_substitutions ===")
sub_events = sub_manager.check_and_execute_substitutions(
    stamina_tracker=stamina_tracker,
    game_time_str="4:00",
    time_remaining_in_quarter=240,  # 4 minutes left
    quarter_number=1
)

print(f"\nSubstitution events returned: {len(sub_events)}")
for event in sub_events:
    print(f"  {event.player_out} -> {event.player_in} ({event.reason})")

if len(sub_events) == 0:
    print("\nNO SUBSTITUTIONS! Investigating why...")

    # Check home team manually
    print("\n=== Manual Check: Home Team Starter #1 ===")
    test_player = home_roster[0]
    print(f"Player: {test_player['name']}")
    print(f"Time on court: {sub_manager.time_on_court[test_player['name']]:.2f} min")
    print(f"Minutes played: {stamina_tracker.get_minutes_played(test_player['name']):.2f} min")
    print(f"Current stamina: {stamina_tracker.get_current_stamina(test_player['name']):.2f}")
    print(f"Minutes allocation: {home_minutes[test_player['name']]:.2f} min")
    print(f"Is starter: {sub_manager._is_starter(test_player['name'])}")
    print(f"Last sub time: {sub_manager.last_sub_time.get(test_player['name'], 'NOT SET')}")

    # Check the substitution logic directly
    should_sub, reason = sub_manager._should_substitute_mid_quarter(
        player=test_player,
        stamina_tracker=stamina_tracker,
        time_remaining_in_quarter=240,
        quarter_number=1
    )
    print(f"Mid-quarter check: should_sub={should_sub}, reason='{reason}'")

    # Check bench availability
    bench = sub_manager.home_lineup_manager.get_bench_players()
    print(f"\nBench players available: {len(bench)}")
    for b in bench:
        print(f"  {b['name']} (position: {b['position']})")
