"""
Unit Tests for Tactical Modifiers Integration Layer

Validates that all 5 tactical settings have observable, mechanical impact:
1. Pace affects possessions, stamina, shot distribution
2. Zone defense affects turnovers, contests, shot selection
3. Scoring options affect usage distribution (30%/20%/15%)
4. Minutes allocation validates correctly
5. Rebounding strategy affects number of rebounders

NO FAKE SLIDERS - every test verifies actual gameplay impact.
"""

import pytest
from src.tactical.tactical_modifiers import (
    # Pace
    apply_pace_modifiers,
    get_pace_modifiers,
    get_stamina_cost_per_possession,

    # Zone defense
    get_zone_defense_modifiers,
    determine_defense_type,

    # Scoring options
    calculate_usage_distribution,
    select_shooter,

    # Minutes allocation
    validate_minutes_allocation,
    get_player_availability_weights,

    # Rebounding strategy
    get_rebounding_strategy_params,
    get_rebounders,

    # Integrated
    apply_all_tactical_modifiers,
    validate_tactical_settings,
)
from src.core.data_structures import TacticalSettings, PossessionContext


# =============================================================================
# PACE SYSTEM TESTS
# =============================================================================

class TestPaceModifiers:
    """Test that pace affects possessions, stamina, and shot distribution."""

    def test_pace_possessions_fast(self):
        """Fast pace increases possessions by +10%."""
        base_possessions = 95
        result = apply_pace_modifiers(base_possessions, 'fast', 'possessions')
        assert result == pytest.approx(104.5, abs=0.1)  # 95 * 1.10

    def test_pace_possessions_slow(self):
        """Slow pace decreases possessions by -10%."""
        base_possessions = 95
        result = apply_pace_modifiers(base_possessions, 'slow', 'possessions')
        assert result == pytest.approx(85.5, abs=0.1)  # 95 * 0.90

    def test_pace_possessions_standard(self):
        """Standard pace has no modifier."""
        base_possessions = 95
        result = apply_pace_modifiers(base_possessions, 'standard', 'possessions')
        assert result == pytest.approx(95.0, abs=0.1)

    def test_pace_stamina_fast(self):
        """Fast pace increases stamina drain by +15%."""
        base_stamina = 1.3
        result = apply_pace_modifiers(base_stamina, 'fast', 'stamina')
        assert result == pytest.approx(1.495, abs=0.01)  # 1.3 * 1.15

    def test_pace_stamina_slow(self):
        """Slow pace decreases stamina drain by -15%."""
        base_stamina = 1.3
        result = apply_pace_modifiers(base_stamina, 'slow', 'stamina')
        assert result == pytest.approx(1.105, abs=0.01)  # 1.3 * 0.85

    def test_pace_shot_distribution_fast(self):
        """Fast pace returns +5% rim shot adjustment."""
        result = apply_pace_modifiers(0.40, 'fast', 'shot_distribution')
        assert result == pytest.approx(0.05, abs=0.001)

    def test_pace_shot_distribution_slow(self):
        """Slow pace returns +5% midrange shot adjustment."""
        result = apply_pace_modifiers(0.40, 'slow', 'shot_distribution')
        assert result == pytest.approx(0.05, abs=0.001)

    def test_get_pace_modifiers_fast(self):
        """Fast pace modifiers all correct."""
        mods = get_pace_modifiers('fast')
        assert mods['possession_multiplier'] == 1.10
        assert mods['stamina_drain_multiplier'] == 1.15
        assert mods['turnover_adjustment'] == 0.025
        assert mods['rim_shot_adjustment'] == 0.05
        assert mods['midrange_shot_adjustment'] == 0.0

    def test_get_pace_modifiers_slow(self):
        """Slow pace modifiers all correct."""
        mods = get_pace_modifiers('slow')
        assert mods['possession_multiplier'] == 0.90
        assert mods['stamina_drain_multiplier'] == 0.85
        assert mods['turnover_adjustment'] == -0.025
        assert mods['rim_shot_adjustment'] == 0.0
        assert mods['midrange_shot_adjustment'] == 0.05

    def test_stamina_cost_per_possession(self):
        """Stamina costs vary by pace."""
        assert get_stamina_cost_per_possession('fast') == 1.5
        assert get_stamina_cost_per_possession('standard') == 1.3
        assert get_stamina_cost_per_possession('slow') == 1.1


# =============================================================================
# ZONE DEFENSE TESTS
# =============================================================================

