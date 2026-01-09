"""
Basketball Simulator - Possession Orchestration System

Main orchestrator for complete possession flow:
1. Possession start (select ball handler, turnover check)
2. Shot attempt (shooter selection, defender assignment, shot type, attempt)
3. Rebound flow (OREB/DREB, putback logic)
4. Assist attribution
5. Transition detection
6. Play-by-play generation

Integrates: shooting.py, defense.py, turnovers.py, rebounding.py
"""

import random
import math
from typing import Dict, List, Any, Tuple, Optional

from ..core.probability import (
    calculate_composite,
    weighted_random_choice,
    roll_success,
    sigmoid
)
from ..core.data_structures import (
    PossessionContext,
    TacticalSettings,
    PossessionResult,
    EndGameModifiers  # M3 End-game Logic
)
from ..constants import (
    USAGE_SCORING_OPTION_1,
    USAGE_SCORING_OPTION_2,
    USAGE_SCORING_OPTION_3,
    USAGE_OTHERS,
    ASSIST_TIME_THRESHOLD,
    WEIGHTS_DRIVE_DUNK,
    WEIGHTS_DRIVE_LAYUP,
    WEIGHTS_DRIVE_KICKOUT,
    WEIGHTS_DRIVE_TURNOVER,
    SIGMOID_K,
    WEIGHTS_3PT,
    WEIGHTS_MIDRANGE,
    WEIGHTS_DUNK,
    WEIGHTS_LAYUP
)

# Import Phase 2 systems
from . import shooting
from . import defense
from . import turnovers
from . import rebounding
from . import free_throws  # Keep module import for compatibility
from .free_throws import simulate_free_throw_sequence  # M3 FIX: Direct import to avoid shadowing

# M3 End-game Logic
from . import end_game_modes


# =============================================================================
# USAGE DISTRIBUTION & SHOOTER SELECTION
# =============================================================================

def calculate_shot_creation_ability(player: Dict[str, Any]) -> float:
    """
    Calculate a player's shot creation ability - their capacity to GET shots,
    not just MAKE them.

    M4.5 PHASE 3 (REVISED): Usage should be based on ability to create offense,
    not just ability to finish. Traditional centers (Hassan, Rudy Gobert) can
    FINISH at elite levels but can't CREATE their own shots - they need to be
    fed the ball. Guards and wings with handles can create offense.

    Key insight: Hassan SHOULD take 90% of his shots at rim (that's realistic).
    But he should GET the ball less often because he can't create his own shot.

    Shot Creation Components:
    1. Ball Handling (40%): Can they dribble and create off the dribble?
       - Deception: 40% (key for handles, crossovers)
       - Hand-eye coordination: 30% (dribbling control)
       - Agility: 30% (change of pace/direction)

    2. Playmaking (40%): Can they run offense and make decisions?
       - Awareness: 30% (reading the defense)
       - Creativity: 30% (finding unique angles)
       - Patience: 20% (waiting for right moment)
       - Composure: 20% (decisions under pressure)

    3. Scoring Ability (20%): Best of their three shot type composites
       - Need at least ONE strong scoring option to be a threat

    Args:
        player: Player dictionary with attributes

    Returns:
        Shot creation score (0-100 scale)
        - 90+: Elite shot creator (Luka, LeBron, KD)
        - 70-90: Good shot creator (most starting guards/wings)
        - 50-70: Limited shot creator (role players, specialists)
        - <50: Non-creator (traditional centers, spot-up only)

    Examples (expected):
    - Chris Maestro (PG, playmaker): ~80 (elite playmaking, good handles)
    - Marcus Slasher (SF, slasher): ~75 (good handles, elite at rim)
    - Hassan Swatter (C, rim-only): ~45 (poor handles, poor playmaking)
    - Ray Sniper (SG, shooter): ~65 (moderate handles, elite shooting)
    """
    # Component 1: Ball Handling Ability (40%)
    ball_handling_composite = (
        player.get('deception', 50) * 0.40 +
        player.get('hand_eye_coordination', 50) * 0.30 +
        player.get('agility', 50) * 0.30
    )

    # Component 2: Playmaking Ability (40%)
    playmaking_composite = (
        player.get('awareness', 50) * 0.30 +
        player.get('creativity', 50) * 0.30 +
        player.get('patience', 50) * 0.20 +
        player.get('composure', 50) * 0.20
    )

    # Component 3: Scoring Ability (20%) - BEST shot type composite
    composite_3pt = calculate_composite(player, WEIGHTS_3PT)
    composite_mid = calculate_composite(player, WEIGHTS_MIDRANGE)
    composite_dunk = calculate_composite(player, WEIGHTS_DUNK)
    composite_layup = calculate_composite(player, WEIGHTS_LAYUP)
    composite_rim = (composite_dunk + composite_layup) / 2.0

    best_scoring = max(composite_3pt, composite_mid, composite_rim)

    # Final shot creation score (weighted average)
    shot_creation = (
        ball_handling_composite * 0.40 +
        playmaking_composite * 0.40 +
        best_scoring * 0.20
    )

    return shot_creation


def build_usage_distribution(
    team: List[Dict[str, Any]],
    tactical_settings: TacticalSettings
) -> Dict[str, float]:
    """
    Build usage distribution for shooter selection.

    M4.5 PHASE 3 (REVISED): Applies 30%/20%/15% to scoring options, remaining %
    weighted by shot creation ability (ball handling + playmaking + scoring).

    Args:
        team: List of 5 players
        tactical_settings: Tactical settings with scoring options

    Returns:
        Dict mapping player name to usage percentage (sums to 1.0)

    Algorithm:
    1. Start with 0% for all players
    2. Assign option1 → 30%, option2 → 20%, option3 → 15%
    3. Check if each option is available (in team, stamina check future)
    4. If option unavailable: redistribute to others pool
    5. M4.5 PHASE 3 (REVISED): Weight remaining usage by shot creation ability
       - Non-creators (Hassan ~45): Lower usage (~10-12%)
       - Shot creators (Chris ~80): Higher usage (~20-25%)
       - Matches NBA reality: Gobert 14% vs Luka 36%
       - Key: Hassan still takes 90% at rim, he just gets ball less often
    """
    usage = {player['name']: 0.0 for player in team}

    # Track which players are scoring options (use set to avoid duplicates)
    options_assigned = set()
    allocated_usage = 0.0

    # Option 1: 30%
    if tactical_settings.scoring_option_1:
        option1_name = tactical_settings.scoring_option_1
        if option1_name in usage and option1_name not in options_assigned:
            usage[option1_name] = USAGE_SCORING_OPTION_1
            options_assigned.add(option1_name)
            allocated_usage += USAGE_SCORING_OPTION_1

    # Option 2: 20%
    if tactical_settings.scoring_option_2:
        option2_name = tactical_settings.scoring_option_2
        if option2_name in usage and option2_name not in options_assigned:
            usage[option2_name] = USAGE_SCORING_OPTION_2
            options_assigned.add(option2_name)
            allocated_usage += USAGE_SCORING_OPTION_2

    # Option 3: 15%
    if tactical_settings.scoring_option_3:
        option3_name = tactical_settings.scoring_option_3
        if option3_name in usage and option3_name not in options_assigned:
            usage[option3_name] = USAGE_SCORING_OPTION_3
            options_assigned.add(option3_name)
            allocated_usage += USAGE_SCORING_OPTION_3

    # M4.5 PHASE 3 (REVISED): Weight "others" by shot creation ability
    others = [player for player in team if player['name'] not in options_assigned]

    if others:
        # Calculate shot creation ability for each non-option player
        creation_scores = {}
        creation_weights = {}
        total_weighted_creation = 0.0

        for player in others:
            creation = calculate_shot_creation_ability(player)
            creation_scores[player['name']] = creation

            # M4.5 PHASE 3b: Apply exponential penalty to create aggressive differentiation
            # Traditional centers (Hassan ~67) vs playmakers (Chris ~83)
            # Linear: 67/83 = 0.81 (only 19% difference)
            # Exponential (^1.5): 0.55/0.76 = 0.72 (28% difference)
            # This ensures Rudy Gobert-type players get significantly less usage
            creation_weight = (creation / 100.0) ** 1.5
            creation_weights[player['name']] = creation_weight
            total_weighted_creation += creation_weight

        # Distribute remaining usage weighted by shot creation (with exponential penalty)
        # Traditional centers (low handles/playmaking) get MUCH less usage
        # Guards/wings (high handles/playmaking) get more usage
        remaining_usage = 1.0 - allocated_usage

        if total_weighted_creation > 0:
            for player in others:
                player_name = player['name']
                weight_ratio = creation_weights[player_name] / total_weighted_creation
                usage[player_name] = remaining_usage * weight_ratio
        else:
            # Fallback: if all players have 0 creation (edge case), split equally
            others_share = remaining_usage / len(others)
            for player in others:
                usage[player['name']] = others_share

    return usage


def select_shooter(
    team: List[Dict[str, Any]],
    usage_distribution: Dict[str, float]
) -> Dict[str, Any]:
    """
    Select shooter using weighted usage distribution.

    Args:
        team: List of 5 players
        usage_distribution: Dict mapping player name to usage percentage

    Returns:
        Selected shooter (player dict)
    """
    player_names = [player['name'] for player in team]
    weights = [usage_distribution[name] for name in player_names]

    selected_name = weighted_random_choice(player_names, weights)

    # Find and return player dict
    for player in team:
        if player['name'] == selected_name:
            return player

    # Fallback (should never reach)
    return team[0]


def select_ball_handler(
    team: List[Dict[str, Any]],
    usage_distribution: Dict[str, float]
) -> Dict[str, Any]:
    """
    Select ball handler using weighted combination of usage and ball handling ability.

    M5.0: Better ball handlers get possession more often.
    Combines usage distribution (scoring options) with ball handling composite.

    Args:
        team: List of 5 players
        usage_distribution: Dict mapping player name to usage percentage

    Returns:
        Selected ball handler (player dict)
    """
    from ..constants import WEIGHTS_BALL_HANDLING
    from ..core.probability import calculate_composite

    # Calculate ball handling composite for each player
    ball_handling_weights = []
    for player in team:
        # Get usage weight (0-1)
        usage_weight = usage_distribution.get(player['name'], 0.2)

        # Get ball handling composite (0-100)
        ball_handling_composite = calculate_composite(player, WEIGHTS_BALL_HANDLING)

        # Normalize ball handling to 0-1 range
        ball_handling_normalized = ball_handling_composite / 100.0

        # Combine: 60% usage, 40% ball handling
        # This gives scoring options more touches but still rewards good ball handlers
        combined_weight = (usage_weight * 0.60) + (ball_handling_normalized * 0.40)

        ball_handling_weights.append(combined_weight)

    # Select using combined weights
    player_names = [player['name'] for player in team]
    selected_name = weighted_random_choice(player_names, ball_handling_weights)

    # Find and return player dict
    for player in team:
        if player['name'] == selected_name:
            return player

    # Fallback (should never reach)
    return team[0]


