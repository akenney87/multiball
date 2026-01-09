"""
Basketball Simulator - Turnover Detection and Handling System

Implements complete turnover mechanics including:
- Turnover probability calculation with tactical modifiers
- Type selection (bad_pass, lost_ball, offensive_foul, violation)
- Steal attribution
- Transition trigger detection

All calculations use weighted sigmoid formulas per basketball_sim.md Section 6.
"""

import random
from typing import Dict, Any, Tuple, Optional

from ..core.probability import (
    calculate_composite,
    sigmoid,
    weighted_random_choice,
    apply_modifier,
    apply_consistency_variance,
)
from ..core.data_structures import TacticalSettings, PossessionContext
from ..constants import (
    BASE_TURNOVER_RATE,
    WEIGHTS_TURNOVER_PREVENTION,
    TURNOVER_PACE_FAST_BONUS,
    TURNOVER_PACE_SLOW_PENALTY,
    # REMOVED M4.6: ZONE_DEFENSE_TURNOVER_BONUS (spec was backwards)
    TURNOVER_TYPE_BAD_PASS,
    TURNOVER_TYPE_LOST_BALL,
    TURNOVER_TYPE_OFFENSIVE_FOUL,
    TURNOVER_TYPE_SHOT_CLOCK,          # M5.0: NEW
    TURNOVER_TYPE_OTHER_VIOLATION,     # M5.0: NEW (replaces TURNOVER_TYPE_VIOLATION)
    SIGMOID_K
)


