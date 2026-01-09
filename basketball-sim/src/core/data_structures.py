"""
Basketball Simulator - Core Data Structures

Defines Player, PossessionContext, TacticalSettings, and output structures.
"""

from dataclasses import dataclass, field
from typing import Optional, Dict, List, Any


@dataclass
class PossessionContext:
    """
    Context for a single possession (Section 2.2).

    Attributes:
        is_transition: Whether this is a transition possession
        shot_clock: Seconds remaining on shot clock (24 or 14)
        score_differential: Positive = offense ahead, negative = defense ahead
        game_time_remaining: Total seconds left in game
        quarter: Current quarter (1-4)
        offensive_team: Which team has possession ('home' or 'away')
    """
    is_transition: bool = False
    shot_clock: int = 24
    score_differential: int = 0
    game_time_remaining: int = 2880  # 48 minutes = 2880 seconds
    quarter: int = 1  # M3 End-game: Need quarter for end-game mode detection
    offensive_team: str = 'home'  # M3 End-game: Need to know which team has possession


@dataclass
class EndGameModifiers:
    """
    Modifiers for end-game situations (M3 End-game Logic).

    Attributes:
        active_modes: List of currently active mode names
        shot_clock_target: Target seconds on shot clock before shooting (Clock Kill Mode)
        game_clock_target: Target seconds on game clock to shoot at (Last Second Shot modes)
        shot_distribution_3pt_adj: Additive adjustment to 3PT% (+0.20 = +20%)
        pace_multiplier: Multiplicative pace adjustment (1.10 = 10% faster)
        force_shot_type: Force specific shot type ('3pt' when down 3)
        trigger_intentional_foul: Flag to trigger intentional foul
        foul_target: Name of player to intentionally foul (worst FT shooter)
    """
    active_modes: List[str] = field(default_factory=list)
    shot_clock_target: Optional[float] = None
    game_clock_target: Optional[float] = None
    shot_distribution_3pt_adj: float = 0.0
    pace_multiplier: float = 1.0
    force_shot_type: Optional[str] = None
    trigger_intentional_foul: bool = False
    foul_target: Optional[str] = None


@dataclass
class TacticalSettings:
    """
    Team tactical configuration (Section 2.2).

    Attributes:
        pace: 'fast', 'standard', or 'slow'
        man_defense_pct: Percentage using man defense (0-100)
        scoring_option_1/2/3: Player name or None
        minutes_allotment: Dict mapping player name to minutes (must sum to 240)
        rebounding_strategy: 'crash_glass', 'standard', or 'prevent_transition'
        closers: List of player names who should stay on floor in close games (M3)
        timeout_strategy: 'aggressive', 'standard', or 'conservative' (M3 Phase 2c)
    """
    pace: str = 'standard'
    man_defense_pct: int = 50
    scoring_option_1: Optional[str] = None
    scoring_option_2: Optional[str] = None
    scoring_option_3: Optional[str] = None
    minutes_allotment: Dict[str, int] = field(default_factory=dict)
    rebounding_strategy: str = 'standard'
    closers: Optional[List[str]] = None  # M3: Top 5-7 players for close games
    timeout_strategy: str = 'standard'  # M3 Phase 2c: 'aggressive', 'standard', 'conservative'

    def validate(self):
        """Validate tactical settings."""
        if self.pace not in ['fast', 'standard', 'slow']:
            raise ValueError(f"Invalid pace: {self.pace}")

        if not 0 <= self.man_defense_pct <= 100:
            raise ValueError(f"Invalid man_defense_pct: {self.man_defense_pct}")

        if self.rebounding_strategy not in ['crash_glass', 'standard', 'prevent_transition']:
            raise ValueError(f"Invalid rebounding_strategy: {self.rebounding_strategy}")

        if self.minutes_allotment:
            total_minutes = sum(self.minutes_allotment.values())
            if total_minutes != 240:
                raise ValueError(f"Minutes allotment must sum to 240, got {total_minutes}")


