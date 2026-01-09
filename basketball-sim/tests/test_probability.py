"""
Unit Tests for Core Probability Engine

Validates all probability calculations, sigmoid functions, stamina system,
and composite calculations. Ensures mathematical correctness and bounds checking.
"""

import pytest
import math
import random
from src.core.probability import (
    sigmoid,
    calculate_composite,
    calculate_attribute_diff,
    weighted_sigmoid_probability,
    roll_success,
    weighted_random_choice,
    normalize_probabilities,
    apply_modifier,
    set_seed,
    calculate_stamina_penalty,
    apply_stamina_to_player,
)
from src.constants import SIGMOID_K, STAMINA_THRESHOLD


# =============================================================================
# SIGMOID FUNCTION TESTS
# =============================================================================

class TestSigmoidFunction:
    """Test core sigmoid function."""

    def test_sigmoid_zero(self):
        """Sigmoid(0) should equal 0.5."""
        assert sigmoid(0.0) == pytest.approx(0.5, abs=0.0001)

    def test_sigmoid_positive(self):
        """Positive input should give > 0.5."""
        assert sigmoid(1.0) > 0.5
        assert sigmoid(10.0) > 0.9

    def test_sigmoid_negative(self):
        """Negative input should give < 0.5."""
        assert sigmoid(-1.0) < 0.5
        assert sigmoid(-10.0) < 0.1

    def test_sigmoid_extreme_positive(self):
        """Very large positive values should saturate to 1.0."""
        assert sigmoid(100) == pytest.approx(1.0, abs=0.0001)
        assert sigmoid(1000) == pytest.approx(1.0, abs=0.0001)

    def test_sigmoid_extreme_negative(self):
        """Very large negative values should saturate to 0.0."""
        assert sigmoid(-100) == pytest.approx(0.0, abs=0.0001)
        assert sigmoid(-1000) == pytest.approx(0.0, abs=0.0001)

    def test_sigmoid_bounds(self):
        """Sigmoid always in [0, 1]."""
        test_values = [-1000, -100, -10, -1, 0, 1, 10, 100, 1000]
        for x in test_values:
            result = sigmoid(x)
            assert 0.0 <= result <= 1.0, f"sigmoid({x}) = {result} out of bounds"

    def test_sigmoid_symmetry(self):
        """Sigmoid(-x) + Sigmoid(x) should equal 1.0."""
        test_values = [0.5, 1.0, 2.0, 5.0, 10.0]
        for x in test_values:
            assert sigmoid(x) + sigmoid(-x) == pytest.approx(1.0, abs=0.0001)


# =============================================================================
# COMPOSITE CALCULATION TESTS
# =============================================================================

class TestCompositeCalculation:
    """Test weighted composite calculation."""

    def test_composite_simple(self):
        """Test composite with simple weights."""
        player = {
            'name': 'Test',
            'attr_a': 80,
            'attr_b': 60,
            'attr_c': 40,
        }
        weights = {
            'attr_a': 0.5,
            'attr_b': 0.3,
            'attr_c': 0.2,
        }

        expected = (80 * 0.5) + (60 * 0.3) + (40 * 0.2)
        # = 40 + 18 + 8 = 66

        result = calculate_composite(player, weights)
        assert result == pytest.approx(66.0, abs=0.01)

    def test_composite_all_same_value(self):
        """All attributes same value should equal that value."""
        player = {
            'name': 'Balanced',
            'a': 75,
            'b': 75,
            'c': 75,
        }
        weights = {
            'a': 0.33,
            'b': 0.33,
            'c': 0.34,
        }

        result = calculate_composite(player, weights)
        assert result == pytest.approx(75.0, abs=0.01)

    def test_composite_single_attribute(self):
        """Single attribute with 100% weight."""
        player = {
            'name': 'Single',
            'only_attr': 92,
        }
        weights = {
            'only_attr': 1.0,
        }

        result = calculate_composite(player, weights)
        assert result == pytest.approx(92.0, abs=0.01)

    def test_composite_missing_attribute(self):
        """Missing attribute should raise ValueError."""
        player = {
            'name': 'Missing',
            'attr_a': 50,
        }
        weights = {
            'attr_a': 0.5,
            'attr_b': 0.5,  # Not in player!
        }

        with pytest.raises(ValueError, match="missing attribute"):
            calculate_composite(player, weights)

    def test_composite_extreme_values(self):
        """Test with extreme attribute values (1 and 100)."""
        player = {
            'name': 'Extreme',
            'min': 1,
            'max': 100,
        }
        weights = {
            'min': 0.5,
            'max': 0.5,
        }

        expected = (1 * 0.5) + (100 * 0.5)
        # = 0.5 + 50 = 50.5

        result = calculate_composite(player, weights)
        assert result == pytest.approx(50.5, abs=0.01)


