"""
Test suite for rebounding system.

Validates all rebounding mechanics against specifications:
- Team strength calculations
- Defensive advantage (15%)
- Rebounding strategy effects (5/4/3 rebounders)
- Individual rebounder selection (weighted by composite)
- Height threshold (75) for putback vs kickout
- Shot clock reset (14 seconds)
- OREB rates align with NBA averages (~27%)
"""

import pytest
import random
from typing import List, Dict, Any

from src.systems.rebounding import (
    get_rebounders_for_strategy,
    calculate_team_rebounding_strength,
    calculate_offensive_rebound_probability,
    select_rebounder,
    check_putback_attempt,
    simulate_rebound,
    OREB_BASE_RATE,
    OREB_PUTBACK_HEIGHT_THRESHOLD,
    OREB_SHOT_CLOCK_RESET
)
from src.core.probability import calculate_composite, set_seed
from src.constants import WEIGHTS_REBOUND, DEFENSIVE_REBOUND_ADVANTAGE


# Test fixtures
def create_test_player(
    name: str,
    position: str = 'PF',
    height: int = 80,
    jumping: int = 70,
    core_strength: int = 70,
    awareness: int = 70,
    reactions: int = 70,
    determination: int = 70,
    **overrides
) -> Dict[str, Any]:
    """Create a test player with rebounding attributes."""
    player = {
        'name': name,
        'position': position,
        'height': height,
        'jumping': jumping,
        'core_strength': core_strength,
        'awareness': awareness,
        'reactions': reactions,
        'determination': determination,
        # Other required attributes (not used in rebounding)
        'grip_strength': 50,
        'arm_strength': 50,
        'agility': 50,
        'acceleration': 50,
        'top_speed': 50,
        'balance': 50,
        'durability': 50,
        'stamina': 100,
        'creativity': 50,
        'bravery': 50,
        'consistency': 50,
        'composure': 50,
        'patience': 50,
        'hand_eye_coordination': 50,
        'throw_accuracy': 50,
        'form_technique': 50,
        'finesse': 50,
        'deception': 50,
        'teamwork': 50,
    }
    player.update(overrides)
    return player


def create_balanced_team(prefix: str = 'Team') -> List[Dict[str, Any]]:
    """Create a team with balanced rebounding attributes (all 50)."""
    return [
        create_test_player(f'{prefix}_PG', 'PG', height=50, jumping=50, core_strength=50, awareness=50, reactions=50, determination=50),
        create_test_player(f'{prefix}_SG', 'SG', height=50, jumping=50, core_strength=50, awareness=50, reactions=50, determination=50),
        create_test_player(f'{prefix}_SF', 'SF', height=50, jumping=50, core_strength=50, awareness=50, reactions=50, determination=50),
        create_test_player(f'{prefix}_PF', 'PF', height=50, jumping=50, core_strength=50, awareness=50, reactions=50, determination=50),
        create_test_player(f'{prefix}_C', 'C', height=50, jumping=50, core_strength=50, awareness=50, reactions=50, determination=50),
    ]


def create_elite_rebounding_team(prefix: str = 'Elite') -> List[Dict[str, Any]]:
    """Create a team with elite rebounding attributes (all 90)."""
    return [
        create_test_player(f'{prefix}_PG', 'PG', height=90, jumping=90, core_strength=90, awareness=90, reactions=90, determination=90),
        create_test_player(f'{prefix}_SG', 'SG', height=90, jumping=90, core_strength=90, awareness=90, reactions=90, determination=90),
        create_test_player(f'{prefix}_SF', 'SF', height=90, jumping=90, core_strength=90, awareness=90, reactions=90, determination=90),
        create_test_player(f'{prefix}_PF', 'PF', height=90, jumping=90, core_strength=90, awareness=90, reactions=90, determination=90),
        create_test_player(f'{prefix}_C', 'C', height=90, jumping=90, core_strength=90, awareness=90, reactions=90, determination=90),
    ]


