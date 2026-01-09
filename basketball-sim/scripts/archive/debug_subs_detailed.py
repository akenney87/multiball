"""
Detailed debug script to trace why substitutions aren't happening.
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
        home_minutes[home_roster[i]['name']] = 35 / 4.0  # Per-quarter allocation
        away_minutes[away_roster[i]['name']] = 35 / 4.0
    else:
        home_minutes[home_roster[i]['name']] = 13 / 4.0
        away_minutes[away_roster[i]['name']] = 13 / 4.0

print("=== Minutes Allocation (Per Quarter) ===")
print("Starters (should be 8.75 min):", home_minutes[home_roster[0]['name']])
print("Bench (should be 3.25 min):", home_minutes[home_roster[5]['name']])

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
print("\n=== Simulating 8 Minutes On Court ===")
for player in home_roster[:5]:
    sub_manager.time_on_court[player['name']] = 8.0
    print(f"{player['name']}: {sub_manager.time_on_court[player['name']]:.1f} minutes")

# Check if substitution should happen
print("\n=== Checking Substitution Logic ===")
for player in home_roster[:5]:
    should_sub, reason = sub_manager._should_substitute_mid_quarter(
        player=player,
        stamina_tracker=stamina_tracker,
        time_remaining_in_quarter=240,  # 4 minutes remaining
        quarter_number=1
    )
    print(f"{player['name']}: should_sub={should_sub}, reason='{reason}'")
    print(f"  - Is starter: {sub_manager._is_starter(player['name'])}")
    print(f"  - Time on court: {sub_manager.time_on_court[player['name']]:.1f} min")
    print(f"  - Current stamina: {stamina_tracker.get_current_stamina(player['name']):.1f}")

# Now test with 4 minutes on court (shouldn't sub due to minimum)
print("\n=== Testing Minimum 4-Minute Rule ===")
test_player = home_roster[0]
sub_manager.time_on_court[test_player['name']] = 3.9
should_sub, reason = sub_manager._should_substitute_mid_quarter(
    player=test_player,
    stamina_tracker=stamina_tracker,
    time_remaining_in_quarter=480,
    quarter_number=1
)
print(f"{test_player['name']} at 3.9 min: should_sub={should_sub} (expected: False)")

sub_manager.time_on_court[test_player['name']] = 4.1
should_sub, reason = sub_manager._should_substitute_mid_quarter(
    player=test_player,
    stamina_tracker=stamina_tracker,
    time_remaining_in_quarter=480,
    quarter_number=1
)
print(f"{test_player['name']} at 4.1 min: should_sub={should_sub} (expected: False, needs 8 min)")

sub_manager.time_on_court[test_player['name']] = 8.1
should_sub, reason = sub_manager._should_substitute_mid_quarter(
    player=test_player,
    stamina_tracker=stamina_tracker,
    time_remaining_in_quarter=240,
    quarter_number=1
)
print(f"{test_player['name']} at 8.1 min: should_sub={should_sub}, reason='{reason}' (expected: True)")
