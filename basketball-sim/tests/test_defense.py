"""
Unit tests for defense system.

Validates defensive assignment, contest distance calculation,
help defense selection, and zone defense modifiers.
"""

import pytest
import random
from src.systems.defense import (
    assign_defender,
    calculate_contest_distance,
    select_help_defender,
    apply_zone_modifiers,
    get_zone_drive_modifier,
    get_primary_defender,
    calculate_contest_quality,
    POSITION_COMPATIBILITY,
)
from src.core.probability import set_seed


# =============================================================================
# TEST FIXTURES
# =============================================================================

@pytest.fixture
def elite_perimeter_defender():
    """Elite perimeter defender (Gary Payton archetype)."""
    return {
        'name': 'Elite Perimeter',
        'position': 'PG',
        'height': 75,
        'reactions': 95,
        'agility': 95,
        'awareness': 92,
        'perimeter_defense': 98,
        # Fill in other attributes for composite calculations
        'grip_strength': 70, 'arm_strength': 70, 'core_strength': 70,
        'acceleration': 90, 'top_speed': 88, 'jumping': 75,
        'stamina': 85, 'balance': 85, 'durability': 80,
        'creativity': 70, 'determination': 90, 'bravery': 85,
        'consistency': 88, 'composure': 90, 'patience': 85,
        'hand_eye_coordination': 85, 'throw_accuracy': 70,
        'form_technique': 65, 'finesse': 75, 'deception': 80,
        'teamwork': 88,
    }


@pytest.fixture
def elite_interior_defender():
    """Elite interior defender (Rudy Gobert archetype)."""
    return {
        'name': 'Elite Interior',
        'position': 'C',
        'height': 95,
        'reactions': 90,
        'agility': 70,
        'awareness': 85,
        'perimeter_defense': 60,
        # Fill in other attributes
        'grip_strength': 85, 'arm_strength': 90, 'core_strength': 95,
        'acceleration': 60, 'top_speed': 65, 'jumping': 88,
        'stamina': 85, 'balance': 80, 'durability': 90,
        'creativity': 50, 'determination': 85, 'bravery': 90,
        'consistency': 80, 'composure': 85, 'patience': 80,
        'hand_eye_coordination': 75, 'throw_accuracy': 50,
        'form_technique': 55, 'finesse': 65, 'deception': 50,
        'teamwork': 80,
    }


@pytest.fixture
def poor_defender():
    """Poor defender (G-League rookie)."""
    return {
        'name': 'Poor Defender',
        'position': 'SG',
        'height': 70,
        'reactions': 35,
        'agility': 40,
        'awareness': 38,
        'perimeter_defense': 30,
        # Fill in other attributes
        'grip_strength': 50, 'arm_strength': 50, 'core_strength': 50,
        'acceleration': 50, 'top_speed': 50, 'jumping': 50,
        'stamina': 60, 'balance': 50, 'durability': 55,
        'creativity': 40, 'determination': 55, 'bravery': 50,
        'consistency': 45, 'composure': 42, 'patience': 45,
        'hand_eye_coordination': 50, 'throw_accuracy': 45,
        'form_technique': 40, 'finesse': 45, 'deception': 40,
        'teamwork': 50,
    }


@pytest.fixture
def average_defender():
    """Average defender (50 overall)."""
    return {
        'name': 'Average Defender',
        'position': 'SF',
        'height': 75,
        'reactions': 50,
        'agility': 50,
        'awareness': 50,
        'perimeter_defense': 50,
        # All attributes at 50
        'grip_strength': 50, 'arm_strength': 50, 'core_strength': 50,
        'acceleration': 50, 'top_speed': 50, 'jumping': 50,
        'stamina': 50, 'balance': 50, 'durability': 50,
        'creativity': 50, 'determination': 50, 'bravery': 50,
        'consistency': 50, 'composure': 50, 'patience': 50,
        'hand_eye_coordination': 50, 'throw_accuracy': 50,
        'form_technique': 50, 'finesse': 50, 'deception': 50,
        'teamwork': 50,
    }


