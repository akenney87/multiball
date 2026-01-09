"""
Basketball Simulator - Possession State Machine (M3 Architecture Fix)

CRITICAL SYSTEM for tracking possession and ball state throughout the game.

This module is the FOUNDATION for fixing timeout and substitution violations.
It explicitly tracks:
1. Who has possession at any moment
2. Ball state (LIVE vs DEAD)
3. Legal timeout opportunities
4. Legal substitution opportunities

This system MUST be consulted before ANY timeout or substitution decision.

Integration Points:
- src/systems/quarter_simulation.py (main game loop)
- src/systems/timeout_manager.py (timeout legality)
- src/systems/substitutions.py (substitution legality)

Author: Architecture & Integration Lead
Date: 2025-11-06
Milestone: M3 - Possession State Tracking
"""

from typing import Optional
from enum import Enum


# =============================================================================
# ENUMERATIONS
# =============================================================================

class BallState(Enum):
    """Ball state during game flow."""
    LIVE = "LIVE"    # Play is active, ball is live
    DEAD = "DEAD"    # Play is stopped, whistle has blown


class DeadBallReason(Enum):
    """Reason why ball is dead (if applicable)."""
    MADE_BASKET = "made_basket"           # Shot made, opponent inbounding
    MADE_FREE_THROW = "made_free_throw"   # Final FT made, opponent inbounding
    MISSED_FINAL_FT = "missed_final_ft"   # Final FT missed, rebound situation
    FOUL = "foul"                         # Whistle for foul (before FTs)
    VIOLATION = "violation"               # Out of bounds, travel, etc.
    TIMEOUT = "timeout"                   # Timeout called
    QUARTER_END = "quarter_end"           # Quarter/game over
    NONE = None                           # Ball is live


# =============================================================================
# POSSESSION STATE MACHINE
# =============================================================================