# =============================================================================
# ATTRIBUTE DIFF TESTS
# =============================================================================

class TestAttributeDiff:
    """Test attribute difference calculation."""

    def test_attribute_diff_equal(self):
        """Equal players should have diff = 0."""
        player_a = {'name': 'A', 'attr': 70}
        player_b = {'name': 'B', 'attr': 70}
        weights = {'attr': 1.0}

        off_comp, def_comp, diff = calculate_attribute_diff(
            player_a, player_b, weights, weights
        )

        assert off_comp == pytest.approx(70.0, abs=0.01)
        assert def_comp == pytest.approx(70.0, abs=0.01)
        assert diff == pytest.approx(0.0, abs=0.01)

    def test_attribute_diff_positive(self):
        """Offense better → positive diff."""
        player_offense = {'name': 'O', 'attr': 90}
        player_defense = {'name': 'D', 'attr': 50}
        weights = {'attr': 1.0}

        off_comp, def_comp, diff = calculate_attribute_diff(
            player_offense, player_defense, weights, weights
        )

        assert diff == pytest.approx(40.0, abs=0.01)

    def test_attribute_diff_negative(self):
        """Defense better → negative diff."""
        player_offense = {'name': 'O', 'attr': 40}
        player_defense = {'name': 'D', 'attr': 85}
        weights = {'attr': 1.0}

        off_comp, def_comp, diff = calculate_attribute_diff(
            player_offense, player_defense, weights, weights
        )

        assert diff == pytest.approx(-45.0, abs=0.01)

    def test_attribute_diff_different_weights(self):
        """Test with different offensive and defensive weights."""
        player_offense = {
            'name': 'O',
            'shooting': 90,
            'speed': 50,
        }
        player_defense = {
            'name': 'D',
            'shooting': 30,
            'speed': 80,
        }

        off_weights = {
            'shooting': 0.8,
            'speed': 0.2,
        }
        def_weights = {
            'shooting': 0.3,
            'speed': 0.7,
        }

        off_comp, def_comp, diff = calculate_attribute_diff(
            player_offense, player_defense, off_weights, def_weights
        )

        # Off composite: 90*0.8 + 50*0.2 = 72 + 10 = 82
        # Def composite: 30*0.3 + 80*0.7 = 9 + 56 = 65
        # Diff: 82 - 65 = 17

        assert off_comp == pytest.approx(82.0, abs=0.01)
        assert def_comp == pytest.approx(65.0, abs=0.01)
        assert diff == pytest.approx(17.0, abs=0.01)


# =============================================================================
# WEIGHTED SIGMOID PROBABILITY TESTS
# =============================================================================

