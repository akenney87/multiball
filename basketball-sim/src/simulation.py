"""
Basketball Simulator - Main Simulation Engine

Provides high-level API for running possessions with:
- Input validation (teams, tactical settings)
- Random seed control for reproducibility
- Error handling with clear messages
- Structured output formatting
- Debug information generation

Public API:
- simulate_single_possession() - Main entry point
- validate_simulation_inputs() - Pre-flight checks
- format_possession_output() - Human-readable formatting
"""

import random
from typing import Dict, List, Any, Optional

from .core.data_structures import (
    PossessionContext,
    TacticalSettings,
    PossessionResult,
    validate_team
)
from .systems import possession


# =============================================================================
# INPUT VALIDATION
# =============================================================================

def validate_simulation_inputs(
    offensive_team: List[Dict[str, Any]],
    defensive_team: List[Dict[str, Any]],
    tactical_settings_offense: TacticalSettings,
    tactical_settings_defense: TacticalSettings,
    possession_context: PossessionContext
) -> None:
    """
    Validate all inputs before simulation.

    Args:
        offensive_team: List of 5 offensive players
        defensive_team: List of 5 defensive players
        tactical_settings_offense: Offensive tactical settings
        tactical_settings_defense: Defensive tactical settings
        possession_context: Possession context

    Raises:
        ValueError: If any validation fails
        TypeError: If inputs are wrong type
    """
    # Type checks
    if not isinstance(offensive_team, list):
        raise TypeError(f"offensive_team must be list, got {type(offensive_team)}")

    if not isinstance(defensive_team, list):
        raise TypeError(f"defensive_team must be list, got {type(defensive_team)}")

    if not isinstance(tactical_settings_offense, TacticalSettings):
        raise TypeError(
            f"tactical_settings_offense must be TacticalSettings, got {type(tactical_settings_offense)}"
        )

    if not isinstance(tactical_settings_defense, TacticalSettings):
        raise TypeError(
            f"tactical_settings_defense must be TacticalSettings, got {type(tactical_settings_defense)}"
        )

    if not isinstance(possession_context, PossessionContext):
        raise TypeError(
            f"possession_context must be PossessionContext, got {type(possession_context)}"
        )

    # Validate teams (will raise ValueError if invalid)
    validate_team(offensive_team)
    validate_team(defensive_team)

    # Validate tactical settings
    tactical_settings_offense.validate()
    tactical_settings_defense.validate()

    # Validate possession context
    if not isinstance(possession_context.is_transition, bool):
        raise TypeError(f"is_transition must be bool, got {type(possession_context.is_transition)}")

    if not isinstance(possession_context.shot_clock, int):
        raise TypeError(f"shot_clock must be int, got {type(possession_context.shot_clock)}")

    if possession_context.shot_clock not in [14, 24]:
        raise ValueError(f"shot_clock must be 14 or 24, got {possession_context.shot_clock}")


# =============================================================================
# MAIN SIMULATION ENGINE
# =============================================================================

def simulate_single_possession(
    offensive_team: List[Dict[str, Any]],
    defensive_team: List[Dict[str, Any]],
    tactical_settings_offense: Optional[TacticalSettings] = None,
    tactical_settings_defense: Optional[TacticalSettings] = None,
    possession_context: Optional[PossessionContext] = None,
    seed: Optional[int] = None,
    validate_inputs: bool = True
) -> PossessionResult:
    """
    Simulate a single possession with full validation and error handling.

    Main entry point for Milestone 1 simulation.

    Args:
        offensive_team: List of 5 offensive players
        defensive_team: List of 5 defensive players
        tactical_settings_offense: Offensive tactics (defaults to balanced)
        tactical_settings_defense: Defensive tactics (defaults to balanced)
        possession_context: Possession context (defaults to halfcourt)
        seed: Random seed for reproducibility (None = random)
        validate_inputs: Whether to validate inputs (default True)

    Returns:
        PossessionResult with complete outcome and debug info

    Raises:
        ValueError: If validation fails
        TypeError: If inputs are wrong type

    Example:
        >>> result = simulate_single_possession(
        ...     offensive_team=elite_shooters,
        ...     defensive_team=elite_defenders,
        ...     seed=42
        ... )
        >>> print(result.play_by_play_text)
        >>> print(f"Points: {result.points_scored}")
    """
    # Apply defaults
    if tactical_settings_offense is None:
        tactical_settings_offense = TacticalSettings(
            pace='standard',
            man_defense_pct=50,
            rebounding_strategy='standard'
        )

    if tactical_settings_defense is None:
        tactical_settings_defense = TacticalSettings(
            pace='standard',
            man_defense_pct=50,
            rebounding_strategy='standard'
        )

    if possession_context is None:
        possession_context = PossessionContext(
            is_transition=False,
            shot_clock=24,
            score_differential=0,
            game_time_remaining=2880
        )

    # Validate inputs if requested
    if validate_inputs:
        try:
            validate_simulation_inputs(
                offensive_team,
                defensive_team,
                tactical_settings_offense,
                tactical_settings_defense,
                possession_context
            )
        except (ValueError, TypeError) as e:
            # Re-raise with context
            raise ValueError(f"Input validation failed: {str(e)}") from e

    # Set random seed if provided
    if seed is not None:
        random.seed(seed)

    # Run possession simulation
    try:
        result = possession.simulate_possession(
            offensive_team=offensive_team,
            defensive_team=defensive_team,
            tactical_settings_offense=tactical_settings_offense,
            tactical_settings_defense=tactical_settings_defense,
            possession_context=possession_context,
            seed=seed
        )

        return result

    except Exception as e:
        # Wrap any unexpected errors with context
        raise RuntimeError(
            f"Possession simulation failed: {str(e)}\n"
            f"Offensive team: {[p['name'] for p in offensive_team]}\n"
            f"Defensive team: {[p['name'] for p in defensive_team]}"
        ) from e


