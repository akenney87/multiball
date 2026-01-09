"""
Basketball Simulator - Substitution System

Manages player substitutions based on:
1. Stamina thresholds (< 60 triggers immediate substitution)
2. Minutes allocation (from tactical settings)
3. Position matching (prefer position-compatible subs)

Key Logic:
- Check after EVERY possession
- Substitution priority: stamina < 60 overrides minutes allocation
- Edge cases: all bench exhausted, no valid substitutes

Integrates with:
- src/systems/stamina_manager.py (current stamina values)
- src/systems/quarter_simulation.py (active lineup management)
"""

from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass


# =============================================================================
# DATA STRUCTURES
# =============================================================================

@dataclass
class SubstitutionEvent:
    """Record of a substitution occurrence."""
    quarter_time: str  # "8:32"
    player_out: str
    player_in: str
    reason: str  # "stamina", "minutes", "injury"
    stamina_out: float
    stamina_in: float
    team: str = 'unknown'  # 'home' or 'away' - BUG FIX: track team to handle duplicate player names


@dataclass
class RotationPlan:
    """
    Proactive rotation plan for a player based on minutes allocation.

    Describes WHEN a player should sub in/out to meet their minutes target.
    """
    player_name: str
    position: str
    quarter_minutes_target: float  # Minutes allocated for this quarter (e.g., 8.0 for 32 min/game)
    is_starter: bool  # True if starting lineup

    # Planned substitution times (in seconds remaining)
    first_sub_out_time: Optional[int] = None  # When starter should first rest (e.g., 360 = 6:00)
    return_time: Optional[int] = None  # When starter should return (e.g., 120 = 2:00)
    bench_sub_in_time: Optional[int] = None  # When bench player should enter (e.g., 360 = 6:00)
    bench_sub_out_time: Optional[int] = None  # When bench player should exit (e.g., 60 = 1:00)

    # Tracking
    executed_first_sub: bool = False
    executed_return: bool = False
    executed_bench_in: bool = False
    executed_bench_out: bool = False


# =============================================================================
# SUBSTITUTION LOGIC
# =============================================================================

def check_substitution_needed(
    player: Dict[str, Any],
    current_stamina: float,
    minutes_played: float,
    minutes_allocation: float,
    stamina_threshold: float = 75.0  # M4.5 PHASE 4: Raised from 60 to 75 (more realistic)
) -> Tuple[bool, str]:
    """
    Check if a player needs to be substituted.

    Args:
        player: Player dict
        current_stamina: Current stamina value (0-100)
        minutes_played: Minutes played this quarter
        minutes_allocation: Allocated minutes for quarter (from tactical settings)
        stamina_threshold: Stamina threshold for substitution (default 75, PM recommendation)

    Returns:
        Tuple of (needs_sub, reason)
        needs_sub: True if substitution needed
        reason: 'stamina', 'minutes', or ''

    Priority:
        1. Stamina < threshold → immediate substitution
        2. Minutes played >= allocation → substitution
        3. Otherwise → no substitution

    M4.5 PHASE 4 FIX:
        - Raised threshold from 60 → 75 for NBA realism
        - Players should not play with stamina < 75 except in competitive end-game
        - Context-aware thresholds can be passed by caller:
            * Close game: 50-65 (let starters play tired)
            * Blowout: 80-85 (rest starters aggressively)
            * Foul trouble: 80 (prevent fouling out)
    """
    # Priority 1: Stamina check (highest priority)
    if current_stamina < stamina_threshold:
        return (True, 'stamina')

    # Priority 2: Minutes allocation check
    # Allow small tolerance (0.1 minutes = 6 seconds)
    if minutes_played >= minutes_allocation + 0.1:
        return (True, 'minutes')

    # No substitution needed
    return (False, '')


# =============================================================================
# M3: END-GAME SUBSTITUTION LOGIC
# =============================================================================

def check_blowout_substitution(
    quarter: int,
    time_remaining_seconds: int,
    score_differential: int,
    winning: bool
) -> Tuple[bool, str]:
    """
    Check if blowout substitution should occur (rest starters).

    Thresholds (from FOULS_AND_INJURIES_SPEC.md):
    - Q4, <6 min, +20 points → rest starters
    - Q4, <4 min, +18 points → rest starters
    - Q4, <2 min, +15 points → rest starters
    - Q4, <2 min, +30 points → garbage time (all subs)

    Args:
        quarter: Current quarter (1-4)
        time_remaining_seconds: Seconds remaining in quarter
        score_differential: Point differential (positive if winning)
        winning: True if team is winning

    Returns:
        (should_sub, reason)
    """
    if quarter != 4:
        return (False, '')

    if not winning:
        return (False, '')

    minutes_remaining = time_remaining_seconds / 60.0

    # Garbage time (most extreme)
    if minutes_remaining <= 2.0 and score_differential >= 30:
        return (True, 'garbage_time')

    # Blowout thresholds
    if minutes_remaining <= 6.0 and score_differential >= 20:
        return (True, 'blowout_rest')
    if minutes_remaining <= 4.0 and score_differential >= 18:
        return (True, 'blowout_rest')
    if minutes_remaining <= 2.0 and score_differential >= 15:
        return (True, 'blowout_rest')

    return (False, '')


def check_close_game_substitution(
    quarter: int,
    time_remaining_seconds: int,
    score_differential: int,
    player: Dict[str, Any],
    is_closer: bool
) -> Tuple[bool, str]:
    """
    Check if starters/closers should be inserted in close game.

    Thresholds:
    - Q4, <5 min, ±10 points → keep closers on floor
    - Q4, <3 min, ±8 points → keep closers on floor
    - Q4, <2 min, ±5 points → insert closers if benched

    Args:
        quarter: Current quarter
        time_remaining_seconds: Seconds remaining
        score_differential: Point differential (abs value used)
        player: Player dict
        is_closer: True if player is designated closer

    Returns:
        (should_insert, reason)
    """
    if quarter != 4:
        return (False, '')

    minutes_remaining = time_remaining_seconds / 60.0

    # Check close game thresholds
    is_close = False
    if minutes_remaining <= 5.0 and abs(score_differential) <= 10:
        is_close = True
    if minutes_remaining <= 3.0 and abs(score_differential) <= 8:
        is_close = True
    if minutes_remaining <= 2.0 and abs(score_differential) <= 5:
        is_close = True

    if not is_close:
        return (False, '')

    # If closer and it's a close game in final 2 minutes, insert
    if is_closer and minutes_remaining <= 2.0:
        return (True, 'close_game_insert_closer')

    return (False, '')


def check_blowout_comeback(
    previous_differential: int,
    current_differential: int,
    time_remaining_seconds: int
) -> bool:
    """
    Detect if blowout is becoming competitive (re-insert starters).

    Triggers:
    - Lead shrinks by 10+ points
    - Lead drops below blowout threshold

    Args:
        previous_differential: Previous score differential
        current_differential: Current score differential
        time_remaining_seconds: Seconds remaining

    Returns:
        True if comeback detected (starters should be re-inserted)
    """
    differential_change = previous_differential - current_differential

    # Lead shrinks by 10+ points
    if differential_change >= 10:
        return True

    # Lead drops below blowout threshold
    minutes_remaining = time_remaining_seconds / 60.0
    if minutes_remaining <= 4.0 and current_differential < 15:
        return True

    return False


