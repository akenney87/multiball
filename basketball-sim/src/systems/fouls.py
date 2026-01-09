"""
Basketball Simulator - Fouls System (M3 Phase 2a)

Handles foul detection, tracking, and free throw allocation.

Key Responsibilities:
1. Detect shooting fouls (during shot attempts)
2. Detect non-shooting fouls (during drives, rebounds, off-ball)
3. Track personal fouls per player (6 = foul out)
4. Track team fouls per quarter (bonus at 5, double bonus at 10)
5. Allocate free throws based on foul type and bonus status
6. Detect rare flagrant and technical fouls

Integrates with:
- src/systems/possession.py (foul checks during possessions)
- src/systems/shooting.py (shooting foul checks)
- src/systems/free_throws.py (execute free throws)
- src/systems/substitutions.py (foul out triggers substitution)

NBA Rules:
- Personal fouls: 6 = disqualification
- Team fouls: Reset each quarter
- Bonus: 5+ team fouls → 2 free throws on non-shooting fouls
- Double bonus: 10+ team fouls (not used in NBA, but exists in college)
"""

from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
import random

from ..core.probability import calculate_composite, sigmoid
from ..constants import SIGMOID_K


# =============================================================================
# FOUL DATA STRUCTURES
# =============================================================================

@dataclass
class FoulEvent:
    """
    Record of a foul occurrence.

    Attributes:
        fouling_player: Name of player who committed foul
        fouled_player: Name of player who was fouled
        foul_type: 'shooting', 'non_shooting', 'flagrant', 'technical'
        quarter: Quarter number (1-4)
        game_time: Game clock when foul occurred
        free_throws_awarded: Number of free throws (0, 1, 2, or 3)
        and_one: True if shot was made (and-1 opportunity)
        fouling_team: 'Home' or 'Away'
        personal_fouls_after: Personal fouls for fouling player after this foul
        team_fouls_after: Team fouls after this foul
        fouled_out: True if this was player's 6th foul
        bonus_triggered: True if fouled team is in bonus (5+ team fouls)
    """
    fouling_player: str
    fouled_player: str
    foul_type: str
    quarter: int
    game_time: str
    free_throws_awarded: int
    and_one: bool
    fouling_team: str
    personal_fouls_after: int
    team_fouls_after: int
    fouled_out: bool
    bonus_triggered: bool = False


# =============================================================================
# FOUL PROBABILITY CONSTANTS
# =============================================================================

# Shooting foul base rates
# M4.5 PHASE 3: Tuned to achieve PF ~19-20, FTA ~22-24
# 2.5x produced: PF 19.1 (good), FTA 30.6 (too high, ratio 1.60)
# Reducing shooting fouls to 2.0x, increasing non-shooting to rebalance
# REALISM FIX: Reduced by 12% (×0.88) to hit NBA target of 19.5 fouls/team (was 22.1)
SHOOTING_FOUL_BASE_RATES = {
    'contested': 0.21,         # 21% for contested (2-6 ft) [Was 0.24]
    'heavily_contested': 0.35, # 35% for heavily contested (<2 ft) [Was 0.40]
    'wide_open': 0.035,        # 3.5% for wide open (6+ ft, rare) [Was 0.04]
}

# Shot type foul multipliers (USER FIX: Reduce 3PT foul frequency)
# 3PT fouls should be RARE (1-2 per game max), rim fouls more common
SHOT_TYPE_FOUL_MULTIPLIERS = {
    '3pt': 0.15,       # 85% reduction for 3PT fouls (extremely rare)
    'midrange': 0.40,  # 60% reduction for midrange fouls
    'layup': 1.0,      # Baseline (no change)
    'dunk': 1.2,       # 20% increase for dunks (more contact at rim)
}

# Non-shooting foul base rates
# M4.5 PHASE 3: Increased by 3.0x to rebalance PF/FTA ratio
# REALISM FIX: Reduced by 12% (×0.88) to hit NBA target of 19.5 fouls/team (was 22.1)
NON_SHOOTING_FOUL_BASE_RATE = 0.066  # 6.6% per possession (generic) [Was 0.075]

