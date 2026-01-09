"""
Unit tests for Possession State Machine

Tests all state transitions and timeout/substitution legality checks.

Coverage:
- State initialization
- All state transitions (made basket, rebound, turnover, foul, FT, timeout)
- Timeout legality (live vs dead ball)
- Substitution legality (all scenarios)
- Edge cases and validation

Author: Architecture & Integration Lead
Date: 2025-11-06
"""

import pytest
from src.systems.possession_state import PossessionState, BallState, DeadBallReason


# =============================================================================
# INITIALIZATION TESTS
# =============================================================================

def test_initialization_home():
    """Test state machine initializes correctly with home possession."""
    state = PossessionState('home')
    assert state.current_possession_team == 'home'
    assert state.ball_state == BallState.LIVE
    assert state.dead_ball_reason == DeadBallReason.NONE


def test_initialization_away():
    """Test state machine initializes correctly with away possession."""
    state = PossessionState('away')
    assert state.current_possession_team == 'away'
    assert state.ball_state == BallState.LIVE
    assert state.dead_ball_reason == DeadBallReason.NONE


def test_initialization_invalid_team():
    """Test initialization rejects invalid team names."""
    with pytest.raises(ValueError, match="starting_team must be 'home' or 'away'"):
        PossessionState('invalid')


# =============================================================================
# MADE BASKET TESTS
# =============================================================================

def test_made_basket_home_scores():
    """Test state after home team scores."""
    state = PossessionState('home')
    state.update_after_made_basket('home')

    assert state.current_possession_team == 'away'  # Possession switches
    assert state.ball_state == BallState.DEAD
    assert state.dead_ball_reason == DeadBallReason.MADE_BASKET

    # Both teams can call timeout (dead ball)
    assert state.can_call_timeout('home') == True
    assert state.can_call_timeout('away') == True

    # No substitutions (made basket is NOT a sub opportunity)
    assert state.can_substitute() == False


def test_made_basket_away_scores():
    """Test state after away team scores."""
    state = PossessionState('away')
    state.update_after_made_basket('away')

    assert state.current_possession_team == 'home'  # Possession switches
    assert state.ball_state == BallState.DEAD
    assert state.dead_ball_reason == DeadBallReason.MADE_BASKET


# =============================================================================
# DEFENSIVE REBOUND TESTS
# =============================================================================

def test_defensive_rebound():
    """Test state after defensive rebound."""
    state = PossessionState('home')
    state.update_after_defensive_rebound('away')

    assert state.current_possession_team == 'away'  # Possession switches
    assert state.ball_state == BallState.LIVE
    assert state.dead_ball_reason == DeadBallReason.NONE

    # Only team with ball can timeout (live ball)
    assert state.can_call_timeout('home') == False  # Don't have ball
    assert state.can_call_timeout('away') == True   # Have ball

    # No substitutions (live play)
    assert state.can_substitute() == False


def test_defensive_rebound_home():
    """Test state after home team gets defensive rebound."""
    state = PossessionState('away')
    state.update_after_defensive_rebound('home')

    assert state.current_possession_team == 'home'
    assert state.ball_state == BallState.LIVE
    assert state.can_call_timeout('home') == True
    assert state.can_call_timeout('away') == False


# =============================================================================
# OFFENSIVE REBOUND TESTS
# =============================================================================

def test_offensive_rebound():
    """Test state after offensive rebound (possession continues)."""
    state = PossessionState('home')
    state.update_after_offensive_rebound('home')

    assert state.current_possession_team == 'home'  # Same team
    assert state.ball_state == BallState.LIVE
    assert state.dead_ball_reason == DeadBallReason.NONE

    # Only team with ball can timeout
    assert state.can_call_timeout('home') == True   # Have ball
    assert state.can_call_timeout('away') == False  # Don't have ball

    # No substitutions (live play)
    assert state.can_substitute() == False


# =============================================================================
# TURNOVER TESTS
# =============================================================================

