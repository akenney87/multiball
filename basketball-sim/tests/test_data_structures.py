"""
Unit Tests for Data Structures and Validation

Validates:
- Player validation (all 25 attributes, ranges, types)
- Team validation (exactly 5 players)
- TacticalSettings validation
- PossessionContext validation
- PossessionResult structure
"""

import pytest
from src.core.data_structures import (
    PossessionContext,
    TacticalSettings,
    PossessionResult,
    SigmoidCalculation,
    create_player,
    validate_player,
    validate_team,
)
from src.constants import ALL_ATTRIBUTES, ATTRIBUTE_MIN, ATTRIBUTE_MAX


# =============================================================================
# PLAYER CREATION AND VALIDATION
# =============================================================================

class TestPlayerValidation:
    """Test player validation rules."""

    def create_valid_player(self, name='Test Player', position='PG'):
        """Helper to create a valid player."""
        player = {
            'name': name,
            'position': position,
        }
        # Add all 25 attributes with valid values
        for attr in ALL_ATTRIBUTES:
            player[attr] = 50  # Default to 50
        return player

    def test_validate_valid_player(self):
        """Valid player should pass validation."""
        player = self.create_valid_player()
        assert validate_player(player) is True

    def test_validate_player_missing_name(self):
        """Player missing name should fail."""
        player = self.create_valid_player()
        del player['name']

        with pytest.raises(ValueError, match="missing 'name'"):
            validate_player(player)

    def test_validate_player_missing_position(self):
        """Player missing position should fail."""
        player = self.create_valid_player()
        del player['position']

        with pytest.raises(ValueError, match="missing 'position'"):
            validate_player(player)

    def test_validate_player_invalid_position(self):
        """Invalid position should fail."""
        player = self.create_valid_player()
        player['position'] = 'QB'  # Not a basketball position

        with pytest.raises(ValueError, match="Invalid position"):
            validate_player(player)

    def test_validate_player_valid_positions(self):
        """All valid positions should pass."""
        positions = ['PG', 'SG', 'SF', 'PF', 'C']

        for pos in positions:
            player = self.create_valid_player(position=pos)
            assert validate_player(player) is True

    def test_validate_player_missing_attribute(self):
        """Player missing any of 25 attributes should fail."""
        player = self.create_valid_player()

        # Remove one attribute
        del player['grip_strength']

        with pytest.raises(ValueError, match="missing attributes"):
            validate_player(player)

    def test_validate_player_all_attributes_present(self):
        """Player with all 25 attributes should pass."""
        player = self.create_valid_player()

        # Verify all attributes are present
        for attr in ALL_ATTRIBUTES:
            assert attr in player

        assert validate_player(player) is True

    def test_validate_player_attribute_out_of_range_low(self):
        """Attribute below minimum (1) should fail."""
        player = self.create_valid_player()
        player['grip_strength'] = 0  # Below min

        with pytest.raises(ValueError, match="out of range"):
            validate_player(player)

    def test_validate_player_attribute_out_of_range_high(self):
        """Attribute above maximum (100) should fail."""
        player = self.create_valid_player()
        player['throw_accuracy'] = 101  # Above max

        with pytest.raises(ValueError, match="out of range"):
            validate_player(player)

    def test_validate_player_attribute_at_min(self):
        """Attribute at minimum (1) should pass."""
        player = self.create_valid_player()
        player['stamina'] = ATTRIBUTE_MIN

        assert validate_player(player) is True

    def test_validate_player_attribute_at_max(self):
        """Attribute at maximum (100) should pass."""
        player = self.create_valid_player()
        player['height'] = ATTRIBUTE_MAX

        assert validate_player(player) is True

    def test_validate_player_non_numeric_attribute(self):
        """Non-numeric attribute should fail."""
        player = self.create_valid_player()
        player['agility'] = "fast"  # String instead of number

        with pytest.raises(ValueError, match="must be numeric"):
            validate_player(player)

    def test_validate_player_float_attributes(self):
        """Float attributes should be valid."""
        player = self.create_valid_player()
        player['form_technique'] = 85.5  # Float

        assert validate_player(player) is True

    def test_create_player_with_all_attributes(self):
        """create_player with all attributes should succeed."""
        attributes = {attr: 60 for attr in ALL_ATTRIBUTES}

        player = create_player('Curry', 'PG', **attributes)

        assert player['name'] == 'Curry'
        assert player['position'] == 'PG'
        assert validate_player(player) is True

    def test_create_player_missing_attribute(self):
        """create_player missing an attribute should fail."""
        attributes = {attr: 60 for attr in ALL_ATTRIBUTES}
        del attributes['teamwork']  # Remove one

        with pytest.raises(ValueError, match="Missing attributes"):
            create_player('Incomplete', 'SG', **attributes)