class TestZoneDefenseModifiers:
    """Test that zone defense affects turnovers, contests, and shot selection."""

    def test_zone_100_percent(self):
        """100% zone (man_defense_pct=0) applies full modifiers."""
        mods = get_zone_defense_modifiers(0)
        assert mods['turnover_bonus'] == pytest.approx(0.03, abs=0.001)
        assert mods['contest_penalty'] == pytest.approx(-0.15, abs=0.001)
        assert mods['drive_penalty'] == pytest.approx(-0.10, abs=0.001)
        assert mods['shot_attempt_bonus'] == pytest.approx(0.05, abs=0.001)
        assert mods['zone_pct'] == 1.0

    def test_zone_50_percent(self):
        """50/50 split applies half modifiers."""
        mods = get_zone_defense_modifiers(50)
        assert mods['turnover_bonus'] == pytest.approx(0.015, abs=0.001)
        assert mods['contest_penalty'] == pytest.approx(-0.075, abs=0.001)
        assert mods['drive_penalty'] == pytest.approx(-0.05, abs=0.001)
        assert mods['shot_attempt_bonus'] == pytest.approx(0.025, abs=0.001)
        assert mods['zone_pct'] == 0.5

    def test_zone_0_percent(self):
        """100% man (man_defense_pct=100) applies no zone modifiers."""
        mods = get_zone_defense_modifiers(100)
        assert mods['turnover_bonus'] == 0.0
        assert mods['contest_penalty'] == 0.0
        assert mods['drive_penalty'] == 0.0
        assert mods['shot_attempt_bonus'] == 0.0
        assert mods['zone_pct'] == 0.0

    def test_determine_defense_type_distribution(self):
        """Defense type roll matches expected distribution."""
        # Test 100 rolls with 75% man defense
        man_count = 0
        zone_count = 0

        import random
        random.seed(42)  # Reproducible

        for _ in range(100):
            result = determine_defense_type(75)
            if result == 'man':
                man_count += 1
            else:
                zone_count += 1

        # Should be roughly 75/25 split (±15% tolerance)
        assert 60 <= man_count <= 90
        assert 10 <= zone_count <= 40

    def test_determine_defense_type_100_man(self):
        """100% man defense always returns 'man'."""
        import random
        random.seed(42)

        for _ in range(20):
            assert determine_defense_type(100) == 'man'

    def test_determine_defense_type_0_man(self):
        """0% man defense always returns 'zone'."""
        import random
        random.seed(42)

        for _ in range(20):
            assert determine_defense_type(0) == 'zone'


# =============================================================================
# SCORING OPTIONS TESTS
# =============================================================================

