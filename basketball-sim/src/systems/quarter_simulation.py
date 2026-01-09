"""
Basketball Simulator - Quarter Simulation System

Main orchestrator for complete 12-minute quarter.

Integrates all M2 systems:
1. Stamina tracking (stamina_manager.py)
2. Substitution logic (substitutions.py)
3. Clock management (game_clock.py)
4. Play-by-play logging (play_by_play.py)
5. Possession simulation (possession.py from M1)

Main Loop:
1. Check substitutions (both teams)
2. Determine possession (alternate)
3. Apply stamina degradation to active players
4. Simulate possession
5. Update score
6. Apply stamina cost
7. Recover bench stamina
8. Log play-by-play
9. Update clock
10. Update minutes played
11. Repeat until quarter ends

Output: QuarterResult with complete play-by-play, statistics, and final state
"""

from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import random

from ..core.data_structures import (
    TacticalSettings,
    PossessionContext,
    PossessionResult
)
from . import possession
from .stamina_manager import StaminaTracker
from .substitutions import (
    SubstitutionManager,
    check_blowout_substitution,
    check_close_game_substitution,
    check_blowout_comeback
)
from .game_clock import GameClock, calculate_possession_duration
from .play_by_play import PlayByPlayLogger
from .timeout_manager import TimeoutManager, apply_timeout_stamina_recovery
from .possession_state import PossessionState, DeadBallReason


# =============================================================================
# QUARTER RESULT DATA STRUCTURE
# =============================================================================

@dataclass
class QuarterResult:
    """
    Complete result of a quarter simulation.

    Attributes:
        home_score: Final home team score
        away_score: Final away team score
        possession_count: Total possessions in quarter
        play_by_play_text: Complete rendered narrative
        quarter_statistics: Dict with team and player stats
        possession_results: List of all PossessionResults (for debugging)
        stamina_final: Dict mapping player_name -> final_stamina
        minutes_played: Dict mapping player_name -> minutes_played
        home_ending_lineup: List of 5 players on court at quarter end (for Q2+ restoration)
        away_ending_lineup: List of 5 players on court at quarter end (for Q2+ restoration)
    """
    home_score: int
    away_score: int
    possession_count: int
    play_by_play_text: str
    quarter_statistics: Dict[str, Any]
    possession_results: List[PossessionResult]
    stamina_final: Dict[str, float]
    minutes_played: Dict[str, float]
    home_ending_lineup: List[Dict[str, Any]]
    away_ending_lineup: List[Dict[str, Any]]


# =============================================================================
# QUARTER SIMULATOR CLASS
# =============================================================================

