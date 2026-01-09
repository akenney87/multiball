"""
Basketball Simulator - Shooting System

Complete shooting mechanics for Milestone 1:
- Shot type selection with player/tactical modifiers
- Two-stage success calculation (base + contest)
- All 5 shot types (3PT, midrange short/long, dunk, layup)
- Contest penalty system with distance tiers
- Help defense rotation logic
- Transition bonuses
"""

import random
import math
from typing import Dict, Any, Tuple, Optional, List

from ..core.probability import (
    calculate_composite,
    weighted_sigmoid_probability,
    roll_success,
    weighted_random_choice,
    normalize_probabilities,
    sigmoid,
    apply_consistency_variance,
    calculate_rubber_band_modifier,
)
from ..core.data_structures import PossessionContext, TacticalSettings
from ..constants import (
    # Base rates
    BASE_RATE_3PT,
    BASE_RATE_MIDRANGE_SHORT,
    BASE_RATE_MIDRANGE_LONG,
    BASE_RATE_DUNK,
    BASE_RATE_LAYUP,

    # Attribute weights
    WEIGHTS_3PT,
    WEIGHTS_MIDRANGE,
    WEIGHTS_DUNK,
    WEIGHTS_LAYUP,
    WEIGHTS_CONTEST,
    WEIGHTS_TRANSITION_SUCCESS,

    # Shot distribution
    SHOT_DISTRIBUTION_BASELINE,
    SHOT_DISTRIBUTION_PLAYER_MOD,
    SHOT_DISTRIBUTION_TACTICAL_MOD,
    ZONE_DEFENSE_3PT_ATTEMPT_BONUS,

    # Contest penalties
    CONTEST_DISTANCE_WIDE_OPEN,
    CONTEST_DISTANCE_CONTESTED,
    CONTEST_PENALTIES,
    CONTEST_DEFENDER_MOD_SCALE,
    PATIENCE_CONTEST_REDUCTION_SCALE,

    # Help defense
    HELP_DEFENSE_TRIGGER_THRESHOLD,
    HELP_DEFENSE_AWARENESS_K,

    # Transition bonuses
    TRANSITION_BONUS_RIM,
    TRANSITION_BONUS_MIDRANGE,
    TRANSITION_BONUS_3PT,

    # Zone defense
    ZONE_DEFENSE_CONTEST_PENALTY,

    # Blocking
    BLOCK_BASE_RATES,
    BLOCK_DISTANCE_THRESHOLD_FAR,
    BLOCK_DISTANCE_THRESHOLD_MID,
    WEIGHTS_BLOCK_DEFENDER,
    WEIGHTS_BLOCK_SHOOTER,
    BLOCK_OUTCOME_STAYS_IN_PLAY,
    BLOCK_OUTCOME_OUT_OFF_SHOOTER,
    BLOCK_OUTCOME_OUT_OFF_BLOCKER,
    WEIGHTS_BLOCK_CONTROL,
    WEIGHTS_BLOCK_SHOOTER_RECOVER,
    WEIGHTS_OUT_OFF_SHOOTER,
    WEIGHTS_OUT_OFF_BLOCKER,

    # Sigmoid constant
    SIGMOID_K,

    # PHASE 3C: Bravery modifier
    BRAVERY_RIM_TENDENCY_SCALE,
)


# =============================================================================
# SHOT TYPE SELECTION
# =============================================================================

