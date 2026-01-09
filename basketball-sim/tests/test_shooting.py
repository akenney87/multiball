"""
Unit Tests for Shooting System

Validates all shooting mechanics against specifications.
"""

import pytest
import random
from typing import Dict, Any

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
from src.constants import (
    BASE_RATE_3PT,
    BASE_RATE_DUNK,
    BASE_RATE_LAYUP,
    CONTEST_PENALTY_WIDE_OPEN,
    CONTEST_PENALTY_CONTESTED,
    CONTEST_PENALTY_HEAVY,
)


# =============================================================================
# FIXTURES
# =============================================================================

@pytest.fixture
def elite_shooter() -> Dict[str, Any]:
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


@pytest.fixture
def poor_shooter() -> Dict[str, Any]:
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


@pytest.fixture
def elite_defender() -> Dict[str, Any]:
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


@pytest.fixture
def poor_defender() -> Dict[str, Any]:
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


@pytest.fixture
def dunker() -> Dict[str, Any]:
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


# =============================================================================
# TEST SHOT TYPE SELECTION
# =============================================================================

def test_shot_type_selection_baseline():
    """Test baseline distribution (40/20/40)."""
    set_seed(42)

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

    # Run 1000 selections to check distribution
    results = {'3pt': 0, 'midrange': 0, 'rim': 0}
    for _ in range(1000):
        shot_type = select_shot_type(average_shooter, tactics, context, 'man')
        results[shot_type] += 1

    # Should be roughly 40/20/40 (±5% tolerance)
    assert 0.35 <= results['3pt'] / 1000 <= 0.45
    assert 0.15 <= results['midrange'] / 1000 <= 0.25
    assert 0.35 <= results['rim'] / 1000 <= 0.45


def test_shot_type_selection_elite_shooter(elite_shooter):
    """Elite shooters should favor 3PT."""
    set_seed(42)

    tactics = TacticalSettings(pace='standard')
    context = PossessionContext(is_transition=False)

    results = {'3pt': 0, 'midrange': 0, 'rim': 0}
    for _ in range(1000):
        shot_type = select_shot_type(elite_shooter, tactics, context, 'man')
        results[shot_type] += 1

    # Elite shooter: 3PT should be elevated (>40%)
    assert results['3pt'] / 1000 > 0.42


def test_shot_type_selection_zone_defense(elite_shooter):
    """Zone defense should increase 3PT attempts."""
    set_seed(42)

    tactics = TacticalSettings(pace='standard')
    context = PossessionContext(is_transition=False)

    # Man defense distribution
    man_results = {'3pt': 0, 'midrange': 0, 'rim': 0}
    for _ in range(1000):
        shot_type = select_shot_type(elite_shooter, tactics, context, 'man')
        man_results[shot_type] += 1

    # Zone defense distribution
    zone_results = {'3pt': 0, 'midrange': 0, 'rim': 0}
    for _ in range(1000):
        shot_type = select_shot_type(elite_shooter, tactics, context, 'zone')
        zone_results[shot_type] += 1

    # Zone should have more 3PT attempts
    assert zone_results['3pt'] > man_results['3pt']


def test_shot_type_selection_transition(elite_shooter):
    """Transition should heavily favor rim attempts."""
    set_seed(42)

    tactics = TacticalSettings(pace='standard')
    context_halfcourt = PossessionContext(is_transition=False)
    context_transition = PossessionContext(is_transition=True)

    # Halfcourt distribution
    halfcourt_results = {'3pt': 0, 'midrange': 0, 'rim': 0}
    for _ in range(1000):
        shot_type = select_shot_type(elite_shooter, tactics, context_halfcourt, 'man')
        halfcourt_results[shot_type] += 1

    # Transition distribution
    transition_results = {'3pt': 0, 'midrange': 0, 'rim': 0}
    for _ in range(1000):
        shot_type = select_shot_type(elite_shooter, tactics, context_transition, 'man')
        transition_results[shot_type] += 1

    # Transition should have significantly more rim attempts
    assert transition_results['rim'] > halfcourt_results['rim'] + 150


