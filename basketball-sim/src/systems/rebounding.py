"""
Basketball Simulator - Rebounding System

Complete rebounding mechanics from team strength calculations to individual
rebounder selection. Implements defensive advantage, rebounding strategy effects,
and putback logic.

Key Mechanics:
- 15% defensive advantage (multiply defensive strength by 1.15)
- Rebounding strategy affects number of rebounders (5/4/3 for crash/standard/prevent)
- Individual selection weighted by rebounding composite
- Height threshold (75) determines putback vs kickout
- Shot clock resets to 14 seconds on OREB
"""

import random
import math
from typing import Dict, List, Any, Tuple, Optional

from ..core.probability import (
    calculate_composite,
    weighted_random_choice,
    roll_success,
    weighted_sigmoid_probability,
    apply_consistency_variance,
)
from ..constants import (
    WEIGHTS_REBOUND,
    WEIGHTS_LAYUP,
    DEFENSIVE_REBOUND_ADVANTAGE,
    REBOUND_STRATEGY_CRASH_GLASS_COUNT,
    REBOUND_STRATEGY_STANDARD_COUNT,
    REBOUND_STRATEGY_PREVENT_TRANSITION_COUNT,
    OREB_PUTBACK_HEIGHT_THRESHOLD,
    OREB_SHOT_CLOCK_RESET,
    BASE_RATE_LAYUP,
    SIGMOID_K
)


# OREB base rate from spec (Section 7.1)
# BUG FIX v5: Reduced from 0.06 to 0.055 to eliminate 35%+ extremes
# BUG FIX v6: Reduced from 0.055 to 0.05 after v5 still showed 37.8% and 34.1% extremes
# BUG FIX v7: Reduced from 0.05 to 0.045 after v6 showed Game 6: 38.3%, Game 7: 36.4%
# Target 22-28% OREB rate (1:3 to 1:4 ratio)
# Expected outcomes:
#   - League average: ~25% OREB rate (1:3 ratio)
#   - Elite teams with crash glass + rim shots: ~28-30% (1:2.5 ratio)
#   - Poor teams with prevent transition: ~20-22% (1:4 to 1:5 ratio)
OREB_BASE_RATE = 0.045  # NBA average ~22-28% offensive rebound rate

# Shot type modifiers to OREB rate (REALISM AGENT: reduced from previous values)
OREB_MODIFIER_3PT = -0.03      # -3% (long rebound, harder to get)
OREB_MODIFIER_MIDRANGE = 0.0    # 0% (baseline)
OREB_MODIFIER_RIM = 0.02        # +2% (short rebound, easier to tip)

# Strategy modifiers to OREB rate (REALISM AGENT: reduced from previous values)
OREB_STRATEGY_CRASH_GLASS = 0.05      # +5% when crashing glass
OREB_STRATEGY_PREVENT_TRANSITION = -0.03  # -3% when preventing transition


def get_rebounders_for_strategy(
    team: List[Dict[str, Any]],
    strategy: str,
    is_offensive: bool
) -> List[Dict[str, Any]]:
    """
    Select which players box out for rebounds based on strategy.

    Args:
        team: List of 5 players on the team
        strategy: 'crash_glass', 'standard', or 'prevent_transition'
        is_offensive: True if this is the offensive team, False if defensive

    Returns:
        List of players crashing boards based on strategy

    Strategy determines number of rebounders:
    - crash_glass: 5 offensive, 2 defensive (all-out attack/minimal box out)
    - standard: 2 offensive, 3 defensive (balanced)
    - prevent_transition: 1 offensive, 4 defensive (transition focus)

    Selection: Sort by rebounding composite, take top N
    """
    if strategy not in ['crash_glass', 'standard', 'prevent_transition']:
        raise ValueError(f"Invalid rebounding strategy: {strategy}")

    # Determine number of rebounders based on strategy
    if strategy == 'crash_glass':
        num_rebounders = 5 if is_offensive else 2
    elif strategy == 'standard':
        num_rebounders = 2 if is_offensive else 3
    else:  # prevent_transition
        num_rebounders = 1 if is_offensive else 4

    # Calculate rebounding composite for each player
    player_composites = []
    for player in team:
        composite = calculate_composite(player, WEIGHTS_REBOUND)
        player_composites.append((player, composite))

    # Sort by composite (descending) and take top N
    player_composites.sort(key=lambda x: x[1], reverse=True)
    rebounders = [player for player, _ in player_composites[:num_rebounders]]

    return rebounders