class PossessionState:
    """
    Tracks current possession and ball state throughout game flow.

    This is the SINGLE SOURCE OF TRUTH for possession tracking.

    State Variables:
        current_possession_team: 'home' or 'away' - who has the ball
        ball_state: BallState.LIVE or BallState.DEAD
        dead_ball_reason: DeadBallReason enum (or None if ball is live)

    Critical Methods:
        can_call_timeout(team) -> bool: Is timeout legal for this team?
        can_substitute() -> bool: Are substitutions legal right now?
        update_after_X(): State transition methods for each possession outcome

    NBA Rules Enforced:
        1. LIVE BALL: Only team with possession can call timeout
        2. DEAD BALL: Either team can call timeout
        3. Substitutions: Only during specific dead ball situations
           - After foul (before FTs)
           - After timeout
           - After violation
           - Between quarters
           - After missed final FT
           - NOT after made basket (unless timeout)
           - NOT after made FT
    """

    def __init__(self, starting_team: str):
        """
        Initialize possession state machine.

        Args:
            starting_team: 'home' or 'away' - team that starts with possession
        """
        if starting_team not in ['home', 'away']:
            raise ValueError(f"starting_team must be 'home' or 'away', got: {starting_team}")

        self.current_possession_team: str = starting_team
        self.ball_state: BallState = BallState.LIVE  # Game starts with live ball (jump ball/inbound)
        self.dead_ball_reason: DeadBallReason = DeadBallReason.NONE

    # =========================================================================
    # STATE QUERY METHODS
    # =========================================================================

    def can_call_timeout(self, team: str) -> bool:
        """
        Check if team can legally call timeout RIGHT NOW.

        NBA Rules:
        - LIVE BALL: Only team with possession can call timeout
        - DEAD BALL: Either team can call timeout

        Args:
            team: 'home' or 'away'

        Returns:
            True if team can legally call timeout

        Example:
            After defensive rebound (live ball):
                - Rebounding team: True (has possession)
                - Other team: False (doesn't have ball)

            After made basket (dead ball):
                - Either team: True (both can call timeout during inbound)
        """
        if team not in ['home', 'away']:
            raise ValueError(f"team must be 'home' or 'away', got: {team}")

        if self.ball_state == BallState.LIVE:
            # Live ball: only team with possession can timeout
            return team == self.current_possession_team
        else:  # DEAD BALL
            # Dead ball: either team can timeout
            return True

    def can_substitute(self) -> bool:
        """
        Check if substitutions are legal RIGHT NOW.

        Simplified Substitution Rules (per user request):
        - Only during specific dead balls:
          - After timeout
          - After violation (turnover, out of bounds)
          - Between quarters
        - NOT during:
          - Live play
          - After fouls (including before/after free throws)
          - After made basket
          - After made FT

        Returns:
            True if substitutions are legal

        Example:
            After made basket: False (dead ball, but NOT a legal sub window)
            After foul: False (M4.5 PHASE 4: user decision - no subs after fouls)
            After made FT: False (dead ball, but no sub opportunity)
            After timeout: True (dead ball, legal sub window)
            After violation: True (dead ball, legal sub window)
        """
        if self.ball_state == BallState.LIVE:
            # Live play: no substitutions
            return False

        # Dead ball: check reason
        # SIMPLIFIED SUBSTITUTION RULES (per user request):
        # Substitutions allowed ONLY during:
        # - Timeouts
        # - Violations (turnovers, out of bounds)
        # - Offensive fouls (dead ball turnovers)
        # - Quarter breaks
        # NOT after shooting fouls, free throws, or made baskets
        legal_sub_reasons = [
            DeadBallReason.TIMEOUT,
            DeadBallReason.VIOLATION,
            DeadBallReason.FOUL,  # FIX: Allow subs after offensive fouls (dead ball)
            DeadBallReason.QUARTER_END,
        ]

        return self.dead_ball_reason in legal_sub_reasons

    def get_possession_team(self) -> str:
        """
        Get team that currently has possession.

        Returns:
            'home' or 'away'
        """
        return self.current_possession_team

    def get_ball_state(self) -> BallState:
        """
        Get current ball state.

        Returns:
            BallState.LIVE or BallState.DEAD
        """
        return self.ball_state

    def get_dead_ball_reason(self) -> DeadBallReason:
        """
        Get reason ball is dead (if applicable).

        Returns:
            DeadBallReason enum or DeadBallReason.NONE if ball is live
        """
        return self.dead_ball_reason

    # =========================================================================
    # STATE TRANSITION METHODS
    # =========================================================================

    def update_after_made_basket(self, scoring_team: str) -> None:
        """
        Update state after made basket.

        Made basket:
        - Ball state: DEAD (during inbound)
        - Possession: Opponent gets ball
        - Dead ball reason: 'made_basket'
        - Can timeout: Yes (either team)
        - Can substitute: No (unless timeout called)

        Args:
            scoring_team: 'home' or 'away' - team that scored
        """
        if scoring_team not in ['home', 'away']:
            raise ValueError(f"scoring_team must be 'home' or 'away', got: {scoring_team}")

        # Possession switches to opponent
        self.current_possession_team = 'away' if scoring_team == 'home' else 'home'
        self.ball_state = BallState.DEAD
        self.dead_ball_reason = DeadBallReason.MADE_BASKET

    def update_after_defensive_rebound(self, rebounding_team: str) -> None:
        """
        Update state after defensive rebound.

        Defensive rebound:
        - Ball state: LIVE (play continues)
        - Possession: Rebounding team
        - Can timeout: Yes (only rebounding team)
        - Can substitute: No (live play)

        Args:
            rebounding_team: 'home' or 'away' - team that got rebound
        """
        if rebounding_team not in ['home', 'away']:
            raise ValueError(f"rebounding_team must be 'home' or 'away', got: {rebounding_team}")

        self.current_possession_team = rebounding_team
        self.ball_state = BallState.LIVE
        self.dead_ball_reason = DeadBallReason.NONE

    def update_after_offensive_rebound(self, rebounding_team: str) -> None:
        """
        Update state after offensive rebound.

        Offensive rebound:
        - Ball state: LIVE (play continues)
        - Possession: Same team (no change)
        - Can timeout: Yes (only team with ball)
        - Can substitute: No (live play)

        Args:
            rebounding_team: 'home' or 'away' - team that got rebound (validation only)
        """
        if rebounding_team not in ['home', 'away']:
            raise ValueError(f"rebounding_team must be 'home' or 'away', got: {rebounding_team}")

        # Possession should NOT change (offensive rebound)
        # But we update it anyway for safety (in case previous state was wrong)
        self.current_possession_team = rebounding_team
        self.ball_state = BallState.LIVE
        self.dead_ball_reason = DeadBallReason.NONE

    def update_after_turnover(self, team_that_got_ball: str, turnover_type: str = 'violation', was_stolen: bool = False) -> None:
        """
        Update state after turnover.

        Turnover Classification:
        1. LIVE BALL (no subs): Stolen bad pass, stripped lost ball
        2. DEAD BALL + VIOLATION (subs allowed): Out of bounds, traveling, carry, etc.
        3. DEAD BALL + FOUL (no subs): Offensive foul

        Args:
            team_that_got_ball: 'home' or 'away' - team that gained possession
            turnover_type: Type of turnover ('bad_pass', 'lost_ball', 'offensive_foul', 'violation')
            was_stolen: True if turnover was a steal (live ball), False otherwise
        """
        if team_that_got_ball not in ['home', 'away']:
            raise ValueError(f"team_that_got_ball must be 'home' or 'away', got: {team_that_got_ball}")

        self.current_possession_team = team_that_got_ball

        # USER FIX: Distinguish between live ball (steals) and dead ball (violations/fouls)
        #
        # Substitution rules (per user): ONLY during timeout/violation/quarter-start
        # - Steals (bad_pass/lost_ball + stolen) → LIVE BALL, no subs
        # - Out of bounds (bad_pass/lost_ball + not stolen) → DEAD BALL (VIOLATION), subs allowed
        # - Violation (traveling, carry) → DEAD BALL (VIOLATION), subs allowed
        # - Offensive foul → DEAD BALL (FOUL), no subs (it's a foul, not a violation)

        if was_stolen:
            # Live ball steal: play continues immediately
            self.ball_state = BallState.LIVE
            self.dead_ball_reason = DeadBallReason.NONE
        elif turnover_type == 'offensive_foul':
            # Dead ball foul: whistle blown, but it's a FOUL not a VIOLATION
            # User said subs only during violations, not fouls
            self.ball_state = BallState.DEAD
            self.dead_ball_reason = DeadBallReason.FOUL
        else:
            # Dead ball violation: out of bounds, traveling, carry, etc.
            # Substitutions allowed
            self.ball_state = BallState.DEAD
            self.dead_ball_reason = DeadBallReason.VIOLATION

    def update_after_foul(self, team_with_ball: str) -> None:
        """
        Update state after foul (whistle blown).

        Foul:
        - Ball state: DEAD (whistle)
        - Possession: Team that was fouled (usually)
        - Can timeout: Yes (either team)
        - Can substitute: Yes (before FTs)

        Args:
            team_with_ball: 'home' or 'away' - team with possession after foul
        """
        if team_with_ball not in ['home', 'away']:
            raise ValueError(f"team_with_ball must be 'home' or 'away', got: {team_with_ball}")

        self.current_possession_team = team_with_ball
        self.ball_state = BallState.DEAD
        self.dead_ball_reason = DeadBallReason.FOUL

    def update_after_made_ft(self, shooting_team: str) -> None:
        """
        Update state after made final free throw.

        Made FT:
        - Ball state: DEAD (during inbound)
        - Possession: Opponent gets ball
        - Can timeout: Yes (either team)
        - Can substitute: No (treat like made basket)

        Args:
            shooting_team: 'home' or 'away' - team that shot FT
        """
        if shooting_team not in ['home', 'away']:
            raise ValueError(f"shooting_team must be 'home' or 'away', got: {shooting_team}")

        self.current_possession_team = 'away' if shooting_team == 'home' else 'home'
        self.ball_state = BallState.DEAD
        self.dead_ball_reason = DeadBallReason.MADE_FREE_THROW

    def update_after_missed_ft(self) -> None:
        """
        Update state after missed final free throw.

        Missed final FT:
        - Ball state: DEAD (rebound situation, whistle for positioning)
        - Possession: TBD (determined by rebound)
        - Can timeout: Yes (either team)
        - Can substitute: Yes (dead ball before rebound)

        NOTE: Possession team is NOT updated here - it will be set by
        update_after_offensive_rebound() or update_after_defensive_rebound()
        """
        # Don't update possession yet - rebound will determine it
        self.ball_state = BallState.DEAD
        self.dead_ball_reason = DeadBallReason.MISSED_FINAL_FT

    def update_after_violation(self, team_that_got_ball: str) -> None:
        """
        Update state after violation (out of bounds, travel, etc.).

        Violation:
        - Ball state: DEAD (whistle)
        - Possession: Opponent gets ball
        - Can timeout: Yes (either team)
        - Can substitute: Yes

        Args:
            team_that_got_ball: 'home' or 'away' - team that gains possession
        """
        if team_that_got_ball not in ['home', 'away']:
            raise ValueError(f"team_that_got_ball must be 'home' or 'away', got: {team_that_got_ball}")

        self.current_possession_team = team_that_got_ball
        self.ball_state = BallState.DEAD
        self.dead_ball_reason = DeadBallReason.VIOLATION

    def update_after_out_of_bounds(self, team_that_got_ball: str) -> None:
        """
        Update state after ball goes out of bounds (blocked shots, etc.).

        Out of Bounds:
        - Ball state: DEAD (whistle)
        - Possession: Team that gets inbound
        - Dead ball reason: VIOLATION (substitutions allowed)
        - Can timeout: Yes (either team)
        - Can substitute: Yes (violation window)

        Args:
            team_that_got_ball: 'home' or 'away' - team that gets possession
        """
        if team_that_got_ball not in ['home', 'away']:
            raise ValueError(f"team_that_got_ball must be 'home' or 'away', got: {team_that_got_ball}")

        self.current_possession_team = team_that_got_ball
        self.ball_state = BallState.DEAD
        self.dead_ball_reason = DeadBallReason.VIOLATION

    def update_after_timeout(self) -> None:
        """
        Update state after timeout.

        Timeout:
        - Ball state: DEAD
        - Possession: Same team (no change)
        - Can timeout: No (already in timeout)
        - Can substitute: Yes
        """
        # Possession doesn't change during timeout
        self.ball_state = BallState.DEAD
        self.dead_ball_reason = DeadBallReason.TIMEOUT

    def start_new_possession(self) -> None:
        """
        Start new possession (inbound, ball becomes live).

        Called when:
        - After inbound pass is made (following made basket, violation, etc.)
        - After jump ball
        - After timeout ends and play resumes
        """
        self.ball_state = BallState.LIVE
        self.dead_ball_reason = DeadBallReason.NONE

    def end_quarter(self) -> None:
        """
        Mark quarter as ended.

        Quarter end:
        - Ball state: DEAD
        - Possession: Preserved for next quarter (alternates)
        - Can timeout: No (between quarters)
        - Can substitute: Yes (quarter break)
        """
        self.ball_state = BallState.DEAD
        self.dead_ball_reason = DeadBallReason.QUARTER_END

    # =========================================================================
    # DEBUGGING / INSPECTION
    # =========================================================================

    def get_state_summary(self) -> dict:
        """
        Get human-readable summary of current state (for debugging).

        Returns:
            Dict with current state info
        """
        return {
            'possession_team': self.current_possession_team,
            'ball_state': self.ball_state.value,
            'dead_ball_reason': self.dead_ball_reason.value if self.dead_ball_reason != DeadBallReason.NONE else None,
            'can_timeout_home': self.can_call_timeout('home'),
            'can_timeout_away': self.can_call_timeout('away'),
            'can_substitute': self.can_substitute(),
        }

    def __repr__(self) -> str:
        """String representation for debugging."""
        return (
            f"PossessionState("
            f"possession={self.current_possession_team}, "
            f"ball={self.ball_state.value}, "
            f"reason={self.dead_ball_reason.value if self.dead_ball_reason != DeadBallReason.NONE else None})"
        )
