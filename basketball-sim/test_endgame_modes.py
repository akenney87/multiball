"""
Test end-game mode detection.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from src.systems.end_game_modes import detect_end_game_mode, should_intentional_foul

# Create simple test rosters
test_roster = [
    {'name': 'Player1', 'throw_accuracy': 80, 'composure': 75, 'consistency': 70, 'hand_eye_coordination': 85},
    {'name': 'Player2', 'throw_accuracy': 90, 'composure': 85, 'consistency': 80, 'hand_eye_coordination': 90},
    {'name': 'Player3', 'throw_accuracy': 50, 'composure': 45, 'consistency': 50, 'hand_eye_coordination': 55},
    {'name': 'Player4', 'throw_accuracy': 70, 'composure': 65, 'consistency': 60, 'hand_eye_coordination': 75},
    {'name': 'Player5', 'throw_accuracy': 60, 'composure': 55, 'consistency': 55, 'hand_eye_coordination': 65},
]

print("=" * 80)
print("END-GAME MODE DETECTION TESTS")
print("=" * 80)

# Test 1: Clock Kill Mode (up 5 with 30 seconds)
print("\nTest 1: Clock Kill Mode")
print("Scenario: Up 5 points, 30 seconds remaining, Q4")
mods = detect_end_game_mode(
    game_time_remaining=30,
    score_differential=5,
    quarter=4,
    team_has_possession=True,
    offensive_roster=test_roster,
    defensive_roster=test_roster
)
print(f"Active modes: {mods.active_modes}")
print(f"Shot clock target: {mods.shot_clock_target}")
assert 'clock_kill' in mods.active_modes, "Clock Kill should trigger"
assert mods.shot_clock_target == 5.0, f"Expected shot clock target 5.0, got {mods.shot_clock_target}"
print("PASSED")

# Test 2: Last Second Shot - Tied
print("\nTest 2: Last Second Shot - Tied")
print("Scenario: Tied game, 20 seconds remaining, Q4")
mods = detect_end_game_mode(
    game_time_remaining=20,
    score_differential=0,
    quarter=4,
    team_has_possession=True,
    offensive_roster=test_roster,
    defensive_roster=test_roster
)
print(f"Active modes: {mods.active_modes}")
print(f"Game clock target: {mods.game_clock_target}")
assert 'last_shot_tied' in mods.active_modes, "Last Shot Tied should trigger"
assert mods.game_clock_target == 3.0, f"Expected game clock target 3.0, got {mods.game_clock_target}"
print("PASSED")

# Test 3: Last Second Shot - Losing (down 3)
print("\nTest 3: Last Second Shot - Losing (down 3)")
print("Scenario: Down 3 points, 20 seconds remaining, Q4")
mods = detect_end_game_mode(
    game_time_remaining=20,
    score_differential=-3,
    quarter=4,
    team_has_possession=True,
    offensive_roster=test_roster,
    defensive_roster=test_roster
)
print(f"Active modes: {mods.active_modes}")
print(f"Game clock target: {mods.game_clock_target}")
print(f"Force shot type: {mods.force_shot_type}")
assert 'last_shot_losing' in mods.active_modes, "Last Shot Losing should trigger"
assert mods.force_shot_type == '3pt', "Should force 3PT when down 3"
print("PASSED")

# Test 4: Desperation Mode
print("\nTest 4: Desperation Mode")
print("Scenario: Down 12 points, 4 minutes remaining, Q4")
mods = detect_end_game_mode(
    game_time_remaining=240,
    score_differential=-12,
    quarter=4,
    team_has_possession=True,
    offensive_roster=test_roster,
    defensive_roster=test_roster
)
print(f"Active modes: {mods.active_modes}")
print(f"3PT adjustment: {mods.shot_distribution_3pt_adj}")
print(f"Pace multiplier: {mods.pace_multiplier}")
assert 'desperation' in mods.active_modes, "Desperation should trigger"
assert mods.shot_distribution_3pt_adj > 0, "Should increase 3PT attempts"
assert mods.pace_multiplier > 1.0, "Should increase pace"
print("PASSED")

# Test 5: Conserve Lead Mode
print("\nTest 5: Conserve Lead Mode")
print("Scenario: Up 18 points, 2 minutes remaining, Q4")
mods = detect_end_game_mode(
    game_time_remaining=120,
    score_differential=18,
    quarter=4,
    team_has_possession=True,
    offensive_roster=test_roster,
    defensive_roster=test_roster
)
print(f"Active modes: {mods.active_modes}")
print(f"3PT adjustment: {mods.shot_distribution_3pt_adj}")
print(f"Pace multiplier: {mods.pace_multiplier}")
assert 'conserve_lead' in mods.active_modes, "Conserve Lead should trigger"
assert mods.shot_distribution_3pt_adj < 0, "Should decrease 3PT attempts"
assert mods.pace_multiplier < 1.0, "Should decrease pace"
print("PASSED")

# Test 6: Intentional Fouling Check
print("\nTest 6: Intentional Fouling")
print("Scenario: Down 5 points, 45 seconds remaining, Q4, opponent has ball")
should_foul = should_intentional_foul(
    game_time_remaining=45,
    score_differential=5,  # From offense perspective (they're ahead)
    quarter=4,
    offensive_team_leading=True
)
print(f"Should intentionally foul: {should_foul}")
assert should_foul == True, "Should trigger intentional foul"
print("PASSED")

# Test 7: No modes in Q3
print("\nTest 7: No modes active in Q3")
print("Scenario: Down 12, 2 minutes remaining, Q3")
mods = detect_end_game_mode(
    game_time_remaining=120,
    score_differential=-12,
    quarter=3,
    team_has_possession=True,
    offensive_roster=test_roster,
    defensive_roster=test_roster
)
print(f"Active modes: {mods.active_modes}")
assert len(mods.active_modes) == 0, "No modes should trigger in Q3"
print("PASSED")

print("\n" + "=" * 80)
print("ALL TESTS PASSED!")
print("=" * 80)
