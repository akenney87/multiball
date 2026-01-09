"""
Unit tests for turnover system.

Validates:
- Base turnover rate calculation
- Tactical modifiers (pace, zone, transition)
- Turnover type distribution
- Steal attribution
- Transition triggering
- Edge cases (extreme attributes)
"""

import pytest
import random
from typing import Dict, Any

from src.systems.turnovers import (
    check_turnover,
    select_turnover_type,
    determine_steal_credit,
    triggers_transition,
    get_turnover_description
)
from src.core.data_structures import TacticalSettings, PossessionContext
from src.core.probability import set_seed


# Test fixtures
@pytest.fixture
def average_ball_handler() -> Dict[str, Any]:
    """Average ball handler (50 in all attributes)."""
    return {
        'name': 'Average Player',
        'position': 'PG',
        'awareness': 50,
        'composure': 50,
        'consistency': 50,
        'hand_eye_coordination': 50,
        # Other attributes
        'height': 50,
        'reactions': 50,
        'agility': 50,
        'grip_strength': 50,
        'arm_strength': 50,
        'core_strength': 50,
        'acceleration': 50,
        'top_speed': 50,
        'jumping': 50,
        'balance': 50,
        'stamina': 50,
        'durability': 50,
        'creativity': 50,
        'determination': 50,
        'bravery': 50,
        'patience': 50,
        'throw_accuracy': 50,
        'form_technique': 50,
        'finesse': 50,
        'deception': 50,
        'teamwork': 50,
    }


@pytest.fixture
def elite_ball_handler() -> Dict[str, Any]:
    """Elite ball handler (90 in turnover prevention attributes)."""
    player = {
        'name': 'Elite Ball Handler',
        'position': 'PG',
        'awareness': 90,
        'composure': 90,
        'consistency': 90,
        'hand_eye_coordination': 90,
        # Other attributes
        'height': 70,
        'reactions': 85,
        'agility': 85,
        'grip_strength': 70,
        'arm_strength': 60,
        'core_strength': 70,
        'acceleration': 85,
        'top_speed': 85,
        'jumping': 75,
        'balance': 85,
        'stamina': 90,
        'durability': 80,
        'creativity': 85,
        'determination': 90,
        'bravery': 85,
        'patience': 85,
        'throw_accuracy': 85,
        'form_technique': 80,
        'finesse': 85,
        'deception': 80,
        'teamwork': 90,
    }
    return player


@pytest.fixture
def poor_ball_handler() -> Dict[str, Any]:
    """Poor ball handler (30 in turnover prevention attributes)."""
    player = {
        'name': 'Poor Ball Handler',
        'position': 'C',
        'awareness': 30,
        'composure': 30,
        'consistency': 30,
        'hand_eye_coordination': 30,
        # Other attributes
        'height': 85,
        'reactions': 40,
        'agility': 35,
        'grip_strength': 70,
        'arm_strength': 80,
        'core_strength': 75,
        'acceleration': 35,
        'top_speed': 40,
        'jumping': 60,
        'balance': 45,
        'stamina': 70,
        'durability': 75,
        'creativity': 35,
        'determination': 60,
        'bravery': 70,
        'patience': 40,
        'throw_accuracy': 40,
        'form_technique': 35,
        'finesse': 35,
        'deception': 30,
        'teamwork': 40,
    }
    return player


@pytest.fixture
def elite_defender() -> Dict[str, Any]:
    """Elite defender for steal attribution tests."""
    return {
        'name': 'Elite Defender',
        'position': 'SG',
        'height': 75,
        'reactions': 95,
        'agility': 92,
        # Other attributes
        'awareness': 88,
        'composure': 80,
        'consistency': 85,
        'hand_eye_coordination': 90,
        'grip_strength': 75,
        'arm_strength': 70,
        'core_strength': 75,
        'acceleration': 90,
        'top_speed': 88,
        'jumping': 85,
        'balance': 82,
        'stamina': 85,
        'durability': 80,
        'creativity': 70,
        'determination': 90,
        'bravery': 85,
        'patience': 75,
        'throw_accuracy': 70,
        'form_technique': 65,
        'finesse': 70,
        'deception': 75,
        'teamwork': 80,
    }


@pytest.fixture
def poor_defender() -> Dict[str, Any]:
    """Poor defender for steal attribution tests."""
    return {
        'name': 'Poor Defender',
        'position': 'C',
        'height': 85,
        'reactions': 35,
        'agility': 30,
        # Other attributes
        'awareness': 40,
        'composure': 50,
        'consistency': 45,
        'hand_eye_coordination': 40,
        'grip_strength': 80,
        'arm_strength': 85,
        'core_strength': 85,
        'acceleration': 30,
        'top_speed': 35,
        'jumping': 65,
        'balance': 50,
        'stamina': 75,
        'durability': 80,
        'creativity': 40,
        'determination': 70,
        'bravery': 75,
        'patience': 50,
        'throw_accuracy': 50,
        'form_technique': 40,
        'finesse': 40,
        'deception': 35,
        'teamwork': 55,
    }