@dataclass
class SigmoidCalculation:
    """
    Debug information for a single sigmoid calculation.

    Tracks all inputs and outputs for transparency.
    """
    calculation_type: str  # e.g., '3pt_shot', 'contest_penalty', 'drive_dunk'
    offensive_composite: float
    defensive_composite: float
    attribute_diff: float
    base_rate: float
    sigmoid_input: float  # -k * attribute_diff
    sigmoid_output: float  # 1 / (1 + exp(-sigmoid_input))
    final_probability: float
    modifiers: Dict[str, float] = field(default_factory=dict)  # e.g., {'transition': 0.20}


@dataclass
class PossessionResult:
    """
    Complete result of a single possession simulation (Section 13.3).
    """
    # Core outcome
    play_by_play_text: str
    possession_outcome: str  # 'made_shot', 'missed_shot', 'turnover', 'foul'
    scoring_player: Optional[str] = None
    assist_player: Optional[str] = None
    rebound_player: Optional[str] = None
    points_scored: int = 0
    foul_event: Optional[Any] = None  # FoulEvent if foul occurred
    free_throw_result: Optional[Any] = None  # FreeThrowResult if free throws taken

    # M4.5 PHASE 2 FIX: Track which team was on offense
    # This fixes stats attribution bug when teams have identical player names
    offensive_team: str = 'home'  # 'home' or 'away'

    # M3 END-GAME FIX: Track actual time elapsed (for intentional fouls)
    # When set, quarter simulation uses this instead of calculated possession duration
    # This ensures fouling team gets remaining time for their possession
    elapsed_time_seconds: Optional[float] = None

    # Debug information
    debug: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'play_by_play_text': self.play_by_play_text,
            'possession_outcome': self.possession_outcome,
            'scoring_player': self.scoring_player,
            'assist_player': self.assist_player,
            'rebound_player': self.rebound_player,
            'points_scored': self.points_scored,
            'debug': self.debug,
        }


def create_player(
    name: str,
    position: str,
    **attributes
) -> Dict[str, Any]:
    """
    Create a player dictionary with all 25 attributes.

    Args:
        name: Player name
        position: PG, SG, SF, PF, or C
        **attributes: All 25 attributes (grip_strength, arm_strength, etc.)

    Returns:
        Player dictionary

    Raises:
        ValueError: If required attributes are missing
    """
    from ..constants import ALL_ATTRIBUTES

    player = {
        'name': name,
        'position': position,
    }

    # Validate all attributes are present
    missing = set(ALL_ATTRIBUTES) - set(attributes.keys())
    if missing:
        raise ValueError(f"Missing attributes for {name}: {missing}")

    # Add all attributes
    player.update(attributes)

    return player


def validate_player(player: Dict[str, Any]) -> bool:
    """
    Validate player has all required attributes in valid ranges.

    Args:
        player: Player dictionary

    Returns:
        True if valid

    Raises:
        ValueError: If validation fails
    """
    from ..constants import ALL_ATTRIBUTES, ATTRIBUTE_MIN, ATTRIBUTE_MAX

    # Check name and position
    if 'name' not in player:
        raise ValueError("Player missing 'name' field")

    if 'position' not in player:
        raise ValueError(f"Player {player['name']} missing 'position' field")

    if player['position'] not in ['PG', 'SG', 'SF', 'PF', 'C']:
        raise ValueError(f"Invalid position: {player['position']}")

    # Check all attributes present
    missing = set(ALL_ATTRIBUTES) - set(player.keys())
    if missing:
        raise ValueError(f"Player {player['name']} missing attributes: {missing}")

    # Check attribute ranges
    for attr in ALL_ATTRIBUTES:
        value = player[attr]
        if not isinstance(value, (int, float)):
            raise ValueError(f"Player {player['name']} attribute {attr} must be numeric, got {type(value)}")

        if not ATTRIBUTE_MIN <= value <= ATTRIBUTE_MAX:
            raise ValueError(
                f"Player {player['name']} attribute {attr} = {value} "
                f"out of range [{ATTRIBUTE_MIN}, {ATTRIBUTE_MAX}]"
            )

    return True


def validate_team(team: List[Dict[str, Any]]) -> bool:
    """
    Validate team has exactly 5 players with valid data.

    Args:
        team: List of player dictionaries

    Returns:
        True if valid

    Raises:
        ValueError: If validation fails
    """
    if len(team) != 5:
        raise ValueError(f"Team must have exactly 5 players, got {len(team)}")

    for player in team:
        validate_player(player)

    return True
