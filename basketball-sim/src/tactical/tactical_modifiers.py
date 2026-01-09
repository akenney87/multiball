"""
Basketball Simulator - Tactical Modifiers Integration Layer

Integrates all 5 tactical settings with game mechanics:
1. Pace (possessions, stamina, shot distribution)
2. Man vs Zone Defense (turnovers, contests, shot selection)
3. Scoring Options (usage distribution)
4. Minutes Allocation (player availability weights)
5. Rebounding Strategy (number of rebounders, OREB modifier)

This module ensures ALL tactical settings have observable, mechanical impact.
NO FAKE SLIDERS - every setting affects gameplay through specific formulas.
"""

from typing import Dict, List, Any, Optional, Tuple
import random

from ..core.probability import (
    calculate_composite,
    weighted_random_choice,
    normalize_probabilities,
)
from ..core.data_structures import TacticalSettings, PossessionContext
from ..constants import (
    # Pace modifiers
    PACE_FAST_POSSESSION_MOD,
    PACE_FAST_STAMINA_DRAIN,
    PACE_SLOW_POSSESSION_MOD,
    PACE_SLOW_STAMINA_DRAIN,
    PACE_STANDARD_POSSESSION_MOD,
    PACE_STANDARD_STAMINA_DRAIN,

    # Zone defense effects
    ZONE_DEFENSE_TURNOVER_BONUS,
    ZONE_DEFENSE_CONTEST_PENALTY,
    ZONE_DEFENSE_DRIVE_PENALTY,
    ZONE_DEFENSE_3PT_ATTEMPT_BONUS,

    # Usage distribution
    USAGE_SCORING_OPTION_1,
    USAGE_SCORING_OPTION_2,
    USAGE_SCORING_OPTION_3,
    USAGE_OTHERS,

    # Rebounding strategy
    REBOUND_STRATEGY_CRASH_GLASS_COUNT,
    REBOUND_STRATEGY_STANDARD_COUNT,
    REBOUND_STRATEGY_PREVENT_TRANSITION_COUNT,

    # Stamina costs
    STAMINA_COST_PER_POSSESSION_FAST,
    STAMINA_COST_PER_POSSESSION_STANDARD,
    STAMINA_COST_PER_POSSESSION_SLOW,

    # Shot distribution tactical mod
    SHOT_DISTRIBUTION_TACTICAL_MOD,

    # Pace turnover adjustments
    TURNOVER_PACE_FAST_BONUS,
    TURNOVER_PACE_SLOW_PENALTY,

    # Weight tables
    WEIGHTS_REBOUND,
)


# =============================================================================
# PACE SYSTEM
# =============================================================================

def apply_pace_modifiers(
    base_value: float,
    pace: str,
    modifier_type: str
) -> float:
    """
    Apply pace-based modifiers to possessions, stamina, or shot distribution.

    Pace Effects:
    - Fast: +10% possessions, +15% stamina drain, +5% rim shots
    - Standard: No modifiers (1.0x multipliers)
    - Slow: -10% possessions, -15% stamina drain, +5% midrange shots

    Args:
        base_value: Original value to modify
        pace: 'fast', 'standard', or 'slow'
        modifier_type: What to modify:
            - 'possessions': Possession count per quarter
            - 'stamina': Stamina drain multiplier
            - 'shot_distribution': Shot type distribution adjustments

    Returns:
        Modified value based on pace setting

    Examples:
        >>> apply_pace_modifiers(95, 'fast', 'possessions')
        104.5  # +10%

        >>> apply_pace_modifiers(1.3, 'fast', 'stamina')
        1.495  # 1.3 * 1.15

        >>> apply_pace_modifiers(0.40, 'fast', 'shot_distribution')
        0.35  # -5% from rim bonus (applied in shot selection logic)
    """
    if modifier_type == 'possessions':
        if pace == 'fast':
            return base_value * PACE_FAST_POSSESSION_MOD
        elif pace == 'slow':
            return base_value * PACE_SLOW_POSSESSION_MOD
        else:  # standard
            return base_value * PACE_STANDARD_POSSESSION_MOD

    elif modifier_type == 'stamina':
        if pace == 'fast':
            return base_value * PACE_FAST_STAMINA_DRAIN
        elif pace == 'slow':
            return base_value * PACE_SLOW_STAMINA_DRAIN
        else:  # standard
            return base_value * PACE_STANDARD_STAMINA_DRAIN

    elif modifier_type == 'shot_distribution':
        # Returns the adjustment value, not modified base_value
        # Applied to specific shot types in select_shot_type
        if pace == 'fast':
            return 0.05  # +5% to rim attempts
        elif pace == 'slow':
            return 0.05  # +5% to midrange attempts
        else:  # standard
            return 0.0  # No adjustment

    else:
        raise ValueError(f"Unknown modifier_type: {modifier_type}")


