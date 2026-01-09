"""
Test intentional foul fixes:
1. Only triggers when margin is within 6 points (2-6)
2. Possession stays with team that was fouled
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from src.systems.end_game_modes import should_intentional_foul

print("=" * 80)
print("INTENTIONAL FOUL FIX VERIFICATION")
print("=" * 80)

# Test Issue #1: Margin check (should only foul when up 2-6 points)
print("\nISSUE #1: Foul trigger margin (should only trigger when up 2-6 points)")
print("-" * 80)

test_cases = [
    (1, False, "Up 1 point - should NOT foul"),
    (2, True, "Up 2 points - should foul"),
    (3, True, "Up 3 points - should foul"),
    (4, True, "Up 4 points - should foul"),
    (5, True, "Up 5 points - should foul"),
    (6, True, "Up 6 points - should foul"),
    (7, False, "Up 7 points - should NOT foul"),
    (8, False, "Up 8 points - should NOT foul"),
    (10, False, "Up 10 points - should NOT foul"),
    (15, False, "Up 15 points - should NOT foul"),
    (27, False, "Up 27 points - should NOT foul (bug case)"),
]

all_passed = True
for margin, expected_foul, description in test_cases:
    result = should_intentional_foul(
        game_time_remaining=45,
        score_differential=margin,
        quarter=4,
        offensive_team_leading=True
    )

    status = "[OK]" if result == expected_foul else "[FAIL]"
    if result != expected_foul:
        all_passed = False

    print(f"{description:<40} Expected: {str(expected_foul):<5} Got: {str(result):<5} {status}")

print("\n" + "=" * 80)
if all_passed:
    print("ISSUE #1 FIXED: Intentional fouls now only trigger when margin is 2-6 points")
else:
    print("ISSUE #1 FAILED: Some test cases did not pass")
print("=" * 80)

# Test Issue #2: Possession handling
# This requires a full game simulation, so just document the expected behavior
print("\nISSUE #2: Possession after intentional foul")
print("-" * 80)
print("Expected behavior:")
print("  - Team A (leading) has possession")
print("  - Team B (trailing) commits intentional foul")
print("  - Team A shoots free throws")
print("  - Team A KEEPS possession (does not switch to Team B)")
print()
print("Implementation:")
print("  - Changed possession_outcome from 'foul' to 'intentional_foul'")
print("  - Updated quarter_simulation.py to not switch possession for 'intentional_foul'")
print("  - Verification requires full game simulation")
print("=" * 80)
