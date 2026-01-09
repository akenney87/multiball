"""
Basketball Simulator - Timeout Management System (M3 Phase 2c)

Handles timeout strategy and execution for realistic game flow.

Key Responsibilities:
1. Detect momentum situations (scoring runs: 8-0, 10-2, 12-0)
2. Trigger timeouts to stop opponent momentum
3. Manage end-game timeout strategy
4. Track timeout usage (7 per team per game)
5. Apply timeout effects (stamina recovery, substitution window)

Integrates with:
- src/systems/quarter_simulation.py (timeout triggers)
- src/systems/stamina_manager.py (stamina recovery during timeout)
- src/systems/substitutions.py (substitution window)

From FOULS_AND_INJURIES_SPEC.md Section 2:
- Momentum threshold: 8-0, 10-2, 12-0 runs
- End-game strategy: Save 1-2 timeouts for final 3 minutes
- Stamina recovery: +5 stamina for full timeout, +3 for short timeout
"""

from typing import Dict, List, Any, Tuple, Optional
from dataclasses import dataclass


# =============================================================================
# TIMEOUT DATA STRUCTURES
# =============================================================================

@dataclass
class TimeoutEvent:
    """
    Record of a timeout occurrence.

    Attributes:
        team: 'Home' or 'Away'
        quarter: Quarter number (1-4)
        game_time: Game clock when timeout was called
        reason: 'momentum', 'substitution', 'end_game', 'advance_ball'
        scoring_run: Tuple (team_points, opponent_points) that triggered timeout
        timeouts_remaining_after: Timeouts remaining after this timeout
    """
    team: str
    quarter: int
    game_time: str
    reason: str
    scoring_run: Optional[Tuple[int, int]] = None
    timeouts_remaining_after: int = 0


@dataclass
class ScoringRun:
    """
    Tracks current scoring run for momentum detection.

    Attributes:
        team_points: Points scored by this team in current run
        opponent_points: Points scored by opponent in current run
        possessions_in_run: Number of possessions in this run
    """
    team_points: int = 0
    opponent_points: int = 0
    possessions_in_run: int = 0

    def reset(self):
        """Reset run tracker after timeout or run broken."""
        self.team_points = 0
        self.opponent_points = 0
        self.possessions_in_run = 0

    def update(self, points_scored: int, by_team: bool):
        """
        Update run tracker after possession.

        Args:
            points_scored: Points scored this possession
            by_team: True if scored by this team, False if by opponent
        """
        if by_team:
            self.team_points += points_scored
        else:
            self.opponent_points += points_scored

        self.possessions_in_run += 1

    def get_run(self) -> Tuple[int, int]:
        """Get current run as (team_points, opponent_points)."""
        return (self.team_points, self.opponent_points)


# =============================================================================
# TIMEOUT MANAGER CLASS
# =============================================================================

