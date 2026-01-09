"""
Basketball Simulator - Free Throws System (M3 Phase 2a)

Handles free throw shooting mechanics and execution.

Key Responsibilities:
1. Execute free throw attempts with attribute-driven probabilities
2. Apply pressure modifiers (bonus, clutch, and-1)
3. Track free throw results (made/missed)
4. Generate play-by-play descriptions

Integrates with:
- src/systems/fouls.py (receives free throw allocation)
- src/systems/possession.py (free throw outcomes affect score)
- src/core/probability.py (sigmoid formula)

Formula (from basketball_sim.md Section 4.7):
- BaseRate: 40%
- Same attribute weights as 3PT shooting
- Pressure modifiers: bonus (-3%), clutch (-5%), and-1 (+5%)
"""

from typing import Dict, List, Any, Tuple
from dataclasses import dataclass
import random

from ..core.probability import calculate_composite, sigmoid, apply_consistency_variance
from ..constants import SIGMOID_K


# =============================================================================
# FREE THROW DATA STRUCTURES
# =============================================================================

@dataclass
class FreeThrowResult:
    """
    Result of free throw attempt(s).

    Attributes:
        shooter: Name of player shooting
        attempts: Number of free throws attempted
        made: Number of free throws made
        points_scored: Points scored (sum of makes)
        results: List of individual results (True=made, False=missed)
        situation: 'bonus', 'clutch', 'and_1', or 'normal'
    """
    shooter: str
    attempts: int
    made: int
    points_scored: int
    results: List[bool]
    situation: str


# =============================================================================
# FREE THROW PROBABILITY CONSTANTS
# =============================================================================

# Base rate (from basketball_sim.md Section 4.7)
# M4.1 RECALIBRATION: Increased from 0.50 to 0.55 to achieve NBA-realistic 75-78% team average
# M4 validation showed 70.9% with 0.50, need +5% to reach target
FREE_THROW_BASE_RATE = 0.55

# Sigmoid k value for free throws (tuned for NBA realism)
# k=0.02 (standard sigmoid) produces more realistic spread across player composites
# For rosters with avg composite ~75: produces team FT% ~77%
# Elite shooters (90): ~80%, Poor shooters (50): ~67%
# Previously k=0.03 and k=0.04 were too high
FREE_THROW_K = 0.02

# Attribute weights (same as 3PT shooting)
FREE_THROW_WEIGHTS = {
    'form_technique': 0.25,
    'throw_accuracy': 0.20,
    'finesse': 0.15,
    'hand_eye_coordination': 0.12,
    'balance': 0.10,
    'composure': 0.08,
    'consistency': 0.06,
    'agility': 0.04,
}

# Pressure modifiers (from FOULS_AND_INJURIES_SPEC.md)
PRESSURE_MODIFIERS = {
    'bonus': -0.03,      # Slight pressure (-3%)
    'clutch': -0.05,     # Q4, <2 min, close game (-5%)
    'and_1': +0.05,      # Confidence boost (+5%)
    'normal': 0.0,       # No modifier
}


# =============================================================================
# FREE THROW SHOOTER CLASS
# =============================================================================