def get_pace_modifiers(pace: str) -> Dict[str, float]:
    """
    Return all pace-based modifiers as a dictionary.

    Convenience function for getting all pace effects at once.

    Args:
        pace: 'fast', 'standard', or 'slow'

    Returns:
        Dictionary with keys:
        - 'possession_multiplier': Multiply base possessions per quarter
        - 'stamina_drain_multiplier': Multiply stamina costs
        - 'turnover_adjustment': Additive adjustment to turnover rate
        - 'rim_shot_adjustment': Additive adjustment to rim attempt %
        - 'midrange_shot_adjustment': Additive adjustment to midrange attempt %
    """
    if pace == 'fast':
        return {
            'possession_multiplier': PACE_FAST_POSSESSION_MOD,
            'stamina_drain_multiplier': PACE_FAST_STAMINA_DRAIN,
            'turnover_adjustment': TURNOVER_PACE_FAST_BONUS,
            'rim_shot_adjustment': 0.05,
            'midrange_shot_adjustment': 0.0,
        }
    elif pace == 'slow':
        return {
            'possession_multiplier': PACE_SLOW_POSSESSION_MOD,
            'stamina_drain_multiplier': PACE_SLOW_STAMINA_DRAIN,
            'turnover_adjustment': TURNOVER_PACE_SLOW_PENALTY,
            'rim_shot_adjustment': 0.0,
            'midrange_shot_adjustment': 0.05,
        }
    else:  # standard
        return {
            'possession_multiplier': PACE_STANDARD_POSSESSION_MOD,
            'stamina_drain_multiplier': PACE_STANDARD_STAMINA_DRAIN,
            'turnover_adjustment': 0.0,
            'rim_shot_adjustment': 0.0,
            'midrange_shot_adjustment': 0.0,
        }


def get_stamina_cost_per_possession(pace: str) -> float:
    """
    Get base stamina cost per possession based on pace.

    Args:
        pace: 'fast', 'standard', or 'slow'

    Returns:
        Stamina cost per possession
    """
    if pace == 'fast':
        return STAMINA_COST_PER_POSSESSION_FAST
    elif pace == 'slow':
        return STAMINA_COST_PER_POSSESSION_SLOW
    else:  # standard
        return STAMINA_COST_PER_POSSESSION_STANDARD


# =============================================================================
# ZONE DEFENSE SYSTEM
# =============================================================================