class TimeoutManager:
    """
    Manages timeout strategy and detection for a full game.

    Tracks timeouts remaining, scoring runs, and determines when to call timeouts.
    """

    def __init__(
        self,
        timeout_strategy: str = 'standard',
        timeouts_per_game: int = 7
    ):
        """
        Initialize timeout manager.

        Args:
            timeout_strategy: 'aggressive', 'standard', or 'conservative'
            timeouts_per_game: Number of timeouts each team starts with (default 7)
        """
        # Timeout counters
        self.timeouts_remaining_home: int = timeouts_per_game
        self.timeouts_remaining_away: int = timeouts_per_game
        self.timeouts_per_game = timeouts_per_game

        # Timeout events history
        self.timeout_events: List[TimeoutEvent] = []

        # Scoring run trackers
        self.home_run: ScoringRun = ScoringRun()
        self.away_run: ScoringRun = ScoringRun()

        # Strategy settings
        self.timeout_strategy = timeout_strategy
        self.strategy_params = self._get_strategy_params(timeout_strategy)

        # BUG FIX: Timeout cooldown tracking to prevent spam
        # Track last timeout time for each team to enforce minimum gap
        self.last_timeout_time_home: int = -999  # Game time in seconds when last timeout was called
        self.last_timeout_time_away: int = -999
        self.min_timeout_gap_seconds: int = 15   # Minimum 15 seconds between timeouts

    def _get_strategy_params(self, strategy: str) -> Dict[str, int]:
        """
        Get strategy parameters for timeout usage.

        Args:
            strategy: 'aggressive', 'standard', or 'conservative'

        Returns:
            Dict with momentum_threshold and save_for_endgame
        """
        strategies = {
            'aggressive': {
                'momentum_threshold': 8,   # Call timeout after 8-0 run
                'save_for_endgame': 2,     # Save 2 timeouts for Q4
            },
            'standard': {
                'momentum_threshold': 10,  # Call timeout after 10-0 run
                'save_for_endgame': 1,     # Save 1 timeout for Q4
            },
            'conservative': {
                'momentum_threshold': 12,  # Only call after 12-0 run
                'save_for_endgame': 3,     # Save 3 timeouts for Q4
            }
        }
        return strategies.get(strategy, strategies['standard'])

    def update_scoring_run(
        self,
        team: str,
        points_scored: int,
        scoring_team: str
    ) -> None:
        """
        Update scoring run trackers after a possession.

        Args:
            team: 'Home' or 'Away' (team whose run we're tracking)
            points_scored: Points scored this possession
            scoring_team: 'Home' or 'Away' (team that scored)
        """
        if team == 'Home':
            self.home_run.update(points_scored, by_team=(scoring_team == 'Home'))
        else:
            self.away_run.update(points_scored, by_team=(scoring_team == 'Away'))

    def check_momentum_timeout(
        self,
        team: str,
        quarter: int,
        time_remaining: int,
        score_differential: int,
        team_just_scored: bool = False
    ) -> Tuple[bool, str]:
        """
        Check if team should call momentum timeout to stop opponent run.

        Args:
            team: 'Home' or 'Away' (team considering timeout)
            quarter: Current quarter (1-4)
            time_remaining: Seconds remaining in quarter
            score_differential: Score difference (positive = team winning)
            team_just_scored: True if this team just scored (don't call timeout if you just scored)

        Returns:
            (should_call_timeout, reason)
        """
        # BUG FIX: Enforce timeout cooldown to prevent spam
        # Convert quarter time to total game time for comparison
        game_time = (4 - quarter) * 720 + time_remaining
        last_timeout_time = self.last_timeout_time_home if team == 'Home' else self.last_timeout_time_away

        if game_time > last_timeout_time - self.min_timeout_gap_seconds:
            # Too soon since last timeout - don't call another one
            return (False, '')

        # CRITICAL FIX: Don't call timeout if YOU just scored
        # If you just scored, YOU have momentum, not the opponent
        if team_just_scored:
            return (False, '')

        # Get team's run tracker and timeouts
        if team == 'Home':
            run = self.home_run
            timeouts_remaining = self.timeouts_remaining_home
        else:
            run = self.away_run
            timeouts_remaining = self.timeouts_remaining_away

        # Get current run
        team_points, opponent_points = run.get_run()

        # Check if opponent is on a run (team scored few/no points)
        is_opponent_run = (opponent_points - team_points) >= self.strategy_params['momentum_threshold']

        if not is_opponent_run:
            return (False, '')

        # Don't call timeout if we don't have enough timeouts remaining
        min_timeouts_needed = self.strategy_params['save_for_endgame'] + 1
        if timeouts_remaining < min_timeouts_needed:
            return (False, '')

        # Check specific run patterns
        currently_losing = (score_differential < 0)

        # 8-0 or 10-0 run
        if (opponent_points >= 8 and team_points == 0):
            if currently_losing and timeouts_remaining >= 3:
                return (True, 'momentum')
            elif timeouts_remaining >= 4:
                return (True, 'momentum')

        # 10-2 or 12-0 run
        if (opponent_points >= 10 and opponent_points - team_points >= 8):
            if currently_losing and timeouts_remaining >= 3:
                return (True, 'momentum')
            elif timeouts_remaining >= 4:
                return (True, 'momentum')

        return (False, '')

    def check_end_game_timeout(
        self,
        team: str,
        quarter: int,
        time_remaining: int,
        score_differential: int,
        team_has_ball: bool
    ) -> Tuple[bool, str]:
        """
        Check if team should call end-game timeout.

        Args:
            team: 'Home' or 'Away'
            quarter: Current quarter (1-4)
            time_remaining: Seconds remaining in quarter
            score_differential: Score difference (positive = team winning)
            team_has_ball: True if team has possession

        Returns:
            (should_call_timeout, reason)
        """
        if quarter != 4:
            return (False, '')

        # BUG FIX: Enforce timeout cooldown to prevent spam
        # Convert quarter time to total game time for comparison
        game_time = (4 - quarter) * 720 + time_remaining
        last_timeout_time = self.last_timeout_time_home if team == 'Home' else self.last_timeout_time_away

        if game_time > last_timeout_time - self.min_timeout_gap_seconds:
            # Too soon since last timeout - don't call another one
            return (False, '')

        # Get timeouts remaining
        if team == 'Home':
            timeouts_remaining = self.timeouts_remaining_home
        else:
            timeouts_remaining = self.timeouts_remaining_away

        if timeouts_remaining == 0:
            return (False, '')

        # Down 3, <30 seconds, have ball → draw up 3PT play
        if -5 <= score_differential <= -3 and time_remaining <= 30 and team_has_ball:
            return (True, 'end_game_3pt_setup')

        # Down 1-2, <10 seconds, have ball → last possession setup
        if -2 <= score_differential <= -1 and time_remaining <= 10 and team_has_ball:
            return (True, 'end_game_final_possession')

        # Losing, <5 seconds, opponent has ball → prevent clock runout
        if score_differential < 0 and time_remaining <= 5 and not team_has_ball:
            return (True, 'end_game_desperation')

        # After opponent score in final minute → advance ball
        # (This requires tracking of "just scored" state - deferred to integration)

        return (False, '')

    def call_timeout(
        self,
        team: str,
        quarter: int,
        game_time: str,
        reason: str,
        scoring_run: Optional[Tuple[int, int]] = None,
        time_remaining: int = 0
    ) -> TimeoutEvent:
        """
        Execute a timeout call.

        Args:
            team: 'Home' or 'Away'
            quarter: Current quarter
            game_time: Game clock string
            reason: Reason for timeout
            scoring_run: Optional (team_points, opponent_points) that triggered timeout
            time_remaining: Seconds remaining in quarter (for cooldown tracking)

        Returns:
            TimeoutEvent

        Side Effects:
            - Decrements timeouts_remaining
            - Resets scoring run trackers
            - Records timeout event
            - Updates last_timeout_time for cooldown tracking
        """
        # Decrement timeouts
        if team == 'Home':
            self.timeouts_remaining_home -= 1
            timeouts_after = self.timeouts_remaining_home
        else:
            self.timeouts_remaining_away -= 1
            timeouts_after = self.timeouts_remaining_away

        # BUG FIX: Update last timeout time for cooldown tracking
        # Convert quarter time to total game time
        total_game_time = (4 - quarter) * 720 + time_remaining
        if team == 'Home':
            self.last_timeout_time_home = total_game_time
        else:
            self.last_timeout_time_away = total_game_time

        # Reset scoring runs (timeout breaks momentum)
        self.home_run.reset()
        self.away_run.reset()

        # Create timeout event
        timeout_event = TimeoutEvent(
            team=team,
            quarter=quarter,
            game_time=game_time,
            reason=reason,
            scoring_run=scoring_run,
            timeouts_remaining_after=timeouts_after
        )

        # Record event
        self.timeout_events.append(timeout_event)

        return timeout_event

    def get_timeouts_remaining(self, team: str) -> int:
        """
        Get timeouts remaining for team.

        Args:
            team: 'Home' or 'Away'

        Returns:
            Number of timeouts remaining
        """
        if team == 'Home':
            return self.timeouts_remaining_home
        else:
            return self.timeouts_remaining_away

    def reset_for_quarter(self, quarter: int) -> None:
        """
        Reset state for new quarter (scoring runs, not timeouts).

        Args:
            quarter: New quarter number (1-4)
        """
        # Reset scoring runs at start of each quarter
        self.home_run.reset()
        self.away_run.reset()

    def get_timeout_summary(self) -> Dict[str, Any]:
        """
        Get summary of timeout usage.

        Returns:
            Dict with timeout statistics
        """
        home_timeouts_used = self.timeouts_per_game - self.timeouts_remaining_home
        away_timeouts_used = self.timeouts_per_game - self.timeouts_remaining_away

        return {
            'home_timeouts_remaining': self.timeouts_remaining_home,
            'away_timeouts_remaining': self.timeouts_remaining_away,
            'home_timeouts_used': home_timeouts_used,
            'away_timeouts_used': away_timeouts_used,
            'total_timeouts': len(self.timeout_events),
            'timeout_events': self.timeout_events,
        }


# =============================================================================
# TIMEOUT EFFECTS
# =============================================================================

def apply_timeout_stamina_recovery(
    stamina_tracker: Any,
    timeout_duration: str = 'full'
) -> None:
    """
    Apply stamina recovery to all players during timeout.

    Args:
        stamina_tracker: StaminaTracker instance
        timeout_duration: 'full' (75s, +5 stamina) or 'short' (20s, +3 stamina)
    """
    recovery_amount = 5 if timeout_duration == 'full' else 3

    # Recover stamina for all players (active and bench)
    for player_name in stamina_tracker.stamina_state.keys():
        current_stamina = stamina_tracker.get_current_stamina(player_name)
        new_stamina = min(100, current_stamina + recovery_amount)
        stamina_tracker.stamina_state[player_name] = new_stamina