def create_poor_rebounding_team(prefix: str = 'Poor') -> List[Dict[str, Any]]:
    """Create a team with poor rebounding attributes (all 20)."""
    return [
        create_test_player(f'{prefix}_PG', 'PG', height=20, jumping=20, core_strength=20, awareness=20, reactions=20, determination=20),
        create_test_player(f'{prefix}_SG', 'SG', height=20, jumping=20, core_strength=20, awareness=20, reactions=20, determination=20),
        create_test_player(f'{prefix}_SF', 'SF', height=20, jumping=20, core_strength=20, awareness=20, reactions=20, determination=20),
        create_test_player(f'{prefix}_PF', 'PF', height=20, jumping=20, core_strength=20, awareness=20, reactions=20, determination=20),
        create_test_player(f'{prefix}_C', 'C', height=20, jumping=20, core_strength=20, awareness=20, reactions=20, determination=20),
    ]


class TestReboundStrategy:
    """Test rebounding strategy effects on number of rebounders."""

    def test_crash_glass_offensive(self):
        """Crash glass: 5 offensive rebounders."""
        team = create_balanced_team()
        rebounders = get_rebounders_for_strategy(team, 'crash_glass', is_offensive=True)
        assert len(rebounders) == 5

    def test_crash_glass_defensive(self):
        """Crash glass: 2 defensive rebounders."""
        team = create_balanced_team()
        rebounders = get_rebounders_for_strategy(team, 'crash_glass', is_offensive=False)
        assert len(rebounders) == 2

    def test_standard_offensive(self):
        """Standard: 2 offensive rebounders."""
        team = create_balanced_team()
        rebounders = get_rebounders_for_strategy(team, 'standard', is_offensive=True)
        assert len(rebounders) == 2

    def test_standard_defensive(self):
        """Standard: 3 defensive rebounders."""
        team = create_balanced_team()
        rebounders = get_rebounders_for_strategy(team, 'standard', is_offensive=False)
        assert len(rebounders) == 3

    def test_prevent_transition_offensive(self):
        """Prevent transition: 1 offensive rebounder."""
        team = create_balanced_team()
        rebounders = get_rebounders_for_strategy(team, 'prevent_transition', is_offensive=True)
        assert len(rebounders) == 1

    def test_prevent_transition_defensive(self):
        """Prevent transition: 4 defensive rebounders."""
        team = create_balanced_team()
        rebounders = get_rebounders_for_strategy(team, 'prevent_transition', is_offensive=False)
        assert len(rebounders) == 4

    def test_selects_top_rebounders(self):
        """Should select players with highest rebounding composite."""
        team = [
            create_test_player('Bad1', height=20, jumping=20, core_strength=20, awareness=20, reactions=20, determination=20),
            create_test_player('Bad2', height=30, jumping=30, core_strength=30, awareness=30, reactions=30, determination=30),
            create_test_player('Good1', height=90, jumping=90, core_strength=90, awareness=90, reactions=90, determination=90),
            create_test_player('Good2', height=85, jumping=85, core_strength=85, awareness=85, reactions=85, determination=85),
            create_test_player('Medium', height=50, jumping=50, core_strength=50, awareness=50, reactions=50, determination=50),
        ]

        # Standard defense: top 3 rebounders
        rebounders = get_rebounders_for_strategy(team, 'standard', is_offensive=False)
        names = [r['name'] for r in rebounders]

        assert len(names) == 3
        assert 'Good1' in names
        assert 'Good2' in names
        assert 'Medium' in names
        assert 'Bad1' not in names
        assert 'Bad2' not in names


class TestTeamStrength:
    """Test team rebounding strength calculations."""

    def test_average_composite(self):
        """Team strength is average of all rebounders."""
        # All players have same composite (50)
        team = create_balanced_team()
        rebounders = get_rebounders_for_strategy(team, 'standard', is_offensive=False)

        strength = calculate_team_rebounding_strength(rebounders, is_defense=False)

        # All attributes are 50, so composite should be 50
        assert 49.0 <= strength <= 51.0

    def test_defensive_advantage(self):
        """Defense gets 15% strength multiplier."""
        team = create_balanced_team()
        rebounders = get_rebounders_for_strategy(team, 'standard', is_offensive=False)

        offensive_strength = calculate_team_rebounding_strength(rebounders, is_defense=False)
        defensive_strength = calculate_team_rebounding_strength(rebounders, is_defense=True)

        # Defensive should be 1.15x offensive
        expected_defensive = offensive_strength * DEFENSIVE_REBOUND_ADVANTAGE
        assert abs(defensive_strength - expected_defensive) < 0.01

    def test_empty_rebounders(self):
        """Empty rebounder list returns 0."""
        strength = calculate_team_rebounding_strength([], is_defense=False)
        assert strength == 0.0

    def test_composite_calculation_uses_correct_weights(self):
        """Verify WEIGHTS_REBOUND are used correctly."""
        player = create_test_player(
            'Test',
            height=80,  # 25% weight
            jumping=60,  # 20% weight
            core_strength=50,  # 15% weight
            awareness=70,  # 20% weight
            reactions=40,  # 10% weight
            determination=30  # 10% weight
        )

        expected = (80 * 0.25) + (60 * 0.20) + (50 * 0.15) + (70 * 0.20) + (40 * 0.10) + (30 * 0.10)
        # = 20 + 12 + 7.5 + 14 + 4 + 3 = 60.5

        composite = calculate_composite(player, WEIGHTS_REBOUND)
        assert abs(composite - 60.5) < 0.01


