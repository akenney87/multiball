"""
Unit tests for free throw probability calculations.

Tests the fix for Issue #6 (100% FT shooting bug).
"""

import pytest
from src.systems.free_throws import FreeThrowShooter, FREE_THROW_BASE_RATE, FREE_THROW_K


class TestFreeThrowProbability:
    """Test free throw probability calculations."""

    def test_ft_base_rate(self):
        """Verify base rate constant is correct."""
        assert FREE_THROW_BASE_RATE == 0.40, "Base rate should be 40%"

    def test_ft_k_value(self):
        """Verify k value for FT is higher than standard."""
        assert FREE_THROW_K == 0.04, "FT k should be 0.04 for NBA realism"

    def test_elite_shooter_ft_probability(self):
        """Elite shooters (90+ composite) should reach ~90% FT."""
        elite_shooter = {
            'name': 'Elite',
            'form_technique': 95,
            'throw_accuracy': 92,
            'finesse': 90,
            'hand_eye_coordination': 88,
            'balance': 85,
            'composure': 90,
            'consistency': 88,
            'agility': 75,
        }

        prob = FreeThrowShooter._calculate_free_throw_probability(
            elite_shooter, 'normal'
        )

        assert 0.88 <= prob <= 0.93, f"Elite shooter should be 88-93%, got {prob*100:.1f}%"

    def test_average_shooter_ft_probability(self):
        """Average shooters (65-70 composite) should be ~78%."""
        average_shooter = {
            'name': 'Average',
            'form_technique': 70,
            'throw_accuracy': 68,
            'finesse': 72,
            'hand_eye_coordination': 70,
            'balance': 70,
            'composure': 70,
            'consistency': 70,
            'agility': 68,
        }

        prob = FreeThrowShooter._calculate_free_throw_probability(
            average_shooter, 'normal'
        )

        assert 0.75 <= prob <= 0.85, f"Average shooter should be 75-85%, got {prob*100:.1f}%"

    def test_poor_shooter_ft_probability(self):
        """Poor shooters (45-50 composite) should be ~66-70%."""
        poor_shooter = {
            'name': 'Poor',
            'form_technique': 50,
            'throw_accuracy': 48,
            'finesse': 52,
            'hand_eye_coordination': 50,
            'balance': 55,
            'composure': 50,
            'consistency': 45,
            'agility': 50,
        }

        prob = FreeThrowShooter._calculate_free_throw_probability(
            poor_shooter, 'normal'
        )

        assert 0.63 <= prob <= 0.73, f"Poor shooter should be 63-73%, got {prob*100:.1f}%"

    def test_very_poor_shooter_ft_probability(self):
        """Very poor shooters (30-40 composite) should be ~58-65%."""
        very_poor_shooter = {
            'name': 'Very Poor (Shaq)',
            'form_technique': 35,
            'throw_accuracy': 30,
            'finesse': 25,
            'hand_eye_coordination': 30,
            'balance': 35,
            'composure': 28,
            'consistency': 25,
            'agility': 35,
        }

        prob = FreeThrowShooter._calculate_free_throw_probability(
            very_poor_shooter, 'normal'
        )

        assert 0.55 <= prob <= 0.68, f"Very poor shooter should be 55-68%, got {prob*100:.1f}%"

    def test_no_100_percent_ft(self):
        """No player should have 100% FT probability."""
        perfect_shooter = {
            'name': 'Perfect',
            'form_technique': 99,
            'throw_accuracy': 99,
            'finesse': 99,
            'hand_eye_coordination': 99,
            'balance': 99,
            'composure': 99,
            'consistency': 99,
            'agility': 99,
        }

        prob = FreeThrowShooter._calculate_free_throw_probability(
            perfect_shooter, 'normal'
        )

        assert prob < 0.99, f"Even perfect shooter should be < 99%, got {prob*100:.1f}%"

    def test_attribute_impact(self):
        """Better attributes should produce higher FT%."""
        shooters = []
        for composite in [40, 55, 70, 85]:
            shooter = {
                'name': f'Shooter_{composite}',
                'form_technique': composite,
                'throw_accuracy': composite,
                'finesse': composite,
                'hand_eye_coordination': composite,
                'balance': composite,
                'composure': composite,
                'consistency': composite,
                'agility': composite,
            }
            prob = FreeThrowShooter._calculate_free_throw_probability(
                shooter, 'normal'
            )
            shooters.append((composite, prob))

        # Verify monotonically increasing
        for i in range(len(shooters) - 1):
            assert shooters[i][1] < shooters[i+1][1], \
                f"Higher composite should have higher FT%: {shooters[i]} vs {shooters[i+1]}"

    def test_pressure_modifiers(self):
        """Pressure situations should modify FT probability."""
        shooter = {
            'name': 'Test',
            'form_technique': 80,
            'throw_accuracy': 78,
            'finesse': 80,
            'hand_eye_coordination': 78,
            'balance': 75,
            'composure': 80,
            'consistency': 75,
            'agility': 70,
        }

        prob_normal = FreeThrowShooter._calculate_free_throw_probability(
            shooter, 'normal'
        )
        prob_and1 = FreeThrowShooter._calculate_free_throw_probability(
            shooter, 'and_1'
        )
        prob_clutch = FreeThrowShooter._calculate_free_throw_probability(
            shooter, 'clutch'
        )
        prob_bonus = FreeThrowShooter._calculate_free_throw_probability(
            shooter, 'bonus'
        )

        # And-1 should be higher (confidence boost)
        assert prob_and1 > prob_normal, "And-1 should boost FT%"

        # Clutch should be lower (pressure)
        assert prob_clutch < prob_normal, "Clutch should decrease FT%"

        # Bonus should be lower (slight pressure)
        assert prob_bonus < prob_normal, "Bonus should decrease FT%"

    def test_weighted_sigmoid_formula(self):
        """Verify the formula matches spec: BaseRate + (1 - BaseRate) * sigmoid(k * (comp - 50))."""
        import math

        shooter = {
            'name': 'Test',
            'form_technique': 75,
            'throw_accuracy': 75,
            'finesse': 75,
            'hand_eye_coordination': 75,
            'balance': 75,
            'composure': 75,
            'consistency': 75,
            'agility': 75,
        }

        prob = FreeThrowShooter._calculate_free_throw_probability(
            shooter, 'normal'
        )

        # Manual calculation
        composite = 75.0
        sigmoid_input = FREE_THROW_K * (composite - 50.0)
        sigmoid_output = 1.0 / (1.0 + math.exp(-sigmoid_input))
        expected_prob = FREE_THROW_BASE_RATE + (1.0 - FREE_THROW_BASE_RATE) * sigmoid_output

        assert abs(prob - expected_prob) < 0.001, \
            f"Formula mismatch: got {prob}, expected {expected_prob}"