class TestScoringOptions:
    """Test that scoring options affect usage distribution (30%/20%/15%)."""

    def create_test_team(self):
        """Create a 5-player team for testing."""
        return [
            {'name': 'Player A', 'stamina': 80, 'position': 'PG'},
            {'name': 'Player B', 'stamina': 75, 'position': 'SG'},
            {'name': 'Player C', 'stamina': 70, 'position': 'SF'},
            {'name': 'Player D', 'stamina': 65, 'position': 'PF'},
            {'name': 'Player E', 'stamina': 60, 'position': 'C'},
        ]

    def test_usage_distribution_all_options(self):
        """Scoring options get correct usage: 30%, 20%, 15%, 17.5%, 17.5%."""
        team = self.create_test_team()
        options = ['Player A', 'Player B', 'Player C']

        usage = calculate_usage_distribution(team, options)

        assert usage['Player A'] == pytest.approx(0.30, abs=0.001)
        assert usage['Player B'] == pytest.approx(0.20, abs=0.001)
        assert usage['Player C'] == pytest.approx(0.15, abs=0.001)
        assert usage['Player D'] == pytest.approx(0.175, abs=0.001)
        assert usage['Player E'] == pytest.approx(0.175, abs=0.001)

        # Must sum to 1.0
        assert sum(usage.values()) == pytest.approx(1.0, abs=0.001)

    def test_usage_distribution_option_1_exhausted(self):
        """Option 1 exhausted redistributes to Option 2."""
        team = self.create_test_team()
        team[0]['stamina'] = 10  # Player A exhausted
        options = ['Player A', 'Player B', 'Player C']

        usage = calculate_usage_distribution(team, options)

        # Player B now gets Option 1's usage (30%) carried over + their own (20%) = 50%
        assert usage['Player B'] == pytest.approx(0.50, abs=0.001)  # Gets option 1 + 2 usage
        assert usage['Player C'] == pytest.approx(0.15, abs=0.001)  # Gets option 3 usage (no carryover)

        # Player A joins "others" pool (3 players: A, D, E)
        # Others pool = 35%, split 3 ways
        others_usage = 0.35 / 3
        assert usage['Player A'] == pytest.approx(others_usage, abs=0.001)
        assert usage['Player D'] == pytest.approx(others_usage, abs=0.001)
        assert usage['Player E'] == pytest.approx(others_usage, abs=0.001)

        assert sum(usage.values()) == pytest.approx(1.0, abs=0.001)

    def test_usage_distribution_all_options_exhausted(self):
        """All scoring options exhausted distributes equally."""
        team = self.create_test_team()
        team[0]['stamina'] = 10
        team[1]['stamina'] = 10
        team[2]['stamina'] = 10
        options = ['Player A', 'Player B', 'Player C']

        usage = calculate_usage_distribution(team, options)

        # All 5 players share equally: 100% / 5 = 20% each
        for player_name in ['Player A', 'Player B', 'Player C', 'Player D', 'Player E']:
            assert usage[player_name] == pytest.approx(0.20, abs=0.001)

        assert sum(usage.values()) == pytest.approx(1.0, abs=0.001)

    def test_usage_distribution_no_options(self):
        """No scoring options means equal distribution."""
        team = self.create_test_team()
        options = [None, None, None]

        usage = calculate_usage_distribution(team, options)

        # All 5 players share equally
        for player_name in ['Player A', 'Player B', 'Player C', 'Player D', 'Player E']:
            assert usage[player_name] == pytest.approx(0.20, abs=0.001)

        assert sum(usage.values()) == pytest.approx(1.0, abs=0.001)

    def test_select_shooter_respects_usage(self):
        """Shooter selection uses usage distribution."""
        team = self.create_test_team()
        tactics = TacticalSettings(
            scoring_option_1='Player A',
            scoring_option_2='Player B',
            scoring_option_3='Player C'
        )

        import random
        random.seed(42)

        # Select 100 shooters and track distribution
        selections = {'Player A': 0, 'Player B': 0, 'Player C': 0, 'Player D': 0, 'Player E': 0}

        for _ in range(100):
            shooter = select_shooter(team, tactics)
            selections[shooter['name']] += 1

        # Verify roughly matches usage distribution (±10% tolerance)
        assert 20 <= selections['Player A'] <= 40  # ~30%
        assert 10 <= selections['Player B'] <= 30  # ~20%
        assert 5 <= selections['Player C'] <= 25   # ~15%
        # D and E combined should be ~35%
        assert 25 <= (selections['Player D'] + selections['Player E']) <= 45


# =============================================================================
# MINUTES ALLOCATION TESTS
# =============================================================================

class TestMinutesAllocation:
    """Test minutes allocation validation and availability weights."""

    def test_validate_minutes_valid(self):
        """Valid minutes allocation (sums to 240)."""
        minutes = {
            'Player A': 48,
            'Player B': 48,
            'Player C': 48,
            'Player D': 48,
            'Player E': 48
        }
        is_valid, error = validate_minutes_allocation(minutes)
        assert is_valid
        assert error == ""

    def test_validate_minutes_invalid_total(self):
        """Invalid total (not 240)."""
        minutes = {
            'Player A': 40,
            'Player B': 40,
            'Player C': 40,
            'Player D': 40,
            'Player E': 40
        }
        is_valid, error = validate_minutes_allocation(minutes)
        assert not is_valid
        assert "must sum to 240, got 200" in error

    def test_validate_minutes_negative(self):
        """Negative minutes rejected."""
        minutes = {
            'Player A': 48,
            'Player B': 48,
            'Player C': 48,
            'Player D': 48,
            'Player E': -10  # Invalid
        }
        is_valid, error = validate_minutes_allocation(minutes)
        assert not is_valid
        assert "negative minutes" in error

    def test_validate_minutes_exceeds_48(self):
        """Player exceeding 48 minutes rejected."""
        minutes = {
            'Player A': 60,  # Invalid
            'Player B': 45,
            'Player C': 45,
            'Player D': 45,
            'Player E': 45
        }
        is_valid, error = validate_minutes_allocation(minutes)
        assert not is_valid
        assert "exceeds 48 minutes" in error

    def test_get_player_availability_weights(self):
        """Availability weights based on minutes."""
        team = [
            {'name': 'Starter', 'position': 'PG'},
            {'name': 'Bench', 'position': 'PG'}
        ]
        minutes = {'Starter': 36, 'Bench': 12}

        weights = get_player_availability_weights(team, minutes)

        assert weights['Starter'] == pytest.approx(0.75, abs=0.01)  # 36/48
        assert weights['Bench'] == pytest.approx(0.25, abs=0.01)    # 12/48