class TestWeightedSigmoidProbability:
    """Test core probability formula."""

    def test_probability_equal_matchup(self):
        """Equal matchup (diff=0) should give base rate + 0.5 * (1 - base)."""
        base_rate = 0.30
        diff = 0.0

        result = weighted_sigmoid_probability(base_rate, diff)

        # Expected: 0.30 + (1 - 0.30) * 0.5 = 0.30 + 0.35 = 0.65
        expected = base_rate + (1.0 - base_rate) * 0.5

        assert result == pytest.approx(expected, abs=0.001)

    def test_probability_elite_vs_poor(self):
        """Elite vs poor (large positive diff) should be high success."""
        base_rate = 0.30
        diff = 60.0  # Elite 90 vs Poor 30

        result = weighted_sigmoid_probability(base_rate, diff, k=SIGMOID_K)

        # Should be significantly > base_rate
        assert result > 0.75
        # Should be bounded
        assert 0.0 <= result <= 1.0

    def test_probability_poor_vs_elite(self):
        """Poor vs elite (large negative diff) should be low success."""
        base_rate = 0.30
        diff = -60.0  # Poor 30 vs Elite 90

        result = weighted_sigmoid_probability(base_rate, diff, k=SIGMOID_K)

        # Should be significantly < base_rate + half
        assert result < 0.50
        # Should be bounded
        assert 0.0 <= result <= 1.0

    def test_probability_bounds_extreme(self):
        """Extreme diffs should still respect [0, 1] bounds."""
        base_rate = 0.30
        extreme_diffs = [-1000, -100, 100, 1000]

        for diff in extreme_diffs:
            result = weighted_sigmoid_probability(base_rate, diff)
            assert 0.0 <= result <= 1.0, f"Probability {result} out of bounds for diff={diff}"

    def test_probability_high_base_rate(self):
        """High base rate (dunks) should stay high."""
        base_rate = 0.80
        diff = 0.0

        result = weighted_sigmoid_probability(base_rate, diff)

        # Expected: 0.80 + (1 - 0.80) * 0.5 = 0.80 + 0.10 = 0.90
        assert result == pytest.approx(0.90, abs=0.01)

    def test_probability_low_base_rate(self):
        """Low base rate should allow for growth."""
        base_rate = 0.10
        diff = 30.0  # Moderate advantage

        result = weighted_sigmoid_probability(base_rate, diff)

        # Should increase from 0.10
        assert result > 0.10
        # But still bounded
        assert result <= 1.0


# =============================================================================
# ROLL SUCCESS TESTS
# =============================================================================

class TestRollSuccess:
    """Test dice roll success function."""

    def test_roll_100_percent(self):
        """Probability 1.0 should always succeed."""
        set_seed(42)

        results = [roll_success(1.0) for _ in range(100)]

        assert all(results), "100% probability should always succeed"

    def test_roll_0_percent(self):
        """Probability 0.0 should always fail."""
        set_seed(42)

        results = [roll_success(0.0) for _ in range(100)]

        assert not any(results), "0% probability should always fail"

    def test_roll_50_percent(self):
        """50% probability should succeed ~50% of time."""
        set_seed(42)

        results = [roll_success(0.5) for _ in range(1000)]
        success_rate = sum(results) / len(results)

        # Allow ±10% variance
        assert 0.40 <= success_rate <= 0.60

    def test_roll_invalid_probability(self):
        """Probabilities outside [0, 1] should raise ValueError."""
        with pytest.raises(ValueError):
            roll_success(1.5)

        with pytest.raises(ValueError):
            roll_success(-0.1)


# =============================================================================
# WEIGHTED RANDOM CHOICE TESTS
# =============================================================================

class TestWeightedRandomChoice:
    """Test weighted selection function."""

    def test_choice_single_item(self):
        """Single item should always be selected."""
        set_seed(42)

        items = ['only']
        weights = [1.0]

        for _ in range(10):
            result = weighted_random_choice(items, weights)
            assert result == 'only'

    def test_choice_equal_weights(self):
        """Equal weights should give roughly equal distribution."""
        set_seed(42)

        items = ['A', 'B', 'C']
        weights = [1.0, 1.0, 1.0]

        results = [weighted_random_choice(items, weights) for _ in range(300)]
        counts = {item: results.count(item) for item in items}

        # Each should get ~100 ± 30
        for count in counts.values():
            assert 70 <= count <= 130

    def test_choice_heavily_weighted(self):
        """Heavily weighted item should be selected more often."""
        set_seed(42)

        items = ['Heavy', 'Light']
        weights = [90.0, 10.0]  # 90% vs 10%

        results = [weighted_random_choice(items, weights) for _ in range(1000)]
        heavy_count = results.count('Heavy')

        # Should be ~90% ± 5%
        assert 850 <= heavy_count <= 950

    def test_choice_normalizes_weights(self):
        """Weights that don't sum to 1.0 should be normalized."""
        set_seed(42)

        items = ['A', 'B']
        weights = [2.0, 2.0]  # Sum = 4.0, normalized to 0.5 each

        results = [weighted_random_choice(items, weights) for _ in range(200)]
        a_count = results.count('A')

        # Should be ~50%
        assert 80 <= a_count <= 120

    def test_choice_empty_list(self):
        """Empty list should raise ValueError."""
        with pytest.raises(ValueError):
            weighted_random_choice([], [])

    def test_choice_mismatched_lengths(self):
        """Mismatched items/weights should raise ValueError."""
        with pytest.raises(ValueError):
            weighted_random_choice(['A', 'B'], [1.0])

    def test_choice_zero_total_weight(self):
        """All zero weights should raise ValueError."""
        with pytest.raises(ValueError):
            weighted_random_choice(['A', 'B'], [0.0, 0.0])