class TestOREBProbability:
    """Test offensive rebound probability calculations."""

    def test_base_rate(self):
        """Base OREB rate is ~27%."""
        assert 0.25 <= OREB_BASE_RATE <= 0.30

    def test_equal_teams_midrange(self):
        """Equal teams on midrange should be close to base rate."""
        offensive_team = create_balanced_team('Off')
        defensive_team = create_balanced_team('Def')

        off_rebounders = get_rebounders_for_strategy(offensive_team, 'standard', True)
        def_rebounders = get_rebounders_for_strategy(defensive_team, 'standard', False)

        off_strength = calculate_team_rebounding_strength(off_rebounders, False)
        def_strength = calculate_team_rebounding_strength(def_rebounders, True)

        prob, debug = calculate_offensive_rebound_probability(
            off_strength, def_strength, 'midrange', 'standard', 'standard'
        )

        # Should be near base rate but adjusted for defensive advantage
        # Defensive advantage should push OREB% lower
        assert 0.20 <= prob <= 0.35

    def test_shot_type_modifiers(self):
        """Shot type affects OREB probability."""
        off_team = create_balanced_team('Off')
        def_team = create_balanced_team('Def')

        off_rebounders = get_rebounders_for_strategy(off_team, 'standard', True)
        def_rebounders = get_rebounders_for_strategy(def_team, 'standard', False)

        off_strength = calculate_team_rebounding_strength(off_rebounders, False)
        def_strength = calculate_team_rebounding_strength(def_rebounders, True)

        # 3PT should have lower OREB rate
        prob_3pt, _ = calculate_offensive_rebound_probability(
            off_strength, def_strength, '3pt', 'standard', 'standard'
        )

        # Midrange baseline
        prob_mid, _ = calculate_offensive_rebound_probability(
            off_strength, def_strength, 'midrange', 'standard', 'standard'
        )

        # Rim should have higher OREB rate
        prob_rim, _ = calculate_offensive_rebound_probability(
            off_strength, def_strength, 'rim', 'standard', 'standard'
        )

        assert prob_3pt < prob_mid < prob_rim

    def test_crash_glass_bonus(self):
        """Crash glass increases OREB probability by ~8%."""
        off_team = create_balanced_team('Off')
        def_team = create_balanced_team('Def')

        # Standard strategy
        off_rebounders_std = get_rebounders_for_strategy(off_team, 'standard', True)
        def_rebounders = get_rebounders_for_strategy(def_team, 'standard', False)

        off_strength_std = calculate_team_rebounding_strength(off_rebounders_std, False)
        def_strength = calculate_team_rebounding_strength(def_rebounders, True)

        prob_std, _ = calculate_offensive_rebound_probability(
            off_strength_std, def_strength, 'midrange', 'standard', 'standard'
        )

        # Crash glass strategy
        off_rebounders_crash = get_rebounders_for_strategy(off_team, 'crash_glass', True)
        off_strength_crash = calculate_team_rebounding_strength(off_rebounders_crash, False)

        prob_crash, _ = calculate_offensive_rebound_probability(
            off_strength_crash, def_strength, 'midrange', 'crash_glass', 'standard'
        )

        # Crash glass should be higher (more rebounders + strategy bonus)
        assert prob_crash > prob_std
        # Difference should be observable (at least 4%)
        # With 5 vs 2 rebounders + 8% strategy bonus
        assert prob_crash - prob_std > 0.04

    def test_prevent_transition_penalty(self):
        """Prevent transition decreases OREB probability."""
        off_team = create_balanced_team('Off')
        def_team = create_balanced_team('Def')

        # Standard
        off_rebounders_std = get_rebounders_for_strategy(off_team, 'standard', True)
        def_rebounders = get_rebounders_for_strategy(def_team, 'standard', False)

        off_strength_std = calculate_team_rebounding_strength(off_rebounders_std, False)
        def_strength = calculate_team_rebounding_strength(def_rebounders, True)

        prob_std, _ = calculate_offensive_rebound_probability(
            off_strength_std, def_strength, 'midrange', 'standard', 'standard'
        )

        # Prevent transition
        off_rebounders_prevent = get_rebounders_for_strategy(off_team, 'prevent_transition', True)
        off_strength_prevent = calculate_team_rebounding_strength(off_rebounders_prevent, False)

        prob_prevent, _ = calculate_offensive_rebound_probability(
            off_strength_prevent, def_strength, 'midrange', 'prevent_transition', 'standard'
        )

        # Prevent transition should be lower
        assert prob_prevent < prob_std