@pytest.fixture
def pg_shooter():
    """Point guard shooter."""
    return {
        'name': 'PG Shooter',
        'position': 'PG',
        'height': 72,
        # Add minimal required attributes
        'reactions': 80, 'agility': 80, 'awareness': 80,
        'grip_strength': 60, 'arm_strength': 60, 'core_strength': 60,
        'acceleration': 75, 'top_speed': 75, 'jumping': 65,
        'stamina': 75, 'balance': 75, 'durability': 70,
        'creativity': 75, 'determination': 70, 'bravery': 70,
        'consistency': 75, 'composure': 80, 'patience': 75,
        'hand_eye_coordination': 85, 'throw_accuracy': 90,
        'form_technique': 90, 'finesse': 80, 'deception': 75,
        'teamwork': 75,
    }


@pytest.fixture
def defensive_team(elite_perimeter_defender, elite_interior_defender, poor_defender, average_defender):
    """Standard defensive team with mixed abilities."""
    return [
        elite_perimeter_defender,
        elite_interior_defender,
        poor_defender,
        average_defender,
        {
            'name': 'Role Player',
            'position': 'PF',
            'height': 80,
            'reactions': 60,
            'agility': 55,
            'awareness': 62,
            'perimeter_defense': 55,
            # Fill remaining attributes
            'grip_strength': 70, 'arm_strength': 75, 'core_strength': 75,
            'acceleration': 55, 'top_speed': 58, 'jumping': 70,
            'stamina': 65, 'balance': 65, 'durability': 70,
            'creativity': 50, 'determination': 65, 'bravery': 60,
            'consistency': 60, 'composure': 60, 'patience': 60,
            'hand_eye_coordination': 60, 'throw_accuracy': 55,
            'form_technique': 55, 'finesse': 60, 'deception': 50,
            'teamwork': 65,
        }
    ]


# =============================================================================
# DEFENSIVE ASSIGNMENT TESTS
# =============================================================================

def test_assign_defender_position_matching(pg_shooter, defensive_team):
    """Test position-based defensive assignment."""
    set_seed(42)

    available = [p['name'] for p in defensive_team]
    defender = assign_defender(pg_shooter, defensive_team, available)

    # Should prioritize position match
    assert defender is not None
    assert 'name' in defender
    assert '_assignment_debug' in defender

    # Elite perimeter defender (PG) should be selected for PG shooter
    # due to perfect position compatibility
    assert defender['name'] == 'Elite Perimeter'


def test_assign_defender_no_position_match(defensive_team):
    """Test assignment when no perfect position match available."""
    set_seed(42)

    # Create a center shooter
    c_shooter = {
        'name': 'Center Shooter',
        'position': 'C',
        'height': 84,
        'reactions': 70, 'agility': 60, 'awareness': 65,
        # Fill minimal attributes
        'grip_strength': 80, 'arm_strength': 85, 'core_strength': 85,
        'acceleration': 50, 'top_speed': 55, 'jumping': 75,
        'stamina': 70, 'balance': 70, 'durability': 75,
        'creativity': 55, 'determination': 70, 'bravery': 70,
        'consistency': 65, 'composure': 65, 'patience': 65,
        'hand_eye_coordination': 70, 'throw_accuracy': 65,
        'form_technique': 65, 'finesse': 65, 'deception': 55,
        'teamwork': 65,
    }

    available = [p['name'] for p in defensive_team]
    defender = assign_defender(c_shooter, defensive_team, available)

    # Elite interior defender (C) should match well with center shooter
    assert defender is not None
    assert defender['name'] == 'Elite Interior'


def test_assign_defender_limited_availability(pg_shooter, defensive_team):
    """Test assignment when only some defenders are available."""
    set_seed(42)

    # Only poor defender available
    available = ['Poor Defender']
    defender = assign_defender(pg_shooter, defensive_team, available)

    assert defender['name'] == 'Poor Defender'


def test_assign_defender_no_availability_error(pg_shooter, defensive_team):
    """Test error handling when no defenders available."""
    with pytest.raises(ValueError, match="No available defenders"):
        assign_defender(pg_shooter, defensive_team, [])


# =============================================================================
# CONTEST DISTANCE TESTS
# =============================================================================

def test_contest_distance_elite_defender(elite_perimeter_defender):
    """Test contest distance for elite defender."""
    set_seed(42)

    # Elite defender should have composite ~90
    # distance = 10 - (90 / 10) = 1.0 ft
    distance = calculate_contest_distance(elite_perimeter_defender)

    assert 0.5 <= distance <= 3.0, f"Elite defender distance should be 0.5-3.0 ft, got {distance}"
    # Should be close to 1-2 ft (heavily contested)


