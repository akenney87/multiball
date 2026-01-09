"""
Basketball Simulator - Stamina Management System

Handles stamina tracking, depletion, and recovery for all players across a quarter.

Key Responsibilities:
1. Track current stamina for all players (active + bench)
2. Apply per-possession stamina costs (based on pace, role)
3. Apply exponential bench recovery
4. Generate degraded player copies (with reduced attributes)
5. Validate stamina bounds [0, 100]

Integrates with:
- src/core/probability.py (apply_stamina_to_player)
- src/systems/quarter_simulation.py (called each possession)
"""

from typing import Dict, List, Any, Optional
from ..core.probability import apply_stamina_to_player
from ..constants import (
    STAMINA_RECOVERY_RATE,
    STAMINA_DRAIN_RATE_MAX_MODIFIER,
    STAMINA_RECOVERY_RATE_MAX_MODIFIER,
)


# =============================================================================
# STAMINA COST CALCULATION
# =============================================================================

def calculate_stamina_cost(
    pace: str,
    is_scoring_option: bool = False,
    is_transition: bool = False,
    player_stamina_attribute: int = 50,  # M4.5 PHASE 4B: Player's stamina rating (1-100)
    player_acceleration: int = 50,       # PHASE 1: Player's acceleration (1-100)
    player_top_speed: int = 50           # PHASE 1: Player's top_speed (1-100)
) -> float:
    """
    Calculate stamina cost for a single possession.

    Args:
        pace: 'fast', 'standard', 'slow'
        is_scoring_option: True if player is scoring option #1/2/3
        is_transition: True if possession is transition
        player_stamina_attribute: Player's stamina rating (1-100, default 50 for average)
        player_acceleration: Player's acceleration (1-100, default 50 for average)
        player_top_speed: Player's top_speed (1-100, default 50 for average)

    Returns:
        Stamina cost (positive float)

    Formula (Milestone 2 specification + M4.5 Phase 4B + PHASE 1 + PHASE 3B):
        Base cost: 0.8 stamina per possession
        Pace modifier: fast +0.3, standard +0.0, slow -0.3
        Scoring option bonus: +0.2 (higher usage = more fatigue)
        Transition bonus: +0.1 (more running)
        PHASE 3B stamina drain rate modifier: ±15% based on player endurance
        Speed efficiency modifier: ±10% based on acceleration + top_speed

    PHASE 3B: Stamina Drain Rate Modifier (replaces M4.5 Phase 4B)
        - High stamina (90): cost × 0.88 (drains 12% slower)
        - Average stamina (50): cost × 1.00 (baseline)
        - Low stamina (10): cost × 1.12 (drains 12% faster)

    PHASE 1: Speed Efficiency Integration
        - Fast players (accel+speed avg 80): cost × 0.90 (10% more efficient)
        - Average players (accel+speed avg 50): cost × 1.00 (baseline)
        - Slow players (accel+speed avg 20): cost × 1.10 (10% less efficient)

    Examples:
        Standard pace, non-option, 50 stamina, 50 speed: 0.8 × 1.0 × 1.0 = 0.8
        Standard pace, non-option, 90 stamina, 80 speed: 0.8 × 0.88 × 0.9 = 0.634 (elite endurance + speed)
        Fast pace, scoring option #1, 50 stamina, 50 speed: (0.8 + 0.3 + 0.2) × 1.0 × 1.0 = 1.3
    """
    base_cost = 0.8

    # Pace modifier
    pace_modifier = 0.0
    if pace == 'fast':
        pace_modifier = 0.3
    elif pace == 'slow':
        pace_modifier = -0.3
    # 'standard' remains 0.0

    # Scoring option bonus
    scoring_option_bonus = 0.2 if is_scoring_option else 0.0

    # Transition bonus
    transition_bonus = 0.1 if is_transition else 0.0

    total_cost = base_cost + pace_modifier + scoring_option_bonus + transition_bonus

    # PHASE 3B: Apply stamina attribute DRAIN RATE modifier (±15% range)
    # Stamina attribute affects how fast a player fatigues, not outcomes
    # Formula: 1.0 + ((50 - stamina_attr) / 50) * STAMINA_DRAIN_RATE_MAX_MODIFIER
    # High stamina = slower drain (cost reduced)
    # Low stamina = faster drain (cost increased)
    stamina_drain_rate_modifier = 1.0 + ((50 - player_stamina_attribute) / 50.0) * STAMINA_DRAIN_RATE_MAX_MODIFIER
    # stamina=90: 1.0 + (-40/50)*0.15 = 1.0 - 0.12 = 0.88 (12% slower drain) ✓
    # stamina=50: 1.0 + (0/50)*0.15 = 1.0 (baseline) ✓
    # stamina=10: 1.0 + (40/50)*0.15 = 1.0 + 0.12 = 1.12 (12% faster drain) ✓

    # PHASE 1: Speed efficiency modifier (acceleration + top_speed)
    # Fast players are more efficient with their movements, use less energy
    # Formula: avg_speed = (acceleration + top_speed) / 2
    # speed_efficiency_modifier = 1.0 - (avg_speed - 50) * 0.002
    # avg_speed=80: 1.0 - 30*0.002 = 0.94 (6% more efficient)
    # avg_speed=50: 1.0 - 0 = 1.0 (baseline)
    # avg_speed=20: 1.0 - (-30)*0.002 = 1.06 (6% less efficient)
    avg_speed = (player_acceleration + player_top_speed) / 2.0
    speed_efficiency_modifier = 1.0 - (avg_speed - 50) * 0.002  # ±10% for ±50 difference

    total_cost_with_modifiers = total_cost * stamina_drain_rate_modifier * speed_efficiency_modifier

    return max(0.0, total_cost_with_modifiers)  # Cannot have negative cost