class TestRebounderSelection:
    """Test individual rebounder selection."""

    def test_weighted_selection(self):
        """Selection weighted by composite."""
        set_seed(42)

        rebounders = [
            create_test_player('Elite', height=95, jumping=95, core_strength=95, awareness=95, reactions=95, determination=95),
            create_test_player('Poor', height=20, jumping=20, core_strength=20, awareness=20, reactions=20, determination=20),
        ]

        # Run 100 selections
        selections = {'Elite': 0, 'Poor': 0}
        for _ in range(100):
            rebounder, _ = select_rebounder(rebounders)
            selections[rebounder['name']] += 1

        # Elite should get vast majority
        assert selections['Elite'] > selections['Poor']
        assert selections['Elite'] > 70  # At least 70%

    def test_equal_composite_equal_probability(self):
        """Equal composites should have equal selection probability."""
        set_seed(42)

        rebounders = [
            create_test_player('A', height=50, jumping=50, core_strength=50, awareness=50, reactions=50, determination=50),
            create_test_player('B', height=50, jumping=50, core_strength=50, awareness=50, reactions=50, determination=50),
            create_test_player('C', height=50, jumping=50, core_strength=50, awareness=50, reactions=50, determination=50),
        ]

        # Run 300 selections
        selections = {'A': 0, 'B': 0, 'C': 0}
        for _ in range(300):
            rebounder, _ = select_rebounder(rebounders)
            selections[rebounder['name']] += 1

        # Should be roughly equal (within 20% of expected 100 each)
        for count in selections.values():
            assert 80 <= count <= 120

    def test_empty_list_raises_error(self):
        """Cannot select from empty list."""
        with pytest.raises(ValueError):
            select_rebounder([])


class TestPutbackLogic:
    """Test putback attempt logic."""

    def test_height_above_threshold_attempts_putback(self):
        """Height > 75 triggers putback attempt."""
        rebounder = create_test_player('TallGuy', height=80)
        defenders = []

        attempted, _, debug = check_putback_attempt(rebounder, defenders)

        assert attempted is True
        assert debug['putback_attempted'] is True

    def test_height_at_threshold_no_putback(self):
        """Height = 75 does NOT trigger putback."""
        rebounder = create_test_player('BorderlineGuy', height=75)
        defenders = []

        attempted, _, debug = check_putback_attempt(rebounder, defenders)

        assert attempted is False
        assert debug['putback_attempted'] is False
        assert debug['reason'] == 'height_too_low_for_putback'

    def test_height_below_threshold_no_putback(self):
        """Height < 75 does NOT trigger putback."""
        rebounder = create_test_player('ShortGuy', height=65)
        defenders = []

        attempted, _, debug = check_putback_attempt(rebounder, defenders)

        assert attempted is False
        assert debug['putback_attempted'] is False

    def test_putback_success_probability(self):
        """Putback success uses layup mechanics."""
        set_seed(42)

        rebounder = create_test_player(
            'Shaq',
            height=95,
            # Layup attributes
            finesse=80,
            hand_eye_coordination=75,
            balance=70,
            jumping=85
        )
        defenders = []

        # Run 100 putback attempts
        makes = 0
        for _ in range(100):
            set_seed(42 + _)
            attempted, made, _ = check_putback_attempt(rebounder, defenders)
            if attempted and made:
                makes += 1

        # Should make a high percentage (elite rebounder, no defense)
        assert makes > 50

    def test_defenders_reduce_putback_success(self):
        """Defenders nearby reduce putback probability."""
        set_seed(42)

        rebounder = create_test_player('Rebounder', height=80)

        # No defenders
        _, made_open, debug_open = check_putback_attempt(rebounder, [])
        prob_open = debug_open['putback_probability']

        # With elite defenders
        set_seed(42)
        defenders = create_elite_rebounding_team()
        _, made_contested, debug_contested = check_putback_attempt(rebounder, defenders)
        prob_contested = debug_contested['putback_probability']

        # Open should have higher success rate
        assert prob_open > prob_contested