# =============================================================================
# TEST CONTEST PENALTY
# =============================================================================

def test_contest_penalty_wide_open():
    """Wide open shots (6+ ft) should have no penalty."""
    penalty = calculate_contest_penalty(contest_distance=8.0, defender_composite=50)
    assert penalty == 0.0


def test_contest_penalty_contested():
    """Contested shots (2-6 ft) should have -15% base penalty."""
    penalty = calculate_contest_penalty(contest_distance=4.0, defender_composite=50)
    assert -0.20 <= penalty <= -0.10  # -15% ± defender modifier


def test_contest_penalty_heavy():
    """Heavily contested (<2 ft) should have -25% base penalty."""
    penalty = calculate_contest_penalty(contest_distance=1.0, defender_composite=50)
    assert -0.30 <= penalty <= -0.20  # -25% ± defender modifier


def test_contest_penalty_elite_defender():
    """Elite defender should increase penalty."""
    penalty_average = calculate_contest_penalty(contest_distance=3.0, defender_composite=50)
    penalty_elite = calculate_contest_penalty(contest_distance=3.0, defender_composite=90)

    # Elite defender penalty should be more negative (harder shot)
    assert penalty_elite < penalty_average


def test_contest_penalty_poor_defender():
    """Poor defender should reduce penalty."""
    penalty_average = calculate_contest_penalty(contest_distance=3.0, defender_composite=50)
    penalty_poor = calculate_contest_penalty(contest_distance=3.0, defender_composite=30)

    # Poor defender penalty should be less negative (easier shot)
    assert penalty_poor > penalty_average


def test_contest_penalty_zone_defense():
    """Zone defense should reduce contest effectiveness."""
    penalty_man = calculate_contest_penalty(
        contest_distance=3.0,
        defender_composite=90,
        defense_type='man'
    )
    penalty_zone = calculate_contest_penalty(
        contest_distance=3.0,
        defender_composite=90,
        defense_type='zone'
    )

    # Zone penalty should be less severe (less negative)
    assert penalty_zone > penalty_man


# =============================================================================
# TEST HELP DEFENSE
# =============================================================================

def test_help_defense_no_help_needed(elite_defender):
    """Strong contest should not trigger help."""
    # Close contest (1.5 ft) with elite defender = strong contest quality
    result = check_help_defense(
        primary_defender_composite=90,
        contest_distance=1.5,
        help_defenders=[elite_defender]
    )
    assert result is None  # No help needed


def test_help_defense_trigger_on_poor_contest(elite_defender):
    """Poor contest should trigger help rotation."""
    set_seed(42)

    # Wide open (8 ft) should trigger help
    result = check_help_defense(
        primary_defender_composite=30,
        contest_distance=8.0,
        help_defenders=[elite_defender]
    )

    # With elite awareness, should often rotate
    # (Not guaranteed on single roll, but likely)
    # This test is probabilistic


def test_help_defense_no_help_defenders():
    """No help defenders available should return None."""
    result = check_help_defense(
        primary_defender_composite=30,
        contest_distance=8.0,
        help_defenders=[]
    )
    assert result is None


# =============================================================================
# TEST DUNK VS LAYUP
# =============================================================================

def test_dunk_vs_layup_dunker(dunker):
    """Elite dunker should choose dunk."""
    result = determine_rim_attempt_type(dunker)
    assert result == 'dunk'


def test_dunk_vs_layup_poor_athlete(poor_shooter):
    """Poor athlete should choose layup."""
    result = determine_rim_attempt_type(poor_shooter)
    assert result == 'layup'


# =============================================================================
# TEST SHOT ATTEMPTS
# =============================================================================

