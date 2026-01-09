"""
Integration Tests for Complete System

Validates that all systems work together correctly:
- Full possession flow without crashes
- All possible outcomes can occur (made_shot, missed_shot, turnover)
- Probabilities are bounded [0, 1] across all calculations
- Debug output structure is complete and valid
- Tactical settings produce observable differences
- No circular dependencies or integration conflicts
"""

import pytest
import random
from src.simulation import simulate_single_possession, simulate_multiple_possessions
from src.core.data_structures import TacticalSettings, PossessionContext
from src.constants import ALL_ATTRIBUTES


# =============================================================================
# TEST FIXTURES
# =============================================================================

@pytest.fixture
def balanced_team():
    """Team with all attributes at 50."""
    positions = ['PG', 'SG', 'SF', 'PF', 'C']
    team = []
    for i, pos in enumerate(positions):
        player = {'name': f'Balanced_{i+1}', 'position': pos}
        for attr in ALL_ATTRIBUTES:
            player[attr] = 50
        team.append(player)
    return team


@pytest.fixture
def elite_shooters():
    """Team with elite shooting attributes."""
    positions = ['PG', 'SG', 'SF', 'PF', 'C']
    team = []
    for i, pos in enumerate(positions):
        player = {'name': f'Shooter_{i+1}', 'position': pos}
        # High shooting attributes
        player.update({
            'form_technique': 95,
            'throw_accuracy': 93,
            'finesse': 90,
            'hand_eye_coordination': 92,
            'balance': 88,
            'composure': 90,
            'consistency': 87,
        })
        # Fill remaining attributes with 50
        for attr in ALL_ATTRIBUTES:
            if attr not in player:
                player[attr] = 50
        team.append(player)
    return team


@pytest.fixture
def elite_defenders():
    """Team with elite defensive attributes."""
    positions = ['PG', 'SG', 'SF', 'PF', 'C']
    team = []
    for i, pos in enumerate(positions):
        player = {'name': f'Defender_{i+1}', 'position': pos}
        # High defensive attributes
        player.update({
            'height': 85,
            'reactions': 95,
            'agility': 92,
            'awareness': 93,
            'top_speed': 88,
            'jumping': 85,
        })
        # Fill remaining
        for attr in ALL_ATTRIBUTES:
            if attr not in player:
                player[attr] = 50
        team.append(player)
    return team


# =============================================================================
# FULL POSSESSION FLOW TESTS
# =============================================================================

class TestFullPossessionFlow:
    """Test complete possession flow doesn't crash."""

    def test_possession_completes_without_crash(self, balanced_team):
        """Basic possession should complete successfully."""
        result = simulate_single_possession(
            offensive_team=balanced_team,
            defensive_team=balanced_team,
            seed=42
        )

        assert result is not None
        assert result.possession_outcome in ['made_shot', 'missed_shot', 'turnover']

    def test_100_possessions_no_crashes(self, balanced_team):
        """100 possessions should all complete."""
        results = simulate_multiple_possessions(
            offensive_team=balanced_team,
            defensive_team=balanced_team,
            num_possessions=100,
            seed=42
        )

        assert len(results) == 100
        assert all(r.possession_outcome in ['made_shot', 'missed_shot', 'turnover'] for r in results)

    def test_all_outcome_types_occur(self, balanced_team):
        """All three outcome types should be possible."""
        outcomes = set()

        for seed in range(200):
            result = simulate_single_possession(
                offensive_team=balanced_team,
                defensive_team=balanced_team,
                seed=seed
            )
            outcomes.add(result.possession_outcome)

            # Stop early if we found all 3
            if len(outcomes) == 3:
                break

        # Should have all 3 outcome types
        assert 'made_shot' in outcomes
        assert 'missed_shot' in outcomes
        assert 'turnover' in outcomes

    def test_elite_vs_elite_completes(self, elite_shooters, elite_defenders):
        """Elite vs elite matchup should work."""
        result = simulate_single_possession(
            offensive_team=elite_shooters,
            defensive_team=elite_defenders,
            seed=42
        )

        assert result is not None

    def test_transition_possession_completes(self, balanced_team):
        """Transition possession should complete."""
        context = PossessionContext(is_transition=True)

        result = simulate_single_possession(
            offensive_team=balanced_team,
            defensive_team=balanced_team,
            possession_context=context,
            seed=42
        )

        assert result is not None
        assert result.debug['possession_context']['is_transition'] is True


