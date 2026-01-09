"""
Test end-game modes by simulating specific game scenarios.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from src.systems.end_game_modes import detect_end_game_mode

# Create simple test rosters
test_roster = [
    {'name': 'Player1', 'throw_accuracy': 80, 'composure': 75, 'consistency': 70, 'hand_eye_coordination': 85},
    {'name': 'Player2', 'throw_accuracy': 90, 'composure': 85, 'consistency': 80, 'hand_eye_coordination': 90},
    {'name': 'Player3', 'throw_accuracy': 50, 'composure': 45, 'consistency': 50, 'hand_eye_coordination': 55},
    {'name': 'Player4', 'throw_accuracy': 70, 'composure': 65, 'consistency': 60, 'hand_eye_coordination': 75},
    {'name': 'Player5', 'throw_accuracy': 60, 'composure': 55, 'consistency': 55, 'hand_eye_coordination': 65},
]

print("=" * 80)
print("END-GAME MODES IN ACTUAL GAME SCENARIOS")
print("=" * 80)

# Scenario 1: Desperation Mode - down 25 with 8 minutes left
print("\n" + "="*80)
print("SCENARIO 1: Desperation Mode")
print("Down 25 points, 8 minutes remaining in Q4")
print("="*80)
mods = detect_end_game_mode(
    game_time_remaining=480,  # 8 minutes
    score_differential=-25,    # Down 25
    quarter=4,
    team_has_possession=True,
    offensive_roster=test_roster,
    defensive_roster=test_roster
)
print(f"Active modes: {mods.active_modes}")
print(f"3PT adjustment: {mods.shot_distribution_3pt_adj:+.1%}")
print(f"Pace multiplier: {mods.pace_multiplier:.2f}x")
if 'desperation' in mods.active_modes:
    print("[OK] DESPERATION MODE ACTIVE - Team will shoot more 3s and play faster")
else:
    print("[FAIL] DESPERATION MODE NOT ACTIVE")

# Scenario 2: Conserve Lead Mode - up 22 with 2:30 left
print("\n" + "="*80)
print("SCENARIO 2: Conserve Lead Mode")
print("Up 22 points, 2:30 remaining in Q4")
print("="*80)
mods = detect_end_game_mode(
    game_time_remaining=150,  # 2:30
    score_differential=22,    # Up 22
    quarter=4,
    team_has_possession=True,
    offensive_roster=test_roster,
    defensive_roster=test_roster
)
print(f"Active modes: {mods.active_modes}")
print(f"3PT adjustment: {mods.shot_distribution_3pt_adj:+.1%}")
print(f"Pace multiplier: {mods.pace_multiplier:.2f}x")
if 'conserve_lead' in mods.active_modes:
    print("[OK] CONSERVE LEAD MODE ACTIVE - Team will shoot fewer 3s and slow down")
else:
    print("[FAIL] CONSERVE LEAD MODE NOT ACTIVE")

# Scenario 3: Clock Kill Mode - up 4 with 28 seconds left
print("\n" + "="*80)
print("SCENARIO 3: Clock Kill Mode")
print("Up 4 points, 28 seconds remaining in Q4")
print("="*80)
mods = detect_end_game_mode(
    game_time_remaining=28,
    score_differential=4,
    quarter=4,
    team_has_possession=True,
    offensive_roster=test_roster,
    defensive_roster=test_roster
)
print(f"Active modes: {mods.active_modes}")
print(f"Shot clock target: {mods.shot_clock_target} seconds")
if 'clock_kill' in mods.active_modes:
    print(f"[OK] CLOCK KILL MODE ACTIVE - Will shoot with {mods.shot_clock_target}s left on shot clock")
else:
    print("[FAIL] CLOCK KILL MODE NOT ACTIVE")

# Scenario 4: Last Second Shot (Tied) - tied with 18 seconds left
print("\n" + "="*80)
print("SCENARIO 4: Last Second Shot - Tied Game")
print("Tied game, 18 seconds remaining in Q4")
print("="*80)
mods = detect_end_game_mode(
    game_time_remaining=18,
    score_differential=0,
    quarter=4,
    team_has_possession=True,
    offensive_roster=test_roster,
    defensive_roster=test_roster
)
print(f"Active modes: {mods.active_modes}")
print(f"Game clock target: {mods.game_clock_target} seconds")
if 'last_shot_tied' in mods.active_modes:
    print(f"[OK] LAST SHOT (TIED) MODE ACTIVE - Will shoot with {mods.game_clock_target}s on game clock")
else:
    print("[FAIL] LAST SHOT (TIED) MODE NOT ACTIVE")

# Scenario 5: Last Second Shot (Losing) - down 2 with 20 seconds left
print("\n" + "="*80)
print("SCENARIO 5: Last Second Shot - Losing by 2")
print("Down 2 points, 20 seconds remaining in Q4")
print("="*80)
mods = detect_end_game_mode(
    game_time_remaining=20,
    score_differential=-2,
    quarter=4,
    team_has_possession=True,
    offensive_roster=test_roster,
    defensive_roster=test_roster
)
print(f"Active modes: {mods.active_modes}")
print(f"Game clock target: {mods.game_clock_target} seconds (random 5-8)")
print(f"Force shot type: {mods.force_shot_type}")
if 'last_shot_losing' in mods.active_modes:
    print(f"[OK] LAST SHOT (LOSING) MODE ACTIVE - Will shoot around {mods.game_clock_target:.1f}s")
else:
    print("[FAIL] LAST SHOT (LOSING) MODE NOT ACTIVE")

# Scenario 6: Last Second Shot (Losing by 3) - down 3 with 15 seconds left
print("\n" + "="*80)
print("SCENARIO 6: Last Second Shot - Losing by 3 (Force 3PT)")
print("Down 3 points, 15 seconds remaining in Q4")
print("="*80)
mods = detect_end_game_mode(
    game_time_remaining=15,
    score_differential=-3,
    quarter=4,
    team_has_possession=True,
    offensive_roster=test_roster,
    defensive_roster=test_roster
)
print(f"Active modes: {mods.active_modes}")
print(f"Game clock target: {mods.game_clock_target} seconds (random 5-8)")
print(f"Force shot type: {mods.force_shot_type}")
if 'last_shot_losing' in mods.active_modes and mods.force_shot_type == '3pt':
    print(f"[OK] LAST SHOT (LOSING BY 3) MODE ACTIVE - Forced 3PT attempt!")
else:
    print("[FAIL] LAST SHOT (LOSING BY 3) MODE NOT ACTIVE OR NOT FORCING 3PT")

# Scenario 7: Multiple modes active - down 18 with 2:45 left
print("\n" + "="*80)
print("SCENARIO 7: Multiple Modes (Desperation active)")
print("Down 18 points, 2:45 remaining in Q4")
print("="*80)
mods = detect_end_game_mode(
    game_time_remaining=165,  # 2:45
    score_differential=-18,
    quarter=4,
    team_has_possession=True,
    offensive_roster=test_roster,
    defensive_roster=test_roster
)
print(f"Active modes: {mods.active_modes}")
print(f"3PT adjustment: {mods.shot_distribution_3pt_adj:+.1%}")
print(f"Pace multiplier: {mods.pace_multiplier:.2f}x")
if len(mods.active_modes) > 0:
    print(f"[OK] {len(mods.active_modes)} MODE(S) ACTIVE")
else:
    print("[FAIL] NO MODES ACTIVE")

print("\n" + "="*80)
print("END-GAME MODE TESTING COMPLETE")
print("="*80)
