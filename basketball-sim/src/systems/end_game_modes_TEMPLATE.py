"""
Basketball Simulator - End-Game Clock Management System

Handles 4 critical end-game modes:
1. Clock Kill Mode - Leading teams burn clock to preserve leads
2. Last Second Shot (Tied) - Hold for last shot when tied
3. Last Second Shot (Losing) - Hold for last shot when trailing
4. Intentional Fouling [Phase 2] - Trailing teams foul to stop clock

Key Responsibilities:
- Detect which end-game mode is active (if any)
- Calculate shot clock consumption for clock management modes
- Force shot selection for last second shots (scoring_option_1, force 3PT)
- Execute intentional foul sequences [Phase 2]

Integrates with:
- src/systems/possession.py (mode detection at start of possession)
- src/core/data_structures.py (PossessionContext.quarter, intentional_foul_count)
- src/systems/fouls.py (intentional foul execution) [Phase 2]

From END_GAME_CLOCK_MANAGEMENT_SPEC.md:
- Clock Kill: Leading, <2 min, burn to 3-8 seconds
- Last Second Tied: Tied, <24 sec, shoot at 3 seconds game clock
- Last Second Losing: Trailing, <24 sec, shoot at 4 seconds, force 3PT if down 3+
- Intentional Foul: Down 3-8, <60 sec, foul worst FT shooter [Phase 2]
"""

from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
import random

from ..core.probability import calculate_composite
from ..constants import SIGMOID_K


# =============================================================================
# END-GAME MODE DETECTION
# =============================================================================

def detect_end_game_mode(
    score_diff: int,
    game_time: int,
    shot_clock: int,
    quarter: int,
    team_has_possession: bool
) -> Optional[str]:
    """
    Detect which end-game mode is active (if any).

    Priority order:
    1. intentional_foul (defensive, Phase 2)
    2. last_second_tied (offensive)
    3. last_second_losing (offensive)
    4. clock_kill_* (offensive)

    Args:
        score_diff: Score differential (positive = leading, negative = trailing)
        game_time: Seconds remaining in game
        shot_clock: Seconds remaining on shot clock
        quarter: Current quarter (1-4)
        team_has_possession: True if this team has the ball

    Returns:
        Mode name or None if no end-game mode active
        Possible returns:
        - 'intentional_foul' [Phase 2]
        - 'last_second_tied'
        - 'last_second_losing'
        - 'clock_kill_aggressive'
        - 'clock_kill_standard'
        - 'clock_kill_conservative'
        - None (normal possession)
    """

    # PHASE 2: Intentional Foul (check first, defensive action)
    # TODO: Implement intentional_foul_makes_sense()
    # if not team_has_possession and score_diff < 0 and game_time < 60:
    #     if intentional_foul_makes_sense(score_diff, game_time):
    #         return 'intentional_foul'

    # Only check offensive modes if team has possession
    if not team_has_possession:
        return None

    # Last Second Shot - Tied
    if score_diff == 0 and game_time <= 24 and quarter == 4:
        return 'last_second_tied'

    # Last Second Shot - Losing
    if score_diff < 0 and game_time <= 24 and quarter == 4:
        return 'last_second_losing'

    # Clock Kill Mode (only if leading and enough time to burn)
    if score_diff > 0 and game_time < 120 and game_time > shot_clock:
        # Determine intensity based on lead size and time remaining
        if score_diff >= 1 and game_time < 30:
            return 'clock_kill_aggressive'  # Any lead, final 30 seconds
        elif score_diff >= 3 and game_time < 90:
            return 'clock_kill_standard'  # 1-possession lead, final 90 seconds
        elif score_diff >= 7 and game_time < 120:
            return 'clock_kill_conservative'  # 2-possession lead, final 2 minutes
        else:
            # Leading but not in clock kill range yet
            return None

    return None


# =============================================================================
# CLOCK KILL MODE
# =============================================================================

# Shot clock targets for clock kill intensities
CLOCK_KILL_TARGETS = {
    'clock_kill_aggressive': 3,    # Shoot at 3 seconds shot clock
    'clock_kill_standard': 5,      # Shoot at 5 seconds shot clock
    'clock_kill_conservative': 8   # Shoot at 8 seconds shot clock
}

# Shot distribution modifiers for clock kill mode
CLOCK_KILL_SHOT_DISTRIBUTION_MODIFIERS = {
    '3pt': -0.05,      # -5% to 3PT attempts (slightly riskier)
    'midrange': 0.00,  # No change
    'rim': +0.05       # +5% to rim attempts (slightly safer)
}