# =============================================================================
# OUTPUT FORMATTING
# =============================================================================

def format_possession_output(
    result: PossessionResult,
    include_debug: bool = False,
    compact: bool = False
) -> str:
    """
    Format possession result as human-readable text.

    Args:
        result: PossessionResult to format
        include_debug: Whether to include full debug information
        compact: Whether to use compact format (single line)

    Returns:
        Formatted string

    Example Output (Standard):
        === POSSESSION START ===

        Stephen Curry attempts a 3-pointer from the top of the key.
        Contested by Kawhi Leonard (3.5 feet away - Contested).

        CURRY MAKES THE THREE-POINTER!
        +3 Points

        Assist: Draymond Green

        === POSSESSION END ===

        Outcome: made_shot
        Points: 3
        Shooter: Stephen Curry
        Assist: Draymond Green

    Example Output (Compact):
        MADE: Stephen Curry 3PT (+3) | Assist: Draymond Green
    """
    if compact:
        # Single-line format
        if result.possession_outcome == 'made_shot':
            shot_type = result.debug.get('shot_type', 'shot').upper()
            output = f"MADE: {result.scoring_player} {shot_type} (+{result.points_scored})"

            if result.assist_player:
                output += f" | Assist: {result.assist_player}"

            return output

        elif result.possession_outcome == 'missed_shot':
            shooter = result.debug.get('shooter', 'Unknown')
            shot_type = result.debug.get('shot_type', 'shot').upper()
            rebounder = result.rebound_player or 'Unknown'

            return f"MISS: {shooter} {shot_type} | Rebound: {rebounder}"

        else:  # turnover
            ball_handler = result.debug.get('ball_handler', 'Unknown')
            return f"TURNOVER: {ball_handler}"

    # Standard format
    lines = []

    # Header
    lines.append("=" * 50)
    lines.append("POSSESSION START")
    lines.append("=" * 50)
    lines.append("")

    # Play-by-play
    lines.append(result.play_by_play_text)
    lines.append("")

    # Footer
    lines.append("=" * 50)
    lines.append("POSSESSION END")
    lines.append("=" * 50)
    lines.append("")

    # Summary
    lines.append(f"Outcome: {result.possession_outcome}")
    lines.append(f"Points: {result.points_scored}")

    if result.scoring_player:
        lines.append(f"Scorer: {result.scoring_player}")

    if result.assist_player:
        lines.append(f"Assist: {result.assist_player}")

    if result.rebound_player:
        lines.append(f"Rebounder: {result.rebound_player}")

    # Debug output
    if include_debug:
        lines.append("")
        lines.append("=" * 50)
        lines.append("DEBUG INFORMATION")
        lines.append("=" * 50)
        lines.append("")

        lines.append(_format_debug_info(result.debug))

    return "\n".join(lines)


def _format_debug_info(debug: Dict[str, Any], indent: int = 0) -> str:
    """
    Recursively format debug dictionary as indented text.

    Args:
        debug: Debug dictionary
        indent: Current indentation level

    Returns:
        Formatted debug string
    """
    lines = []
    indent_str = "  " * indent

    for key, value in debug.items():
        if isinstance(value, dict):
            # Nested dict
            lines.append(f"{indent_str}{key}:")
            lines.append(_format_debug_info(value, indent + 1))
        elif isinstance(value, (list, tuple)):
            # List/tuple
            lines.append(f"{indent_str}{key}: {value}")
        elif isinstance(value, float):
            # Format floats to 4 decimal places
            lines.append(f"{indent_str}{key}: {value:.4f}")
        else:
            # Primitive
            lines.append(f"{indent_str}{key}: {value}")

    return "\n".join(lines)


# =============================================================================
# BATCH SIMULATION (FUTURE)
# =============================================================================

def simulate_multiple_possessions(
    offensive_team: List[Dict[str, Any]],
    defensive_team: List[Dict[str, Any]],
    num_possessions: int,
    tactical_settings_offense: Optional[TacticalSettings] = None,
    tactical_settings_defense: Optional[TacticalSettings] = None,
    possession_context: Optional[PossessionContext] = None,
    seed: Optional[int] = None
) -> List[PossessionResult]:
    """
    Simulate multiple possessions for statistical analysis.

    NOTE: This is a placeholder for Milestone 2 (quarter simulation).
    For M1, just runs N independent possessions.

    Args:
        offensive_team: List of 5 offensive players
        defensive_team: List of 5 defensive players
        num_possessions: Number of possessions to simulate
        tactical_settings_offense: Offensive tactics
        tactical_settings_defense: Defensive tactics
        possession_context: Possession context (defaults to halfcourt)
        seed: Base random seed (each possession gets seed + i)

    Returns:
        List of PossessionResults
    """
    results = []

    for i in range(num_possessions):
        possession_seed = (seed + i) if seed is not None else None

        result = simulate_single_possession(
            offensive_team=offensive_team,
            defensive_team=defensive_team,
            tactical_settings_offense=tactical_settings_offense,
            tactical_settings_defense=tactical_settings_defense,
            possession_context=possession_context,
            seed=possession_seed,
            validate_inputs=(i == 0)  # Only validate first possession
        )

        results.append(result)

    return results