# =============================================================================
# TEAM VALIDATION
# =============================================================================

class TestTeamValidation:
    """Test team validation rules."""

    def create_valid_team(self, prefix='Player'):
        """Helper to create a valid 5-player team."""
        positions = ['PG', 'SG', 'SF', 'PF', 'C']
        team = []

        for i, pos in enumerate(positions):
            player = {
                'name': f'{prefix}_{i+1}',
                'position': pos,
            }
            for attr in ALL_ATTRIBUTES:
                player[attr] = 50
            team.append(player)

        return team

    def test_validate_valid_team(self):
        """Valid 5-player team should pass."""
        team = self.create_valid_team()
        assert validate_team(team) is True

    def test_validate_team_wrong_size_too_few(self):
        """Team with <5 players should fail."""
        team = self.create_valid_team()[:4]  # Only 4 players

        with pytest.raises(ValueError, match="must have exactly 5 players"):
            validate_team(team)

    def test_validate_team_wrong_size_too_many(self):
        """Team with >5 players should fail."""
        team = self.create_valid_team()
        # Add extra player
        extra = team[0].copy()
        extra['name'] = 'Extra Player'
        team.append(extra)

        with pytest.raises(ValueError, match="must have exactly 5 players"):
            validate_team(team)

    def test_validate_team_invalid_player(self):
        """Team with invalid player should fail."""
        team = self.create_valid_team()
        # Make one player invalid
        team[2]['agility'] = 150  # Out of range

        with pytest.raises(ValueError, match="out of range"):
            validate_team(team)

    def test_validate_team_all_different_positions(self):
        """Team with all different positions should pass."""
        team = self.create_valid_team()

        positions = [p['position'] for p in team]
        assert len(set(positions)) == 5  # All unique

        assert validate_team(team) is True

    def test_validate_team_duplicate_positions_allowed(self):
        """Duplicate positions should be allowed (no rule against it)."""
        team = self.create_valid_team()
        # Make all players PG
        for player in team:
            player['position'] = 'PG'

        # Should still pass (only requirement is 5 valid players)
        assert validate_team(team) is True


# =============================================================================
# TACTICAL SETTINGS VALIDATION
# =============================================================================

