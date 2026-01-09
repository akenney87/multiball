"""
Unit Tests for Simulation Engine

Validates:
- Input validation (teams, tactical settings, possession context)
- Seed reproducibility
- Error handling and clear error messages
- Output formatting (standard, compact, JSON, debug)
- simulate_single_possession() main API
- simulate_multiple_possessions() batch API
"""

import pytest
import random
from src.simulation import (
    validate_simulation_inputs,
    simulate_single_possession,
    simulate_multiple_possessions,
    format_possession_output,
)
from src.core.data_structures import (
    PossessionContext,
    TacticalSettings,
    PossessionResult,
)
from src.constants import ALL_ATTRIBUTES


# =============================================================================
# TEST FIXTURES
# =============================================================================

@pytest.fixture
def valid_player():
    """Create a valid player with all attributes."""
    player = {
        'name': 'Test Player',
        'position': 'PG',
    }
    for attr in ALL_ATTRIBUTES:
        player[attr] = 50
    return player


@pytest.fixture
def valid_team(valid_player):
    """Create a valid 5-player team."""
    positions = ['PG', 'SG', 'SF', 'PF', 'C']
    team = []
    for i, pos in enumerate(positions):
        player = valid_player.copy()
        player['name'] = f'Player {i+1}'
        player['position'] = pos
        team.append(player)
    return team


@pytest.fixture
def elite_team():
    """Create an elite team (all 90 attributes)."""
    positions = ['PG', 'SG', 'SF', 'PF', 'C']
    team = []
    for i, pos in enumerate(positions):
        player = {'name': f'Elite_{i+1}', 'position': pos}
        for attr in ALL_ATTRIBUTES:
            player[attr] = 90
        team.append(player)
    return team


@pytest.fixture
def poor_team():
    """Create a poor team (all 30 attributes)."""
    positions = ['PG', 'SG', 'SF', 'PF', 'C']
    team = []
    for i, pos in enumerate(positions):
        player = {'name': f'Poor_{i+1}', 'position': pos}
        for attr in ALL_ATTRIBUTES:
            player[attr] = 30
        team.append(player)
    return team


@pytest.fixture
def default_tactics():
    """Default tactical settings."""
    return TacticalSettings()


@pytest.fixture
def default_context():
    """Default possession context."""
    return PossessionContext()


# =============================================================================
# INPUT VALIDATION TESTS
# =============================================================================

class TestInputValidation:
    """Test comprehensive input validation."""

    def test_validate_valid_inputs(self, valid_team, default_tactics, default_context):
        """Valid inputs should pass validation."""
        # Should not raise any exceptions
        validate_simulation_inputs(
            offensive_team=valid_team,
            defensive_team=valid_team,
            tactical_settings_offense=default_tactics,
            tactical_settings_defense=default_tactics,
            possession_context=default_context
        )

    def test_validate_wrong_type_offensive_team(self, valid_team, default_tactics, default_context):
        """Offensive team wrong type should raise TypeError."""
        with pytest.raises(TypeError, match="offensive_team must be list"):
            validate_simulation_inputs(
                offensive_team="not a list",
                defensive_team=valid_team,
                tactical_settings_offense=default_tactics,
                tactical_settings_defense=default_tactics,
                possession_context=default_context
            )

    def test_validate_wrong_type_defensive_team(self, valid_team, default_tactics, default_context):
        """Defensive team wrong type should raise TypeError."""
        with pytest.raises(TypeError, match="defensive_team must be list"):
            validate_simulation_inputs(
                offensive_team=valid_team,
                defensive_team=None,
                tactical_settings_offense=default_tactics,
                tactical_settings_defense=default_tactics,
                possession_context=default_context
            )

    def test_validate_wrong_type_tactical_settings(self, valid_team, default_context):
        """Tactical settings wrong type should raise TypeError."""
        with pytest.raises(TypeError, match="tactical_settings_offense must be TacticalSettings"):
            validate_simulation_inputs(
                offensive_team=valid_team,
                defensive_team=valid_team,
                tactical_settings_offense={'pace': 'fast'},  # Dict instead of TacticalSettings
                tactical_settings_defense=TacticalSettings(),
                possession_context=default_context
            )

    def test_validate_wrong_type_possession_context(self, valid_team, default_tactics):
        """Possession context wrong type should raise TypeError."""
        with pytest.raises(TypeError, match="possession_context must be PossessionContext"):
            validate_simulation_inputs(
                offensive_team=valid_team,
                defensive_team=valid_team,
                tactical_settings_offense=default_tactics,
                tactical_settings_defense=default_tactics,
                possession_context={'is_transition': False}  # Dict instead
            )

    def test_validate_team_wrong_size(self, valid_team, default_tactics, default_context):
        """Team with wrong number of players should fail."""
        # Only 4 players
        small_team = valid_team[:4]

        with pytest.raises(ValueError, match="must have exactly 5 players"):
            validate_simulation_inputs(
                offensive_team=small_team,
                defensive_team=valid_team,
                tactical_settings_offense=default_tactics,
                tactical_settings_defense=default_tactics,
                possession_context=default_context
            )

    def test_validate_invalid_tactical_pace(self, valid_team, default_context):
        """Invalid tactical pace should fail."""
        bad_tactics = TacticalSettings(pace='ultra_fast')

        with pytest.raises(ValueError, match="Invalid pace"):
            validate_simulation_inputs(
                offensive_team=valid_team,
                defensive_team=valid_team,
                tactical_settings_offense=bad_tactics,
                tactical_settings_defense=TacticalSettings(),
                possession_context=default_context
            )

    def test_validate_invalid_shot_clock(self, valid_team, default_tactics):
        """Invalid shot clock should fail."""
        bad_context = PossessionContext(shot_clock=20)  # Only 14 or 24 allowed

        with pytest.raises(ValueError, match="shot_clock must be 14 or 24"):
            validate_simulation_inputs(
                offensive_team=valid_team,
                defensive_team=valid_team,
                tactical_settings_offense=default_tactics,
                tactical_settings_defense=default_tactics,
                possession_context=bad_context
            )


