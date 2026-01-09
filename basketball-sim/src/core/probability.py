"""
Basketball Simulator - Probability Engine

Core probability calculations using weighted sigmoid formulas.
All dice-roll mechanics flow through this module.
"""

import math
import random
from typing import Dict, Any, List, Tuple

from ..constants import SIGMOID_K, CONSISTENCY_VARIANCE_SCALE


def sigmoid(x: float) -> float:
    """
    Logistic sigmoid function.

    Args:
        x: Input value

    Returns:
        1 / (1 + exp(-x))

    Handles extreme values to prevent overflow.
    """
    # Prevent overflow for extreme values
    if x > 100:
        return 1.0
    if x < -100:
        return 0.0

    try:
        return 1.0 / (1.0 + math.exp(-x))
    except OverflowError:
        # Fallback for edge cases
        return 0.0 if x < 0 else 1.0


def calculate_composite(
    player: Dict[str, Any],
    attribute_weights: Dict[str, float]
) -> float:
    """
    Calculate weighted attribute composite for a player.

    Args:
        player: Player dictionary with all attributes
        attribute_weights: Dict mapping attribute names to weights (must sum to 1.0)

    Returns:
        Weighted average composite score (typically 1-100 range)

    Example:
        >>> weights = {'form_technique': 0.25, 'throw_accuracy': 0.20, ...}
        >>> composite = calculate_composite(curry, weights)
        >>> # Returns ~90.0 for elite shooter
    """
    composite = 0.0

    for attribute, weight in attribute_weights.items():
        if attribute not in player:
            raise ValueError(
                f"Player {player.get('name', 'Unknown')} missing attribute '{attribute}'"
            )

        composite += player[attribute] * weight

    return composite


def calculate_attribute_diff(
    offensive_player: Dict[str, Any],
    defensive_player: Dict[str, Any],
    offensive_weights: Dict[str, float],
    defensive_weights: Dict[str, float]
) -> Tuple[float, float, float]:
    """
    Calculate offensive and defensive composites, then compute difference.

    Args:
        offensive_player: Offensive player dict
        defensive_player: Defensive player dict
        offensive_weights: Attribute weights for offense
        defensive_weights: Attribute weights for defense

    Returns:
        Tuple of (offensive_composite, defensive_composite, attribute_diff)
    """
    offensive_composite = calculate_composite(offensive_player, offensive_weights)
    defensive_composite = calculate_composite(defensive_player, defensive_weights)
    attribute_diff = offensive_composite - defensive_composite

    return offensive_composite, defensive_composite, attribute_diff


def weighted_sigmoid_probability(
    base_rate: float,
    attribute_diff: float,
    k: float = SIGMOID_K
) -> float:
    """
    Core probability formula using CENTERED weighted sigmoid.

    Formula:
        centered = (sigmoid(k * AttributeDiff) - 0.5) * 2.0  # Range: -1 to +1
        if centered >= 0:
            P = BaseRate + (1 - BaseRate) * centered
        else:
            P = BaseRate * (1 + centered)

    At diff=0: sigmoid=0.5, centered=0, P=BaseRate (CORRECT)

    Args:
        base_rate: Base success probability (e.g., 0.30 for 3PT)
        attribute_diff: Offensive composite - Defensive composite
        k: Sigmoid steepness (default 0.02 from constants)

    Returns:
        Final probability in [0, 1]

    Examples:
        >>> # Equal players (diff=0)
        >>> weighted_sigmoid_probability(0.30, 0, 0.02)
        0.30  # Base rate (correct)

        >>> # Elite shooter (90) vs poor defender (30), 3PT shot
        >>> weighted_sigmoid_probability(0.30, 60, 0.02)
        ~0.72  # Higher success

        >>> # Poor shooter (30) vs elite defender (90), 3PT shot
        >>> weighted_sigmoid_probability(0.30, -60, 0.02)
        ~0.09  # Lower success
    """
    # Cap attribute difference to prevent extreme outcomes
    # Even All-99 vs All-1 should produce realistic basketball outcomes
    # ±40 cap prevents probabilities from reaching 0% or 100%
    capped_diff = max(-40.0, min(40.0, attribute_diff))

    # Calculate sigmoid
    sigmoid_input = k * capped_diff
    sigmoid_output = sigmoid(sigmoid_input)

    # Center sigmoid around base_rate
    # When diff=0: sigmoid=0.5, centered=0, probability=base_rate
    centered = (sigmoid_output - 0.5) * 2.0  # Range: -1 to +1

    if centered >= 0:
        # Positive advantage: scale toward 1.0
        probability = base_rate + (1.0 - base_rate) * centered
    else:
        # Negative advantage: scale toward 0.0
        probability = base_rate * (1.0 + centered)

    # Apply realistic floor (5%) and ceiling (95%)
    # No shot should be impossible (0%) or guaranteed (100%) in basketball
    probability = max(0.05, min(0.95, probability))

    return probability