def test_turnover_home_to_away():
    """Test state after home team turns ball over to away."""
    state = PossessionState('home')
    state.update_after_turnover('away')

    assert state.current_possession_team == 'away'  # Possession switches
    assert state.ball_state == BallState.DEAD  # Treated as violation
    assert state.dead_ball_reason == DeadBallReason.VIOLATION

    # Both teams can timeout (dead ball)
    assert state.can_call_timeout('home') == True
    assert state.can_call_timeout('away') == True

    # Substitutions allowed (violation)
    assert state.can_substitute() == True


def test_turnover_away_to_home():
    """Test state after away team turns ball over to home."""
    state = PossessionState('away')
    state.update_after_turnover('home')

    assert state.current_possession_team == 'home'
    assert state.ball_state == BallState.DEAD
    assert state.can_call_timeout('home') == True
    assert state.can_call_timeout('away') == True


# =============================================================================
# FOUL TESTS
# =============================================================================

def test_foul():
    """Test state after foul (whistle blown)."""
    state = PossessionState('home')
    state.update_after_foul('home')

    assert state.current_possession_team == 'home'
    assert state.ball_state == BallState.DEAD
    assert state.dead_ball_reason == DeadBallReason.FOUL

    # Both teams can timeout (dead ball)
    assert state.can_call_timeout('home') == True
    assert state.can_call_timeout('away') == True

    # Substitutions allowed (before FTs)
    assert state.can_substitute() == True


# =============================================================================
# FREE THROW TESTS
# =============================================================================

def test_made_free_throw():
    """Test state after made final free throw."""
    state = PossessionState('home')
    state.update_after_made_ft('home')

    assert state.current_possession_team == 'away'  # Possession switches
    assert state.ball_state == BallState.DEAD
    assert state.dead_ball_reason == DeadBallReason.MADE_FREE_THROW

    # Both teams can timeout (dead ball)
    assert state.can_call_timeout('home') == True
    assert state.can_call_timeout('away') == True

    # NO substitutions (treat like made basket)
    assert state.can_substitute() == False


def test_missed_final_ft():
    """Test state after missed final free throw."""
    state = PossessionState('home')
    state.update_after_missed_ft()

    # Possession NOT updated yet (rebound will determine)
    assert state.current_possession_team == 'home'  # Unchanged
    assert state.ball_state == BallState.DEAD
    assert state.dead_ball_reason == DeadBallReason.MISSED_FINAL_FT

    # Both teams can timeout (dead ball)
    assert state.can_call_timeout('home') == True
    assert state.can_call_timeout('away') == True

    # Substitutions allowed (dead ball rebound opportunity)
    assert state.can_substitute() == True


def test_missed_ft_then_rebound():
    """Test complete flow: missed FT → defensive rebound."""
    state = PossessionState('home')

    # FT missed
    state.update_after_missed_ft()
    assert state.can_substitute() == True

    # Away team gets defensive rebound
    state.update_after_defensive_rebound('away')
    assert state.current_possession_team == 'away'
    assert state.ball_state == BallState.LIVE
    assert state.can_substitute() == False


# =============================================================================
# VIOLATION TESTS
# =============================================================================

def test_violation():
    """Test state after violation (out of bounds, travel, etc.)."""
    state = PossessionState('home')
    state.update_after_violation('away')

    assert state.current_possession_team == 'away'  # Possession switches
    assert state.ball_state == BallState.DEAD
    assert state.dead_ball_reason == DeadBallReason.VIOLATION

    # Both teams can timeout
    assert state.can_call_timeout('home') == True
    assert state.can_call_timeout('away') == True

    # Substitutions allowed
    assert state.can_substitute() == True


# =============================================================================
# TIMEOUT TESTS
# =============================================================================

def test_timeout():
    """Test state after timeout called."""
    state = PossessionState('home')
    state.update_after_timeout()

    assert state.current_possession_team == 'home'  # No change
    assert state.ball_state == BallState.DEAD
    assert state.dead_ball_reason == DeadBallReason.TIMEOUT

    # Both teams can timeout (though you wouldn't call 2 in a row)
    assert state.can_call_timeout('home') == True
    assert state.can_call_timeout('away') == True

    # Substitutions allowed (timeout creates sub window)
    assert state.can_substitute() == True


# =============================================================================
# POSSESSION RESUMPTION TESTS
# =============================================================================