def get_zone_defense_modifiers(man_defense_pct: int) -> Dict[str, float]:
    """
    Calculate zone defense modifiers based on man defense percentage.

    Zone percentage = 100 - man_defense_pct

    Zone Defense Effects:
    - +3% to force turnovers (more passing required)
    - -15% perimeter contest effectiveness (weaker closeouts on 3PT)
    - -10% drive defense effectiveness (gaps in coverage)
    - +5% to opponent 3PT shot attempts (open perimeter)

    All effects are proportional to zone percentage.

    Args:
        man_defense_pct: Percentage of possessions using man defense (0-100)

    Returns:
        Dictionary with zone modifiers:
        - 'turnover_bonus': Additive bonus to turnover rate
        - 'contest_penalty': Penalty to defender composite on 3PT contests
        - 'drive_penalty': Penalty to drive success rates
        - 'shot_attempt_bonus': Bonus to opponent 3PT attempt rate
        - 'zone_pct': Actual zone percentage for reference

    Examples:
        >>> get_zone_defense_modifiers(0)  # 100% zone
        {
            'turnover_bonus': 0.03,
            'contest_penalty': -0.15,
            'drive_penalty': -0.10,
            'shot_attempt_bonus': 0.05,
            'zone_pct': 1.0
        }

        >>> get_zone_defense_modifiers(50)  # 50/50 split
        {
            'turnover_bonus': 0.015,
            'contest_penalty': -0.075,
            'drive_penalty': -0.05,
            'shot_attempt_bonus': 0.025,
            'zone_pct': 0.5
        }

        >>> get_zone_defense_modifiers(100)  # 100% man
        {
            'turnover_bonus': 0.0,
            'contest_penalty': 0.0,
            'drive_penalty': 0.0,
            'shot_attempt_bonus': 0.0,
            'zone_pct': 0.0
        }
    """
    zone_pct = (100 - man_defense_pct) / 100.0

    return {
        'turnover_bonus': ZONE_DEFENSE_TURNOVER_BONUS * zone_pct,
        'contest_penalty': ZONE_DEFENSE_CONTEST_PENALTY * zone_pct,
        'drive_penalty': ZONE_DEFENSE_DRIVE_PENALTY * zone_pct,
        'shot_attempt_bonus': ZONE_DEFENSE_3PT_ATTEMPT_BONUS * zone_pct,
        'zone_pct': zone_pct,
    }


def determine_defense_type(man_defense_pct: int) -> str:
    """
    Per-possession random roll to determine defense type.

    Uses man_defense_pct to determine probability of man defense.
    This function should be called ONCE per possession.

    Args:
        man_defense_pct: Percentage chance of man defense (0-100)

    Returns:
        'man' or 'zone'

    Examples:
        With man_defense_pct=75, has 75% chance to return 'man', 25% 'zone'
    """
    roll = random.random()
    return 'man' if roll < (man_defense_pct / 100.0) else 'zone'


# =============================================================================
# SCORING OPTIONS (USAGE DISTRIBUTION)
# =============================================================================