def check_turnover(
    ball_handler: Dict[str, Any],
    defender: Dict[str, Any],
    tactical_settings: TacticalSettings,
    possession_context: PossessionContext,
    defense_type: str = 'man'  # M5.0: Added actual defense type ('zone' or 'man')
) -> Tuple[bool, Dict[str, Any]]:
    """
    Determine if turnover occurs on this possession.

    Algorithm (Section 6.1):
    1. Start with BASE_TURNOVER_RATE (8%)
    2. Apply pace modifiers (+2.5% fast, -2.5% slow)
    3. Apply zone defense bonus (+3% if applicable)
    4. Apply transition reduction (-2% if transition possession)
    5. Calculate ball handler's turnover prevention composite
    6. Adjust rate using sigmoid based on composite quality
    7. Roll dice to determine outcome
    8. If turnover: select type, check steal credit, check transition trigger

    Args:
        ball_handler: Offensive player with ball
        defender: Primary defensive matchup
        tactical_settings: Team tactical settings (pace, defense type)
        possession_context: Possession state (is_transition, etc.)

    Returns:
        Tuple of (turnover_occurred: bool, debug_info: dict)

    Debug info includes:
        - ball_handler_name
        - defender_name
        - ball_handler_composite
        - base_turnover_rate
        - pace_modifier
        - zone_modifier
        - transition_modifier
        - total_modifier
        - adjusted_turnover_rate
        - roll_value
        - turnover_occurred
        - turnover_type (if occurred)
        - steal_credited_to (if applicable)
        - triggers_transition (if occurred)
    """
    debug_info = {
        'ball_handler_name': ball_handler['name'],
        'defender_name': defender['name']
    }

    # 1. Calculate ball handler's turnover prevention composite
    ball_handler_composite = calculate_composite(
        ball_handler,
        WEIGHTS_TURNOVER_PREVENTION
    )
    debug_info['ball_handler_composite'] = ball_handler_composite

    # 2. Start with base rate
    base_rate = BASE_TURNOVER_RATE
    debug_info['base_turnover_rate'] = base_rate

    # 3. Apply tactical modifiers (additive)
    total_modifier = 0.0
    pace_modifier = 0.0
    zone_modifier = 0.0
    transition_modifier = 0.0

    # Pace adjustment
    if tactical_settings.pace == 'fast':
        pace_modifier = TURNOVER_PACE_FAST_BONUS
    elif tactical_settings.pace == 'slow':
        pace_modifier = TURNOVER_PACE_SLOW_PENALTY

    total_modifier += pace_modifier
    debug_info['pace_modifier'] = pace_modifier

    # M4.6 REMOVED: Zone defense turnover bonus (spec was backwards)
    # Man defense is aggressive (forces turnovers), zone is passive (protects paint)
    # No tactical modifier for man/zone defense on turnovers

    # Transition reduces turnovers (open court, fewer defenders)
    if possession_context.is_transition:
        transition_modifier = -0.02  # -2% in transition
        total_modifier += transition_modifier
    debug_info['transition_modifier'] = transition_modifier

    debug_info['total_modifier'] = total_modifier

    # 4. Apply modifiers to base rate
    modified_rate = base_rate + total_modifier

    # 5. Calculate defender's steal/pressure composite
    # Use same weights as turnover prevention (logical mirror)
    defender_composite = calculate_composite(
        defender,
        WEIGHTS_TURNOVER_PREVENTION
    )
    debug_info['defender_composite'] = defender_composite

    # 6. BUG FIX v5: Use balanced offense vs defense weighted sigmoid
    # Previous: Pure multiplier created 4.5x variance (elite 18%, poor 82%)
    # New: Weighted sigmoid with ±3% range for balanced matchups
    # Formula: adjusted_rate = modified_rate + range * weighted_sigmoid(def - off)
    # Range: ±3% (±0.03) instead of multiplicative ±82%
    composite_diff = defender_composite - ball_handler_composite
    sigmoid_value = sigmoid(SIGMOID_K * composite_diff)

    # Sigmoid output (0.5 = even, >0.5 = defense advantage, <0.5 = offense advantage)
    # Convert to ±3% adjustment
    adjustment = 0.03 * (sigmoid_value - 0.5) * 2  # Range: -0.03 to +0.03

    adjusted_rate = modified_rate + adjustment

    # Clamp to valid probability range
    adjusted_rate = max(0.0, min(1.0, adjusted_rate))

    # BUG FIX v7: Cap turnover rate to prevent extreme outliers
    # Game 6 showed 21.4% rate in edge cases despite formula fixes
    # This safety cap prevents catastrophic turnover spirals
    # REALISM FIX: Reduced from 0.15 to 0.10, then M4.6 raised to 0.12
    # M4.6: Raised from 0.10 to 0.12 after increasing BASE_TURNOVER_RATE to 0.08
    MAX_TURNOVER_RATE = 0.12  # 12% hard cap per possession (general turnovers only, drive adds more)
    if adjusted_rate > MAX_TURNOVER_RATE:
        debug_info['capped'] = True
        debug_info['uncapped_rate'] = adjusted_rate
        adjusted_rate = MAX_TURNOVER_RATE
    else:
        debug_info['capped'] = False

    debug_info['sigmoid_value'] = sigmoid_value
    debug_info['attribute_adjustment'] = adjustment
    debug_info['adjusted_turnover_rate'] = adjusted_rate

    # PHASE 3D: Apply consistency variance
    adjusted_rate = apply_consistency_variance(adjusted_rate, ball_handler, action_type="turnover")

    # 7. Roll dice
    roll_value = random.random()
    debug_info['roll_value'] = roll_value

    turnover_occurred = roll_value < adjusted_rate
    debug_info['turnover_occurred'] = turnover_occurred

    # 7. If turnover, determine details
    if turnover_occurred:
        # Select turnover type (M5.0: Pass defense_type)
        turnover_type = select_turnover_type(
            possession_context,
            tactical_settings,
            defense_type
        )
        debug_info['turnover_type'] = turnover_type

        # Check for steal credit
        steal_credited = determine_steal_credit(defender, turnover_type)
        debug_info['steal_credited_to'] = defender['name'] if steal_credited else None

        # Check if triggers transition
        transition_trigger = triggers_transition(turnover_type)
        debug_info['triggers_transition'] = transition_trigger
    else:
        debug_info['turnover_type'] = None
        debug_info['steal_credited_to'] = None
        debug_info['triggers_transition'] = False

    return turnover_occurred, debug_info


