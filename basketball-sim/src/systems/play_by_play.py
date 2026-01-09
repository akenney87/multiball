"""
Basketball Simulator - Play-by-Play Log System

Generates complete quarter narrative with:
1. Possession-by-possession play-by-play
2. Substitution events with timestamps
3. Score progression tracking
4. Quarter summary statistics
5. Readable text output to file

This is a CRITICAL M2 component requiring USER SIGN-OFF.

Output Format:
==================================================
1ST QUARTER - HOME vs AWAY
==================================================

[11:45] Home possession (Score: 0-0)
Stephen Curry attempts a 3-pointer. Contested by Kawhi Leonard (3.2 ft).
CURRY MAKES IT! +3
Assist: Draymond Green
Score: 3-0

[10:32] Substitution: Kyle Lowry OUT (stamina: 58) → Bench Player X IN

... (continue for ~25 possessions) ...

==================================================
1ST QUARTER COMPLETE
==================================================

FINAL SCORE: HOME 30, AWAY 26

QUARTER STATISTICS:
Home Team: FG 12/24 (50%), 3PT 4/10 (40%), REB 8, TO 2
Leading Scorer: Stephen Curry (9 pts)
"""

from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass, field
from collections import defaultdict
import os


# =============================================================================
# EVENT DATA STRUCTURES
# =============================================================================

@dataclass
class PossessionEvent:
    """
    Structured event for a single possession.

    Attributes:
        game_clock: Time remaining in quarter (seconds)
        offense_team: 'Home' or 'Away'
        score_before: Tuple of (home_score, away_score) before possession
        play_by_play_text: Narrative text from possession.simulate_possession()
        points_scored: Points scored this possession (0, 2, or 3)
        outcome: 'made_shot', 'missed_shot', 'turnover'
        scoring_player: Name of scorer (if made shot)
        shooter: Name of player who took the shot (for both makes and misses) [BUG FIX v2]
        assist_player: Name of assister (if assist occurred)
        rebound_player: Name of rebounder (if missed shot)
        shot_type: Type of shot ('3pt', 'midrange', 'rim', 'dunk', 'layup')
        is_offensive_rebound: Whether miss resulted in offensive rebound
        is_and_one: Whether this is an And-1 (made shot + foul) [BUG FIX v4]
    """
    game_clock: int
    offense_team: str
    score_before: Tuple[int, int]
    play_by_play_text: str
    points_scored: int
    outcome: str
    scoring_player: Optional[str] = None
    shooter: Optional[str] = None  # BUG FIX v2: Track shooter for FGA on misses
    assist_player: Optional[str] = None
    rebound_player: Optional[str] = None
    shot_type: Optional[str] = None
    is_offensive_rebound: bool = False
    is_and_one: bool = False  # BUG FIX v4: Track And-1 situations for FG% tracking


@dataclass
class SubstitutionEvent:
    """
    Structured event for a substitution.

    Attributes:
        game_clock: Time remaining when sub occurred
        team: 'Home' or 'Away'
        player_out: Name of player exiting
        player_in: Name of player entering
        reason: Reason for substitution ('low_stamina', 'minutes_allocation', 'injury')
        stamina_out: Stamina value of exiting player (optional)
    """
    game_clock: int
    team: str
    player_out: str
    player_in: str
    reason: str
    stamina_out: Optional[float] = None


@dataclass
class TimeoutEvent:
    """
    Structured event for a timeout (M3 Phase 2c).

    Attributes:
        game_clock: Time remaining when timeout was called
        team: 'Home' or 'Away'
        reason: Reason for timeout ('momentum', 'end_game_3pt_setup', etc.)
        timeouts_remaining: Timeouts remaining after this timeout
    """
    game_clock: int
    team: str
    reason: str
    timeouts_remaining: int


# =============================================================================
# QUARTER STATISTICS
# =============================================================================