def recover_stamina(
    current_stamina: float,
    minutes_on_bench: float,
    player_stamina_attribute: int = 50  # M4.5 PHASE 4B: Player's stamina rating (1-100)
) -> float:
    """
    Calculate stamina recovery for bench player (exponential curve).

    Args:
        current_stamina: Current stamina value (0-100)
        minutes_on_bench: Time spent on bench in minutes
        player_stamina_attribute: Player's stamina rating (1-100, default 50 for average)

    Returns:
        Recovered stamina amount (positive float)

    Formula (from basketball_sim.md Section 11.3 + M4.5 Phase 4B + PHASE 3B):
        recovery_per_minute = 8 * (1 - current_stamina / 100) * recovery_rate_modifier
        total_recovery = recovery_per_minute * minutes_on_bench

    PHASE 3B: Stamina Recovery Rate Modifier (replaces M4.5 Phase 4B)
        - High stamina (90): recovery × 1.104 (recovers 10.4% faster)
        - Average stamina (50): recovery × 1.00 (baseline)
        - Low stamina (10): recovery × 0.896 (recovers 10.4% slower)

    Characteristics:
        - Exponential diminishing returns (recover faster when more tired)
        - Stamina attribute affects recovery RATE (high endurance = faster bounce-back)
        - At stamina=0, 50 attr: recover 8 per minute
        - At stamina=0, 90 attr: recover 8.83 per minute (elite recovery)
        - At stamina=50, 50 attr: recover 4 per minute
        - At stamina=90, 50 attr: recover 0.8 per minute
        - Never exceeds 100

    Examples:
        current=50, minutes=1.0, stamina_attr=50 → recovery = 8 * 0.5 * 1.0 * 1.0 = 4.0
        current=50, minutes=1.0, stamina_attr=90 → recovery = 8 * 0.5 * 1.0 * 1.104 = 4.416
        current=50, minutes=1.0, stamina_attr=10 → recovery = 8 * 0.5 * 1.0 * 0.896 = 3.584
        current=80, minutes=2.0, stamina_attr=50 → recovery = 8 * 0.2 * 2.0 * 1.0 = 3.2
    """
    # Clamp current stamina to valid range
    current_stamina = max(0.0, min(100.0, current_stamina))

    # PHASE 3B: Apply stamina attribute RECOVERY RATE modifier (±13% range)
    # Stamina attribute affects how fast a player recovers on bench
    # Formula: 1.0 + ((stamina_attr - 50) / 50) * STAMINA_RECOVERY_RATE_MAX_MODIFIER
    # High stamina = faster recovery (recovery increased)
    # Low stamina = slower recovery (recovery decreased)
    stamina_recovery_rate_modifier = 1.0 + ((player_stamina_attribute - 50) / 50.0) * STAMINA_RECOVERY_RATE_MAX_MODIFIER
    # stamina=90: 1.0 + (40/50)*0.13 = 1.0 + 0.104 = 1.104 (10.4% faster recovery) ✓
    # stamina=50: 1.0 + (0/50)*0.13 = 1.0 (baseline) ✓
    # stamina=10: 1.0 + (-40/50)*0.13 = 1.0 - 0.104 = 0.896 (10.4% slower recovery) ✓

    # Exponential recovery formula with stamina attribute modifier
    recovery_per_minute = STAMINA_RECOVERY_RATE * (1.0 - current_stamina / 100.0) * stamina_recovery_rate_modifier
    total_recovery = recovery_per_minute * minutes_on_bench

    return max(0.0, total_recovery)  # Cannot recover negative