def test_start_new_possession():
    """Test resuming play after dead ball."""
    state = PossessionState('home')
    state.update_after_made_basket('home')  # Dead ball

    # Resume play
    state.start_new_possession()

    assert state.ball_state == BallState.LIVE
    assert state.dead_ball_reason == DeadBallReason.NONE
    assert state.can_substitute() == False


# =============================================================================
# QUARTER END TESTS
# =============================================================================

def test_end_quarter():
    """Test state at quarter end."""
    state = PossessionState('home')
    state.end_quarter()

    assert state.ball_state == BallState.DEAD
    assert state.dead_ball_reason == DeadBallReason.QUARTER_END

    # Both teams can timeout (though unlikely between quarters)
    assert state.can_call_timeout('home') == True
    assert state.can_call_timeout('away') == True

    # Substitutions allowed (quarter break)
    assert state.can_substitute() == True


# =============================================================================
# TIMEOUT LEGALITY TESTS (COMPREHENSIVE)
# =============================================================================

def test_timeout_legality_live_ball_with_possession():
    """Team with ball can call timeout during live play."""
    state = PossessionState('home')
    state.update_after_defensive_rebound('home')  # Live ball, home has possession

    assert state.can_call_timeout('home') == True
    assert state.can_call_timeout('away') == False


def test_timeout_legality_live_ball_without_possession():
    """Team without ball CANNOT call timeout during live play."""
    state = PossessionState('home')
    state.update_after_offensive_rebound('home')  # Live ball, home has possession

    assert state.can_call_timeout('home') == True
    assert state.can_call_timeout('away') == False


def test_timeout_legality_dead_ball_both_teams():
    """Both teams can call timeout during any dead ball."""
    state = PossessionState('home')

    # Test all dead ball scenarios
    dead_ball_scenarios = [
        lambda s: s.update_after_made_basket('home'),
        lambda s: s.update_after_foul('home'),
        lambda s: s.update_after_violation('away'),
        lambda s: s.update_after_timeout(),
        lambda s: s.update_after_made_ft('home'),
        lambda s: s.update_after_missed_ft(),
        lambda s: s.end_quarter(),
    ]

    for scenario in dead_ball_scenarios:
        state = PossessionState('home')
        scenario(state)
        assert state.can_call_timeout('home') == True, f"Failed for: {state.dead_ball_reason}"
        assert state.can_call_timeout('away') == True, f"Failed for: {state.dead_ball_reason}"


# =============================================================================
# SUBSTITUTION LEGALITY TESTS (COMPREHENSIVE)
# =============================================================================

def test_substitution_legal_scenarios():
    """Test all legal substitution scenarios."""
    legal_scenarios = [
        ('foul', lambda s: s.update_after_foul('home')),
        ('timeout', lambda s: s.update_after_timeout()),
        ('violation', lambda s: s.update_after_violation('away')),
        ('missed_ft', lambda s: s.update_after_missed_ft()),
        ('quarter_end', lambda s: s.end_quarter()),
    ]

    for name, scenario in legal_scenarios:
        state = PossessionState('home')
        scenario(state)
        assert state.can_substitute() == True, f"Should allow subs after {name}"


def test_substitution_illegal_scenarios():
    """Test all illegal substitution scenarios."""
    illegal_scenarios = [
        ('made_basket', lambda s: s.update_after_made_basket('home')),
        ('made_ft', lambda s: s.update_after_made_ft('home')),
        ('live_ball_oreb', lambda s: s.update_after_offensive_rebound('home')),
        ('live_ball_dreb', lambda s: s.update_after_defensive_rebound('away')),
    ]

    for name, scenario in illegal_scenarios:
        state = PossessionState('home')
        scenario(state)
        assert state.can_substitute() == False, f"Should NOT allow subs after {name}"


# =============================================================================
# COMPLEX FLOW TESTS
# =============================================================================

def test_complete_possession_flow_made_basket():
    """Test complete flow: possession → made basket → inbound → live."""
    state = PossessionState('home')

    # Initial live ball
    assert state.ball_state == BallState.LIVE
    assert state.can_substitute() == False

    # Home scores
    state.update_after_made_basket('home')
    assert state.current_possession_team == 'away'
    assert state.ball_state == BallState.DEAD
    assert state.can_substitute() == False  # Made basket ≠ sub opportunity

    # Away inbounds, play resumes
    state.start_new_possession()
    assert state.ball_state == BallState.LIVE
    assert state.can_substitute() == False