# =============================================================================
# DRIVE-TO-RIM LOGIC
# =============================================================================

def should_attempt_drive(
    player: Dict[str, Any],
    possession_context: PossessionContext
) -> bool:
    """
    Determine if rim attempt is a drive vs post-up.

    Drive probability based on speed/agility attributes.

    Args:
        player: Offensive player
        possession_context: Current possession context

    Returns:
        True if drive, False if post-up
    """
    # Calculate drive propensity (speed + agility based)
    drive_composite = (
        player.get('top_speed', 50) * 0.4 +
        player.get('agility', 50) * 0.3 +
        player.get('acceleration', 50) * 0.3
    )

    # Baseline: 70% drive, 30% post-up
    drive_probability = 0.70

    # Adjust by player speed
    # Fast players (80+): 85% drive
    # Slow players (30-): 50% drive
    drive_adjustment = (drive_composite - 50) * 0.003  # ±0.15 for ±50 diff
    drive_probability += drive_adjustment

    # Transition almost always drives
    if possession_context.is_transition:
        drive_probability = 0.95

    # Clamp
    drive_probability = max(0.0, min(1.0, drive_probability))

    return roll_success(drive_probability)


def simulate_drive_outcome(
    driver: Dict[str, Any],
    defender: Dict[str, Any],
    help_defenders: List[Dict[str, Any]]
) -> Tuple[str, Optional[Dict[str, Any]], Dict[str, Any]]:
    """
    Simulate four-way drive outcome: dunk/layup/kickout/turnover.

    Uses four separate composites, normalizes to probabilities.
    Also determines if help defender "takes over" primary contest.

    Args:
        driver: Offensive player driving
        defender: Primary defender
        help_defenders: Potential help defenders

    Returns:
        Tuple of (outcome, final_defender, debug_info)
        outcome: 'dunk', 'layup', 'kickout', 'turnover'
        final_defender: Defender who ends up contesting (primary or help), None if kickout/turnover
    """
    # Calculate average defender composite
    defender_composite = calculate_composite(defender, WEIGHTS_DRIVE_DUNK)

    if help_defenders:
        help_composites = [calculate_composite(h, WEIGHTS_DRIVE_DUNK) for h in help_defenders]
        avg_defender = (defender_composite + sum(help_composites)) / (1 + len(help_defenders))
    else:
        avg_defender = defender_composite

    # Calculate four outcome composites
    dunk_composite = calculate_composite(driver, WEIGHTS_DRIVE_DUNK)
    layup_composite = calculate_composite(driver, WEIGHTS_DRIVE_LAYUP)
    kickout_composite = calculate_composite(driver, WEIGHTS_DRIVE_KICKOUT)
    turnover_composite = calculate_composite(driver, WEIGHTS_DRIVE_TURNOVER)

    # Calculate sigmoid scores for each outcome
    dunk_diff = dunk_composite - avg_defender
    layup_diff = layup_composite - avg_defender
    kickout_diff = kickout_composite - avg_defender
    turnover_diff = turnover_composite - avg_defender

    dunk_score = sigmoid(SIGMOID_K * dunk_diff)
    layup_score = sigmoid(SIGMOID_K * layup_diff)
    kickout_score = sigmoid(SIGMOID_K * kickout_diff)
    turnover_score = sigmoid(SIGMOID_K * turnover_diff)

    # INVERT turnover score (lower composite = higher turnover chance)
    # REALISM FIX: Tuned from 1.0 → 0.6 (8.87%) → 0.75 (10.73%) → 0.80 (final) for NBA target (12-15%)
    turnover_score = (1.0 - turnover_score) * 0.80

    # Normalize to probabilities
    total_score = dunk_score + layup_score + kickout_score + turnover_score

    if total_score <= 0:
        # Fallback to equal distribution
        probabilities = [0.25, 0.25, 0.25, 0.25]
    else:
        probabilities = [
            dunk_score / total_score,
            layup_score / total_score,
            kickout_score / total_score,
            turnover_score / total_score
        ]

    # Build debug info
    debug_info = {
        'driver_name': driver['name'],
        'defender_name': defender['name'],
        'num_help_defenders': len(help_defenders),
        'avg_defender_composite': avg_defender,
        'dunk_composite': dunk_composite,
        'layup_composite': layup_composite,
        'kickout_composite': kickout_composite,
        'turnover_composite': turnover_composite,
        'dunk_probability': probabilities[0],
        'layup_probability': probabilities[1],
        'kickout_probability': probabilities[2],
        'turnover_probability': probabilities[3],
    }

    # Weighted selection
    outcomes = ['dunk', 'layup', 'kickout', 'turnover']
    outcome = weighted_random_choice(outcomes, probabilities)

    debug_info['selected_outcome'] = outcome

    # Determine final defender (for shot attempts only)
    final_defender = None

    if outcome in ['dunk', 'layup']:
        # Shot attempt - determine if help defender takes over
        # NBA reality: 30-40% of drives see help defender become primary contester

        if help_defenders:
            # Get best help defender (highest rim protection)
            best_help = max(
                help_defenders,
                key=lambda p: (p['jumping'] + p['height'] + p['reactions']) / 3
            )

            # Calculate takeover probability based on defensive matchup
            primary_rim_protection = (defender['jumping'] + defender['height'] + defender['reactions']) / 3
            help_rim_protection = (best_help['jumping'] + best_help['height'] + best_help['reactions']) / 3

            # Base takeover rate: 35%
            base_takeover_rate = 0.35

            # Adjust based on defender quality difference
            if help_rim_protection > primary_rim_protection + 15:
                takeover_prob = 0.60  # Strong help, weak primary
            elif primary_rim_protection < 40:
                takeover_prob = 0.50  # Weak primary defender
            else:
                takeover_prob = base_takeover_rate

            # Roll for help takeover
            if random.random() < takeover_prob:
                final_defender = best_help
                debug_info['help_takeover'] = True
                debug_info['final_defender'] = best_help['name']
            else:
                final_defender = defender
                debug_info['help_takeover'] = False
                debug_info['final_defender'] = defender['name']
        else:
            # No help available, primary defender contests
            final_defender = defender
            debug_info['help_takeover'] = False
            debug_info['final_defender'] = defender['name']

    # For kickout/turnover, no specific defender (possession changes)
    # final_defender remains None

    return outcome, final_defender, debug_info


# =============================================================================
# ASSIST ATTRIBUTION
# =============================================================================

def check_assist(
    shot_type: str,
    shooter: Dict[str, Any],
    teammates: List[Dict[str, Any]]
) -> Tuple[bool, Optional[str], Dict[str, Any]]:
    """
    Determine if assist is credited on made shot.

    M4.8: Now uses attribute-driven passing composite to:
    1. Select passer (weighted by passing composite)
    2. Modify assist probability based on passer quality (±15% for ±50 diff)

    Assist base probability by shot type:
    - 3PT: 90%
    - Midrange: 50%
    - Rim: 65%

    Args:
        shot_type: '3pt', 'midrange', 'rim'
        shooter: Player who made shot
        teammates: Other offensive players (exclude shooter)

    Returns:
        Tuple of (assist_occurred, assister_name, debug_info)
    """
    # Base assist probabilities by shot type
    assist_probs = {
        '3pt': 0.90,
        'midrange': 0.50,
        'rim': 0.65,
        'dunk': 0.65,
        'layup': 0.65,
        'midrange_short': 0.50,
        'midrange_long': 0.50,
    }

    base_assist_prob = assist_probs.get(shot_type, 0.65)

    debug_info = {
        'shot_type': shot_type,
        'shooter_name': shooter['name'],
        'base_assist_probability': base_assist_prob,
    }

    if not teammates:
        debug_info['assister_name'] = None
        debug_info['assist_occurred'] = False
        return False, None, debug_info

    # M4.8: Select passer using passing composite from WEIGHTS_FIND_OPEN_TEAMMATE
    from src.constants import WEIGHTS_FIND_OPEN_TEAMMATE, ASSIST_CONCENTRATION_EXPONENT

    passing_weights = []
    for player in teammates:
        passing_composite = sum(
            player.get(attr, 50) * weight
            for attr, weight in WEIGHTS_FIND_OPEN_TEAMMATE.items()
        )
        passing_weights.append(passing_composite)

    # USER FIX: Apply power law to concentrate assists toward elite ball handlers
    # Exponent = 2.0 means elite passers get ~50-70% of team assists (realistic)
    # This is zero-sum: redistributes from role players to primary handlers
    concentrated_weights = [w ** ASSIST_CONCENTRATION_EXPONENT for w in passing_weights]

    passer = weighted_random_choice(teammates, concentrated_weights)

    # Calculate passer's passing composite
    passer_composite = sum(
        passer.get(attr, 50) * weight
        for attr, weight in WEIGHTS_FIND_OPEN_TEAMMATE.items()
    )

    # M4.8: Adjust assist probability based on passer quality
    # Elite playmaker (95) vs average (50): +13.5% assist chance
    # Poor passer (30) vs average (50): -6% assist chance
    passer_modifier = (passer_composite - 50) * 0.003  # ±15% for ±50 diff
    final_assist_prob = base_assist_prob + passer_modifier
    final_assist_prob = max(0.0, min(1.0, final_assist_prob))  # Clamp [0, 1]

    # Roll for assist
    roll_value = random.random()
    assist_occurred = roll_value < final_assist_prob

    debug_info['passer_name'] = passer['name']
    debug_info['passer_composite'] = passer_composite
    debug_info['passer_modifier'] = passer_modifier
    debug_info['final_assist_probability'] = final_assist_prob
    debug_info['roll_value'] = roll_value
    debug_info['assist_occurred'] = assist_occurred

    if assist_occurred:
        debug_info['assister_name'] = passer['name']
        return True, passer['name'], debug_info
    else:
        debug_info['assister_name'] = None
        return False, None, debug_info


# =============================================================================
# MISSED FINAL FT REBOUND HELPER
# =============================================================================