def calculate_team_rebounding_strength(
    rebounders: List[Dict[str, Any]],
    is_defense: bool
) -> float:
    """
    Calculate aggregate rebounding strength for a team.

    Args:
        rebounders: List of players boxing out
        is_defense: True if this is the defensive team (applies 15% advantage)

    Returns:
        Team composite (0-100 range, but can exceed 100 with defensive advantage)

    Algorithm:
    1. Calculate each rebounder's composite using WEIGHTS_REBOUND
    2. Average all composites
    3. If is_defense: multiply by 1.15 (15% defensive advantage)
    """
    if not rebounders:
        return 0.0

    # Calculate composites for all rebounders
    composites = [calculate_composite(player, WEIGHTS_REBOUND) for player in rebounders]

    # Average composite
    avg_composite = sum(composites) / len(composites)

    # Apply defensive advantage
    if is_defense:
        avg_composite *= DEFENSIVE_REBOUND_ADVANTAGE

    return avg_composite


def calculate_offensive_rebound_probability(
    offensive_strength: float,
    defensive_strength: float,
    shot_type: str,
    offensive_strategy: str,
    defensive_strategy: str
) -> Tuple[float, Dict[str, Any]]:
    """
    Calculate probability of offensive rebound.

    Args:
        offensive_strength: Offensive team's rebounding composite
        defensive_strength: Defensive team's rebounding composite (with advantage)
        shot_type: '3pt', 'midrange', 'rim' (includes layup/dunk)
        offensive_strategy: Offensive rebounding strategy
        defensive_strategy: Defensive rebounding strategy

    Returns:
        Tuple of (probability, debug_info)

    Algorithm:
    1. Start with base OREB rate (27%)
    2. Apply shot type modifier
    3. Apply offensive strategy modifier
    4. Calculate team strength ratio (offensive / (offensive + defensive))
    5. Blend base rate with strength ratio
    """
    debug_info = {
        'offensive_strength': offensive_strength,
        'defensive_strength': defensive_strength,
        'base_rate': OREB_BASE_RATE,
        'shot_type': shot_type,
        'offensive_strategy': offensive_strategy,
        'defensive_strategy': defensive_strategy,
    }

    # Apply shot type modifier
    if shot_type == '3pt':
        shot_modifier = OREB_MODIFIER_3PT
    elif shot_type == 'midrange':
        shot_modifier = OREB_MODIFIER_MIDRANGE
    else:  # rim (layup/dunk)
        shot_modifier = OREB_MODIFIER_RIM

    debug_info['shot_type_modifier'] = shot_modifier

    # Apply offensive strategy modifier
    if offensive_strategy == 'crash_glass':
        strategy_modifier = OREB_STRATEGY_CRASH_GLASS
    elif offensive_strategy == 'prevent_transition':
        strategy_modifier = OREB_STRATEGY_PREVENT_TRANSITION
    else:  # standard
        strategy_modifier = 0.0

    debug_info['strategy_modifier'] = strategy_modifier

    # Calculate strength-based probability
    total_strength = offensive_strength + defensive_strength
    if total_strength > 0:
        strength_probability = offensive_strength / total_strength
    else:
        strength_probability = 0.5  # Fallback to 50/50

    debug_info['strength_probability'] = strength_probability

    # Blend base rate with strength probability
    # Use weighted average: 40% strength-based, 60% base rate
    # This ensures defensive advantage has stronger effect
    base_with_modifiers = OREB_BASE_RATE + shot_modifier + strategy_modifier
    final_probability = 0.4 * strength_probability + 0.6 * base_with_modifiers

    # Clamp to [0, 1]
    final_probability = max(0.0, min(1.0, final_probability))

    debug_info['base_with_modifiers'] = base_with_modifiers
    debug_info['final_oreb_probability'] = final_probability

    return final_probability, debug_info