def select_shot_type(
    shooter: Dict[str, Any],
    tactical_settings: TacticalSettings,
    possession_context: PossessionContext,
    defense_type: str = 'man',
    endgame_3pt_adjustment: float = 0.0  # M3 End-game: Additive 3PT% adjustment
) -> str:
    """
    Determine shot type using weighted distribution.

    Algorithm:
    1. Start with baseline (40% 3PT, 20% mid, 40% rim)
    2. Apply player modifiers (±5% based on shooting strengths)
    3. Apply tactical modifiers (±10% from pace)
    4. If zone defense: +5% to 3PT
    5. If transition: +20% to rim (from midrange/3PT)
    6. M3 End-game: Apply end-game 3PT adjustment (±20% from desperation/conserve modes)
    7. Normalize to 100%
    8. Weighted random selection

    Args:
        shooter: Shooter player dict
        tactical_settings: Tactical settings for offense
        possession_context: Current possession context
        defense_type: 'man' or 'zone'
        endgame_3pt_adjustment: End-game 3PT% adjustment (+0.20 = desperation, -0.10 = conserve)

    Returns:
        Shot type: '3pt', 'midrange', or 'rim'
    """
    # Start with baseline distribution
    distribution = SHOT_DISTRIBUTION_BASELINE.copy()

    # BUG FIX: Position-based shot distribution adjustments
    # Centers and power forwards should shoot far fewer 3-pointers
    # M4.5 PHASE 2: Reduced position bonuses to lower rim attempt rate
    # Previous: C rim +25%, PF rim +10% → Resulted in 49% rim after Phase 1
    # Target: Further reduce rim attempts toward NBA 35%
    position = shooter.get('position', 'SF')
    if position == 'C':
        # Centers: Still favor rim, but less aggressively (modern NBA centers)
        distribution['3pt'] -= 0.25      # Reduced from -0.30
        distribution['rim'] += 0.15      # Reduced from +0.25
        distribution['midrange'] += 0.10  # Increased from +0.05
    elif position == 'PF':
        # Power forwards: Fewer 3PT, more balanced rim/mid
        distribution['3pt'] -= 0.10      # Reduced from -0.15
        distribution['rim'] += 0.05      # Reduced from +0.10
        distribution['midrange'] += 0.05  # Kept same
    elif position in ['PG', 'SG']:
        # Guards: Slightly more 3PT if elite shooters
        pass  # Will be handled by composite check below

    # Calculate shooter composites for each shot type
    composite_3pt = calculate_composite(shooter, WEIGHTS_3PT)
    composite_mid = calculate_composite(shooter, WEIGHTS_MIDRANGE)
    composite_rim = (calculate_composite(shooter, WEIGHTS_DUNK) +
                     calculate_composite(shooter, WEIGHTS_LAYUP)) / 2.0

    # M4.7: Non-linear composite-based shot selection (replaced binary >80 threshold)
    # USER FEEDBACK: Linear scaling doesn't capture reality - bad shooters (Rudy Gobert)
    # should take almost ZERO threes, not just fewer. Need exponential drop-off.
    #
    # Asymmetric scaling:
    # - Above average (composite > 50): Linear growth (gentle)
    # - Below average (composite < 50): Exponential decay (steep drop-off)

    # 3PT shot selection modifier
    composite_diff_3pt = composite_3pt - 50

    # Position restrictions: Centers/PFs don't get POSITIVE bonus, but DO get negative penalty
    if composite_diff_3pt >= 0:
        # Above average: only guards/forwards get bonus (doubled to 0.008 for stronger differentiation)
        if position not in ['C', 'PF']:
            three_pt_bonus = composite_diff_3pt * 0.008  # ~32% bonus at composite=90
        else:
            three_pt_bonus = 0.0  # No bonus for big men
    else:
        # Below average: ALL positions get exponential decay (including centers)
        # This creates the "Rudy Gobert effect" - bad shooters take almost no threes
        # Formula: -0.50 * (1 - exp(0.08 * diff))
        # composite=50: 0% penalty
        # composite=40: -33%
        # composite=30: -45%
        # composite=20: -55%
        three_pt_bonus = -0.50 * (1.0 - math.exp(0.08 * composite_diff_3pt))

    distribution['3pt'] += three_pt_bonus
    # Reduce midrange/rim proportionally (60% from midrange, 40% from rim)
    distribution['midrange'] -= three_pt_bonus * 0.6
    distribution['rim'] -= three_pt_bonus * 0.4

    # Rim shot selection modifier (all positions)
    # Apply same asymmetric logic: good finishers attack rim much more,
    # poor finishers avoid rim (settle for jumpers)
    composite_diff_rim = composite_rim - 50

    if composite_diff_rim >= 0:
        # Above average: linear growth
        # M4.5 PHASE 3c: Reduced from 0.008 to 0.005 to reduce rim attempt inflation
        # OLD: 0.008 = ~32% bonus at composite=90 (too aggressive)
        # NEW: 0.005 = ~20% bonus at composite=90 (more realistic)
        rim_bonus = composite_diff_rim * 0.005  # ~20% bonus at composite=90
    else:
        # Below average: STEEP exponential decay
        # Poor finishers avoid rim (settle for jumpers)
        rim_bonus = -0.50 * (1.0 - math.exp(0.08 * composite_diff_rim))

    distribution['rim'] += rim_bonus
    # Reduce 3pt/midrange proportionally (50% from each)
    distribution['3pt'] -= rim_bonus * 0.5
    distribution['midrange'] -= rim_bonus * 0.5

    # Tactical modifiers: Pace affects shot selection
    if tactical_settings.pace == 'fast':
        # Fast pace: More rim attempts (transition opportunities)
        distribution['rim'] += SHOT_DISTRIBUTION_TACTICAL_MOD * 0.5
        distribution['midrange'] -= SHOT_DISTRIBUTION_TACTICAL_MOD * 0.5
    elif tactical_settings.pace == 'slow':
        # Slow pace: More midrange (halfcourt sets)
        distribution['midrange'] += SHOT_DISTRIBUTION_TACTICAL_MOD * 0.5
        distribution['rim'] -= SHOT_DISTRIBUTION_TACTICAL_MOD * 0.5

    # Zone defense: +5% to 3PT attempts
    if defense_type == 'zone':
        distribution['3pt'] += ZONE_DEFENSE_3PT_ATTEMPT_BONUS
        distribution['rim'] -= ZONE_DEFENSE_3PT_ATTEMPT_BONUS * 0.5
        distribution['midrange'] -= ZONE_DEFENSE_3PT_ATTEMPT_BONUS * 0.5

    # Transition: Heavy rim emphasis
    if possession_context.is_transition:
        distribution['rim'] += 0.20
        distribution['3pt'] -= 0.10
        distribution['midrange'] -= 0.10

    # PHASE 3C: Bravery Drive Tendency
    # Brave players attack the rim more, timid players settle for perimeter
    bravery = shooter.get('bravery', 50)
    bravery_rim_bonus = (bravery - 50) * BRAVERY_RIM_TENDENCY_SCALE
    distribution['rim'] += bravery_rim_bonus
    # Reduce 3pt/midrange proportionally to compensate
    # Split reduction 60% from 3pt, 40% from midrange
    distribution['3pt'] -= bravery_rim_bonus * 0.6
    distribution['midrange'] -= bravery_rim_bonus * 0.4

    # M3 END-GAME: Apply end-game 3PT adjustment (desperation/conserve modes)
    if endgame_3pt_adjustment != 0.0:
        distribution['3pt'] += endgame_3pt_adjustment
        # Reduce midrange/rim proportionally (60/40 split)
        distribution['midrange'] -= endgame_3pt_adjustment * 0.6
        distribution['rim'] -= endgame_3pt_adjustment * 0.4

    # M4.7: Floor distributions at 0.0 to prevent negative values
    # Extreme composite differences can drive midrange negative
    for shot_type in distribution:
        distribution[shot_type] = max(0.0, distribution[shot_type])

    # Normalize to 100%
    distribution = normalize_probabilities(distribution)

    # Weighted random selection
    shot_types = list(distribution.keys())
    weights = list(distribution.values())

    return weighted_random_choice(shot_types, weights)