class FreeThrowShooter:
    """
    Executes free throw attempts with NBA-realistic probabilities.
    """

    @staticmethod
    def shoot_free_throws(
        shooter: Dict[str, Any],
        attempts: int,
        situation: str = 'normal',
        quarter: int = 1,
        time_remaining: int = 720,
        score_differential: int = 0
    ) -> FreeThrowResult:
        """
        Execute free throw attempt(s).

        Args:
            shooter: Player shooting free throws
            attempts: Number of free throws (1, 2, or 3)
            situation: 'and_1', 'bonus', 'clutch', or 'normal'
            quarter: Current quarter (for clutch detection)
            time_remaining: Seconds remaining in quarter (for clutch detection)
            score_differential: Score difference (for clutch detection)

        Returns:
            FreeThrowResult with outcomes
        """
        # Detect clutch situation
        is_clutch = (
            quarter == 4 and
            time_remaining <= 120 and  # <2 minutes
            abs(score_differential) <= 5  # Close game
        )

        # Determine pressure situation
        if is_clutch:
            pressure_situation = 'clutch'
        elif situation == 'and_1':
            pressure_situation = 'and_1'
        elif situation == 'bonus':
            pressure_situation = 'bonus'
        else:
            pressure_situation = 'normal'

        # Calculate free throw probability
        ft_probability = FreeThrowShooter._calculate_free_throw_probability(
            shooter,
            pressure_situation
        )

        # Shoot free throws
        results = []
        made_count = 0

        for _ in range(attempts):
            # PHASE 3D: Apply consistency variance to each FT
            ft_prob_with_variance = apply_consistency_variance(ft_probability, shooter, action_type="free_throw")
            made = random.random() < ft_prob_with_variance
            results.append(made)
            if made:
                made_count += 1

        return FreeThrowResult(
            shooter=shooter['name'],
            attempts=attempts,
            made=made_count,
            points_scored=made_count,  # Each FT worth 1 point
            results=results,
            situation=pressure_situation
        )

    @staticmethod
    def _calculate_free_throw_probability(
        shooter: Dict[str, Any],
        situation: str
    ) -> float:
        """
        Calculate free throw success probability.

        Args:
            shooter: Player shooting
            situation: 'bonus', 'clutch', 'and_1', or 'normal'

        Returns:
            Probability of making free throw (0.0-1.0)

        Formula (from basketball_sim.md Section 4.7):
            FT_Composite = weighted_sum(shooter_attributes, FREE_THROW_WEIGHTS)
            P_make = BaseRate + (1 - BaseRate) * sigmoid(k * (FT_Composite - 50))
            P_make += Pressure_Modifier
            P_make = clamp(P_make, 0.0, 1.0)

        Where:
            BaseRate = 0.40 (40%)
            k = 0.02 (SIGMOID_K)
            50 = league average composite (centering)
            Elite shooters (90+ composite) reach ~92%
            Average shooters (70 composite) reach ~77%
            Poor shooters (50 composite) reach ~65%
        """
        # Calculate attribute composite
        ft_composite = calculate_composite(shooter, FREE_THROW_WEIGHTS)

        # M4.5 PHASE 4 DEBUG: Log actual composite being used (DISABLED for validation)
        # shooter_name = shooter.get('name', 'Unknown')
        # print(f"DEBUG FT CALC: {shooter_name} composite={ft_composite:.1f}, form={shooter.get('form_technique', 50):.1f}")

        # Apply weighted sigmoid formula (center around league average of 50)
        # P = BaseRate + (1 - BaseRate) * sigmoid(k * (composite - 50))
        composite_diff = ft_composite - 50.0  # Center around league average
        sigmoid_input = FREE_THROW_K * composite_diff
        sigmoid_output = sigmoid(sigmoid_input)

        # Weighted sigmoid: multiply by (1 - BaseRate) = 0.60
        attribute_bonus = (1.0 - FREE_THROW_BASE_RATE) * sigmoid_output

        # Get pressure modifier
        pressure_modifier = PRESSURE_MODIFIERS.get(situation, 0.0)

        # Final probability
        probability = FREE_THROW_BASE_RATE + attribute_bonus + pressure_modifier

        # Clamp to valid range
        probability = max(0.0, min(1.0, probability))

        return probability

    @staticmethod
    def generate_free_throw_description(
        ft_result: FreeThrowResult,
        foul_type: str,
        current_score: Tuple[int, int]
    ) -> str:
        """
        Generate play-by-play description of free throws.

        Args:
            ft_result: Free throw result
            foul_type: 'shooting', 'and_1', 'bonus'
            current_score: (home_score, away_score) before free throws

        Returns:
            Formatted play-by-play string
        """
        lines = []

        # Header
        if foul_type == 'and_1':
            lines.append(f"{ft_result.shooter} to the line for the and-1...")
        elif ft_result.attempts == 3:
            lines.append(f"{ft_result.shooter} to the line for 3 free throws...")
        elif ft_result.attempts == 2:
            lines.append(f"{ft_result.shooter} to the line for 2 free throws...")
        else:
            lines.append(f"{ft_result.shooter} to the line for 1 free throw...")

        # Individual results
        for i, made in enumerate(ft_result.results, 1):
            if made:
                lines.append(f"  FT {i}/{ft_result.attempts}: GOOD")
            else:
                lines.append(f"  FT {i}/{ft_result.attempts}: MISS")

        # Summary
        lines.append(f"{ft_result.shooter} makes {ft_result.made}/{ft_result.attempts} from the line.")

        return "\n".join(lines)


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def simulate_free_throw_sequence(
    shooter: Dict[str, Any],
    free_throws: int,
    and_one: bool = False,
    quarter: int = 1,
    time_remaining: int = 720,
    score_differential: int = 0
) -> FreeThrowResult:
    """
    Convenience function to simulate free throw sequence.

    Args:
        shooter: Player shooting
        free_throws: Number of free throws (1, 2, or 3)
        and_one: True if this is an and-1 situation
        quarter: Current quarter
        time_remaining: Seconds remaining
        score_differential: Score difference

    Returns:
        FreeThrowResult
    """
    situation = 'and_1' if and_one else 'normal'

    return FreeThrowShooter.shoot_free_throws(
        shooter=shooter,
        attempts=free_throws,
        situation=situation,
        quarter=quarter,
        time_remaining=time_remaining,
        score_differential=score_differential
    )