class TestFreeThrowSimulation:
    """Test actual FT simulation with dice rolls."""

    def test_ft_makes_and_misses_occur(self):
        """Over many simulations, both makes and misses should occur."""
        import random
        random.seed(42)

        shooter = {
            'name': 'Test',
            'form_technique': 70,
            'throw_accuracy': 68,
            'finesse': 72,
            'hand_eye_coordination': 70,
            'balance': 70,
            'composure': 70,
            'consistency': 70,
            'agility': 68,
        }

        results = []
        for _ in range(100):
            result = FreeThrowShooter.shoot_free_throws(
                shooter=shooter,
                attempts=1,
                situation='normal'
            )
            results.append(result.made)

        makes = sum(results)
        misses = 100 - makes

        assert makes > 0, "Should have some makes"
        assert misses > 0, "Should have some misses"
        assert 60 <= makes <= 90, f"Should be 60-90% make rate, got {makes}%"

    def test_ft_not_deterministic(self):
        """Multiple simulations should produce different results (not always 100%)."""
        import random
        random.seed(42)

        shooter = {
            'name': 'Test',
            'form_technique': 90,
            'throw_accuracy': 88,
            'finesse': 90,
            'hand_eye_coordination': 85,
            'balance': 85,
            'composure': 90,
            'consistency': 88,
            'agility': 75,
        }

        # Simulate 10 attempts
        results = []
        for _ in range(10):
            result = FreeThrowShooter.shoot_free_throws(
                shooter=shooter,
                attempts=1,
                situation='normal'
            )
            results.append(result.made)

        # Should NOT be all 1s (100%)
        assert sum(results) < 10, "Should not make all 10 FTs (not deterministic)"
        assert sum(results) > 5, "Should make most FTs (elite shooter)"


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