class QuarterStatistics:
    """
    Aggregate statistics for a quarter.

    Tracks team-level and player-level stats for summary.
    """

    def __init__(self, home_team_name: str, away_team_name: str):
        """
        Initialize statistics tracker.

        Args:
            home_team_name: Name of home team
            away_team_name: Name of away team
        """
        self.home_team_name = home_team_name
        self.away_team_name = away_team_name

        # Team-level stats
        self.team_stats = {
            'Home': {
                'points': 0,
                'fgm': 0,
                'fga': 0,
                'fg3m': 0,
                'fg3a': 0,
                'oreb': 0,
                'dreb': 0,
                'ast': 0,
                'tov': 0
            },
            'Away': {
                'points': 0,
                'fgm': 0,
                'fga': 0,
                'fg3m': 0,
                'fg3a': 0,
                'oreb': 0,
                'dreb': 0,
                'ast': 0,
                'tov': 0
            }
        }

        # Player-level stats
        self.player_stats = defaultdict(lambda: {
            'points': 0,
            'rebounds': 0,
            'assists': 0,
            'turnovers': 0,
            'fgm': 0,
            'fga': 0
        })

        # Player-to-team mapping (to track which player belongs to which team)
        self.player_to_team: Dict[str, str] = {}

    def add_possession_result(
        self,
        offense_team: str,
        possession_event: PossessionEvent
    ) -> None:
        """
        Update statistics from a possession event.

        Args:
            offense_team: 'Home' or 'Away'
            possession_event: PossessionEvent with complete possession data
        """
        defense_team = 'Away' if offense_team == 'Home' else 'Home'

        # Update based on outcome
        if possession_event.outcome == 'turnover':
            self.team_stats[offense_team]['tov'] += 1
            # No player turnover stat update needed for play-by-play context

        elif possession_event.outcome == 'offensive_rebound':
            # Offensive rebound + kickout scenario
            # Count the offensive rebound for the team and player
            if possession_event.rebound_player:
                self.player_stats[possession_event.rebound_player]['rebounds'] += 1
                self.team_stats[offense_team]['oreb'] += 1
                # Track player-to-team mapping
                self.player_to_team[possession_event.rebound_player] = offense_team

        # BUG FIX v6: Handle And-1 situations (can have any outcome)
        # And-1s can have various outcomes (made_shot, offensive_rebound, etc.)
        # We need to add FG stats for the made basket AND points
        # This runs IN ADDITION TO the outcome-specific handlers below
        if possession_event.is_and_one:
            shot_type = possession_event.shot_type or 'midrange'

            # Add points (basket + any FTs made)
            if possession_event.points_scored > 0:
                self.team_stats[offense_team]['points'] += possession_event.points_scored

                if possession_event.shooter:
                    self.player_stats[possession_event.shooter]['points'] += possession_event.points_scored
                    # Track player-to-team mapping
                    self.player_to_team[possession_event.shooter] = offense_team

            # Team FG stats for the made basket
            self.team_stats[offense_team]['fga'] += 1
            self.team_stats[offense_team]['fgm'] += 1

            # 3PT stats
            if shot_type == '3pt':
                self.team_stats[offense_team]['fg3a'] += 1
                self.team_stats[offense_team]['fg3m'] += 1

            # Player FG stats
            if possession_event.shooter:
                self.player_stats[possession_event.shooter]['fga'] += 1
                self.player_stats[possession_event.shooter]['fgm'] += 1
                # Track player-to-team mapping
                self.player_to_team[possession_event.shooter] = offense_team

        # Process outcome-specific stats (runs for all possessions including And-1s)
        # NOTE: For And-1s, points and FG stats are handled above, but we still need rebounds, etc.
        if possession_event.outcome == 'foul':
            # Foul outcome - includes free throw points
            # For non-And-1 fouls, add points here. For And-1s, skip (already added above)
            if not possession_event.is_and_one and possession_event.points_scored > 0:
                self.team_stats[offense_team]['points'] += possession_event.points_scored

                # Player scoring (from free throws)
                if possession_event.scoring_player:
                    self.player_stats[possession_event.scoring_player]['points'] += possession_event.points_scored
                    # Track player-to-team mapping
                    self.player_to_team[possession_event.scoring_player] = offense_team

            # Handle rebounds from missed free throws
            if possession_event.rebound_player:
                self.player_stats[possession_event.rebound_player]['rebounds'] += 1

                if possession_event.is_offensive_rebound:
                    self.team_stats[offense_team]['oreb'] += 1
                    self.player_to_team[possession_event.rebound_player] = offense_team
                else:
                    self.team_stats[defense_team]['dreb'] += 1
                    self.player_to_team[possession_event.rebound_player] = defense_team

        if possession_event.outcome in ['made_shot', 'missed_shot']:
            # Shot attempt
            # For And-1s, FG stats and points are already added above, skip here
            if not possession_event.is_and_one:
                shot_type = possession_event.shot_type or 'midrange'

                # Field goal attempt
                self.team_stats[offense_team]['fga'] += 1

                # 3PT attempt
                if shot_type == '3pt':
                    self.team_stats[offense_team]['fg3a'] += 1

                # Made shot
                if possession_event.outcome == 'made_shot':
                    self.team_stats[offense_team]['fgm'] += 1
                    self.team_stats[offense_team]['points'] += possession_event.points_scored

                    if shot_type == '3pt':
                        self.team_stats[offense_team]['fg3m'] += 1

                    # Player scoring
                    if possession_event.scoring_player:
                        self.player_stats[possession_event.scoring_player]['points'] += possession_event.points_scored
                        self.player_stats[possession_event.scoring_player]['fgm'] += 1
                        # Track player-to-team mapping
                        self.player_to_team[possession_event.scoring_player] = offense_team

                    # BUG FIX v2: Track FGA using shooter field (set on both makes and misses)
                    if possession_event.shooter:
                        self.player_stats[possession_event.shooter]['fga'] += 1
                        # Track player-to-team mapping
                        self.player_to_team[possession_event.shooter] = offense_team

                else:  # Missed shot (non-And-1)
                    # BUG FIX v2: Track FGA for the shooter even on missed shots
                    if possession_event.shooter:
                        self.player_stats[possession_event.shooter]['fga'] += 1
                        # Track player-to-team mapping
                        self.player_to_team[possession_event.shooter] = offense_team

            # Assists and rebounds still apply for And-1s
            if possession_event.outcome == 'made_shot':
                # Assist
                if possession_event.assist_player:
                    self.team_stats[offense_team]['ast'] += 1
                    self.player_stats[possession_event.assist_player]['assists'] += 1
                    # Track player-to-team mapping
                    self.player_to_team[possession_event.assist_player] = offense_team

                # Offensive rebound (for made putbacks)
                # If rebound_player is set and it was an offensive rebound, count it
                if possession_event.rebound_player and possession_event.is_offensive_rebound:
                    self.player_stats[possession_event.rebound_player]['rebounds'] += 1
                    self.team_stats[offense_team]['oreb'] += 1
                    # Track player-to-team mapping
                    self.player_to_team[possession_event.rebound_player] = offense_team

            elif possession_event.outcome == 'missed_shot':
                # BUG FIX: Missed putback after made free throws (or missed And-1 FT)
                # When FTs are made but putback is missed, outcome='missed_shot' but points_scored > 0
                # For And-1s, points already added above, skip here
                if not possession_event.is_and_one and possession_event.points_scored > 0:
                    self.team_stats[offense_team]['points'] += possession_event.points_scored

                    # Player scoring (from free throws before the missed putback)
                    if possession_event.scoring_player:
                        self.player_stats[possession_event.scoring_player]['points'] += possession_event.points_scored

                # Rebound
                if possession_event.rebound_player:
                    self.player_stats[possession_event.rebound_player]['rebounds'] += 1

                    if possession_event.is_offensive_rebound:
                        self.team_stats[offense_team]['oreb'] += 1
                        # Track player-to-team mapping (offensive rebounder is on offense team)
                        self.player_to_team[possession_event.rebound_player] = offense_team
                    else:
                        self.team_stats[defense_team]['dreb'] += 1
                        # Track player-to-team mapping (defensive rebounder is on defense team)
                        self.player_to_team[possession_event.rebound_player] = defense_team

    def get_team_summary(self, team: str) -> str:
        """
        Generate team summary text.

        Args:
            team: 'Home' or 'Away'

        Returns:
            Formatted string with team statistics

        Example:
            "FG: 12/24 (50.0%), 3PT: 4/10 (40.0%), REB: 8 (2 off, 6 def), AST: 7, TO: 2"
        """
        stats = self.team_stats[team]

        # Calculate percentages
        fg_pct = (stats['fgm'] / stats['fga'] * 100) if stats['fga'] > 0 else 0
        fg3_pct = (stats['fg3m'] / stats['fg3a'] * 100) if stats['fg3a'] > 0 else 0

        total_reb = stats['oreb'] + stats['dreb']

        return (
            f"FG: {stats['fgm']}/{stats['fga']} ({fg_pct:.1f}%), "
            f"3PT: {stats['fg3m']}/{stats['fg3a']} ({fg3_pct:.1f}%), "
            f"REB: {total_reb} ({stats['oreb']} off, {stats['dreb']} def), "
            f"AST: {stats['ast']}, TO: {stats['tov']}"
        )

    def get_top_performers(self, team: str, stat: str, top_n: int = 3) -> List[Tuple[str, int]]:
        """
        Get top N performers for a given stat, filtered by team.

        Args:
            team: 'Home' or 'Away' - only players from this team will be returned
            stat: 'points', 'rebounds', or 'assists'
            top_n: Number of top performers to return

        Returns:
            List of (player_name, stat_value) tuples, sorted descending
        """
        # Filter players with non-zero stat from the specified team
        players_with_stat = [
            (player, stats[stat])
            for player, stats in self.player_stats.items()
            if stats[stat] > 0 and self.player_to_team.get(player) == team
        ]

        # Sort by stat value descending
        players_with_stat.sort(key=lambda x: x[1], reverse=True)

        return players_with_stat[:top_n]

    def get_leading_scorer(self, team: str) -> Tuple[str, int]:
        """
        Get leading scorer for a team.

        Args:
            team: 'Home' or 'Away'

        Returns:
            Tuple of (player_name, points) or (None, 0) if no scorers
        """
        scorers = self.get_top_performers(team, 'points', top_n=1)
        return scorers[0] if scorers else (None, 0)

    def get_leading_rebounder(self, team: str) -> Tuple[str, int]:
        """
        Get leading rebounder for a team.

        Args:
            team: 'Home' or 'Away'

        Returns:
            Tuple of (player_name, rebounds) or (None, 0) if no rebounders
        """
        rebounders = self.get_top_performers(team, 'rebounds', top_n=1)
        return rebounders[0] if rebounders else (None, 0)