def select_rebounder(
    rebounders: List[Dict[str, Any]]
) -> Tuple[Dict[str, Any], float]:
    """
    Select which specific player gets the rebound.

    Args:
        rebounders: List of players boxing out

    Returns:
        Tuple of (selected_player, player_composite)

    Selection is weighted by rebounding composite.
    Player with 80 composite is 2x more likely than player with 40 composite.
    """
    if not rebounders:
        raise ValueError("Cannot select rebounder from empty list")

    # Calculate composites for all rebounders
    composites = [calculate_composite(player, WEIGHTS_REBOUND) for player in rebounders]

    # Select using weighted choice
    selected_player = weighted_random_choice(rebounders, composites)

    # Get the composite of the selected player
    selected_composite = calculate_composite(selected_player, WEIGHTS_REBOUND)

    return selected_player, selected_composite


def check_putback_attempt(
    rebounder: Dict[str, Any],
    defenders_nearby: List[Dict[str, Any]]
) -> Tuple[bool, bool, Dict[str, Any]]:
    """
    Determine if offensive rebounder attempts putback and if successful.

    Args:
        rebounder: Player who got the offensive rebound
        defenders_nearby: Defensive players in position to contest

    Returns:
        Tuple of (attempted, made, debug_info)

    Height Threshold: 75
    - If height > 75: Attempt putback
    - If height <= 75: Kick out (no putback attempt)

    Putback success uses layup mechanics with scramble context (reduced contest).
    """
    debug_info = {
        'rebounder_name': rebounder['name'],
        'rebounder_height': rebounder['height'],
        'height_threshold': OREB_PUTBACK_HEIGHT_THRESHOLD,
    }

    # Check height threshold
    if rebounder['height'] <= OREB_PUTBACK_HEIGHT_THRESHOLD:
        debug_info['putback_attempted'] = False
        debug_info['putback_made'] = False
        debug_info['reason'] = 'height_too_low_for_putback'
        return False, False, debug_info

    # Putback attempted
    debug_info['putback_attempted'] = True

    # Calculate rebounder's layup composite (putbacks are rim attempts)
    rebounder_composite = calculate_composite(rebounder, WEIGHTS_LAYUP)
    debug_info['rebounder_composite'] = rebounder_composite

    # Calculate average defender composite if defenders nearby
    if defenders_nearby:
        # Use layup weights for defenders too (defending a putback layup)
        defender_composites = [
            calculate_composite(defender, WEIGHTS_LAYUP)
            for defender in defenders_nearby
        ]
        avg_defender_composite = sum(defender_composites) / len(defender_composites)

        # Scramble situation: defenders are out of position, reduce effectiveness by 40%
        avg_defender_composite *= 0.6
    else:
        avg_defender_composite = 0.0  # Wide open putback

    debug_info['avg_defender_composite'] = avg_defender_composite

    # Calculate attribute diff
    # Note: For putbacks, rebounder is offense, defenders are defense
    # But weighted_sigmoid expects defensive_composite - offensive_composite for the contest
    # So we flip it: defender - rebounder (negative diff = rebounder advantage)
    attribute_diff = avg_defender_composite - rebounder_composite
    debug_info['attribute_diff'] = attribute_diff
    debug_info['rebounder_advantage'] = rebounder_composite - avg_defender_composite

    # Use weighted sigmoid with layup base rate
    # When rebounder is better, attribute_diff is negative, increasing probability
    putback_probability = weighted_sigmoid_probability(
        BASE_RATE_LAYUP,
        attribute_diff
    )

    # Putback bonus: +5% (close to rim, quick reaction)
    putback_probability += 0.05
    putback_probability = max(0.0, min(1.0, putback_probability))

    debug_info['putback_probability'] = putback_probability

    # PHASE 3D: Apply consistency variance
    putback_probability = apply_consistency_variance(putback_probability, rebounder, action_type="putback")

    # Roll for success
    roll_value = random.random()
    putback_made = roll_value < putback_probability

    debug_info['roll_value'] = roll_value
    debug_info['putback_made'] = putback_made

    return True, putback_made, debug_info