def roll_success(probability: float) -> bool:
    """
    Roll weighted dice to determine success/failure.

    Args:
        probability: Success probability in [0, 1]

    Returns:
        True if successful, False otherwise
    """
    if not 0.0 <= probability <= 1.0:
        raise ValueError(f"Probability {probability} out of range [0, 1]")

    return random.random() < probability


def apply_consistency_variance(
    base_probability: float,
    player: Dict[str, Any],
    action_type: str = "general"
) -> float:
    """
    Apply consistency-based variance to final probability.

    PHASE 3D: Consistency attribute affects variance in all probability rolls.
    High consistency = tight variance (predictable)
    Low consistency = wide variance (boom-or-bust)

    Args:
        base_probability: Base probability before variance (0.0-1.0)
        player: Player dict with 'consistency' attribute
        action_type: Type of action (for future expansion, currently unused)

    Returns:
        Final probability with variance applied, clamped to [0,1]

    Formula:
        variance_scale = abs((consistency - 50) * CONSISTENCY_VARIANCE_SCALE)
        variance = random.uniform(-variance_scale, variance_scale)
        final_prob = base_probability + variance
        return clamp(final_prob, 0.0, 1.0)

    Examples:
        consistency=90, base=0.70 → final in [0.692, 0.708] (±0.8%)
        consistency=50, base=0.70 → final = 0.70 (±0%, baseline)
        consistency=10, base=0.70 → final in [0.620, 0.780] (±8%)
    """
    consistency = player.get('consistency', 50)

    # Calculate variance scale based on consistency
    # High consistency (>50) = tight variance (±0.8% at 90)
    # Low consistency (<50) = wide variance (±8% at 10)
    # Use different scales for above/below baseline
    distance_from_baseline = abs(consistency - 50)

    if consistency >= 50:
        # High consistency: small scale (0.0002)
        variance_scale = distance_from_baseline * CONSISTENCY_VARIANCE_SCALE
    else:
        # Low consistency: large scale (0.002 = 10x more variance)
        variance_scale = distance_from_baseline * (CONSISTENCY_VARIANCE_SCALE * 10)

    # Generate random variance within scale
    variance = random.uniform(-variance_scale, variance_scale)

    # Apply variance to base probability
    final_prob = base_probability + variance

    # Clamp to valid probability range [0, 1]
    return max(0.0, min(1.0, final_prob))


def weighted_random_choice(
    items: List[Any],
    weights: List[float]
) -> Any:
    """
    Select item from list using weighted probabilities.

    Args:
        items: List of items to choose from
        weights: Corresponding weights (need not sum to 1, will be normalized)

    Returns:
        Selected item

    Raises:
        ValueError: If items/weights lengths don't match or weights are invalid
    """
    if len(items) != len(weights):
        raise ValueError(f"Items ({len(items)}) and weights ({len(weights)}) must have same length")

    if not items:
        raise ValueError("Cannot choose from empty list")

    # Normalize weights
    total_weight = sum(weights)
    if total_weight <= 0:
        raise ValueError(f"Total weight must be positive, got {total_weight}")

    normalized_weights = [w / total_weight for w in weights]

    # Cumulative distribution
    cumulative = []
    cumsum = 0.0
    for w in normalized_weights:
        cumsum += w
        cumulative.append(cumsum)

    # Roll and select
    roll = random.random()
    for i, threshold in enumerate(cumulative):
        if roll <= threshold:
            return items[i]

    # Fallback (should never reach due to normalization)
    return items[-1]


def normalize_probabilities(probabilities: Dict[str, float]) -> Dict[str, float]:
    """
    Normalize probabilities to sum to 1.0.

    Args:
        probabilities: Dict mapping outcomes to probabilities

    Returns:
        Normalized dict

    Example:
        >>> normalize_probabilities({'3pt': 0.42, 'mid': 0.18, 'rim': 0.38})
        {'3pt': 0.43, 'mid': 0.18, 'rim': 0.39}  # Adjusted to sum to 1.0
    """
    total = sum(probabilities.values())

    if total <= 0:
        raise ValueError(f"Total probability must be positive, got {total}")

    return {outcome: prob / total for outcome, prob in probabilities.items()}


def apply_modifier(
    base_probability: float,
    modifier: float,
    modifier_type: str = 'additive'
) -> float:
    """
    Apply modifier to base probability.

    Args:
        base_probability: Starting probability
        modifier: Modifier value
        modifier_type: 'additive' (+modifier) or 'multiplicative' (*modifier)

    Returns:
        Modified probability, clamped to [0, 1]
    """
    if modifier_type == 'additive':
        result = base_probability + modifier
    elif modifier_type == 'multiplicative':
        result = base_probability * modifier
    else:
        raise ValueError(f"Invalid modifier_type: {modifier_type}")

    return max(0.0, min(1.0, result))


