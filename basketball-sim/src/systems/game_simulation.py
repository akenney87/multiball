"""
Basketball Simulator - Full Game Simulation System (M3 Phase 1)

Main orchestrator for complete 48-minute game (4 quarters).

Integrates:
1. QuarterSimulator (from M2) - runs each quarter
2. Halftime stamina recovery
3. Full game statistics aggregation
4. Game-level box score
5. Quarter-to-quarter state management

Main Loop:
1. Initialize game state (rosters, tactical settings)
2. Simulate Quarter 1
3. Simulate Quarter 2
4. Halftime (full stamina recovery)
5. Simulate Quarter 3
6. Simulate Quarter 4
7. Aggregate statistics
8. Generate final box score

Output: GameResult with complete play-by-play, statistics, and final score
"""

from typing import List, Dict, Any
from dataclasses import dataclass, field

from ..core.data_structures import TacticalSettings
from .quarter_simulation import QuarterSimulator, QuarterResult
from .stamina_manager import recover_stamina


# =============================================================================
# GAME RESULT DATA STRUCTURE
# =============================================================================

@dataclass
class GameResult:
    """
    Complete result of a full 48-minute game simulation.

    Attributes:
        home_score: Final home team score
        away_score: Final away team score
        quarter_scores: List of (home, away) scores by quarter
        play_by_play_text: Complete rendered narrative (all 4 quarters)
        game_statistics: Dict with team and player stats
        quarter_results: List of all QuarterResults (for debugging)
        final_stamina: Dict mapping player_name -> final_stamina
        minutes_played: Dict mapping player_name -> total_minutes_played
    """
    home_score: int
    away_score: int
    quarter_scores: List[tuple[int, int]]  # [(Q1_home, Q1_away), ...]
    play_by_play_text: str
    game_statistics: Dict[str, Any]
    quarter_results: List[QuarterResult]
    final_stamina: Dict[str, float]
    minutes_played: Dict[str, float]


# =============================================================================
# GAME SIMULATOR CLASS
# =============================================================================

