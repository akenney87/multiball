"""
Quick test to verify zone defense contest distance fix works correctly.
"""

from src.systems import defense

# Test the updated function signature
test_defender = {
    'name': 'Test Defender',
    'grip_strength': 70,
    'reactions': 70,
    'awareness': 70,
    'agility': 70,
    'determination': 70,
    'acceleration': 70,
    'top_speed': 70,
    'height': 70,
    'balance': 70,
    'jumping': 70,
    'arm_strength': 70,
    'core_strength': 70,
    'stamina': 70,
    'durability': 70,
    'creativity': 70,
    'bravery': 70,
    'consistency': 70,
    'composure': 70,
    'patience': 70,
    'hand_eye_coordination': 70,
    'throw_accuracy': 70,
    'form_technique': 70,
    'finesse': 70,
    'deception': 70,
    'teamwork': 70
}

print("Testing Zone Defense Contest Distance Fix")
print("=" * 60)

# Test with man defense (baseline)
man_distance = defense.calculate_contest_distance(
    defender=test_defender,
    zone_pct=0.0,
    shot_type='rim'
)

# Test with rim shot at 100% zone (should be stronger contest = lower distance)
rim_distance_zone = defense.calculate_contest_distance(
    defender=test_defender,
    zone_pct=100.0,
    shot_type='rim'
)

# Test with 3PT at 100% zone (should be weaker contest = higher distance)
perimeter_distance_zone = defense.calculate_contest_distance(
    defender=test_defender,
    zone_pct=100.0,
    shot_type='3PT'
)

# Test with midrange at 100% zone (should be weaker contest = higher distance)
midrange_distance_zone = defense.calculate_contest_distance(
    defender=test_defender,
    zone_pct=100.0,
    shot_type='midrange'
)

print(f"\nMAN DEFENSE (0% zone) - Baseline:")
print(f"  Contest distance: {man_distance:.2f} ft")

print(f"\nZONE DEFENSE (100% zone):")
print(f"  Rim shot: {rim_distance_zone:.2f} ft (diff: {rim_distance_zone - man_distance:+.2f} ft)")
print(f"  3PT shot: {perimeter_distance_zone:.2f} ft (diff: {perimeter_distance_zone - man_distance:+.2f} ft)")
print(f"  Midrange: {midrange_distance_zone:.2f} ft (diff: {midrange_distance_zone - man_distance:+.2f} ft)")

print(f"\nEXPECTED RESULTS:")
print(f"  Rim: NEGATIVE diff (packed paint = stronger contest)")
print(f"  3PT/Midrange: POSITIVE diff (zone gaps = weaker contest)")

print(f"\nVALIDATION:")
rim_correct = rim_distance_zone < man_distance
perimeter_correct = perimeter_distance_zone > man_distance
midrange_correct = midrange_distance_zone > man_distance

if rim_correct and perimeter_correct and midrange_correct:
    print(f"  ✓ ALL TESTS PASSED")
else:
    print(f"  ✗ TESTS FAILED:")
    if not rim_correct:
        print(f"    - Rim contest should be STRONGER (lower distance) with zone")
    if not perimeter_correct:
        print(f"    - 3PT contest should be WEAKER (higher distance) with zone")
    if not midrange_correct:
        print(f"    - Midrange contest should be WEAKER (higher distance) with zone")