# Turnover risk reduction
CLOCK_KILL_TURNOVER_MULTIPLIER = 0.90  # -10% turnover rate (more careful)


def apply_clock_kill_logic(
    mode: str,
    shot_clock: int,
    game_time: int
) -> Dict[str, Any]:
    """
    Calculate shot clock consumption for clock kill mode.

    Args:
        mode: 'clock_kill_aggressive', 'clock_kill_standard', or 'clock_kill_conservative'
        shot_clock: Current shot clock (seconds)
        game_time: Current game time (seconds)

    Returns:
        Dict with:
        - shot_clock_remaining: Seconds left on shot clock after burn
        - time_burned: Seconds burned
        - target_shot_clock: Target shot clock (for logging)
    """

    target = CLOCK_KILL_TARGETS[mode]
    buffer = 1  # Prevent shot clock violation

    # Edge case: game time < shot clock + target
    # In this case, burn based on game clock, not shot clock
    if game_time < (shot_clock + target):
        time_to_burn = game_time - target - buffer
    else:
        time_to_burn = shot_clock - target - buffer

    # Ensure non-negative
    time_to_burn = max(0, time_to_burn)

    # Calculate remaining shot clock
    shot_clock_remaining = max(0, shot_clock - time_to_burn)

    return {
        'shot_clock_remaining': shot_clock_remaining,
        'time_burned': time_to_burn,
        'target_shot_clock': target,
        'shot_distribution_modifiers': CLOCK_KILL_SHOT_DISTRIBUTION_MODIFIERS,
        'turnover_multiplier': CLOCK_KILL_TURNOVER_MULTIPLIER
    }


# =============================================================================
# LAST SECOND SHOT MODE
# =============================================================================

# Game clock targets for last second shot
LAST_SECOND_SHOT_TARGETS = {
    'last_second_tied': 3,    # Shoot at 3 seconds game clock (tied)
    'last_second_losing': 4   # Shoot at 4 seconds game clock (losing, allows OREB)
}


def apply_last_second_logic(
    mode: str,
    shot_clock: int,
    game_time: int,
    score_diff: int
) -> Dict[str, Any]:
    """
    Calculate shot clock consumption for last second shot mode.

    Args:
        mode: 'last_second_tied' or 'last_second_losing'
        shot_clock: Current shot clock (seconds)
        game_time: Current game time (seconds)
        score_diff: Score differential (negative = trailing)

    Returns:
        Dict with:
        - shot_clock_remaining: Seconds left on shot clock after burn
        - time_burned: Seconds burned
        - target_game_time: Target game time for shot (for logging)
        - force_shot_type: '3pt' if down 3+ (last_second_losing only)
        - force_shooter: 'scoring_option_1' (prioritize best player)
    """

    target_game_time = LAST_SECOND_SHOT_TARGETS[mode]

    # Calculate time to burn
    time_to_burn = game_time - target_game_time

    # Ensure non-negative
    time_to_burn = max(0, time_to_burn)

    # Calculate remaining shot clock
    shot_clock_remaining = max(1, shot_clock - time_to_burn)  # Min 1 to prevent violation

    # Determine shot type forcing (losing mode only)
    force_shot_type = None
    shot_distribution_modifiers = {}

    if mode == 'last_second_losing':
        if score_diff <= -3:
            # MUST shoot 3PT to tie
            force_shot_type = '3pt'
        elif score_diff == -2:
            # Prefer 3PT (can win instead of tie)
            shot_distribution_modifiers = {
                '3pt': +0.20,      # +20% to 3PT attempts
                'rim': +0.05,      # +5% to rim (high %)
                'midrange': -0.25  # -25% to midrange (inefficient)
            }

    return {
        'shot_clock_remaining': shot_clock_remaining,
        'time_burned': time_to_burn,
        'target_game_time': target_game_time,
        'force_shot_type': force_shot_type,
        'force_shooter': 'scoring_option_1',  # Prioritize best player
        'shot_distribution_modifiers': shot_distribution_modifiers,
        'usage_boost': 0.50  # 50% boost to scoring_option_1 usage
    }


# =============================================================================
# INTENTIONAL FOULING SYSTEM [PHASE 2]
# =============================================================================