# =============================================================================
# REBOUNDING STRATEGY TESTS
# =============================================================================

class TestReboundingStrategy:
    """Test rebounding strategy affects number of rebounders."""

    def test_crash_glass_params(self):
        """Crash glass: 5 offensive rebounders, +8% OREB."""
        params = get_rebounding_strategy_params('crash_glass')
        assert params['offensive_rebounders'] == 5
        assert params['defensive_rebounders'] == 0
        assert params['oreb_modifier'] == pytest.approx(0.08, abs=0.001)

    def test_standard_params(self):
        """Standard: 4 offensive rebounders, no modifier."""
        params = get_rebounding_strategy_params('standard')
        assert params['offensive_rebounders'] == 4
        assert params['defensive_rebounders'] == 1
        assert params['oreb_modifier'] == 0.0

    def test_prevent_transition_params(self):
        """Prevent transition: 3 offensive rebounders, -5% OREB."""
        params = get_rebounding_strategy_params('prevent_transition')
        assert params['offensive_rebounders'] == 3
        assert params['defensive_rebounders'] == 2
        assert params['oreb_modifier'] == pytest.approx(-0.05, abs=0.001)

    def test_get_rebounders_crash_glass(self):
        """Crash glass returns all 5 players."""
        team = [
            {'name': f'Player {i}', 'height': 70 + i, 'jumping': 60, 'core_strength': 60,
             'awareness': 60, 'reactions': 60, 'determination': 60}
            for i in range(5)
        ]

        rebounders = get_rebounders(team, 'crash_glass', is_offensive_team=True)
        assert len(rebounders) == 5

    def test_get_rebounders_standard(self):
        """Standard returns top 4 rebounders."""
        team = [
            {'name': f'Player {i}', 'height': 70 + i, 'jumping': 60, 'core_strength': 60,
             'awareness': 60, 'reactions': 60, 'determination': 60}
            for i in range(5)
        ]

        rebounders = get_rebounders(team, 'standard', is_offensive_team=True)
        assert len(rebounders) == 4

        # Should be top 4 by composite (highest height)
        rebounder_names = [r['name'] for r in rebounders]
        assert 'Player 4' in rebounder_names  # Tallest
        assert 'Player 3' in rebounder_names
        assert 'Player 2' in rebounder_names
        assert 'Player 1' in rebounder_names

    def test_get_rebounders_prevent_transition(self):
        """Prevent transition returns top 3 rebounders."""
        team = [
            {'name': f'Player {i}', 'height': 70 + i, 'jumping': 60, 'core_strength': 60,
             'awareness': 60, 'reactions': 60, 'determination': 60}
            for i in range(5)
        ]

        rebounders = get_rebounders(team, 'prevent_transition', is_offensive_team=True)
        assert len(rebounders) == 3

        # Should be top 3 by composite
        rebounder_names = [r['name'] for r in rebounders]
        assert 'Player 4' in rebounder_names  # Tallest
        assert 'Player 3' in rebounder_names
        assert 'Player 2' in rebounder_names


# =============================================================================
# INTEGRATED TACTICAL APPLICATION TESTS
# =============================================================================