def select_substitute(
    bench_players: List[Dict[str, Any]],
    position_out: str,
    stamina_values: Dict[str, float],
    return_threshold: float = 90.0  # M4.5 PHASE 4: Starters must recover to 90+ before returning
) -> Optional[Dict[str, Any]]:
    """
    Select best substitute from bench.

    Selection criteria:
    1. Prefer position match (PG/SG interchangeable, SF/PF interchangeable, C isolated)
    2. Prefer players with stamina >= return_threshold (90+) to prevent rapid rotation
    3. Highest stamina among position matches
    4. If no position match or no one above threshold, choose best available

    Args:
        bench_players: List of players currently on bench
        position_out: Position of player being substituted ('PG', 'SG', 'SF', 'PF', 'C')
        stamina_values: Dict mapping player_name -> current_stamina
        return_threshold: Minimum stamina for bench players to be eligible (default 85)

    Returns:
        Selected substitute (player dict) or None if no valid subs

    Position Compatibility:
        PG ↔ SG (guards interchangeable)
        SF ↔ PF (wings interchangeable)
        C (centers isolated)

    M4.5 PHASE 4 FIX:
        Added return_threshold (90) to prevent rapid rotation. Bench players must recover
        to 90+ stamina before being eligible to return. Falls back to best available if
        no one meets threshold (edge case: whole bench is fatigued).
    """
    if not bench_players:
        return None

    # M4.5 PHASE 4: Filter for position-compatible players
    compatible_players = []
    for player in bench_players:
        if is_position_compatible(position_out, player['position']):
            compatible_players.append(player)

    # M4.5 PHASE 4: Prefer players above return threshold (85+ stamina)
    if compatible_players:
        # First try: players above threshold
        well_rested = [p for p in compatible_players if stamina_values.get(p['name'], 0) >= return_threshold]

        if well_rested:
            # Sort by stamina (highest first) among well-rested players
            well_rested.sort(
                key=lambda p: stamina_values.get(p['name'], 0.0),
                reverse=True
            )
            return well_rested[0]
        else:
            # Fallback: no one above threshold, use best available
            compatible_players.sort(
                key=lambda p: stamina_values.get(p['name'], 0.0),
                reverse=True
            )
            return compatible_players[0]

    # No compatible players, choose best available from all bench (any position)
    well_rested_any = [p for p in bench_players if stamina_values.get(p['name'], 0) >= return_threshold]

    if well_rested_any:
        well_rested_any.sort(
            key=lambda p: stamina_values.get(p['name'], 0.0),
            reverse=True
        )
        return well_rested_any[0]
    else:
        # Absolute fallback: use best available regardless of stamina
        bench_players.sort(
            key=lambda p: stamina_values.get(p['name'], 0.0),
            reverse=True
        )
        return bench_players[0]


def is_position_compatible(position_out: str, position_in: str) -> bool:
    """
    Check if two positions are interchangeable.

    Args:
        position_out: Position of player exiting
        position_in: Position of candidate substitute

    Returns:
        True if positions are compatible

    Rules:
        PG ↔ SG (guards)
        SF ↔ PF (wings)
        C ↔ C (centers only)
    """
    # Guards are interchangeable
    guards = {'PG', 'SG'}
    if position_out in guards and position_in in guards:
        return True

    # Wings are interchangeable
    wings = {'SF', 'PF'}
    if position_out in wings and position_in in wings:
        return True

    # Centers only match centers
    if position_out == 'C' and position_in == 'C':
        return True

    return False


# =============================================================================
# LINEUP MANAGER CLASS
# =============================================================================

class LineupManager:
    """
    Manages the 5 active players on court for a team.

    Responsibilities:
    - Track current 5-player lineup
    - Track bench players
    - Execute substitutions
    - Validate lineup integrity (always 5 players)
    """

    def __init__(self, team: List[Dict[str, Any]], starting_lineup: Optional[List[Dict[str, Any]]] = None):
        """
        Initialize with starting lineup.

        Args:
            team: Full team roster (10-13 players)
            starting_lineup: Optional list of 5 players to start (if None, uses first 5 from team)
        """
        if len(team) < 5:
            raise ValueError(f"Team must have at least 5 players, got {len(team)}")

        self.team = team

        # Use provided starting lineup or default to first 5
        if starting_lineup is not None:
            if len(starting_lineup) != 5:
                raise ValueError(f"Starting lineup must have exactly 5 players, got {len(starting_lineup)}")
            self.active_lineup = starting_lineup.copy()

            # Bench is everyone not in starting lineup
            starting_names = {p['name'] for p in starting_lineup}
            self.bench = [p for p in team if p['name'] not in starting_names]
        else:
            self.active_lineup = team[:5].copy()  # Starting 5
            self.bench = team[5:].copy() if len(team) > 5 else []  # Bench players

    def get_active_players(self) -> List[Dict[str, Any]]:
        """Return current 5 players on court."""
        return self.active_lineup.copy()

    def get_bench_players(self) -> List[Dict[str, Any]]:
        """Return players on bench."""
        return self.bench.copy()

    def get_player_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """
        Find player in team by name.

        Args:
            name: Player name to search for

        Returns:
            Player dict if found, None otherwise
        """
        for player in self.team:
            if player['name'] == name:
                return player
        return None

    def substitute(self, player_out: Dict[str, Any], player_in: Dict[str, Any]) -> bool:
        """
        Replace player_out with player_in.

        Args:
            player_out: Player to remove from active lineup
            player_in: Player to add to active lineup

        Returns:
            True if substitution successful, False otherwise

        Side Effects:
            Updates active_lineup and bench lists
        """
        # Find player_out in active lineup
        player_out_index = None
        for i, player in enumerate(self.active_lineup):
            if player['name'] == player_out['name']:
                player_out_index = i
                break

        if player_out_index is None:
            # Player not in active lineup
            return False

        # Find player_in on bench
        player_in_on_bench = False
        player_in_index = None
        for i, player in enumerate(self.bench):
            if player['name'] == player_in['name']:
                player_in_on_bench = True
                player_in_index = i
                break

        if not player_in_on_bench:
            # Player not on bench
            return False

        # Execute substitution
        # Move player_out to bench
        self.bench.append(self.active_lineup[player_out_index])

        # Move player_in to active lineup (replace player_out)
        self.active_lineup[player_out_index] = self.bench[player_in_index]

        # Remove player_in from bench
        self.bench.pop(player_in_index)

        return True

    def validate_lineup(self) -> bool:
        """
        Validate lineup integrity.

        Returns:
            True if lineup is valid (exactly 5 active players)
        """
        return len(self.active_lineup) == 5


# =============================================================================
# SUBSTITUTION MANAGER CLASS
# =============================================================================