def intentional_foul_makes_sense(
    score_diff: int,
    game_time: int,
    opponent_in_bonus: bool
) -> bool:
    """
    Determine if intentional fouling is strategically sound.

    NBA Analytics Decision Matrix:
    - Down 1-2 with <30 seconds: NO (just defend, need stop)
    - Down 3-8 with <60 seconds: YES (need possessions)
    - Down 9+ with <60 seconds: NO (game over, conserve energy)
    - Opponent in bonus: YES (already giving FTs, might as well stop clock)

    Args:
        score_diff: Score differential (negative = trailing)
        game_time: Seconds remaining in game
        opponent_in_bonus: Whether opponent is in bonus (5+ team fouls)

    Returns:
        True if intentional foul makes sense, False otherwise
    """

    # Scenario 1: Down 3-8 points, <60 seconds (CLASSIC FOUL SITUATION)
    if -8 <= score_diff <= -3 and game_time < 60:
        # If opponent in bonus, always foul (already giving FTs)
        if opponent_in_bonus:
            return True
        # If not in bonus, only foul in final 30 seconds
        elif game_time < 30:
            return True

    # Scenario 2: Down 1-2, <30 seconds (TOO CLOSE, just defend)
    if score_diff >= -2:
        return False  # One stop wins game

    # Scenario 3: Down 9+, <60 seconds (GAME OVER)
    if score_diff <= -9:
        return False  # Need 3+ possessions, not realistic

    return False


