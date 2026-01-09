"""
Debug script to identify free throw probability issue.

Tests free throw calculations with various player archetypes to expose
the 100% FT shooting bug.
"""

import sys
import random
from src.systems.free_throws import FreeThrowShooter, FREE_THROW_WEIGHTS

# Set seed for reproducibility
random.seed(42)

# Create test players with different shooting abilities
elite_shooter = {
    'name': 'Elite Shooter',
    'form_technique': 95,
    'throw_accuracy': 92,
    'finesse': 90,
    'hand_eye_coordination': 88,
    'balance': 85,
    'composure': 90,
    'consistency': 88,
    'agility': 75,
}

average_shooter = {
    'name': 'Average Shooter',
    'form_technique': 70,
    'throw_accuracy': 68,
    'finesse': 72,
    'hand_eye_coordination': 70,
    'balance': 70,
    'composure': 70,
    'consistency': 70,
    'agility': 68,
}

poor_shooter = {
    'name': 'Poor Shooter',
    'form_technique': 50,
    'throw_accuracy': 48,
    'finesse': 52,
    'hand_eye_coordination': 50,
    'balance': 55,
    'composure': 50,
    'consistency': 45,
    'agility': 50,
}

def calculate_manual_composite(player):
    """Manually calculate composite to verify."""
    composite = 0.0
    for attr, weight in FREE_THROW_WEIGHTS.items():
        composite += player[attr] * weight
    return composite

def test_probability_calculation(player):
    """Test the probability calculation for a player."""
    print(f"\n{'='*60}")
    print(f"Testing: {player['name']}")
    print(f"{'='*60}")

    # Calculate composite manually
    composite = calculate_manual_composite(player)
    print(f"FT Composite: {composite:.2f}")

    # Calculate probability using the system
    probability = FreeThrowShooter._calculate_free_throw_probability(
        player, 'normal'
    )
    print(f"FT Probability: {probability:.4f} ({probability*100:.2f}%)")

    # Simulate 1000 free throws
    attempts = 1000
    made = 0
    for _ in range(attempts):
        result = FreeThrowShooter.shoot_free_throws(
            shooter=player,
            attempts=1,
            situation='normal'
        )
        made += result.made

    actual_pct = (made / attempts) * 100
    print(f"1000 FT Simulation: {made}/{attempts} = {actual_pct:.2f}%")
    print(f"Expected (NBA): Elite ~90-95%, Average ~75-80%, Poor ~60-70%")

def main():
    """Run tests."""
    print("FREE THROW PROBABILITY DEBUG")
    print("="*60)

    test_probability_calculation(elite_shooter)
    test_probability_calculation(average_shooter)
    test_probability_calculation(poor_shooter)

    print(f"\n{'='*60}")
    print("ANALYSIS:")
    print("If all three show ~100% make rate, the formula is broken.")
    print("Expected: Elite ~92%, Average ~77%, Poor ~62%")
    print(f"{'='*60}")

if __name__ == '__main__':
    main()
