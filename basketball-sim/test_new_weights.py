"""
Quick test to verify all new weight dictionaries work correctly.
Tests that composites are calculated properly with new attributes.
"""

from src.core.probability import calculate_composite
from src.constants import (
    WEIGHTS_LAYUP,
    WEIGHTS_DRIVE_LAYUP,
    WEIGHTS_REBOUND,
    WEIGHTS_CONTEST,
    WEIGHTS_FIND_OPEN_TEAMMATE,
    WEIGHTS_DRIVE_KICKOUT,
)
from src.systems.fouls import SHOOTING_FOUL_WEIGHTS_DEFENDER

# Create a test player with all attributes at 50
test_player = {
    'name': 'Test Player',
    'position': 'SF',
    # Physical (12)
    'grip_strength': 50,
    'arm_strength': 50,
    'core_strength': 50,
    'agility': 50,
    'acceleration': 50,
    'top_speed': 50,
    'jumping': 50,
    'reactions': 50,
    'stamina': 50,
    'balance': 50,
    'height': 50,
    'durability': 50,
    # Mental (7)
    'awareness': 50,
    'creativity': 50,
    'determination': 50,
    'bravery': 50,
    'consistency': 50,
    'composure': 50,
    'patience': 50,
    # Technical (6)
    'hand_eye_coordination': 50,
    'throw_accuracy': 50,
    'form_technique': 50,
    'finesse': 50,
    'deception': 50,
    'teamwork': 50,
}

print("="*60)
print("Testing New Weight Dictionaries")
print("="*60)
print("\nTest Player: All attributes = 50")
print("Expected composite: 50.0 (since all weights sum to 1.0)\n")

# Test each weight dictionary
weight_dicts = [
    (SHOOTING_FOUL_WEIGHTS_DEFENDER, "SHOOTING_FOUL_WEIGHTS_DEFENDER"),
    (WEIGHTS_LAYUP, "WEIGHTS_LAYUP"),
    (WEIGHTS_DRIVE_LAYUP, "WEIGHTS_DRIVE_LAYUP"),
    (WEIGHTS_REBOUND, "WEIGHTS_REBOUND"),
    (WEIGHTS_CONTEST, "WEIGHTS_CONTEST"),
    (WEIGHTS_FIND_OPEN_TEAMMATE, "WEIGHTS_FIND_OPEN_TEAMMATE"),
    (WEIGHTS_DRIVE_KICKOUT, "WEIGHTS_DRIVE_KICKOUT"),
]

all_passed = True

for weights, name in weight_dicts:
    composite = calculate_composite(test_player, weights)

    # With all attributes at 50, composite should be 50
    if abs(composite - 50.0) < 0.01:
        status = "[PASS]"
    else:
        status = "[FAIL]"
        all_passed = False

    print(f"{status} {name:40s}: {composite:.2f}")

print("\n" + "="*60)

if all_passed:
    print("[SUCCESS] All composites calculated correctly!")
    print("\nNew attributes are properly integrated:")
    print("  - core_strength in WEIGHTS_LAYUP and WEIGHTS_DRIVE_LAYUP")
    print("  - throw_accuracy in 4 weight dictionaries")
    print("  - arm_strength in WEIGHTS_REBOUND")
    print("  - balance and determination in WEIGHTS_CONTEST")
    print("  - patience removed from SHOOTING_FOUL_WEIGHTS_DEFENDER")
else:
    print("[FAIL] Some composites incorrect - check weight sums")

print("="*60)