# =============================================================================
# SIMULATE SINGLE POSSESSION TESTS
# =============================================================================

class TestSimulateSinglePossession:
    """Test main simulation API."""

    def test_simulate_returns_possession_result(self, valid_team):
        """Simulation should return PossessionResult."""
        result = simulate_single_possession(
            offensive_team=valid_team,
            defensive_team=valid_team,
            seed=42
        )

        assert isinstance(result, PossessionResult)

    def test_simulate_possession_outcome(self, valid_team):
        """Possession outcome should be one of the valid types."""
        result = simulate_single_possession(
            offensive_team=valid_team,
            defensive_team=valid_team,
            seed=42
        )

        assert result.possession_outcome in ['made_shot', 'missed_shot', 'turnover']

    def test_simulate_made_shot_has_scorer(self, elite_team, poor_team):
        """Made shots should have scoring_player."""
        # Run until we get a made shot
        for seed in range(100):
            result = simulate_single_possession(
                offensive_team=elite_team,
                defensive_team=poor_team,
                seed=seed
            )

            if result.possession_outcome == 'made_shot':
                assert result.scoring_player is not None
                assert result.points_scored > 0
                break
        else:
            pytest.fail("No made shots in 100 attempts")

    def test_simulate_missed_shot_has_rebounder(self, valid_team):
        """Missed shots should have rebound_player."""
        # Run until we get a missed shot
        for seed in range(100):
            result = simulate_single_possession(
                offensive_team=valid_team,
                defensive_team=valid_team,
                seed=seed
            )

            if result.possession_outcome == 'missed_shot':
                assert result.rebound_player is not None
                assert result.points_scored == 0
                break
        else:
            pytest.fail("No missed shots in 100 attempts")

    def test_simulate_turnover_has_no_points(self, valid_team):
        """Turnovers should score 0 points."""
        # Run until we get a turnover
        for seed in range(200):
            result = simulate_single_possession(
                offensive_team=valid_team,
                defensive_team=valid_team,
                seed=seed
            )

            if result.possession_outcome == 'turnover':
                assert result.points_scored == 0
                break
        else:
            pytest.skip("No turnovers found in 200 attempts")

    def test_simulate_with_defaults(self, valid_team):
        """Simulation with default parameters should work."""
        result = simulate_single_possession(
            offensive_team=valid_team,
            defensive_team=valid_team
        )

        assert isinstance(result, PossessionResult)

    def test_simulate_with_custom_tactics(self, valid_team):
        """Simulation with custom tactics should work."""
        tactics = TacticalSettings(
            pace='fast',
            man_defense_pct=75,
            rebounding_strategy='crash_glass'
        )

        result = simulate_single_possession(
            offensive_team=valid_team,
            defensive_team=valid_team,
            tactical_settings_offense=tactics,
            seed=42
        )

        assert isinstance(result, PossessionResult)

    def test_simulate_with_transition(self, elite_team, poor_team):
        """Transition possession should work."""
        context = PossessionContext(is_transition=True)

        result = simulate_single_possession(
            offensive_team=elite_team,
            defensive_team=poor_team,
            possession_context=context,
            seed=42
        )

        assert isinstance(result, PossessionResult)
        # Transition should be reflected in debug
        assert result.debug['possession_context']['is_transition'] is True

    def test_simulate_validation_can_be_skipped(self, valid_team):
        """Validation can be disabled for performance."""
        result = simulate_single_possession(
            offensive_team=valid_team,
            defensive_team=valid_team,
            validate_inputs=False,
            seed=42
        )

        assert isinstance(result, PossessionResult)

    def test_simulate_invalid_inputs_with_validation(self, valid_team):
        """Invalid inputs with validation=True should raise error."""
        bad_team = valid_team[:4]  # Only 4 players

        with pytest.raises(ValueError, match="Input validation failed"):
            simulate_single_possession(
                offensive_team=bad_team,
                defensive_team=valid_team,
                validate_inputs=True
            )