def handle_missed_final_ft_rebound(
    free_throw_result: Any,
    offensive_team: List[Dict[str, Any]],
    defensive_team: List[Dict[str, Any]],
    tactical_settings_offense: TacticalSettings,
    tactical_settings_defense: TacticalSettings,
    foul_system: Optional[Any],
    quarter: int,
    game_time: str,
    defending_team_name: str,
    events: List[Dict[str, Any]],
    debug: Dict[str, Any],
    offensive_team_normalized: str = 'home'  # M4.5 PHASE 2
) -> Optional[PossessionResult]:
    """
    Check if final FT was missed and handle rebound if so.

    Args:
        free_throw_result: Result of FT sequence
        offensive_team: Offensive team players
        defensive_team: Defensive team players
        tactical_settings_offense: Offensive tactical settings
        tactical_settings_defense: Defensive tactical settings
        foul_system: Foul system instance
        quarter: Current quarter
        game_time: Game time
        defending_team_name: Name of defending team
        events: Play-by-play events list
        debug: Debug dict

    Returns:
        PossessionResult if final FT was missed (rebound occurred), None otherwise
    """
    # Check if final FT was missed
    final_ft_missed = free_throw_result.results[-1] == False if free_throw_result.results else False
    debug['final_ft_missed'] = final_ft_missed

    if not final_ft_missed:
        return None  # Final FT made, no rebound

    # Missed final FT → Rebound situation
    ft_rebound_result = rebounding.simulate_rebound(
        offensive_team=offensive_team,
        defensive_team=defensive_team,
        offensive_strategy=tactical_settings_offense.rebounding_strategy,
        defensive_strategy=tactical_settings_defense.rebounding_strategy,
        shot_type='rim',  # FTs are close-range attempts
        shot_made=False,
        foul_system=foul_system,
        quarter=quarter,
        game_time=game_time,
        defending_team_name=defending_team_name
    )
    debug['ft_rebound'] = ft_rebound_result

    # BUG FIX: Check if loose ball foul occurred during FT rebound
    if ft_rebound_result.get('foul_occurred'):
        loose_ball_foul = ft_rebound_result['loose_ball_foul']

        # Add foul event to play-by-play
        events.append({
            'type': 'foul',
            'fouling_player': loose_ball_foul.fouling_player,
            'fouled_player': loose_ball_foul.fouled_player,
            'foul_type': loose_ball_foul.foul_type,
            'foul_context': 'loose_ball_during_ft_rebound',
            'free_throws': loose_ball_foul.free_throws_awarded,
            'and_one': False,
            'fouled_out': loose_ball_foul.fouled_out,
            'team_fouls_after': loose_ball_foul.team_fouls_after,
            'personal_fouls_after': loose_ball_foul.personal_fouls_after,
            'bonus_triggered': loose_ball_foul.bonus_triggered
        })

        # If free throws awarded from the loose ball foul, handle them
        if loose_ball_foul.free_throws_awarded > 0:
            # Offense gets additional FTs from loose ball foul
            # Find the fouled player in the offensive team
            fouled_player = next(
                (p for p in offensive_team if p['name'] == loose_ball_foul.fouled_player),
                offensive_team[0]  # Fallback
            )

            # Simulate additional free throws
            # BUG FIX: Use correct free throw function and pass required parameters
            additional_ft_result = free_throws.simulate_free_throw_sequence(
                shooter=fouled_player,
                free_throws=loose_ball_foul.free_throws_awarded,
                and_one=False,
                quarter=quarter,
                time_remaining=0,  # Context not critical for loose ball foul FTs
                score_differential=0
            )

            events.append({
                'type': 'free_throws',
                'shooter': additional_ft_result.shooter,
                'made': additional_ft_result.made,
                'attempts': additional_ft_result.attempts,
                'results': additional_ft_result.results
            })

            # Handle additional FT rebounds if needed
            additional_rebound = handle_missed_final_ft_rebound(
                free_throw_result=additional_ft_result,
                offensive_team=offensive_team,
                defensive_team=defensive_team,
                tactical_settings_offense=tactical_settings_offense,
                tactical_settings_defense=tactical_settings_defense,
                foul_system=foul_system,
                quarter=quarter,
                game_time=game_time,
                defending_team_name=defending_team_name,
                events=events,
                debug=debug,
                offensive_team_normalized=offensive_team_normalized
            )

            if additional_rebound:
                # Additional FT was missed, return that rebound result
                additional_rebound.points_scored += free_throw_result.points_scored
                return additional_rebound

            # All FTs made - possession ends
            play_by_play = generate_play_by_play(events, 'foul')

            # BUG FIX: If FTs were made, possession should switch (treat like made basket)
            total_points = free_throw_result.points_scored + additional_ft_result.points_scored
            outcome = 'made_shot' if total_points > 0 else 'foul'

            return PossessionResult(
                play_by_play_text=play_by_play,
                possession_outcome=outcome,  # 'made_shot' if FTs made, 'foul' if all missed
                scoring_player=additional_ft_result.shooter if additional_ft_result.points_scored > 0 else None,
                points_scored=total_points,
                foul_event=loose_ball_foul,
                free_throw_result=additional_ft_result,
                debug=debug,
                offensive_team=offensive_team_normalized
            )
        else:
            # No FTs awarded, offense retains possession (kickout)
            play_by_play = generate_play_by_play(events, 'offensive_rebound')

            return PossessionResult(
                play_by_play_text=play_by_play,
                possession_outcome='offensive_rebound',
                rebound_player=ft_rebound_result['rebounder_name'],
                points_scored=free_throw_result.points_scored,
                foul_event=loose_ball_foul,
                debug=debug,
                offensive_team=offensive_team_normalized
            )

    # Record rebound event in play-by-play
    events.append({
        'type': 'rebound',
        'rebounder': ft_rebound_result['rebounder_name'],
        'is_offensive': ft_rebound_result['offensive_rebound']
    })

    # Check if putback attempted
    if ft_rebound_result['offensive_rebound']:
        if ft_rebound_result['putback_attempted']:
            events[-1]['putback_attempted'] = True
            events[-1]['putback_made'] = ft_rebound_result['putback_made']

            if ft_rebound_result['putback_made']:
                # Putback made after missed FT
                play_by_play = generate_play_by_play(events, 'made_shot')

                # BUG FIX v15: Mark FT putback in debug to track both FT shooter and putback shooter
                debug['ft_putback_made'] = True
                debug['ft_putback_shooter'] = ft_rebound_result['rebounder_name']
                debug['ft_shooter'] = free_throw_result.shooter

                return PossessionResult(
                    play_by_play_text=play_by_play,
                    possession_outcome='made_shot',
                    scoring_player=ft_rebound_result['rebounder_name'],
                    rebound_player=ft_rebound_result['rebounder_name'],
                    points_scored=free_throw_result.points_scored + 2,  # Original FT points + putback
                    debug=debug, offensive_team=offensive_team_normalized
                )
            else:
                # Putback missed
                play_by_play = generate_play_by_play(events, 'missed_shot')

                return PossessionResult(
                    play_by_play_text=play_by_play,
                    possession_outcome='missed_shot',
                    rebound_player=ft_rebound_result['rebounder_name'],
                    points_scored=free_throw_result.points_scored,
                    debug=debug, offensive_team=offensive_team_normalized
                )
        else:
            # Offensive rebound, no putback (kickout)
            play_by_play = generate_play_by_play(events, 'offensive_rebound')

            return PossessionResult(
                play_by_play_text=play_by_play,
                possession_outcome='offensive_rebound',
                rebound_player=ft_rebound_result['rebounder_name'],
                points_scored=free_throw_result.points_scored,
                debug=debug, offensive_team=offensive_team_normalized
            )
    else:
        # Defensive rebound - possession ends
        play_by_play = generate_play_by_play(events, 'missed_shot')

        return PossessionResult(
            play_by_play_text=play_by_play,
            possession_outcome='missed_shot',
            rebound_player=ft_rebound_result['rebounder_name'],
            points_scored=free_throw_result.points_scored,
            debug=debug, offensive_team=offensive_team_normalized
        )


# =============================================================================
# PLAY-BY-PLAY GENERATION
# =============================================================================