class GameSimulator:
    """
    Orchestrates complete 48-minute game simulation (4 quarters).

    Main entry point for M3 game simulation.
    """

    def __init__(
        self,
        home_roster: List[Dict[str, Any]],
        away_roster: List[Dict[str, Any]],
        tactical_home: TacticalSettings,
        tactical_away: TacticalSettings,
        home_team_name: str = "Home",
        away_team_name: str = "Away"
    ):
        """
        Initialize game simulator.

        Args:
            home_roster: Full home team roster (5-13 players)
            away_roster: Full away team roster (5-13 players)
            tactical_home: Home team tactical settings
            tactical_away: Away team tactical settings
            home_team_name: Display name for home team
            away_team_name: Display name for away team
        """
        self.home_roster = home_roster
        self.away_roster = away_roster
        self.tactical_home = tactical_home
        self.tactical_away = tactical_away
        self.home_team_name = home_team_name
        self.away_team_name = away_team_name

        # Game state
        self.home_score = 0
        self.away_score = 0
        self.quarter_scores: List[tuple[int, int]] = []
        self.quarter_results: List[QuarterResult] = []

    def simulate_game(self, seed: int = None) -> GameResult:
        """
        Simulate complete 48-minute game (4 quarters).

        Args:
            seed: Random seed for reproducibility (debug mode)

        Returns:
            GameResult with complete outcome and play-by-play

        Flow:
            1. Simulate Quarter 1
            2. Simulate Quarter 2
            3. Halftime (full stamina recovery for all players)
            4. Simulate Quarter 3
            5. Simulate Quarter 4
            6. Aggregate statistics across all quarters
            7. Generate final box score and play-by-play

        Notes:
            - Each quarter is simulated independently using QuarterSimulator
            - Stamina carries over between quarters (except halftime)
            - Minutes played accumulate across quarters
            - Final statistics aggregate all 4 quarters
        """
        # Track cumulative stamina and minutes across quarters
        cumulative_stamina = None  # Will be initialized by Q1
        cumulative_minutes = {p['name']: 0.0 for p in self.home_roster + self.away_roster}

        # LINEUP RESTORATION FIX: Track ending lineups for Q2+ restoration
        cumulative_home_lineup = None  # Will be initialized by Q1
        cumulative_away_lineup = None  # Will be initialized by Q1

        # M3: Initialize timeout manager (persists across all quarters)
        from .timeout_manager import TimeoutManager
        timeout_manager = TimeoutManager(
            timeout_strategy=self.tactical_home.timeout_strategy,
            timeouts_per_game=7
        )

        # M3: Initialize foul system (persists across all quarters)
        # BUG FIX: Personal fouls must be tracked across entire game, not reset per quarter
        from .fouls import FoulSystem
        foul_system = FoulSystem(self.home_roster, self.away_roster)

        # Simulate all 4 quarters
        for quarter_num in range(1, 5):
            # M4.5 PHASE 4 FIX: Apply recovery BEFORE next quarter starts
            # Quarter breaks (after Q1 and Q3): 2:10 recovery
            if quarter_num == 2:  # After Q1, before Q2
                print("\nQuarter break (2:10): Players recovering stamina...")
                cumulative_stamina = self._apply_quarter_break_recovery(cumulative_stamina)
            elif quarter_num == 3:  # After Q2 (halftime), before Q3
                print("\nHalftime (15 min): All players fully recovering stamina...")
                cumulative_stamina = self._apply_halftime_recovery(cumulative_stamina)
            elif quarter_num == 4:  # After Q3, before Q4
                print("\nQuarter break (2:10): Players recovering stamina...")
                cumulative_stamina = self._apply_quarter_break_recovery(cumulative_stamina)

            print(f"\nSimulating Quarter {quarter_num}...")

            # LINEUP RESTORATION FIX: Pass previous quarter's ending lineups (Q2+)
            # Q1 uses default starting lineup selection, Q2+ restores who was on court
            home_starting = cumulative_home_lineup if quarter_num > 1 else None
            away_starting = cumulative_away_lineup if quarter_num > 1 else None

            # Create quarter simulator (pass cumulative scores for Q4 end-game logic)
            quarter_sim = QuarterSimulator(
                home_roster=self.home_roster,
                away_roster=self.away_roster,
                tactical_home=self.tactical_home,
                tactical_away=self.tactical_away,
                home_team_name=self.home_team_name,
                away_team_name=self.away_team_name,
                quarter_number=quarter_num,
                cumulative_home_score=self.home_score,
                cumulative_away_score=self.away_score,
                timeout_manager=None,  # Set below
                foul_system=foul_system,  # BUG FIX: Pass persistent foul system
                home_starting_lineup=home_starting,  # LINEUP RESTORATION FIX
                away_starting_lineup=away_starting   # LINEUP RESTORATION FIX
            )

            # M3: Pass timeout manager to quarter and reset scoring runs
            quarter_sim.timeout_manager = timeout_manager
            timeout_manager.reset_for_quarter(quarter_num)

            # BUG FIX: Reset team fouls for new quarter (personal fouls persist)
            foul_system.reset_team_fouls_for_quarter(quarter_num)

            # Restore stamina from previous quarter (if not Q1)
            # M4.5 PHASE 4: This now includes break recovery applied above
            if quarter_num > 1 and cumulative_stamina is not None:
                self._restore_stamina(quarter_sim.stamina_tracker, cumulative_stamina)

            # Restore minutes from previous quarters
            for player_name, minutes in cumulative_minutes.items():
                quarter_sim.stamina_tracker.minutes_played[player_name] = minutes

            # Simulate quarter
            quarter_result = quarter_sim.simulate_quarter(seed=seed)

            # Store quarter result
            self.quarter_results.append(quarter_result)
            self.quarter_scores.append((quarter_result.home_score, quarter_result.away_score))

            # Update cumulative score
            self.home_score += quarter_result.home_score
            self.away_score += quarter_result.away_score

            # Save stamina state for next quarter
            cumulative_stamina = quarter_result.stamina_final.copy()

            # LINEUP RESTORATION FIX: Save ending lineups for next quarter
            cumulative_home_lineup = quarter_result.home_ending_lineup.copy()
            cumulative_away_lineup = quarter_result.away_ending_lineup.copy()

            # Update cumulative minutes
            for player_name, minutes in quarter_result.minutes_played.items():
                cumulative_minutes[player_name] = minutes

            print(f"Quarter {quarter_num} complete: {self.home_team_name} {self.home_score}, {self.away_team_name} {self.away_score}")

            # M4.5 PHASE 4: Recovery now happens BEFORE next quarter starts (see lines 145-155)

        # Build final game result
        return self._build_game_result(cumulative_stamina, cumulative_minutes)

    def _restore_stamina(
        self,
        stamina_tracker,
        stamina_values: Dict[str, float]
    ) -> None:
        """
        Restore stamina values from previous quarter.

        Args:
            stamina_tracker: StaminaTracker instance for current quarter
            stamina_values: Dict mapping player_name -> stamina (from previous quarter)
        """
        for player_name, stamina in stamina_values.items():
            if player_name in stamina_tracker.stamina_state:
                stamina_tracker.stamina_state[player_name] = stamina

    def _apply_quarter_break_recovery(
        self,
        stamina_values: Dict[str, float]
    ) -> Dict[str, float]:
        """
        Apply stamina recovery during quarter breaks.

        NBA quarter breaks (Q1→Q2, Q3→Q4): 130 seconds = 2.17 minutes
        Uses exponential recovery formula: 8 * (1 - stamina/100) per minute

        Args:
            stamina_values: Current stamina values

        Returns:
            Updated stamina values after 2:10 recovery

        M4.5 PHASE 4: This prevents continuous stamina accumulation across quarters.
        M4.5 PHASE 4B: Recovery rate now varies by player's stamina attribute.
        Example: Player at 60 stamina recovers to ~67 (realistic partial recovery).
        """
        QUARTER_BREAK_MINUTES = 2.17  # 130 seconds

        # M4.5 PHASE 4B: Build player lookup for stamina attributes
        player_lookup = {}
        for player in self.home_roster + self.away_roster:
            player_lookup[player['name']] = player

        recovered = {}
        for player_name, current_stamina in stamina_values.items():
            # Get player's stamina attribute (endurance rating)
            player = player_lookup.get(player_name)
            player_stamina_attr = player.get('stamina', 50) if player else 50

            # Use exponential recovery formula with player's stamina attribute
            recovery = recover_stamina(current_stamina, QUARTER_BREAK_MINUTES, player_stamina_attr)
            new_stamina = min(100.0, current_stamina + recovery)
            recovered[player_name] = new_stamina

        return recovered

    def _apply_halftime_recovery(
        self,
        stamina_values: Dict[str, float]
    ) -> Dict[str, float]:
        """
        Apply full stamina recovery at halftime.

        NBA halftime: 15 minutes (enough for full recovery).

        Args:
            stamina_values: Current stamina values

        Returns:
            Updated stamina values (all players at 100)
        """
        # Full recovery for all players
        return {player_name: 100.0 for player_name in stamina_values.keys()}

    def _build_game_result(
        self,
        final_stamina: Dict[str, float],
        final_minutes: Dict[str, float]
    ) -> GameResult:
        """
        Build final GameResult after all 4 quarters complete.

        Args:
            final_stamina: Final stamina values after Q4
            final_minutes: Total minutes played across all 4 quarters

        Returns:
            GameResult with all data
        """
        # Aggregate play-by-play from all quarters
        play_by_play_sections = []
        play_by_play_sections.append("=" * 80)
        play_by_play_sections.append(f"         FULL GAME - {self.home_team_name} vs {self.away_team_name}         ".center(80))
        play_by_play_sections.append("=" * 80)
        play_by_play_sections.append("")

        for quarter_result in self.quarter_results:
            play_by_play_sections.append(quarter_result.play_by_play_text)
            play_by_play_sections.append("")

        # Add final summary
        play_by_play_sections.append("=" * 80)
        play_by_play_sections.append("                           FULL GAME COMPLETE                           ".center(80))
        play_by_play_sections.append("=" * 80)
        play_by_play_sections.append("")
        play_by_play_sections.append(f"FINAL SCORE: {self.home_team_name} {self.home_score}, {self.away_team_name} {self.away_score}")
        play_by_play_sections.append("")

        # Add quarter-by-quarter scoring
        play_by_play_sections.append("SCORING BY QUARTER:")
        play_by_play_sections.append("-" * 80)
        play_by_play_sections.append(f"{'Team':<20} {'Q1':>6} {'Q2':>6} {'Q3':>6} {'Q4':>6} {'FINAL':>8}")
        play_by_play_sections.append("-" * 80)
        play_by_play_sections.append(
            f"{self.home_team_name:<20} "
            f"{self.quarter_scores[0][0]:>6} "
            f"{self.quarter_scores[1][0]:>6} "
            f"{self.quarter_scores[2][0]:>6} "
            f"{self.quarter_scores[3][0]:>6} "
            f"{self.home_score:>8}"
        )
        play_by_play_sections.append(
            f"{self.away_team_name:<20} "
            f"{self.quarter_scores[0][1]:>6} "
            f"{self.quarter_scores[1][1]:>6} "
            f"{self.quarter_scores[2][1]:>6} "
            f"{self.quarter_scores[3][1]:>6} "
            f"{self.away_score:>8}"
        )
        play_by_play_sections.append("-" * 80)
        play_by_play_sections.append("")

        # Aggregate statistics from all quarters
        game_stats = self._aggregate_quarter_statistics()

        # Add full game box score
        play_by_play_sections.append(self._generate_full_game_box_score(final_minutes))
        play_by_play_sections.append("")

        play_by_play_text = "\n".join(play_by_play_sections)

        return GameResult(
            home_score=self.home_score,
            away_score=self.away_score,
            quarter_scores=self.quarter_scores,
            play_by_play_text=play_by_play_text,
            game_statistics=game_stats,
            quarter_results=self.quarter_results,
            final_stamina=final_stamina,
            minutes_played=final_minutes
        )

    def _aggregate_quarter_statistics(self) -> Dict[str, Any]:
        """
        Aggregate statistics from all quarters into full game stats.

        Returns:
            Dict with home/away team and player statistics
        """
        # Initialize aggregated stats
        # M4 FIX: Add FTM, FTA, STL, BLK, PF tracking
        home_stats = {
            'points': 0,
            'fgm': 0,
            'fga': 0,
            'fg3m': 0,
            'fg3a': 0,
            'ftm': 0,  # M4: Free throws made
            'fta': 0,  # M4: Free throws attempted
            'oreb': 0,
            'dreb': 0,
            'ast': 0,
            'tov': 0,
            'stl': 0,  # M4: Steals
            'blk': 0,  # M4: Blocks
            'pf': 0,   # M4: Personal fouls
        }
        away_stats = home_stats.copy()

        # Aggregate from each quarter
        for quarter_result in self.quarter_results:
            qstats = quarter_result.quarter_statistics

            # Home team - aggregate stats that are already in quarter_statistics
            for key in ['points', 'fgm', 'fga', 'fg3m', 'fg3a', 'oreb', 'dreb', 'ast', 'tov']:
                home_stats[key] += qstats['home_stats'].get(key, 0)

            # Away team - same keys
            for key in ['points', 'fgm', 'fga', 'fg3m', 'fg3a', 'oreb', 'dreb', 'ast', 'tov']:
                away_stats[key] += qstats['away_stats'].get(key, 0)

            # M4 FIX: Aggregate FT, STL, BLK, PF from possession_results
            # M4.5 PHASE 2 FIX: Use offensive_team field instead of roster lookup
            # This fixes bug where teams with identical player names got stats misattributed
            for poss_result in quarter_result.possession_results:
                # M4.5: Get which team was on offense from PossessionResult
                offensive_team = poss_result.offensive_team  # 'home' or 'away'

                # Free throws - attributed to offensive team (they got fouled)
                if poss_result.foul_event and poss_result.foul_event.free_throws_awarded > 0:
                    ft_made = poss_result.debug.get('free_throws_made', 0)
                    ft_attempts = poss_result.foul_event.free_throws_awarded

                    if offensive_team == 'home':
                        home_stats['fta'] += ft_attempts
                        home_stats['ftm'] += ft_made
                    else:
                        away_stats['fta'] += ft_attempts
                        away_stats['ftm'] += ft_made

                # Steals - attributed to defensive team (opposite of offense)
                steal_player = poss_result.debug.get('steal_player')
                if steal_player:
                    if offensive_team == 'home':
                        away_stats['stl'] += 1  # Defense stole from home offense
                    else:
                        home_stats['stl'] += 1  # Defense stole from away offense

                # Blocks - attributed to defensive team (opposite of offense)
                if 'shot_attempt' in poss_result.debug:
                    shot_debug = poss_result.debug['shot_attempt']
                    if shot_debug.get('outcome') == 'blocked_shot':
                        if offensive_team == 'home':
                            away_stats['blk'] += 1  # Defense blocked home offense
                        else:
                            home_stats['blk'] += 1  # Defense blocked away offense

                # Personal fouls - attributed to defensive team (opposite of offense)
                if poss_result.foul_event:
                    if offensive_team == 'home':
                        away_stats['pf'] += 1  # Defense fouled home offense
                    else:
                        home_stats['pf'] += 1  # Defense fouled away offense

        return {
            'home_team': self.home_team_name,
            'away_team': self.away_team_name,
            'home_score': self.home_score,
            'away_score': self.away_score,
            'home_stats': home_stats,
            'away_stats': away_stats,
            'total_possessions': sum(qr.possession_count for qr in self.quarter_results),
        }

    def _generate_full_game_box_score(
        self,
        minutes_played: Dict[str, float]
    ) -> str:
        """
        Generate full game box score for both teams.

        Args:
            minutes_played: Total minutes played across all 4 quarters

        Returns:
            Formatted box score string
        """
        lines = []
        lines.append("FULL GAME BOX SCORE:")
        lines.append("=" * 80)
        lines.append("")

        # Aggregate player stats from all quarters
        player_stats_home = {}
        player_stats_away = {}

        # Initialize all players with zero stats
        for player_name in [p['name'] for p in self.home_roster]:
            player_stats_home[player_name] = {
                'points': 0, 'rebounds': 0, 'assists': 0,
                'turnovers': 0, 'fgm': 0, 'fga': 0,
                'fg3m': 0, 'fg3a': 0,  # USER FIX: Add 3PT tracking
                'ftm': 0, 'fta': 0,    # USER FIX: Add FT tracking
                'steals': 0, 'blocks': 0,  # USER FIX: Add defensive stats
            }

        for player_name in [p['name'] for p in self.away_roster]:
            player_stats_away[player_name] = {
                'points': 0, 'rebounds': 0, 'assists': 0,
                'turnovers': 0, 'fgm': 0, 'fga': 0,
                'fg3m': 0, 'fg3a': 0,  # USER FIX: Add 3PT tracking
                'ftm': 0, 'fta': 0,    # USER FIX: Add FT tracking
                'steals': 0, 'blocks': 0,  # USER FIX: Add defensive stats
            }

        # Aggregate stats from all quarter results
        for quarter_result in self.quarter_results:
            # Access the play_by_play_logger's statistics from the quarter result
            # We need to extract this from the possession_results stored in quarter_result
            # The quarter already has the play-by-play logger which has the statistics

            # Extract from the quarter's play_by_play_text metadata
            # BETTER: Access the quarter statistics that were already computed
            qstats = quarter_result.quarter_statistics

            # We need to access the original play_by_play_logger's player_stats
            # Since we don't store the logger object itself, we need to reconstruct
            # player stats from possession_results

            # For each possession in this quarter, aggregate player contributions
            for poss_result in quarter_result.possession_results:
                # BUG FIX: Use offensive_team to determine which stats dict to update
                # This handles duplicate player names across teams
                offensive_stats = player_stats_home if poss_result.offensive_team == 'home' else player_stats_away

                # Points scored
                if poss_result.scoring_player:
                    # BUG FIX v13: For And-1 with putback, split points between shooters
                    if poss_result.debug.get('and1_with_putback'):
                        # This possession has both And-1 basket points AND putback points
                        # Need to split them correctly between two different shooters
                        and1_shooter = poss_result.debug.get('and1_shooter')
                        putback_shooter = poss_result.debug.get('putback_shooter')
                        shot_type = poss_result.debug.get('shot_type')

                        # Calculate And-1 basket points (2 or 3)
                        and1_basket_points = 3 if shot_type == '3pt' else 2
                        # Putback is always 2 points
                        putback_points = 2

                        # Attribute points to correct players
                        if and1_shooter:
                            offensive_stats[and1_shooter]['points'] += and1_basket_points
                        if putback_shooter:
                            offensive_stats[putback_shooter]['points'] += putback_points
                    else:
                        # Regular possession - all points to scoring_player
                        offensive_stats[poss_result.scoring_player]['points'] += poss_result.points_scored

                # Rebounds (can be offensive or defensive team)
                if poss_result.rebound_player:
                    # Try offensive team first, then defensive
                    if poss_result.rebound_player in offensive_stats:
                        offensive_stats[poss_result.rebound_player]['rebounds'] += 1
                    else:
                        # Defensive rebound - use other team's stats
                        defensive_stats = player_stats_away if poss_result.offensive_team == 'home' else player_stats_home
                        if poss_result.rebound_player in defensive_stats:
                            defensive_stats[poss_result.rebound_player]['rebounds'] += 1

                # Assists
                if poss_result.assist_player:
                    offensive_stats[poss_result.assist_player]['assists'] += 1

                # BUG FIX v7: Handle And-1 situations FIRST (before outcome-specific handling)
                # And-1s can have various outcomes (made_shot, offensive_rebound, foul, etc.)
                # Check for And-1 regardless of outcome
                is_and_one = poss_result.foul_event and poss_result.foul_event.and_one if poss_result.foul_event else False

                if is_and_one:
                    # And-1: made basket + foul + FT attempt
                    # BUG FIX v12: Use 'and1_shooter' if available (for And-1 with putback), else 'shooter'
                    shooter = poss_result.debug.get('and1_shooter') or poss_result.debug.get('shooter')
                    shot_type = poss_result.debug.get('shot_type')

                    if shooter:
                        is_3pt = (shot_type == '3pt')
                        # Add FG stats for the original And-1 basket
                        offensive_stats[shooter]['fga'] += 1
                        offensive_stats[shooter]['fgm'] += 1
                        # Track 3PT for and-1s too
                        if is_3pt:
                            offensive_stats[shooter]['fg3a'] += 1
                            offensive_stats[shooter]['fg3m'] += 1

                    # BUG FIX v12: Check if this is an And-1 with putback (2 FGM total)
                    if poss_result.debug.get('and1_with_putback'):
                        # Putback after And-1 FT miss - count the putback FGM separately
                        putback_shooter = poss_result.debug.get('putback_shooter')
                        if putback_shooter:
                            # Putbacks are always rim shots (2 pts)
                            offensive_stats[putback_shooter]['fga'] += 1
                            offensive_stats[putback_shooter]['fgm'] += 1

                # FG attempts and makes (for non-And-1 shots)
                # Only possessions with made_shot or missed_shot count as FGA (unless And-1)
                elif poss_result.possession_outcome in ['made_shot', 'missed_shot']:
                    # BUG FIX v15: Handle putbacks separately (original shot missed, putback is new FGA)
                    if poss_result.debug.get('ft_putback_made'):
                        # FT putback scenario: only count putback FGM (FTs tracked separately)
                        ft_putback_shooter = poss_result.debug.get('ft_putback_shooter')
                        if ft_putback_shooter:
                            offensive_stats[ft_putback_shooter]['fga'] += 1
                            offensive_stats[ft_putback_shooter]['fgm'] += 1
                    elif poss_result.debug.get('putback_made'):
                        # Regular shot putback scenario: count both original miss AND putback make
                        original_shooter = poss_result.debug.get('original_shooter')
                        original_shot_type = poss_result.debug.get('original_shot_type')
                        putback_shooter = poss_result.debug.get('putback_shooter')

                        # Count original shot as FGA only (it was missed)
                        if original_shooter:
                            is_3pt = (original_shot_type == '3pt')
                            offensive_stats[original_shooter]['fga'] += 1
                            if is_3pt:
                                offensive_stats[original_shooter]['fg3a'] += 1

                        # Count putback as FGA + FGM (it was made, always 2PT rim shot)
                        if putback_shooter:
                            offensive_stats[putback_shooter]['fga'] += 1
                            offensive_stats[putback_shooter]['fgm'] += 1
                    else:
                        # Regular shot (not a putback)
                        shooter = poss_result.debug.get('shooter')
                        shot_type = poss_result.debug.get('shot_type')

                        if shooter:
                            is_made = (poss_result.possession_outcome == 'made_shot')
                            is_3pt = (shot_type == '3pt')

                            # BUG FIX: Use offensive_stats instead of player name lookup
                            offensive_stats[shooter]['fga'] += 1
                            if is_made:
                                offensive_stats[shooter]['fgm'] += 1
                            # USER FIX: Track 3PT attempts and makes separately
                            if is_3pt:
                                offensive_stats[shooter]['fg3a'] += 1
                                if is_made:
                                    offensive_stats[shooter]['fg3m'] += 1

                # USER FIX: Track free throws from all possession outcomes (not just fouls)
                # BUG FIX: Get FT stats from free_throw_result, not debug dict
                if poss_result.free_throw_result:
                    ft_shooter = poss_result.free_throw_result.shooter
                    ft_made = poss_result.free_throw_result.made
                    ft_attempts = poss_result.free_throw_result.attempts

                    # BUG FIX: Use offensive_stats (FTs are by offensive team)
                    # Safety check: ensure player exists in offensive_stats
                    if ft_shooter in offensive_stats:
                        offensive_stats[ft_shooter]['fta'] += ft_attempts
                        offensive_stats[ft_shooter]['ftm'] += ft_made

                # Turnovers (if turnover outcome)
                if poss_result.possession_outcome == 'turnover':
                    # Extract ball handler from debug
                    if 'ball_handler' in poss_result.debug:
                        ball_handler = poss_result.debug['ball_handler']
                        # BUG FIX: Use offensive_stats
                        offensive_stats[ball_handler]['turnovers'] += 1

                    # USER FIX: Track steals (if turnover was a steal)
                    # Check if steal_player exists in debug (means it was a live ball steal)
                    steal_player = poss_result.debug.get('steal_player')
                    if steal_player:
                        # BUG FIX: Steals are by defensive team
                        defensive_stats = player_stats_away if poss_result.offensive_team == 'home' else player_stats_home
                        defensive_stats[steal_player]['steals'] += 1

                # Track blocks (if shot was blocked)
                # Check shot_attempt debug for blocked_shot outcome
                if 'shot_attempt' in poss_result.debug:
                    shot_debug = poss_result.debug['shot_attempt']
                    if shot_debug.get('outcome') == 'blocked_shot':
                        blocking_player = shot_debug.get('blocking_player')
                        if blocking_player:
                            # BUG FIX: Blocks are by defensive team
                            defensive_stats = player_stats_away if poss_result.offensive_team == 'home' else player_stats_home
                            defensive_stats[blocking_player]['blocks'] += 1

        # Aggregate team stats
        game_stats = self._aggregate_quarter_statistics()

        # Home team box score
        lines.append(f"{self.home_team_name}")
        lines.append("-" * 80)
        lines.append(f"{'Player':<20} {'MIN':>4} {'PTS':>4} {'REB':>4} {'AST':>4} {'TO':>3} {'FG':>7} {'FG%':>5} {'3P':>7} {'3P%':>5} {'FT':>7} {'STL':>3} {'BLK':>3}")
        lines.append("-" * 80)

        home_players = sorted(self.home_roster, key=lambda p: minutes_played.get(p['name'], 0.0), reverse=True)
        for player in home_players:
            name = player['name']
            mins = minutes_played.get(name, 0.0)
            stats = player_stats_home[name]

            pts = stats['points']
            reb = stats['rebounds']
            ast = stats['assists']
            to = stats['turnovers']
            fgm = stats['fgm']
            fga = stats['fga']
            fg3m = stats['fg3m']  # USER FIX: Use actual 3PT stats
            fg3a = stats['fg3a']
            ftm = stats['ftm']    # USER FIX: Use actual FT stats
            fta = stats['fta']
            stl = stats['steals']  # USER FIX: Use actual steals
            blk = stats['blocks']  # USER FIX: Use actual blocks

            fg_pct = f"{(fgm/fga*100):.1f}" if fga > 0 else "0.0"
            fg3_pct = f"{(fg3m/fg3a*100):.1f}" if fg3a > 0 else "0.0"

            lines.append(f"{name:<20} {mins:>4.0f} {pts:>4} {reb:>4} {ast:>4} {to:>3} {fgm:>3}/{fga:<3} {fg_pct:>5} {fg3m:>3}/{fg3a:<3} {fg3_pct:>5} {ftm:>3}/{fta:<3} {stl:>3} {blk:>3}")

        lines.append("")

        # Home team totals
        home_stats = game_stats['home_stats']
        fg_pct_home = (home_stats['fgm'] / home_stats['fga'] * 100) if home_stats['fga'] > 0 else 0
        fg3_pct_home = (home_stats['fg3m'] / home_stats['fg3a'] * 100) if home_stats['fg3a'] > 0 else 0
        total_reb_home = home_stats['oreb'] + home_stats['dreb']

        lines.append(f"TEAM: FG: {home_stats['fgm']}/{home_stats['fga']} ({fg_pct_home:.1f}%), "
                    f"3PT: {home_stats['fg3m']}/{home_stats['fg3a']} ({fg3_pct_home:.1f}%), "
                    f"REB: {total_reb_home} ({home_stats['oreb']} off, {home_stats['dreb']} def), "
                    f"AST: {home_stats['ast']}, TO: {home_stats['tov']}")
        lines.append("")
        lines.append("")

        # Away team box score
        lines.append(f"{self.away_team_name}")
        lines.append("-" * 80)
        lines.append(f"{'Player':<20} {'MIN':>4} {'PTS':>4} {'REB':>4} {'AST':>4} {'TO':>3} {'FG':>7} {'FG%':>5} {'3P':>7} {'3P%':>5} {'FT':>7} {'STL':>3} {'BLK':>3}")
        lines.append("-" * 80)

        away_players = sorted(self.away_roster, key=lambda p: minutes_played.get(p['name'], 0.0), reverse=True)
        for player in away_players:
            name = player['name']
            mins = minutes_played.get(name, 0.0)
            stats = player_stats_away[name]

            pts = stats['points']
            reb = stats['rebounds']
            ast = stats['assists']
            to = stats['turnovers']
            fgm = stats['fgm']
            fga = stats['fga']
            fg3m = stats['fg3m']  # USER FIX: Use actual 3PT stats
            fg3a = stats['fg3a']
            ftm = stats['ftm']    # USER FIX: Use actual FT stats
            fta = stats['fta']
            stl = stats['steals']  # USER FIX: Use actual steals
            blk = stats['blocks']  # USER FIX: Use actual blocks

            fg_pct = f"{(fgm/fga*100):.1f}" if fga > 0 else "0.0"
            fg3_pct = f"{(fg3m/fg3a*100):.1f}" if fg3a > 0 else "0.0"

            lines.append(f"{name:<20} {mins:>4.0f} {pts:>4} {reb:>4} {ast:>4} {to:>3} {fgm:>3}/{fga:<3} {fg_pct:>5} {fg3m:>3}/{fg3a:<3} {fg3_pct:>5} {ftm:>3}/{fta:<3} {stl:>3} {blk:>3}")

        lines.append("")

        # Away team totals
        away_stats = game_stats['away_stats']
        fg_pct_away = (away_stats['fgm'] / away_stats['fga'] * 100) if away_stats['fga'] > 0 else 0
        fg3_pct_away = (away_stats['fg3m'] / away_stats['fg3a'] * 100) if away_stats['fg3a'] > 0 else 0
        total_reb_away = away_stats['oreb'] + away_stats['dreb']

        lines.append(f"TEAM: FG: {away_stats['fgm']}/{away_stats['fga']} ({fg_pct_away:.1f}%), "
                    f"3PT: {away_stats['fg3m']}/{away_stats['fg3a']} ({fg3_pct_away:.1f}%), "
                    f"REB: {total_reb_away} ({away_stats['oreb']} off, {away_stats['dreb']} def), "
                    f"AST: {away_stats['ast']}, TO: {away_stats['tov']}")
        lines.append("")

        lines.append("=" * 80)

        return "\n".join(lines)