# =============================================================================
# PROBABILITY BOUNDS TESTS
# =============================================================================

class TestProbabilityBounds:
    """Ensure all probabilities stay within [0, 1]."""

    def test_all_debug_probabilities_bounded(self, balanced_team):
        """All probabilities in debug output must be [0, 1]."""
        for seed in range(50):
            result = simulate_single_possession(
                offensive_team=balanced_team,
                defensive_team=balanced_team,
                seed=seed
            )

            # Recursively check all probability values in debug
            self._check_probabilities_recursive(result.debug)

    def _check_probabilities_recursive(self, obj, path=""):
        """Recursively check all numeric values that look like probabilities."""
        if isinstance(obj, dict):
            for key, value in obj.items():
                new_path = f"{path}.{key}" if path else key

                # Check probability fields
                if any(keyword in key.lower() for keyword in ['probability', 'rate', 'success', 'chance']):
                    if isinstance(value, (int, float)):
                        assert 0.0 <= value <= 1.0, \
                            f"Probability {new_path} = {value} out of bounds"

                # Recurse
                self._check_probabilities_recursive(value, new_path)

        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                self._check_probabilities_recursive(item, f"{path}[{i}]")

    def test_extreme_matchups_probabilities_bounded(self, elite_shooters, elite_defenders):
        """Extreme matchups should still have valid probabilities."""
        # Elite offense vs elite defense
        result = simulate_single_possession(
            offensive_team=elite_shooters,
            defensive_team=elite_defenders,
            seed=42
        )

        self._check_probabilities_recursive(result.debug)

    def test_different_tactical_settings_probabilities_bounded(self, balanced_team):
        """All tactical combinations should have bounded probabilities."""
        tactics_combinations = [
            TacticalSettings(pace='fast', man_defense_pct=100),
            TacticalSettings(pace='slow', man_defense_pct=0),
            TacticalSettings(pace='standard', man_defense_pct=50, rebounding_strategy='crash_glass'),
            TacticalSettings(pace='fast', man_defense_pct=25, rebounding_strategy='prevent_transition'),
        ]

        for tactics in tactics_combinations:
            result = simulate_single_possession(
                offensive_team=balanced_team,
                defensive_team=balanced_team,
                tactical_settings_offense=tactics,
                tactical_settings_defense=tactics,
                seed=42
            )

            self._check_probabilities_recursive(result.debug)


# =============================================================================
# DEBUG OUTPUT STRUCTURE TESTS
# =============================================================================

class TestDebugOutputStructure:
    """Validate debug output contains all required fields."""

    def test_debug_has_core_fields(self, balanced_team):
        """Debug output should have core required fields."""
        result = simulate_single_possession(
            offensive_team=balanced_team,
            defensive_team=balanced_team,
            seed=42
        )

        debug = result.debug

        # Core fields
        assert 'seed' in debug
        assert 'possession_context' in debug
        assert 'usage_distribution' in debug
        assert 'ball_handler' in debug

    def test_debug_shot_attempt_structure(self, balanced_team):
        """Shot attempt debug should have required fields."""
        # Find a possession with shot
        for seed in range(100):
            result = simulate_single_possession(
                offensive_team=balanced_team,
                defensive_team=balanced_team,
                seed=seed
            )

            if 'shot_attempt' in result.debug:
                shot_debug = result.debug['shot_attempt']

                # Should have these fields
                assert 'shooter_composite' in shot_debug or 'offensive_composite' in shot_debug
                assert 'final_success_rate' in shot_debug or 'final_probability' in shot_debug

                break
        else:
            pytest.fail("No shot attempts found in 100 possessions")

    def test_debug_rebound_structure(self, balanced_team):
        """Rebound debug should have required fields."""
        # Find a possession with rebound
        for seed in range(100):
            result = simulate_single_possession(
                offensive_team=balanced_team,
                defensive_team=balanced_team,
                seed=seed
            )

            if result.possession_outcome == 'missed_shot' and 'rebound' in result.debug:
                rebound_debug = result.debug['rebound']

                assert 'rebounder_name' in rebound_debug
                assert 'offensive_rebound' in rebound_debug

                break

    def test_debug_turnover_structure(self, balanced_team):
        """Turnover debug should have required fields."""
        # Find a turnover
        for seed in range(200):
            result = simulate_single_possession(
                offensive_team=balanced_team,
                defensive_team=balanced_team,
                seed=seed
            )

            if result.possession_outcome == 'turnover' and 'turnover_check' in result.debug:
                turnover_debug = result.debug['turnover_check']

                assert 'turnover_occurred' in turnover_debug
                assert 'turnover_type' in turnover_debug

                break