def calculate_usage_distribution(
    team: List[Dict[str, Any]],
    scoring_options: List[Optional[str]],
    min_stamina: float = 20.0
) -> Dict[str, float]:
    """
    Calculate usage distribution based on scoring options.

    Priority Usage:
    - Scoring Option #1: 30%
    - Scoring Option #2: 20%
    - Scoring Option #3: 15%
    - Others: 35% (split equally among remaining players)

    Fallback Logic:
    If a scoring option is unavailable (stamina < min_stamina, not on team),
    their usage is redistributed to the next option or others pool.

    Args:
        team: List of player dicts (must include 'name' and 'stamina')
        scoring_options: List of [option_1, option_2, option_3] player names
        min_stamina: Minimum stamina required to be available (default: 20)

    Returns:
        Dictionary mapping player names to usage percentages (sums to 1.0)

    Examples:
        >>> team = [
        ...     {'name': 'Player A', 'stamina': 80},
        ...     {'name': 'Player B', 'stamina': 70},
        ...     {'name': 'Player C', 'stamina': 60},
        ...     {'name': 'Player D', 'stamina': 50},
        ...     {'name': 'Player E', 'stamina': 40},
        ... ]
        >>> scoring_options = ['Player A', 'Player B', 'Player C']
        >>> calculate_usage_distribution(team, scoring_options)
        {
            'Player A': 0.30,
            'Player B': 0.20,
            'Player C': 0.15,
            'Player D': 0.175,
            'Player E': 0.175
        }

        >>> # Option 1 exhausted (low stamina)
        >>> team[0]['stamina'] = 10
        >>> calculate_usage_distribution(team, scoring_options)
        {
            'Player A': 0.0875,  # Joins "others" pool
            'Player B': 0.30,    # Gets option 1's usage
            'Player C': 0.20,    # Gets option 2's usage
            'Player D': 0.2375,
            'Player E': 0.1750
        }
    """
    # Initialize usage dict
    usage = {player['name']: 0.0 for player in team}

    # Track which players are available
    available_players = {
        player['name']: player['stamina'] >= min_stamina
        for player in team
    }

    # Track remaining usage to distribute
    remaining_usage = 1.0

    # Assign scoring options in priority order
    option_usages = [USAGE_SCORING_OPTION_1, USAGE_SCORING_OPTION_2, USAGE_SCORING_OPTION_3]
    carried_over_usage = 0.0  # Track usage from unavailable options

    for i, option_name in enumerate(scoring_options):
        target_usage = option_usages[i] + carried_over_usage
        carried_over_usage = 0.0  # Reset

        if option_name and option_name in available_players:
            if available_players[option_name]:
                # Option is available - assign usage
                usage[option_name] = target_usage
                remaining_usage -= target_usage
            else:
                # Option unavailable - carry over to next option
                carried_over_usage = target_usage
        else:
            # Option not specified or not on team - carry over
            carried_over_usage = target_usage

    # Add any carried-over usage to "others" pool
    others_pool_usage = USAGE_OTHERS + carried_over_usage

    # Identify "others" pool (players not in scoring options)
    scoring_option_names = [opt for opt in scoring_options if opt is not None]
    others = [
        player['name'] for player in team
        if player['name'] not in scoring_option_names
    ]

    # Also add unavailable scoring options to others pool
    for option_name in scoring_option_names:
        if option_name in available_players and not available_players[option_name]:
            others.append(option_name)

    # Distribute others pool equally
    if others:
        per_other = others_pool_usage / len(others)
        for player_name in others:
            usage[player_name] = per_other

    # Sanity check: normalize to ensure sum = 1.0
    total_usage = sum(usage.values())
    if total_usage > 0:
        for player_name in usage:
            usage[player_name] /= total_usage

    return usage


def select_shooter(
    offensive_team: List[Dict[str, Any]],
    tactical_settings: TacticalSettings,
    min_stamina: float = 20.0
) -> Dict[str, Any]:
    """
    Select shooter using usage distribution from tactical settings.

    Uses weighted random selection based on calculated usage percentages.

    Args:
        offensive_team: List of 5 player dicts
        tactical_settings: Team tactical settings with scoring options
        min_stamina: Minimum stamina required (default: 20)

    Returns:
        Selected shooter (player dict)

    Raises:
        ValueError: If no players available (all stamina < min_stamina)
    """
    scoring_options = [
        tactical_settings.scoring_option_1,
        tactical_settings.scoring_option_2,
        tactical_settings.scoring_option_3,
    ]

    usage_dist = calculate_usage_distribution(
        offensive_team,
        scoring_options,
        min_stamina
    )

    # Filter to only available players
    available_choices = []
    available_weights = []

    for player in offensive_team:
        if player['stamina'] >= min_stamina and usage_dist[player['name']] > 0:
            available_choices.append(player)
            available_weights.append(usage_dist[player['name']])

    if not available_choices:
        # Edge case: All players exhausted
        # Fall back to selecting from all players regardless of stamina
        available_choices = offensive_team
        available_weights = [1.0 / len(offensive_team)] * len(offensive_team)

    return weighted_random_choice(available_choices, available_weights)


# =============================================================================
# MINUTES ALLOCATION
# =============================================================================