# =============================================================================
# CONTEST PENALTY CALCULATION
# =============================================================================

def calculate_contest_penalty(
    contest_distance: float,
    defender_composite: float,
    shot_type: str,
    defense_type: str = 'man',
    shooter: Optional[Dict[str, Any]] = None
) -> float:
    """
    Calculate shot contest penalty based on distance, defender quality, and shot type.

    M4 FIX ITERATION 7: Shot-type-specific contest penalties
    Different shot types have different contest sensitivity:
    - 3PT: Highly sensitive (need space and time)
    - Midrange: Moderately sensitive
    - Rim (layups/dunks): Less sensitive (can use physicality)

    Distance Tiers:
    - >= 6.0 ft: Wide open (0% penalty)
    - 2.0 - 6.0 ft: Contested (penalty varies by shot type)
    - < 2.0 ft: Heavily contested (penalty varies by shot type)

    Defender Modifier:
    - (defender_composite - 50) * 0.001 = ±5% adjustment
    - Elite defender (90): -0.04 additional penalty
    - Poor defender (30): +0.02 penalty reduction

    Zone Defense:
    - Reduces defender effectiveness by 15% for 3PT shots

    Args:
        contest_distance: Distance in feet (0-10)
        defender_composite: Defender's contest composite (1-100)
        shot_type: Shot type key ('3PT', 'midrange_short', 'midrange_long', 'rim')
        defense_type: 'man' or 'zone'

    Returns:
        Penalty as negative float (e.g., -0.18 = -18% penalty)
    """
    # Normalize shot_type to match CONTEST_PENALTIES keys
    if shot_type in ['layup', 'dunk']:
        penalty_key = 'rim'
    elif shot_type.startswith('midrange'):
        penalty_key = shot_type
    elif shot_type in ['3pt', '3PT']:
        penalty_key = '3PT'
    else:
        # Default to rim if unknown (should not happen)
        penalty_key = 'rim'

    # Get shot-type-specific penalties
    penalties = CONTEST_PENALTIES[penalty_key]

    # Determine base penalty from distance and shot type
    if contest_distance >= CONTEST_DISTANCE_WIDE_OPEN:
        base_penalty = penalties['wide_open']  # 0%
    elif contest_distance >= CONTEST_DISTANCE_CONTESTED:
        base_penalty = penalties['contested']  # Varies by shot type
    else:
        base_penalty = penalties['heavy']  # Varies by shot type

    # Defender quality modifier (±5%)
    # Elite defender (90): (90-50) * 0.001 = 0.04, then NEGATE to make penalty worse
    # Poor defender (30): (30-50) * 0.001 = -0.02, then NEGATE to make penalty better
    # So we SUBTRACT the modifier to make elite defenders increase the penalty
    defender_modifier = (defender_composite - 50) * CONTEST_DEFENDER_MOD_SCALE

    # Zone defense reduces contest effectiveness on 3PT shots
    if defense_type == 'zone' and penalty_key == '3PT':
        # Apply -15% to defender effectiveness (makes penalty less severe)
        defender_modifier *= (1.0 + ZONE_DEFENSE_CONTEST_PENALTY)

    # Total penalty (more negative = harder shot)
    # SUBTRACT defender_modifier so elite defenders make it MORE negative
    total_penalty = base_penalty - defender_modifier

    # ATTRIBUTE EXPANSION: Patience reduces contest impact (very slightly)
    # DISABLED: Testing if patience is adding unwanted variance
    # Patient players (>50) handle pressure better → less severe penalty
    # Impatient players (<50) struggle under pressure → more severe penalty
    # if shooter is not None:
    #     patience = shooter.get('patience', 50)
    #     patience_modifier = (patience - 50) * PATIENCE_CONTEST_REDUCTION_SCALE
    #     # Positive patience_modifier reduces penalty severity (makes it less negative)
    #     total_penalty = total_penalty - patience_modifier

    # Ensure penalty doesn't become positive (that would boost success rate)
    total_penalty = min(0.0, total_penalty)

    return total_penalty


# =============================================================================
# HELP DEFENSE
# =============================================================================

def check_help_defense(
    primary_defender_composite: float,
    contest_distance: float,
    help_defenders: List[Dict[str, Any]]
) -> Optional[Dict[str, Any]]:
    """
    Determine if help defense rotates to contest shot.

    Trigger Condition: Primary defender beaten (contest quality < 30%)

    Algorithm:
    1. Calculate primary contest quality (inverse of distance normalized)
    2. If contest_quality >= 0.30: No help needed, return None
    3. For each help_defender:
        - Calculate help probability using awareness sigmoid
        - P = 1 / (1 + exp(-0.05 * (awareness - 50)))
        - If roll succeeds: return help_defender
    4. If multiple succeed: return first (simplified for M1)
    5. If none succeed: return None

    Args:
        primary_defender_composite: Primary defender's contest composite
        contest_distance: How far primary defender is (feet)
        help_defenders: List of potential help defenders

    Returns:
        Help defender who rotates, or None if no help
    """
    # Calculate primary contest quality (0-1 scale)
    # Wide open (6+ ft) = 0% quality, close (<2 ft) = 100% quality
    if contest_distance >= CONTEST_DISTANCE_WIDE_OPEN:
        contest_quality = 0.0
    elif contest_distance <= 0.5:
        contest_quality = 1.0
    else:
        # Linear interpolation between 0 and 1
        contest_quality = (CONTEST_DISTANCE_WIDE_OPEN - contest_distance) / CONTEST_DISTANCE_WIDE_OPEN

    # Adjust by defender composite (better defender = better contest quality)
    defender_factor = primary_defender_composite / 100.0
    contest_quality = contest_quality * (0.5 + 0.5 * defender_factor)

    # Check if help needed
    if contest_quality >= HELP_DEFENSE_TRIGGER_THRESHOLD:
        return None  # Primary defender doing fine

    # No help defenders available
    if not help_defenders:
        return None

    # Check each help defender for rotation
    for help_defender in help_defenders:
        awareness = help_defender.get('awareness', 50)

        # Help rotation probability based on awareness
        # P = sigmoid(-k * (awareness - 50))
        # High awareness (90): ~92% chance to help
        # Average (50): 50% chance
        # Low (30): ~27% chance
        sigmoid_input = -HELP_DEFENSE_AWARENESS_K * (awareness - 50)
        help_probability = sigmoid(sigmoid_input)

        if roll_success(help_probability):
            return help_defender

    return None