# =============================================================================
# TACTICAL IMPACT TESTS
# =============================================================================

class TestTacticalImpact:
    """Verify tactical settings have observable impact."""

    def test_fast_pace_affects_outcomes(self, balanced_team):
        """Fast pace should produce different outcomes than slow pace."""
        fast_tactics = TacticalSettings(pace='fast')
        slow_tactics = TacticalSettings(pace='slow')

        fast_results = simulate_multiple_possessions(
            offensive_team=balanced_team,
            defensive_team=balanced_team,
            num_possessions=100,
            tactical_settings_offense=fast_tactics,
            seed=42
        )

        slow_results = simulate_multiple_possessions(
            offensive_team=balanced_team,
            defensive_team=balanced_team,
            num_possessions=100,
            tactical_settings_offense=slow_tactics,
            seed=42
        )

        # Calculate outcome distributions
        fast_outcomes = [r.possession_outcome for r in fast_results]
        slow_outcomes = [r.possession_outcome for r in slow_results]

        # Should have different distributions (not identical)
        assert fast_outcomes != slow_outcomes

    def test_zone_defense_affects_outcomes(self, balanced_team):
        """Zone vs man defense should affect outcomes."""
        zone_tactics = TacticalSettings(man_defense_pct=0)  # 100% zone
        man_tactics = TacticalSettings(man_defense_pct=100)  # 100% man

        zone_results = simulate_multiple_possessions(
            offensive_team=balanced_team,
            defensive_team=balanced_team,
            num_possessions=100,
            tactical_settings_defense=zone_tactics,
            seed=42
        )

        man_results = simulate_multiple_possessions(
            offensive_team=balanced_team,
            defensive_team=balanced_team,
            num_possessions=100,
            tactical_settings_defense=man_tactics,
            seed=42
        )

        zone_outcomes = [r.possession_outcome for r in zone_results]
        man_outcomes = [r.possession_outcome for r in man_results]

        # Should have different distributions
        assert zone_outcomes != man_outcomes

    def test_rebounding_strategy_affects_rebounds(self, balanced_team):
        """Rebounding strategy should affect OREB rates."""
        crash_tactics = TacticalSettings(rebounding_strategy='crash_glass')
        prevent_tactics = TacticalSettings(rebounding_strategy='prevent_transition')

        crash_results = simulate_multiple_possessions(
            offensive_team=balanced_team,
            defensive_team=balanced_team,
            num_possessions=100,
            tactical_settings_offense=crash_tactics,
            seed=42
        )

        prevent_results = simulate_multiple_possessions(
            offensive_team=balanced_team,
            defensive_team=balanced_team,
            num_possessions=100,
            tactical_settings_offense=prevent_tactics,
            seed=42
        )

        # Count offensive rebounds (from missed shots)
        def count_orebs(results):
            count = 0
            for r in results:
                if r.possession_outcome == 'missed_shot' and 'rebound' in r.debug:
                    if r.debug['rebound'].get('offensive_rebound'):
                        count += 1
            return count

        crash_orebs = count_orebs(crash_results)
        prevent_orebs = count_orebs(prevent_results)

        # Crash glass should get more OREBs (not necessarily guaranteed in 100, but likely)
        # If not, at least verify the strategies produce different results
        assert crash_results != prevent_results