def simulate_rebound(
    offensive_team: List[Dict[str, Any]],
    defensive_team: List[Dict[str, Any]],
    offensive_strategy: str,
    defensive_strategy: str,
    shot_type: str,
    shot_made: bool = False,
    foul_system: Optional[Any] = None,
    quarter: int = 1,
    game_time: str = "12:00",
    defending_team_name: str = "Away",
    is_blocked_shot: bool = False  # NEW: signals scramble situation
) -> Dict[str, Any]:
    """
    Complete rebound simulation.

    Args:
        offensive_team: List of 5 offensive players
        defensive_team: List of 5 defensive players
        offensive_strategy: Offensive rebounding strategy
        defensive_strategy: Defensive rebounding strategy
        shot_type: Type of shot taken ('3pt', 'midrange', 'rim')
        shot_made: If True, no rebound occurs
        foul_system: Foul system instance
        quarter: Current quarter
        game_time: Game time
        defending_team_name: Name of defending team
        is_blocked_shot: If True, this is a scramble situation (no defensive advantage)

    Returns:
        Complete debug dict with all rebound information

    Flow:
    1. If shot made: No rebound, return early
    2. Get rebounders based on strategies
    3. Calculate team strengths
    4. Determine OREB probability
    5. Roll to determine which team gets rebound
    6. Select individual rebounder
    7. If OREB: Check for putback attempt
    8. Return complete debug info
    """
    result = {
        'shot_made': shot_made,
        'shot_type': shot_type,
    }

    # If shot made, no rebound
    if shot_made:
        result['rebound_occurred'] = False
        result['offensive_rebound'] = False
        return result

    result['rebound_occurred'] = True

    # Get rebounders based on strategies
    offensive_rebounders = get_rebounders_for_strategy(
        offensive_team, offensive_strategy, is_offensive=True
    )
    defensive_rebounders = get_rebounders_for_strategy(
        defensive_team, defensive_strategy, is_offensive=False
    )

    result['num_offensive_rebounders'] = len(offensive_rebounders)
    result['num_defensive_rebounders'] = len(defensive_rebounders)
    result['offensive_rebounders'] = [p['name'] for p in offensive_rebounders]
    result['defensive_rebounders'] = [p['name'] for p in defensive_rebounders]

    # Calculate team strengths
    offensive_strength = calculate_team_rebounding_strength(
        offensive_rebounders, is_defense=False
    )

    # BUG FIX: For blocked shots (scramble situations), don't apply defensive advantage
    # Normal rebounds: defense has positioning advantage (1.15x)
    # Blocked shots: Both teams scrambling equally (1.0x)
    apply_defensive_advantage = not is_blocked_shot
    defensive_strength = calculate_team_rebounding_strength(
        defensive_rebounders, is_defense=apply_defensive_advantage
    )

    result['offensive_team_composite'] = offensive_strength
    result['defensive_team_composite'] = defensive_strength
    result['is_blocked_shot_scramble'] = is_blocked_shot  # NEW: track scramble situation

    # Calculate OREB probability
    oreb_probability, oreb_debug = calculate_offensive_rebound_probability(
        offensive_strength,
        defensive_strength,
        shot_type,
        offensive_strategy,
        defensive_strategy
    )

    result.update(oreb_debug)

    # Roll to determine which team gets rebound
    roll_value = random.random()
    offensive_rebound = roll_value < oreb_probability

    result['roll_value'] = roll_value
    result['offensive_rebound'] = offensive_rebound

    # M3 ISSUE #7 FIX: Check for loose ball foul during rebound battle
    # Loose ball fouls occur during physical box-out contests
    if foul_system:
        # Get a random player from each team involved in rebound battle
        offensive_rebounder_for_foul = random.choice(offensive_rebounders)
        defensive_rebounder_for_foul = random.choice(defensive_rebounders)

        # Check for loose ball foul
        loose_ball_foul = foul_system.check_non_shooting_foul(
            offensive_player=offensive_rebounder_for_foul,
            defensive_player=defensive_rebounder_for_foul,
            action_type='rebound',
            defending_team=defending_team_name,
            quarter=quarter,
            game_time=game_time
        )

        if loose_ball_foul:
            # Loose ball foul occurred
            # Possession goes to fouled team, with FTs if in bonus
            result['loose_ball_foul'] = loose_ball_foul
            result['foul_occurred'] = True

            # Determine which team gets possession based on who was fouled
            # If defensive player fouled, offense gets ball (and possibly FTs)
            result['rebounder_name'] = offensive_rebounder_for_foul['name']
            result['rebounder_position'] = offensive_rebounder_for_foul['position']
            result['rebounding_team'] = 'offense'
            result['offensive_rebound'] = True
            result['putback_attempted'] = False
            result['putback_made'] = False
            result['oreb_outcome'] = 'foul'

            return result

    # Select individual rebounder
    if offensive_rebound:
        rebounder, rebounder_composite = select_rebounder(offensive_rebounders)
        result['rebounding_team'] = 'offense'
    else:
        rebounder, rebounder_composite = select_rebounder(defensive_rebounders)
        result['rebounding_team'] = 'defense'

    result['rebounder_name'] = rebounder['name']
    result['rebounder_position'] = rebounder['position']
    result['rebounder_composite'] = rebounder_composite
    result['foul_occurred'] = False

    # If OREB, check for putback
    if offensive_rebound:
        # Get defenders who were rebounding (still nearby)
        putback_attempted, putback_made, putback_debug = check_putback_attempt(
            rebounder, defensive_rebounders
        )

        result['putback_attempted'] = putback_attempted
        result['putback_made'] = putback_made
        result['putback_debug'] = putback_debug

        # Determine outcome type
        if putback_attempted:
            result['oreb_outcome'] = 'putback'
        else:
            result['oreb_outcome'] = 'kickout'

        # Shot clock resets to 14
        result['shot_clock_reset'] = OREB_SHOT_CLOCK_RESET
    else:
        result['putback_attempted'] = False
        result['putback_made'] = False
        result['oreb_outcome'] = None

    return result


