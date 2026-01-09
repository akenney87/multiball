"""
Validation script for PHASE 1 & 2 attribute refactoring.

Verifies that all weight dictionaries sum to 1.0 and that all attributes
are from the canonical 25-attribute list.
"""

from src.constants import (
    ALL_ATTRIBUTES,
    WEIGHTS_LAYUP,
    WEIGHTS_DRIVE_LAYUP,
    WEIGHTS_REBOUND,
    WEIGHTS_CONTEST,
    WEIGHTS_FIND_OPEN_TEAMMATE,
    WEIGHTS_DRIVE_KICKOUT,
)

from src.systems.fouls import SHOOTING_FOUL_WEIGHTS_DEFENDER

def validate_weights(weights_dict, name):
    """
    Validate a weight dictionary.

    Checks:
    1. All weights sum to 1.0 (within floating point tolerance)
    2. All attributes are from the canonical 25-attribute list
    3. All weights are positive
    """
    print(f"\n{'='*60}")
    print(f"Validating: {name}")
    print(f"{'='*60}")

    # Check sum
    total = sum(weights_dict.values())
    print(f"Sum of weights: {total:.10f}")

    tolerance = 0.0001
    if abs(total - 1.0) > tolerance:
        print(f"  [FAIL] Sum is not 1.0 (diff: {abs(total - 1.0):.10f})")
        return False
    else:
        print(f"  [PASS] Sum equals 1.0 (within tolerance)")

    # Check all attributes are valid
    invalid_attrs = [attr for attr in weights_dict.keys() if attr not in ALL_ATTRIBUTES]
    if invalid_attrs:
        print(f"  [FAIL] Invalid attributes: {invalid_attrs}")
        return False
    else:
        print(f"  [PASS] All attributes are from canonical 25-attribute list")

    # Check all weights are positive
    negative_weights = {k: v for k, v in weights_dict.items() if v <= 0}
    if negative_weights:
        print(f"  [FAIL] Non-positive weights: {negative_weights}")
        return False
    else:
        print(f"  [PASS] All weights are positive")

    # Display weights
    print(f"\nAttribute breakdown ({len(weights_dict)} attributes):")
    for attr, weight in sorted(weights_dict.items(), key=lambda x: -x[1]):
        print(f"  {attr:30s}: {weight:.4f} ({weight*100:5.2f}%)")

    return True

def main():
    """Run validation on all updated weight dictionaries."""

    print("="*60)
    print("PHASE 1 & 2 ATTRIBUTE REFACTORING VALIDATION")
    print("="*60)

    all_passed = True

    # Updated weight dictionaries
    weight_dicts = [
        (SHOOTING_FOUL_WEIGHTS_DEFENDER, "SHOOTING_FOUL_WEIGHTS_DEFENDER (fouls.py)"),
        (WEIGHTS_LAYUP, "WEIGHTS_LAYUP (constants.py)"),
        (WEIGHTS_DRIVE_LAYUP, "WEIGHTS_DRIVE_LAYUP (constants.py)"),
        (WEIGHTS_REBOUND, "WEIGHTS_REBOUND (constants.py)"),
        (WEIGHTS_CONTEST, "WEIGHTS_CONTEST (constants.py)"),
        (WEIGHTS_FIND_OPEN_TEAMMATE, "WEIGHTS_FIND_OPEN_TEAMMATE (constants.py)"),
        (WEIGHTS_DRIVE_KICKOUT, "WEIGHTS_DRIVE_KICKOUT (constants.py)"),
    ]

    for weights, name in weight_dicts:
        passed = validate_weights(weights, name)
        if not passed:
            all_passed = False

    # Final summary
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")

    if all_passed:
        print("[SUCCESS] ALL VALIDATIONS PASSED")
        print("\nChanges implemented:")
        print("  1. Removed patience from SHOOTING_FOUL_WEIGHTS_DEFENDER")
        print("  2. Added core_strength + throw_accuracy to WEIGHTS_LAYUP")
        print("  3. Added core_strength + throw_accuracy to WEIGHTS_DRIVE_LAYUP")
        print("  4. Added arm_strength to WEIGHTS_REBOUND")
        print("  5. Added balance to WEIGHTS_CONTEST")
        print("  6. Added determination to WEIGHTS_CONTEST")
        print("  7. Added throw_accuracy to WEIGHTS_FIND_OPEN_TEAMMATE")
        print("  8. Added throw_accuracy to WEIGHTS_DRIVE_KICKOUT")
        print("\nPHASE 1 & 2 complete - all weight dictionaries valid!")
    else:
        print("[FAIL] SOME VALIDATIONS FAILED - please review errors above")

    return all_passed

if __name__ == '__main__':
    import sys
    sys.exit(0 if main() else 1)