def test_contest_distance_average_defender(average_defender):
    """Test contest distance for average defender."""
    set_seed(42)

    # Average defender should have composite ~50
    # distance = 10 - (50 / 10) = 5.0 ft
    distance = calculate_contest_distance(average_defender)

    assert 4.0 <= distance <= 6.0, f"Average defender distance should be ~5.0 ft, got {distance}"


def test_contest_distance_poor_defender(poor_defender):
    """Test contest distance for poor defender."""
    set_seed(42)

    # Poor defender should have composite ~30-50
    # distance = 10 - (40 / 10) = 6.0 ft (wide open)
    # But actual composite may vary based on attribute mix
    distance = calculate_contest_distance(poor_defender)

    assert 4.5 <= distance <= 8.0, f"Poor defender distance should be 4.5-8 ft, got {distance}"


def test_contest_distance_help_defense_penalty(elite_perimeter_defender):
    """Test help defense adds +3 ft penalty."""
    set_seed(42)

    base_distance = calculate_contest_distance(elite_perimeter_defender, is_help_defense=False)
    help_distance = calculate_contest_distance(elite_perimeter_defender, is_help_defense=True)

    assert help_distance > base_distance, "Help defense should increase distance"
    # Should be approximately +3 ft
    assert 2.5 <= (help_distance - base_distance) <= 3.5, \
        f"Help penalty should be ~3 ft, got {help_distance - base_distance}"


def test_contest_distance_zone_penalty(elite_perimeter_defender):
    """Test zone defense increases distance."""
    set_seed(42)

    man_distance = calculate_contest_distance(elite_perimeter_defender, zone_pct=0)
    zone_50_distance = calculate_contest_distance(elite_perimeter_defender, zone_pct=50)
    zone_100_distance = calculate_contest_distance(elite_perimeter_defender, zone_pct=100)

    assert zone_50_distance > man_distance, "50% zone should increase distance"
    assert zone_100_distance > zone_50_distance, "100% zone should increase distance more"
    assert zone_100_distance <= man_distance + 2.0, "Zone penalty should be capped around +2 ft"


def test_contest_distance_bounds(elite_perimeter_defender, poor_defender):
    """Test contest distance always within [0.5, 10.0] bounds."""
    set_seed(42)

    # Test various scenarios
    scenarios = [
        (elite_perimeter_defender, False, 0),
        (elite_perimeter_defender, True, 100),
        (poor_defender, False, 0),
        (poor_defender, True, 100),
    ]

    for defender, is_help, zone_pct in scenarios:
        distance = calculate_contest_distance(defender, is_help, zone_pct)
        assert 0.5 <= distance <= 10.0, \
            f"Distance {distance} out of bounds for {defender['name']}, help={is_help}, zone={zone_pct}"


# =============================================================================
# HELP DEFENSE TESTS
# =============================================================================

def test_select_help_defender_basic(defensive_team, elite_perimeter_defender):
    """Test basic help defender selection."""
    set_seed(42)

    # Run multiple times to check stochastic behavior
    help_defender = select_help_defender(defensive_team, elite_perimeter_defender)

    # Should return a defender (may be None if no one rotates)
    if help_defender is not None:
        assert help_defender['name'] != elite_perimeter_defender['name']
        assert '_help_defense_debug' in help_defender


def test_select_help_defender_excludes_primary(defensive_team, elite_perimeter_defender):
    """Test that primary defender is excluded from help selection."""
    set_seed(42)

    # Run multiple iterations
    for _ in range(10):
        help_defender = select_help_defender(defensive_team, elite_perimeter_defender)

        if help_defender is not None:
            assert help_defender['name'] != elite_perimeter_defender['name'], \
                "Help defender should not be the primary defender"


def test_select_help_defender_prefers_interior(defensive_team, poor_defender):
    """Test that help defense prefers interior defenders."""
    set_seed(43)

    # Run multiple times and track results
    help_selections = []
    for i in range(20):
        set_seed(100 + i)
        help_defender = select_help_defender(defensive_team, poor_defender)
        if help_defender is not None:
            help_selections.append(help_defender['name'])

    # Elite interior defender should appear frequently due to high composite
    if help_selections:
        assert 'Elite Interior' in help_selections, \
            "Elite interior defender should be selected for help defense"