# =============================================================================
# SEED REPRODUCIBILITY TESTS
# =============================================================================

class TestSeedReproducibility:
    """Test random seed control."""

    def test_same_seed_same_result(self, valid_team):
        """Same seed should give identical results."""
        result1 = simulate_single_possession(
            offensive_team=valid_team,
            defensive_team=valid_team,
            seed=42
        )

        result2 = simulate_single_possession(
            offensive_team=valid_team,
            defensive_team=valid_team,
            seed=42
        )

        # Outcomes should be identical
        assert result1.possession_outcome == result2.possession_outcome
        assert result1.points_scored == result2.points_scored
        assert result1.scoring_player == result2.scoring_player

    def test_different_seeds_different_results(self, valid_team):
        """Different seeds should give different results (probabilistic)."""
        results = []

        for seed in range(10):
            result = simulate_single_possession(
                offensive_team=valid_team,
                defensive_team=valid_team,
                seed=seed
            )
            results.append(result.possession_outcome)

        # Should have some variation (not all identical)
        unique_outcomes = set(results)
        assert len(unique_outcomes) > 1

    def test_no_seed_gives_random_results(self, valid_team):
        """No seed should give random results."""
        result1 = simulate_single_possession(
            offensive_team=valid_team,
            defensive_team=valid_team,
            seed=None
        )

        result2 = simulate_single_possession(
            offensive_team=valid_team,
            defensive_team=valid_team,
            seed=None
        )

        # Can't guarantee different, but debug info should differ
        # (e.g., roll values, contest distances)
        # Just verify both succeeded
        assert isinstance(result1, PossessionResult)
        assert isinstance(result2, PossessionResult)


# =============================================================================
# OUTPUT FORMATTING TESTS
# =============================================================================

class TestOutputFormatting:
    """Test output formatting options."""

    def test_format_standard_mode(self, valid_team):
        """Standard format should be human-readable."""
        result = simulate_single_possession(
            offensive_team=valid_team,
            defensive_team=valid_team,
            seed=42
        )

        output = format_possession_output(result, include_debug=False, compact=False)

        assert isinstance(output, str)
        assert "POSSESSION START" in output
        assert "POSSESSION END" in output
        assert result.possession_outcome in output

    def test_format_compact_mode_made_shot(self, elite_team, poor_team):
        """Compact format should be single line."""
        # Find a made shot
        for seed in range(100):
            result = simulate_single_possession(
                offensive_team=elite_team,
                defensive_team=poor_team,
                seed=seed
            )

            if result.possession_outcome == 'made_shot':
                output = format_possession_output(result, compact=True)

                assert isinstance(output, str)
                assert '\n' not in output or output.count('\n') <= 1
                assert "MADE:" in output
                assert result.scoring_player in output
                break
        else:
            pytest.skip("No made shots found")

    def test_format_compact_mode_miss(self, valid_team):
        """Compact format for miss should show MISS."""
        for seed in range(100):
            result = simulate_single_possession(
                offensive_team=valid_team,
                defensive_team=valid_team,
                seed=seed
            )

            if result.possession_outcome == 'missed_shot':
                output = format_possession_output(result, compact=True)

                assert "MISS:" in output
                break

    def test_format_compact_mode_turnover(self, valid_team):
        """Compact format for turnover should show TURNOVER."""
        for seed in range(200):
            result = simulate_single_possession(
                offensive_team=valid_team,
                defensive_team=valid_team,
                seed=seed
            )

            if result.possession_outcome == 'turnover':
                output = format_possession_output(result, compact=True)

                assert "TURNOVER:" in output
                break

    def test_format_with_debug(self, valid_team):
        """Debug mode should include debug information."""
        result = simulate_single_possession(
            offensive_team=valid_team,
            defensive_team=valid_team,
            seed=42
        )

        output = format_possession_output(result, include_debug=True)

        assert "DEBUG INFORMATION" in output
        # Should contain debug fields
        assert len(output) > len(format_possession_output(result, include_debug=False))