class TestTacticalSettings:
    """Test TacticalSettings dataclass and validation."""

    def test_tactical_settings_defaults(self):
        """Default tactical settings should be valid."""
        tactics = TacticalSettings()

        assert tactics.pace == 'standard'
        assert tactics.man_defense_pct == 50
        assert tactics.rebounding_strategy == 'standard'
        assert tactics.scoring_option_1 is None

        # Should pass validation
        tactics.validate()

    def test_tactical_settings_custom_values(self):
        """Custom tactical settings should be valid."""
        tactics = TacticalSettings(
            pace='fast',
            man_defense_pct=75,
            rebounding_strategy='crash_glass',
            scoring_option_1='LeBron James',
            scoring_option_2='Anthony Davis',
            scoring_option_3='Russell Westbrook'
        )

        tactics.validate()

    def test_tactical_settings_invalid_pace(self):
        """Invalid pace should fail validation."""
        tactics = TacticalSettings(pace='ultra_fast')

        with pytest.raises(ValueError, match="Invalid pace"):
            tactics.validate()

    def test_tactical_settings_valid_paces(self):
        """All valid paces should pass."""
        paces = ['fast', 'standard', 'slow']

        for pace in paces:
            tactics = TacticalSettings(pace=pace)
            tactics.validate()  # Should not raise

    def test_tactical_settings_man_defense_pct_out_of_range_low(self):
        """man_defense_pct < 0 should fail."""
        tactics = TacticalSettings(man_defense_pct=-10)

        with pytest.raises(ValueError, match="Invalid man_defense_pct"):
            tactics.validate()

    def test_tactical_settings_man_defense_pct_out_of_range_high(self):
        """man_defense_pct > 100 should fail."""
        tactics = TacticalSettings(man_defense_pct=150)

        with pytest.raises(ValueError, match="Invalid man_defense_pct"):
            tactics.validate()

    def test_tactical_settings_man_defense_pct_boundaries(self):
        """man_defense_pct at 0 and 100 should pass."""
        tactics_0 = TacticalSettings(man_defense_pct=0)
        tactics_100 = TacticalSettings(man_defense_pct=100)

        tactics_0.validate()
        tactics_100.validate()

    def test_tactical_settings_invalid_rebounding_strategy(self):
        """Invalid rebounding strategy should fail."""
        tactics = TacticalSettings(rebounding_strategy='ultra_aggressive')

        with pytest.raises(ValueError, match="Invalid rebounding_strategy"):
            tactics.validate()

    def test_tactical_settings_valid_rebounding_strategies(self):
        """All valid rebounding strategies should pass."""
        strategies = ['crash_glass', 'standard', 'prevent_transition']

        for strategy in strategies:
            tactics = TacticalSettings(rebounding_strategy=strategy)
            tactics.validate()

    def test_tactical_settings_minutes_allotment_valid(self):
        """Valid minutes allocation (sums to 240) should pass."""
        tactics = TacticalSettings(
            minutes_allotment={
                'Player A': 48,
                'Player B': 48,
                'Player C': 48,
                'Player D': 48,
                'Player E': 48,
            }
        )

        tactics.validate()

    def test_tactical_settings_minutes_allotment_invalid(self):
        """Invalid minutes allocation (doesn't sum to 240) should fail."""
        tactics = TacticalSettings(
            minutes_allotment={
                'Player A': 40,
                'Player B': 40,
                'Player C': 40,
                'Player D': 40,
                'Player E': 40,
            }  # Sums to 200
        )

        with pytest.raises(ValueError, match="must sum to 240"):
            tactics.validate()

    def test_tactical_settings_empty_minutes_allotment(self):
        """Empty minutes allocation should pass (optional field)."""
        tactics = TacticalSettings(minutes_allotment={})

        tactics.validate()  # Should not validate minutes if empty


# =============================================================================
# POSSESSION CONTEXT VALIDATION
# =============================================================================

class TestPossessionContext:
    """Test PossessionContext dataclass."""

    def test_possession_context_defaults(self):
        """Default possession context should be valid."""
        context = PossessionContext()

        assert context.is_transition is False
        assert context.shot_clock == 24
        assert context.score_differential == 0
        assert context.game_time_remaining == 2880  # 48 minutes

    def test_possession_context_custom_values(self):
        """Custom possession context should be valid."""
        context = PossessionContext(
            is_transition=True,
            shot_clock=14,
            score_differential=10,
            game_time_remaining=1200
        )

        assert context.is_transition is True
        assert context.shot_clock == 14
        assert context.score_differential == 10
        assert context.game_time_remaining == 1200

    def test_possession_context_transition_halfcourt(self):
        """Transition flags should work correctly."""
        halfcourt = PossessionContext(is_transition=False)
        transition = PossessionContext(is_transition=True)

        assert halfcourt.is_transition is False
        assert transition.is_transition is True

    def test_possession_context_shot_clock_values(self):
        """Shot clock should support 24 and 14."""
        context_24 = PossessionContext(shot_clock=24)
        context_14 = PossessionContext(shot_clock=14)

        assert context_24.shot_clock == 24
        assert context_14.shot_clock == 14