def test_select_help_defender_no_helpers_available():
    """Test help defense with only primary defender."""
    set_seed(42)

    single_defender_team = [{
        'name': 'Only Defender',
        'position': 'SF',
        'height': 75,
        'reactions': 70,
        'agility': 70,
        'awareness': 70,
        # Fill minimal attributes
        'grip_strength': 60, 'arm_strength': 60, 'core_strength': 60,
        'acceleration': 65, 'top_speed': 65, 'jumping': 65,
        'stamina': 70, 'balance': 65, 'durability': 65,
        'creativity': 60, 'determination': 60, 'bravery': 60,
        'consistency': 60, 'composure': 60, 'patience': 60,
        'hand_eye_coordination': 65, 'throw_accuracy': 60,
        'form_technique': 60, 'finesse': 60, 'deception': 55,
        'teamwork': 65,
    }]

    result = select_help_defender(single_defender_team, single_defender_team[0])
    assert result is None, "No help should be available when only primary defender exists"


# =============================================================================
# ZONE DEFENSE MODIFIER TESTS
# =============================================================================

def test_apply_zone_modifiers_full_zone():
    """Test zone modifiers at 100% zone defense."""
    base_effectiveness = 0.80

    modified = apply_zone_modifiers(base_effectiveness, zone_pct=100)

    # Should apply -15% penalty
    # 0.80 + (-0.15) = 0.65
    assert 0.63 <= modified <= 0.67, f"Expected ~0.65, got {modified}"


def test_apply_zone_modifiers_partial_zone():
    """Test zone modifiers at 50% zone defense."""
    base_effectiveness = 0.80

    modified = apply_zone_modifiers(base_effectiveness, zone_pct=50)

    # Should apply -7.5% penalty
    # 0.80 + (-0.075) = 0.725
    assert 0.71 <= modified <= 0.74, f"Expected ~0.725, got {modified}"


def test_apply_zone_modifiers_no_zone():
    """Test zone modifiers at 0% zone defense (all man)."""
    base_effectiveness = 0.80

    modified = apply_zone_modifiers(base_effectiveness, zone_pct=0)

    assert modified == base_effectiveness, "No zone should not modify effectiveness"


def test_apply_zone_modifiers_bounds():
    """Test zone modifiers respect [0, 1] bounds."""
    # Test extreme cases
    cases = [
        (0.05, 100),  # Low base, high zone
        (0.95, 0),    # High base, no zone
        (0.50, 100),  # Mid base, high zone
    ]

    for base, zone_pct in cases:
        modified = apply_zone_modifiers(base, zone_pct)
        assert 0.0 <= modified <= 1.0, \
            f"Modified effectiveness {modified} out of bounds for base={base}, zone={zone_pct}"


def test_get_zone_drive_modifier_full_zone():
    """Test drive modifier at 100% zone."""
    modifier = get_zone_drive_modifier(zone_pct=100)

    # Should return 0.90 (-10% penalty)
    assert 0.89 <= modifier <= 0.91, f"Expected 0.90, got {modifier}"


def test_get_zone_drive_modifier_partial_zone():
    """Test drive modifier at 50% zone."""
    modifier = get_zone_drive_modifier(zone_pct=50)

    # Should return 0.95 (-5% penalty)
    assert 0.94 <= modifier <= 0.96, f"Expected 0.95, got {modifier}"


def test_get_zone_drive_modifier_no_zone():
    """Test drive modifier at 0% zone."""
    modifier = get_zone_drive_modifier(zone_pct=0)

    assert modifier == 1.0, "No zone should have no modifier"


# =============================================================================
# INTEGRATED DEFENSE COORDINATOR TESTS
# =============================================================================

def test_get_primary_defender_man_with_assignment(pg_shooter, defensive_team):
    """Test man defense with manual assignment."""
    set_seed(42)

    assignments = {
        'PG Shooter': 'Elite Perimeter'
    }

    defender = get_primary_defender(
        pg_shooter,
        defensive_team,
        assignments,
        defense_type='man'
    )

    assert defender['name'] == 'Elite Perimeter'
    assert defender['_assignment_type'] == 'manual'


def test_get_primary_defender_man_fallback(pg_shooter, defensive_team):
    """Test man defense fallback when no assignment."""
    set_seed(42)

    assignments = {}  # No manual assignments

    defender = get_primary_defender(
        pg_shooter,
        defensive_team,
        assignments,
        defense_type='man'
    )

    assert defender is not None
    assert defender['_assignment_type'] == 'position_fallback'