class QuarterSimulator:
    """
    Orchestrates complete 12-minute quarter simulation.

    Main entry point for M2 quarter simulation.
    """

    def __init__(
        self,
        home_roster: List[Dict[str, Any]],
        away_roster: List[Dict[str, Any]],
        tactical_home: TacticalSettings,
        tactical_away: TacticalSettings,
        home_team_name: str = "Home",
        away_team_name: str = "Away",
        quarter_number: int = 1,
        cumulative_home_score: int = 0,
        cumulative_away_score: int = 0,
        timeout_manager: Any = None,
        foul_system: Any = None,  # BUG FIX: Accept persistent foul system
        home_starting_lineup: Optional[List[Dict[str, Any]]] = None,
        away_starting_lineup: Optional[List[Dict[str, Any]]] = None
    ):
        """
        Initialize quarter simulator.

        Args:
            home_roster: Full home team roster (5-13 players)
            away_roster: Full away team roster (5-13 players)
            tactical_home: Home team tactical settings
            tactical_away: Away team tactical settings
            home_team_name: Display name for home team
            away_team_name: Display name for away team
            quarter_number: Which quarter (1-4)
            cumulative_home_score: Home team's score entering this quarter (for Q4 end-game logic)
            cumulative_away_score: Away team's score entering this quarter (for Q4 end-game logic)
            timeout_manager: Optional TimeoutManager instance (for M3)
            foul_system: Optional FoulSystem instance (for M3, persists across quarters)
            home_starting_lineup: Optional starting lineup for home (Q2+ restoration)
            away_starting_lineup: Optional starting lineup for away (Q2+ restoration)
        """
        # Store settings
        self.home_roster = home_roster
        self.away_roster = away_roster
        self.tactical_home = tactical_home
        self.tactical_away = tactical_away
        self.home_team_name = home_team_name
        self.away_team_name = away_team_name
        self.quarter_number = quarter_number
        self.cumulative_home_score = cumulative_home_score
        self.cumulative_away_score = cumulative_away_score

        # LINEUP RESTORATION FIX: Use provided lineups or select fresh starters
        # Q1: home_starting_lineup=None → select fresh starters based on minutes allocation
        # Q2+: home_starting_lineup provided → restore who was on court at end of previous quarter
        if home_starting_lineup is not None:
            home_starting = home_starting_lineup
        else:
            home_starting = self._select_starting_lineup(home_roster, tactical_home)

        if away_starting_lineup is not None:
            away_starting = away_starting_lineup
        else:
            away_starting = self._select_starting_lineup(away_roster, tactical_away)

        # Initialize subsystems
        self.game_clock = GameClock(quarter_length_minutes=12)
        self.stamina_tracker = StaminaTracker(home_roster + away_roster)
        self.substitution_manager = SubstitutionManager(
            home_roster=home_roster,
            away_roster=away_roster,
            minutes_allocation_home=self._extract_minutes_allocation(tactical_home),
            minutes_allocation_away=self._extract_minutes_allocation(tactical_away),
            home_starting_lineup=home_starting,
            away_starting_lineup=away_starting,
            tactical_home=tactical_home,
            tactical_away=tactical_away
        )

        # M3: Use persistent foul system (created in GameSimulator)
        # BUG FIX: Don't create new FoulSystem - personal fouls must persist across quarters
        if foul_system is None:
            # Fallback for standalone quarter simulation (testing)
            from .fouls import FoulSystem
            self.foul_system = FoulSystem(home_roster, away_roster)
            self.foul_system.reset_team_fouls_for_quarter(quarter_number)
        else:
            self.foul_system = foul_system
            # Team fouls are reset per quarter in GameSimulator

        # M3: Initialize timeout manager (only for Q1, will be passed to subsequent quarters)
        # Use home team's timeout strategy for simplicity
        self.timeout_manager = timeout_manager  # Will be set by game_simulation.py or passed in

        # Game state
        self.home_score = 0
        self.away_score = 0
        self.possession_count = 0
        self.minutes_played = {p['name']: 0.0 for p in home_roster + away_roster}

        # M3: Track previous score differential for comeback detection
        self.previous_score_diff_home = 0

        # M3: Track end-game substitution state (prevent excessive re-triggering)
        self.blowout_subs_made_home = False
        self.blowout_subs_made_away = False

        # Initialize play-by-play logger with reference to minutes_played (updates during quarter)
        # M3 FIX: Pass cumulative scores for proper display across quarters
        self.play_by_play_logger = PlayByPlayLogger(
            home_team_name=home_team_name,
            away_team_name=away_team_name,
            quarter_number=quarter_number,
            minutes_played=self.minutes_played,
            cumulative_home_score=cumulative_home_score,
            cumulative_away_score=cumulative_away_score,
            foul_system=self.foul_system
        )

        # BUG FIX: Initialize player_to_team mapping to handle duplicate player names
        self.play_by_play_logger.initialize_player_team_mapping(home_roster, away_roster)

        # Track all possession results (for debugging)
        self.possession_results: List[PossessionResult] = []

    def simulate_quarter(self, seed: int = None) -> QuarterResult:
        """
        Simulate complete 12-minute quarter.

        Main loop: Run possessions until clock expires.

        Args:
            seed: Random seed for reproducibility (debug mode)

        Returns:
            QuarterResult with complete outcome and play-by-play

        Flow:
            1. Check substitutions (both teams)
            2. Determine possession (alternate)
            3. Apply stamina degradation to active players
            4. Simulate possession (using M1 systems)
            5. Update score
            6. Apply stamina cost to active players
            7. Recover bench stamina
            8. Log play-by-play events
            9. Update clock
            10. Update minutes played
            11. Repeat until quarter ends

        Notes:
            - Possessions alternate (home starts)
            - Final possession: both teams get chance if clock < 30 sec
            - Stamina degradation applied BEFORE each possession
            - Stamina recovery applied AFTER each possession
        """
        if seed is not None:
            random.seed(seed)

        # Track possession ownership (home starts)
        home_has_possession = True
        possession_count = 0

        # M3 POSSESSION STATE: Initialize possession state machine
        # This is the SINGLE SOURCE OF TRUTH for possession tracking and timeout legality
        possession_state = PossessionState(starting_team='home')

        # M3 FIX: Between-quarter substitution window
        # Execute substitutions BEFORE first possession of quarter (Q2-Q4)
        if self.quarter_number > 1:
            possession_state.dead_ball_reason = DeadBallReason.QUARTER_END
            # Substitutions happen before first possession
            if possession_state.can_substitute():
                current_time = self.game_clock.format_time()
                time_remaining = self.game_clock.get_time_remaining()
                sub_events = self.substitution_manager.check_and_execute_substitutions(
                    stamina_tracker=self.stamina_tracker,
                    game_time_str=current_time,
                    time_remaining_in_quarter=time_remaining,
                    quarter_number=self.quarter_number,
                    home_score=self.cumulative_home_score + self.home_score,  # M4.5 PHASE 4: Total game score
                    away_score=self.cumulative_away_score + self.away_score   # M4.5 PHASE 4: Total game score
                )
                for event in sub_events:
                    # BUG FIX: Use event.team instead of player name lookup (handles duplicate names)
                    team_str = 'Home' if event.team == 'home' else 'Away'
                    self.play_by_play_logger.add_substitution(
                        game_clock=self.game_clock.get_time_remaining(),
                        team=team_str,
                        player_out=event.player_out,
                        player_in=event.player_in,
                        reason=event.reason,
                        stamina_out=event.stamina_out
                    )

        # Main quarter loop
        while not self.game_clock.is_quarter_over():
            # M3: STEP 0 (Q4 ONLY): Check end-game substitution conditions
            # NOTE: These are CHECKS only - actual execution happens later during legal dead ball windows
            q4_blowout_home_needed = False
            q4_blowout_away_needed = False
            q4_comeback_detected = False
            q4_closer_insert_needed_home = []
            q4_closer_insert_needed_away = []

            if self.quarter_number == 4:
                time_remaining = self.game_clock.get_time_remaining()
                # Calculate cumulative game score (entering score + current quarter score)
                game_score_home = self.cumulative_home_score + self.home_score
                game_score_away = self.cumulative_away_score + self.away_score
                score_diff_home = game_score_home - game_score_away

                # Check blowout for home team (home winning big)
                blowout_home, blowout_reason_home = check_blowout_substitution(
                    quarter=4,
                    time_remaining_seconds=time_remaining,
                    score_differential=score_diff_home,
                    winning=(score_diff_home > 0)
                )

                # Check blowout for away team (away winning big)
                blowout_away, blowout_reason_away = check_blowout_substitution(
                    quarter=4,
                    time_remaining_seconds=time_remaining,
                    score_differential=-score_diff_home,
                    winning=(score_diff_home < 0)
                )

                # Check comeback (lead shrinking significantly)
                comeback_detected = check_blowout_comeback(
                    previous_differential=self.previous_score_diff_home,
                    current_differential=score_diff_home,
                    time_remaining_seconds=time_remaining
                )

                # Store flags for later execution (during legal dead ball)
                if blowout_home and blowout_reason_home == 'blowout_rest' and not self.blowout_subs_made_home:
                    q4_blowout_home_needed = True

                if blowout_away and blowout_reason_away == 'blowout_rest' and not self.blowout_subs_made_away:
                    q4_blowout_away_needed = True

                if comeback_detected:
                    q4_comeback_detected = True

                # Check close game closers
                if self.tactical_home.closers:
                    for closer_name in self.tactical_home.closers:
                        _, close_reason = check_close_game_substitution(
                            quarter=4,
                            time_remaining_seconds=time_remaining,
                            score_differential=score_diff_home,
                            player={'name': closer_name},
                            is_closer=True
                        )
                        if close_reason == 'close_game_insert_closer':
                            q4_closer_insert_needed_home.append(closer_name)

                if self.tactical_away.closers:
                    for closer_name in self.tactical_away.closers:
                        _, close_reason = check_close_game_substitution(
                            quarter=4,
                            time_remaining_seconds=time_remaining,
                            score_differential=-score_diff_home,
                            player={'name': closer_name},
                            is_closer=True
                        )
                        if close_reason == 'close_game_insert_closer':
                            q4_closer_insert_needed_away.append(closer_name)

                # Update previous score differential for next iteration
                self.previous_score_diff_home = score_diff_home

            # =====================================================================
            # CRITICAL FIX: CHECK TIMEOUTS BEFORE POSSESSION (NOT AFTER)
            # =====================================================================
            # M3: Check for timeouts BEFORE possession simulation
            # This ensures teams can call timeout BEFORE they lose possession
            # Example: Warriors see Lakers on 8-0 run, call timeout BEFORE next possession
            #          NOT: Warriors turn it over, THEN try to call timeout (illegal!)
            timeout_executed = False

            if self.timeout_manager:
                # Get current game time
                time_remaining = self.game_clock.get_time_remaining()

                # Calculate score differentials
                home_score_diff = (self.cumulative_home_score + self.home_score) - (self.cumulative_away_score + self.away_score)
                away_score_diff = -home_score_diff

                # Check momentum timeouts for both teams
                # NOTE: team_just_scored should be False here (we're BEFORE the possession)
                # The scoring run is what matters, not who just scored THIS possession
                should_call_home, reason_home = self.timeout_manager.check_momentum_timeout(
                    team='Home',
                    quarter=self.quarter_number,
                    time_remaining=time_remaining,
                    score_differential=home_score_diff,
                    team_just_scored=False  # We're before possession, so no one "just" scored
                )

                should_call_away, reason_away = self.timeout_manager.check_momentum_timeout(
                    team='Away',
                    quarter=self.quarter_number,
                    time_remaining=time_remaining,
                    score_differential=away_score_diff,
                    team_just_scored=False
                )

                # Check end-game timeouts (Q4 only)
                if self.quarter_number == 4:
                    # Get current possession from PossessionState
                    possession_team = possession_state.get_possession_team()
                    home_has_ball = (possession_team == 'home')
                    away_has_ball = (possession_team == 'away')

                    should_call_endgame_home, reason_endgame_home = self.timeout_manager.check_end_game_timeout(
                        team='Home',
                        quarter=4,
                        time_remaining=time_remaining,
                        score_differential=home_score_diff,
                        team_has_ball=home_has_ball
                    )

                    should_call_endgame_away, reason_endgame_away = self.timeout_manager.check_end_game_timeout(
                        team='Away',
                        quarter=4,
                        time_remaining=time_remaining,
                        score_differential=away_score_diff,
                        team_has_ball=away_has_ball
                    )

                    # Prioritize end-game timeouts over momentum timeouts in Q4
                    if should_call_endgame_home:
                        should_call_home = True
                        reason_home = reason_endgame_home
                    if should_call_endgame_away:
                        should_call_away = True
                        reason_away = reason_endgame_away

                # Execute timeout if triggered (only one team per iteration)
                # Home team timeout check
                if should_call_home and not timeout_executed:
                    # Check if home team can legally call timeout RIGHT NOW
                    if possession_state.can_call_timeout('home'):
                        # LEGAL TIMEOUT: Execute it
                        timeout_event = self.timeout_manager.call_timeout(
                            team='Home',
                            quarter=self.quarter_number,
                            game_time=self.game_clock.format_time(),
                            reason=reason_home,
                            scoring_run=self.timeout_manager.home_run.get_run(),
                            time_remaining=time_remaining
                        )

                        # Apply stamina recovery during timeout
                        apply_timeout_stamina_recovery(self.stamina_tracker, timeout_duration='full')

                        # Log timeout event
                        self.play_by_play_logger.add_timeout(
                            game_clock=time_remaining,
                            team='Home',
                            reason=reason_home,
                            timeouts_remaining=timeout_event.timeouts_remaining_after
                        )

                        # Update possession state after timeout
                        possession_state.update_after_timeout()

                        timeout_executed = True

                # Away team timeout check
                if should_call_away and not timeout_executed:
                    # Check if away team can legally call timeout RIGHT NOW
                    if possession_state.can_call_timeout('away'):
                        # LEGAL TIMEOUT: Execute it
                        timeout_event = self.timeout_manager.call_timeout(
                            team='Away',
                            quarter=self.quarter_number,
                            game_time=self.game_clock.format_time(),
                            reason=reason_away,
                            scoring_run=self.timeout_manager.away_run.get_run(),
                            time_remaining=time_remaining
                        )

                        # Apply stamina recovery during timeout
                        apply_timeout_stamina_recovery(self.stamina_tracker, timeout_duration='full')

                        # Log timeout event
                        self.play_by_play_logger.add_timeout(
                            game_clock=time_remaining,
                            team='Away',
                            reason=reason_away,
                            timeouts_remaining=timeout_event.timeouts_remaining_after
                        )

                        # Update possession state after timeout
                        possession_state.update_after_timeout()

                        timeout_executed = True

            # If timeout was executed, skip possession simulation and continue to next iteration
            if timeout_executed:
                # CRITICAL: Tick the clock for timeout duration
                # NBA full timeout = 75 seconds, 20-second timeout = 20 seconds
                # For simplicity, tick 1 second to prevent infinite loop at same game clock
                # The clock tick prevents the same game moment from repeating
                self.game_clock.tick(1)

                # Start new possession after timeout (ball becomes live)
                possession_state.start_new_possession()
                # Continue to next iteration without simulating possession
                continue

            # =====================================================================
            # CRITICAL: Sync home_has_possession with PossessionState
            # =====================================================================
            # Ensure home_has_possession matches PossessionState before simulating
            # This prevents desync between the two possession tracking variables
            possession_team_state = possession_state.get_possession_team()
            home_has_possession = (possession_team_state == 'home')

            # =====================================================================
            # STEP 1: Check substitutions (both teams)
            # =====================================================================
            # Use PossessionState machine to determine if substitutions are legal
            quarter_start = (possession_count == 0)

            # Check if substitutions are legal using PossessionState
            # Special case: First possession of quarter is always a legal substitution window
            if quarter_start or possession_state.can_substitute():
                allow_substitutions = True
            else:
                allow_substitutions = False

            # Execute substitutions only if legal
            if allow_substitutions:
                # Q4 END-GAME SUBSTITUTIONS: Execute blowout/comeback/closer subs if needed
                if self.quarter_number == 4:
                    time_remaining = self.game_clock.get_time_remaining()

                    # Execute blowout substitutions: Rest starters if blowout
                    if q4_blowout_home_needed:
                        # Home team winning big: rest home starters (only once)
                        home_active = self.substitution_manager.get_home_active()
                        home_bench = self.substitution_manager.get_home_bench()
                        # Simple strategy: sub out highest-minute players for bench players
                        if home_bench and len(home_bench) >= 2:
                            # Sort active by minutes allocation (descending)
                            minutes_alloc = self.tactical_home.minutes_allotment
                            sorted_active = sorted(
                                home_active,
                                key=lambda p: minutes_alloc.get(p['name'], 0),
                                reverse=True
                            )
                            # Sub out top 2 starters
                            subs_made = 0
                            for i in range(min(2, len(home_bench))):
                                player_out = sorted_active[i]
                                player_in = home_bench[i]
                                success = self.substitution_manager.home_lineup_manager.substitute(
                                    player_out, player_in
                                )
                                if success:
                                    self.play_by_play_logger.add_substitution(
                                        game_clock=time_remaining,
                                        team='Home',
                                        player_out=player_out['name'],
                                        player_in=player_in['name'],
                                        reason='blowout_rest',
                                        stamina_out=self.stamina_tracker.get_current_stamina(player_out['name'])
                                    )
                                    subs_made += 1

                            # Mark blowout subs as complete if any were successful
                            if subs_made > 0:
                                self.blowout_subs_made_home = True

                    if q4_blowout_away_needed:
                        # Away team winning big: rest away starters (only once)
                        away_active = self.substitution_manager.get_away_active()
                        away_bench = self.substitution_manager.get_away_bench()
                        if away_bench and len(away_bench) >= 2:
                            minutes_alloc = self.tactical_away.minutes_allotment
                            sorted_active = sorted(
                                away_active,
                                key=lambda p: minutes_alloc.get(p['name'], 0),
                                reverse=True
                            )
                            subs_made = 0
                            for i in range(min(2, len(away_bench))):
                                player_out = sorted_active[i]
                                player_in = away_bench[i]
                                success = self.substitution_manager.away_lineup_manager.substitute(
                                    player_out, player_in
                                )
                                if success:
                                    self.play_by_play_logger.add_substitution(
                                        game_clock=time_remaining,
                                        team='Away',
                                        player_out=player_out['name'],
                                        player_in=player_in['name'],
                                        reason='blowout_rest',
                                        stamina_out=self.stamina_tracker.get_current_stamina(player_out['name'])
                                    )
                                    subs_made += 1

                            # Mark blowout subs as complete if any were successful
                            if subs_made > 0:
                                self.blowout_subs_made_away = True

                    # Execute comeback substitutions: Re-insert starters if comeback detected
                    if q4_comeback_detected:
                        # Reset blowout flags - game is competitive again
                        self.blowout_subs_made_home = False
                        self.blowout_subs_made_away = False
                        # Both teams should re-insert starters
                        # Home team
                        home_active = self.substitution_manager.get_home_active()
                        home_bench = self.substitution_manager.get_home_bench()
                        if home_bench:
                            # Find highest-minutes player on bench
                            minutes_alloc = self.tactical_home.minutes_allotment
                            sorted_bench = sorted(
                                home_bench,
                                key=lambda p: minutes_alloc.get(p['name'], 0),
                                reverse=True
                            )
                            # Find lowest-minutes player on court
                            sorted_active = sorted(
                                home_active,
                                key=lambda p: minutes_alloc.get(p['name'], 0)
                            )
                            # Sub in top bench player for lowest-minute active player
                            if sorted_bench and sorted_active:
                                player_out = sorted_active[0]
                                player_in = sorted_bench[0]
                                success = self.substitution_manager.home_lineup_manager.substitute(
                                    player_out, player_in
                                )
                                if success:
                                    self.play_by_play_logger.add_substitution(
                                        game_clock=time_remaining,
                                        team='Home',
                                        player_out=player_out['name'],
                                        player_in=player_in['name'],
                                        reason='comeback_detected',
                                        stamina_out=self.stamina_tracker.get_current_stamina(player_out['name'])
                                    )

                        # Away team
                        away_active = self.substitution_manager.get_away_active()
                        away_bench = self.substitution_manager.get_away_bench()
                        if away_bench:
                            minutes_alloc = self.tactical_away.minutes_allotment
                            sorted_bench = sorted(
                                away_bench,
                                key=lambda p: minutes_alloc.get(p['name'], 0),
                                reverse=True
                            )
                            sorted_active = sorted(
                                away_active,
                                key=lambda p: minutes_alloc.get(p['name'], 0)
                            )
                            if sorted_bench and sorted_active:
                                player_out = sorted_active[0]
                                player_in = sorted_bench[0]
                                success = self.substitution_manager.away_lineup_manager.substitute(
                                    player_out, player_in
                                )
                                if success:
                                    self.play_by_play_logger.add_substitution(
                                        game_clock=time_remaining,
                                        team='Away',
                                        player_out=player_out['name'],
                                        player_in=player_in['name'],
                                        reason='comeback_detected',
                                        stamina_out=self.stamina_tracker.get_current_stamina(player_out['name'])
                                    )

                    # Execute closer insertions for home team
                    for closer_name in q4_closer_insert_needed_home:
                        home_active = self.substitution_manager.get_home_active()
                        home_bench = self.substitution_manager.get_home_bench()
                        # Find closer player on bench
                        closer_player = None
                        for p in home_bench:
                            if p['name'] == closer_name:
                                closer_player = p
                                break

                        if closer_player:
                            # Insert closer, remove lowest-minute active player
                            minutes_alloc = self.tactical_home.minutes_allotment
                            sorted_active = sorted(
                                home_active,
                                key=lambda p: minutes_alloc.get(p['name'], 0)
                            )
                            if sorted_active:
                                player_out = sorted_active[0]
                                player_in = closer_player
                                success = self.substitution_manager.home_lineup_manager.substitute(
                                    player_out, player_in
                                )
                                if success:
                                    self.play_by_play_logger.add_substitution(
                                        game_clock=time_remaining,
                                        team='Home',
                                        player_out=player_out['name'],
                                        player_in=player_in['name'],
                                        reason='close_game_closer',
                                        stamina_out=self.stamina_tracker.get_current_stamina(player_out['name'])
                                    )
                                    break  # Only insert one closer per check

                    # Execute closer insertions for away team
                    for closer_name in q4_closer_insert_needed_away:
                        away_active = self.substitution_manager.get_away_active()
                        away_bench = self.substitution_manager.get_away_bench()
                        # Find closer player on bench
                        closer_player = None
                        for p in away_bench:
                            if p['name'] == closer_name:
                                closer_player = p
                                break

                        if closer_player:
                            # Insert closer, remove lowest-minute active player
                            minutes_alloc = self.tactical_away.minutes_allotment
                            sorted_active = sorted(
                                away_active,
                                key=lambda p: minutes_alloc.get(p['name'], 0)
                            )
                            if sorted_active:
                                player_out = sorted_active[0]
                                player_in = closer_player
                                success = self.substitution_manager.away_lineup_manager.substitute(
                                    player_out, player_in
                                )
                                if success:
                                    self.play_by_play_logger.add_substitution(
                                        game_clock=time_remaining,
                                        team='Away',
                                        player_out=player_out['name'],
                                        player_in=player_in['name'],
                                        reason='close_game_closer',
                                        stamina_out=self.stamina_tracker.get_current_stamina(player_out['name'])
                                    )
                                    break  # Only insert one closer per check

                # M4.5 PHASE 4 FIX: REMOVED per-possession substitution checks
                # Substitutions now only occur during dead balls (after fouls/FTs, timeouts, quarters)
                # This reduces substitution frequency from 54/team/game to ~15-20/team/game

            # Update active lineups (no longer after substitutions, just refresh)
            home_active = self.substitution_manager.get_home_active()
            away_active = self.substitution_manager.get_away_active()

            # STEP 2: Determine possession (alternate)
            offensive_team = home_active if home_has_possession else away_active
            defensive_team = away_active if home_has_possession else home_active
            offensive_tactical = self.tactical_home if home_has_possession else self.tactical_away
            defensive_tactical = self.tactical_away if home_has_possession else self.tactical_home

            # STEP 3: Apply stamina degradation to active players
            # Get degraded copies of both teams
            from .stamina_manager import get_degraded_team
            degraded_offense = get_degraded_team(offensive_team, self.stamina_tracker)
            degraded_defense = get_degraded_team(defensive_team, self.stamina_tracker)

            # STEP 4: Simulate possession (using M1 systems)
            context = self._build_possession_context(home_has_possession)

            # M3: Determine defending team name for foul tracking
            # BUG FIX: Must use 'Home'/'Away' (not actual team names) to match FoulSystem expectations
            defending_team_name = 'Away' if home_has_possession else 'Home'
            # M4.5 PHASE 2: Determine offensive team for stats attribution ('Home' or 'Away')
            # BUG FIX: Must be capitalized to match FoulSystem expectations
            offensive_team_name = 'Home' if home_has_possession else 'Away'

            # M4.5 PHASE 4 FIX: Use full rosters (not active lineups) for original players
            # This ensures FT shooters use truly original (non-degraded) attributes
            original_offense_roster = self.home_roster if home_has_possession else self.away_roster
            original_defense_roster = self.away_roster if home_has_possession else self.home_roster

            possession_result = possession.simulate_possession(
                offensive_team=degraded_offense,
                defensive_team=degraded_defense,
                tactical_settings_offense=offensive_tactical,
                tactical_settings_defense=defensive_tactical,
                possession_context=context,
                seed=None,  # Already seeded at quarter level
                foul_system=self.foul_system,  # M3: Pass foul system
                quarter=self.quarter_number,
                game_time=self.game_clock.format_time(),
                defending_team_name=defending_team_name,
                offensive_team_name=offensive_team_name,  # M4.5 PHASE 2
                original_offensive_team=original_offense_roster,   # M4.5 PHASE 4: Use full roster
                original_defensive_team=original_defense_roster    # M4.5 PHASE 4: Use full roster
            )

            # STEP 5: Update score
            if home_has_possession:
                self.home_score += possession_result.points_scored
            else:
                self.away_score += possession_result.points_scored

            # M3: Check for foul-outs and trigger automatic substitutions
            if possession_result.foul_event and possession_result.foul_event.fouled_out:
                fouled_out_player_name = possession_result.foul_event.fouling_player
                # Determine which team the fouled-out player is on
                if any(p['name'] == fouled_out_player_name for p in self.home_roster):
                    # Home player fouled out
                    home_bench = self.substitution_manager.get_home_bench()
                    if home_bench:
                        # Find best available substitute
                        sub_in = home_bench[0]  # Simple strategy: take first bench player
                        self.substitution_manager.make_substitution(
                            team='home',
                            player_out_name=fouled_out_player_name,
                            player_in_name=sub_in['name']
                        )
                        # Log substitution
                        self.play_by_play_logger.add_substitution(
                            game_clock=self.game_clock.get_time_remaining(),
                            team='Home',
                            player_out=fouled_out_player_name,
                            player_in=sub_in['name'],
                            reason='foul_out',
                            stamina_out=self.stamina_tracker.get_current_stamina(fouled_out_player_name)
                        )
                else:
                    # Away player fouled out
                    away_bench = self.substitution_manager.get_away_bench()
                    if away_bench:
                        sub_in = away_bench[0]
                        self.substitution_manager.make_substitution(
                            team='away',
                            player_out_name=fouled_out_player_name,
                            player_in_name=sub_in['name']
                        )
                        self.play_by_play_logger.add_substitution(
                            game_clock=self.game_clock.get_time_remaining(),
                            team='Away',
                            player_out=fouled_out_player_name,
                            player_in=sub_in['name'],
                            reason='foul_out',
                            stamina_out=self.stamina_tracker.get_current_stamina(fouled_out_player_name)
                        )

            # STEP 6: Apply stamina cost to active players
            active_players = offensive_team + defensive_team  # All 10 players on court
            scoring_options = [
                offensive_tactical.scoring_option_1,
                offensive_tactical.scoring_option_2,
                offensive_tactical.scoring_option_3
            ]
            scoring_options = [opt for opt in scoring_options if opt is not None]

            self.stamina_tracker.apply_possession_cost(
                active_players=active_players,
                pace=offensive_tactical.pace,
                scoring_options=scoring_options,
                is_transition=context.is_transition
            )

            # STEP 7: Recover bench stamina
            # Calculate possession duration
            # M3 END-GAME FIX: Use explicit elapsed time if set (e.g., intentional foul)
            # Otherwise calculate normal possession duration
            from .game_clock import calculate_possession_duration
            if possession_result.elapsed_time_seconds is not None:
                # BUG FIX: Floor instead of round to prevent ticking more time than actually elapsed
                # Example: 6.59 seconds should tick 6 (not 7), leaving 1 second for final possession
                possession_duration_sec = int(possession_result.elapsed_time_seconds)
            else:
                possession_duration_sec = calculate_possession_duration(
                    pace=offensive_tactical.pace,
                    is_transition=context.is_transition
                )
            possession_duration_min = possession_duration_sec / 60.0

            # Recover home bench
            home_bench = self.substitution_manager.get_home_bench()
            self.stamina_tracker.recover_bench_stamina(home_bench, possession_duration_min)

            # Recover away bench
            away_bench = self.substitution_manager.get_away_bench()
            self.stamina_tracker.recover_bench_stamina(away_bench, possession_duration_min)

            # STEP 8: Log play-by-play events
            offense_team_str = 'Home' if home_has_possession else 'Away'
            self.play_by_play_logger.add_possession(
                game_clock=self.game_clock.get_time_remaining(),
                offense_team=offense_team_str,
                possession_result=possession_result
            )

            # STEP 9: Update clock
            self.game_clock.tick(possession_duration_sec)

            # STEP 10: Update minutes played
            for player in active_players:
                self.stamina_tracker.add_minutes(player['name'], possession_duration_sec)

            # NEW: Update time on court for all active players
            self.substitution_manager.update_time_on_court(
                stamina_tracker=self.stamina_tracker,
                duration_seconds=possession_duration_sec
            )

            # Track possession result for debugging
            self.possession_results.append(possession_result)

            # M3 POSSESSION STATE: Update state after possession outcome
            # This happens AFTER possession but is used for next iteration's timeout checks
            scoring_team_str = 'Home' if home_has_possession else 'Away'
            scoring_team_state = 'home' if home_has_possession else 'away'

            if possession_result.possession_outcome == 'made_shot':
                # Made basket: possession switches to opponent, dead ball
                possession_state.update_after_made_basket(scoring_team_state)
            elif possession_result.possession_outcome == 'missed_shot':
                # BUG FIX: Check if shot went out of bounds (blocked shots)
                # Out of bounds = VIOLATION (dead ball, subs allowed)
                # Rebound = live ball (no subs)
                shot_debug = possession_result.debug.get('shot_attempt', {})
                block_outcome = shot_debug.get('block_outcome', None)

                if block_outcome in ['out_off_shooter', 'out_off_blocker']:
                    # Shot went out of bounds (dead ball violation, subs allowed)
                    # Determine who gets possession based on who it went out off
                    if block_outcome == 'out_off_shooter':
                        possession_team = 'away' if home_has_possession else 'home'  # Defender's ball
                    else:  # out_off_blocker
                        possession_team = 'home' if home_has_possession else 'away'  # Shooter keeps ball

                    possession_state.update_after_out_of_bounds(possession_team)
                else:
                    # Defensive rebound: possession switches, live ball
                    rebounding_team = 'away' if home_has_possession else 'home'
                    possession_state.update_after_defensive_rebound(rebounding_team)
            elif possession_result.possession_outcome == 'offensive_rebound':
                # Offensive rebound: same team keeps possession, live ball
                rebounding_team = 'home' if home_has_possession else 'away'
                possession_state.update_after_offensive_rebound(rebounding_team)
            elif possession_result.possession_outcome == 'turnover':
                # USER FIX: Pass turnover_type and was_stolen to classify turnover correctly
                team_that_got_ball = 'away' if home_has_possession else 'home'
                turnover_type = possession_result.debug.get('turnover_type', 'violation')
                was_stolen = possession_result.debug.get('steal_player') is not None
                possession_state.update_after_turnover(team_that_got_ball, turnover_type, was_stolen)
            elif possession_result.possession_outcome == 'foul':
                # BUG FIX: Non-shooting foul - offensive team retains possession
                # The team that HAD possession when fouled KEEPS possession (or shoots FTs)
                team_with_ball = 'home' if home_has_possession else 'away'
                possession_state.update_after_foul(team_with_ball)

            # M3: Update scoring run trackers (for next iteration's timeout checks)
            if self.timeout_manager:
                self.timeout_manager.update_scoring_run(
                    team='Home',
                    points_scored=possession_result.points_scored,
                    scoring_team=scoring_team_str
                )
                self.timeout_manager.update_scoring_run(
                    team='Away',
                    points_scored=possession_result.points_scored,
                    scoring_team=scoring_team_str
                )

            # Switch possession (unless offensive rebound or non-bonus foul)
            # Update home_has_possession to match PossessionState
            # M3 FIX: 'foul' outcome means non-bonus foul (side-out, offense keeps ball)
            if possession_result.possession_outcome not in ['offensive_rebound', 'foul']:
                home_has_possession = not home_has_possession

            # CHECK FOR MID-QUARTER SUBSTITUTIONS (while ball is still dead)
            # M4.5 PHASE 4: Check at every eligible opportunity (violations, timeouts)
            # per user's rules. NOT after fouls/made baskets (handled by can_substitute())
            # This must happen BEFORE start_new_possession() is called
            if possession_state.can_substitute():
                # Check and execute substitutions for both teams
                if self.substitution_manager:
                    current_time_str = self.game_clock.format_time()
                    time_remaining = self.game_clock.get_time_remaining()  # BUG FIX: Define time_remaining
                    sub_events = self.substitution_manager.check_and_execute_substitutions(
                        stamina_tracker=self.stamina_tracker,
                        game_time_str=current_time_str,
                        time_remaining_in_quarter=time_remaining,
                        quarter_number=self.quarter_number,
                        home_score=self.cumulative_home_score + self.home_score,
                        away_score=self.cumulative_away_score + self.away_score
                    )
                    # Log any substitutions that occurred
                    for event in sub_events:
                        # BUG FIX: Use event.team instead of player name lookup (handles duplicate names)
                        team_str = 'Home' if event.team == 'home' else 'Away'
                        self.play_by_play_logger.add_substitution(
                            game_clock=time_remaining,
                            team=team_str,
                            player_out=event.player_out,
                            player_in=event.player_in,
                            reason=event.reason
                        )

            # Start new possession (ball becomes live after inbound/resume play)
            possession_state.start_new_possession()

            possession_count += 1

            # Safety: prevent infinite loops
            if possession_count > 100:
                break

        # Build final result
        return self._build_quarter_result()

    def _select_starting_lineup(
        self,
        roster: List[Dict[str, Any]],
        tactical_settings: TacticalSettings
    ) -> List[Dict[str, Any]]:
        """
        Select starting lineup (5 players) from roster.

        Heuristic: Choose players with highest minutes allocation.

        Args:
            roster: Full team roster
            tactical_settings: Tactical settings with minutes_allotment

        Returns:
            List of 5 starting players
        """
        # Get minutes allocation
        minutes_allotment = tactical_settings.minutes_allotment

        # Sort roster by minutes allocation (descending)
        # Players not in allocation get 0 minutes
        sorted_roster = sorted(
            roster,
            key=lambda p: minutes_allotment.get(p['name'], 0),
            reverse=True
        )

        # Return top 5
        return sorted_roster[:5]

    def _extract_minutes_allocation(
        self,
        tactical_settings: TacticalSettings
    ) -> Dict[str, float]:
        """
        Extract per-quarter minutes allocation from tactical settings.

        Full-game allocation is 240 total (48 per player max).
        Per-quarter allocation is 60 total (12 per player max).

        Args:
            tactical_settings: Tactical settings with minutes_allotment

        Returns:
            Dict mapping player_name -> minutes_for_quarter (allocation / 4)
        """
        # Divide minutes_allotment by 4 for quarter allocation
        quarter_allocation = {}
        for player_name, total_minutes in tactical_settings.minutes_allotment.items():
            quarter_allocation[player_name] = total_minutes / 4.0

        return quarter_allocation

    def _build_possession_context(self, home_has_possession: bool) -> PossessionContext:
        """
        Build PossessionContext for current possession.

        Args:
            home_has_possession: True if home team has the ball

        Returns:
            PossessionContext with:
            - is_transition: False for M2 (transition detection future work)
            - shot_clock: 24 (or 14 if offensive rebound)
            - score_differential: home_score - away_score (if offense is home)
            - game_time_remaining: self.game_clock.get_time_remaining()
        """
        # Calculate score differential from offense perspective
        # M3 END-GAME FIX: Use cumulative game score, not just quarter score
        cumulative_home = self.cumulative_home_score + self.home_score
        cumulative_away = self.cumulative_away_score + self.away_score

        if home_has_possession:
            score_diff = cumulative_home - cumulative_away
        else:
            score_diff = cumulative_away - cumulative_home

        return PossessionContext(
            is_transition=False,  # Transition detection future work
            shot_clock=24,  # TODO M3: track shot clock resets for OREB
            score_differential=score_diff,
            game_time_remaining=self.game_clock.get_time_remaining(),
            quarter=self.quarter_number,  # M3 End-game: Need quarter for mode detection
            offensive_team='home' if home_has_possession else 'away'  # M3 End-game: Track possession
        )

    def _get_bench_players(self, team: str) -> List[Dict[str, Any]]:
        """
        Get bench players for a team.

        Args:
            team: 'Home' or 'Away'

        Returns:
            List of players not in active lineup
        """
        if team == 'Home':
            return self.substitution_manager.get_home_bench()
        else:
            return self.substitution_manager.get_away_bench()

    def _build_quarter_result(self) -> QuarterResult:
        """
        Build final QuarterResult after quarter completes.

        Returns:
            QuarterResult with all data
        """
        # BUG FIX: Update minutes_played dict from stamina_tracker BEFORE rendering
        # This ensures the box score shows correct minutes instead of zeros
        for player in self.home_roster + self.away_roster:
            self.minutes_played[player['name']] = self.stamina_tracker.get_minutes_played(player['name'])

        # Render play-by-play to text
        play_by_play_text = self.play_by_play_logger.render_to_text()

        # Get final stamina values
        stamina_final = self.stamina_tracker.get_all_stamina_values()

        # Get minutes played (already updated above)
        minutes_played = self.minutes_played

        # LINEUP RESTORATION FIX: Capture ending lineups for next quarter
        home_ending_lineup = self.substitution_manager.get_home_active()
        away_ending_lineup = self.substitution_manager.get_away_active()

        # Build quarter statistics (from play-by-play logger)
        quarter_stats = {
            'home_team': self.home_team_name,
            'away_team': self.away_team_name,
            'home_score': self.home_score,
            'away_score': self.away_score,
            'possession_count': len(self.possession_results),
            'substitution_count': len(self.play_by_play_logger.substitution_events),
            'home_stats': self.play_by_play_logger.statistics.team_stats['Home'],
            'away_stats': self.play_by_play_logger.statistics.team_stats['Away'],
        }

        return QuarterResult(
            home_score=self.home_score,
            away_score=self.away_score,
            possession_count=len(self.possession_results),
            play_by_play_text=play_by_play_text,
            quarter_statistics=quarter_stats,
            possession_results=self.possession_results,
            stamina_final=stamina_final,
            minutes_played=minutes_played,
            home_ending_lineup=home_ending_lineup,
            away_ending_lineup=away_ending_lineup
        )