def test_complete_possession_flow_foul_sequence():
    """Test complete flow: foul → subs → FTs → made FT → inbound."""
    state = PossessionState('home')

    # Home shooting, away fouls
    state.update_after_foul('home')
    assert state.can_substitute() == True  # Subs allowed before FTs
    assert state.can_call_timeout('home') == True
    assert state.can_call_timeout('away') == True

    # FTs made
    state.update_after_made_ft('home')
    assert state.current_possession_team == 'away'
    assert state.can_substitute() == False  # Like made basket


def test_complete_possession_flow_turnover():
    """Test complete flow: turnover → live ball → timeout."""
    state = PossessionState('home')

    # Home turns it over
    state.update_after_turnover('away')
    assert state.current_possession_team == 'away'
    assert state.ball_state == BallState.DEAD
    assert state.can_call_timeout('away') == True  # Team with ball
    assert state.can_call_timeout('home') == True  # Dead ball, both can timeout

    # Away calls timeout
    state.update_after_timeout()
    assert state.can_substitute() == True

    # Resume play
    state.start_new_possession()
    assert state.ball_state == BallState.LIVE
    assert state.can_call_timeout('away') == True  # Has ball
    assert state.can_call_timeout('home') == False  # Doesn't have ball


# =============================================================================
# EDGE CASES & VALIDATION
# =============================================================================

def test_invalid_team_names():
    """Test all methods reject invalid team names."""
    state = PossessionState('home')

    with pytest.raises(ValueError):
        state.can_call_timeout('invalid')

    with pytest.raises(ValueError):
        state.update_after_made_basket('invalid')

    with pytest.raises(ValueError):
        state.update_after_defensive_rebound('invalid')

    with pytest.raises(ValueError):
        state.update_after_offensive_rebound('AWAY')  # Case sensitive


def test_get_state_summary():
    """Test state summary for debugging."""
    state = PossessionState('home')
    state.update_after_foul('home')

    summary = state.get_state_summary()

    assert summary['possession_team'] == 'home'
    assert summary['ball_state'] == 'DEAD'
    assert summary['dead_ball_reason'] == 'foul'
    assert summary['can_timeout_home'] == True
    assert summary['can_timeout_away'] == True
    assert summary['can_substitute'] == True


def test_repr():
    """Test string representation."""
    state = PossessionState('home')
    repr_str = repr(state)

    assert 'possession=home' in repr_str
    assert 'ball=LIVE' in repr_str


# =============================================================================
# REGRESSION TESTS (BASED ON KNOWN BUGS)
# =============================================================================

def test_regression_timeout_after_turnover():
    """
    REGRESSION TEST: Team that LOST ball should NOT be able to call timeout
    during live ball steal.

    Bug: After turnover, losing team tried to call timeout (they don't have ball).
    Fix: Turnovers treated as violations (dead ball), so both can timeout.
    """
    state = PossessionState('home')
    state.update_after_turnover('away')

    # After turnover (violation), it's a dead ball
    assert state.ball_state == BallState.DEAD
    # Both teams can timeout during dead ball
    assert state.can_call_timeout('home') == True
    assert state.can_call_timeout('away') == True


def test_regression_subs_after_made_basket():
    """
    REGRESSION TEST: Substitutions should NOT be allowed after made basket
    (unless timeout is called).

    Bug: Subs were occurring after made baskets.
    Fix: Made basket is NOT a legal sub opportunity.
    """
    state = PossessionState('home')
    state.update_after_made_basket('home')

    assert state.can_substitute() == False


def test_regression_timeout_after_defensive_rebound():
    """
    REGRESSION TEST: After defensive rebound, only rebounding team can timeout
    (live ball).

    Bug: Both teams could call timeout after defensive rebound.
    Fix: Live ball, only team with possession can timeout.
    """
    state = PossessionState('home')
    state.update_after_defensive_rebound('away')

    assert state.can_call_timeout('away') == True  # Has ball
    assert state.can_call_timeout('home') == False  # Doesn't have ball