# =============================================================================
# NORMALIZE PROBABILITIES TESTS
# =============================================================================

class TestNormalizeProbabilities:
    """Test probability normalization."""

    def test_normalize_already_normalized(self):
        """Already normalized probs should stay same."""
        probs = {'A': 0.3, 'B': 0.5, 'C': 0.2}

        result = normalize_probabilities(probs)

        assert result == pytest.approx(probs, abs=0.001)

    def test_normalize_not_normalized(self):
        """Non-normalized probs should sum to 1.0."""
        probs = {'A': 0.4, 'B': 0.3, 'C': 0.1}  # Sum = 0.8

        result = normalize_probabilities(probs)

        # Should sum to 1.0
        assert sum(result.values()) == pytest.approx(1.0, abs=0.001)

        # Ratios should be preserved
        assert result['A'] / result['B'] == pytest.approx(0.4 / 0.3, abs=0.01)

    def test_normalize_large_values(self):
        """Large values should normalize correctly."""
        probs = {'A': 100, 'B': 200, 'C': 300}  # Sum = 600

        result = normalize_probabilities(probs)

        assert sum(result.values()) == pytest.approx(1.0, abs=0.001)
        assert result['C'] == pytest.approx(0.5, abs=0.01)  # 300/600

    def test_normalize_zero_total(self):
        """All zero should raise ValueError."""
        with pytest.raises(ValueError):
            normalize_probabilities({'A': 0.0, 'B': 0.0})


# =============================================================================
# APPLY MODIFIER TESTS
# =============================================================================

class TestApplyModifier:
    """Test modifier application."""

    def test_additive_modifier_positive(self):
        """Positive additive modifier increases probability."""
        base = 0.50
        modifier = 0.20

        result = apply_modifier(base, modifier, 'additive')

        assert result == pytest.approx(0.70, abs=0.01)

    def test_additive_modifier_negative(self):
        """Negative additive modifier decreases probability."""
        base = 0.50
        modifier = -0.15

        result = apply_modifier(base, modifier, 'additive')

        assert result == pytest.approx(0.35, abs=0.01)

    def test_additive_modifier_clamped_high(self):
        """Additive modifier clamped at 1.0."""
        base = 0.90
        modifier = 0.20

        result = apply_modifier(base, modifier, 'additive')

        assert result == 1.0

    def test_additive_modifier_clamped_low(self):
        """Additive modifier clamped at 0.0."""
        base = 0.10
        modifier = -0.20

        result = apply_modifier(base, modifier, 'additive')

        assert result == 0.0

    def test_multiplicative_modifier(self):
        """Multiplicative modifier scales probability."""
        base = 0.50
        modifier = 1.20  # +20%

        result = apply_modifier(base, modifier, 'multiplicative')

        assert result == pytest.approx(0.60, abs=0.01)

    def test_multiplicative_modifier_decrease(self):
        """Multiplicative modifier can decrease."""
        base = 0.60
        modifier = 0.80  # -20%

        result = apply_modifier(base, modifier, 'multiplicative')

        assert result == pytest.approx(0.48, abs=0.01)

    def test_invalid_modifier_type(self):
        """Invalid modifier type should raise ValueError."""
        with pytest.raises(ValueError):
            apply_modifier(0.5, 0.1, 'invalid')


# =============================================================================
# STAMINA PENALTY TESTS
# =============================================================================