# =============================================================================
# SHOT BLOCKING
# =============================================================================

def determine_block_outcome(
    shooter: Dict[str, Any],
    defender: Dict[str, Any],
    shot_type: str
) -> Tuple[str, Dict[str, Any]]:
    """
    Determine what happens to blocked shot based on player attributes.

    Three possible outcomes:
    - 'stays_in_play': Ball is loose, becomes scramble/rebound (65% baseline)
    - 'out_off_shooter': Ball goes out off shooter, defense gets possession (23% baseline)
    - 'out_off_blocker': Ball goes out off blocker, offense retains (12% baseline)

    Algorithm:
    1. Calculate four composites (defender control, shooter recover, aggression, redirect)
    2. Use sigmoid to convert composites to scores
    3. Weight scores by baseline probabilities
    4. Normalize and select outcome

    Args:
        shooter: Shooter player dict
        defender: Defender player dict
        shot_type: Shot type (for context/future enhancements)

    Returns:
        Tuple of (outcome_string, debug_info_dict)
    """
    # Calculate composites for each outcome factor
    defender_control = calculate_composite(defender, WEIGHTS_BLOCK_CONTROL)
    shooter_recover = calculate_composite(shooter, WEIGHTS_BLOCK_SHOOTER_RECOVER)
    defender_aggression = calculate_composite(defender, WEIGHTS_OUT_OFF_SHOOTER)
    shooter_redirect = calculate_composite(shooter, WEIGHTS_OUT_OFF_BLOCKER)

    # Calculate raw scores using sigmoid
    # Higher defender control = more likely to stay in play (controlled deflection)
    stays_in_play_score = sigmoid(SIGMOID_K * (defender_control - 50))

    # Higher defender aggression, lower shooter control = out off shooter
    out_shooter_diff = defender_aggression - shooter_recover
    out_shooter_score = sigmoid(SIGMOID_K * out_shooter_diff)

    # Higher shooter finesse/redirect = out off blocker
    out_blocker_diff = shooter_redirect - defender_control
    out_blocker_score = sigmoid(SIGMOID_K * out_blocker_diff)

    # Weight by baseline probabilities
    weighted_stay = stays_in_play_score * BLOCK_OUTCOME_STAYS_IN_PLAY
    weighted_out_shooter = out_shooter_score * BLOCK_OUTCOME_OUT_OFF_SHOOTER
    weighted_out_blocker = out_blocker_score * BLOCK_OUTCOME_OUT_OFF_BLOCKER

    # Normalize to probabilities
    total = weighted_stay + weighted_out_shooter + weighted_out_blocker

    if total <= 0:
        # Fallback to baseline (shouldn't happen but safety check)
        probabilities = [
            BLOCK_OUTCOME_STAYS_IN_PLAY,
            BLOCK_OUTCOME_OUT_OFF_SHOOTER,
            BLOCK_OUTCOME_OUT_OFF_BLOCKER
        ]
    else:
        probabilities = [
            weighted_stay / total,
            weighted_out_shooter / total,
            weighted_out_blocker / total
        ]

    # Select outcome using weighted random choice
    outcomes = ['stays_in_play', 'out_off_shooter', 'out_off_blocker']
    selected_outcome = weighted_random_choice(outcomes, probabilities)

    # Build debug info
    debug_info = {
        'defender_control_composite': round(defender_control, 2),
        'shooter_recover_composite': round(shooter_recover, 2),
        'defender_aggression_composite': round(defender_aggression, 2),
        'shooter_redirect_composite': round(shooter_redirect, 2),
        'stays_in_play_probability': round(probabilities[0], 4),
        'out_off_shooter_probability': round(probabilities[1], 4),
        'out_off_blocker_probability': round(probabilities[2], 4),
        'selected_outcome': selected_outcome
    }

    return selected_outcome, debug_info