# =============================================================================
# SIGMOID CALCULATION DATACLASS
# =============================================================================

class TestSigmoidCalculation:
    """Test SigmoidCalculation debug structure."""

    def test_sigmoid_calculation_creation(self):
        """SigmoidCalculation should store all fields."""
        calc = SigmoidCalculation(
            calculation_type='3pt_shot',
            offensive_composite=85.0,
            defensive_composite=65.0,
            attribute_diff=20.0,
            base_rate=0.30,
            sigmoid_input=0.4,
            sigmoid_output=0.6,
            final_probability=0.72,
            modifiers={'transition': 0.08}
        )

        assert calc.calculation_type == '3pt_shot'
        assert calc.offensive_composite == 85.0
        assert calc.defensive_composite == 65.0
        assert calc.attribute_diff == 20.0
        assert calc.base_rate == 0.30
        assert calc.final_probability == 0.72
        assert calc.modifiers['transition'] == 0.08

    def test_sigmoid_calculation_default_modifiers(self):
        """Modifiers should default to empty dict."""
        calc = SigmoidCalculation(
            calculation_type='test',
            offensive_composite=50.0,
            defensive_composite=50.0,
            attribute_diff=0.0,
            base_rate=0.5,
            sigmoid_input=0.0,
            sigmoid_output=0.5,
            final_probability=0.75
        )

        assert calc.modifiers == {}


# =============================================================================
# POSSESSION RESULT DATACLASS
# =============================================================================

class TestPossessionResult:
    """Test PossessionResult structure."""

    def test_possession_result_made_shot(self):
        """PossessionResult for made shot should store all fields."""
        result = PossessionResult(
            play_by_play_text="Curry makes a 3-pointer!",
            possession_outcome='made_shot',
            scoring_player='Stephen Curry',
            assist_player='Draymond Green',
            points_scored=3,
            debug={'shot_type': '3pt', 'contest_distance': 6.5}
        )

        assert result.possession_outcome == 'made_shot'
        assert result.scoring_player == 'Stephen Curry'
        assert result.assist_player == 'Draymond Green'
        assert result.points_scored == 3
        assert result.debug['shot_type'] == '3pt'

    def test_possession_result_missed_shot(self):
        """PossessionResult for missed shot."""
        result = PossessionResult(
            play_by_play_text="James misses. Rebound by Howard.",
            possession_outcome='missed_shot',
            rebound_player='Dwight Howard',
            points_scored=0
        )

        assert result.possession_outcome == 'missed_shot'
        assert result.scoring_player is None
        assert result.rebound_player == 'Dwight Howard'
        assert result.points_scored == 0

    def test_possession_result_turnover(self):
        """PossessionResult for turnover."""
        result = PossessionResult(
            play_by_play_text="Bad pass by Westbrook. Stolen by Kawhi.",
            possession_outcome='turnover',
            points_scored=0
        )

        assert result.possession_outcome == 'turnover'
        assert result.points_scored == 0
        assert result.scoring_player is None

    def test_possession_result_to_dict(self):
        """to_dict() should serialize to dictionary."""
        result = PossessionResult(
            play_by_play_text="Test",
            possession_outcome='made_shot',
            scoring_player='Player A',
            points_scored=2,
            debug={'key': 'value'}
        )

        dict_result = result.to_dict()

        assert isinstance(dict_result, dict)
        assert dict_result['play_by_play_text'] == "Test"
        assert dict_result['possession_outcome'] == 'made_shot'
        assert dict_result['scoring_player'] == 'Player A'
        assert dict_result['points_scored'] == 2
        assert dict_result['debug']['key'] == 'value'

    def test_possession_result_defaults(self):
        """PossessionResult should have sensible defaults."""
        result = PossessionResult(
            play_by_play_text="Test",
            possession_outcome='turnover'
        )

        assert result.scoring_player is None
        assert result.assist_player is None
        assert result.rebound_player is None
        assert result.points_scored == 0
        assert result.debug == {}


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
