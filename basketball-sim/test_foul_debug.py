"""Test to verify intentional foul margin check with debug output."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from src.systems.end_game_modes import should_intentional_foul

# Test the exact scenario from the log: Team A ahead 100-74 at :24
print("Testing: Team A ahead 100-74 (26 point margin) at 0:24 in Q4")
print("-" * 80)

# From Team A's perspective (offense), they're ahead by 26
result = should_intentional_foul(
    game_time_remaining=24,
    score_differential=26,  # Team A ahead by 26
    quarter=4,
    offensive_team_leading=True
)

print(f"Score differential: +26 (offense ahead)")
print(f"Time remaining: 24 seconds")
print(f"Quarter: 4")
print(f"Offensive team leading: True")
print(f"\nShould intentional foul trigger? {result}")
print(f"Expected: False (margin 26 > 6)")

if result:
    print("\n[FAIL] Bug reproduced! Intentional foul triggered when it shouldn't")
else:
    print("\n[OK] Intentional foul correctly did not trigger")

# Now test close margin to confirm it works
print("\n" + "=" * 80)
print("Testing: Team A ahead 103-99 (4 point margin) at 0:30 in Q4")
print("-" * 80)

result2 = should_intentional_foul(
    game_time_remaining=30,
    score_differential=4,  # Team A ahead by 4
    quarter=4,
    offensive_team_leading=True
)

print(f"Score differential: +4 (offense ahead)")
print(f"Time remaining: 30 seconds")
print(f"Quarter: 4")
print(f"Offensive team leading: True")
print(f"\nShould intentional foul trigger? {result2}")
print(f"Expected: True (margin 4 is within 2-6)")

if result2:
    print("\n[OK] Intentional foul correctly triggered")
else:
    print("\n[FAIL] Intentional foul should have triggered but didn't")