@pytest.fixture
def standard_tactics() -> TacticalSettings:
    """Standard tactical settings."""
    return TacticalSettings(
        pace='standard',
        man_defense_pct=50,
        rebounding_strategy='standard'
    )


@pytest.fixture
def standard_context() -> PossessionContext:
    """Standard possession context."""
    return PossessionContext(
        is_transition=False,
        shot_clock=24
    )


# =============================================================================
# TEST: Base Turnover Rate
# =============================================================================

def test_base_turnover_rate_average_matchup(
    average_ball_handler,
    standard_tactics,
    standard_context
):
    """
    Test base turnover rate with average ball handler vs average defender.
    Expected: ~4% turnover rate (8% base * 0.5 sigmoid multiplier)
    """
    set_seed(42)

    turnovers = 0
    trials = 1000

    # Use same player as both ball handler and defender (average vs average)
    for _ in range(trials):
        occurred, debug = check_turnover(
            average_ball_handler,
            average_ball_handler,  # Average defender
            standard_tactics,
            standard_context
        )
        if occurred:
            turnovers += 1

    turnover_rate = turnovers / trials

    # Expected: 8% base * sigmoid(0) ≈ 8% * 0.5 = 4%
    # Allow ±2% for statistical variance
    assert 0.02 <= turnover_rate <= 0.06, \
        f"Average matchup turnover rate {turnover_rate:.3f} outside expected range [0.02, 0.06]"


def test_elite_ball_handler_low_turnover_rate(
    elite_ball_handler,
    average_ball_handler,
    standard_tactics,
    standard_context
):
    """
    Test elite ball handler has significantly lower turnover rate.
    Expected: ~1-2% (elite composite reduces rate dramatically)
    """
    set_seed(42)

    turnovers = 0
    trials = 1000

    for _ in range(trials):
        occurred, debug = check_turnover(
            elite_ball_handler,
            average_ball_handler,
            standard_tactics,
            standard_context
        )
        if occurred:
            turnovers += 1

    turnover_rate = turnovers / trials

    # Elite handler (90 composite) should have very low rate
    # Expected: <3.5% (sigmoid reduction from 8% base)
    assert turnover_rate <= 0.035, \
        f"Elite ball handler turnover rate {turnover_rate:.3f} too high (expected ≤0.035)"


def test_poor_ball_handler_high_turnover_rate(
    poor_ball_handler,
    average_ball_handler,
    standard_tactics,
    standard_context
):
    """
    Test poor ball handler has significantly higher turnover rate.
    Expected: ~6-8% (poor composite increases rate)
    """
    set_seed(42)

    turnovers = 0
    trials = 1000

    for _ in range(trials):
        occurred, debug = check_turnover(
            poor_ball_handler,
            average_ball_handler,
            standard_tactics,
            standard_context
        )
        if occurred:
            turnovers += 1

    turnover_rate = turnovers / trials

    # Poor handler (30 composite) should have elevated rate
    # Expected: 5-8%
    assert 0.04 <= turnover_rate <= 0.10, \
        f"Poor ball handler turnover rate {turnover_rate:.3f} outside expected range [0.04, 0.10]"


# =============================================================================
# TEST: Tactical Modifiers
# =============================================================================

def test_fast_pace_increases_turnovers(
    average_ball_handler,
    standard_context
):
    """Test fast pace increases turnover rate by ~2.5%."""
    set_seed(42)

    # Fast pace
    fast_tactics = TacticalSettings(pace='fast', man_defense_pct=50)
    fast_turnovers = 0

    # Standard pace
    standard_tactics = TacticalSettings(pace='standard', man_defense_pct=50)
    standard_turnovers = 0

    trials = 1000

    for _ in range(trials):
        if check_turnover(average_ball_handler, average_ball_handler, fast_tactics, standard_context)[0]:
            fast_turnovers += 1

        if check_turnover(average_ball_handler, average_ball_handler, standard_tactics, standard_context)[0]:
            standard_turnovers += 1

    fast_rate = fast_turnovers / trials
    standard_rate = standard_turnovers / trials

    # Fast should be higher by approximately +2.5% (accounting for sigmoid adjustment)
    assert fast_rate > standard_rate, "Fast pace should increase turnover rate"
    assert fast_rate - standard_rate >= 0.01, \
        f"Fast pace bonus too small: {fast_rate:.3f} vs {standard_rate:.3f}"


