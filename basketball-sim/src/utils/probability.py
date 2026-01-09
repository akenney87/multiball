"""
Probability calculation utilities for basketball simulation.

This module provides probability formulas for various game mechanics.
"""

import math
from typing import Dict, Any


def calculate_composite(player: Dict[str, Any], weights: Dict[str, float]) -> float:
    """
    Calculate weighted composite of player attributes.

    Args:
        player: Player dictionary with attributes
        weights: Dictionary mapping attribute names to weights (should sum to 1.0)

    Returns:
        Weighted average of player's attributes
    """
    total = 0.0
    for attr, weight in weights.items():
        total += player.get(attr, 50) * weight
    return total


def calculate_defensive_event_probability(
    base_rate: float,
    defender_composite: float,
    attacker_composite: float,
    k: float = 0.015,
    max_multiplier: float = 2.0,
    min_multiplier: float = 0.5
) -> float:
    """
    Calculate probability of defensive event (strip, steal, rip-away).

    Uses multiplicative sigmoid where attribute advantage scales base_rate
    rather than adding to it. This ensures equal players produce base_rate
    probability, not 50%.

    Formula:
        1. Calculate sigmoid of attribute differential
        2. Map sigmoid [0, 1] to scaling factor [min_multiplier, max_multiplier]
        3. Multiply base_rate by scaling factor

    At diff=0 (equal players): sigmoid=0.5 → scaling=1.0 → prob=base_rate
    At diff=+50 (defender dominates): sigmoid≈0.73 → scaling≈1.35 → prob=1.35×base
    At diff=-50 (attacker dominates): sigmoid≈0.27 → scaling≈0.65 → prob=0.65×base

    Args:
        base_rate: Baseline probability (e.g., 0.08 for rip-aways, 0.04 for strips)
        defender_composite: Defender's composite attribute score
        attacker_composite: Attacker's composite attribute score (resisting)
        k: Sensitivity constant (0.015 = moderate attribute impact)
        max_multiplier: Maximum scaling (2.0 = defender can double base rate)
        min_multiplier: Minimum scaling (0.5 = attacker can halve base rate)

    Returns:
        Probability of defensive success, bounded [0, 1]

    Examples:
        base_rate=0.08, equal players (50 vs 50):
            → 0.08 * 1.0 = 8.0%

        base_rate=0.08, elite defender (70 vs 50):
            → 0.08 * 1.35 ≈ 10.8%

        base_rate=0.08, elite attacker (50 vs 70):
            → 0.08 * 0.65 ≈ 5.2%
    """
    # Positive diff = defender advantage
    attr_diff = defender_composite - attacker_composite

    # Sigmoid maps diff to [0, 1]
    # sigmoid(-inf) → 0, sigmoid(0) → 0.5, sigmoid(+inf) → 1
    sigmoid_value = 1 / (1 + math.exp(-k * attr_diff))

    # Map sigmoid [0, 1] to scaling factor [min_multiplier, max_multiplier]
    # At sigmoid=0.5 (diff=0): multiplier = 1.0 (neutral)
    # At sigmoid=1.0 (defender dominates): multiplier = max_multiplier
    # At sigmoid=0.0 (attacker dominates): multiplier = min_multiplier
    scaling_factor = min_multiplier + (max_multiplier - min_multiplier) * sigmoid_value

    # Apply scaling to base rate
    probability = base_rate * scaling_factor

    # Ensure bounds [0, 1]
    return max(0.0, min(1.0, probability))