def check_for_block(
    shooter: Dict[str, Any],
    defender: Dict[str, Any],
    shot_type: str,
    contest_distance: float
) -> Optional[Dict[str, Any]]:
    """
    Determine if defender blocks the shot.

    Blocks can only occur when defender is close (< 4 feet typically).
    Most common on rim attempts (layups/dunks), rare on jump shots.

    Algorithm:
    1. Check if block is possible based on contest distance
    2. Get base block rate for shot type
    3. Calculate defender block ability composite
    4. Calculate shooter block avoidance composite
    5. Apply attribute differential using sigmoid
    6. Apply distance modifier (0% if >= 4ft, 50% if 2-4ft, 100% if < 2ft)
    7. Roll for block

    Args:
        shooter: Shooter player dict
        defender: Contesting defender player dict
        shot_type: Shot type string ('3pt', 'midrange', 'dunk', 'layup', etc.)
        contest_distance: How far defender is from shooter (feet)

    Returns:
        Dict with block info if block occurred, None otherwise
        {
            'blocked': True,
            'blocking_player': defender_name,
            'block_probability': final_probability,
            'goes_out_of_bounds': bool
        }
    """
    # DEBUG LOGGING (TEMPORARY)
    import sys
    _debug = False  # Set to True to enable logging
    if _debug:
        print(f"[BLOCK CHECK] shot_type={shot_type}, distance={contest_distance:.2f}ft", file=sys.stderr)

    # Step 1: Check distance eligibility
    if contest_distance >= BLOCK_DISTANCE_THRESHOLD_FAR:
        # Too far to block (4+ feet)
        if _debug:
            print(f"  -> TOO FAR (>={BLOCK_DISTANCE_THRESHOLD_FAR}ft)", file=sys.stderr)
        return None

    # Step 2: Get base block rate for shot type
    base_block_rate = BLOCK_BASE_RATES.get(shot_type, 0.0)  # 0% fallback if key not found

    # If base rate is 0 (key not found), this shot type can't be blocked
    if base_block_rate == 0.0:
        if _debug:
            print(f"  -> NO BASE RATE (key not in BLOCK_BASE_RATES)", file=sys.stderr)
        return None

    # Step 3: Calculate composites
    defender_block_composite = calculate_composite(defender, WEIGHTS_BLOCK_DEFENDER)
    shooter_avoid_composite = calculate_composite(shooter, WEIGHTS_BLOCK_SHOOTER)

    # Step 4: Calculate attribute differential
    # Positive diff = defender favored (more blocks)
    # Negative diff = shooter favored (fewer blocks)
    attribute_diff = defender_block_composite - shooter_avoid_composite

    # Step 5: Calculate block probability
    # Unlike shooting, blocks should have MUCH smaller attribute impact
    # Base rate is the MAX for average matchup, not minimum
    # Formula: base_rate * (1 + (attribute_diff / 100) * 1.0)
    # This gives ±100% adjustment for ±100 attribute diff
    # Example: 16% layup base with +25 diff (elite defender) → 16% * 1.25 = 20%
    # Example: 16% layup base with -25 diff (poor defender) → 16% * 0.75 = 12%
    attribute_modifier = 1.0 + (attribute_diff / 100.0) * 1.0  # Doubled from 0.5 to 1.0
    block_probability = base_block_rate * attribute_modifier

    # Step 6: Apply distance modifier
    if contest_distance >= BLOCK_DISTANCE_THRESHOLD_MID:
        # 2-4 feet: reduced block chance (50% of normal)
        distance_modifier = 0.5
    else:
        # < 2 feet: full block chance
        distance_modifier = 1.0

    final_block_probability = block_probability * distance_modifier

    # Clamp to [0, 1]
    final_block_probability = max(0.0, min(1.0, final_block_probability))

    # Step 7: Roll for block
    roll_value = random.random()
    block_occurred = roll_value < final_block_probability

    if not block_occurred:
        return None

    # Block occurred! Determine outcome using attribute-driven logic
    block_outcome, block_outcome_debug = determine_block_outcome(
        shooter=shooter,
        defender=defender,
        shot_type=shot_type
    )

    return {
        'blocked': True,
        'blocking_player': defender['name'],
        'block_probability': round(final_block_probability, 4),
        'base_block_rate': base_block_rate,
        'defender_composite': round(defender_block_composite, 2),
        'shooter_composite': round(shooter_avoid_composite, 2),
        'attribute_diff': round(attribute_diff, 2),
        'distance_modifier': distance_modifier,
        'roll_value': round(roll_value, 4),
        'block_outcome': block_outcome,  # NEW: 'stays_in_play', 'out_off_shooter', 'out_off_blocker'
        'block_outcome_debug': block_outcome_debug  # NEW: Full calculation details
    }


# =============================================================================
# DUNK VS LAYUP SELECTION
# =============================================================================

def determine_rim_attempt_type(shooter: Dict[str, Any]) -> str:
    """
    Determine if rim attempt is a dunk or layup.

    Algorithm:
    - Calculate dunk composite
    - Calculate layup composite
    - If dunk_composite > 70 AND (height >= 70 OR jumping >= 70): 'dunk'
    - Else: 'layup'

    Args:
        shooter: Shooter player dict

    Returns:
        'dunk' or 'layup'
    """
    dunk_composite = calculate_composite(shooter, WEIGHTS_DUNK)
    height = shooter.get('height', 50)
    jumping = shooter.get('jumping', 50)

    # Can only dunk if physically capable (height OR jumping >= 65)
    # AND has good dunk composite (> 62) - M4.8: Lowered from 70→65→62 to allow more dunks for elite finishers
    if dunk_composite > 62 and (height >= 60 or jumping >= 65):
        return 'dunk'
    else:
        return 'layup'


# =============================================================================
# THREE-POINT SHOT
# =============================================================================