def test_slow_pace_decreases_turnovers(
    average_ball_handler,
    standard_context
):
    """Test slow pace decreases turnover rate by ~2.5%."""
    set_seed(42)

    # Slow pace
    slow_tactics = TacticalSettings(pace='slow', man_defense_pct=50)
    slow_turnovers = 0

    # Standard pace
    standard_tactics = TacticalSettings(pace='standard', man_defense_pct=50)
    standard_turnovers = 0

    trials = 1000

    for _ in range(trials):
        if check_turnover(average_ball_handler, average_ball_handler, slow_tactics, standard_context)[0]:
            slow_turnovers += 1

        if check_turnover(average_ball_handler, average_ball_handler, standard_tactics, standard_context)[0]:
            standard_turnovers += 1

    slow_rate = slow_turnovers / trials
    standard_rate = standard_turnovers / trials

    # Slow should be lower
    assert slow_rate < standard_rate, "Slow pace should decrease turnover rate"


def test_zone_defense_increases_turnovers(
    average_ball_handler,
    standard_context
):
    """Test zone defense increases turnover rate by ~3%."""
    set_seed(42)

    # 100% zone defense
    zone_tactics = TacticalSettings(pace='standard', man_defense_pct=0)
    zone_turnovers = 0

    # 100% man defense
    man_tactics = TacticalSettings(pace='standard', man_defense_pct=100)
    man_turnovers = 0

    trials = 1000

    for _ in range(trials):
        if check_turnover(average_ball_handler, average_ball_handler, zone_tactics, standard_context)[0]:
            zone_turnovers += 1

        if check_turnover(average_ball_handler, average_ball_handler, man_tactics, standard_context)[0]:
            man_turnovers += 1

    zone_rate = zone_turnovers / trials
    man_rate = man_turnovers / trials

    # Zone should be higher by approximately +3%
    assert zone_rate > man_rate, "Zone defense should increase turnover rate"
    assert zone_rate - man_rate >= 0.015, \
        f"Zone defense bonus too small: {zone_rate:.3f} vs {man_rate:.3f}"


def test_transition_decreases_turnovers(
    average_ball_handler,
    standard_tactics
):
    """Test transition possession reduces turnover rate by 2%."""
    set_seed(42)

    # Transition
    transition_context = PossessionContext(is_transition=True, shot_clock=24)
    transition_turnovers = 0

    # Halfcourt
    halfcourt_context = PossessionContext(is_transition=False, shot_clock=24)
    halfcourt_turnovers = 0

    trials = 1000

    for _ in range(trials):
        if check_turnover(average_ball_handler, average_ball_handler, standard_tactics, transition_context)[0]:
            transition_turnovers += 1

        if check_turnover(average_ball_handler, average_ball_handler, standard_tactics, halfcourt_context)[0]:
            halfcourt_turnovers += 1

    transition_rate = transition_turnovers / trials
    halfcourt_rate = halfcourt_turnovers / trials

    # Transition should be lower
    assert transition_rate < halfcourt_rate, "Transition should decrease turnover rate"


# =============================================================================
# TEST: Turnover Type Selection
# =============================================================================

def test_turnover_type_distribution(standard_context, standard_tactics):
    """Test turnover type distribution matches expected percentages."""
    set_seed(42)

    type_counts = {
        'bad_pass': 0,
        'lost_ball': 0,
        'offensive_foul': 0,
        'violation': 0
    }

    trials = 1000

    for _ in range(trials):
        turnover_type = select_turnover_type(standard_context, standard_tactics)
        type_counts[turnover_type] += 1

    # Check distribution (allow ±10% variance)
    bad_pass_pct = type_counts['bad_pass'] / trials
    assert 0.30 <= bad_pass_pct <= 0.50, f"Bad pass rate {bad_pass_pct:.2f} outside [0.30, 0.50]"

    lost_ball_pct = type_counts['lost_ball'] / trials
    assert 0.20 <= lost_ball_pct <= 0.40, f"Lost ball rate {lost_ball_pct:.2f} outside [0.20, 0.40]"

    offensive_foul_pct = type_counts['offensive_foul'] / trials
    assert 0.10 <= offensive_foul_pct <= 0.30, f"Offensive foul rate {offensive_foul_pct:.2f} outside [0.10, 0.30]"

    violation_pct = type_counts['violation'] / trials
    assert 0.05 <= violation_pct <= 0.20, f"Violation rate {violation_pct:.2f} outside [0.05, 0.20]"