class TestStaminaPenalty:
    """Test stamina degradation formula."""

    def test_stamina_above_threshold_no_penalty(self):
        """Stamina >= 80 should have no penalty."""
        assert calculate_stamina_penalty(100) == 0.0
        assert calculate_stamina_penalty(90) == 0.0
        assert calculate_stamina_penalty(80) == 0.0

    def test_stamina_below_threshold_has_penalty(self):
        """Stamina < 80 should have penalty."""
        assert calculate_stamina_penalty(79) > 0.0
        assert calculate_stamina_penalty(60) > 0.0
        assert calculate_stamina_penalty(40) > 0.0

    def test_stamina_penalty_increases_with_deficit(self):
        """Lower stamina → higher penalty."""
        penalty_60 = calculate_stamina_penalty(60)
        penalty_40 = calculate_stamina_penalty(40)
        penalty_20 = calculate_stamina_penalty(20)

        assert penalty_60 < penalty_40 < penalty_20

    def test_stamina_penalty_exponential(self):
        """Penalty should be exponential (power = 1.3)."""
        # Penalty formula: 0.2 * (80 - stamina) ** 1.3

        stamina = 60
        deficit = 80 - 60  # = 20
        expected = 0.2 * (deficit ** 1.3)

        result = calculate_stamina_penalty(60)

        assert result == pytest.approx(expected, abs=0.001)

    def test_stamina_penalty_capped_at_100_percent(self):
        """Penalty capped at 1.0 (100% degradation)."""
        result = calculate_stamina_penalty(0)

        assert result <= 1.0

    def test_stamina_penalty_specific_values(self):
        """Test specific stamina values from spec examples."""
        # These are approximate from Section 11.4

        # Stamina 60: ~3.6% penalty
        assert 0.03 <= calculate_stamina_penalty(60) <= 0.05

        # Stamina 40: ~9.8% penalty
        assert 0.08 <= calculate_stamina_penalty(40) <= 0.12

        # Stamina 20: ~19.2% penalty
        assert 0.17 <= calculate_stamina_penalty(20) <= 0.22


# =============================================================================
# APPLY STAMINA TO PLAYER TESTS
# =============================================================================

class TestApplyStaminaToPlayer:
    """Test stamina degradation application to player."""

    def test_apply_stamina_no_degradation(self):
        """Stamina >= 80 should return original player."""
        player = {
            'name': 'Test',
            'shooting': 90,
            'defense': 80,
        }

        result = apply_stamina_to_player(player, 100)

        # Should be same object (no copy needed)
        assert result is player

    def test_apply_stamina_with_degradation(self):
        """Stamina < 80 should degrade all attributes."""
        player = {
            'name': 'Fatigued',
            'shooting': 80,
            'defense': 60,
            'speed': 70,
        }

        result = apply_stamina_to_player(player, 60)

        # Should be new object
        assert result is not player

        # Attributes should be degraded
        assert result['shooting'] < player['shooting']
        assert result['defense'] < player['defense']
        assert result['speed'] < player['speed']

        # Name should be unchanged
        assert result['name'] == player['name']

    def test_apply_stamina_floor_at_1(self):
        """Degraded attributes should not go below 1."""
        player = {
            'name': 'Exhausted',
            'attribute': 5,
        }

        # Extreme fatigue (should cause massive penalty)
        result = apply_stamina_to_player(player, 0)

        # Should be at least 1
        assert result['attribute'] >= 1.0

    def test_apply_stamina_preserves_ratios(self):
        """Stamina degradation should preserve attribute ratios."""
        player = {
            'name': 'Test',
            'high': 90,
            'low': 30,
        }

        original_ratio = player['high'] / player['low']

        result = apply_stamina_to_player(player, 50)

        degraded_ratio = result['high'] / result['low']

        # Ratios should be approximately preserved
        assert degraded_ratio == pytest.approx(original_ratio, abs=0.1)

    def test_apply_stamina_stores_current_stamina(self):
        """Degraded player should store current_stamina."""
        player = {
            'name': 'Test',
            'attribute': 50,
        }

        result = apply_stamina_to_player(player, 65)

        assert 'current_stamina' in result
        assert result['current_stamina'] == 65


# =============================================================================
# SEED CONTROL TESTS
# =============================================================================

class TestSeedControl:
    """Test random seed control."""

    def test_set_seed_reproducibility(self):
        """Same seed should give same random sequence."""
        set_seed(42)
        sequence1 = [random.random() for _ in range(10)]

        set_seed(42)
        sequence2 = [random.random() for _ in range(10)]

        assert sequence1 == sequence2

    def test_different_seeds_different_sequences(self):
        """Different seeds should give different sequences."""
        set_seed(42)
        sequence1 = [random.random() for _ in range(10)]

        set_seed(123)
        sequence2 = [random.random() for _ in range(10)]

        assert sequence1 != sequence2


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