def attempt_3pt_shot(
    shooter: Dict[str, Any],
    defender: Dict[str, Any],
    contest_distance: float,
    possession_context: PossessionContext,
    defense_type: str = 'man'
) -> Tuple[bool, Dict[str, Any]]:
    """
    Simulate 3PT shot attempt with two-stage calculation.

    Two-Stage Process:
    1. Base success from shooter composite (no defense)
    2. Apply contest penalty based on distance + defender quality

    Args:
        shooter: Shooter player dict
        defender: Contest defender player dict
        contest_distance: Defender distance in feet
        possession_context: Current possession context
        defense_type: 'man' or 'zone'

    Returns:
        (success: bool, debug_info: dict)
    """
    # Stage 1: Calculate base success (uncontested)
    shooter_composite = calculate_composite(shooter, WEIGHTS_3PT)
    defender_composite = calculate_composite(defender, WEIGHTS_CONTEST)
    attribute_diff = shooter_composite - defender_composite

    # Base success using weighted sigmoid
    base_success = weighted_sigmoid_probability(
        base_rate=BASE_RATE_3PT,
        attribute_diff=attribute_diff,
        k=SIGMOID_K
    )

    # Stage 2: Apply contest penalty (shot-type-specific)
    contest_penalty = calculate_contest_penalty(
        contest_distance=contest_distance,
        defender_composite=defender_composite,
        shot_type='3pt',
        defense_type=defense_type,
        shooter=shooter
    )

    # Calculate final success rate
    final_success = base_success + contest_penalty  # penalty is negative

    # Apply transition bonus if applicable
    transition_bonus = 0.0
    speed_bonus = 0.0
    if possession_context.is_transition:
        transition_bonus = TRANSITION_BONUS_3PT

        # PHASE 1: Speed attributes enhance transition 3PT attempts (smaller effect than rim)
        speed_composite = calculate_composite(shooter, WEIGHTS_TRANSITION_SUCCESS)
        speed_bonus = (speed_composite - 50) * 0.0008  # ±4% for ±50 speed difference

        final_success += transition_bonus + speed_bonus

    # M4.6: Apply rubber band modifier to help trailing teams
    # score_differential: positive = offense ahead, negative = offense trailing
    team_is_trailing = possession_context.score_differential < 0
    rubber_band_modifier = calculate_rubber_band_modifier(
        score_differential=abs(possession_context.score_differential),
        team_is_trailing=team_is_trailing
    )
    final_success += rubber_band_modifier

    # Clamp to [0, 1]
    final_success = max(0.0, min(1.0, final_success))

    # PHASE 3D: Apply consistency variance
    final_success = apply_consistency_variance(final_success, shooter, action_type="3pt_shot")

    # Roll for success
    roll_value = random.random()
    success = roll_value < final_success

    # Build debug info
    debug_info = {
        'shot_type': '3pt',
        'shooter_name': shooter.get('name', 'Unknown'),
        'defender_name': defender.get('name', 'Unknown'),
        'shooter_composite': round(shooter_composite, 2),
        'defender_composite': round(defender_composite, 2),
        'attribute_diff': round(attribute_diff, 2),
        'base_rate': BASE_RATE_3PT,
        'base_success': round(base_success, 4),
        'contest_distance': round(contest_distance, 2),
        'contest_penalty': round(contest_penalty, 4),
        'transition_bonus': round(transition_bonus, 4),
        'speed_bonus': round(speed_bonus, 4),
        'final_success_rate': round(final_success, 4),
        'roll_value': round(roll_value, 4),
        'result': 'make' if success else 'miss',
        'defense_type': defense_type,
    }

    return success, debug_info


# =============================================================================
# MIDRANGE SHOT
# =============================================================================

def attempt_midrange_shot(
    shooter: Dict[str, Any],
    defender: Dict[str, Any],
    contest_distance: float,
    possession_context: PossessionContext,
    range_type: str = 'short',
    defense_type: str = 'man'
) -> Tuple[bool, Dict[str, Any]]:
    """
    Simulate midrange shot attempt.

    BaseRate:
    - short (10-16 ft): 0.45
    - long (16-23 ft): 0.37

    Args:
        shooter: Shooter player dict
        defender: Contest defender player dict
        contest_distance: Defender distance in feet
        possession_context: Current possession context
        range_type: 'short' or 'long'
        defense_type: 'man' or 'zone'

    Returns:
        (success: bool, debug_info: dict)
    """
    # Determine base rate by range
    if range_type == 'short':
        base_rate = BASE_RATE_MIDRANGE_SHORT
    else:
        base_rate = BASE_RATE_MIDRANGE_LONG

    # Stage 1: Calculate base success
    shooter_composite = calculate_composite(shooter, WEIGHTS_MIDRANGE)
    defender_composite = calculate_composite(defender, WEIGHTS_CONTEST)
    attribute_diff = shooter_composite - defender_composite

    base_success = weighted_sigmoid_probability(
        base_rate=base_rate,
        attribute_diff=attribute_diff,
        k=SIGMOID_K
    )

    # Stage 2: Apply contest penalty (shot-type-specific)
    contest_penalty = calculate_contest_penalty(
        contest_distance=contest_distance,
        defender_composite=defender_composite,
        shot_type=f'midrange_{range_type}',
        defense_type=defense_type,
        shooter=shooter
    )

    # Calculate final success rate
    final_success = base_success + contest_penalty

    # Apply transition bonus if applicable
    transition_bonus = 0.0
    speed_bonus = 0.0
    if possession_context.is_transition:
        transition_bonus = TRANSITION_BONUS_MIDRANGE

        # PHASE 1: Speed attributes enhance transition midrange attempts
        speed_composite = calculate_composite(shooter, WEIGHTS_TRANSITION_SUCCESS)
        speed_bonus = (speed_composite - 50) * 0.001  # ±5% for ±50 speed difference

        final_success += transition_bonus + speed_bonus

    # M4.6: Apply rubber band modifier to help trailing teams
    # score_differential: positive = offense ahead, negative = offense trailing
    team_is_trailing = possession_context.score_differential < 0
    rubber_band_modifier = calculate_rubber_band_modifier(
        score_differential=abs(possession_context.score_differential),
        team_is_trailing=team_is_trailing
    )
    final_success += rubber_band_modifier

    # Clamp to [0, 1]
    final_success = max(0.0, min(1.0, final_success))

    # PHASE 3D: Apply consistency variance
    final_success = apply_consistency_variance(final_success, shooter, action_type="midrange_shot")

    # Roll for success
    roll_value = random.random()
    success = roll_value < final_success

    # Build debug info
    debug_info = {
        'shot_type': f'midrange_{range_type}',
        'shooter_name': shooter.get('name', 'Unknown'),
        'defender_name': defender.get('name', 'Unknown'),
        'shooter_composite': round(shooter_composite, 2),
        'defender_composite': round(defender_composite, 2),
        'attribute_diff': round(attribute_diff, 2),
        'base_rate': base_rate,
        'base_success': round(base_success, 4),
        'contest_distance': round(contest_distance, 2),
        'contest_penalty': round(contest_penalty, 4),
        'transition_bonus': round(transition_bonus, 4),
        'speed_bonus': round(speed_bonus, 4),
        'final_success_rate': round(final_success, 4),
        'roll_value': round(roll_value, 4),
        'result': 'make' if success else 'miss',
        'defense_type': defense_type,
    }

    return success, debug_info