class SubstitutionManager:
    """
    Manages substitution logic for quarter simulation.

    Tracks active lineups, bench availability, and minutes allocation.
    Coordinates substitutions for both teams based on stamina and minutes.
    """

    def __init__(
        self,
        home_roster: List[Dict[str, Any]],
        away_roster: List[Dict[str, Any]],
        minutes_allocation_home: Dict[str, float],
        minutes_allocation_away: Dict[str, float],
        home_starting_lineup: Optional[List[Dict[str, Any]]] = None,
        away_starting_lineup: Optional[List[Dict[str, Any]]] = None,
        tactical_home: Optional[Any] = None,  # TacticalSettings for home team
        tactical_away: Optional[Any] = None   # TacticalSettings for away team
    ):
        """
        Initialize substitution manager.

        Args:
            home_roster: Full home team roster (10-13 players)
            away_roster: Full away team roster (10-13 players)
            minutes_allocation_home: Dict mapping player_name -> minutes (for quarter)
            minutes_allocation_away: Dict mapping player_name -> minutes (for quarter)
            home_starting_lineup: Optional starting 5 for home team
            away_starting_lineup: Optional starting 5 for away team
        """
        self.home_roster = home_roster
        self.away_roster = away_roster
        self.minutes_allocation_home = minutes_allocation_home
        self.minutes_allocation_away = minutes_allocation_away

        # Store tactical settings for Q4 closer calculations
        self.tactical_home = tactical_home
        self.tactical_away = tactical_away

        # Extract pace and scoring options (with safe defaults)
        self.pace_home = tactical_home.pace if tactical_home else 'standard'
        self.pace_away = tactical_away.pace if tactical_away else 'standard'

        self.scoring_options_home = []
        if tactical_home:
            if tactical_home.scoring_option_1:
                self.scoring_options_home.append(tactical_home.scoring_option_1)
            if tactical_home.scoring_option_2:
                self.scoring_options_home.append(tactical_home.scoring_option_2)
            if tactical_home.scoring_option_3:
                self.scoring_options_home.append(tactical_home.scoring_option_3)

        self.scoring_options_away = []
        if tactical_away:
            if tactical_away.scoring_option_1:
                self.scoring_options_away.append(tactical_away.scoring_option_1)
            if tactical_away.scoring_option_2:
                self.scoring_options_away.append(tactical_away.scoring_option_2)
            if tactical_away.scoring_option_3:
                self.scoring_options_away.append(tactical_away.scoring_option_3)

        # Initialize lineup managers with starting lineups
        self.home_lineup_manager = LineupManager(home_roster, home_starting_lineup)
        self.away_lineup_manager = LineupManager(away_roster, away_starting_lineup)

        # Track substitution events
        self.substitution_events: List[SubstitutionEvent] = []

        # M3 FIX: Track last substitution time per player to prevent excessive churn
        # Dict mapping player_name -> minutes_played_when_last_subbed
        # Initialize to -999 so players aren't on cooldown at game start
        self.last_sub_time: Dict[str, float] = {}
        for player in home_roster + away_roster:
            self.last_sub_time[player['name']] = -999.0  # Never subbed yet
        # Minimum time between substitutions for same player (in minutes)
        self.substitution_cooldown_minutes = 2.0

        # NEW: Track continuous time on court for each player (resets on substitution)
        # This enforces realistic 6-10 minute stretches for starters
        self.time_on_court: Dict[str, float] = {}
        for player in home_roster + away_roster:
            self.time_on_court[player['name']] = 0.0

        # Identify starters (players with highest minutes allocation)
        # Top 5 for each team are considered "starters"
        self.home_starters = set()
        sorted_home = sorted(
            home_roster,
            key=lambda p: minutes_allocation_home.get(p['name'], 0),
            reverse=True
        )
        for i in range(min(5, len(sorted_home))):
            self.home_starters.add(sorted_home[i]['name'])

        self.away_starters = set()
        sorted_away = sorted(
            away_roster,
            key=lambda p: minutes_allocation_away.get(p['name'], 0),
            reverse=True
        )
        for i in range(min(5, len(sorted_away))):
            self.away_starters.add(sorted_away[i]['name'])

        # BUG FIX: Track which backup replaced which starter (for smart Rule #1 return)
        # When starter A is subbed out for backup B, we store: starter_replacement_map[A] = B
        # When starter A returns, we prioritize replacing backup B (not just any compatible player)
        self.starter_replacement_map: Dict[str, str] = {}

        # Q4 Closer System: Track Q4 rotation decisions
        self.q4_decisions_home: Dict[str, Dict[str, Any]] = {}
        self.q4_decisions_away: Dict[str, Dict[str, Any]] = {}
        self.q4_start_processed = False

        # Q1 ROTATION FIX: Create rotation plans for ALL players
        # This ensures proactive substitutions based on minutes allocation
        self.home_rotation_plans = create_rotation_plans(
            roster=home_roster,
            starting_lineup=home_starting_lineup or home_roster[:5],
            minutes_allocation=minutes_allocation_home
        )
        self.away_rotation_plans = create_rotation_plans(
            roster=away_roster,
            starting_lineup=away_starting_lineup or away_roster[:5],
            minutes_allocation=minutes_allocation_away
        )

    def check_rotation_plans(
        self,
        time_remaining_in_quarter: int,
        stamina_tracker: Any,
        game_time_str: str
    ) -> List[SubstitutionEvent]:
        """
        Q1 ROTATION FIX: Check rotation plans and execute planned substitutions.

        This runs BEFORE the stamina-based checks, ensuring proactive rotations
        happen at designated times regardless of stamina levels.

        Args:
            time_remaining_in_quarter: Seconds remaining in quarter
            stamina_tracker: StaminaTracker instance
            game_time_str: Current game time string for logging

        Returns:
            List of substitution events that occurred
        """
        events = []

        # Check home team rotation plans
        events.extend(self._check_team_rotation_plans(
            rotation_plans=self.home_rotation_plans,
            lineup_manager=self.home_lineup_manager,
            time_remaining=time_remaining_in_quarter,
            stamina_tracker=stamina_tracker,
            game_time_str=game_time_str,
            team='home'
        ))

        # Check away team rotation plans
        events.extend(self._check_team_rotation_plans(
            rotation_plans=self.away_rotation_plans,
            lineup_manager=self.away_lineup_manager,
            time_remaining=time_remaining_in_quarter,
            stamina_tracker=stamina_tracker,
            game_time_str=game_time_str,
            team='away'
        ))

        return events

    def _check_team_rotation_plans(
        self,
        rotation_plans: List[RotationPlan],
        lineup_manager: LineupManager,
        time_remaining: int,
        stamina_tracker: Any,
        game_time_str: str,
        team: str
    ) -> List[SubstitutionEvent]:
        """
        Check rotation plans for one team and execute any due substitutions.

        Args:
            rotation_plans: List of RotationPlan objects for this team
            lineup_manager: LineupManager for this team
            time_remaining: Seconds remaining in quarter
            stamina_tracker: StaminaTracker instance
            game_time_str: Current game time string
            team: 'home' or 'away'

        Returns:
            List of substitution events that occurred
        """
        events = []
        active_players = lineup_manager.get_active_players()
        bench_players = lineup_manager.get_bench_players()
        active_names = {p['name'] for p in active_players}
        bench_names = {p['name'] for p in bench_players}

        for plan in rotation_plans:
            # CASE 1: Starter needs to sub out for first rest
            if (plan.is_starter and
                not plan.executed_first_sub and
                plan.first_sub_out_time is not None and
                time_remaining <= plan.first_sub_out_time and
                plan.player_name in active_names):

                # Find position-compatible bench player to sub in
                player_out = lineup_manager.get_player_by_name(plan.player_name)
                if not player_out:
                    continue

                # Find best bench substitute (prefer position match, high stamina)
                stamina_values = stamina_tracker.get_all_stamina_values()
                substitute = select_substitute(
                    bench_players=bench_players,
                    position_out=plan.position,
                    stamina_values=stamina_values,
                    return_threshold=0.0  # Accept any stamina for planned rotation
                )

                if substitute:
                    success = lineup_manager.substitute(player_out, substitute)
                    if success:
                        event = SubstitutionEvent(
                            quarter_time=game_time_str,
                            player_out=plan.player_name,
                            player_in=substitute['name'],
                            reason='rotation_plan_starter_rest',
                            stamina_out=stamina_tracker.get_current_stamina(plan.player_name),
                            stamina_in=stamina_tracker.get_current_stamina(substitute['name']),
                            team=team
                        )
                        events.append(event)
                        plan.executed_first_sub = True

                        # Track replacement for smart return
                        self.starter_replacement_map[plan.player_name] = substitute['name']

                        # Reset time on court
                        self.time_on_court[plan.player_name] = 0.0
                        self.time_on_court[substitute['name']] = 0.0

                        # Update lists
                        active_players = lineup_manager.get_active_players()
                        bench_players = lineup_manager.get_bench_players()
                        active_names = {p['name'] for p in active_players}
                        bench_names = {p['name'] for p in bench_players}

            # CASE 2: Starter needs to return from bench
            elif (plan.is_starter and
                  plan.executed_first_sub and
                  not plan.executed_return and
                  plan.return_time is not None and
                  time_remaining <= plan.return_time and
                  plan.player_name in bench_names):

                # Find the backup who replaced this starter
                tracked_backup = self.starter_replacement_map.get(plan.player_name)
                player_in = lineup_manager.get_player_by_name(plan.player_name)
                if not player_in:
                    continue

                # Try to sub out the tracked backup first
                player_out = None
                if tracked_backup and tracked_backup in active_names:
                    player_out = lineup_manager.get_player_by_name(tracked_backup)
                else:
                    # Fallback: find any position-compatible active player
                    for active in active_players:
                        if is_position_compatible(plan.position, active['position']):
                            player_out = active
                            break

                if player_out:
                    success = lineup_manager.substitute(player_out, player_in)
                    if success:
                        event = SubstitutionEvent(
                            quarter_time=game_time_str,
                            player_out=player_out['name'],
                            player_in=plan.player_name,
                            reason='rotation_plan_starter_return',
                            stamina_out=stamina_tracker.get_current_stamina(player_out['name']),
                            stamina_in=stamina_tracker.get_current_stamina(plan.player_name),
                            team=team
                        )
                        events.append(event)
                        plan.executed_return = True

                        # Clear tracking
                        if plan.player_name in self.starter_replacement_map:
                            del self.starter_replacement_map[plan.player_name]

                        # Reset time on court
                        self.time_on_court[player_out['name']] = 0.0
                        self.time_on_court[plan.player_name] = 0.0

                        # Update lists
                        active_players = lineup_manager.get_active_players()
                        bench_players = lineup_manager.get_bench_players()
                        active_names = {p['name'] for p in active_players}
                        bench_names = {p['name'] for p in bench_players}

            # CASE 3: Bench player needs to sub in
            elif (not plan.is_starter and
                  not plan.executed_bench_in and
                  plan.bench_sub_in_time is not None and
                  time_remaining <= plan.bench_sub_in_time and
                  plan.player_name in bench_names):

                # Find position-compatible starter to sub out
                player_in = lineup_manager.get_player_by_name(plan.player_name)
                if not player_in:
                    continue

                # Find position-compatible active player (prefer starters who haven't rested yet)
                player_out = None
                for active in active_players:
                    if is_position_compatible(plan.position, active['position']):
                        player_out = active
                        break

                if player_out:
                    success = lineup_manager.substitute(player_out, player_in)
                    if success:
                        event = SubstitutionEvent(
                            quarter_time=game_time_str,
                            player_out=player_out['name'],
                            player_in=plan.player_name,
                            reason='rotation_plan_bench_in',
                            stamina_out=stamina_tracker.get_current_stamina(player_out['name']),
                            stamina_in=stamina_tracker.get_current_stamina(plan.player_name),
                            team=team
                        )
                        events.append(event)
                        plan.executed_bench_in = True

                        # Reset time on court
                        self.time_on_court[player_out['name']] = 0.0
                        self.time_on_court[plan.player_name] = 0.0

                        # Update lists
                        active_players = lineup_manager.get_active_players()
                        bench_players = lineup_manager.get_bench_players()
                        active_names = {p['name'] for p in active_players}
                        bench_names = {p['name'] for p in bench_players}

            # CASE 4: Bench player needs to sub out
            elif (not plan.is_starter and
                  plan.executed_bench_in and
                  not plan.executed_bench_out and
                  plan.bench_sub_out_time is not None and
                  time_remaining <= plan.bench_sub_out_time and
                  plan.player_name in active_names):

                # Sub out bench player for any available substitute
                player_out = lineup_manager.get_player_by_name(plan.player_name)
                if not player_out:
                    continue

                # Find best bench substitute
                stamina_values = stamina_tracker.get_all_stamina_values()
                substitute = select_substitute(
                    bench_players=bench_players,
                    position_out=plan.position,
                    stamina_values=stamina_values,
                    return_threshold=0.0  # Accept any stamina
                )

                if substitute:
                    success = lineup_manager.substitute(player_out, substitute)
                    if success:
                        event = SubstitutionEvent(
                            quarter_time=game_time_str,
                            player_out=plan.player_name,
                            player_in=substitute['name'],
                            reason='rotation_plan_bench_out',
                            stamina_out=stamina_tracker.get_current_stamina(plan.player_name),
                            stamina_in=stamina_tracker.get_current_stamina(substitute['name']),
                            team=team
                        )
                        events.append(event)
                        plan.executed_bench_out = True

                        # Reset time on court
                        self.time_on_court[plan.player_name] = 0.0
                        self.time_on_court[substitute['name']] = 0.0

                        # Update lists
                        active_players = lineup_manager.get_active_players()
                        bench_players = lineup_manager.get_bench_players()
                        active_names = {p['name'] for p in active_players}
                        bench_names = {p['name'] for p in bench_players}

        return events

    def check_and_execute_substitutions(
        self,
        stamina_tracker: Any,  # StaminaTracker instance
        game_time_str: str,  # "8:32" format
        time_remaining_in_quarter: int = 0,  # Seconds remaining
        quarter_number: int = 1,
        debug: bool = False,  # Enable debug output
        home_score: int = 0,  # M4.5 PHASE 4: For context-aware thresholds
        away_score: int = 0   # M4.5 PHASE 4: For context-aware thresholds
    ) -> List[SubstitutionEvent]:
        """
        Check all active players for substitution needs and execute.

        Q1 ROTATION FIX: Now checks rotation plans FIRST, then falls back to stamina-based rules.

        Args:
            stamina_tracker: StaminaTracker instance (for current stamina values)
            game_time_str: Current game time string for logging
            time_remaining_in_quarter: Seconds remaining in quarter (for mid-quarter checks)
            quarter_number: Current quarter (1-4)
            debug: If True, print debug information
            home_score: Current home team score (M4.5 PHASE 4: for context-aware thresholds)
            away_score: Current away team score (M4.5 PHASE 4: for context-aware thresholds)

        Returns:
            List of substitution events that occurred

        Side Effects:
            Updates lineup managers if substitutions occur
        """
        events = []

        # Q1 ROTATION FIX: Check rotation plans FIRST (proactive substitutions)
        plan_events = self.check_rotation_plans(
            time_remaining_in_quarter=time_remaining_in_quarter,
            stamina_tracker=stamina_tracker,
            game_time_str=game_time_str
        )
        events.extend(plan_events)

        # Q4 CLOSER SYSTEM: Process Q4 start (calculate rotation decisions once)
        if quarter_number == 4 and not self.q4_start_processed:
            self.q4_start_processed = True
            self._process_q4_start(stamina_tracker, home_score, away_score)

            # TEMP DEBUG: Always print Q4 decisions for close games
            if abs(home_score - away_score) <= 10:
                print(f"\n[Q4 CLOSER DEBUG] Q4 rotation decisions calculated:")
                print(f"  Score: {home_score}-{away_score} (diff: {abs(home_score - away_score)})")
                print("  Home Team:")
                for starter, decision in self.q4_decisions_home.items():
                    print(f"    {starter}: {decision['action']} | playable: {decision['playable_minutes']:.1f} min | stamina: {decision['current_stamina']:.1f} | insert_at: {decision.get('insert_at', 'N/A')}")
                print("  Away Team:")
                for starter, decision in self.q4_decisions_away.items():
                    print(f"    {starter}: {decision['action']} | playable: {decision['playable_minutes']:.1f} min | stamina: {decision['current_stamina']:.1f} | insert_at: {decision.get('insert_at', 'N/A')}")

            if debug:
                print(f"\n[Q4 CLOSER] Q4 rotation decisions calculated:")
                for starter, decision in self.q4_decisions_home.items():
                    print(f"  {starter}: {decision['action']} (stamina: {decision['current_stamina']:.1f})")

        if debug:
            # Debug: check time on court for first home player
            home_active = self.home_lineup_manager.get_active_players()
            if home_active:
                p = home_active[0]
                time_on = self.time_on_court.get(p['name'], 0)
                print(f"[DEBUG SUB CHECK] {game_time_str}: {p['name']} time_on_court={time_on:.2f}min")

        # Check home team (score_differential positive if home winning)
        home_events = self._check_team_substitutions(
            lineup_manager=self.home_lineup_manager,
            minutes_allocation=self.minutes_allocation_home,
            stamina_tracker=stamina_tracker,
            game_time_str=game_time_str,
            time_remaining_in_quarter=time_remaining_in_quarter,
            quarter_number=quarter_number,
            score_differential=home_score - away_score,  # M4.5 PHASE 4
            team='home'  # BUG FIX: specify team
        )
        events.extend(home_events)

        # Check away team (score_differential positive if away winning)
        away_events = self._check_team_substitutions(
            lineup_manager=self.away_lineup_manager,
            minutes_allocation=self.minutes_allocation_away,
            stamina_tracker=stamina_tracker,
            game_time_str=game_time_str,
            time_remaining_in_quarter=time_remaining_in_quarter,
            quarter_number=quarter_number,
            score_differential=away_score - home_score,  # M4.5 PHASE 4
            team='away'  # BUG FIX: specify team
        )
        events.extend(away_events)

        # Store events
        self.substitution_events.extend(events)

        if debug and events:
            print(f"[DEBUG SUB CHECK] {game_time_str}: {len(events)} substitutions executed")

        return events

    def _check_team_substitutions(
        self,
        lineup_manager: LineupManager,
        minutes_allocation: Dict[str, float],
        stamina_tracker: Any,
        game_time_str: str,
        time_remaining_in_quarter: int = 0,
        quarter_number: int = 1,
        score_differential: int = 0,  # M4.5 PHASE 4: For context-aware thresholds
        team: str = 'unknown'  # BUG FIX: track team ('home' or 'away')
    ) -> List[SubstitutionEvent]:
        """
        Check and execute substitutions for one team.

        Args:
            lineup_manager: LineupManager for this team
            minutes_allocation: Minutes allocation dict
            stamina_tracker: StaminaTracker instance
            game_time_str: Current game time string
            time_remaining_in_quarter: Seconds remaining in quarter
            quarter_number: Current quarter (1-4)
            score_differential: Score difference (positive if winning) for context

        Returns:
            List of substitution events

        M4.5 PHASE 4: USER RULES FOR SUBSTITUTIONS:
            Rule #1: If a starter has 90+ stamina AND the player at their position
                     has been on court 6+ minutes → sub the starter in
            Rule #2: If a starter drops below 70 stamina → sub out immediately
                     Try position match first (PG→PG), then position group
                     (Guards: PG/SG, Wings: SF/PF, Bigs: C)
            Rule #3 (CRUNCH TIME): In final 2 min of close games (±5 pts),
                     only sub out starters if stamina < 50 (play exhausted stars)
        """
        events = []
        active_players = lineup_manager.get_active_players()
        bench_players = lineup_manager.get_bench_players()
        stamina_values = stamina_tracker.get_all_stamina_values()


        # RULE #3: Detect crunch time (Q4, final 2 min, close game ±5 pts)
        is_crunch_time = (
            quarter_number == 4 and
            time_remaining_in_quarter <= 120 and  # 2 minutes = 120 seconds
            abs(score_differential) <= 5
        )

        # RULE #2: Check for starters who need to be subbed out (<75 stamina normally, <50 in crunch time)
        for player in active_players:
            player_name = player['name']
            current_stamina = stamina_tracker.get_current_stamina(player_name)
            is_starter = self._is_starter(player_name)

            # Rule #2: Starter with <70 stamina must be subbed out (unless crunch time)
            # Rule #3: In crunch time, only sub out if stamina < 50 (play exhausted stars)
            # M4.5 PHASE 4: Lowered threshold from 75 to 70 to reduce substitution frequency
            # Q4 CLOSER FIX: In Q4 close games, starters finish the game even with low stamina
            stamina_threshold = 50.0 if is_crunch_time else 70.0

            # Q4 CLOSER FIX: Check if this starter should finish Q4 (close game)
            q4_closer_active = False
            if quarter_number == 4 and abs(score_differential) <= 10 and is_starter:
                # Get Q4 decisions for this team
                q4_decisions = self.q4_decisions_home if team == 'home' else self.q4_decisions_away
                if player_name in q4_decisions:
                    action = q4_decisions[player_name]['action']
                    # If starter was identified to play through Q4, lower threshold to 50
                    if action in ['STAY_IN', 'WILL_FATIGUE']:
                        stamina_threshold = 50.0
                        q4_closer_active = True

            if is_starter and current_stamina < stamina_threshold and bench_players and not q4_closer_active:
                # Find substitute: prefer position match with 90+ stamina
                # M4.5 PHASE 4: Raised threshold from 85 to 90 to slow rotation
                substitute = self._select_substitute_by_rules(
                    bench_players=bench_players,
                    position_out=player['position'],
                    stamina_values=stamina_values,
                    is_replacing_starter=True,
                    minimum_stamina=90.0
                )

                if substitute:
                    success = lineup_manager.substitute(player, substitute)
                    if success:
                        event = SubstitutionEvent(
                            quarter_time=game_time_str,
                            player_out=player_name,
                            player_in=substitute['name'],
                            reason='stamina_rule2',
                            stamina_out=current_stamina,
                            stamina_in=stamina_tracker.get_current_stamina(substitute['name']),
                            team=team  # BUG FIX
                        )
                        events.append(event)

                        # BUG FIX: Track that this backup replaced this starter
                        # When the starter returns, we'll prioritize replacing this backup
                        self.starter_replacement_map[player_name] = substitute['name']

                        # Reset time on court
                        self.time_on_court[player_name] = 0.0
                        self.time_on_court[substitute['name']] = 0.0

                        # Update bench list for next iteration
                        bench_players = lineup_manager.get_bench_players()
                        active_players = lineup_manager.get_active_players()

        # RULE #1: Check for starters on bench who are ready to return
        # (90+ stamina) and can replace someone who has 6+ minutes on court
        # M4.5 PHASE 4: Increased minimum stint from 4 to 6 minutes
        # M4.5 PHASE 4: Increased return threshold from 85 to 90 to slow rotation


        for bench_player in bench_players[:]:  # Copy list to avoid modification during iteration
            bench_player_name = bench_player['name']
            is_starter = self._is_starter(bench_player_name)
            bench_stamina = stamina_values.get(bench_player_name, 0)

            # Q4 CLOSER FIX: Check if this is a Q4 close game INSERT_AT scenario FIRST
            # This allows benched starters with <90 stamina to still be inserted per Q4 plan
            has_q4_insert_plan = False
            if quarter_number == 4 and abs(score_differential) <= 10 and is_starter:
                q4_decisions = self.q4_decisions_home if team == 'home' else self.q4_decisions_away
                if bench_player_name in q4_decisions:
                    if q4_decisions[bench_player_name]['action'] == 'INSERT_AT':
                        has_q4_insert_plan = True

            # Rule #1: Starter with 90+ stamina is ready to return
            # Q4 CLOSER FIX: OR starter has Q4 insert plan in close game (bypass 90 requirement)
            if is_starter and (bench_stamina >= 90.0 or has_q4_insert_plan):

                # Q4 CLOSER SYSTEM: Check if we should wait to insert this starter
                # Q4 CLOSER FIX: Calculate override BEFORE time check
                q4_insert_override = False
                if quarter_number == 4 and abs(score_differential) <= 10:
                    q4_decisions = self.q4_decisions_home if team == 'home' else self.q4_decisions_away
                    if bench_player_name in q4_decisions:
                        decision = q4_decisions[bench_player_name]

                        # Only insert if time remaining <= calculated insertion time
                        if decision['action'] == 'INSERT_AT':
                            q4_insert_override = True  # Set override for 6-min bypass
                            time_remaining_min = time_remaining_in_quarter / 60.0
                            insert_at_min = decision['insert_at']

                            # Add 0.5 min buffer (insert slightly early for safety)
                            if time_remaining_min > insert_at_min + 0.5:
                                # Too early - wait
                                continue  # Skip this starter, check next bench player

                # BUG FIX: First check if we tracked a specific backup who replaced this starter
                # If yes, prioritize replacing that backup (not just any compatible player)
                tracked_backup_name = self.starter_replacement_map.get(bench_player_name)
                replaced_tracked_backup = False

                if tracked_backup_name:
                    # Try to find the tracked backup in active players
                    for active_player in active_players:
                        if active_player['name'] == tracked_backup_name:
                            # Found the backup who took this starter's spot - replace them
                            success = lineup_manager.substitute(active_player, bench_player)
                            if success:
                                event = SubstitutionEvent(
                                    quarter_time=game_time_str,
                                    player_out=active_player['name'],
                                    player_in=bench_player_name,
                                    reason='starter_return_rule1',
                                    stamina_out=stamina_tracker.get_current_stamina(active_player['name']),
                                    stamina_in=bench_stamina,
                                    team=team
                                )
                                events.append(event)

                                # Clear the mapping (starter has reclaimed their spot)
                                del self.starter_replacement_map[bench_player_name]

                                # Reset time on court
                                self.time_on_court[active_player['name']] = 0.0
                                self.time_on_court[bench_player_name] = 0.0

                                # Update lists
                                bench_players = lineup_manager.get_bench_players()
                                active_players = lineup_manager.get_active_players()

                                replaced_tracked_backup = True
                                break  # Exit loop, this starter is back in

                # If we didn't replace the tracked backup (not on court or not tracked),
                # fall back to original logic: find any compatible position player with 6+ minutes
                if not replaced_tracked_backup:
                    found_replacement = False
                    for active_player in active_players:
                        active_player_name = active_player['name']
                        time_on_court = self.time_on_court.get(active_player_name, 0.0)

                        # Check if positions are compatible and time >= 6 minutes (or Q4 insert override)
                        if (q4_insert_override or time_on_court >= 6.0) and self._positions_compatible(
                            bench_player['position'],
                            active_player['position']
                        ):
                            found_replacement = True
                            # Execute substitution
                            success = lineup_manager.substitute(active_player, bench_player)
                            if success:
                                event = SubstitutionEvent(
                                    quarter_time=game_time_str,
                                    player_out=active_player_name,
                                    player_in=bench_player_name,
                                    reason='starter_return_rule1',
                                    stamina_out=stamina_tracker.get_current_stamina(active_player_name),
                                    stamina_in=bench_stamina,
                                    team=team  # BUG FIX
                                )
                                events.append(event)

                                # Reset time on court
                                self.time_on_court[active_player_name] = 0.0
                                self.time_on_court[bench_player_name] = 0.0

                                # Update lists
                                bench_players = lineup_manager.get_bench_players()
                                active_players = lineup_manager.get_active_players()

                                # Break inner loop - this starter has been subbed in
                                break

        return events

    def _calculate_playable_minutes(
        self,
        player: Dict[str, Any],
        current_stamina: float,
        pace: str,
        is_scoring_option: bool
    ) -> float:
        """
        Calculate how many minutes a player can play from current stamina
        before dropping to 70 stamina.

        Args:
            player: Player dict with attributes
            current_stamina: Current stamina value
            pace: 'fast', 'standard', 'slow'
            is_scoring_option: True if player is scoring option #1/2/3

        Returns:
            Minutes playable (float)
        """
        from ..systems.stamina_manager import calculate_stamina_cost

        # Stamina budget: current → 70
        stamina_budget = current_stamina - 70.0

        if stamina_budget <= 0:
            return 0.0  # Already below threshold

        # Get player-specific stamina cost (half-court baseline)
        cost_half_court = calculate_stamina_cost(
            pace=pace,
            is_scoring_option=is_scoring_option,
            is_transition=False,
            player_stamina_attribute=player.get('stamina', 50),
            player_acceleration=player.get('acceleration', 50),
            player_top_speed=player.get('top_speed', 50)
        )

        # Get transition cost
        cost_transition = calculate_stamina_cost(
            pace=pace,
            is_scoring_option=is_scoring_option,
            is_transition=True,
            player_stamina_attribute=player.get('stamina', 50),
            player_acceleration=player.get('acceleration', 50),
            player_top_speed=player.get('top_speed', 50)
        )

        # Weighted average (20% transition rate)
        transition_rate = 0.20
        avg_cost = (1 - transition_rate) * cost_half_court + transition_rate * cost_transition

        # Pace-specific possession rate
        possessions_per_minute = {
            'fast': 2.8,
            'standard': 2.5,
            'slow': 2.2
        }[pace]

        # Calculate drain per minute
        drain_per_minute = avg_cost * possessions_per_minute

        # Calculate playable minutes
        playable_minutes = stamina_budget / drain_per_minute

        return playable_minutes

    def _process_q4_start(
        self,
        stamina_tracker: Any,
        home_score: int,
        away_score: int
    ) -> None:
        """
        At Q4 start, evaluate every starter and calculate optimal rotation.

        For each starter:
        - If on bench: calculate when to insert
        - If on court: check if can finish Q4, if not calculate bench time needed

        Stores decisions in self.q4_decisions_home and self.q4_decisions_away
        """
        # Process home team
        self._process_q4_team_decisions(
            stamina_tracker=stamina_tracker,
            lineup_manager=self.home_lineup_manager,
            starters=self.home_starters,
            roster=self.home_roster,
            pace=self.pace_home,
            scoring_options=self.scoring_options_home,
            decisions_dict=self.q4_decisions_home
        )

        # Process away team
        self._process_q4_team_decisions(
            stamina_tracker=stamina_tracker,
            lineup_manager=self.away_lineup_manager,
            starters=self.away_starters,
            roster=self.away_roster,
            pace=self.pace_away,
            scoring_options=self.scoring_options_away,
            decisions_dict=self.q4_decisions_away
        )

    def _process_q4_team_decisions(
        self,
        stamina_tracker: Any,
        lineup_manager: LineupManager,
        starters: set,
        roster: List[Dict[str, Any]],
        pace: str,
        scoring_options: List[str],
        decisions_dict: Dict[str, Dict[str, Any]]
    ) -> None:
        """
        Process Q4 decisions for one team's starters.
        """
        active_players = lineup_manager.get_active_players()
        active_names = {p['name'] for p in active_players}

        for starter_name in starters:
            # Find player in roster
            player = None
            for p in roster:
                if p['name'] == starter_name:
                    player = p
                    break

            if not player:
                continue

            current_stamina = stamina_tracker.get_current_stamina(starter_name)
            is_scoring_option = starter_name in scoring_options
            is_active = starter_name in active_names

            # Calculate playable minutes from current stamina
            playable_minutes = self._calculate_playable_minutes(
                player, current_stamina, pace, is_scoring_option
            )

            if is_active:
                # CASE 2: Starter on court
                # Can they play all 12 minutes of Q4?
                if playable_minutes >= 12.0:
                    # Can finish - stay in
                    decisions_dict[starter_name] = {
                        'action': 'STAY_IN',
                        'playable_minutes': playable_minutes,
                        'current_stamina': current_stamina
                    }
                else:
                    # Cannot finish - will need to sub out
                    # For now, let normal Rule #2 handle the substitution
                    decisions_dict[starter_name] = {
                        'action': 'WILL_FATIGUE',
                        'playable_minutes': playable_minutes,
                        'current_stamina': current_stamina,
                        'sub_out_at': 12.0 - playable_minutes  # Time into Q4 when stamina hits 70
                    }
            else:
                # CASE 1: Starter on bench
                # Calculate when to insert
                # BUG FIX: If playable_minutes >= 12, insert at Q4 start (not negative time!)
                if playable_minutes >= 12.0:
                    insert_at_time = 12.0  # Insert at Q4 start (full stamina, can finish)
                else:
                    insert_at_time = 12.0 - playable_minutes  # Insert so they can play until end

                decisions_dict[starter_name] = {
                    'action': 'INSERT_AT',
                    'playable_minutes': playable_minutes,
                    'current_stamina': current_stamina,
                    'insert_at': insert_at_time
                }

    def get_home_active(self) -> List[Dict[str, Any]]:
        """Get current home team active lineup."""
        return self.home_lineup_manager.get_active_players()

    def get_away_active(self) -> List[Dict[str, Any]]:
        """Get current away team active lineup."""
        return self.away_lineup_manager.get_active_players()

    def get_home_bench(self) -> List[Dict[str, Any]]:
        """Get current home team bench."""
        return self.home_lineup_manager.get_bench_players()

    def get_away_bench(self) -> List[Dict[str, Any]]:
        """Get current away team bench."""
        return self.away_lineup_manager.get_bench_players()

    def get_all_substitution_events(self) -> List[SubstitutionEvent]:
        """Get all substitution events recorded."""
        return self.substitution_events.copy()

    def make_substitution(
        self,
        team: str,
        player_out_name: str,
        player_in_name: str,
        quarter_time: str = "0:00",
        reason: str = "fouled_out"
    ) -> bool:
        """
        M4.5 FIX: Manual substitution for special cases (foul outs, injuries).

        Args:
            team: 'home' or 'away'
            player_out_name: Name of player to remove
            player_in_name: Name of player to add
            quarter_time: Current quarter time (e.g., "8:32")
            reason: Reason for substitution

        Returns:
            True if substitution successful, False otherwise
        """
        # Get the appropriate lineup manager and roster
        if team.lower() == 'home':
            lineup_manager = self.home_lineup_manager
            roster = self.home_roster
        else:
            lineup_manager = self.away_lineup_manager
            roster = self.away_roster

        # Find player dictionaries
        player_out = lineup_manager.get_player_by_name(player_out_name)
        if player_out is None:
            return False  # Player not found in active lineup

        player_in = None
        for player in roster:
            if player['name'] == player_in_name:
                player_in = player
                break

        if player_in is None:
            return False  # Substitute not found in roster

        # Use reasonable default stamina values for event recording
        # (Actual stamina tracking is managed separately by StaminaTracker)
        stamina_out = 50.0  # Player coming off court (likely fatigued or fouled out)
        stamina_in = 100.0  # Player coming in fresh from bench

        # Execute substitution
        success = lineup_manager.substitute(player_out, player_in)

        if success:
            # Record substitution event
            event = SubstitutionEvent(
                quarter_time=quarter_time,
                player_out=player_out_name,
                player_in=player_in_name,
                reason=reason,
                stamina_out=stamina_out,
                stamina_in=stamina_in,
                team=team  # BUG FIX
            )
            self.substitution_events.append(event)

            # Reset time on court for both players
            self.time_on_court[player_out_name] = 0.0
            self.time_on_court[player_in_name] = 0.0

        return success

    def update_time_on_court(self, stamina_tracker: Any, duration_seconds: float) -> None:
        """
        Update continuous time on court for all active players.

        Call this after EVERY possession to track how long players have been
        on court without rest.

        Args:
            stamina_tracker: StaminaTracker instance
            duration_seconds: Possession duration in seconds

        Side Effects:
            Updates self.time_on_court for all active players
        """
        duration_minutes = duration_seconds / 60.0

        home_active = self.home_lineup_manager.get_active_players()
        away_active = self.away_lineup_manager.get_active_players()

        for player in home_active + away_active:
            self.time_on_court[player['name']] += duration_minutes

    def _is_starter(self, player_name: str) -> bool:
        """
        Check if player is a starter (high minutes allocation).

        Args:
            player_name: Player name

        Returns:
            True if player is in top 5 for their team (starter)
        """
        return player_name in self.home_starters or player_name in self.away_starters

    def _positions_compatible(self, pos1: str, pos2: str) -> bool:
        """
        Check if two positions are compatible for substitution.

        M4.5 PHASE 4: User's position groupings:
        - Guards: PG, SG
        - Wings: SF, PF
        - Bigs: C

        Args:
            pos1: First position
            pos2: Second position

        Returns:
            True if positions are in same group
        """
        guards = {'PG', 'SG'}
        wings = {'SF', 'PF'}

        # Same position always compatible
        if pos1 == pos2:
            return True

        # Guards compatible with guards
        if pos1 in guards and pos2 in guards:
            return True

        # Wings compatible with wings
        if pos1 in wings and pos2 in wings:
            return True

        # Center only compatible with center (already handled by pos1 == pos2)
        return False

    def _select_substitute_by_rules(
        self,
        bench_players: List[Dict[str, Any]],
        position_out: str,
        stamina_values: Dict[str, float],
        is_replacing_starter: bool,
        minimum_stamina: float = 90.0
    ) -> Optional[Dict[str, Any]]:
        """
        Select substitute following user's rules.

        M4.5 PHASE 4: Selection priority:
        1. Exact position match with stamina >= minimum_stamina (90+)
        2. Position group match with stamina >= minimum_stamina
           (Guards: PG/SG, Wings: SF/PF, Bigs: C)
        3. If no one meets minimum, use best available from position group
        4. Last resort: best available from entire bench

        BUG FIX: Avoid selecting starters whose tracked backup is still on court.
        If starter A has replacement B still playing, don't use A as substitute yet.

        Args:
            bench_players: Available bench players
            position_out: Position of player being replaced
            stamina_values: Current stamina for all players
            is_replacing_starter: True if replacing a starter
            minimum_stamina: Minimum stamina requirement (default 90)

        Returns:
            Selected player or None
        """
        if not bench_players:
            return None

        # BUG FIX: Filter out starters whose tracked replacement is still on court
        # These starters should wait to replace their specific backup via Rule #1
        eligible_bench = []
        for p in bench_players:
            # Check if this player is a starter with a tracked replacement
            if p['name'] in self.starter_replacement_map:
                # This starter has a tracked backup - check if backup is still on court
                backup_name = self.starter_replacement_map[p['name']]
                # Get active players from both teams
                home_active_names = {player['name'] for player in self.home_lineup_manager.get_active_players()}
                away_active_names = {player['name'] for player in self.away_lineup_manager.get_active_players()}
                all_active_names = home_active_names | away_active_names

                if backup_name in all_active_names:
                    # Backup is still on court - don't use this starter yet
                    # They should wait to replace their specific backup via Rule #1
                    continue

            # Player is eligible
            eligible_bench.append(p)

        # If no eligible players after filtering, fall back to original bench
        # (Edge case: all bench starters have replacements on court)
        if not eligible_bench:
            eligible_bench = bench_players

        # Priority 1: Exact position match with 85+ stamina
        exact_match_ready = [
            p for p in eligible_bench
            if p['position'] == position_out and stamina_values.get(p['name'], 0) >= minimum_stamina
        ]
        if exact_match_ready:
            # Return highest stamina
            return max(exact_match_ready, key=lambda p: stamina_values.get(p['name'], 0))

        # Priority 2: Position group match with 85+ stamina
        group_match_ready = [
            p for p in eligible_bench
            if self._positions_compatible(p['position'], position_out)
            and stamina_values.get(p['name'], 0) >= minimum_stamina
        ]
        if group_match_ready:
            # Return highest stamina
            return max(group_match_ready, key=lambda p: stamina_values.get(p['name'], 0))

        # Priority 3: Position group match (any stamina)
        group_match_any = [
            p for p in eligible_bench
            if self._positions_compatible(p['position'], position_out)
        ]
        if group_match_any:
            # Return highest stamina
            return max(group_match_any, key=lambda p: stamina_values.get(p['name'], 0))

        # Priority 4: Best available from entire bench (last resort)
        return max(eligible_bench, key=lambda p: stamina_values.get(p['name'], 0))

    def _should_substitute_mid_quarter(
        self,
        player: Dict[str, Any],
        stamina_tracker: Any,
        time_remaining_in_quarter: int,
        quarter_number: int
    ) -> Tuple[bool, str]:
        """
        Determine if player should be subbed out due to time on court.

        This enforces realistic rotation patterns:
        - Starters: sub out after 6-10 minutes continuous play
        - Bench: sub out after 2-4 minutes continuous play
        - Minimum 4 minutes on court before subbing (user requirement)
        - Stamina < 60: override time checks (immediate sub)

        Args:
            player: Player dict
            stamina_tracker: StaminaTracker instance
            time_remaining_in_quarter: Seconds remaining in quarter
            quarter_number: Current quarter (1-4)

        Returns:
            Tuple of (should_sub, reason)

        Priority:
            1. Stamina < 60 (handled elsewhere, but checked here for safety)
            2. Starter played 8+ minutes continuously (target rest)
            3. Bench played 3+ minutes continuously (target rest)
            4. Otherwise: no substitution
        """
        player_name = player['name']
        time_on_court = self.time_on_court.get(player_name, 0.0)
        current_stamina = stamina_tracker.get_current_stamina(player_name)
        is_starter = self._is_starter(player_name)

        # Safety: never sub out player who just came in (minimum 4 minutes)
        if time_on_court < 4.0:
            return (False, '')

        # Priority 1: Stamina check (immediate sub if fatigued)
        if current_stamina < 60.0:
            return (True, 'stamina')  # This is redundant with check_substitution_needed, but safe

        # Priority 2: Time-based substitution for starters (8+ minutes)
        # Use 8 minutes as target (middle of 6-10 range)
        if is_starter and time_on_court >= 8.0:
            return (True, 'time_on_court_starter')

        # Priority 3: Time-based substitution for bench (3+ minutes)
        # Use 3 minutes as target (middle of 2-4 range)
        if not is_starter and time_on_court >= 3.0:
            return (True, 'time_on_court_bench')

        # No substitution needed
        return (False, '')