# Action-specific rates (used for different non-shooting foul contexts)
# M4.5 PHASE 3: Increased by 3.0x to maintain PF ~19-20 with lower FTA
# REALISM FIX: Reduced by 12% (×0.88) to hit NBA target of 19.5 fouls/team (was 22.1)
ACTION_FOUL_RATES = {
    'drive': 0.066,      # 6.6% during drives (reach-in fouls) [Was 0.075]
    'post_up': 0.055,    # 5.5% during post-ups (holding) [Was 0.063]
    'rebound': 0.032,    # 3.2% during rebounds (loose ball fouls) [Was 0.036]
    'off_ball': 0.018,   # 1.8% during off-ball movement (hand-checking/holding) [Was 0.021]
}

# Rare fouls
FLAGRANT_FOUL_RATE = 0.005   # 0.5% per game
TECHNICAL_FOUL_RATE = 0.003  # 0.3% per game

# Attribute weights for shooting fouls
# PHASE 2: Removed patience, redistributed weight proportionally
SHOOTING_FOUL_WEIGHTS_DEFENDER = {
    'composure': 0.375,     # +0.075 - staying calm under pressure
    'awareness': 0.3125,    # +0.0625 - knowing when NOT to foul
    'agility': 0.1875,      # +0.0375 - staying in front without contact
    'reactions': 0.125,     # +0.025 - quick hands without fouling
}

SHOOTING_FOUL_WEIGHTS_OFFENSE = {
    'bravery': 0.40,
    'agility': 0.30,
    'core_strength': 0.30,  # Finishing through contact
}


# =============================================================================
# FOUL SYSTEM CLASS
# =============================================================================