# =============================================================================
# RIM ATTEMPT (DUNK OR LAYUP)
# =============================================================================

def attempt_rim_shot(
    shooter: Dict[str, Any],
    defender: Dict[str, Any],
    contest_distance: float,
    possession_context: PossessionContext,
    attempt_type: Optional[str] = None,
    defense_type: str = 'man'
) -> Tuple[bool, Dict[str, Any]]:
    """
    Simulate rim attempt (dunk or layup).

    If attempt_type is None, automatically determines dunk vs layup.

    Dunk: WEIGHTS_DUNK, BASE_RATE_DUNK (0.80)
    Layup: WEIGHTS_LAYUP, BASE_RATE_LAYUP (0.62)

    Args:
        shooter: Shooter player dict
        defender: Contest defender player dict
        contest_distance: Defender distance in feet
        possession_context: Current possession context
        attempt_type: 'dunk' or 'layup' (None = auto-determine)
        defense_type: 'man' or 'zone'

    Returns:
        (success: bool, debug_info: dict)
    """
    # Auto-determine dunk vs layup if not specified
    if attempt_type is None:
        attempt_type = determine_rim_attempt_type(shooter)

    # Select appropriate weights and base rate
    if attempt_type == 'dunk':
        weights = WEIGHTS_DUNK
        base_rate = BASE_RATE_DUNK
    else:
        weights = WEIGHTS_LAYUP
        base_rate = BASE_RATE_LAYUP

    # Stage 1: Calculate base success
    shooter_composite = calculate_composite(shooter, weights)
    defender_composite = calculate_composite(defender, WEIGHTS_CONTEST)
    attribute_diff = shooter_composite - defender_composite

    base_success = weighted_sigmoid_probability(
        base_rate=base_rate,
        attribute_diff=attribute_diff,
        k=SIGMOID_K
    )

    # Stage 2: Apply contest penalty (shot-type-specific, with rim penalties less than 3PT)
    contest_penalty = calculate_contest_penalty(
        contest_distance=contest_distance,
        defender_composite=defender_composite,
        shot_type=attempt_type,
        defense_type=defense_type,
        shooter=shooter
    )

    # Calculate final success rate
    final_success = base_success + contest_penalty

    # Apply transition bonus if applicable
    transition_bonus = 0.0
    speed_bonus = 0.0
    if possession_context.is_transition:
        transition_bonus = TRANSITION_BONUS_RIM

        # PHASE 1: Speed attributes (acceleration + top_speed) enhance transition effectiveness
        # Fast players finish breaks more effectively
        speed_composite = calculate_composite(shooter, WEIGHTS_TRANSITION_SUCCESS)
        speed_bonus = (speed_composite - 50) * 0.0015  # ±7.5% for ±50 speed difference

        final_success += transition_bonus + speed_bonus

    # M4.6: Apply rubber band modifier to help trailing teams
    # score_differential: positive = offense ahead, negative = offense trailing
    team_is_trailing = possession_context.score_differential < 0
    rubber_band_modifier = calculate_rubber_band_modifier(
        score_differential=abs(possession_context.score_differential),
        team_is_trailing=team_is_trailing
    )
    final_success += rubber_band_modifier

    # Clamp to [0, 1]
    final_success = max(0.0, min(1.0, final_success))

    # PHASE 3D: Apply consistency variance
    final_success = apply_consistency_variance(final_success, shooter, action_type="rim_shot")

    # Roll for success
    roll_value = random.random()
    success = roll_value < final_success

    # Build debug info
    debug_info = {
        'shot_type': attempt_type,
        'shooter_name': shooter.get('name', 'Unknown'),
        'defender_name': defender.get('name', 'Unknown'),
        'shooter_composite': round(shooter_composite, 2),
        'defender_composite': round(defender_composite, 2),
        'attribute_diff': round(attribute_diff, 2),
        'base_rate': base_rate,
        'base_success': round(base_success, 4),
        'contest_distance': round(contest_distance, 2),
        'contest_penalty': round(contest_penalty, 4),
        'transition_bonus': round(transition_bonus, 4),
        'speed_bonus': round(speed_bonus, 4),
        'final_success_rate': round(final_success, 4),
        'roll_value': round(roll_value, 4),
        'result': 'make' if success else 'miss',
        'defense_type': defense_type,
    }

    return success, debug_info


# =============================================================================
# UNIFIED SHOT ATTEMPT INTERFACE
# =============================================================================

