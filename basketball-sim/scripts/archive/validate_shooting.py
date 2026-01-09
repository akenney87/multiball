"""
Validation script for shooting system.

Runs key validation scenarios without pytest.
"""

import sys
from src.systems.shooting import (
    select_shot_type,
    calculate_contest_penalty,
    check_help_defense,
    determine_rim_attempt_type,
    attempt_3pt_shot,
    attempt_midrange_shot,
    attempt_rim_shot,
    simulate_contest_distance,
)
from src.core.data_structures import PossessionContext, TacticalSettings
from src.core.probability import set_seed


def create_elite_shooter():
    """Elite 3PT shooter (Stephen Curry profile)."""
    return {
        'name': 'Elite Shooter',
        'position': 'PG',
        'form_technique': 97,
        'throw_accuracy': 98,
        'finesse': 95,
        'hand_eye_coordination': 96,
        'balance': 92,
        'composure': 94,
        'consistency': 93,
        'agility': 90,
        'jumping': 75,
        'height': 75,
        'arm_strength': 70,
        'awareness': 95,
        'reactions': 92,
        'grip_strength': 70,
        'core_strength': 70,
        'acceleration': 85,
        'top_speed': 80,
        'stamina': 90,
        'durability': 85,
        'creativity': 90,
        'determination': 95,
        'bravery': 80,
        'patience': 90,
        'deception': 85,
        'teamwork': 92,
    }


def create_poor_shooter():
    """Poor shooter (low attributes)."""
    return {
        'name': 'Poor Shooter',
        'position': 'C',
        'form_technique': 30,
        'throw_accuracy': 28,
        'finesse': 25,
        'hand_eye_coordination': 32,
        'balance': 35,
        'composure': 30,
        'consistency': 28,
        'agility': 40,
        'jumping': 60,
        'height': 85,
        'arm_strength': 80,
        'awareness': 40,
        'reactions': 45,
        'grip_strength': 75,
        'core_strength': 80,
        'acceleration': 35,
        'top_speed': 40,
        'stamina': 70,
        'durability': 80,
        'creativity': 35,
        'determination': 70,
        'bravery': 75,
        'patience': 40,
        'deception': 30,
        'teamwork': 50,
    }


def create_elite_defender():
    """Elite perimeter defender."""
    return {
        'name': 'Elite Defender',
        'position': 'SF',
        'height': 80,
        'reactions': 95,
        'agility': 92,
        'awareness': 93,
        'top_speed': 88,
        'jumping': 85,
        'arm_strength': 75,
        'core_strength': 80,
        'balance': 85,
        'stamina': 90,
        'form_technique': 60,
        'throw_accuracy': 55,
        'finesse': 65,
        'hand_eye_coordination': 80,
        'composure': 85,
        'consistency': 75,
        'grip_strength': 78,
        'acceleration': 90,
        'durability': 88,
        'creativity': 70,
        'determination': 90,
        'bravery': 88,
        'patience': 80,
        'deception': 65,
        'teamwork': 85,
    }


def create_poor_defender():
    """Poor defender."""
    return {
        'name': 'Poor Defender',
        'position': 'PG',
        'height': 72,
        'reactions': 30,
        'agility': 35,
        'awareness': 28,
        'top_speed': 40,
        'jumping': 40,
        'arm_strength': 30,
        'core_strength': 35,
        'balance': 40,
        'stamina': 60,
        'form_technique': 70,
        'throw_accuracy': 75,
        'finesse': 65,
        'hand_eye_coordination': 70,
        'composure': 60,
        'consistency': 55,
        'grip_strength': 35,
        'acceleration': 45,
        'durability': 50,
        'creativity': 60,
        'determination': 55,
        'bravery': 50,
        'patience': 65,
        'deception': 60,
        'teamwork': 70,
    }


def create_dunker():
    """Elite dunker (Shaq profile)."""
    return {
        'name': 'Dunker',
        'position': 'C',
        'jumping': 90,
        'height': 95,
        'arm_strength': 95,
        'agility': 65,
        'finesse': 70,
        'hand_eye_coordination': 75,
        'balance': 80,
        'form_technique': 40,
        'throw_accuracy': 35,
        'composure': 85,
        'consistency': 70,
        'reactions': 75,
        'awareness': 80,
        'grip_strength': 95,
        'core_strength': 98,
        'acceleration': 60,
        'top_speed': 55,
        'stamina': 85,
        'durability': 95,
        'creativity': 60,
        'determination': 95,
        'bravery': 95,
        'patience': 50,
        'deception': 55,
        'teamwork': 70,
    }