def set_seed(seed: int):
    """
    Set random seed for reproducibility (debug mode).

    Args:
        seed: Random seed value
    """
    random.seed(seed)


def calculate_stamina_penalty(current_stamina: float) -> float:
    """
    Calculate attribute degradation penalty from stamina depletion.

    Formula (Section 11.4):
        if stamina >= 80: penalty = 0
        if stamina < 80: penalty = 0.2 * (80 - stamina) ** 1.3

    Args:
        current_stamina: Current stamina value (0-100)

    Returns:
        Penalty as decimal (e.g., 0.098 = 9.8% degradation)

    Examples:
        >>> calculate_stamina_penalty(80)  # At threshold
        0.0
        >>> calculate_stamina_penalty(60)  # Moderate fatigue
        0.036  # ~3.6% penalty
        >>> calculate_stamina_penalty(40)  # Significant fatigue
        0.098  # ~9.8% penalty
        >>> calculate_stamina_penalty(20)  # Exhausted
        0.192  # ~19.2% penalty
    """
    from ..constants import STAMINA_THRESHOLD, STAMINA_DEGRADATION_POWER, STAMINA_DEGRADATION_SCALE

    if current_stamina >= STAMINA_THRESHOLD:
        return 0.0

    stamina_deficit = STAMINA_THRESHOLD - current_stamina
    penalty = STAMINA_DEGRADATION_SCALE * (stamina_deficit ** STAMINA_DEGRADATION_POWER)

    return min(penalty, 1.0)  # Cap at 100% degradation


def apply_stamina_to_player(
    player: Dict[str, Any],
    current_stamina: float
) -> Dict[str, Any]:
    """
    Create a copy of player with stamina degradation applied to all attributes.

    Args:
        player: Original player dict
        current_stamina: Current stamina level (0-100)

    Returns:
        New player dict with degraded attributes

    Note:
        Does NOT modify original player dict (functional approach).
    """
    from ..constants import ALL_ATTRIBUTES

    penalty = calculate_stamina_penalty(current_stamina)

    if penalty == 0.0:
        return player  # No degradation, return original

    # Create copy with degraded attributes
    degraded_player = player.copy()

    for attribute in ALL_ATTRIBUTES:
        if attribute in player:
            original_value = player[attribute]
            degraded_value = original_value * (1.0 - penalty)
            degraded_player[attribute] = max(1.0, degraded_value)  # Floor at 1

    # Store current stamina in the degraded player for tracking
    degraded_player['current_stamina'] = current_stamina

    return degraded_player


def calculate_rubber_band_modifier(score_differential: int, team_is_trailing: bool) -> float:
    """
    Calculate gentle rubber band modifier based on score differential.

    Applies a small bonus to the trailing team when behind by significant margins.
    This helps prevent runaway blowouts while maintaining realism. The bonus
    automatically reverts as the score gets closer.

    M4.9: AGGRESSIVE rubber-band to reduce blowout rate from 37% to target 15-20%.
    Previous moderate bonuses (17.5%/12.5%/7.5%) had minimal impact.

    Now using very aggressive bonuses to force comeback attempts:
    - Trailing by 18+: +50% bonus (dramatic)
    - Trailing by 13-17: +35% bonus (strong)
    - Trailing by 8-12: +25% bonus (significant)
    - Trailing by <8: No bonus (0%)

    Args:
        score_differential: Absolute point difference (always positive)
        team_is_trailing: True if this team is behind, False if winning/tied

    Returns:
        Modifier to apply (0.0 to 0.50):
        - 0.50 if trailing by 18+
        - 0.35 if trailing by 13-17
        - 0.25 if trailing by 8-12
        - 0.0 otherwise

    Example:
        If trailing team shoots with 50% success rate and trailing by 18:
        - Base rate: 0.50
        - Modifier: +0.50 (50%)
        - Adjusted rate: 1.00 (100% - clamped)

    Note:
        Bonus only applies to trailing team. Leading team gets NO penalty.
        These aggressive bonuses create artificial "momentum swings" to prevent
        runaway blowouts while maintaining attribute-driven base gameplay.
    """
    # No bonus if not trailing or differential is small
    if not team_is_trailing or score_differential < 8:
        return 0.0

    # Apply tiered bonuses (M4.9: VERY aggressive to force comebacks)
    if score_differential >= 18:
        return 0.50  # +50% bonus (extreme deficit - nearly guaranteed makes)
    elif score_differential >= 13:
        return 0.35  # +35% bonus (large deficit - strong boost)
    else:  # 8-12 point deficit
        return 0.25  # +25% bonus (moderate deficit - solid boost)