def attempt_shot(
    shooter: Dict[str, Any],
    defender: Dict[str, Any],
    shot_type: str,
    contest_distance: float,
    possession_context: PossessionContext,
    defense_type: str = 'man'
) -> Tuple[bool, Dict[str, Any]]:
    """
    Unified interface for all shot attempts.

    Routes to appropriate shot function based on shot_type.
    Also checks for blocks BEFORE shot attempt.

    Args:
        shooter: Shooter player dict
        defender: Contest defender player dict
        shot_type: '3pt', 'midrange', or 'rim'
        contest_distance: Defender distance in feet
        possession_context: Current possession context
        defense_type: 'man' or 'zone'

    Returns:
        (success: bool, debug_info: dict)
        If blocked, debug_info will contain 'outcome': 'blocked_shot'
    """
    # Determine specific shot detail for rim attempts (needed for block check)
    shot_detail = shot_type
    if shot_type == 'rim':
        # Determine dunk vs layup
        shot_detail = determine_rim_attempt_type(shooter)

    # CRITICAL: Check for block BEFORE shot attempt
    # Blocks prevent the shot from even being attempted
    block_result = check_for_block(
        shooter=shooter,
        defender=defender,
        shot_type=shot_detail,  # Use specific detail (dunk/layup) for accurate block rates
        contest_distance=contest_distance
    )

    if block_result:
        # Shot was blocked!
        # Calculate attribute composites for tracking even though shot was blocked
        if shot_type == '3pt':
            shooter_composite = calculate_composite(shooter, WEIGHTS_3PT)
            defender_composite = calculate_composite(defender, WEIGHTS_CONTEST)
        elif shot_type == 'midrange':
            shooter_composite = calculate_composite(shooter, WEIGHTS_MIDRANGE)
            defender_composite = calculate_composite(defender, WEIGHTS_CONTEST)
        elif shot_type == 'rim':
            # Use dunk or layup weights based on shot_detail
            if shot_detail == 'dunk':
                shooter_composite = calculate_composite(shooter, WEIGHTS_DUNK)
            else:  # layup
                shooter_composite = calculate_composite(shooter, WEIGHTS_LAYUP)
            defender_composite = calculate_composite(defender, WEIGHTS_CONTEST)
        else:
            shooter_composite = 50.0
            defender_composite = 50.0

        attribute_diff = shooter_composite - defender_composite

        # Return as a "miss" with special outcome flag
        debug_info = {
            'shot_type': shot_type,
            'shot_detail': shot_detail,
            'shooter_name': shooter.get('name', 'Unknown'),
            'defender_name': defender.get('name', 'Unknown'),
            'shooter_composite': round(shooter_composite, 2),
            'defender_composite': round(defender_composite, 2),
            'attribute_diff': round(attribute_diff, 2),
            'contest_distance': round(contest_distance, 2),
            'defense_type': defense_type,
            'outcome': 'blocked_shot',  # CRITICAL: Special outcome
            'block_info': block_result,
            'blocking_player': block_result['blocking_player'],
            'block_outcome': block_result['block_outcome'],  # NEW: three possible outcomes
            'result': 'blocked',
        }

        # Return False (shot missed), with block info in debug
        return False, debug_info

    # No block - proceed with normal shot attempt
    if shot_type == '3pt':
        return attempt_3pt_shot(
            shooter=shooter,
            defender=defender,
            contest_distance=contest_distance,
            possession_context=possession_context,
            defense_type=defense_type
        )

    elif shot_type == 'midrange':
        # For simplicity, randomly choose short vs long for now
        # In full implementation, this would be based on court position
        range_type = 'short' if random.random() < 0.5 else 'long'
        return attempt_midrange_shot(
            shooter=shooter,
            defender=defender,
            contest_distance=contest_distance,
            possession_context=possession_context,
            range_type=range_type,
            defense_type=defense_type
        )

    elif shot_type == 'rim':
        return attempt_rim_shot(
            shooter=shooter,
            defender=defender,
            contest_distance=contest_distance,
            possession_context=possession_context,
            attempt_type=shot_detail,  # Pass the determined type
            defense_type=defense_type
        )

    else:
        raise ValueError(f"Invalid shot_type: {shot_type}")


# =============================================================================
# CONTEST DISTANCE SIMULATION
# =============================================================================

def simulate_contest_distance(
    shooter: Dict[str, Any],
    defender: Dict[str, Any]
) -> float:
    """
    Simulate how close defender gets to contest the shot.

    Uses defender's speed/reactions/agility to determine distance.

    Algorithm:
    1. Calculate defender's contest composite (reactions/agility/height)
    2. Base distance = 6.0 ft (wide open)
    3. Reduce by (composite - 50) * 0.05
       - Elite defender (90): 6.0 - (40 * 0.05) = 4.0 ft (contested)
       - Average defender (50): 6.0 ft (wide open)
       - Poor defender (30): 6.0 + (20 * 0.05) = 7.0 ft (more open)
    4. Add randomness: ±1.0 ft
    5. Clamp to [0.5, 10.0]

    Args:
        shooter: Shooter player dict (not used in M1, future: speed affects separation)
        defender: Defender player dict

    Returns:
        Distance in feet (0.5-10.0)
    """
    # Calculate defender's contest ability
    defender_composite = calculate_composite(defender, WEIGHTS_CONTEST)

    # Base distance: 4.0 ft (contested) - changed from 6.0 to make average defenders contest
    # This ensures average defenders produce contested shots, not wide open
    base_distance = 4.0

    # Adjust by defender composite
    # Elite defender (90): 4.0 - 2.0 = 2.0 ft (heavily contested)
    # Average (50): 4.0 ft (contested)
    # Poor (30): 4.0 + 1.0 = 5.0 ft (lightly contested)
    composite_adjustment = (defender_composite - 50) * 0.05
    distance = base_distance - composite_adjustment

    # Add randomness (±1.0 ft)
    randomness = random.uniform(-1.0, 1.0)
    distance += randomness

    # Clamp to valid range
    distance = max(0.5, min(10.0, distance))

    return distance