def test_contest_penalties():
    """Test contest penalty system."""
    print("\n=== CONTEST PENALTY TESTS ===")

    # Wide open (6+ ft) = 0% penalty
    penalty = calculate_contest_penalty(8.0, 50)
    print(f"Wide open (8 ft): {penalty:.3f} (expected: 0.000)")
    assert penalty == 0.0, "Wide open penalty should be 0"

    # Contested (2-6 ft) = -15% base
    penalty = calculate_contest_penalty(4.0, 50)
    print(f"Contested (4 ft): {penalty:.3f} (expected: ~-0.150)")
    assert -0.20 <= penalty <= -0.10, "Contested penalty should be ~-15%"

    # Heavily contested (<2 ft) = -25% base
    penalty = calculate_contest_penalty(1.0, 50)
    print(f"Heavily contested (1 ft): {penalty:.3f} (expected: ~-0.250)")
    assert -0.30 <= penalty <= -0.20, "Heavy penalty should be ~-25%"

    # Elite defender should increase penalty
    penalty_avg = calculate_contest_penalty(3.0, 50)
    penalty_elite = calculate_contest_penalty(3.0, 90)
    print(f"Average defender: {penalty_avg:.3f}, Elite defender: {penalty_elite:.3f}")
    assert penalty_elite < penalty_avg, "Elite defender should have more negative penalty"

    print("OK - Contest penalty tests PASSED")


def test_elite_vs_poor():
    """Elite shooter vs poor defender should have high success."""
    print("\n=== ELITE VS POOR TEST ===")
    set_seed(42)

    elite_shooter = create_elite_shooter()
    poor_defender = create_poor_defender()
    context = PossessionContext(is_transition=False)

    makes = 0
    attempts = 100

    for _ in range(attempts):
        success, debug = attempt_3pt_shot(
            shooter=elite_shooter,
            defender=poor_defender,
            contest_distance=6.0,  # Wide open
            possession_context=context,
            defense_type='man'
        )
        if success:
            makes += 1

        # Validate bounds
        assert 0.0 <= debug['final_success_rate'] <= 1.0, "Probability out of bounds"

    make_pct = makes / attempts
    print(f"Elite shooter (wide open) vs poor defender: {make_pct:.1%} make rate")
    print(f"Expected: 60-90%")

    assert 0.60 <= make_pct <= 0.90, f"Make rate {make_pct:.1%} out of expected range"
    print("OK Elite vs poor test PASSED")


def test_poor_vs_elite():
    """Poor shooter vs elite defender should have low success."""
    print("\n=== POOR VS ELITE TEST ===")
    set_seed(42)

    poor_shooter = create_poor_shooter()
    elite_defender = create_elite_defender()
    context = PossessionContext(is_transition=False)

    makes = 0
    attempts = 100

    for _ in range(attempts):
        success, debug = attempt_3pt_shot(
            shooter=poor_shooter,
            defender=elite_defender,
            contest_distance=1.5,  # Heavily contested
            possession_context=context,
            defense_type='man'
        )
        if success:
            makes += 1

    make_pct = makes / attempts
    print(f"Poor shooter (heavily contested) vs elite defender: {make_pct:.1%} make rate")
    print(f"Expected: 5-30%")

    assert 0.05 <= make_pct <= 0.30, f"Make rate {make_pct:.1%} out of expected range"
    print("OK Poor vs elite test PASSED")


def test_transition_bonus():
    """Transition should provide significant bonus."""
    print("\n=== TRANSITION BONUS TEST ===")
    set_seed(42)

    dunker = create_dunker()
    poor_defender = create_poor_defender()

    context_halfcourt = PossessionContext(is_transition=False)
    context_transition = PossessionContext(is_transition=True)

    # Halfcourt
    halfcourt_makes = 0
    for _ in range(100):
        success, _ = attempt_rim_shot(
            shooter=dunker,
            defender=poor_defender,
            contest_distance=4.0,
            possession_context=context_halfcourt,
            attempt_type='dunk'
        )
        if success:
            halfcourt_makes += 1

    # Transition
    transition_makes = 0
    for _ in range(100):
        success, _ = attempt_rim_shot(
            shooter=dunker,
            defender=poor_defender,
            contest_distance=4.0,
            possession_context=context_transition,
            attempt_type='dunk'
        )
        if success:
            transition_makes += 1

    print(f"Halfcourt rim: {halfcourt_makes}% make rate")
    print(f"Transition rim: {transition_makes}% make rate")
    print(f"Difference: +{transition_makes - halfcourt_makes}%")

    assert transition_makes > halfcourt_makes, "Transition should have higher success rate"
    print("OK Transition bonus test PASSED")