def select_turnover_type(
    possession_context: PossessionContext,
    tactical_settings: TacticalSettings,
    defense_type: str = 'man'  # M5.0: Actual defense type for this possession
) -> str:
    """
    Select turnover type using weighted distribution.

    Base distribution (M5.0 - split violations):
    - bad_pass: 40%
    - lost_ball: 30%
    - offensive_foul: 20%
    - shot_clock: 5%
    - other_violation: 5%

    Context adjustments:
    - Zone defense: +10% to bad_pass (more complex passing)
    - Fast pace: +5% to lost_ball (rushed plays), -2% to shot_clock
    - Slow pace: +3% to shot_clock
    - Low shot clock (<5 sec): +5% to shot_clock

    Args:
        possession_context: Current possession state
        tactical_settings: Team tactical settings
        defense_type: Actual defense type for this possession ('zone' or 'man')

    Returns:
        Turnover type string
    """
    from ..constants import (
        TURNOVER_TYPE_SHOT_CLOCK,
        TURNOVER_TYPE_OTHER_VIOLATION,
        SHOT_CLOCK_VIOLATION_SLOW_PACE_BONUS,
        SHOT_CLOCK_VIOLATION_FAST_PACE_PENALTY
    )

    # Start with base weights
    weights = {
        'bad_pass': TURNOVER_TYPE_BAD_PASS,
        'lost_ball': TURNOVER_TYPE_LOST_BALL,
        'offensive_foul': TURNOVER_TYPE_OFFENSIVE_FOUL,
        'shot_clock': TURNOVER_TYPE_SHOT_CLOCK,
        'other_violation': TURNOVER_TYPE_OTHER_VIOLATION
    }

    # Context adjustments
    # M5.0 FIX: Use actual defense_type (not team percentage)
    if defense_type == 'zone':
        weights['bad_pass'] += 0.10

    # Fast pace increases lost balls, decreases shot clock violations
    if tactical_settings.pace == 'fast':
        weights['lost_ball'] += 0.05
        weights['shot_clock'] += SHOT_CLOCK_VIOLATION_FAST_PACE_PENALTY

    # Slow pace increases shot clock violations
    elif tactical_settings.pace == 'slow':
        weights['shot_clock'] += SHOT_CLOCK_VIOLATION_SLOW_PACE_BONUS

    # Low shot clock increases shot clock violations
    if possession_context.shot_clock < 5:
        weights['shot_clock'] += 0.05

    # Normalize and select
    types = list(weights.keys())
    weight_values = list(weights.values())

    return weighted_random_choice(types, weight_values)


def determine_steal_credit(
    defender: Dict[str, Any],
    turnover_type: str
) -> bool:
    """
    Determine if defender gets credited with a steal.

    Steal probability depends on turnover type and defender quality.

    Algorithm:
    1. Only certain types can be steals (bad_pass, lost_ball)
    2. PHASE 2: Calculate defender's steal composite using WEIGHTS_STEAL_DEFENSE
       (grip_strength: 30%, reactions: 25%, awareness: 20%, agility: 15%, determination: 10%)
    3. Use sigmoid to determine steal probability
    4. Roll dice

    Args:
        defender: Defensive player
        turnover_type: Type of turnover that occurred

    Returns:
        True if steal credited, False otherwise
    """
    # Only live ball turnovers can be steals
    if turnover_type not in ['bad_pass', 'lost_ball']:
        return False

    # Calculate defender composite for steal probability
    from ..constants import WEIGHTS_STEAL_DEFENSE
    defender_composite = calculate_composite(defender, WEIGHTS_STEAL_DEFENSE)

    # Steal probability based on defender quality
    # Elite defender (90): ~70% steal credit
    # Average defender (50): ~82% steal credit (tuned from 0.50 to increase steals 5.0 → 7.5 per team)
    # Poor defender (30): ~62% steal credit
    base_steal_prob = 0.82
    composite_diff = defender_composite - 50
    steal_adjustment = composite_diff * 0.004  # ±0.16 for ±40 composite diff

    steal_prob = base_steal_prob + steal_adjustment
    steal_prob = max(0.0, min(1.0, steal_prob))

    # PHASE 3D: Apply consistency variance (defender's consistency)
    steal_prob = apply_consistency_variance(steal_prob, defender, action_type="steal")

    return random.random() < steal_prob


