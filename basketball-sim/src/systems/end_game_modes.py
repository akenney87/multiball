"""
Basketball Simulator - End-Game Logic System (M3)

Implements 6 end-game modes for realistic late-game strategy:
1. Clock Kill Mode - Leading team burns clock in final 35 seconds
2. Last Second Shot - Tied - Hold for last shot when tied
3. Last Second Shot - Losing - Hold for last shot when trailing 1-3
4. Desperation Mode - Increase 3PT volume when down 9+ with <10 mins
5. Conserve Lead Mode - Slow pace when up 15+ with <3 mins
6. Intentional Fouling - Foul worst FT shooter when down 3-8 with <60s

Key Design Decisions:
- Shot timing uses simple random (not attribute-driven) for speed
- No forced shooter - normal weighted usage distribution applies
- No bonus state check - teams foul regardless (will be in bonus eventually)
- Modes can stack additively (e.g., Desperation + Last Shot Losing)
- Clock Kill/Last Shot override user pace (basketball logic dictates)
"""

import random
from typing import Dict, List, Any, Optional

from ..core.data_structures import EndGameModifiers
from ..core.probability import calculate_composite


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def select_intentional_foul_target(roster: List[Dict[str, Any]]) -> str:
    """
    Select target for intentional foul.

    When teams know intentional fouling is coming, the offense protects the ball
    with their best FT shooter. Distribution:
    - 50% of the time: Best FT shooter gets fouled
    - 50% of the time: One of the other 4 players (12.5% each)

    Uses FT composite:
    - throw_accuracy: 40%
    - composure: 25%
    - consistency: 20%
    - hand_eye_coordination: 15%

    Args:
        roster: Team roster

    Returns:
        Name of player selected for intentional foul
    """
    ft_weights = {
        'throw_accuracy': 0.40,
        'composure': 0.25,
        'consistency': 0.20,
        'hand_eye_coordination': 0.15,
    }

    # Calculate FT composite for all players
    player_composites = []
    for player in roster:
        ft_composite = calculate_composite(player, ft_weights)
        player_composites.append((player['name'], ft_composite))

    # Sort by FT composite (highest first = best FT shooter)
    player_composites.sort(key=lambda x: x[1], reverse=True)

    # 50% chance: Best FT shooter gets the ball
    if random.random() < 0.5:
        return player_composites[0][0]

    # 50% chance: One of the other 4 players
    other_players = [name for name, _ in player_composites[1:]]
    return random.choice(other_players) if other_players else player_composites[0][0]


def select_fouler(
    defensive_roster: List[Dict[str, Any]],
    foul_system: Any
) -> str:
    """
    Select player to commit intentional foul.

    Prioritizes players with fewest personal fouls to avoid foul-outs.

    Args:
        defensive_roster: Defensive team's roster
        foul_system: FoulSystem instance to check personal foul counts

    Returns:
        Name of player to commit foul
    """
    # Get current personal fouls for all players
    foul_counts = []
    for player in defensive_roster:
        player_name = player['name']
        fouls = foul_system.personal_fouls.get(player_name, 0)
        # Skip players with 5 fouls (would foul out)
        if fouls < 5:
            foul_counts.append((player_name, fouls))

    # If everyone has 5 fouls (edge case), just use first player
    if not foul_counts:
        return defensive_roster[0]['name']

    # Sort by fewest fouls
    foul_counts.sort(key=lambda x: x[1])

    # Return player with fewest fouls
    return foul_counts[0][0]


# =============================================================================
# MODE DETECTION
# =============================================================================