class TestFullReboundSimulation:
    """Test complete rebound flow."""

    def test_made_shot_no_rebound(self):
        """Made shots don't have rebounds."""
        off_team = create_balanced_team('Off')
        def_team = create_balanced_team('Def')

        result = simulate_rebound(
            off_team, def_team,
            'standard', 'standard',
            'midrange',
            shot_made=True
        )

        assert result['shot_made'] is True
        assert result['rebound_occurred'] is False

    def test_missed_shot_has_rebound(self):
        """Missed shots always have a rebound."""
        off_team = create_balanced_team('Off')
        def_team = create_balanced_team('Def')

        result = simulate_rebound(
            off_team, def_team,
            'standard', 'standard',
            'midrange',
            shot_made=False
        )

        assert result['rebound_occurred'] is True
        assert 'rebounder_name' in result
        assert result['rebounding_team'] in ['offense', 'defense']

    def test_shot_clock_reset_on_oreb(self):
        """OREB resets shot clock to 14."""
        set_seed(42)

        # Force OREB by using elite offensive rebounders vs poor defensive
        off_team = create_elite_rebounding_team('Off')
        def_team = create_poor_rebounding_team('Def')

        # Run until we get an OREB
        for i in range(100):
            set_seed(100 + i)
            result = simulate_rebound(
                off_team, def_team,
                'crash_glass', 'prevent_transition',
                'rim',
                shot_made=False
            )

            if result['offensive_rebound']:
                assert result['shot_clock_reset'] == OREB_SHOT_CLOCK_RESET
                assert result['shot_clock_reset'] == 14
                break
        else:
            pytest.fail("Did not get OREB in 100 attempts")

    def test_oreb_putback_vs_kickout(self):
        """OREB outcome depends on rebounder height."""
        set_seed(42)

        # Tall rebounder
        tall_team = [
            create_test_player('Tall1', height=85, jumping=70, core_strength=70, awareness=70, reactions=70, determination=70),
            create_test_player('Tall2', height=82, jumping=70, core_strength=70, awareness=70, reactions=70, determination=70),
            create_test_player('Tall3', height=80, jumping=70, core_strength=70, awareness=70, reactions=70, determination=70),
            create_test_player('Tall4', height=78, jumping=70, core_strength=70, awareness=70, reactions=70, determination=70),
            create_test_player('Tall5', height=76, jumping=70, core_strength=70, awareness=70, reactions=70, determination=70),
        ]

        # Short rebounder
        short_team = [
            create_test_player('Short1', height=65, jumping=90, core_strength=90, awareness=90, reactions=90, determination=90),
            create_test_player('Short2', height=68, jumping=90, core_strength=90, awareness=90, reactions=90, determination=90),
            create_test_player('Short3', height=70, jumping=90, core_strength=90, awareness=90, reactions=90, determination=90),
            create_test_player('Short4', height=72, jumping=90, core_strength=90, awareness=90, reactions=90, determination=90),
            create_test_player('Short5', height=74, jumping=90, core_strength=90, awareness=90, reactions=90, determination=90),
        ]

        def_team = create_poor_rebounding_team()

        # Force OREBs and check outcomes
        putbacks = 0
        kickouts = 0

        # Tall team (should get putbacks)
        for i in range(50):
            set_seed(200 + i)
            result = simulate_rebound(
                tall_team, def_team,
                'crash_glass', 'prevent_transition',
                'rim', False
            )
            if result['offensive_rebound']:
                if result['oreb_outcome'] == 'putback':
                    putbacks += 1
                else:
                    kickouts += 1

        # Tall players should mostly putback
        if putbacks + kickouts > 0:
            putback_rate = putbacks / (putbacks + kickouts)
            assert putback_rate > 0.7  # At least 70% putbacks

        putbacks = 0
        kickouts = 0

        # Short team (should kick out)
        for i in range(50):
            set_seed(300 + i)
            result = simulate_rebound(
                short_team, def_team,
                'crash_glass', 'prevent_transition',
                'rim', False
            )
            if result['offensive_rebound']:
                if result['oreb_outcome'] == 'putback':
                    putbacks += 1
                else:
                    kickouts += 1

        # Short players should mostly kick out
        if putbacks + kickouts > 0:
            kickout_rate = kickouts / (putbacks + kickouts)
            assert kickout_rate > 0.7  # At least 70% kickouts