class FoulSystem:
    """
    Manages foul detection and tracking for a full game.

    Tracks personal fouls per player and team fouls per quarter.
    """

    def __init__(
        self,
        home_roster: List[Dict[str, Any]],
        away_roster: List[Dict[str, Any]]
    ):
        """
        Initialize foul tracking system.

        Args:
            home_roster: Full home team roster
            away_roster: Full away team roster
        """
        # Personal foul tracking (per player, cumulative across game)
        self.personal_fouls: Dict[str, int] = {}
        for player in home_roster + away_roster:
            self.personal_fouls[player['name']] = 0

        # Team foul tracking (per quarter, resets each quarter)
        self.team_fouls_home: int = 0
        self.team_fouls_away: int = 0

        # Foul event history
        self.foul_events: List[FoulEvent] = []

        # Track fouled-out players
        self.fouled_out_players: List[str] = []

        # Current quarter
        self.current_quarter: int = 1

    def reset_team_fouls_for_quarter(self, quarter: int) -> None:
        """
        Reset team fouls at start of new quarter.

        Args:
            quarter: New quarter number (1-4)
        """
        self.current_quarter = quarter
        self.team_fouls_home = 0
        self.team_fouls_away = 0

    def check_shooting_foul(
        self,
        shooter: Dict[str, Any],
        defender: Dict[str, Any],
        contest_distance: float,
        shot_type: str,
        shot_made: bool,
        defending_team: str,
        quarter: int,
        game_time: str
    ) -> Optional[FoulEvent]:
        """
        Check if shooting foul occurred on shot attempt.

        Args:
            shooter: Offensive player taking shot
            defender: Primary defender
            contest_distance: Distance to defender in feet
            shot_type: '3pt', 'midrange', 'layup', 'dunk'
            shot_made: True if shot was made
            defending_team: 'Home' or 'Away'
            quarter: Current quarter
            game_time: Game clock

        Returns:
            FoulEvent if foul occurred, None otherwise
        """
        # Determine contest level
        if contest_distance >= 6.0:
            contest_level = 'wide_open'
        elif contest_distance >= 2.0:
            contest_level = 'contested'
        else:
            contest_level = 'heavily_contested'

        # Get base rate
        base_rate = SHOOTING_FOUL_BASE_RATES[contest_level]

        # Calculate attribute composites
        defender_composite = calculate_composite(
            defender,
            SHOOTING_FOUL_WEIGHTS_DEFENDER
        )
        offense_composite = calculate_composite(
            shooter,
            SHOOTING_FOUL_WEIGHTS_OFFENSE
        )

        # Attribute modifier (offense draws fouls, defense avoids them)
        attribute_diff = offense_composite - defender_composite
        # Apply k=0.015 scaling before sigmoid
        scaled_diff = attribute_diff * 0.015
        attribute_modifier = sigmoid(scaled_diff) * base_rate

        # Apply shot type multiplier (USER FIX: Reduce 3PT foul frequency)
        shot_multiplier = SHOT_TYPE_FOUL_MULTIPLIERS.get(shot_type, 1.0)

        # Final probability
        foul_probability = (base_rate + attribute_modifier) * shot_multiplier
        foul_probability = max(0.0, min(0.30, foul_probability))  # Cap at 30%

        # Roll for foul
        if random.random() < foul_probability:
            # Foul occurred
            return self._record_shooting_foul(
                fouling_player=defender['name'],
                fouled_player=shooter['name'],
                shot_type=shot_type,
                shot_made=shot_made,
                fouling_team=defending_team,
                quarter=quarter,
                game_time=game_time
            )

        return None

    def check_non_shooting_foul(
        self,
        offensive_player: Dict[str, Any],
        defensive_player: Dict[str, Any],
        action_type: str,
        defending_team: str,
        quarter: int,
        game_time: str
    ) -> Optional[FoulEvent]:
        """
        Check if non-shooting foul occurred during action.

        Args:
            offensive_player: Offensive player
            defensive_player: Defensive player
            action_type: 'drive', 'post_up', 'rebound', 'off_ball'
            defending_team: 'Home' or 'Away'
            quarter: Current quarter
            game_time: Game clock

        Returns:
            FoulEvent if foul occurred, None otherwise
        """
        # Get base rate for action
        base_rate = ACTION_FOUL_RATES.get(action_type, NON_SHOOTING_FOUL_BASE_RATE)

        # Calculate attribute composites (same as shooting fouls)
        # Handle missing 'discipline' attribute (M3 new attribute)
        defender_copy = defensive_player.copy()
        if 'discipline' not in defender_copy:
            defender_copy['discipline'] = 50  # Default value

        defender_composite = calculate_composite(
            defender_copy,
            SHOOTING_FOUL_WEIGHTS_DEFENDER
        )
        offense_composite = calculate_composite(
            offensive_player,
            SHOOTING_FOUL_WEIGHTS_OFFENSE
        )

        # Attribute modifier
        attribute_diff = offense_composite - defender_composite
        # Apply k=0.015 scaling before sigmoid
        scaled_diff = attribute_diff * 0.015
        attribute_modifier = sigmoid(scaled_diff) * base_rate

        # Final probability
        foul_probability = base_rate + attribute_modifier
        foul_probability = max(0.0, min(0.20, foul_probability))  # Cap at 20%

        # Roll for foul
        if random.random() < foul_probability:
            # Foul occurred
            return self._record_non_shooting_foul(
                fouling_player=defensive_player['name'],
                fouled_player=offensive_player['name'],
                fouling_team=defending_team,
                quarter=quarter,
                game_time=game_time
            )

        return None

    def _record_shooting_foul(
        self,
        fouling_player: str,
        fouled_player: str,
        shot_type: str,
        shot_made: bool,
        fouling_team: str,
        quarter: int,
        game_time: str
    ) -> FoulEvent:
        """
        Record a shooting foul and allocate free throws.

        Args:
            fouling_player: Name of player who fouled
            fouled_player: Name of player who was fouled
            shot_type: '3pt', 'midrange', 'layup', 'dunk'
            shot_made: True if shot was made (and-1)
            fouling_team: 'Home' or 'Away'
            quarter: Current quarter
            game_time: Game clock

        Returns:
            FoulEvent
        """
        # Allocate free throws
        if shot_made:
            # And-1: 1 free throw
            free_throws = 1
            and_one = True
        elif shot_type == '3pt':
            # 3PT attempt: 3 free throws
            free_throws = 3
            and_one = False
        else:
            # 2PT attempt: 2 free throws
            free_throws = 2
            and_one = False

        # Update personal fouls
        self.personal_fouls[fouling_player] += 1
        personal_fouls_after = self.personal_fouls[fouling_player]

        # Update team fouls
        if fouling_team == 'Home':
            self.team_fouls_home += 1
            team_fouls_after = self.team_fouls_home
        else:
            self.team_fouls_away += 1
            team_fouls_after = self.team_fouls_away

        # Check if fouled out
        fouled_out = (personal_fouls_after >= 6)
        if fouled_out:
            self.fouled_out_players.append(fouling_player)

        # Check if fouled team is in bonus (opponent has 5+ fouls)
        bonus_triggered = (team_fouls_after >= 5)

        # Create foul event
        foul_event = FoulEvent(
            fouling_player=fouling_player,
            fouled_player=fouled_player,
            foul_type='shooting',
            quarter=quarter,
            game_time=game_time,
            free_throws_awarded=free_throws,
            and_one=and_one,
            fouling_team=fouling_team,
            personal_fouls_after=personal_fouls_after,
            team_fouls_after=team_fouls_after,
            fouled_out=fouled_out,
            bonus_triggered=bonus_triggered
        )

        self.foul_events.append(foul_event)
        return foul_event

    def _record_non_shooting_foul(
        self,
        fouling_player: str,
        fouled_player: str,
        fouling_team: str,
        quarter: int,
        game_time: str
    ) -> FoulEvent:
        """
        Record a non-shooting foul and allocate free throws based on bonus.

        Args:
            fouling_player: Name of player who fouled
            fouled_player: Name of player who was fouled
            fouling_team: 'Home' or 'Away'
            quarter: Current quarter
            game_time: Game clock

        Returns:
            FoulEvent
        """
        # Update personal fouls
        self.personal_fouls[fouling_player] += 1
        personal_fouls_after = self.personal_fouls[fouling_player]

        # Update team fouls
        if fouling_team == 'Home':
            self.team_fouls_home += 1
            team_fouls_after = self.team_fouls_home
        else:
            self.team_fouls_away += 1
            team_fouls_after = self.team_fouls_away

        # Check if fouled team is in bonus (opponent has 5+ fouls)
        bonus_triggered = (team_fouls_after >= 5)

        # Determine free throws based on bonus status
        if bonus_triggered:
            # Bonus: 2 free throws
            free_throws = 2
        else:
            # No bonus: side out (no free throws)
            free_throws = 0

        # Check if fouled out
        fouled_out = (personal_fouls_after >= 6)
        if fouled_out:
            self.fouled_out_players.append(fouling_player)

        # Create foul event
        foul_event = FoulEvent(
            fouling_player=fouling_player,
            fouled_player=fouled_player,
            foul_type='non_shooting',
            quarter=quarter,
            game_time=game_time,
            free_throws_awarded=free_throws,
            and_one=False,
            fouling_team=fouling_team,
            personal_fouls_after=personal_fouls_after,
            team_fouls_after=team_fouls_after,
            fouled_out=fouled_out,
            bonus_triggered=bonus_triggered
        )

        self.foul_events.append(foul_event)
        return foul_event

    def record_offensive_foul(
        self,
        fouling_player: str,
        defender_name: str,
        fouling_team: str,
        quarter: int,
        game_time: str
    ) -> FoulEvent:
        """
        Record an offensive foul (charging, illegal screen, etc.).

        Offensive fouls count toward personal and team fouls but never result in free throws.

        Args:
            fouling_player: Name of offensive player who fouled
            defender_name: Name of defender who drew the charge/was fouled
            fouling_team: 'Home' or 'Away'
            quarter: Current quarter
            game_time: Game clock

        Returns:
            FoulEvent
        """
        # Update personal fouls
        self.personal_fouls[fouling_player] += 1
        personal_fouls_after = self.personal_fouls[fouling_player]

        # Update team fouls
        if fouling_team == 'Home':
            self.team_fouls_home += 1
            team_fouls_after = self.team_fouls_home
        else:
            self.team_fouls_away += 1
            team_fouls_after = self.team_fouls_away

        # Check if fouled out
        fouled_out = (personal_fouls_after >= 6)
        if fouled_out:
            self.fouled_out_players.append(fouling_player)

        # Create foul event
        foul_event = FoulEvent(
            fouling_player=fouling_player,
            fouled_player=defender_name,
            foul_type='offensive',
            quarter=quarter,
            game_time=game_time,
            free_throws_awarded=0,  # Offensive fouls never award FTs
            and_one=False,
            fouling_team=fouling_team,
            personal_fouls_after=personal_fouls_after,
            team_fouls_after=team_fouls_after,
            fouled_out=fouled_out,
            bonus_triggered=False  # Not applicable for offensive fouls
        )

        self.foul_events.append(foul_event)
        return foul_event

    def is_fouled_out(self, player_name: str) -> bool:
        """
        Check if player has fouled out.

        Args:
            player_name: Player to check

        Returns:
            True if player has 6+ personal fouls
        """
        return player_name in self.fouled_out_players

    def get_personal_fouls(self, player_name: str) -> int:
        """
        Get personal foul count for player.

        Args:
            player_name: Player to check

        Returns:
            Number of personal fouls (0-6)
        """
        return self.personal_fouls.get(player_name, 0)

    def get_team_fouls(self, team: str) -> int:
        """
        Get team foul count for current quarter.

        Args:
            team: 'Home' or 'Away'

        Returns:
            Number of team fouls in current quarter
        """
        if team == 'Home':
            return self.team_fouls_home
        else:
            return self.team_fouls_away

    def is_in_bonus(self, team: str) -> bool:
        """
        Check if team is in bonus (opponent has 5+ team fouls).

        Args:
            team: 'Home' or 'Away' (offensive team)

        Returns:
            True if opponent is in bonus
        """
        opponent_team = 'Away' if team == 'Home' else 'Home'
        return self.get_team_fouls(opponent_team) >= 5

    def get_foul_summary(self) -> Dict[str, Any]:
        """
        Get summary of foul statistics.

        Returns:
            Dict with foul counts and rates
        """
        total_fouls = len(self.foul_events)
        shooting_fouls = sum(1 for f in self.foul_events if f.foul_type == 'shooting')
        non_shooting_fouls = sum(1 for f in self.foul_events if f.foul_type == 'non_shooting')
        fouled_out_count = len(self.fouled_out_players)

        return {
            'total_fouls': total_fouls,
            'shooting_fouls': shooting_fouls,
            'non_shooting_fouls': non_shooting_fouls,
            'fouled_out_players': self.fouled_out_players.copy(),
            'fouled_out_count': fouled_out_count,
            'foul_events': self.foul_events,
        }

    def trigger_intentional_foul(
        self,
        fouling_player: str,
        fouled_player: str,
        fouling_team: str,
        quarter: int,
        game_time: str
    ) -> FoulEvent:
        """
        Trigger an intentional foul (M3 End-game Logic).

        Used when trailing team intentionally fouls to stop clock in final minute.
        Always treated as non-shooting foul (awards FTs if in bonus, side out otherwise).

        Args:
            fouling_player: Name of player committing intentional foul
            fouled_player: Name of player being fouled
            fouling_team: 'Home' or 'Away'
            quarter: Current quarter
            game_time: Game clock

        Returns:
            FoulEvent with appropriate FT allocation
        """
        # Intentional fouls are non-shooting fouls
        # Use existing non-shooting foul recording logic
        return self._record_non_shooting_foul(
            fouling_player=fouling_player,
            fouled_player=fouled_player,
            fouling_team=fouling_team,
            quarter=quarter,
            game_time=game_time
        )