def generate_play_by_play(
    possession_events: List[Dict[str, Any]],
    final_outcome: str
) -> str:
    """
    Generate human-readable play-by-play narrative.

    Args:
        possession_events: List of event dicts with type/details
        final_outcome: 'made_shot', 'missed_shot', 'turnover'

    Returns:
        Play-by-play string
    """
    lines = []

    for event in possession_events:
        event_type = event.get('type')

        if event_type == 'turnover':
            # M3 FIX: Pass defender name for better turnover descriptions
            # BUG FIX: Pass foul event for offensive foul tracking
            turnover_desc = turnovers.get_turnover_description(
                event['turnover_type'],
                event['ball_handler'],
                event.get('steal_credited_to'),
                event.get('defender'),  # Include defender for offensive foul context
                event.get('offensive_foul_event')  # Include foul tracking
            )
            lines.append(turnover_desc)

        elif event_type == 'shot_attempt':
            shooter = event['shooter']
            # Use shot_detail if available (dunk/layup), otherwise use shot_type
            display_type = event.get('shot_detail') or event['shot_type']
            shot_type_display = display_type.replace('_', ' ').title()

            # Check if this was a drive with defender handoff
            if event.get('is_drive'):
                original_defender = event.get('drive_original_defender', 'unknown')
                help_arrived = event.get('drive_help_arrived', False)

                if help_arrived:
                    # Help defender took over
                    lines.append(f"{shooter} drives, picks up {original_defender}. Help arrives from {event['defender']}!")
                else:
                    # Primary defender stayed with drive
                    lines.append(f"{shooter} drives, {original_defender} stays with him.")

            lines.append(f"{shooter} attempts a {shot_type_display}.")

            # Contest info
            defender = event['defender']
            distance = event['contest_distance']
            defense_type = event.get('defense_type', 'man').upper()  # MAN or ZONE

            if distance >= 6.0:
                lines.append(f"Wide open! {defender} is {distance:.1f} feet away. [{defense_type}]")
            elif distance >= 2.0:
                lines.append(f"Contested by {defender} ({distance:.1f} feet, {defense_type}).")
            else:
                lines.append(f"Heavily contested by {defender} ({distance:.1f} feet, {defense_type})!")

            # Result
            if event['made']:
                lines.append(f"{shooter.upper()} MAKES IT!")

                # Assist
                if event.get('assist_by'):
                    lines.append(f"Assist: {event['assist_by']}")
            else:
                lines.append(f"{shooter} misses.")

        elif event_type == 'blocked_shot':
            # Blocked shot event
            shooter = event['shooter']
            blocking_player = event['blocking_player']
            display_type = event.get('shot_detail') or event['shot_type']
            shot_type_display = display_type.replace('_', ' ').title()
            block_outcome = event.get('block_outcome', 'stays_in_play')  # NEW

            lines.append(f"{shooter} attempts a {shot_type_display}.")
            lines.append(f"BLOCKED BY {blocking_player.upper()}!")

            # BUG FIX: Describe the three possible outcomes
            # IMPORTANT: Blocked shots are missed shots, not turnovers
            if block_outcome == 'out_off_shooter':
                lines.append(f"Ball deflects out of bounds off {shooter}.")
            elif block_outcome == 'out_off_blocker':
                lines.append(f"Ball goes out off {blocking_player}. {shooter}'s ball!")
            else:  # stays_in_play
                lines.append(f"Ball is loose!")
                # Rebound event will follow

        elif event_type == 'drive':
            driver = event['driver']
            outcome = event['outcome']

            if outcome == 'turnover':
                # USER FIX: Use proper turnover description with dead/live ball context
                lines.append(f"{driver} drives to the basket...")
                # Get turnover details from event
                turnover_type = event.get('turnover_type', 'lost_ball')
                steal_credited_to = event.get('steal_credited_to')
                offensive_foul_event = event.get('offensive_foul_event')  # BUG FIX: Get foul event if present

                # Generate proper description
                if turnover_type == 'lost_ball':
                    if steal_credited_to:
                        lines.append(f"{driver} loses the ball! Stripped by {steal_credited_to}! TURNOVER! (live ball)")
                    else:
                        lines.append(f"{driver} loses control! Ball rolls out of bounds! TURNOVER! (dead ball)")
                else:
                    # Use full turnover description for other types
                    # BUG FIX: Pass foul event for offensive fouls from drives
                    turnover_desc = turnovers.get_turnover_description(
                        turnover_type, driver, steal_credited_to,
                        event.get('defender'),  # Pass defender for context
                        offensive_foul_event  # Pass foul event for tracking
                    )
                    lines.append(turnover_desc)
            elif outcome == 'kickout':
                lines.append(f"{driver} drives and kicks out.")

        elif event_type == 'rebound':
            rebounder = event['rebounder']
            is_offensive = event['is_offensive']

            if is_offensive:
                lines.append(f"Offensive rebound by {rebounder}!")

                if event.get('putback_attempted'):
                    if event.get('putback_made'):
                        lines.append(f"{rebounder} puts it back in!")
                    else:
                        lines.append(f"{rebounder}'s putback is no good.")
                else:
                    lines.append(f"{rebounder} kicks it out.")
            else:
                lines.append(f"Rebound secured by {rebounder}.")

        elif event_type == 'foul':
            # M3: Foul event
            fouling_player = event['fouling_player']
            fouled_player = event['fouled_player']
            foul_type = event['foul_type']
            ft_count = event['free_throws']  # M3 FIX: Renamed to avoid shadowing free_throws module
            and_one = event['and_one']
            fouled_out = event['fouled_out']
            shot_type = event.get('shot_type', 'shot')
            shot_detail = event.get('shot_detail')
            shot_made = event.get('shot_made', False)
            bonus_triggered = event.get('bonus_triggered', False)
            team_fouls_after = event.get('team_fouls_after', 0)
            personal_fouls_after = event.get('personal_fouls_after', 0)

            if foul_type == 'shooting':
                # M3 FIX: Include shot type description for And-1 situations
                if and_one and shot_made:
                    # Describe the made shot before the foul
                    display_type = shot_detail or shot_type
                    shot_type_display = display_type.replace('_', ' ').title()
                    lines.append(f"{fouled_player} makes the {shot_type_display} and draws the foul on {fouling_player}!")
                    lines.append(f"And-1! {fouled_player} to the line for 1.")
                else:
                    # Regular shooting foul (shot missed or not applicable)
                    lines.append(f"FOUL! Shooting foul on {fouling_player}.")
                    if ft_count == 3:
                        lines.append(f"{fouled_player} to the line for 3 free throws.")
                    elif ft_count == 2:
                        lines.append(f"{fouled_player} to the line for 2 free throws.")
                    elif ft_count == 1:
                        lines.append(f"{fouled_player} to the line for 1 free throw.")

                # Display bonus status and team fouls
                if bonus_triggered:
                    lines.append(f"[BONUS: {team_fouls_after} team fouls] ({fouling_player}: {personal_fouls_after} personal fouls)")
                else:
                    lines.append(f"[Team fouls: {team_fouls_after}] ({fouling_player}: {personal_fouls_after} personal fouls)")

                if fouled_out:
                    lines.append(f"{fouling_player} FOULS OUT!")

            elif foul_type == 'non_shooting':
                # Non-shooting foul - determine specific type from context
                foul_context = event.get('foul_context', 'non_shooting')

                if foul_context == 'reach_in_during_drive':
                    lines.append(f"FOUL! Reach-in foul on {fouling_player} during the drive.")
                elif foul_context == 'loose_ball_during_rebound':
                    lines.append(f"FOUL! Loose ball foul on {fouling_player} during the rebound battle.")
                elif foul_context == 'loose_ball_during_ft_rebound':
                    lines.append(f"FOUL! Loose ball foul on {fouling_player} during the free throw rebound!")
                elif foul_context == 'holding':
                    lines.append(f"FOUL! Holding foul on {fouling_player}.")
                else:
                    lines.append(f"FOUL! Non-shooting foul on {fouling_player}.")

                if bonus_triggered:
                    # Bonus triggered - award 2 FTs
                    lines.append(f"[IN THE BONUS! {team_fouls_after} team fouls]")
                    lines.append(f"{fouled_player} to the line for 2 free throws.")
                else:
                    # No bonus - side out
                    lines.append(f"[Team fouls: {team_fouls_after}] No free throws, side out.")

                lines.append(f"({fouling_player}: {personal_fouls_after} personal fouls)")

                if fouled_out:
                    lines.append(f"{fouling_player} FOULS OUT!")

        elif event_type == 'intentional_foul':
            # M3 END-GAME: Intentional foul formatting
            fouling_player = event['fouling_player']
            fouled_player = event['fouled_player']
            ft_count = event.get('free_throws', 0)
            fouled_out = event.get('fouled_out', False)
            team_fouls_after = event.get('team_fouls_after', 0)
            personal_fouls_after = event.get('personal_fouls_after', 0)
            bonus_triggered = event.get('bonus_triggered', False)

            lines.append(f"{fouling_player} intentionally fouls {fouled_player}!")

            # Display bonus status and team fouls
            if bonus_triggered:
                lines.append(f"[BONUS: {team_fouls_after} team fouls] ({fouling_player}: {personal_fouls_after} personal fouls)")
            else:
                lines.append(f"[Team fouls: {team_fouls_after}] ({fouling_player}: {personal_fouls_after} personal fouls)")

            if ft_count > 0:
                lines.append(f"{fouled_player} to the line for {ft_count} free throws.")

            if fouled_out:
                lines.append(f"{fouling_player} FOULS OUT!")

        elif event_type == 'free_throws':
            # M3: Free throw result
            shooter = event['shooter']
            made = event['made']
            attempts = event['attempts']
            results = event['results']

            # Individual free throw results
            for i, ft_made in enumerate(results, 1):
                if ft_made:
                    lines.append(f"  FT {i}/{attempts}: GOOD")
                else:
                    lines.append(f"  FT {i}/{attempts}: MISS")

            lines.append(f"{shooter} makes {made}/{attempts} from the line.")

    return " ".join(lines)


# =============================================================================
# MAIN POSSESSION SIMULATION
# =============================================================================