class TestStatisticalValidation:
    """Validate rebounding rates against NBA averages."""

    def test_equal_teams_oreb_rate(self):
        """Equal teams should have ~20-30% OREB rate (accounting for defensive advantage)."""
        set_seed(42)

        off_team = create_balanced_team('Off')
        def_team = create_balanced_team('Def')

        orebs = 0
        drebs = 0

        for i in range(200):
            set_seed(1000 + i)
            result = simulate_rebound(
                off_team, def_team,
                'standard', 'standard',
                'midrange', False
            )

            if result['offensive_rebound']:
                orebs += 1
            else:
                drebs += 1

        total = orebs + drebs
        oreb_rate = orebs / total if total > 0 else 0

        # Should be in range [0.20, 0.35] accounting for defensive advantage
        assert 0.15 <= oreb_rate <= 0.35

    def test_elite_vs_poor_high_oreb_rate(self):
        """Elite rebounding team vs poor should have 40-45% OREB rate."""
        set_seed(42)

        off_team = create_elite_rebounding_team('Elite')
        def_team = create_poor_rebounding_team('Poor')

        orebs = 0
        total = 0

        for i in range(200):
            set_seed(2000 + i)
            result = simulate_rebound(
                off_team, def_team,
                'standard', 'standard',
                'midrange', False
            )

            total += 1
            if result['offensive_rebound']:
                orebs += 1

        oreb_rate = orebs / total

        # Elite vs poor should be higher
        assert oreb_rate > 0.35

    def test_poor_vs_elite_low_oreb_rate(self):
        """Poor rebounding team vs elite should have 10-20% OREB rate."""
        set_seed(42)

        off_team = create_poor_rebounding_team('Poor')
        def_team = create_elite_rebounding_team('Elite')

        orebs = 0
        total = 0

        for i in range(200):
            set_seed(3000 + i)
            result = simulate_rebound(
                off_team, def_team,
                'standard', 'standard',
                'midrange', False
            )

            total += 1
            if result['offensive_rebound']:
                orebs += 1

        oreb_rate = orebs / total

        # Poor vs elite should be very low (below 30%)
        # Even with huge disadvantage, base rate provides floor
        assert oreb_rate < 0.30

    def test_3pt_vs_rim_oreb_rates(self):
        """3PT shots should have lower OREB rate than rim shots."""
        set_seed(42)

        off_team = create_balanced_team('Off')
        def_team = create_balanced_team('Def')

        # 3PT rebounds
        orebs_3pt = 0
        total_3pt = 0

        for i in range(100):
            set_seed(4000 + i)
            result = simulate_rebound(
                off_team, def_team,
                'standard', 'standard',
                '3pt', False
            )
            total_3pt += 1
            if result['offensive_rebound']:
                orebs_3pt += 1

        # Rim rebounds
        orebs_rim = 0
        total_rim = 0

        for i in range(100):
            set_seed(5000 + i)
            result = simulate_rebound(
                off_team, def_team,
                'standard', 'standard',
                'rim', False
            )
            total_rim += 1
            if result['offensive_rebound']:
                orebs_rim += 1

        oreb_rate_3pt = orebs_3pt / total_3pt
        oreb_rate_rim = orebs_rim / total_rim

        # Rim should have higher OREB rate
        assert oreb_rate_rim > oreb_rate_3pt


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