def test_zone_defense_increases_bad_passes(standard_context):
    """Test zone defense increases bad pass percentage."""
    set_seed(42)

    # Zone defense
    zone_tactics = TacticalSettings(pace='standard', man_defense_pct=0)
    zone_bad_passes = 0

    # Man defense
    man_tactics = TacticalSettings(pace='standard', man_defense_pct=100)
    man_bad_passes = 0

    trials = 500

    for _ in range(trials):
        zone_type = select_turnover_type(standard_context, zone_tactics)
        if zone_type == 'bad_pass':
            zone_bad_passes += 1

        man_type = select_turnover_type(standard_context, man_tactics)
        if man_type == 'bad_pass':
            man_bad_passes += 1

    zone_bad_pass_rate = zone_bad_passes / trials
    man_bad_pass_rate = man_bad_passes / trials

    # Zone should have more bad passes
    assert zone_bad_pass_rate > man_bad_pass_rate, \
        "Zone defense should increase bad pass rate"


# =============================================================================
# TEST: Steal Attribution
# =============================================================================

def test_steal_credit_only_on_live_ball(elite_defender):
    """Test steals only credited on live ball turnovers."""
    assert determine_steal_credit(elite_defender, 'bad_pass') in [True, False]
    assert determine_steal_credit(elite_defender, 'lost_ball') in [True, False]
    assert determine_steal_credit(elite_defender, 'offensive_foul') == False
    assert determine_steal_credit(elite_defender, 'violation') == False


def test_elite_defender_higher_steal_rate(elite_defender, poor_defender):
    """Test elite defender gets more steal credits than poor defender."""
    set_seed(42)

    elite_steals = 0
    poor_steals = 0
    trials = 500

    for _ in range(trials):
        if determine_steal_credit(elite_defender, 'bad_pass'):
            elite_steals += 1

        if determine_steal_credit(poor_defender, 'bad_pass'):
            poor_steals += 1

    elite_rate = elite_steals / trials
    poor_rate = poor_steals / trials

    assert elite_rate > poor_rate, \
        f"Elite defender steal rate {elite_rate:.2f} should be higher than poor {poor_rate:.2f}"


# =============================================================================
# TEST: Transition Triggering
# =============================================================================

def test_transition_trigger_logic():
    """Test which turnover types trigger transition."""
    assert triggers_transition('bad_pass') == True
    assert triggers_transition('lost_ball') == True
    assert triggers_transition('offensive_foul') == True
    assert triggers_transition('violation') == False


# =============================================================================
# TEST: Debug Output
# =============================================================================

def test_debug_output_completeness(
    average_ball_handler,
    standard_tactics,
    standard_context
):
    """Test debug output contains all required fields."""
    occurred, debug = check_turnover(
        average_ball_handler,
        average_ball_handler,
        standard_tactics,
        standard_context
    )

    # Required fields
    required_fields = [
        'ball_handler_name',
        'defender_name',
        'ball_handler_composite',
        'base_turnover_rate',
        'pace_modifier',
        'zone_modifier',
        'transition_modifier',
        'total_modifier',
        'adjusted_turnover_rate',
        'roll_value',
        'turnover_occurred',
        'turnover_type',
        'steal_credited_to',
        'triggers_transition'
    ]

    for field in required_fields:
        assert field in debug, f"Missing debug field: {field}"

    # Validate types
    assert isinstance(debug['ball_handler_composite'], float)
    assert isinstance(debug['adjusted_turnover_rate'], float)
    assert isinstance(debug['turnover_occurred'], bool)

    # Validate ranges
    assert 0.0 <= debug['adjusted_turnover_rate'] <= 1.0


# =============================================================================
# TEST: Edge Cases
# =============================================================================

def test_extreme_composite_no_crash(poor_ball_handler, elite_defender, standard_tactics, standard_context):
    """Test extreme attribute disparities don't crash."""
    # Should not raise exception
    occurred, debug = check_turnover(
        poor_ball_handler,
        elite_defender,
        standard_tactics,
        standard_context
    )

    assert isinstance(occurred, bool)
    assert 0.0 <= debug['adjusted_turnover_rate'] <= 1.0


def test_probability_clamping(elite_ball_handler, poor_defender, standard_tactics, standard_context):
    """Test turnover probability is properly clamped to [0, 1]."""
    occurred, debug = check_turnover(
        elite_ball_handler,
        poor_defender,
        standard_tactics,
        standard_context
    )

    assert 0.0 <= debug['adjusted_turnover_rate'] <= 1.0, \
        f"Turnover rate {debug['adjusted_turnover_rate']} outside [0, 1]"


# =============================================================================
# TEST: Play-by-Play Descriptions
# =============================================================================

def test_turnover_descriptions():
    """Test human-readable descriptions are generated correctly."""
    desc1 = get_turnover_description('bad_pass', 'John Doe', 'Jane Smith')
    assert 'John Doe' in desc1
    assert 'Jane Smith' in desc1
    assert 'Steal' in desc1

    desc2 = get_turnover_description('violation', 'John Doe', None)
    assert 'John Doe' in desc2
    assert 'violation' in desc2

    desc3 = get_turnover_description('offensive_foul', 'Player A', None)
    assert 'Player A' in desc3
    assert 'foul' in desc3