# =============================================================================
# BATCH SIMULATION TESTS
# =============================================================================

class TestSimulateMultiplePossessions:
    """Test batch simulation API."""

    def test_simulate_multiple_returns_list(self, valid_team):
        """Multiple possessions should return list of results."""
        results = simulate_multiple_possessions(
            offensive_team=valid_team,
            defensive_team=valid_team,
            num_possessions=10,
            seed=42
        )

        assert isinstance(results, list)
        assert len(results) == 10
        assert all(isinstance(r, PossessionResult) for r in results)

    def test_simulate_multiple_different_outcomes(self, valid_team):
        """Multiple possessions should have variety of outcomes."""
        results = simulate_multiple_possessions(
            offensive_team=valid_team,
            defensive_team=valid_team,
            num_possessions=50,
            seed=42
        )

        outcomes = [r.possession_outcome for r in results]
        unique_outcomes = set(outcomes)

        # Should have at least 2 different outcomes
        assert len(unique_outcomes) >= 2

    def test_simulate_multiple_seed_reproducibility(self, valid_team):
        """Same seed should give identical sequence."""
        results1 = simulate_multiple_possessions(
            offensive_team=valid_team,
            defensive_team=valid_team,
            num_possessions=5,
            seed=100
        )

        results2 = simulate_multiple_possessions(
            offensive_team=valid_team,
            defensive_team=valid_team,
            num_possessions=5,
            seed=100
        )

        for r1, r2 in zip(results1, results2):
            assert r1.possession_outcome == r2.possession_outcome
            assert r1.points_scored == r2.points_scored

    def test_simulate_multiple_validation_once(self, valid_team):
        """Validation should only happen on first possession."""
        # This is implicitly tested - just verify it runs
        results = simulate_multiple_possessions(
            offensive_team=valid_team,
            defensive_team=valid_team,
            num_possessions=20,
            seed=42
        )

        assert len(results) == 20


# =============================================================================
# ERROR HANDLING TESTS
# =============================================================================

class TestErrorHandling:
    """Test comprehensive error handling."""

    def test_error_message_for_invalid_team(self):
        """Error message should be clear for invalid team."""
        bad_team = [{'name': 'Incomplete'}]  # Missing attributes

        with pytest.raises(ValueError) as exc_info:
            simulate_single_possession(
                offensive_team=bad_team,
                defensive_team=bad_team,
                validate_inputs=True
            )

        error_msg = str(exc_info.value)
        assert "Input validation failed" in error_msg

    def test_error_provides_context(self):
        """Errors should provide helpful context."""
        bad_team = []  # Empty team

        with pytest.raises(ValueError) as exc_info:
            simulate_single_possession(
                offensive_team=bad_team,
                defensive_team=bad_team,
                validate_inputs=True
            )

        error_msg = str(exc_info.value)
        # Should mention the specific issue
        assert "5 players" in error_msg or "Input validation" in error_msg


# =============================================================================
# INTEGRATION SANITY CHECKS
# =============================================================================

class TestIntegrationSanity:
    """Sanity checks for overall simulation behavior."""

    def test_elite_vs_poor_scores_more(self, elite_team, poor_team):
        """Elite team should score more than poor team."""
        elite_points = 0
        poor_points = 0

        for seed in range(100):
            # Elite offense vs poor defense
            result = simulate_single_possession(
                offensive_team=elite_team,
                defensive_team=poor_team,
                seed=seed
            )
            elite_points += result.points_scored

            # Poor offense vs elite defense
            result = simulate_single_possession(
                offensive_team=poor_team,
                defensive_team=elite_team,
                seed=seed + 1000
            )
            poor_points += result.points_scored

        # Elite should score significantly more
        assert elite_points > poor_points

    def test_no_negative_points(self, valid_team):
        """Points scored should never be negative."""
        for seed in range(100):
            result = simulate_single_possession(
                offensive_team=valid_team,
                defensive_team=valid_team,
                seed=seed
            )

            assert result.points_scored >= 0

    def test_points_are_valid_values(self, valid_team):
        """Points should only be 0, 2, or 3."""
        for seed in range(100):
            result = simulate_single_possession(
                offensive_team=valid_team,
                defensive_team=valid_team,
                seed=seed
            )

            assert result.points_scored in [0, 2, 3]

    def test_debug_info_always_present(self, valid_team):
        """Debug info should always be populated."""
        result = simulate_single_possession(
            offensive_team=valid_team,
            defensive_team=valid_team,
            seed=42
        )

        assert isinstance(result.debug, dict)
        assert len(result.debug) > 0
        assert 'seed' in result.debug


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