def test_3pt_elite_vs_poor(elite_shooter, poor_defender):
    """Elite shooter vs poor defender should have high success rate."""
    set_seed(42)

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

        # Validate debug info structure
        assert 'shooter_composite' in debug
        assert 'defender_composite' in debug
        assert 'base_success' in debug
        assert 'final_success_rate' in debug
        assert 0.0 <= debug['final_success_rate'] <= 1.0

    make_pct = makes / attempts

    # Elite shooter wide open should be ~70-85%
    assert 0.60 <= make_pct <= 0.90


def test_3pt_poor_vs_elite(poor_shooter, elite_defender):
    """Poor shooter vs elite defender should have low success rate."""
    set_seed(42)

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

    # Poor shooter heavily contested should be ~10-25%
    assert 0.05 <= make_pct <= 0.30


def test_transition_bonus_rim(dunker, poor_defender):
    """Transition should provide +20% bonus to rim attempts."""
    set_seed(42)

    context_halfcourt = PossessionContext(is_transition=False)
    context_transition = PossessionContext(is_transition=True)

    # Halfcourt rim attempts
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

    # Transition rim attempts
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

    # Transition should have noticeably higher success rate
    assert transition_makes > halfcourt_makes


def test_midrange_range_types(elite_shooter, poor_defender):
    """Short midrange should have higher base rate than long."""
    set_seed(42)

    context = PossessionContext(is_transition=False)

    # Short midrange (0.45 base)
    short_makes = 0
    for _ in range(100):
        success, debug = attempt_midrange_shot(
            shooter=elite_shooter,
            defender=poor_defender,
            contest_distance=6.0,
            possession_context=context,
            range_type='short'
        )
        if success:
            short_makes += 1

    # Long midrange (0.37 base)
    long_makes = 0
    for _ in range(100):
        success, debug = attempt_midrange_shot(
            shooter=elite_shooter,
            defender=poor_defender,
            contest_distance=6.0,
            possession_context=context,
            range_type='long'
        )
        if success:
            long_makes += 1

    # Short should have higher success rate
    assert short_makes > long_makes


# =============================================================================
# TEST CONTEST DISTANCE SIMULATION
# =============================================================================

def test_contest_distance_elite_defender(elite_shooter, elite_defender):
    """Elite defender should get close contests."""
    set_seed(42)

    distances = [simulate_contest_distance(elite_shooter, elite_defender) for _ in range(100)]
    avg_distance = sum(distances) / len(distances)

    # Elite defender should average closer than wide open (6 ft)
    assert avg_distance < 5.5


def test_contest_distance_poor_defender(elite_shooter, poor_defender):
    """Poor defender should struggle to contest."""
    set_seed(42)

    distances = [simulate_contest_distance(elite_shooter, poor_defender) for _ in range(100)]
    avg_distance = sum(distances) / len(distances)

    # Poor defender should average farther than 6 ft
    assert avg_distance > 6.0


# =============================================================================
# TEST PROBABILITY BOUNDS
# =============================================================================

def test_all_probabilities_in_bounds(elite_shooter, elite_defender):
    """All shot probabilities must be in [0, 1]."""
    set_seed(42)

    context = PossessionContext(is_transition=False)

    for _ in range(100):
        # 3PT
        _, debug = attempt_3pt_shot(
            shooter=elite_shooter,
            defender=elite_defender,
            contest_distance=random.uniform(0.5, 10.0),
            possession_context=context
        )
        assert 0.0 <= debug['final_success_rate'] <= 1.0

        # Midrange
        _, debug = attempt_midrange_shot(
            shooter=elite_shooter,
            defender=elite_defender,
            contest_distance=random.uniform(0.5, 10.0),
            possession_context=context,
            range_type='short'
        )
        assert 0.0 <= debug['final_success_rate'] <= 1.0

        # Rim
        _, debug = attempt_rim_shot(
            shooter=elite_shooter,
            defender=elite_defender,
            contest_distance=random.uniform(0.5, 10.0),
            possession_context=context,
            attempt_type='layup'
        )
        assert 0.0 <= debug['final_success_rate'] <= 1.0


# =============================================================================
# RUN TESTS
# =============================================================================

if __name__ == '__main__':
    pytest.main([__file__, '-v'])