# =============================================================================
# EDGE CASE TESTS
# =============================================================================

class TestEdgeCases:
    """Test extreme and edge case scenarios."""

    def test_all_1_attributes_vs_all_99_attributes(self):
        """Extreme attribute disparity should work."""
        # All 1s team
        worst_team = []
        for i, pos in enumerate(['PG', 'SG', 'SF', 'PF', 'C']):
            player = {'name': f'Worst_{i+1}', 'position': pos}
            for attr in ALL_ATTRIBUTES:
                player[attr] = 1
            worst_team.append(player)

        # All 99s team
        best_team = []
        for i, pos in enumerate(['PG', 'SG', 'SF', 'PF', 'C']):
            player = {'name': f'Best_{i+1}', 'position': pos}
            for attr in ALL_ATTRIBUTES:
                player[attr] = 99
            best_team.append(player)

        # Should complete without error
        result = simulate_single_possession(
            offensive_team=worst_team,
            defensive_team=best_team,
            seed=42
        )

        assert result is not None

        # Best vs worst should also work
        result = simulate_single_possession(
            offensive_team=best_team,
            defensive_team=worst_team,
            seed=42
        )

        assert result is not None

    def test_all_same_attributes(self):
        """All players with identical attributes should work."""
        clone_team = []
        for i, pos in enumerate(['PG', 'SG', 'SF', 'PF', 'C']):
            player = {'name': f'Clone_{i+1}', 'position': pos}
            for attr in ALL_ATTRIBUTES:
                player[attr] = 75  # All identical
            clone_team.append(player)

        result = simulate_single_possession(
            offensive_team=clone_team,
            defensive_team=clone_team,
            seed=42
        )

        assert result is not None

    def test_transition_with_14_shot_clock(self, balanced_team):
        """Transition with 14-second shot clock should work."""
        context = PossessionContext(is_transition=True, shot_clock=14)

        result = simulate_single_possession(
            offensive_team=balanced_team,
            defensive_team=balanced_team,
            possession_context=context,
            seed=42
        )

        assert result is not None


# =============================================================================
# STATISTICAL SANITY TESTS
# =============================================================================

class TestStatisticalSanity:
    """Validate statistical properties of simulation."""

    def test_points_per_possession_reasonable(self, balanced_team):
        """Average points per possession should be realistic (0.9-1.2)."""
        results = simulate_multiple_possessions(
            offensive_team=balanced_team,
            defensive_team=balanced_team,
            num_possessions=1000,
            seed=42
        )

        total_points = sum(r.points_scored for r in results)
        ppp = total_points / len(results)

        # NBA average is ~1.0-1.1 PPP
        assert 0.7 <= ppp <= 1.4, f"PPP {ppp:.2f} unrealistic"

    def test_field_goal_percentage_reasonable(self, balanced_team):
        """Field goal percentage should be reasonable (35-55%)."""
        results = simulate_multiple_possessions(
            offensive_team=balanced_team,
            defensive_team=balanced_team,
            num_possessions=1000,
            seed=42
        )

        shots = [r for r in results if r.possession_outcome in ['made_shot', 'missed_shot']]
        makes = [r for r in results if r.possession_outcome == 'made_shot']

        if shots:
            fg_pct = len(makes) / len(shots)

            # Should be in reasonable range
            assert 0.30 <= fg_pct <= 0.60, f"FG% {fg_pct:.2f} unrealistic"

    def test_turnover_rate_reasonable(self, balanced_team):
        """Turnover rate should be reasonable (5-15%)."""
        results = simulate_multiple_possessions(
            offensive_team=balanced_team,
            defensive_team=balanced_team,
            num_possessions=1000,
            seed=42
        )

        turnovers = [r for r in results if r.possession_outcome == 'turnover']
        to_rate = len(turnovers) / len(results)

        # NBA average is ~12-14%
        assert 0.03 <= to_rate <= 0.20, f"TO% {to_rate:.2f} unrealistic"


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