def validate_minutes_allocation(minutes_dict: Dict[str, int]) -> Tuple[bool, str]:
    """
    Validate that minutes allocation sums to 240 (48 min × 5 positions).

    Args:
        minutes_dict: Dictionary mapping player names to minutes

    Returns:
        Tuple of (is_valid: bool, error_message: str)
        If valid, error_message is empty string.

    Examples:
        >>> validate_minutes_allocation({'A': 48, 'B': 48, 'C': 48, 'D': 48, 'E': 48})
        (True, '')

        >>> validate_minutes_allocation({'A': 40, 'B': 40, 'C': 40, 'D': 40, 'E': 40})
        (False, 'Minutes allotment must sum to 240, got 200')

        >>> validate_minutes_allocation({'A': 50, 'B': 50, 'C': 50, 'D': 50, 'E': 50})
        (False, 'Minutes allotment must sum to 240, got 250')
    """
    if not minutes_dict:
        return False, "Minutes allotment is empty"

    # Check for negative minutes and exceeding 48 FIRST
    for player_name, minutes in minutes_dict.items():
        if minutes < 0:
            return False, f"Player {player_name} has negative minutes: {minutes}"
        if minutes > 48:
            return False, f"Player {player_name} exceeds 48 minutes: {minutes}"

    # Then check total
    total_minutes = sum(minutes_dict.values())
    if total_minutes != 240:
        return False, f"Minutes allotment must sum to 240, got {total_minutes}"

    return True, ""


def get_player_availability_weights(
    team: List[Dict[str, Any]],
    minutes_allotment: Dict[str, int]
) -> Dict[str, float]:
    """
    Convert minutes allocation to availability weights.

    For Milestone 1 (single possession), minutes determine probability
    of player being on court. In future milestones, this will drive
    substitution patterns.

    Args:
        team: List of player dicts
        minutes_allotment: Dict mapping player names to allocated minutes

    Returns:
        Dictionary mapping player names to availability weights (0.0 to 1.0)
        Higher weight = more likely to be on court

    Examples:
        >>> team = [
        ...     {'name': 'Starter', ...},
        ...     {'name': 'Bench', ...}
        ... ]
        >>> minutes = {'Starter': 36, 'Bench': 12}
        >>> get_player_availability_weights(team, minutes)
        {'Starter': 0.75, 'Bench': 0.25}  # 36/48 and 12/48
    """
    if not minutes_allotment:
        # No allocation specified - assume equal distribution
        return {player['name']: 1.0 / len(team) for player in team}

    weights = {}
    for player in team:
        player_name = player['name']
        if player_name in minutes_allotment:
            # Weight = minutes / 48 (max minutes per game)
            weights[player_name] = minutes_allotment[player_name] / 48.0
        else:
            # Player not in allocation - assume no minutes
            weights[player_name] = 0.0

    return weights


# =============================================================================
# REBOUNDING STRATEGY
# =============================================================================

def get_rebounding_strategy_params(strategy: str) -> Dict[str, Any]:
    """
    Get rebounding strategy parameters.

    Strategies:
    - crash_glass: 5 offensive rebounders, +8% OREB chance
    - standard: 4 offensive rebounders, baseline OREB chance
    - prevent_transition: 3 offensive rebounders, -5% OREB chance

    Args:
        strategy: 'crash_glass', 'standard', or 'prevent_transition'

    Returns:
        Dictionary with:
        - 'offensive_rebounders': Number of players boxing out on offense
        - 'defensive_rebounders': Number of players boxing out on defense
        - 'oreb_modifier': Additive modifier to OREB probability

    Examples:
        >>> get_rebounding_strategy_params('crash_glass')
        {
            'offensive_rebounders': 5,
            'defensive_rebounders': 2,
            'oreb_modifier': 0.08
        }

        >>> get_rebounding_strategy_params('standard')
        {
            'offensive_rebounders': 4,
            'defensive_rebounders': 3,
            'oreb_modifier': 0.0
        }
    """
    if strategy == 'crash_glass':
        return {
            'offensive_rebounders': REBOUND_STRATEGY_CRASH_GLASS_COUNT,
            'defensive_rebounders': 5 - REBOUND_STRATEGY_CRASH_GLASS_COUNT,
            'oreb_modifier': 0.08,  # +8% OREB chance
        }
    elif strategy == 'prevent_transition':
        return {
            'offensive_rebounders': REBOUND_STRATEGY_PREVENT_TRANSITION_COUNT,
            'defensive_rebounders': 5 - REBOUND_STRATEGY_PREVENT_TRANSITION_COUNT,
            'oreb_modifier': -0.05,  # -5% OREB chance
        }
    else:  # standard
        return {
            'offensive_rebounders': REBOUND_STRATEGY_STANDARD_COUNT,
            'defensive_rebounders': 5 - REBOUND_STRATEGY_STANDARD_COUNT,
            'oreb_modifier': 0.0,  # No modifier
        }