def detect_end_game_mode(
    game_time_remaining: int,
    score_differential: int,
    quarter: int,
    team_has_possession: bool,
    offensive_roster: List[Dict[str, Any]],
    defensive_roster: List[Dict[str, Any]]
) -> EndGameModifiers:
    """
    Detect active end-game modes and return modifiers.

    Modes can stack additively (shot_distribution_3pt_adj and pace_multiplier
    accumulate from multiple modes).

    Args:
        game_time_remaining: Seconds left in game (0-2880)
        score_differential: Point difference (positive = team ahead, negative = behind)
        quarter: Current quarter (1-4)
        team_has_possession: True if evaluating team has ball
        offensive_roster: Offensive team's roster (for FT composite calculation)
        defensive_roster: Defensive team's roster (for fouler selection)

    Returns:
        EndGameModifiers with appropriate values set
    """
    mods = EndGameModifiers()

    # Only check end-game modes in Q4
    if quarter != 4:
        return mods

    # =========================================================================
    # MODE 1: CLOCK KILL MODE
    # Leading team burns shot clock in final 35 seconds
    # =========================================================================
    if (
        game_time_remaining <= 35 and
        score_differential >= 1 and
        score_differential <= 8 and
        team_has_possession
    ):
        mods.active_modes.append('clock_kill')

        # Shot clock target varies by lead size
        # Larger lead = shoot earlier (more aggressive)
        # Smaller lead = shoot later (more conservative)
        if score_differential >= 7:
            mods.shot_clock_target = 3.0  # Big lead: shoot at 3 sec
        elif score_differential >= 4:
            mods.shot_clock_target = 5.0  # Medium lead: shoot at 5 sec
        else:
            mods.shot_clock_target = 7.0  # Small lead: shoot at 7 sec

    # =========================================================================
    # MODE 2: LAST SECOND SHOT - TIED GAME
    # Hold for final shot when tied
    # =========================================================================
    if (
        game_time_remaining <= 24 and
        score_differential == 0 and
        team_has_possession
    ):
        mods.active_modes.append('last_shot_tied')
        mods.game_clock_target = 3.0  # Shoot at 3 seconds game clock

    # =========================================================================
    # MODE 3: LAST SECOND SHOT - LOSING
    # Hold for final shot when trailing by 1-3 points
    # =========================================================================
    if (
        game_time_remaining <= 24 and
        score_differential >= -3 and
        score_differential <= -1 and
        team_has_possession
    ):
        mods.active_modes.append('last_shot_losing')

        # Random timing 5-8 seconds (allows time for OREB and immediate foul)
        mods.game_clock_target = random.uniform(5.0, 8.0)

        # Force 3PT attempt if down 3 (need to tie)
        if score_differential == -3:
            mods.force_shot_type = '3pt'

    # =========================================================================
    # MODE 4: DESPERATION MODE
    # Increase 3PT volume and pace when trailing badly with <10 mins
    # =========================================================================
    if (
        game_time_remaining < 600 and  # <10 minutes
        score_differential <= -9 and
        team_has_possession
    ):
        # Calculate desperation magnitude
        time_remaining_minutes = game_time_remaining / 60
        magnitude = abs(score_differential) / (time_remaining_minutes + 1)

        # Only trigger if magnitude exceeds threshold
        if magnitude > 1.5:
            mods.active_modes.append('desperation')

            # Scale effects by magnitude strength (cap at 1.0)
            strength = min(1.0, (magnitude - 1.5) / 2.0)

            # Additive adjustments (can stack with other modes)
            mods.shot_distribution_3pt_adj += strength * 0.20  # Up to +20% 3PT
            mods.pace_multiplier *= (1.0 + strength * 0.10)   # Up to +10% pace

    # =========================================================================
    # MODE 5: CONSERVE LEAD MODE
    # Slow pace and reduce 3PT when leading comfortably with <3 mins
    # =========================================================================
    if (
        game_time_remaining < 180 and  # <3 minutes (changed from 10 min per user feedback)
        score_differential >= 15 and
        team_has_possession
    ):
        # Calculate conserve magnitude (positive score_diff, no abs())
        time_remaining_minutes = game_time_remaining / 60
        magnitude = score_differential / (time_remaining_minutes + 1)

        # Only trigger if magnitude exceeds threshold
        if magnitude > 1.5:
            mods.active_modes.append('conserve_lead')

            # Scale effects by magnitude strength (cap at 1.0)
            strength = min(1.0, (magnitude - 1.5) / 2.0)

            # Additive adjustments (can stack with other modes)
            mods.shot_distribution_3pt_adj += -(strength * 0.10)  # Up to -10% 3PT
            mods.pace_multiplier *= (1.0 - strength * 0.15)      # Up to -15% pace

    # =========================================================================
    # NOTE: Intentional Fouling (Mode 6) handled separately in possession.py
    # after ball handler selection, since it requires knowing who has the ball
    # =========================================================================

    return mods


def should_intentional_foul(
    game_time_remaining: int,
    score_differential: int,
    quarter: int,
    offensive_team_leading: bool
) -> bool:
    """
    Check if defense should intentionally foul.

    Basketball strategy:
    - Down 2-3 points with <24 seconds: Foul immediately (otherwise opponent runs clock)
    - Down 2-3 points with >24 seconds: DON'T foul (play defense, try for stop)
    - Down 4-6 points with <60 seconds: Foul (need multiple possessions)

    Args:
        game_time_remaining: Seconds left in game
        score_differential: From offense perspective (positive = offense ahead)
        quarter: Current quarter
        offensive_team_leading: True if offensive team is ahead

    Returns:
        True if defense should intentionally foul
    """
    if not (quarter == 4 and offensive_team_leading):
        return False

    # Down 2-3 with <24 seconds: MUST foul to get ball back (or opponent runs clock)
    if 2 <= score_differential <= 3 and game_time_remaining <= 24:
        return True

    # Down 2-3 with >24 seconds: DON'T foul (play defense, try for stop)
    # With time remaining, better to defend and get ball back naturally

    # Down 4-6: Foul with <60 seconds (need to get multiple possessions)
    if 4 <= score_differential <= 6 and game_time_remaining <= 60:
        return True

    return False