def test_get_primary_defender_zone(pg_shooter, defensive_team):
    """Test zone defense always uses position-based."""
    set_seed(42)

    assignments = {
        'PG Shooter': 'Poor Defender'  # Manual assignment should be ignored
    }

    defender = get_primary_defender(
        pg_shooter,
        defensive_team,
        assignments,
        defense_type='zone'
    )

    assert defender is not None
    assert defender['_assignment_type'] == 'zone_proximity'
    # Should use best position match, not manual assignment
    assert defender['name'] != 'Poor Defender'


def test_get_primary_defender_invalid_defense_type(pg_shooter, defensive_team):
    """Test error handling for invalid defense type."""
    with pytest.raises(ValueError, match="Invalid defense_type"):
        get_primary_defender(
            pg_shooter,
            defensive_team,
            {},
            defense_type='invalid'
        )


# =============================================================================
# CONTEST QUALITY TESTS
# =============================================================================

def test_calculate_contest_quality_heavy_contest(elite_perimeter_defender):
    """Test contest quality for heavy contest."""
    set_seed(42)

    # Elite defender, close distance
    quality = calculate_contest_quality(elite_perimeter_defender, contest_distance=1.5)

    # Should be high quality (close to 1.0)
    assert 0.7 <= quality <= 1.0, f"Heavy contest quality should be high, got {quality}"


def test_calculate_contest_quality_wide_open(poor_defender):
    """Test contest quality for wide open shot."""
    set_seed(42)

    # Poor defender, far distance
    quality = calculate_contest_quality(poor_defender, contest_distance=8.0)

    # Should be low quality (close to 0)
    assert 0.0 <= quality <= 0.2, f"Wide open quality should be low, got {quality}"


def test_calculate_contest_quality_gradient():
    """Test contest quality forms proper gradient."""
    defender = {
        'name': 'Test',
        'position': 'SG',
        'height': 75,
        'reactions': 70,
        'agility': 70,
        # Fill minimal
        'grip_strength': 60, 'arm_strength': 60, 'core_strength': 60,
        'acceleration': 65, 'top_speed': 65, 'jumping': 65,
        'stamina': 70, 'balance': 65, 'durability': 65,
        'creativity': 60, 'determination': 60, 'bravery': 60,
        'consistency': 60, 'composure': 60, 'patience': 60,
        'hand_eye_coordination': 65, 'throw_accuracy': 60,
        'form_technique': 60, 'finesse': 60, 'deception': 55,
        'teamwork': 65,
        'awareness': 70,
    }

    distances = [1.0, 3.0, 5.0, 7.0, 9.0]
    qualities = [calculate_contest_quality(defender, d) for d in distances]

    # Quality should decrease as distance increases
    for i in range(len(qualities) - 1):
        assert qualities[i] >= qualities[i+1], \
            f"Contest quality should decrease with distance: {qualities}"


# =============================================================================
# POSITION COMPATIBILITY TESTS
# =============================================================================

def test_position_compatibility_exists():
    """Test that position compatibility table is complete."""
    positions = ['PG', 'SG', 'SF', 'PF', 'C']

    for off_pos in positions:
        for def_pos in positions:
            key = (off_pos, def_pos)
            assert key in POSITION_COMPATIBILITY, \
                f"Missing position compatibility for {key}"


def test_position_compatibility_perfect_matches():
    """Test that same positions have perfect compatibility."""
    positions = ['PG', 'SG', 'SF', 'PF', 'C']

    for pos in positions:
        compatibility = POSITION_COMPATIBILITY[(pos, pos)]
        assert compatibility == 1.0, \
            f"Same position {pos} should have 1.0 compatibility, got {compatibility}"


def test_position_compatibility_symmetry():
    """Test that compatibility is roughly symmetric."""
    # Adjacent positions should have similar (but not necessarily identical) compatibility
    adjacent_pairs = [
        ('PG', 'SG'),
        ('SG', 'SF'),
        ('SF', 'PF'),
        ('PF', 'C'),
    ]

    for pos1, pos2 in adjacent_pairs:
        comp_forward = POSITION_COMPATIBILITY[(pos1, pos2)]
        comp_backward = POSITION_COMPATIBILITY[(pos2, pos1)]

        # Should be within 0.2 of each other (reasonable range)
        assert abs(comp_forward - comp_backward) <= 0.2, \
            f"Compatibility for {pos1}-{pos2} should be roughly symmetric"


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