def get_rebounders(
    team: List[Dict[str, Any]],
    rebounding_strategy: str,
    is_offensive_team: bool
) -> List[Dict[str, Any]]:
    """
    Select which players box out for rebounds based on strategy.

    Selection Algorithm:
    1. Calculate rebounding composite for each player
    2. Sort by composite (best rebounders first)
    3. Take top N players based on strategy

    Args:
        team: List of 5 player dicts
        rebounding_strategy: 'crash_glass', 'standard', or 'prevent_transition'
        is_offensive_team: True if offensive team, False if defensive

    Returns:
        List of player dicts who will box out

    Examples:
        Crash glass (offense): Returns all 5 players
        Standard (offense): Returns top 4 rebounders
        Prevent transition (offense): Returns top 3 rebounders
    """
    params = get_rebounding_strategy_params(rebounding_strategy)

    if is_offensive_team:
        num_rebounders = params['offensive_rebounders']
    else:
        num_rebounders = params['defensive_rebounders']

    # Calculate rebounding composite for each player
    player_composites = []
    for player in team:
        composite = calculate_composite(player, WEIGHTS_REBOUND)
        player_composites.append((player, composite))

    # Sort by composite (descending)
    player_composites.sort(key=lambda x: x[1], reverse=True)

    # Take top N
    rebounders = [player for player, _ in player_composites[:num_rebounders]]

    return rebounders


# =============================================================================
# INTEGRATED TACTICAL APPLICATION
# =============================================================================