def test_shot_selection_distribution():
    """Test shot selection distribution."""
    print("\n=== SHOT SELECTION DISTRIBUTION TEST ===")
    set_seed(42)

    # Average shooter
    average_shooter = {
        'name': 'Average',
        'position': 'SG',
        **{attr: 50 for attr in [
            'form_technique', 'throw_accuracy', 'finesse', 'hand_eye_coordination',
            'balance', 'composure', 'consistency', 'agility', 'jumping', 'height',
            'arm_strength', 'awareness', 'reactions', 'grip_strength', 'core_strength',
            'acceleration', 'top_speed', 'stamina', 'durability', 'creativity',
            'determination', 'bravery', 'patience', 'deception', 'teamwork'
        ]}
    }

    tactics = TacticalSettings(pace='standard')
    context = PossessionContext(is_transition=False)

    results = {'3pt': 0, 'midrange': 0, 'rim': 0}
    for _ in range(1000):
        shot_type = select_shot_type(average_shooter, tactics, context, 'man')
        results[shot_type] += 1

    print(f"Shot distribution (1000 attempts):")
    print(f"  3PT: {results['3pt']/10:.1f}% (expected: ~40%)")
    print(f"  Midrange: {results['midrange']/10:.1f}% (expected: ~20%)")
    print(f"  Rim: {results['rim']/10:.1f}% (expected: ~40%)")

    assert 0.35 <= results['3pt'] / 1000 <= 0.45, "3PT distribution out of range"
    assert 0.15 <= results['midrange'] / 1000 <= 0.25, "Midrange distribution out of range"
    assert 0.35 <= results['rim'] / 1000 <= 0.45, "Rim distribution out of range"

    print("OK Shot selection distribution test PASSED")


def test_zone_defense_effect():
    """Zone defense should increase 3PT attempts."""
    print("\n=== ZONE DEFENSE EFFECT TEST ===")
    set_seed(42)

    elite_shooter = create_elite_shooter()
    tactics = TacticalSettings(pace='standard')
    context = PossessionContext(is_transition=False)

    # Man defense
    man_results = {'3pt': 0, 'midrange': 0, 'rim': 0}
    for _ in range(1000):
        shot_type = select_shot_type(elite_shooter, tactics, context, 'man')
        man_results[shot_type] += 1

    # Zone defense
    zone_results = {'3pt': 0, 'midrange': 0, 'rim': 0}
    for _ in range(1000):
        shot_type = select_shot_type(elite_shooter, tactics, context, 'zone')
        zone_results[shot_type] += 1

    print(f"Man defense 3PT: {man_results['3pt']/10:.1f}%")
    print(f"Zone defense 3PT: {zone_results['3pt']/10:.1f}%")
    print(f"Difference: +{(zone_results['3pt'] - man_results['3pt'])/10:.1f}%")

    assert zone_results['3pt'] > man_results['3pt'], "Zone should increase 3PT attempts"
    print("OK Zone defense effect test PASSED")


def test_dunk_vs_layup():
    """Test dunk vs layup selection."""
    print("\n=== DUNK VS LAYUP TEST ===")

    dunker = create_dunker()
    poor_shooter = create_poor_shooter()

    dunk_result = determine_rim_attempt_type(dunker)
    layup_result = determine_rim_attempt_type(poor_shooter)

    print(f"Elite dunker (height 95, jumping 90): {dunk_result}")
    print(f"Poor athlete (height 85, jumping 60, poor dunk composite): {layup_result}")

    assert dunk_result == 'dunk', "Elite dunker should choose dunk"
    assert layup_result == 'layup', "Poor athlete should choose layup"

    print("OK Dunk vs layup test PASSED")


def test_debug_output_structure():
    """Validate debug output structure."""
    print("\n=== DEBUG OUTPUT STRUCTURE TEST ===")
    set_seed(42)

    elite_shooter = create_elite_shooter()
    poor_defender = create_poor_defender()
    context = PossessionContext(is_transition=False)

    success, debug = attempt_3pt_shot(
        shooter=elite_shooter,
        defender=poor_defender,
        contest_distance=6.0,
        possession_context=context
    )

    required_fields = [
        'shot_type', 'shooter_name', 'defender_name',
        'shooter_composite', 'defender_composite', 'attribute_diff',
        'base_rate', 'base_success', 'contest_distance', 'contest_penalty',
        'transition_bonus', 'final_success_rate', 'roll_value', 'result'
    ]

    print("Debug output fields:")
    for field in required_fields:
        assert field in debug, f"Missing field: {field}"
        print(f"  OK {field}: {debug[field]}")

    print("OK Debug output structure test PASSED")


def main():
    """Run all validation tests."""
    print("=" * 60)
    print("SHOOTING SYSTEM VALIDATION")
    print("=" * 60)

    try:
        test_contest_penalties()
        test_elite_vs_poor()
        test_poor_vs_elite()
        test_transition_bonus()
        test_shot_selection_distribution()
        test_zone_defense_effect()
        test_dunk_vs_layup()
        test_debug_output_structure()

        print("\n" + "=" * 60)
        print("OK ALL TESTS PASSED")
        print("=" * 60)
        print("\nShooting system validated successfully!")
        return 0

    except AssertionError as e:
        print(f"\nFAILED TEST FAILED: {e}")
        return 1
    except Exception as e:
        print(f"\nFAILED ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