# =============================================================================
# HELPER FUNCTIONS FOR MINUTES ALLOCATION
# =============================================================================

def calculate_quarter_allocations(
    total_allocations: Dict[str, int],
    quarter_number: int
) -> Dict[str, float]:
    """
    Convert game minutes to quarter targets.

    Args:
        total_allocations: {player_name: 48-minute allocation}
        quarter_number: 1-4

    Returns:
        {player_name: minutes for THIS quarter}

    Simple division: allocation / 4 for each quarter
    """
    quarter_allocations = {}

    for player_name, total_minutes in total_allocations.items():
        quarter_minutes = total_minutes / 4.0
        quarter_allocations[player_name] = quarter_minutes

    return quarter_allocations


def create_rotation_plans(
    roster: List[Dict[str, Any]],
    starting_lineup: List[Dict[str, Any]],
    minutes_allocation: Dict[str, float],
    quarter_length_seconds: int = 720  # 12 minutes
) -> List[RotationPlan]:
    """
    Create proactive rotation plans for all players based on minutes allocation.

    This function determines WHEN each player should sub in/out to meet their
    minutes target. It creates a realistic rotation pattern similar to NBA coaching.

    Strategy:
    - Starters (8+ min): Play first ~6 min, rest ~4 min, return for final ~2 min
    - Bench players (4-6 min): Sub in around 6:00, play their allocation, sub out
    - Deep bench (<3 min): Sub in late (garbage time or emergency)

    Args:
        roster: Full team roster
        starting_lineup: List of 5 starters
        minutes_allocation: Dict mapping player_name -> quarter_minutes (e.g., 8.0)
        quarter_length_seconds: Quarter length in seconds (default 720 = 12 min)

    Returns:
        List of RotationPlan objects (one per player with >0.5 min allocation)

    Q1 ROTATION FIX: This ensures ALL players get rotation plans, not just starters.
    """
    plans = []
    starter_names = {p['name'] for p in starting_lineup}

    for player in roster:
        player_name = player['name']
        quarter_minutes = minutes_allocation.get(player_name, 0.0)

        # Skip players with minimal allocation (<0.5 min = 30 seconds)
        if quarter_minutes < 0.5:
            continue

        is_starter = player_name in starter_names

        plan = RotationPlan(
            player_name=player_name,
            position=player['position'],
            quarter_minutes_target=quarter_minutes,
            is_starter=is_starter
        )

        if is_starter:
            # STARTER ROTATION: Play ~6 min, rest ~4 min, return for ~2 min
            # This gives starters ~8 min while allowing bench to play

            # First sub out: Around 6:00 remaining (360 seconds)
            plan.first_sub_out_time = 360  # 6:00 remaining

            # Return: Around 1:30 remaining (90 seconds)
            # This gives starter: 6 min initial + 1.5 min final = 7.5 min total
            # Slightly less than 8 min target, but avoids chaos at quarter end
            plan.return_time = 90  # 1:30 remaining

        else:
            # BENCH ROTATION: Sub in around 6:00, play allocation, sub out
            #
            # STRATEGY: Bench players come in when starters rest at 6:00.
            # No explicit sub timing needed - they naturally replace starters.
            # When starters return at 1:30, bench goes back to bench.
            #
            # This gives bench players: 6:00 - 1:30 = 4.5 minutes
            # Which works for:
            #   - 4.5 min allocation (Rui, Gabe, Max): Perfect match
            #   - 3.25 min allocation (Jarred, Jalen): Slightly over, but acceptable
            #
            # For players with <2.0 min allocation (garbage time only):
            #   Sub in very late (3:00 remaining) if there's an emergency

            if quarter_minutes < 2.0:
                # Garbage time only (e.g., Cam Reddish with 0.125 min)
                # Sub in at 3:00 if needed
                plan.bench_sub_in_time = 180  # 3:00 remaining
                # Don't sub out - play rest of quarter
            else:
                # Regular/deep bench (>= 2.0 min)
                # NO explicit timing - they come in when starters rest
                # This is handled automatically by the starter rotation
                pass

        plans.append(plan)

    return plans


def validate_minutes_allocation(
    allocations: Dict[str, int],
    team_size: int
) -> Tuple[bool, str]:
    """
    Validate minutes allocation dictionary.

    Args:
        allocations: Dict mapping player_name -> minutes
        team_size: Number of players on team

    Returns:
        Tuple of (is_valid, error_message)

    Validation rules:
        - Must total exactly 240 minutes (5 players * 48 minutes)
        - No player can have more than 48 minutes
        - No player can have negative minutes
    """
    total = sum(allocations.values())

    # Check total
    if abs(total - 240) > 0.1:  # Allow tiny floating point error
        return (False, f"Total minutes must be 240, got {total}")

    # Check individual allocations
    for player_name, minutes in allocations.items():
        if minutes < 0:
            return (False, f"Player {player_name} has negative minutes: {minutes}")
        if minutes > 48:
            return (False, f"Player {player_name} exceeds 48 minutes: {minutes}")

    return (True, "")