def format_rebound_debug(result: Dict[str, Any]) -> str:
    """
    Format rebound debug information for human readability.

    Args:
        result: Debug dict from simulate_rebound()

    Returns:
        Formatted debug string
    """
    lines = []
    lines.append("=== REBOUND DEBUG ===")
    lines.append("")

    if not result['rebound_occurred']:
        lines.append("Shot made - no rebound")
        return "\n".join(lines)

    lines.append(f"Shot Type: {result['shot_type']}")
    lines.append(f"Offensive Strategy: {result['offensive_strategy']}")
    lines.append(f"Defensive Strategy: {result['defensive_strategy']}")
    lines.append("")

    lines.append("[REBOUNDERS]")
    lines.append(f"Offensive ({result['num_offensive_rebounders']}): {', '.join(result['offensive_rebounders'])}")
    lines.append(f"Defensive ({result['num_defensive_rebounders']}): {', '.join(result['defensive_rebounders'])}")
    lines.append("")

    lines.append("[TEAM STRENGTH]")
    lines.append(f"Offensive Composite: {result['offensive_team_composite']:.2f}")
    lines.append(f"Defensive Composite: {result['defensive_team_composite']:.2f} (includes 15% advantage)")
    lines.append("")

    lines.append("[OREB PROBABILITY]")
    lines.append(f"Base Rate: {result['base_rate']:.1%}")
    lines.append(f"Shot Type Modifier: {result['shot_type_modifier']:+.1%}")
    lines.append(f"Strategy Modifier: {result['strategy_modifier']:+.1%}")
    lines.append(f"Strength Probability: {result['strength_probability']:.1%}")
    lines.append(f"Final OREB Probability: {result['final_oreb_probability']:.1%}")
    lines.append("")

    lines.append("[RESULT]")
    lines.append(f"Roll: {result['roll_value']:.3f}")
    lines.append(f"Outcome: {'OFFENSIVE REBOUND' if result['offensive_rebound'] else 'DEFENSIVE REBOUND'}")
    lines.append(f"Rebounder: {result['rebounder_name']} ({result['rebounder_position']})")
    lines.append(f"Rebounder Composite: {result['rebounder_composite']:.2f}")
    lines.append("")

    if result['offensive_rebound']:
        lines.append("[OFFENSIVE REBOUND OUTCOME]")
        if result['putback_attempted']:
            lines.append(f"Putback Attempted: YES (height {result['putback_debug']['rebounder_height']} > {OREB_PUTBACK_HEIGHT_THRESHOLD})")
            lines.append(f"Putback Probability: {result['putback_debug']['putback_probability']:.1%}")
            lines.append(f"Putback Made: {'YES' if result['putback_made'] else 'NO'}")
        else:
            lines.append(f"Putback Attempted: NO (height {result['putback_debug']['rebounder_height']} <= {OREB_PUTBACK_HEIGHT_THRESHOLD})")
            lines.append("Outcome: KICKOUT (new possession)")
        lines.append(f"Shot Clock Reset: {result['shot_clock_reset']} seconds")

    return "\n".join(lines)