def simulate_possession(
    offensive_team: List[Dict[str, Any]],
    defensive_team: List[Dict[str, Any]],
    tactical_settings_offense: TacticalSettings,
    tactical_settings_defense: TacticalSettings,
    possession_context: PossessionContext,
    seed: Optional[int] = None,
    foul_system: Optional[Any] = None,  # FoulSystem instance (M3)
    quarter: int = 1,
    game_time: str = "12:00",
    defending_team_name: str = "Away",
    offensive_team_name: str = "Home",  # M4.5 PHASE 2: Track offensive team
    original_offensive_team: Optional[List[Dict[str, Any]]] = None,  # M4.5 PHASE 4: For FT shooting
    original_defensive_team: Optional[List[Dict[str, Any]]] = None   # M4.5 PHASE 4: For FT shooting
) -> PossessionResult:
    """
    Simulate one complete possession.

    Main orchestrator that ties all systems together.

    Args:
        offensive_team: List of 5 offensive players (stamina-degraded)
        defensive_team: List of 5 defensive players (stamina-degraded)
        tactical_settings_offense: Offensive tactical settings
        tactical_settings_defense: Defensive tactical settings
        possession_context: Possession context (transition, shot clock, etc.)
        seed: Random seed for reproducibility (debug mode)

    Returns:
        PossessionResult with complete outcome and debug info

    Flow:
    1. Set seed if provided
    2. Build usage distribution
    3. Select ball handler (for turnover check)
    4. Check turnover → If yes, end possession
    5. Select shooter (may be same as ball handler)
    6. Assign primary defender
    7. Select shot type
    8. Calculate contest distance
    9. Attempt shot
    10. If miss: Rebound flow
    11. If made: Check assist
    12. Generate play-by-play
    13. Return PossessionResult
    """
    if seed is not None:
        random.seed(seed)

    # M4.5 PHASE 2: Normalize offensive_team_name to 'home' or 'away'
    offensive_team_normalized = offensive_team_name.lower() if offensive_team_name else 'home'

    # M4.5 PHASE 4 FIX: Helper to get original (non-degraded) player for FT shooting
    # FTs should use base attributes (not stamina-degraded) since they occur during stoppages
    def get_original_player(degraded_player, is_offensive=True):
        """Get original player without stamina degradation for FT shooting."""
        if is_offensive and original_offensive_team:
            for p in original_offensive_team:
                if p['name'] == degraded_player['name']:
                    # DEBUG: Compare attributes (DISABLED)
                    # orig_form = p.get('form_technique', 50)
                    # deg_form = degraded_player.get('form_technique', 50)
                    # print(f"DEBUG FT: {p['name']} - Original form={orig_form:.1f}, Degraded form={deg_form:.1f}, Stamina={degraded_player.get('current_stamina', 'N/A')}")
                    return p
        elif not is_offensive and original_defensive_team:
            for p in original_defensive_team:
                if p['name'] == degraded_player['name']:
                    return p
        # Fallback: use degraded player if original not available
        # print(f"DEBUG FT: WARNING - No original for {degraded_player['name']}! Using DEGRADED attributes!")
        return degraded_player

    # Initialize tracking
    events = []
    debug = {
        'seed': seed,
        'possession_context': {
            'is_transition': possession_context.is_transition,
            'shot_clock': possession_context.shot_clock,
        }
    }

    # Build usage distribution
    usage_distribution = build_usage_distribution(offensive_team, tactical_settings_offense)
    debug['usage_distribution'] = usage_distribution

    # Step 1: Select ball handler (M5.0: Uses ball handling + usage)
    ball_handler = select_ball_handler(offensive_team, usage_distribution)
    debug['ball_handler'] = ball_handler['name']

    # M3 END-GAME LOGIC: Detect end-game mode and check intentional fouling
    endgame_mods = end_game_modes.detect_end_game_mode(
        game_time_remaining=possession_context.game_time_remaining,
        score_differential=possession_context.score_differential,
        quarter=possession_context.quarter,
        team_has_possession=True,  # This team has possession
        offensive_roster=offensive_team,
        defensive_roster=defensive_team
    )
    debug['endgame_modes'] = endgame_mods.active_modes

    # M3 END-GAME: Check if defense should intentionally foul (before possession proceeds)
    # Defense fouls if offense is ahead by 2-6 with <60 seconds
    if end_game_modes.should_intentional_foul(
        game_time_remaining=possession_context.game_time_remaining,
        score_differential=possession_context.score_differential,
        quarter=possession_context.quarter,
        offensive_team_leading=(possession_context.score_differential > 0)
    ):
        # Create events list for proper play-by-play generation
        events = []

        # 1-3 seconds pass before foul
        seconds_before_foul = random.uniform(1.0, 3.0)

        # Select foul target (50% best FT shooter, 50% others)
        foul_target = end_game_modes.select_intentional_foul_target(offensive_team)

        # Select fouler (player with fewest fouls)
        fouler = end_game_modes.select_fouler(defensive_team, foul_system)

        # Trigger intentional foul
        foul_event = foul_system.trigger_intentional_foul(
            fouling_player=fouler,
            fouled_player=foul_target,
            fouling_team=defending_team_name,
            quarter=quarter,
            game_time=game_time
        )

        # Add intentional foul event (use custom description)
        events.append({
            'type': 'intentional_foul',
            'fouling_player': foul_event.fouling_player,
            'fouled_player': foul_event.fouled_player,
            'foul_type': 'intentional',
            'free_throws': foul_event.free_throws_awarded,
            'and_one': False,
            'fouled_out': foul_event.fouled_out,
            'team_fouls_after': foul_event.team_fouls_after,
            'personal_fouls_after': foul_event.personal_fouls_after,
            'bonus_triggered': foul_event.bonus_triggered
        })

        # Execute free throws if in bonus
        if foul_event.free_throws_awarded > 0:
            # Get original player for FT (not stamina-degraded)
            ft_shooter_original = get_original_player(
                next(p for p in offensive_team if p['name'] == foul_target),
                is_offensive=True
            )

            ft_result = simulate_free_throw_sequence(
                shooter=ft_shooter_original,
                free_throws=foul_event.free_throws_awarded,
                and_one=False,
                quarter=quarter,
                time_remaining=possession_context.game_time_remaining,
                score_differential=possession_context.score_differential
            )

            # Add FT results event
            events.append({
                'type': 'free_throws',
                'shooter': ft_result.shooter,
                'made': ft_result.made,
                'attempts': ft_result.attempts,
                'results': ft_result.results
            })

            debug['free_throws_made'] = ft_result.made
            debug['free_throws_attempted'] = foul_event.free_throws_awarded

            # Calculate actual time elapsed during intentional foul
            # M3 END-GAME FIX: Track exact time so fouling team gets remaining time
            # NOTE: Free throws DO NOT consume game clock time (clock is stopped)
            # Only the time before the foul (1-3 seconds) consumes clock
            elapsed_time = seconds_before_foul

            # Handle missed final FT rebound
            rebound_result = handle_missed_final_ft_rebound(
                free_throw_result=ft_result,
                offensive_team=offensive_team,
                defensive_team=defensive_team,
                tactical_settings_offense=tactical_settings_offense,
                tactical_settings_defense=tactical_settings_defense,
                foul_system=foul_system,
                quarter=quarter,
                game_time=game_time,
                defending_team_name=defending_team_name,
                events=events,
                debug=debug,
                offensive_team_normalized=offensive_team_normalized
            )

            if rebound_result:
                # Last FT was missed, return rebound result with FT points added
                rebound_result.points_scored += ft_result.made
                rebound_result.elapsed_time_seconds = elapsed_time  # Track actual time
                return rebound_result

            # All FTs made - possession switches to defense
            play_by_play = generate_play_by_play(events, 'intentional_foul')

            return PossessionResult(
                play_by_play_text=play_by_play,
                possession_outcome='made_shot',  # Possession switches
                scoring_player=foul_target if ft_result.made > 0 else None,
                points_scored=ft_result.made,
                foul_event=foul_event,
                free_throw_result=ft_result,
                offensive_team=offensive_team_normalized,
                elapsed_time_seconds=elapsed_time,  # M3 FIX: Track actual time
                debug=debug
            )
        else:
            # No bonus: side out - offense keeps ball and inbounds it
            # M3 END-GAME FIX: No FTs, so elapsed time is just the foul itself
            # BUG FIX: Use 'foul' outcome to prevent possession switch
            # In basketball, non-bonus fouls result in side-out where offense keeps possession
            elapsed_time = seconds_before_foul

            play_by_play = generate_play_by_play(events, 'foul')

            return PossessionResult(
                play_by_play_text=play_by_play,
                possession_outcome='foul',  # Offense keeps ball (side-out, no possession switch)
                points_scored=0,
                foul_event=foul_event,
                offensive_team=offensive_team_normalized,
                elapsed_time_seconds=elapsed_time,  # M3 FIX: Track actual time
                debug=debug
            )

    # Step 2: Assign defender for ball handler
    zone_pct = 100 - tactical_settings_defense.man_defense_pct
    # USER FIX: Probabilistic defense type selection based on zone percentage
    # If zone_pct = 50, then 50% chance of zone defense (not deterministic threshold)
    defense_type = 'zone' if random.random() < (zone_pct / 100.0) else 'man'
    debug['defense_type'] = defense_type  # M5.0: Track for debugging

    ball_handler_defender = defense.get_primary_defender(
        shooter=ball_handler,
        defensive_team=defensive_team,
        defensive_assignments={},  # Empty for M1
        defense_type=defense_type
    )

    # Step 2.5: M3 ISSUE #7 FIX - Check for holding/hand-checking foul during ball-handling
    # These occur before turnover checks (defender being too physical)
    if foul_system and not possession_context.is_transition:
        # Hand-checking/holding more common in half-court sets
        holding_foul = foul_system.check_non_shooting_foul(
            offensive_player=ball_handler,
            defensive_player=ball_handler_defender,
            action_type='off_ball',  # Use off_ball rate (2%)
            defending_team=defending_team_name,
            quarter=quarter,
            game_time=game_time
        )

        if holding_foul:
            # Holding foul occurred during ball-handling
            free_throw_result = None
            if holding_foul.free_throws_awarded > 0:
                from . import free_throws
                # M4.5 PHASE 4 FIX: Use original (non-degraded) player for FT shooting
                ft_shooter = get_original_player(ball_handler, is_offensive=True)
                free_throw_result = free_throws.simulate_free_throw_sequence(
                    shooter=ft_shooter,
                    free_throws=holding_foul.free_throws_awarded,
                    and_one=False,
                    quarter=quarter,
                    time_remaining=possession_context.game_time_remaining,
                    score_differential=possession_context.score_differential
                )

            # Add foul event
            events.append({
                'type': 'foul',
                'fouling_player': holding_foul.fouling_player,
                'fouled_player': holding_foul.fouled_player,
                'foul_type': holding_foul.foul_type,
                'free_throws': holding_foul.free_throws_awarded,
                'and_one': False,
                'fouled_out': holding_foul.fouled_out,
                'bonus_triggered': holding_foul.bonus_triggered,
                'team_fouls_after': holding_foul.team_fouls_after,
                'personal_fouls_after': holding_foul.personal_fouls_after,
                'foul_context': 'holding'
            })

            # Add free throw result if FTs were awarded
            if free_throw_result:
                events.append({
                    'type': 'free_throws',
                    'shooter': free_throw_result.shooter,
                    'made': free_throw_result.made,
                    'attempts': free_throw_result.attempts,
                    'results': free_throw_result.results
                })

                debug['holding_foul'] = holding_foul
                debug['free_throws'] = free_throw_result
                debug['free_throws_made'] = free_throw_result.made  # M4 FIX: Track FT makes for box score

                # Check for missed final FT rebound
                rebound_result = handle_missed_final_ft_rebound(
                    free_throw_result=free_throw_result,
                    offensive_team=offensive_team,
                    defensive_team=defensive_team,
                    tactical_settings_offense=tactical_settings_offense,
                    tactical_settings_defense=tactical_settings_defense,
                    foul_system=foul_system,
                    quarter=quarter,
                    game_time=game_time,
                    defending_team_name=defending_team_name,
                    events=events,
                    debug=debug,
                    offensive_team_normalized=offensive_team_normalized  # M4.5 PHASE 2
                )

                if rebound_result:
                    # Final FT was missed, rebound occurred
                    rebound_result.foul_event = holding_foul
                    rebound_result.free_throw_result = free_throw_result
                    return rebound_result

                # Final FT made - possession ends normally
                play_by_play = generate_play_by_play(events, 'foul')

                # BUG FIX: If FTs were made, possession should switch (treat like made basket)
                outcome = 'made_shot' if free_throw_result.points_scored > 0 else 'foul'

                return PossessionResult(
                    play_by_play_text=play_by_play,
                    possession_outcome=outcome,  # 'made_shot' if FTs made, 'foul' if all missed
                    scoring_player=ball_handler['name'] if free_throw_result.points_scored > 0 else None,
                    points_scored=free_throw_result.points_scored,
                    foul_event=holding_foul,
                    free_throw_result=free_throw_result,
                    debug=debug, offensive_team=offensive_team_normalized
                )
            else:
                # No free throws (not in bonus) - side out
                debug['holding_foul'] = holding_foul
                play_by_play = generate_play_by_play(events, 'foul')

                return PossessionResult(
                    play_by_play_text=play_by_play,
                    possession_outcome='foul',
                    points_scored=0,
                    foul_event=holding_foul,
                    debug=debug, offensive_team=offensive_team_normalized
                )

    # Step 3: Check turnover (M5.0: Pass defense_type)
    turnover_occurred, turnover_debug = turnovers.check_turnover(
        ball_handler=ball_handler,
        defender=ball_handler_defender,
        tactical_settings=tactical_settings_offense,
        possession_context=possession_context,
        defense_type=defense_type  # M5.0: Actual defense type for this possession
    )

    debug['turnover_check'] = turnover_debug

    if turnover_occurred:
        # Possession ends in turnover
        # M3 FIX: Include defender for better turnover descriptions
        turnover_type = turnover_debug['turnover_type']

        # BUG FIX: Track offensive fouls in foul system
        offensive_foul_event = None
        if turnover_type == 'offensive_foul' and foul_system:
            # Record the offensive foul with team/personal foul tracking
            offensive_foul_event = foul_system.record_offensive_foul(
                fouling_player=ball_handler['name'],
                defender_name=ball_handler_defender['name'],
                fouling_team=offensive_team_name,
                quarter=quarter,
                game_time=game_time
            )

        events.append({
            'type': 'turnover',
            'ball_handler': ball_handler['name'],
            'turnover_type': turnover_type,
            'steal_credited_to': turnover_debug.get('steal_credited_to'),
            'defender': ball_handler_defender['name'],  # Include defender for context
            'offensive_foul_event': offensive_foul_event  # Include foul tracking if applicable
        })

        # USER FIX: Add steal_player to debug for box score tracking
        if turnover_debug.get('steal_credited_to'):
            debug['steal_player'] = turnover_debug['steal_credited_to']

        # USER FIX: Add turnover_type to debug for possession state tracking
        debug['turnover_type'] = turnover_type

        # Add offensive foul to debug if applicable
        if offensive_foul_event:
            debug['offensive_foul'] = offensive_foul_event

        play_by_play = generate_play_by_play(events, 'turnover')

        return PossessionResult(
            play_by_play_text=play_by_play,
            possession_outcome='turnover',
            points_scored=0,
            foul_event=offensive_foul_event,  # Include in result for tracking
            debug=debug, offensive_team=offensive_team_normalized
        )

    # Step 4: Select shooter (may be different from ball handler)
    shooter = select_shooter(offensive_team, usage_distribution)
    debug['shooter'] = shooter['name']

    # Step 5: Assign primary defender to shooter
    primary_defender = defense.get_primary_defender(
        shooter=shooter,
        defensive_team=defensive_team,
        defensive_assignments={},
        defense_type=defense_type
    )
    debug['primary_defender'] = primary_defender['name']

    # Step 6: Select shot type
    # M3 END-GAME: Apply forced shot type if specified (e.g., force 3PT when down 3)
    if endgame_mods.force_shot_type:
        shot_type = endgame_mods.force_shot_type
        debug['shot_type'] = shot_type
        debug['endgame_forced_shot'] = True
    else:
        shot_type = shooting.select_shot_type(
            shooter=shooter,
            tactical_settings=tactical_settings_offense,
            possession_context=possession_context,
            defense_type=defense_type,
            endgame_3pt_adjustment=endgame_mods.shot_distribution_3pt_adj  # M3: Pass 3PT adjustment
        )
        debug['shot_type'] = shot_type

    # Step 6.5: Re-assign defender in zone defense based on shot location
    # Zone defense assigns by LOCATION (3pt/rim/midrange), not shooter position
    if defense_type == 'zone':
        primary_defender = defense.get_primary_defender(
            shooter=shooter,
            defensive_team=defensive_team,
            defensive_assignments={},
            defense_type=defense_type,
            shot_type=shot_type  # Now we know the shot location!
        )
        debug['zone_defender_reassigned'] = primary_defender['name']

    # Step 7: Calculate contest distance
    # ATTRIBUTE EXPANSION: Pass shooter for deception/shot separation bonus
    # M4.6: Pass shot_type for zone defense differential (rim vs perimeter)
    is_help_defense = False
    contest_distance = defense.calculate_contest_distance(
        defender=primary_defender,
        is_help_defense=is_help_defense,
        zone_pct=zone_pct,
        shooter=shooter,
        shot_type=shot_type
    )
    debug['contest_distance'] = contest_distance

    # Step 8: Check for drive logic (if rim attempt)
    drive_outcome = None
    if shot_type == 'rim':
        is_drive = should_attempt_drive(shooter, possession_context)
        debug['is_drive'] = is_drive

        if is_drive:
            # M3 ISSUE #7 FIX: Check for reach-in foul BEFORE drive outcome
            # Reach-in fouls occur during drives before shot attempt
            if foul_system:
                reach_in_foul = foul_system.check_non_shooting_foul(
                    offensive_player=shooter,
                    defensive_player=primary_defender,
                    action_type='drive',
                    defending_team=defending_team_name,
                    quarter=quarter,
                    game_time=game_time
                )

                if reach_in_foul:
                    # Reach-in foul occurred during drive
                    # Award free throws if in bonus, otherwise side out
                    free_throw_result = None
                    if reach_in_foul.free_throws_awarded > 0:
                        from . import free_throws
                        # M4.5 PHASE 4 FIX: Use original (non-degraded) player for FT shooting
                        ft_shooter = get_original_player(shooter, is_offensive=True)
                        free_throw_result = free_throws.simulate_free_throw_sequence(
                            shooter=ft_shooter,
                            free_throws=reach_in_foul.free_throws_awarded,
                            and_one=False,
                            quarter=quarter,
                            time_remaining=possession_context.game_time_remaining,
                            score_differential=possession_context.score_differential
                        )

                    # Add foul event
                    events.append({
                        'type': 'foul',
                        'fouling_player': reach_in_foul.fouling_player,
                        'fouled_player': reach_in_foul.fouled_player,
                        'foul_type': reach_in_foul.foul_type,
                        'free_throws': reach_in_foul.free_throws_awarded,
                        'and_one': False,
                        'fouled_out': reach_in_foul.fouled_out,
                        'bonus_triggered': reach_in_foul.bonus_triggered,
                        'team_fouls_after': reach_in_foul.team_fouls_after,
                        'personal_fouls_after': reach_in_foul.personal_fouls_after,
                        'foul_context': 'reach_in_during_drive'
                    })

                    # Add free throw result if FTs were awarded
                    if free_throw_result:
                        events.append({
                            'type': 'free_throws',
                            'shooter': free_throw_result.shooter,
                            'made': free_throw_result.made,
                            'attempts': free_throw_result.attempts,
                            'results': free_throw_result.results
                        })

                        debug['reach_in_foul'] = reach_in_foul
                        debug['free_throws'] = free_throw_result
                        debug['free_throws_made'] = free_throw_result.made  # M4 FIX: Track FT makes for box score

                        # Check for missed final FT rebound
                        rebound_result = handle_missed_final_ft_rebound(
                            free_throw_result=free_throw_result,
                            offensive_team=offensive_team,
                            defensive_team=defensive_team,
                            tactical_settings_offense=tactical_settings_offense,
                            tactical_settings_defense=tactical_settings_defense,
                            foul_system=foul_system,
                            quarter=quarter,
                            game_time=game_time,
                            defending_team_name=defending_team_name,
                            events=events,
                            debug=debug,
                            offensive_team_normalized=offensive_team_normalized  # M4.5 PHASE 2
                        )

                        if rebound_result:
                            # Final FT was missed, rebound occurred
                            rebound_result.foul_event = reach_in_foul
                            rebound_result.free_throw_result = free_throw_result
                            return rebound_result

                        # Final FT made - possession ends normally
                        play_by_play = generate_play_by_play(events, 'foul')

                        # BUG FIX: If FTs were made, possession should switch (treat like made basket)
                        outcome = 'made_shot' if free_throw_result.points_scored > 0 else 'foul'

                        return PossessionResult(
                            play_by_play_text=play_by_play,
                            possession_outcome=outcome,  # 'made_shot' if FTs made, 'foul' if all missed
                            scoring_player=shooter['name'] if free_throw_result.points_scored > 0 else None,
                            points_scored=free_throw_result.points_scored,
                            foul_event=reach_in_foul,
                            free_throw_result=free_throw_result,
                            debug=debug, offensive_team=offensive_team_normalized
                        )
                    else:
                        # No free throws (not in bonus) - side out
                        debug['reach_in_foul'] = reach_in_foul
                        play_by_play = generate_play_by_play(events, 'foul')

                        return PossessionResult(
                            play_by_play_text=play_by_play,
                            possession_outcome='foul',
                            points_scored=0,
                            foul_event=reach_in_foul,
                            debug=debug, offensive_team=offensive_team_normalized
                        )

            # Simulate drive four-way outcome
            help_defenders = [p for p in defensive_team if p['name'] != primary_defender['name']][:2]
            drive_outcome, drive_final_defender, drive_debug = simulate_drive_outcome(
                driver=shooter,
                defender=primary_defender,
                help_defenders=help_defenders
            )
            debug['drive_outcome'] = drive_debug

            # If help defender took over, update primary_defender for shot contest
            if drive_final_defender and drive_debug.get('help_takeover'):
                # Update the events to track defender handoff
                debug['drive_defender_handoff'] = {
                    'original': primary_defender['name'],
                    'final': drive_final_defender['name']
                }
                # Use the final defender for contest calculation
                primary_defender = drive_final_defender

            if drive_outcome == 'turnover':
                # Drive resulted in turnover - determine specific type and steal credit
                # USER FIX: Add turnover details for proper play-by-play descriptions

                # Select turnover type (bad_pass, lost_ball, offensive_foul, violation)
                turnover_type = turnovers.select_turnover_type(possession_context, tactical_settings_offense)

                # BUG FIX: Track offensive fouls from drives in foul system
                offensive_foul_event = None
                if turnover_type == 'offensive_foul' and foul_system:
                    offensive_foul_event = foul_system.record_offensive_foul(
                        fouling_player=shooter['name'],
                        defender_name=primary_defender['name'],
                        fouling_team=offensive_team_name,
                        quarter=quarter,
                        game_time=game_time
                    )
                    debug['offensive_foul'] = offensive_foul_event

                # Determine if defender gets steal credit
                steal_credited_to = None
                if turnover_type in ['bad_pass', 'lost_ball']:
                    gets_steal = turnovers.determine_steal_credit(primary_defender, turnover_type)
                    if gets_steal:
                        steal_credited_to = primary_defender['name']
                        debug['steal_player'] = steal_credited_to

                # Add turnover type to debug
                debug['turnover_type'] = turnover_type

                events.append({
                    'type': 'drive',
                    'driver': shooter['name'],
                    'outcome': 'turnover',
                    'turnover_type': turnover_type,
                    'steal_credited_to': steal_credited_to,
                    'defender': primary_defender['name'],  # BUG FIX: Include defender
                    'offensive_foul_event': offensive_foul_event  # BUG FIX: Include foul tracking
                })

                play_by_play = generate_play_by_play(events, 'turnover')

                return PossessionResult(
                    play_by_play_text=play_by_play,
                    possession_outcome='turnover',
                    points_scored=0,
                    debug=debug, offensive_team=offensive_team_normalized
                )

            elif drive_outcome == 'kickout':
                # Drive resulted in kickout, select new shot type
                events.append({
                    'type': 'drive',
                    'driver': shooter['name'],
                    'outcome': 'kickout'
                })

                # Save the driver/passer before reassigning shooter
                passer = shooter

                # Re-select shooter from others
                shooter = select_shooter(offensive_team, usage_distribution)
                debug['kickout_shooter'] = shooter['name']
                debug['kickout_passer'] = passer['name']

                # BUG FIX v16: Update debug['shooter'] to kickout shooter for proper FGM attribution
                debug['shooter'] = shooter['name']

                # Select non-rim shot type (3pt or midrange) FIRST
                shot_type = '3pt' if random.random() < 0.6 else 'midrange'

                # BUG FIX v16: Update debug['shot_type'] for kickout shot
                debug['shot_type'] = shot_type

                # Re-assign defender based on shot type (important for zone defense)
                primary_defender = defense.get_primary_defender(
                    shooter=shooter,
                    defensive_team=defensive_team,
                    defensive_assignments={},
                    defense_type=defense_type,
                    shot_type=shot_type if defense_type == 'zone' else None
                )

                # ATTRIBUTE EXPANSION: Pass the passer so creativity can find wider open shots
                # M4.6: Pass shot_type for zone defense differential (rim vs perimeter)
                contest_distance = defense.calculate_contest_distance(
                    defender=primary_defender,
                    is_help_defense=False,
                    zone_pct=zone_pct,
                    passer=passer,
                    shot_type=shot_type
                )
                debug['kickout_shot_type'] = shot_type
                debug['kickout_contest_distance'] = contest_distance
                debug['kickout_defender'] = primary_defender['name']

    # Track specific shot detail for play-by-play (dunk/layup vs rim)
    shot_detail = None
    if shot_type == 'rim':
        if drive_outcome in ['dunk', 'layup']:
            shot_detail = drive_outcome  # Drive resulted in dunk or layup
        else:
            shot_detail = 'layup'  # Post-up or other rim attempt

    # Step 9: Attempt shot
    shot_made, shot_debug = shooting.attempt_shot(
        shooter=shooter,
        defender=primary_defender,
        shot_type=shot_type,
        contest_distance=contest_distance,
        possession_context=possession_context,
        defense_type=defense_type
    )
    debug['shot_attempt'] = shot_debug

    # Check if shot was blocked
    if shot_debug.get('outcome') == 'blocked_shot':
        # Shot was blocked!
        blocking_player = shot_debug.get('blocking_player')
        block_outcome = shot_debug.get('block_outcome', 'stays_in_play')  # NEW: get outcome type

        # Record block event in play-by-play
        events.append({
            'type': 'blocked_shot',
            'shooter': shooter['name'],
            'blocking_player': blocking_player,
            'shot_type': shot_type,
            'shot_detail': shot_debug.get('shot_detail'),
            'block_outcome': block_outcome  # NEW: track outcome type
        })

        # BUG FIX: Handle three distinct block outcomes
        # IMPORTANT: Blocked shots are MISSED SHOTS, never turnovers
        if block_outcome == 'out_off_shooter':
            # Ball went out off shooter - defense gets possession (MISSED SHOT, not turnover)
            play_by_play = generate_play_by_play(events, 'missed_shot')

            return PossessionResult(
                play_by_play_text=play_by_play,
                possession_outcome='missed_shot',  # NOT turnover
                points_scored=0,
                debug=debug,
                offensive_team=offensive_team_normalized
            )

        elif block_outcome == 'out_off_blocker':
            # Ball went out off blocker - offense retains possession
            play_by_play = generate_play_by_play(events, 'blocked_shot_out_retain')

            return PossessionResult(
                play_by_play_text=play_by_play,
                possession_outcome='offensive_rebound',  # Technically not a rebound, but keeps possession
                points_scored=0,
                debug=debug,
                offensive_team=offensive_team_normalized
            )

        else:  # block_outcome == 'stays_in_play'
            # Ball is live - simulate scramble/rebound situation
            # IMPORTANT: This is a SCRAMBLE, not normal rebounding
            # Both teams have equal chance to secure (no defensive advantage)
            rebound_result = rebounding.simulate_rebound(
                offensive_team=offensive_team,
                defensive_team=defensive_team,
                offensive_strategy=tactical_settings_offense.rebounding_strategy,
                defensive_strategy=tactical_settings_defense.rebounding_strategy,
                shot_type=shot_type,
                shot_made=False,
                foul_system=foul_system,
                quarter=quarter,
                game_time=game_time,
                defending_team_name=defending_team_name,
                is_blocked_shot=True  # NEW: signals scramble situation
            )
            debug['block_rebound'] = rebound_result

            # Record rebound event
            events.append({
                'type': 'rebound',
                'rebounder': rebound_result['rebounder_name'],
                'is_offensive': rebound_result['offensive_rebound'],
                'scramble_situation': True  # NEW: mark as scramble
            })

            if rebound_result['offensive_rebound']:
                # Offense recovered the scramble - possession continues
                play_by_play = generate_play_by_play(events, 'blocked_shot_recovered')

                return PossessionResult(
                    play_by_play_text=play_by_play,
                    possession_outcome='offensive_rebound',
                    rebound_player=rebound_result['rebounder_name'],
                    points_scored=0,
                    debug=debug,
                    offensive_team=offensive_team_normalized
                )
            else:
                # Defense secured the scramble - possession ends
                play_by_play = generate_play_by_play(events, 'missed_shot')

                return PossessionResult(
                    play_by_play_text=play_by_play,
                    possession_outcome='missed_shot',
                    rebound_player=rebound_result['rebounder_name'],
                    points_scored=0,
                    debug=debug,
                    offensive_team=offensive_team_normalized
                )

    # M3: Check for shooting foul
    foul_event = None
    free_throw_result = None
    if foul_system:
        foul_event = foul_system.check_shooting_foul(
            shooter=shooter,
            defender=primary_defender,
            contest_distance=contest_distance,
            shot_type=shot_type,
            shot_made=shot_made,
            defending_team=defending_team_name,
            quarter=quarter,
            game_time=game_time
        )

        if foul_event:
            # Foul occurred - execute free throws
            from . import free_throws

            # M4.5 PHASE 4 FIX: Use original (non-degraded) player for FT shooting
            ft_shooter = get_original_player(shooter, is_offensive=True)
            free_throw_result = free_throws.simulate_free_throw_sequence(
                shooter=ft_shooter,
                free_throws=foul_event.free_throws_awarded,
                and_one=foul_event.and_one,
                quarter=quarter,
                time_remaining=possession_context.game_time_remaining,
                score_differential=possession_context.score_differential
            )

            # Add foul event to events list
            # M3 FIX: Include shot type and detail for And-1 narrative
            # M3 ISSUE #8 FIX: Include bonus status and team fouls for display
            events.append({
                'type': 'foul',
                'fouling_player': foul_event.fouling_player,
                'fouled_player': foul_event.fouled_player,
                'foul_type': foul_event.foul_type,
                'free_throws': foul_event.free_throws_awarded,
                'and_one': foul_event.and_one,
                'fouled_out': foul_event.fouled_out,
                'shot_type': shot_type,  # Include shot type for context
                'shot_detail': shot_detail,  # Include shot detail (dunk/layup)
                'shot_made': shot_made,  # Include whether shot was made
                'bonus_triggered': foul_event.bonus_triggered,  # Bonus status
                'team_fouls_after': foul_event.team_fouls_after,  # Team foul count
                'personal_fouls_after': foul_event.personal_fouls_after  # Personal foul count
            })

            # Add free throw event
            events.append({
                'type': 'free_throws',
                'shooter': free_throw_result.shooter,
                'made': free_throw_result.made,
                'attempts': free_throw_result.attempts,
                'results': free_throw_result.results
            })

            debug['foul'] = foul_event
            debug['free_throws'] = free_throw_result
            # USER FIX: Add free_throws_made to debug for box score tracking
            debug['free_throws_made'] = free_throw_result.made

            # Calculate total points (shot points if made + free throw points)
            total_points = free_throw_result.points_scored
            shot_points = 0
            if shot_made:
                if shot_type == '3pt':
                    shot_points = 3
                else:
                    shot_points = 2
                total_points += shot_points

            # Check for missed final FT rebound
            rebound_result = handle_missed_final_ft_rebound(
                free_throw_result=free_throw_result,
                offensive_team=offensive_team,
                defensive_team=defensive_team,
                tactical_settings_offense=tactical_settings_offense,
                tactical_settings_defense=tactical_settings_defense,
                foul_system=foul_system,
                quarter=quarter,
                game_time=game_time,
                defending_team_name=defending_team_name,
                events=events,
                debug=debug,
                offensive_team_normalized=offensive_team_normalized  # M4.5 PHASE 2
            )

            if rebound_result:
                # Final FT was missed, rebound occurred
                # Adjust points to include shot points (and-1 scenario)
                rebound_result.points_scored += shot_points
                rebound_result.foul_event = foul_event
                rebound_result.free_throw_result = free_throw_result

                # BUG FIX v12: For And-1 with putback, need to track BOTH shooters correctly
                # - scoring_player should remain the putback shooter (for putback points attribution)
                # - debug['and1_shooter'] stores original And-1 shooter (for And-1 FGM tracking)
                # - debug['putback_shooter'] stores putback shooter (for putback FGM tracking)

                if rebound_result.possession_outcome == 'made_shot':
                    # Putback was made - mark as And-1 with putback
                    rebound_result.debug['and1_with_putback'] = True
                    rebound_result.debug['and1_shooter'] = shooter['name']  # Original And-1 shooter
                    rebound_result.debug['putback_shooter'] = rebound_result.scoring_player  # Putback shooter
                    rebound_result.debug['shot_type'] = shot_type  # BUG FIX v14: Store shot type for proper point calculation
                    # scoring_player is already set correctly in handle_missed_final_ft_rebound line 779
                elif rebound_result.possession_outcome in ['missed_shot', 'offensive_rebound']:
                    # Putback missed or no putback - only original And-1 FGM counts
                    # Set scoring_player to And-1 shooter for points attribution
                    rebound_result.scoring_player = shooter['name']
                    rebound_result.debug['and1_shooter'] = shooter['name']  # BUG FIX v14: Store shooter for FGM attribution
                    rebound_result.debug['shot_type'] = shot_type
                else:
                    # Defensive rebound or other outcome - set scoring_player for And-1 points
                    rebound_result.scoring_player = shooter['name']
                    rebound_result.debug['and1_shooter'] = shooter['name']  # BUG FIX v14: Store shooter for FGM attribution
                    rebound_result.debug['shot_type'] = shot_type

                return rebound_result

            # Final FT made (or all FTs made) - possession ends normally
            play_by_play = generate_play_by_play(events, 'foul')

            # BUG FIX v9: Outcome should reflect whether a FIELD GOAL was made, not just if points were scored
            # For And-1s: shot_made=True, shot_points>0 → outcome='made_shot' (correct, FG was made)
            # For regular shooting fouls: shot_made=False, shot_points=0 → outcome='foul' (correct, no FG)
            # This prevents shooting fouls from being counted as FGM in stats aggregation
            outcome = 'made_shot' if shot_made else 'foul'

            # BUG FIX v14: Store And-1 shooter in debug dict for proper FGM attribution
            # This ensures FGM is credited to the actual shooter, not an assister
            if shot_made:
                debug['and1_shooter'] = shooter['name']
                debug['shot_type'] = shot_type

            return PossessionResult(
                play_by_play_text=play_by_play,
                possession_outcome=outcome,  # 'made_shot' if And-1 FG made, 'foul' for regular shooting fouls
                scoring_player=shooter['name'],
                points_scored=total_points,
                foul_event=foul_event,
                free_throw_result=free_throw_result,
                debug=debug, offensive_team=offensive_team_normalized
            )

    # Record shot event
    shot_event = {
        'type': 'shot_attempt',
        'shooter': shooter['name'],
        'defender': primary_defender['name'],
        'shot_type': shot_type,
        'shot_detail': shot_detail,  # Specific detail (dunk/layup for rim shots)
        'contest_distance': contest_distance,
        'made': shot_made,
        'assist_by': None,
        'defense_type': defense_type  # Track man vs zone for play-by-play
    }

    # Add drive information if this was a drive
    if drive_outcome in ['dunk', 'layup']:
        shot_event['is_drive'] = True
        if debug.get('drive_defender_handoff'):
            shot_event['drive_original_defender'] = debug['drive_defender_handoff']['original']
            shot_event['drive_help_arrived'] = True
        else:
            shot_event['drive_original_defender'] = primary_defender['name']
            shot_event['drive_help_arrived'] = False

    events.append(shot_event)

    # Determine points scored
    if shot_made:
        if shot_type == '3pt':
            points_scored = 3
        else:
            points_scored = 2

        # Check for assist
        teammates = [p for p in offensive_team if p['name'] != shooter['name']]
        assist_occurred, assister_name, assist_debug = check_assist(
            shot_type=shot_type,
            shooter=shooter,
            teammates=teammates
        )
        debug['assist_check'] = assist_debug

        if assist_occurred:
            events[-1]['assist_by'] = assister_name

        play_by_play = generate_play_by_play(events, 'made_shot')

        return PossessionResult(
            play_by_play_text=play_by_play,
            possession_outcome='made_shot',
            scoring_player=shooter['name'],
            assist_player=assister_name if assist_occurred else None,
            points_scored=points_scored,
            debug=debug, offensive_team=offensive_team_normalized
        )

    # Step 10: Rebound flow (shot missed)
    rebound_result = rebounding.simulate_rebound(
        offensive_team=offensive_team,
        defensive_team=defensive_team,
        offensive_strategy=tactical_settings_offense.rebounding_strategy,
        defensive_strategy=tactical_settings_defense.rebounding_strategy,
        shot_type=shot_type,
        shot_made=False,
        foul_system=foul_system,
        quarter=quarter,
        game_time=game_time,
        defending_team_name=defending_team_name
    )
    debug['rebound'] = rebound_result

    # M3 ISSUE #7 FIX: Handle loose ball foul during rebound
    if rebound_result.get('foul_occurred'):
        loose_ball_foul = rebound_result['loose_ball_foul']

        # Execute free throws if awarded
        free_throw_result = None
        if loose_ball_foul.free_throws_awarded > 0:
            from . import free_throws

            # Find the fouled player (rebounder) in the offensive team
            rebounder_name = rebound_result['rebounder_name']
            fouled_player = None
            for player in offensive_team:
                if player['name'] == rebounder_name:
                    fouled_player = player
                    break

            # Fallback if not found (shouldn't happen)
            if not fouled_player:
                fouled_player = offensive_team[0]

            # M4.5 PHASE 4 FIX: Use original (non-degraded) player for FT shooting
            ft_shooter = get_original_player(fouled_player, is_offensive=True)
            free_throw_result = free_throws.simulate_free_throw_sequence(
                shooter=ft_shooter,  # Use original player without stamina degradation
                free_throws=loose_ball_foul.free_throws_awarded,
                and_one=False,
                quarter=quarter,
                time_remaining=possession_context.game_time_remaining,
                score_differential=possession_context.score_differential
            )

        # Add foul event
        events.append({
            'type': 'foul',
            'fouling_player': loose_ball_foul.fouling_player,
            'fouled_player': loose_ball_foul.fouled_player,
            'foul_type': loose_ball_foul.foul_type,
            'free_throws': loose_ball_foul.free_throws_awarded,
            'and_one': False,
            'fouled_out': loose_ball_foul.fouled_out,
            'bonus_triggered': loose_ball_foul.bonus_triggered,
            'team_fouls_after': loose_ball_foul.team_fouls_after,
            'personal_fouls_after': loose_ball_foul.personal_fouls_after,
            'foul_context': 'loose_ball_during_rebound'
        })

        # Add free throw result if FTs were awarded
        if free_throw_result:
            events.append({
                'type': 'free_throws',
                'shooter': free_throw_result.shooter,
                'made': free_throw_result.made,
                'attempts': free_throw_result.attempts,
                'results': free_throw_result.results
            })

            debug['loose_ball_foul'] = loose_ball_foul
            debug['free_throws'] = free_throw_result

            # Check for missed final FT rebound
            rebound_result = handle_missed_final_ft_rebound(
                free_throw_result=free_throw_result,
                offensive_team=offensive_team,
                defensive_team=defensive_team,
                tactical_settings_offense=tactical_settings_offense,
                tactical_settings_defense=tactical_settings_defense,
                foul_system=foul_system,
                quarter=quarter,
                game_time=game_time,
                defending_team_name=defending_team_name,
                events=events,
                debug=debug,
                offensive_team_normalized=offensive_team_normalized  # M4.5 PHASE 2
            )

            if rebound_result:
                # Final FT was missed, rebound occurred
                rebound_result.foul_event = loose_ball_foul
                rebound_result.free_throw_result = free_throw_result
                return rebound_result

            # Final FT made - possession ends normally
            play_by_play = generate_play_by_play(events, 'foul')

            # BUG FIX: If FTs were made, possession should switch (treat like made basket)
            outcome = 'made_shot' if free_throw_result.points_scored > 0 else 'foul'

            return PossessionResult(
                play_by_play_text=play_by_play,
                possession_outcome=outcome,  # 'made_shot' if FTs made, 'foul' if all missed
                scoring_player=free_throw_result.shooter if free_throw_result.points_scored > 0 else None,
                points_scored=free_throw_result.points_scored,
                foul_event=loose_ball_foul,
                free_throw_result=free_throw_result,
                debug=debug, offensive_team=offensive_team_normalized
            )
        else:
            # No free throws (not in bonus) - offensive team retains possession
            debug['loose_ball_foul'] = loose_ball_foul
            play_by_play = generate_play_by_play(events, 'foul')

            return PossessionResult(
                play_by_play_text=play_by_play,
                possession_outcome='offensive_rebound',
                rebound_player=rebound_result['rebounder_name'],
                points_scored=0,
                foul_event=loose_ball_foul,
                debug=debug, offensive_team=offensive_team_normalized
            )

    # Record rebound event
    events.append({
        'type': 'rebound',
        'rebounder': rebound_result['rebounder_name'],
        'is_offensive': rebound_result['offensive_rebound']
    })

    # Check for putback
    if rebound_result['offensive_rebound']:
        if rebound_result['putback_attempted']:
            events[-1]['putback_attempted'] = True
            events[-1]['putback_made'] = rebound_result['putback_made']

            if rebound_result['putback_made']:
                # Putback made
                play_by_play = generate_play_by_play(events, 'made_shot')

                # BUG FIX v15: Mark putback in debug to prevent original shooter from getting FGM credit
                # Original shot was missed (FGA only), putback is separate FGA+FGM for rebounder
                debug['putback_made'] = True
                debug['putback_shooter'] = rebound_result['rebounder_name']
                debug['original_shooter'] = debug.get('shooter')  # Preserve original shooter
                debug['original_shot_type'] = debug.get('shot_type')  # Preserve original shot type

                return PossessionResult(
                    play_by_play_text=play_by_play,
                    possession_outcome='made_shot',
                    scoring_player=rebound_result['rebounder_name'],
                    rebound_player=rebound_result['rebounder_name'],
                    points_scored=2,
                    debug=debug, offensive_team=offensive_team_normalized
                )
            else:
                # Putback missed - simulate another rebound (likely defensive)
                second_rebound_result = rebounding.simulate_rebound(
                    offensive_team=offensive_team,
                    defensive_team=defensive_team,
                    offensive_strategy=tactical_settings_offense.rebounding_strategy,
                    defensive_strategy=tactical_settings_defense.rebounding_strategy,
                    shot_type='rim',  # Putbacks are always at rim
                    shot_made=False,
                    foul_system=foul_system,
                    quarter=quarter,
                    game_time=game_time,
                    defending_team_name=defending_team_name
                )
                debug['second_rebound'] = second_rebound_result

                # Record second rebound event
                events.append({
                    'type': 'rebound',
                    'rebounder': second_rebound_result['rebounder_name'],
                    'is_offensive': second_rebound_result['offensive_rebound']
                })

                # If second offensive rebound, possession continues (rare but possible)
                if second_rebound_result['offensive_rebound']:
                    play_by_play = generate_play_by_play(events, 'offensive_rebound')
                    return PossessionResult(
                        play_by_play_text=play_by_play,
                        possession_outcome='offensive_rebound',
                        rebound_player=second_rebound_result['rebounder_name'],
                        points_scored=0,
                        debug=debug, offensive_team=offensive_team_normalized
                    )
                else:
                    # Defensive rebound ends possession
                    play_by_play = generate_play_by_play(events, 'missed_shot')
                    return PossessionResult(
                        play_by_play_text=play_by_play,
                        possession_outcome='missed_shot',
                        rebound_player=second_rebound_result['rebounder_name'],
                        points_scored=0,
                        debug=debug, offensive_team=offensive_team_normalized
                    )
        else:
            # Putback not attempted (kickout) - possession continues with same team
            play_by_play = generate_play_by_play(events, 'offensive_rebound')
            return PossessionResult(
                play_by_play_text=play_by_play,
                possession_outcome='offensive_rebound',
                rebound_player=rebound_result['rebounder_name'],
                points_scored=0,
                debug=debug, offensive_team=offensive_team_normalized
            )

    # Defensive rebound - possession ends
    play_by_play = generate_play_by_play(events, 'missed_shot')

    return PossessionResult(
        play_by_play_text=play_by_play,
        possession_outcome='missed_shot',
        rebound_player=rebound_result['rebounder_name'],
        points_scored=0,
        debug=debug, offensive_team=offensive_team_normalized
    )