# =============================================================================
# PLAY-BY-PLAY LOGGER
# =============================================================================

class PlayByPlayLogger:
    """
    Accumulates and formats play-by-play narrative for entire quarter.

    Main interface for quarter simulation to log events.
    """

    def __init__(
        self,
        home_team_name: str,
        away_team_name: str,
        quarter_number: int = 1,
        minutes_played: Optional[Dict[str, float]] = None,
        cumulative_home_score: int = 0,
        cumulative_away_score: int = 0,
        foul_system: Optional[Any] = None
    ):
        """
        Initialize play-by-play logger.

        Args:
            home_team_name: Name of home team
            away_team_name: Name of away team
            quarter_number: Which quarter (1-4)
            minutes_played: Dict of player_name -> minutes (updated during quarter)
            cumulative_home_score: Score entering this quarter (for display)
            cumulative_away_score: Score entering this quarter (for display)
            foul_system: FoulSystem instance for displaying team fouls (M3 Issue #8)
        """
        self.home_team_name = home_team_name
        self.away_team_name = away_team_name
        self.quarter_number = quarter_number
        self.minutes_played = minutes_played if minutes_played is not None else {}
        self.foul_system = foul_system  # M3 Issue #8: Track foul system reference

        self.possession_events: List[PossessionEvent] = []
        self.substitution_events: List[SubstitutionEvent] = []
        self.timeout_events: List[TimeoutEvent] = []  # M3 Phase 2c

        self.statistics = QuarterStatistics(home_team_name, away_team_name)

        # M3 FIX: Track cumulative score for proper display across quarters
        # Current score tracking (quarter-level for internal tracking)
        self.home_score = 0
        self.away_score = 0
        # Cumulative score (game-level for display)
        self.cumulative_home_score = cumulative_home_score
        self.cumulative_away_score = cumulative_away_score

    def initialize_player_team_mapping(self, home_roster: List[Dict], away_roster: List[Dict]) -> None:
        """
        BUG FIX: Pre-populate player_to_team mapping from rosters to handle duplicate player names.

        Args:
            home_roster: List of home team players
            away_roster: List of away team players
        """
        for player in home_roster:
            self.statistics.player_to_team[player['name']] = 'Home'
        for player in away_roster:
            self.statistics.player_to_team[player['name']] = 'Away'

    def add_possession(
        self,
        game_clock: int,
        offense_team: str,
        possession_result: Any  # PossessionResult
    ) -> None:
        """
        Add a possession event to the log.

        Args:
            game_clock: Seconds remaining when possession started
            offense_team: 'Home' or 'Away'
            possession_result: PossessionResult from possession.simulate_possession()
        """
        # M3 FIX: Use cumulative score for display (includes previous quarters)
        # Capture current GAME score before possession (cumulative + quarter)
        score_before = (
            self.cumulative_home_score + self.home_score,
            self.cumulative_away_score + self.away_score
        )

        # Extract shot type from debug info
        shot_type = None
        is_offensive_rebound = False

        if 'shot_type' in possession_result.debug:
            shot_type = possession_result.debug['shot_type']

        # Check for offensive rebound
        if 'rebound' in possession_result.debug:
            rebound_info = possession_result.debug['rebound']
            is_offensive_rebound = rebound_info.get('offensive_rebound', False)

        # BUG FIX v3: Prioritize scoring_player (correct for putbacks), fallback to debug['shooter']
        # On putbacks, scoring_player = rebounder (correct), but debug['shooter'] = original shooter (wrong)
        shooter = possession_result.scoring_player or possession_result.debug.get('shooter')

        # BUG FIX v4: Check for And-1 situations (made shot + foul)
        is_and_one = False
        if possession_result.foul_event and hasattr(possession_result.foul_event, 'and_one'):
            is_and_one = possession_result.foul_event.and_one

        event = PossessionEvent(
            game_clock=game_clock,
            offense_team=offense_team,
            score_before=score_before,
            play_by_play_text=possession_result.play_by_play_text,
            points_scored=possession_result.points_scored,
            outcome=possession_result.possession_outcome,
            scoring_player=possession_result.scoring_player,
            shooter=shooter,  # BUG FIX v2: Always track who took the shot
            assist_player=possession_result.assist_player,
            rebound_player=possession_result.rebound_player,
            shot_type=shot_type,
            is_offensive_rebound=is_offensive_rebound,
            is_and_one=is_and_one  # BUG FIX v4: Track And-1 for FG% tracking
        )

        # Update score
        if offense_team == 'Home':
            self.home_score += possession_result.points_scored
        else:
            self.away_score += possession_result.points_scored

        # Add to event log
        self.possession_events.append(event)

        # Update statistics
        self.statistics.add_possession_result(offense_team, event)

    def add_substitution(
        self,
        game_clock: int,
        team: str,
        player_out: str,
        player_in: str,
        reason: str,
        stamina_out: Optional[float] = None
    ) -> None:
        """
        Add a substitution event to the log.

        Args:
            game_clock: Seconds remaining when sub occurred
            team: 'Home' or 'Away'
            player_out: Name of player exiting
            player_in: Name of player entering
            reason: Reason code ('low_stamina', 'minutes_allocation', 'injury')
            stamina_out: Stamina of exiting player (optional)
        """
        event = SubstitutionEvent(
            game_clock=game_clock,
            team=team,
            player_out=player_out,
            player_in=player_in,
            reason=reason,
            stamina_out=stamina_out
        )

        self.substitution_events.append(event)

    def add_timeout(
        self,
        game_clock: int,
        team: str,
        reason: str,
        timeouts_remaining: int
    ) -> None:
        """
        Add a timeout event to the log (M3 Phase 2c).

        Args:
            game_clock: Seconds remaining when timeout was called
            team: 'Home' or 'Away'
            reason: Reason for timeout ('momentum', 'end_game_3pt_setup', etc.)
            timeouts_remaining: Timeouts remaining after this timeout
        """
        event = TimeoutEvent(
            game_clock=game_clock,
            team=team,
            reason=reason,
            timeouts_remaining=timeouts_remaining
        )

        self.timeout_events.append(event)

    def render_to_text(self) -> str:
        """
        Render complete quarter narrative to text.

        Combines possession events, substitution events, and quarter summary
        into a single readable narrative.

        Returns:
            Multi-line string with complete play-by-play

        Format:
            1. Header (quarter number, teams)
            2. Chronological events (possessions + substitutions interleaved)
            3. Quarter complete banner
            4. Final score
            5. Quarter statistics (both teams)
        """
        lines = []

        # Header
        quarter_ordinals = {1: '1ST', 2: '2ND', 3: '3RD', 4: '4TH'}
        quarter_text = quarter_ordinals.get(self.quarter_number, f'{self.quarter_number}TH')

        lines.append("=" * 80)
        lines.append(f"{quarter_text} QUARTER - {self.home_team_name} vs {self.away_team_name}".center(80))
        lines.append("=" * 80)
        lines.append("")

        # Sort all events by game clock (descending = chronological)
        # USER FIX: Add type priority with special handling for quarter-start vs mid-quarter subs
        all_events = []

        # Event type priorities (lower number = earlier in output at same timestamp)
        # QUARTER-START SUBS (at 12:00): priority 0 (appear BEFORE first possession)
        # Mid-quarter subs: priority 3 (appear AFTER possession/violation)
        # Timeouts: priority 1
        # Possessions: priority 2

        for poss in self.possession_events:
            all_events.append(('possession', poss.game_clock, 2, poss))

        for sub in self.substitution_events:
            # Check if this is a quarter-start substitution (at exactly 12:00 = 720 seconds)
            if sub.game_clock == 720:
                # Quarter-start: appear BEFORE first possession
                priority = 0
            else:
                # Mid-quarter: appear AFTER possession (which includes violations)
                priority = 3
            all_events.append(('substitution', sub.game_clock, priority, sub))

        for timeout in self.timeout_events:
            all_events.append(('timeout', timeout.game_clock, 1, timeout))

        # Sort by game clock descending (12:00 → 0:00), then by type priority ascending
        # This ensures:
        #   - At [12:00]: subs (0) → timeouts (1) → possessions (2)
        #   - Mid-quarter: possessions (2) → subs (3)
        all_events.sort(key=lambda x: (-x[1], x[2]))

        # Render events
        for event_type, clock, priority, event_data in all_events:
            if event_type == 'possession':
                lines.append(self._render_possession_event(event_data))
                lines.append("")  # Blank line between possessions
            elif event_type == 'substitution':
                lines.append(self._render_substitution_event(event_data))
                lines.append("")
            elif event_type == 'timeout':
                lines.append(self._render_timeout_event(event_data))
                lines.append("")

        # Quarter complete banner
        lines.append("=" * 80)
        lines.append(f"{quarter_text} QUARTER COMPLETE".center(80))
        lines.append("=" * 80)
        lines.append("")

        # BUG FIX: Change "FINAL SCORE" to "QUARTER X SCORE" for quarterly box scores
        quarter_ordinal = {1: "1ST", 2: "2ND", 3: "3RD", 4: "4TH"}.get(self.quarter_number, "")
        lines.append(f"{quarter_ordinal} QUARTER SCORE: {self.home_team_name} {self.home_score}, "
                     f"{self.away_team_name} {self.away_score}")
        lines.append("")

        # Box Score
        lines.append("BOX SCORE:")
        lines.append("=" * 80)
        lines.append("")

        # Home team box score
        lines.append(f"{self.home_team_name}")
        lines.append("-" * 80)
        lines.append(f"{'Player':<20} {'MIN':>4} {'PTS':>4} {'REB':>4} {'AST':>4} {'TO':>3} {'FG':>7} {'FG%':>5} {'3P':>7} {'3P%':>5}")
        lines.append("-" * 80)

        home_players = [(p, s) for p, s in self.statistics.player_stats.items()
                       if self.statistics.player_to_team.get(p) == 'Home']
        home_players.sort(key=lambda x: x[1]['points'], reverse=True)

        for player, stats in home_players:
            mins = self.minutes_played.get(player, 0.0)
            pts = stats['points']
            reb = stats['rebounds']
            ast = stats['assists']
            to = stats['turnovers']
            fgm = stats['fgm']
            fga = stats['fga']
            fg_pct = f"{(fgm/fga*100):.1f}" if fga > 0 else "0.0"
            # Note: We don't track 3PM/3PA per player yet, showing 0/0
            lines.append(f"{player:<20} {mins:>4.0f} {pts:>4} {reb:>4} {ast:>4} {to:>3} {fgm:>3}/{fga:<3} {fg_pct:>5} {'0/0':>7} {'0.0':>5}")

        lines.append("")
        lines.append(f"TEAM: {self.statistics.get_team_summary('Home')}")

        # M3 Issue #8: Display team foul count and bonus status
        # BUG FIX: Clarify bonus status display
        if self.foul_system:
            home_team_fouls = self.foul_system.get_team_fouls('Home')
            away_in_bonus = (home_team_fouls >= 5)
            if away_in_bonus:
                lines.append(f"TEAM FOULS: {home_team_fouls} [{self.away_team_name} in BONUS]")
            else:
                lines.append(f"TEAM FOULS: {home_team_fouls}")

        lines.append("")
        lines.append("")

        # Away team box score
        lines.append(f"{self.away_team_name}")
        lines.append("-" * 80)
        lines.append(f"{'Player':<20} {'MIN':>4} {'PTS':>4} {'REB':>4} {'AST':>4} {'TO':>3} {'FG':>7} {'FG%':>5} {'3P':>7} {'3P%':>5}")
        lines.append("-" * 80)

        away_players = [(p, s) for p, s in self.statistics.player_stats.items()
                       if self.statistics.player_to_team.get(p) == 'Away']
        away_players.sort(key=lambda x: x[1]['points'], reverse=True)

        for player, stats in away_players:
            mins = self.minutes_played.get(player, 0.0)
            pts = stats['points']
            reb = stats['rebounds']
            ast = stats['assists']
            to = stats['turnovers']
            fgm = stats['fgm']
            fga = stats['fga']
            fg_pct = f"{(fgm/fga*100):.1f}" if fga > 0 else "0.0"
            lines.append(f"{player:<20} {mins:>4.0f} {pts:>4} {reb:>4} {ast:>4} {to:>3} {fgm:>3}/{fga:<3} {fg_pct:>5} {'0/0':>7} {'0.0':>5}")

        lines.append("")
        lines.append(f"TEAM: {self.statistics.get_team_summary('Away')}")

        # M3 Issue #8: Display team foul count and bonus status
        # BUG FIX: Clarify bonus status display
        if self.foul_system:
            away_team_fouls = self.foul_system.get_team_fouls('Away')
            home_in_bonus = (away_team_fouls >= 5)
            if home_in_bonus:
                lines.append(f"TEAM FOULS: {away_team_fouls} [{self.home_team_name} in BONUS]")
            else:
                lines.append(f"TEAM FOULS: {away_team_fouls}")

        lines.append("")
        lines.append("=" * 80)

        return "\n".join(lines)

    def write_to_file(self, filepath: str) -> None:
        """
        Write play-by-play narrative to text file.

        Args:
            filepath: Path to output file (e.g., 'output/quarter_playbyplay.txt')
        """
        # Ensure output directory exists
        directory = os.path.dirname(filepath)
        if directory and not os.path.exists(directory):
            os.makedirs(directory)

        # Render to text
        narrative = self.render_to_text()

        # Write to file
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(narrative)

    def _format_game_clock(self, seconds_remaining: int) -> str:
        """
        Format game clock as MM:SS.

        Args:
            seconds_remaining: Seconds remaining in quarter (0-720)

        Returns:
            Formatted string (e.g., "11:45", "08:12", "00:23")
        """
        minutes = seconds_remaining // 60
        seconds = seconds_remaining % 60
        return f"{minutes:02d}:{seconds:02d}"

    def _render_possession_event(self, event: PossessionEvent) -> str:
        """
        Render a single possession event to text.

        Args:
            event: PossessionEvent to render

        Returns:
            Multi-line string with possession narrative

        Example:
            [11:45] Home possession (Score: 0-0)
            Stephen Curry attempts a 3-pointer. Contested by Kawhi Leonard.
            CURRY MAKES IT! +3
            Assist: Draymond Green
            Score: 3-0
        """
        lines = []

        # Timestamp and possession header
        timestamp = self._format_game_clock(event.game_clock)
        home_score, away_score = event.score_before
        team_name = self.home_team_name if event.offense_team == 'Home' else self.away_team_name

        lines.append(f"[{timestamp}] {team_name} possession (Score: {home_score}-{away_score})")

        # Play-by-play text (from possession.py generate_play_by_play)
        lines.append(event.play_by_play_text)

        # Score update (if points scored)
        if event.points_scored > 0:
            # Calculate new score
            if event.offense_team == 'Home':
                new_home = home_score + event.points_scored
                new_away = away_score
            else:
                new_home = home_score
                new_away = away_score + event.points_scored

            lines.append(f"Score: {new_home}-{new_away}")

        return "\n".join(lines)

    def _render_substitution_event(self, event: SubstitutionEvent) -> str:
        """
        Render a single substitution event to text.

        Args:
            event: SubstitutionEvent to render

        Returns:
            Single-line string with substitution info

        Example:
            [10:32] Substitution (Home): Kyle Lowry OUT (stamina: 58) → Jordan Poole IN
        """
        timestamp = self._format_game_clock(event.game_clock)
        team_name = self.home_team_name if event.team == 'Home' else self.away_team_name

        # Format reason
        reason_map = {
            'low_stamina': 'low stamina',
            'minutes_allocation': 'minutes management',
            'injury': 'injury'
        }
        reason_text = reason_map.get(event.reason, event.reason)

        # Build substitution line
        if event.stamina_out is not None:
            return (f"[{timestamp}] Substitution ({team_name}): "
                    f"{event.player_out} OUT (stamina: {event.stamina_out:.0f}) → "
                    f"{event.player_in} IN ({reason_text})")
        else:
            return (f"[{timestamp}] Substitution ({team_name}): "
                    f"{event.player_out} OUT → {event.player_in} IN ({reason_text})")

    def _render_timeout_event(self, event: TimeoutEvent) -> str:
        """
        Render a single timeout event to text (M3 Phase 2c).

        Args:
            event: TimeoutEvent to render

        Returns:
            Single-line string with timeout info

        Example:
            [05:23] TIMEOUT - Elite Shooters (momentum: 8-0 run) - 6 timeouts remaining
        """
        timestamp = self._format_game_clock(event.game_clock)
        team_name = self.home_team_name if event.team == 'Home' else self.away_team_name

        # Format reason
        reason_map = {
            'momentum': 'stop opponent momentum',
            'end_game_3pt_setup': 'draw up 3PT play',
            'end_game_final_possession': 'final possession setup',
            'end_game_desperation': 'desperation timeout'
        }
        reason_text = reason_map.get(event.reason, event.reason)

        return (f"[{timestamp}] TIMEOUT - {team_name} ({reason_text}) - "
                f"{event.timeouts_remaining} timeouts remaining")


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def format_percentage(made: int, attempted: int) -> str:
    """
    Format shooting percentage.

    Args:
        made: Shots made
        attempted: Shots attempted

    Returns:
        Formatted string (e.g., "12/24 (50.0%)")
    """
    if attempted == 0:
        return "0/0 (0.0%)"

    percentage = (made / attempted) * 100
    return f"{made}/{attempted} ({percentage:.1f}%)"


def format_quarter_ordinal(quarter_number: int) -> str:
    """
    Format quarter number as ordinal string.

    Args:
        quarter_number: Quarter number (1-4+)

    Returns:
        Ordinal string (e.g., "1ST", "2ND", "3RD", "4TH")
    """
    ordinals = {1: '1ST', 2: '2ND', 3: '3RD', 4: '4TH'}
    return ordinals.get(quarter_number, f'{quarter_number}TH')