def apply_all_tactical_modifiers(
    base_probabilities: Dict[str, float],
    tactical_settings: TacticalSettings,
    possession_context: PossessionContext,
    action_type: str,
    defense_type: str = 'man'
) -> Tuple[Dict[str, float], Dict[str, Any]]:
    """
    Central function to apply ALL tactical modifiers to base probabilities.

    This ensures no tactical setting is ignored. Every setting has mechanical impact.

    Args:
        base_probabilities: Dictionary of base probability values
        tactical_settings: Team tactical settings
        possession_context: Current possession context
        action_type: What action is being modified:
            - 'shot_selection': Modifies shot type distribution
            - 'turnover': Modifies turnover rate
            - 'contest': Modifies contest effectiveness
            - 'drive': Modifies drive success
        defense_type: 'man' or 'zone' (affects zone modifiers)

    Returns:
        Tuple of (modified_probabilities, debug_info)

    Debug info includes:
        - All modifiers applied
        - Original vs final values
        - Which tactical settings affected the outcome
    """
    modified = base_probabilities.copy()
    debug = {
        'original': base_probabilities.copy(),
        'modifiers_applied': {},
        'tactical_settings': {
            'pace': tactical_settings.pace,
            'man_defense_pct': tactical_settings.man_defense_pct,
            'rebounding_strategy': tactical_settings.rebounding_strategy,
        }
    }

    # Apply pace modifiers
    pace_mods = get_pace_modifiers(tactical_settings.pace)

    if action_type == 'shot_selection':
        # Apply pace-based shot distribution adjustments
        if pace_mods['rim_shot_adjustment'] > 0:
            if 'rim' in modified:
                modified['rim'] += pace_mods['rim_shot_adjustment']
                debug['modifiers_applied']['pace_rim_bonus'] = pace_mods['rim_shot_adjustment']

        if pace_mods['midrange_shot_adjustment'] > 0:
            if 'midrange' in modified:
                modified['midrange'] += pace_mods['midrange_shot_adjustment']
                debug['modifiers_applied']['pace_midrange_bonus'] = pace_mods['midrange_shot_adjustment']

    elif action_type == 'turnover':
        # Apply pace adjustment to turnover rate
        if 'turnover_rate' in modified:
            original_rate = modified['turnover_rate']
            modified['turnover_rate'] += pace_mods['turnover_adjustment']
            debug['modifiers_applied']['pace_turnover_adjustment'] = pace_mods['turnover_adjustment']

    # Apply zone defense modifiers
    zone_mods = get_zone_defense_modifiers(tactical_settings.man_defense_pct)

    if action_type == 'turnover':
        if 'turnover_rate' in modified:
            original_rate = modified['turnover_rate']
            modified['turnover_rate'] += zone_mods['turnover_bonus']
            debug['modifiers_applied']['zone_turnover_bonus'] = zone_mods['turnover_bonus']

    elif action_type == 'contest' and defense_type == 'zone':
        # Zone reduces 3PT contest effectiveness
        if 'defender_composite' in modified:
            original_composite = modified['defender_composite']
            # Apply penalty to defender composite
            modified['defender_composite'] *= (1 + zone_mods['contest_penalty'])
            debug['modifiers_applied']['zone_contest_penalty'] = zone_mods['contest_penalty']

    elif action_type == 'drive' and defense_type == 'zone':
        # Zone reduces drive success
        if 'drive_success_rate' in modified:
            original_rate = modified['drive_success_rate']
            modified['drive_success_rate'] *= (1 + zone_mods['drive_penalty'])
            debug['modifiers_applied']['zone_drive_penalty'] = zone_mods['drive_penalty']

    elif action_type == 'shot_selection' and defense_type == 'zone':
        # Zone increases 3PT attempt rate
        if '3pt' in modified:
            modified['3pt'] += zone_mods['shot_attempt_bonus']
            debug['modifiers_applied']['zone_3pt_attempt_bonus'] = zone_mods['shot_attempt_bonus']

    # Normalize probabilities if needed (for distributions)
    if action_type == 'shot_selection':
        # Ensure shot distribution sums to 1.0
        total = sum(modified.values())
        if total > 0:
            for key in modified:
                modified[key] /= total

    debug['final'] = modified.copy()

    return modified, debug


# =============================================================================
# VALIDATION
# =============================================================================

def validate_tactical_settings(tactical_settings: TacticalSettings) -> Tuple[bool, List[str]]:
    """
    Comprehensive validation of all tactical settings.

    Args:
        tactical_settings: TacticalSettings object to validate

    Returns:
        Tuple of (is_valid: bool, error_messages: List[str])
    """
    errors = []

    # Validate pace
    if tactical_settings.pace not in ['fast', 'standard', 'slow']:
        errors.append(f"Invalid pace: {tactical_settings.pace}")

    # Validate man_defense_pct
    if not 0 <= tactical_settings.man_defense_pct <= 100:
        errors.append(f"Invalid man_defense_pct: {tactical_settings.man_defense_pct}")

    # Validate rebounding strategy
    if tactical_settings.rebounding_strategy not in ['crash_glass', 'standard', 'prevent_transition']:
        errors.append(f"Invalid rebounding_strategy: {tactical_settings.rebounding_strategy}")

    # Validate minutes allocation if provided
    if tactical_settings.minutes_allotment:
        is_valid, error = validate_minutes_allocation(tactical_settings.minutes_allotment)
        if not is_valid:
            errors.append(error)

    return len(errors) == 0, errors