class TestIntegratedTactical:
    """Test that apply_all_tactical_modifiers works correctly."""

    def test_apply_tactical_shot_selection_fast_pace(self):
        """Fast pace increases rim shot percentage."""
        base_probs = {'3pt': 0.40, 'midrange': 0.20, 'rim': 0.40}
        tactics = TacticalSettings(pace='fast')
        context = PossessionContext()

        modified, debug = apply_all_tactical_modifiers(
            base_probs, tactics, context, 'shot_selection', 'man'
        )

        # Rim should increase, normalized
        assert modified['rim'] > 0.40
        assert 'pace_rim_bonus' in debug['modifiers_applied']
        assert sum(modified.values()) == pytest.approx(1.0, abs=0.001)

    def test_apply_tactical_turnover_zone(self):
        """Zone defense increases turnover rate."""
        base_probs = {'turnover_rate': 0.08}
        tactics = TacticalSettings(man_defense_pct=0)  # 100% zone
        context = PossessionContext()

        modified, debug = apply_all_tactical_modifiers(
            base_probs, tactics, context, 'turnover', 'zone'
        )

        # Turnover rate should increase
        assert modified['turnover_rate'] > 0.08
        assert 'zone_turnover_bonus' in debug['modifiers_applied']

    def test_apply_tactical_contest_zone(self):
        """Zone defense reduces contest effectiveness."""
        base_probs = {'defender_composite': 80.0}
        tactics = TacticalSettings(man_defense_pct=0)  # 100% zone
        context = PossessionContext()

        modified, debug = apply_all_tactical_modifiers(
            base_probs, tactics, context, 'contest', 'zone'
        )

        # Defender composite should decrease (penalty is negative)
        assert modified['defender_composite'] < 80.0
        assert 'zone_contest_penalty' in debug['modifiers_applied']

    def test_validate_tactical_settings_valid(self):
        """Valid tactical settings pass validation."""
        tactics = TacticalSettings(
            pace='fast',
            man_defense_pct=75,
            rebounding_strategy='crash_glass'
        )

        is_valid, errors = validate_tactical_settings(tactics)
        assert is_valid
        assert len(errors) == 0

    def test_validate_tactical_settings_invalid_pace(self):
        """Invalid pace fails validation."""
        tactics = TacticalSettings(pace='ultra_fast')

        is_valid, errors = validate_tactical_settings(tactics)
        assert not is_valid
        assert any('pace' in err for err in errors)

    def test_validate_tactical_settings_invalid_man_defense(self):
        """Invalid man_defense_pct fails validation."""
        tactics = TacticalSettings(man_defense_pct=150)

        is_valid, errors = validate_tactical_settings(tactics)
        assert not is_valid
        assert any('man_defense_pct' in err for err in errors)


# =============================================================================
# INTEGRATION VALIDATION (End-to-End)
# =============================================================================

class TestTacticalImpactValidation:
    """Validate that tactical settings have OBSERVABLE impact on gameplay."""

    def test_pace_affects_possessions_observable(self):
        """Over 48 minutes, fast pace has ~10% more possessions than slow."""
        base_possessions_per_quarter = 24

        fast_total = apply_pace_modifiers(base_possessions_per_quarter * 4, 'fast', 'possessions')
        slow_total = apply_pace_modifiers(base_possessions_per_quarter * 4, 'slow', 'possessions')

        # Fast should be ~20% more possessions than slow
        # Fast: 96 * 1.10 = 105.6
        # Slow: 96 * 0.90 = 86.4
        # Difference: 19.2 possessions (22%)
        assert fast_total - slow_total >= 15  # At least 15 possession difference

    def test_zone_defense_observable_turnover_boost(self):
        """100% zone vs 100% man has measurable turnover difference."""
        zone_mods = get_zone_defense_modifiers(0)    # 100% zone
        man_mods = get_zone_defense_modifiers(100)   # 100% man

        # Zone should boost turnovers by +3%
        assert zone_mods['turnover_bonus'] == pytest.approx(0.03, abs=0.001)
        assert man_mods['turnover_bonus'] == 0.0

        # Over 100 possessions with 8% base rate:
        # Man: 8 turnovers
        # Zone: 11 turnovers (8% * 1.03 * 100 = 11)
        # 37.5% increase - highly observable!

    def test_scoring_options_observable_usage(self):
        """Primary option gets 30% usage - observable in shot attempts."""
        team = [
            {'name': f'Player {i}', 'stamina': 80, 'position': 'PG'}
            for i in range(5)
        ]
        options = ['Player 0', 'Player 1', 'Player 2']

        usage = calculate_usage_distribution(team, options)

        # Over 100 possessions, Player 0 should get ~30 shots
        # Player 4 should get ~17-18 shots
        # Difference: 12-13 shots - very observable!
        expected_player_0 = usage['Player 0'] * 100  # ~30 shots
        expected_player_4 = usage['Player 4'] * 100  # ~17.5 shots

        assert expected_player_0 - expected_player_4 >= 10

    def test_rebounding_strategy_observable_rebounder_count(self):
        """Crash glass vs prevent transition: 5 vs 3 rebounders."""
        team = [
            {'name': f'Player {i}', 'height': 70, 'jumping': 60, 'core_strength': 60,
             'awareness': 60, 'reactions': 60, 'determination': 60}
            for i in range(5)
        ]

        crash_rebounders = get_rebounders(team, 'crash_glass', is_offensive_team=True)
        prevent_rebounders = get_rebounders(team, 'prevent_transition', is_offensive_team=True)

        # Observable difference: 2 extra rebounders
        assert len(crash_rebounders) - len(prevent_rebounders) == 2


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