def triggers_transition(turnover_type: str) -> bool:
    """
    Determine if turnover triggers fast break opportunity.

    Live ball turnovers trigger transition:
    - bad_pass: YES (defender can grab and run)
    - lost_ball: YES (loose ball recovery)
    - offensive_foul: YES (inbound but quick)

    Dead ball turnovers do NOT trigger transition:
    - violation: NO (dead ball, defense sets up)

    Args:
        turnover_type: Type of turnover

    Returns:
        True if triggers transition, False otherwise
    """
    live_ball_turnovers = ['bad_pass', 'lost_ball', 'offensive_foul']
    return turnover_type in live_ball_turnovers


def get_turnover_description(
    turnover_type: str,
    ball_handler_name: str,
    steal_credited_to: Optional[str] = None,
    defender_name: Optional[str] = None,
    foul_event: Optional[Any] = None
) -> str:
    """
    Generate human-readable turnover description.

    Args:
        turnover_type: Type of turnover
        ball_handler_name: Player who committed turnover
        steal_credited_to: Defender name if steal credited
        defender_name: Primary defender (for offensive foul context)
        foul_event: FoulEvent if this is an offensive foul (for tracking)

    Returns:
        Descriptive string for play-by-play
    """
    # USER FIX: Make turnover descriptions explicit about live/dead ball status
    if turnover_type == 'bad_pass':
        if steal_credited_to:
            # LIVE BALL: steal, play continues
            return f"{ball_handler_name} throws a bad pass! Stolen by {steal_credited_to}! TURNOVER! (live ball)"
        else:
            # DEAD BALL: out of bounds
            return f"{ball_handler_name} throws a bad pass out of bounds! TURNOVER! (dead ball)"

    elif turnover_type == 'lost_ball':
        if steal_credited_to:
            # LIVE BALL: stripped, play continues
            return f"{ball_handler_name} loses the ball! Stripped by {steal_credited_to}! TURNOVER! (live ball)"
        else:
            # DEAD BALL: lost control, rolled out of bounds
            return f"{ball_handler_name} loses control! Ball rolls out of bounds! TURNOVER! (dead ball)"

    elif turnover_type == 'offensive_foul':
        # BUG FIX: Include foul tracking information
        # DEAD BALL: whistle blown for foul
        if foul_event:
            # Format with foul counts
            foul_info = f"[Team fouls: {foul_event.team_fouls_after}] ({ball_handler_name}: {foul_event.personal_fouls_after} personal fouls)"
            if defender_name:
                return f"FOUL! Offensive foul on {ball_handler_name}! {defender_name} drew the charge! {foul_info} TURNOVER! (dead ball)"
            else:
                return f"FOUL! Offensive foul on {ball_handler_name}! {foul_info} TURNOVER! (dead ball)"
        else:
            # Fallback if no foul event (shouldn't happen with fix)
            if defender_name:
                return f"{ball_handler_name} commits an offensive foul! {defender_name} drew the charge! TURNOVER! (dead ball)"
            else:
                return f"{ball_handler_name} commits an offensive foul! TURNOVER! (dead ball)"

    elif turnover_type == 'shot_clock':
        # DEAD BALL: whistle blown for shot clock violation
        return f"Shot clock violation! {ball_handler_name} couldn't get a shot off in time! TURNOVER! (dead ball)"

    elif turnover_type == 'other_violation':
        # DEAD BALL: whistle blown for violation
        return f"{ball_handler_name} commits a violation (traveling/carry)! TURNOVER! (dead ball)"

    # Legacy support for old 'violation' type
    elif turnover_type == 'violation':
        # DEAD BALL: whistle blown for violation
        return f"{ball_handler_name} commits a violation (traveling/carry)! TURNOVER! (dead ball)"

    else:
        # Fallback for unknown types
        return f"{ball_handler_name} turns the ball over! TURNOVER!"