# =============================================================================
# STAMINA TRACKER CLASS
# =============================================================================

class StaminaTracker:
    """
    Centralized stamina management for all players in a quarter.

    Tracks current stamina for all players (active + bench) and provides
    methods to apply costs, recover, and generate degraded player copies.

    Attributes:
        stamina_state: Dict[player_name -> current_stamina]
        original_players: Dict[player_name -> original_player_dict]
        minutes_played: Dict[player_name -> minutes_played]
    """

    def __init__(self, all_players: List[Dict[str, Any]]):
        """
        Initialize stamina tracker with full roster.

        Args:
            all_players: List of all players (both teams, full roster)
                Each player must have 'name' and 'stamina' attributes
        """
        self.stamina_state: Dict[str, float] = {}
        self.original_players: Dict[str, Dict[str, Any]] = {}
        self.minutes_played: Dict[str, float] = {}

        for player in all_players:
            player_name = player['name']

            # BUG FIX: All players start at 100 stamina regardless of their stamina attribute
            # The stamina attribute only affects drain/recovery rates, not initial values
            initial_stamina = 100.0
            self.stamina_state[player_name] = float(initial_stamina)

            # Store original player dict for reference
            self.original_players[player_name] = player

            # Initialize minutes played to 0
            self.minutes_played[player_name] = 0.0

    def get_current_stamina(self, player_name: str) -> float:
        """
        Get current stamina value for a player.

        Args:
            player_name: Name of player

        Returns:
            Current stamina (0-100)

        Raises:
            KeyError: If player not found
        """
        if player_name not in self.stamina_state:
            raise KeyError(f"Player '{player_name}' not found in stamina tracker")

        return self.stamina_state[player_name]

    def apply_possession_cost(
        self,
        active_players: List[Dict[str, Any]],
        pace: str,
        scoring_options: Optional[List[str]] = None,
        is_transition: bool = False
    ) -> None:
        """
        Apply stamina cost to all active players after a possession.

        Modifies stamina_state in-place.

        Args:
            active_players: List of 5 active players (offense + defense)
            pace: 'fast', 'standard', 'slow'
            scoring_options: List of player names who are scoring options
            is_transition: True if possession was transition

        Side Effects:
            Updates stamina_state for all active players
            Clamps stamina to [0, 100]
        """
        if scoring_options is None:
            scoring_options = []

        for player in active_players:
            player_name = player['name']

            # Check if player is a scoring option
            is_scoring_option = player_name in scoring_options

            # M4.5 PHASE 4B: Get player's stamina attribute (endurance rating 1-100)
            player_stamina_attr = player.get('stamina', 50)

            # PHASE 1: Get player's speed attributes for efficiency calculation
            player_accel = player.get('acceleration', 50)
            player_speed = player.get('top_speed', 50)

            # Calculate stamina cost with player's attributes
            cost = calculate_stamina_cost(
                pace, is_scoring_option, is_transition,
                player_stamina_attr, player_accel, player_speed
            )

            # Deduct from stamina state
            current = self.stamina_state[player_name]
            new_stamina = current - cost

            # Clamp to [0, 100]
            self.stamina_state[player_name] = max(0.0, min(100.0, new_stamina))

    def recover_bench_stamina(
        self,
        bench_players: List[Dict[str, Any]],
        minutes_elapsed: float
    ) -> None:
        """
        Apply stamina recovery to all bench players.

        Modifies stamina_state in-place.

        Args:
            bench_players: List of players currently on bench
            minutes_elapsed: Time elapsed since last recovery (in minutes)

        Side Effects:
            Updates stamina_state for all bench players
            Clamps stamina to [0, 100] (never exceeds max)
        """
        for player in bench_players:
            player_name = player['name']

            # Get current stamina
            current = self.stamina_state[player_name]

            # M4.5 PHASE 4B: Get player's stamina attribute (endurance rating 1-100)
            player_stamina_attr = player.get('stamina', 50)

            # Calculate recovery with player's stamina attribute
            recovery = recover_stamina(current, minutes_elapsed, player_stamina_attr)

            # Add to stamina state
            new_stamina = current + recovery

            # Clamp to [0, 100]
            self.stamina_state[player_name] = max(0.0, min(100.0, new_stamina))

    def get_degraded_player(self, player: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate player copy with attributes degraded by current stamina.

        Uses apply_stamina_to_player() from probability.py.

        Args:
            player: Original player dict

        Returns:
            New player dict with degraded attributes (if stamina < 80)

        Note:
            Does NOT modify stamina_state or original player.
            Creates a new dict with current stamina value applied.
        """
        player_name = player['name']
        current_stamina = self.get_current_stamina(player_name)

        # Use the stamina degradation function from probability.py
        degraded_player = apply_stamina_to_player(player, current_stamina)

        return degraded_player

    def add_minutes(self, player_name: str, seconds: float) -> None:
        """
        Add playing time to a player's minutes tracker.

        Args:
            player_name: Name of player
            seconds: Seconds played to add

        Side Effects:
            Updates minutes_played for player
        """
        if player_name not in self.minutes_played:
            raise KeyError(f"Player '{player_name}' not found in minutes tracker")

        # Convert seconds to minutes
        minutes = seconds / 60.0
        self.minutes_played[player_name] += minutes

    def get_minutes_played(self, player_name: str) -> float:
        """
        Get total minutes played for a player.

        Args:
            player_name: Name of player

        Returns:
            Minutes played (in minutes, not seconds)

        Raises:
            KeyError: If player not found
        """
        if player_name not in self.minutes_played:
            raise KeyError(f"Player '{player_name}' not found in minutes tracker")

        return self.minutes_played[player_name]

    def reset_stamina(self, player_name: str) -> None:
        """
        Reset player stamina to original value.

        Useful for testing or quarter breaks.

        Args:
            player_name: Name of player to reset
        """
        if player_name not in self.original_players:
            raise KeyError(f"Player '{player_name}' not found in original players")

        original_player = self.original_players[player_name]
        original_stamina = original_player.get('stamina', 100.0)
        self.stamina_state[player_name] = float(original_stamina)

    def reset_quarter(self) -> None:
        """
        Reset all stamina to 100 for new quarter, keep minutes played.

        Used at quarter breaks to refresh stamina while maintaining
        game-long minutes tracking.
        """
        for player_name in self.stamina_state:
            self.stamina_state[player_name] = 100.0

    def reset_game(self) -> None:
        """
        Reset all stamina to 100 and clear minutes played for new game.

        Used at game start to completely reset all tracking.
        """
        for player_name in self.stamina_state:
            self.stamina_state[player_name] = 100.0
            self.minutes_played[player_name] = 0.0

    def get_all_stamina_values(self) -> Dict[str, float]:
        """
        Get current stamina for all players.

        Returns:
            Dict mapping player_name -> current_stamina
        """
        return self.stamina_state.copy()


# =============================================================================
# HELPER FUNCTIONS FOR INTEGRATION
# =============================================================================

def apply_stamina_cost(
    tracker: StaminaTracker,
    active_players: List[str],
    pace: str,
    scoring_options: List[str]
) -> None:
    """
    Deplete stamina for active players after possession.

    Convenience wrapper for StaminaTracker.apply_possession_cost().

    Args:
        tracker: StaminaTracker instance
        active_players: List of player names (strings) who were active
        pace: 'fast', 'standard', 'slow'
        scoring_options: List of player names who are scoring options
    """
    # Convert player names to player dicts
    active_player_dicts = []
    for player_name in active_players:
        if player_name in tracker.original_players:
            active_player_dicts.append(tracker.original_players[player_name])

    tracker.apply_possession_cost(active_player_dicts, pace, scoring_options, is_transition=False)


def recover_bench_stamina(
    tracker: StaminaTracker,
    bench_players: List[str]
) -> None:
    """
    Recover stamina for bench players.

    Note: This function assumes a default recovery period.
    For precise control, use tracker.recover_bench_stamina() directly.

    Args:
        tracker: StaminaTracker instance
        bench_players: List of player names (strings) on bench
    """
    # Default recovery period: 1 possession (~30 seconds = 0.5 minutes)
    default_recovery_minutes = 0.5

    # Convert player names to player dicts
    bench_player_dicts = []
    for player_name in bench_players:
        if player_name in tracker.original_players:
            bench_player_dicts.append(tracker.original_players[player_name])

    tracker.recover_bench_stamina(bench_player_dicts, default_recovery_minutes)


def get_degraded_team(
    team: List[Dict],
    tracker: StaminaTracker
) -> List[Dict]:
    """
    Return team with stamina-degraded attributes.

    Creates new player dicts with attributes modified by current stamina.
    Does NOT modify original team list.

    Args:
        team: List of player dicts (original)
        tracker: StaminaTracker instance

    Returns:
        List of degraded player dicts
    """
    degraded_team = []

    for player in team:
        degraded_player = tracker.get_degraded_player(player)
        degraded_team.append(degraded_player)

    return degraded_team