def select_foul_target(
    offensive_team: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Select which opponent to foul (worst FT shooter).

    NBA teams scout opponent FT% and target worst shooter.
    We approximate FT skill using attribute composite.

    Args:
        offensive_team: List of 5 offensive players on court

    Returns:
        Player dict of worst FT shooter
    """

    # Calculate FT composite for each player
    # Uses same weights as free_throws.py
    ft_composites = {}
    for player in offensive_team:
        # TODO: Import calculate_ft_composite from free_throws.py
        # ft_composites[player['name']] = calculate_ft_composite(player)
        pass

    # Target player with LOWEST FT composite
    # worst_ft_shooter = min(offensive_team, key=lambda p: ft_composites[p['name']])
    # return worst_ft_shooter

    # PLACEHOLDER: Return first player for now
    return offensive_team[0]


def select_fouling_player(
    defensive_team: List[Dict[str, Any]],
    personal_fouls: Dict[str, int]
) -> Dict[str, Any]:
    """
    Select which defensive player commits intentional foul.

    Priority:
    1. Player with fewest personal fouls (avoid foul-out)
    2. Bench player if possible (save starters)
    3. NOT a player with 5 fouls (would foul out)

    Args:
        defensive_team: List of 5 defensive players on court
        personal_fouls: Dict mapping player_name -> personal_fouls

    Returns:
        Player dict of fouling player
    """

    # Filter players with <5 fouls
    available_foulers = [
        p for p in defensive_team
        if personal_fouls.get(p['name'], 0) < 5
    ]

    if not available_foulers:
        # EMERGENCY: All players have 5 fouls (extremely rare)
        # Foul with player who has highest stamina (accept foul-out risk)
        return max(defensive_team, key=lambda p: p.get('current_stamina', 100))

    # Select player with fewest personal fouls
    return min(available_foulers, key=lambda p: personal_fouls.get(p['name'], 0))


def execute_intentional_foul(
    defensive_team: List[Dict[str, Any]],
    offensive_team: List[Dict[str, Any]],
    foul_system: Any,  # FoulSystem instance
    possession_context: Any,  # PossessionContext
    personal_fouls: Dict[str, int]
) -> Any:  # PossessionResult
    """
    Execute intentional foul sequence.

    Process:
    1. Select fouling player (fewest personal fouls)
    2. Select foul target (worst FT shooter)
    3. Create foul event (non-shooting)
    4. Award free throws (2 if in bonus, 0 if not)
    5. Return possession to trailing team

    Args:
        defensive_team: List of 5 defensive players
        offensive_team: List of 5 offensive players
        foul_system: FoulSystem instance
        possession_context: PossessionContext
        personal_fouls: Dict mapping player_name -> personal_fouls

    Returns:
        PossessionResult with foul event and free throw result
    """

    # TODO: Implement after Phase 1 complete
    # 1. Select fouler and target
    # 2. Register intentional foul in foul_system
    # 3. Execute free throws if in bonus
    # 4. Return PossessionResult with possession going to trailing team

    pass


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_end_game_mode_description(mode: str) -> str:
    """
    Get human-readable description of end-game mode.

    Args:
        mode: Mode name

    Returns:
        Description string for play-by-play
    """

    descriptions = {
        'clock_kill_aggressive': 'Leading team burns clock (aggressive)',
        'clock_kill_standard': 'Leading team burns clock (standard)',
        'clock_kill_conservative': 'Leading team burns clock (conservative)',
        'last_second_tied': 'Tied game, holding for last shot',
        'last_second_losing': 'Trailing, holding for last shot',
        'intentional_foul': 'Trailing team fouls intentionally'
    }

    return descriptions.get(mode, 'Unknown mode')


def apply_end_game_mode_to_possession(
    mode: str,
    possession_context: Any,  # PossessionContext
    tactical_settings: Any,  # TacticalSettings
    offensive_team: List[Dict[str, Any]],
    defensive_team: List[Dict[str, Any]],
    foul_system: Any = None,  # FoulSystem [Phase 2]
    personal_fouls: Dict[str, int] = None  # [Phase 2]
) -> Dict[str, Any]:
    """
    Apply end-game mode modifications to possession.

    This is the main integration point called from possession.py.

    Args:
        mode: End-game mode name
        possession_context: PossessionContext
        tactical_settings: TacticalSettings
        offensive_team: List of 5 offensive players
        defensive_team: List of 5 defensive players
        foul_system: FoulSystem instance [Phase 2]
        personal_fouls: Dict mapping player_name -> personal_fouls [Phase 2]

    Returns:
        Dict with possession modifications:
        - shot_clock_remaining: Modified shot clock
        - force_shot_type: '3pt' or None
        - force_shooter: 'scoring_option_1' or None
        - shot_distribution_modifiers: Dict of modifiers
        - turnover_multiplier: Float (1.0 = no change)
        - usage_boost: Float (0.0 = no change)
        - intentional_foul_result: PossessionResult [Phase 2]
    """

    # PHASE 2: Intentional Foul (returns immediately, no possession)
    if mode == 'intentional_foul':
        if foul_system is None or personal_fouls is None:
            raise ValueError("Intentional foul requires foul_system and personal_fouls")

        return {
            'intentional_foul_result': execute_intentional_foul(
                defensive_team,
                offensive_team,
                foul_system,
                possession_context,
                personal_fouls
            )
        }

    # Clock Kill Mode
    if mode.startswith('clock_kill'):
        clock_kill_result = apply_clock_kill_logic(
            mode,
            possession_context.shot_clock,
            possession_context.game_time_remaining
        )
        return {
            'shot_clock_remaining': clock_kill_result['shot_clock_remaining'],
            'shot_distribution_modifiers': clock_kill_result['shot_distribution_modifiers'],
            'turnover_multiplier': clock_kill_result['turnover_multiplier'],
            'time_burned': clock_kill_result['time_burned'],
            'target_shot_clock': clock_kill_result['target_shot_clock']
        }

    # Last Second Shot Mode
    if mode.startswith('last_second'):
        last_second_result = apply_last_second_logic(
            mode,
            possession_context.shot_clock,
            possession_context.game_time_remaining,
            possession_context.score_differential
        )
        return {
            'shot_clock_remaining': last_second_result['shot_clock_remaining'],
            'force_shot_type': last_second_result['force_shot_type'],
            'force_shooter': last_second_result['force_shooter'],
            'shot_distribution_modifiers': last_second_result.get('shot_distribution_modifiers', {}),
            'usage_boost': last_second_result['usage_boost'],
            'time_burned': last_second_result['time_burned'],
            'target_game_time': last_second_result['target_game_time']
        }

    # Unknown mode
    return {}


# =============================================================================
# VALIDATION HELPERS
# =============================================================================

def validate_end_game_mode_behavior(
    mode: str,
    shot_clock_at_attempt: int,
    game_time_at_attempt: int,
    shooter_name: str,
    shot_type: str,
    scoring_option_1: Optional[str]
) -> Dict[str, bool]:
    """
    Validate that end-game mode behaved correctly.

    Used for testing and validation.

    Args:
        mode: End-game mode name
        shot_clock_at_attempt: Shot clock when shot was taken
        game_time_at_attempt: Game time when shot was taken
        shooter_name: Name of player who took shot
        shot_type: '3pt', 'midrange', or 'rim'
        scoring_option_1: Name of scoring option #1 (or None)

    Returns:
        Dict with validation results:
        - shot_clock_correct: True if shot clock consumption correct
        - shot_timing_correct: True if game clock timing correct
        - shooter_correct: True if correct shooter selected
        - shot_type_correct: True if correct shot type (forced 3PT if down 3+)
    """

    results = {
        'shot_clock_correct': False,
        'shot_timing_correct': False,
        'shooter_correct': False,
        'shot_type_correct': False
    }

    # TODO: Implement validation logic
    # Check shot clock is within target range
    # Check game clock timing for last second shots
    # Check shooter is scoring_option_1 for last second shots
    # Check shot_type is 3PT if forced

    return results
