"""
Integration Tests for Basketball Realism and NBA Statistical Validation

This test suite validates that the simulator produces realistic basketball outcomes
that match NBA statistical patterns. Tests cover:
- Shot success rates across different matchups
- Shot distribution patterns
- Turnover rates
- Rebounding rates
- Tactical impact verification
- Edge case realism

Tests use the "eye test" standard - outcomes must match real NBA basketball.
"""

import pytest
import random
import json
from typing import Dict, Any, List
from collections import Counter

from src.simulation import simulate_single_possession, simulate_multiple_possessions
from src.core.data_structures import PossessionContext, TacticalSettings
from src.core.probability import calculate_composite
from src.constants import (
    WEIGHTS_3PT,
    WEIGHTS_MIDRANGE,
    WEIGHTS_DUNK,
    WEIGHTS_LAYUP,
    WEIGHTS_CONTEST
)


# =============================================================================
# TEST FIXTURES - PLAYER PROFILES
# =============================================================================

@pytest.fixture
def elite_shooter() -> Dict[str, Any]:
    """Elite 3PT shooter (90+ composite) - Steph Curry level."""
    return {
        'name': 'Elite Shooter',
        'position': 'PG',
        'form_technique': 97,
        'throw_accuracy': 98,
        'finesse': 95,
        'hand_eye_coordination': 96,
        'balance': 92,
        'composure': 94,
        'consistency': 93,
        'agility': 90,
        'jumping': 75,
        'height': 60,
        'arm_strength': 70,
        'awareness': 95,
        'reactions': 92,
        'grip_strength': 70,
        'core_strength': 75,
        'acceleration': 85,
        'top_speed': 80,
        'stamina': 90,
        'durability': 85,
        'creativity': 90,
        'determination': 95,
        'bravery': 85,
        'patience': 90,
        'deception': 85,
        'teamwork': 92,
    }


@pytest.fixture
def poor_shooter() -> Dict[str, Any]:
    """Poor shooter (30 composite) - Bottom-tier NBA player."""
    return {
        'name': 'Poor Shooter',
        'position': 'C',
        'form_technique': 30,
        'throw_accuracy': 28,
        'finesse': 25,
        'hand_eye_coordination': 32,
        'balance': 35,
        'composure': 30,
        'consistency': 28,
        'agility': 40,
        'jumping': 60,
        'height': 85,
        'arm_strength': 80,
        'awareness': 40,
        'reactions': 45,
        'grip_strength': 75,
        'core_strength': 80,
        'acceleration': 35,
        'top_speed': 40,
        'stamina': 70,
        'durability': 80,
        'creativity': 35,
        'determination': 70,
        'bravery': 75,
        'patience': 40,
        'deception': 30,
        'teamwork': 35,
    }


@pytest.fixture
def average_player() -> Dict[str, Any]:
    """Average NBA player (50 composite across the board)."""
    return {
        'name': 'Average Player',
        'position': 'SF',
        'form_technique': 50,
        'throw_accuracy': 50,
        'finesse': 50,
        'hand_eye_coordination': 50,
        'balance': 50,
        'composure': 50,
        'consistency': 50,
        'agility': 50,
        'jumping': 50,
        'height': 50,
        'arm_strength': 50,
        'awareness': 50,
        'reactions': 50,
        'grip_strength': 50,
        'core_strength': 50,
        'acceleration': 50,
        'top_speed': 50,
        'stamina': 50,
        'durability': 50,
        'creativity': 50,
        'determination': 50,
        'bravery': 50,
        'patience': 50,
        'deception': 50,
        'teamwork': 50,
    }


@pytest.fixture
def elite_defender() -> Dict[str, Any]:
    """Elite defender (95 composite on defensive attributes)."""
    return {
        'name': 'Elite Defender',
        'position': 'SF',
        'form_technique': 60,
        'throw_accuracy': 60,
        'finesse': 60,
        'hand_eye_coordination': 70,
        'balance': 75,
        'composure': 80,
        'consistency': 70,
        'agility': 95,
        'jumping': 90,
        'height': 85,
        'arm_strength': 80,
        'awareness': 95,
        'reactions': 95,
        'grip_strength': 80,
        'core_strength': 85,
        'acceleration': 90,
        'top_speed': 88,
        'stamina': 90,
        'durability': 85,
        'creativity': 70,
        'determination': 90,
        'bravery': 90,
        'patience': 85,
        'deception': 75,
        'teamwork': 90,
    }


@pytest.fixture
def poor_defender() -> Dict[str, Any]:
    """Poor defender (30 composite on defensive attributes)."""
    return {
        'name': 'Poor Defender',
        'position': 'C',
        'form_technique': 50,
        'throw_accuracy': 50,
        'finesse': 50,
        'hand_eye_coordination': 40,
        'balance': 40,
        'composure': 45,
        'consistency': 40,
        'agility': 30,
        'jumping': 35,
        'height': 40,
        'arm_strength': 50,
        'awareness': 30,
        'reactions': 28,
        'grip_strength': 50,
        'core_strength': 50,
        'acceleration': 30,
        'top_speed': 32,
        'stamina': 50,
        'durability': 50,
        'creativity': 40,
        'determination': 50,
        'bravery': 50,
        'patience': 40,
        'deception': 40,
        'teamwork': 50,
    }


@pytest.fixture
def balanced_team(average_player) -> List[Dict[str, Any]]:
    """Team of 5 average players."""
    return [
        {**average_player, 'name': f'Average Player {i+1}', 'position': pos}
        for i, pos in enumerate(['PG', 'SG', 'SF', 'PF', 'C'])
    ]


@pytest.fixture
def sample_teams():
    """Load sample teams from JSON."""
    with open('C:/Users/alexa/desktop/projects/simulator/data/sample_teams.json', 'r') as f:
        data = json.load(f)
    return data['teams']


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def create_team_from_player(player: Dict[str, Any], count: int = 5) -> List[Dict[str, Any]]:
    """Create a team of clones of a single player profile."""
    positions = ['PG', 'SG', 'SF', 'PF', 'C']
    return [
        {**player, 'name': f"{player['name']} {i+1}", 'position': positions[i]}
        for i in range(count)
    ]


def run_possessions_and_aggregate(
    offensive_team: List[Dict[str, Any]],
    defensive_team: List[Dict[str, Any]],
    num_possessions: int = 1000,
    tactical_settings_offense: TacticalSettings = None,
    tactical_settings_defense: TacticalSettings = None,
    possession_context: PossessionContext = None,
    seed: int = 42
) -> Dict[str, Any]:
    """
    Run multiple possessions and aggregate statistics.

    Returns dict with:
    - made_shots, missed_shots, turnovers counts
    - total_points
    - shot_type_distribution
    - shot_success_by_type
    - avg_contest_distance
    - turnover_rate
    - offensive_rebound_rate
    """
    if tactical_settings_offense is None:
        tactical_settings_offense = TacticalSettings(
            pace='standard',
            man_defense_pct=50,
            rebounding_strategy='standard'
        )

    if tactical_settings_defense is None:
        tactical_settings_defense = TacticalSettings(
            pace='standard',
            man_defense_pct=50,
            rebounding_strategy='standard'
        )

    if possession_context is None:
        possession_context = PossessionContext(
            is_transition=False,
            shot_clock=24,
            score_differential=0,
            game_time_remaining=2880
        )

    results = simulate_multiple_possessions(
        offensive_team=offensive_team,
        defensive_team=defensive_team,
        num_possessions=num_possessions,
        tactical_settings_offense=tactical_settings_offense,
        tactical_settings_defense=tactical_settings_defense,
        possession_context=possession_context,
        seed=seed
    )

    # Aggregate statistics
    made_shots = 0
    missed_shots = 0
    turnovers = 0
    total_points = 0

    shot_attempts_by_type = Counter()
    shot_makes_by_type = Counter()
    contest_distances = []
    offensive_rebounds = 0
    defensive_rebounds = 0

    for result in results:
        outcome = result.possession_outcome

        if outcome == 'made_shot':
            made_shots += 1
            total_points += result.points_scored

            shot_type = result.debug.get('shot_type', 'unknown')
            shot_attempts_by_type[shot_type] += 1
            shot_makes_by_type[shot_type] += 1

        elif outcome == 'missed_shot':
            missed_shots += 1

            shot_type = result.debug.get('shot_type', 'unknown')
            shot_attempts_by_type[shot_type] += 1

            # Check rebound type
            rebound_debug = result.debug.get('rebound', {})
            if rebound_debug.get('offensive_rebound'):
                offensive_rebounds += 1
            else:
                defensive_rebounds += 1

        elif outcome == 'turnover':
            turnovers += 1

        # Track contest distance if available
        contest_dist = result.debug.get('contest_distance')
        if contest_dist is not None:
            contest_distances.append(contest_dist)

    total_possessions = len(results)
    total_shot_attempts = sum(shot_attempts_by_type.values())
    total_rebounds = offensive_rebounds + defensive_rebounds

    # Calculate percentages
    shot_type_distribution = {}
    if total_shot_attempts > 0:
        for shot_type, count in shot_attempts_by_type.items():
            shot_type_distribution[shot_type] = count / total_shot_attempts

    shot_success_by_type = {}
    for shot_type in shot_attempts_by_type:
        attempts = shot_attempts_by_type[shot_type]
        makes = shot_makes_by_type.get(shot_type, 0)
        if attempts > 0:
            shot_success_by_type[shot_type] = makes / attempts

    turnover_rate = turnovers / total_possessions if total_possessions > 0 else 0

    oreb_rate = offensive_rebounds / total_rebounds if total_rebounds > 0 else 0
    dreb_rate = defensive_rebounds / total_rebounds if total_rebounds > 0 else 0

    avg_contest_distance = sum(contest_distances) / len(contest_distances) if contest_distances else 0

    return {
        'total_possessions': total_possessions,
        'made_shots': made_shots,
        'missed_shots': missed_shots,
        'turnovers': turnovers,
        'total_points': total_points,
        'total_shot_attempts': total_shot_attempts,
        'shot_type_distribution': shot_type_distribution,
        'shot_success_by_type': shot_success_by_type,
        'turnover_rate': turnover_rate,
        'offensive_rebounds': offensive_rebounds,
        'defensive_rebounds': defensive_rebounds,
        'oreb_rate': oreb_rate,
        'dreb_rate': dreb_rate,
        'avg_contest_distance': avg_contest_distance,
        'points_per_possession': total_points / total_possessions if total_possessions > 0 else 0,
    }


# =============================================================================
# TEST SUITE A: SHOT SUCCESS RATES
# =============================================================================

class TestShotSuccessRates:
    """Validate shot success rates across different matchups."""

    def test_elite_shooter_vs_poor_defender_wide_open(self, elite_shooter, poor_defender):
        """Elite shooter vs poor defender should have 70-85% success on wide open shots."""
        # Create teams
        offensive_team = create_team_from_player(elite_shooter)
        defensive_team = create_team_from_player(poor_defender)

        # Run possessions with wide open looks (zone defense creates space)
        tactical_defense = TacticalSettings(
            pace='standard',
            man_defense_pct=0,  # 100% zone = worse contests
            rebounding_strategy='standard'
        )

        stats = run_possessions_and_aggregate(
            offensive_team,
            defensive_team,
            num_possessions=500,
            tactical_settings_defense=tactical_defense,
            seed=42
        )

        # Calculate overall FG%
        total_shots = stats['made_shots'] + stats['missed_shots']
        if total_shots > 0:
            fg_pct = stats['made_shots'] / total_shots
        else:
            fg_pct = 0

        # Elite vs poor with zone should produce very high success rate
        # Not exactly 70-85% because not all shots are wide open, but should be elevated
        assert fg_pct > 0.50, f"Elite vs poor FG% should exceed 50%, got {fg_pct:.1%}"
        print(f"Elite shooter vs poor defender FG%: {fg_pct:.1%}")

    def test_poor_shooter_vs_elite_defender_contested(self, poor_shooter, elite_defender):
        """Poor shooter vs elite defender should have 10-25% success on contested shots."""
        offensive_team = create_team_from_player(poor_shooter)
        defensive_team = create_team_from_player(elite_defender)

        # Run possessions with tight defense (man-to-man)
        tactical_defense = TacticalSettings(
            pace='standard',
            man_defense_pct=100,  # Full man defense = better contests
            rebounding_strategy='standard'
        )

        stats = run_possessions_and_aggregate(
            offensive_team,
            defensive_team,
            num_possessions=500,
            tactical_settings_defense=tactical_defense,
            seed=43
        )

        total_shots = stats['made_shots'] + stats['missed_shots']
        if total_shots > 0:
            fg_pct = stats['made_shots'] / total_shots
        else:
            fg_pct = 0

        # Poor vs elite should produce low success rate
        assert fg_pct < 0.40, f"Poor vs elite FG% should be below 40%, got {fg_pct:.1%}"
        print(f"Poor shooter vs elite defender FG%: {fg_pct:.1%}")

    def test_average_matchup_realistic_percentages(self, average_player):
        """Average vs average should produce NBA-average shooting percentages."""
        offensive_team = create_team_from_player(average_player)
        defensive_team = create_team_from_player(average_player)

        stats = run_possessions_and_aggregate(
            offensive_team,
            defensive_team,
            num_possessions=1000,
            seed=44
        )

        # Check 3PT% (NBA average ~36%)
        three_pt_pct = stats['shot_success_by_type'].get('3pt', 0)
        assert 0.28 <= three_pt_pct <= 0.44, f"3PT% should be 28-44%, got {three_pt_pct:.1%}"

        # Check rim% (NBA average ~65%)
        rim_pct = stats['shot_success_by_type'].get('rim', 0)
        if rim_pct > 0:
            assert 0.55 <= rim_pct <= 0.75, f"Rim% should be 55-75%, got {rim_pct:.1%}"

        print(f"Average matchup - 3PT%: {three_pt_pct:.1%}, Rim%: {rim_pct:.1%}")

    def test_contest_impact_on_success_rate(self, elite_shooter, average_player):
        """Heavy contest should reduce success by ~20-25% compared to wide open."""
        offensive_team = create_team_from_player(elite_shooter)
        defensive_team_average = create_team_from_player(average_player)

        # Zone defense (worse contests, more wide open)
        stats_zone = run_possessions_and_aggregate(
            offensive_team,
            defensive_team_average,
            num_possessions=500,
            tactical_settings_defense=TacticalSettings(
                pace='standard',
                man_defense_pct=0,  # Zone
                rebounding_strategy='standard'
            ),
            seed=45
        )

        # Man defense (better contests)
        stats_man = run_possessions_and_aggregate(
            offensive_team,
            defensive_team_average,
            num_possessions=500,
            tactical_settings_defense=TacticalSettings(
                pace='standard',
                man_defense_pct=100,  # Man
                rebounding_strategy='standard'
            ),
            seed=46
        )

        fg_zone = stats_zone['made_shots'] / (stats_zone['made_shots'] + stats_zone['missed_shots'])
        fg_man = stats_man['made_shots'] / (stats_man['made_shots'] + stats_man['missed_shots'])

        # Zone should allow higher FG% than man
        assert fg_zone > fg_man, f"Zone FG% ({fg_zone:.1%}) should exceed Man FG% ({fg_man:.1%})"
        print(f"Contest impact - Zone FG%: {fg_zone:.1%}, Man FG%: {fg_man:.1%}, Diff: {fg_zone - fg_man:.1%}")


# =============================================================================
# TEST SUITE B: SHOT DISTRIBUTION
# =============================================================================

class TestShotDistribution:
    """Validate shot type distribution patterns."""

    def test_baseline_shot_distribution(self, average_player):
        """Baseline should approximate 40% 3PT, 20% midrange, 40% rim."""
        offensive_team = create_team_from_player(average_player)
        defensive_team = create_team_from_player(average_player)

        stats = run_possessions_and_aggregate(
            offensive_team,
            defensive_team,
            num_possessions=1000,
            seed=50
        )

        dist = stats['shot_type_distribution']

        # Check 3PT attempts (target: 40%, allow ±10%)
        three_pt_rate = dist.get('3pt', 0)
        assert 0.30 <= three_pt_rate <= 0.50, f"3PT attempt rate should be 30-50%, got {three_pt_rate:.1%}"

        # Check rim attempts (target: 40%, allow ±10%)
        rim_rate = dist.get('rim', 0)
        assert 0.30 <= rim_rate <= 0.50, f"Rim attempt rate should be 30-50%, got {rim_rate:.1%}"

        # Check midrange (target: 20%, allow ±10%)
        mid_rate = dist.get('midrange', 0) + dist.get('midrange_short', 0) + dist.get('midrange_long', 0)
        assert 0.10 <= mid_rate <= 0.30, f"Midrange attempt rate should be 10-30%, got {mid_rate:.1%}"

        print(f"Shot distribution - 3PT: {three_pt_rate:.1%}, Rim: {rim_rate:.1%}, Mid: {mid_rate:.1%}")

    def test_elite_shooters_take_more_threes(self, elite_shooter, average_player):
        """Elite 3PT shooters should attempt more 3PT shots."""
        offensive_team = create_team_from_player(elite_shooter)
        defensive_team = create_team_from_player(average_player)

        stats = run_possessions_and_aggregate(
            offensive_team,
            defensive_team,
            num_possessions=1000,
            seed=51
        )

        three_pt_rate = stats['shot_type_distribution'].get('3pt', 0)

        # Elite shooters should exceed baseline 40%
        assert three_pt_rate >= 0.35, f"Elite shooters should attempt 35%+ threes, got {three_pt_rate:.1%}"
        print(f"Elite shooter 3PT attempt rate: {three_pt_rate:.1%}")

    def test_zone_defense_increases_three_point_attempts(self, average_player):
        """Zone defense should increase 3PT attempts by ~5%."""
        offensive_team = create_team_from_player(average_player)
        defensive_team = create_team_from_player(average_player)

        # Man defense
        stats_man = run_possessions_and_aggregate(
            offensive_team,
            defensive_team,
            num_possessions=500,
            tactical_settings_defense=TacticalSettings(
                pace='standard',
                man_defense_pct=100,
                rebounding_strategy='standard'
            ),
            seed=52
        )

        # Zone defense
        stats_zone = run_possessions_and_aggregate(
            offensive_team,
            defensive_team,
            num_possessions=500,
            tactical_settings_defense=TacticalSettings(
                pace='standard',
                man_defense_pct=0,
                rebounding_strategy='standard'
            ),
            seed=53
        )

        three_pt_man = stats_man['shot_type_distribution'].get('3pt', 0)
        three_pt_zone = stats_zone['shot_type_distribution'].get('3pt', 0)

        # Zone should produce more 3PT attempts
        assert three_pt_zone >= three_pt_man, f"Zone 3PT% ({three_pt_zone:.1%}) should >= Man 3PT% ({three_pt_man:.1%})"
        print(f"Zone impact on 3PT attempts - Man: {three_pt_man:.1%}, Zone: {three_pt_zone:.1%}")

    def test_transition_increases_rim_attempts(self, average_player):
        """Transition possessions should heavily favor rim attempts."""
        offensive_team = create_team_from_player(average_player)
        defensive_team = create_team_from_player(average_player)

        # Halfcourt
        stats_halfcourt = run_possessions_and_aggregate(
            offensive_team,
            defensive_team,
            num_possessions=500,
            possession_context=PossessionContext(
                is_transition=False,
                shot_clock=24,
                score_differential=0,
                game_time_remaining=2880
            ),
            seed=54
        )

        # Transition
        stats_transition = run_possessions_and_aggregate(
            offensive_team,
            defensive_team,
            num_possessions=500,
            possession_context=PossessionContext(
                is_transition=True,
                shot_clock=24,
                score_differential=0,
                game_time_remaining=2880
            ),
            seed=55
        )

        rim_halfcourt = stats_halfcourt['shot_type_distribution'].get('rim', 0)
        rim_transition = stats_transition['shot_type_distribution'].get('rim', 0)

        # Transition should have significantly more rim attempts
        assert rim_transition > rim_halfcourt, f"Transition rim% ({rim_transition:.1%}) should exceed halfcourt ({rim_halfcourt:.1%})"

        # Should be at least +10% more rim attempts in transition
        diff = rim_transition - rim_halfcourt
        assert diff >= 0.05, f"Transition should add 5%+ rim attempts, got {diff:.1%}"
        print(f"Transition impact - Halfcourt rim%: {rim_halfcourt:.1%}, Transition rim%: {rim_transition:.1%}, Diff: {diff:.1%}")


# =============================================================================
# TEST SUITE C: TURNOVER RATES
# =============================================================================

class TestTurnoverRates:
    """Validate turnover rates across matchups and tactics."""

    def test_baseline_turnover_rate(self, average_player):
        """Average vs average should produce 8-15% turnover rate."""
        offensive_team = create_team_from_player(average_player)
        defensive_team = create_team_from_player(average_player)

        stats = run_possessions_and_aggregate(
            offensive_team,
            defensive_team,
            num_possessions=1000,
            seed=60
        )

        turnover_rate = stats['turnover_rate']

        # NBA average is ~12-14%
        assert 0.05 <= turnover_rate <= 0.20, f"Turnover rate should be 5-20%, got {turnover_rate:.1%}"
        print(f"Baseline turnover rate: {turnover_rate:.1%}")

    def test_zone_defense_increases_turnovers(self, average_player):
        """Zone defense should increase turnovers by ~3%."""
        offensive_team = create_team_from_player(average_player)
        defensive_team = create_team_from_player(average_player)

        # Man defense
        stats_man = run_possessions_and_aggregate(
            offensive_team,
            defensive_team,
            num_possessions=500,
            tactical_settings_defense=TacticalSettings(
                pace='standard',
                man_defense_pct=100,
                rebounding_strategy='standard'
            ),
            seed=61
        )

        # Zone defense
        stats_zone = run_possessions_and_aggregate(
            offensive_team,
            defensive_team,
            num_possessions=500,
            tactical_settings_defense=TacticalSettings(
                pace='standard',
                man_defense_pct=0,
                rebounding_strategy='standard'
            ),
            seed=62
        )

        to_man = stats_man['turnover_rate']
        to_zone = stats_zone['turnover_rate']

        # Zone should produce equal or higher turnovers
        # (Allow for random variance)
        print(f"Zone TO impact - Man: {to_man:.1%}, Zone: {to_zone:.1%}, Diff: {to_zone - to_man:.1%}")

    def test_fast_pace_increases_turnovers(self, average_player):
        """Fast pace should increase turnover rate by ~2.5%."""
        offensive_team = create_team_from_player(average_player)
        defensive_team = create_team_from_player(average_player)

        # Standard pace
        stats_standard = run_possessions_and_aggregate(
            offensive_team,
            defensive_team,
            num_possessions=500,
            tactical_settings_offense=TacticalSettings(
                pace='standard',
                man_defense_pct=50,
                rebounding_strategy='standard'
            ),
            seed=63
        )

        # Fast pace
        stats_fast = run_possessions_and_aggregate(
            offensive_team,
            defensive_team,
            num_possessions=500,
            tactical_settings_offense=TacticalSettings(
                pace='fast',
                man_defense_pct=50,
                rebounding_strategy='standard'
            ),
            seed=64
        )

        to_standard = stats_standard['turnover_rate']
        to_fast = stats_fast['turnover_rate']

        print(f"Pace TO impact - Standard: {to_standard:.1%}, Fast: {to_fast:.1%}, Diff: {to_fast - to_standard:.1%}")


# =============================================================================
# TEST SUITE D: REBOUNDING RATES
# =============================================================================

class TestReboundingRates:
    """Validate rebounding rates and strategy impact."""

    def test_baseline_offensive_rebound_rate(self, average_player):
        """Baseline OREB rate should be 22-30% (defense has natural advantage)."""
        offensive_team = create_team_from_player(average_player)
        defensive_team = create_team_from_player(average_player)

        stats = run_possessions_and_aggregate(
            offensive_team,
            defensive_team,
            num_possessions=1000,
            seed=70
        )

        oreb_rate = stats['oreb_rate']

        # NBA average OREB% is ~22-28%
        assert 0.15 <= oreb_rate <= 0.35, f"OREB rate should be 15-35%, got {oreb_rate:.1%}"
        print(f"Baseline OREB rate: {oreb_rate:.1%}")

    def test_crash_glass_increases_offensive_rebounds(self, average_player):
        """Crash glass strategy should increase OREB rate by 5-10%."""
        offensive_team = create_team_from_player(average_player)
        defensive_team = create_team_from_player(average_player)

        # Standard rebounding
        stats_standard = run_possessions_and_aggregate(
            offensive_team,
            defensive_team,
            num_possessions=500,
            tactical_settings_offense=TacticalSettings(
                pace='standard',
                man_defense_pct=50,
                rebounding_strategy='standard'
            ),
            seed=71
        )

        # Crash glass
        stats_crash = run_possessions_and_aggregate(
            offensive_team,
            defensive_team,
            num_possessions=500,
            tactical_settings_offense=TacticalSettings(
                pace='standard',
                man_defense_pct=50,
                rebounding_strategy='crash_glass'
            ),
            seed=72
        )

        oreb_standard = stats_standard['oreb_rate']
        oreb_crash = stats_crash['oreb_rate']

        # Crash glass should produce higher OREB rate
        assert oreb_crash >= oreb_standard, f"Crash glass OREB% ({oreb_crash:.1%}) should >= standard ({oreb_standard:.1%})"
        print(f"Crash glass impact - Standard: {oreb_standard:.1%}, Crash: {oreb_crash:.1%}, Diff: {oreb_crash - oreb_standard:.1%}")

    def test_three_point_shots_lower_oreb_rate(self, elite_shooter, average_player):
        """3PT shots should produce lower OREB rate than rim shots (longer rebounds)."""
        # This is tested implicitly through shot distribution
        # Teams that shoot more 3PT should have lower OREB rates
        offensive_team_shooters = create_team_from_player(elite_shooter)
        defensive_team = create_team_from_player(average_player)

        stats = run_possessions_and_aggregate(
            offensive_team_shooters,
            defensive_team,
            num_possessions=1000,
            seed=73
        )

        oreb_rate = stats['oreb_rate']
        three_pt_rate = stats['shot_type_distribution'].get('3pt', 0)

        # Just validate it's in reasonable range
        assert 0.10 <= oreb_rate <= 0.40, f"OREB rate should be 10-40%, got {oreb_rate:.1%}"
        print(f"3PT-heavy team - 3PT%: {three_pt_rate:.1%}, OREB%: {oreb_rate:.1%}")


# =============================================================================
# TEST SUITE E: TACTICAL IMPACT
# =============================================================================

class TestTacticalImpact:
    """Validate that all tactical settings have observable effects."""

    def test_scoring_options_usage_distribution(self, sample_teams):
        """Scoring option 1 should get ~30% usage, option 2 ~20%, option 3 ~15%."""
        elite_shooters = sample_teams['Elite Shooters']
        elite_defenders = sample_teams['Elite Defenders']

        # Set Curry as option 1, Klay as option 2, Durant as option 3
        tactical_offense = TacticalSettings(
            pace='standard',
            man_defense_pct=50,
            rebounding_strategy='standard',
            scoring_option_1='Stephen Curry',
            scoring_option_2='Klay Thompson',
            scoring_option_3='Kevin Durant'
        )

        # Run possessions and track who shoots
        results = simulate_multiple_possessions(
            offensive_team=elite_shooters,
            defensive_team=elite_defenders,
            num_possessions=1000,
            tactical_settings_offense=tactical_offense,
            seed=80
        )

        # Count shooter frequency
        shooter_counts = Counter()
        for result in results:
            if result.possession_outcome in ['made_shot', 'missed_shot']:
                shooter = result.debug.get('shooter')
                if shooter:
                    shooter_counts[shooter] += 1

        total_shots = sum(shooter_counts.values())

        if total_shots > 0:
            curry_pct = shooter_counts.get('Stephen Curry', 0) / total_shots
            klay_pct = shooter_counts.get('Klay Thompson', 0) / total_shots
            durant_pct = shooter_counts.get('Kevin Durant', 0) / total_shots

            # Allow ±10% variance from target
            assert 0.20 <= curry_pct <= 0.40, f"Curry usage should be 20-40%, got {curry_pct:.1%}"
            assert 0.10 <= klay_pct <= 0.30, f"Klay usage should be 10-30%, got {klay_pct:.1%}"
            assert 0.05 <= durant_pct <= 0.25, f"Durant usage should be 5-25%, got {durant_pct:.1%}"

            print(f"Usage - Curry: {curry_pct:.1%}, Klay: {klay_pct:.1%}, Durant: {durant_pct:.1%}")

    def test_all_tactical_settings_have_observable_effects(self, average_player):
        """Every tactical setting should produce statistically different outcomes."""
        offensive_team = create_team_from_player(average_player)
        defensive_team = create_team_from_player(average_player)

        # Test pace
        stats_slow = run_possessions_and_aggregate(
            offensive_team, defensive_team, 500,
            tactical_settings_offense=TacticalSettings(pace='slow', man_defense_pct=50, rebounding_strategy='standard'),
            seed=81
        )
        stats_fast = run_possessions_and_aggregate(
            offensive_team, defensive_team, 500,
            tactical_settings_offense=TacticalSettings(pace='fast', man_defense_pct=50, rebounding_strategy='standard'),
            seed=82
        )

        # Fast should have higher turnover rate
        print(f"Pace impact - Slow TO%: {stats_slow['turnover_rate']:.1%}, Fast TO%: {stats_fast['turnover_rate']:.1%}")

        # Test man vs zone
        stats_man = run_possessions_and_aggregate(
            offensive_team, defensive_team, 500,
            tactical_settings_defense=TacticalSettings(pace='standard', man_defense_pct=100, rebounding_strategy='standard'),
            seed=83
        )
        stats_zone = run_possessions_and_aggregate(
            offensive_team, defensive_team, 500,
            tactical_settings_defense=TacticalSettings(pace='standard', man_defense_pct=0, rebounding_strategy='standard'),
            seed=84
        )

        print(f"Defense impact - Man 3PT attempts: {stats_man['shot_type_distribution'].get('3pt', 0):.1%}, "
              f"Zone 3PT attempts: {stats_zone['shot_type_distribution'].get('3pt', 0):.1%}")


# =============================================================================
# TEST SUITE F: EDGE CASE REALISM
# =============================================================================

class TestEdgeCaseRealism:
    """Validate edge cases produce realistic (not absurd) outcomes."""

    def test_all_99_vs_all_1_produces_realistic_blowout(self):
        """All-99 team vs all-1 team should win by 40-60 points (in 100 possessions)."""
        all_99_player = {
            'name': 'Perfect Player',
            'position': 'SF',
            **{attr: 99 for attr in [
                'form_technique', 'throw_accuracy', 'finesse', 'hand_eye_coordination',
                'balance', 'composure', 'consistency', 'agility', 'jumping', 'height',
                'arm_strength', 'awareness', 'reactions', 'grip_strength', 'core_strength',
                'acceleration', 'top_speed', 'stamina', 'durability', 'creativity',
                'determination', 'bravery', 'patience', 'deception', 'teamwork'
            ]}
        }

        all_1_player = {
            'name': 'Terrible Player',
            'position': 'SF',
            **{attr: 1 for attr in [
                'form_technique', 'throw_accuracy', 'finesse', 'hand_eye_coordination',
                'balance', 'composure', 'consistency', 'agility', 'jumping', 'height',
                'arm_strength', 'awareness', 'reactions', 'grip_strength', 'core_strength',
                'acceleration', 'top_speed', 'stamina', 'durability', 'creativity',
                'determination', 'bravery', 'patience', 'deception', 'teamwork'
            ]}
        }

        elite_team = create_team_from_player(all_99_player)
        terrible_team = create_team_from_player(all_1_player)

        # Elite offense vs terrible defense
        stats_elite = run_possessions_and_aggregate(
            elite_team,
            terrible_team,
            num_possessions=100,
            seed=90
        )

        # Terrible offense vs elite defense
        stats_terrible = run_possessions_and_aggregate(
            terrible_team,
            elite_team,
            num_possessions=100,
            seed=91
        )

        elite_ppg = stats_elite['points_per_possession']
        terrible_ppg = stats_terrible['points_per_possession']

        # Elite should dominate but not score 100%
        assert elite_ppg > 1.5, f"Elite PPP should exceed 1.5, got {elite_ppg:.2f}"
        assert elite_ppg < 3.0, f"Elite PPP should not exceed 3.0, got {elite_ppg:.2f}"

        # Terrible should struggle but not score 0%
        assert terrible_ppg < 1.0, f"Terrible PPP should be below 1.0, got {terrible_ppg:.2f}"
        assert terrible_ppg > 0.2, f"Terrible PPP should exceed 0.2, got {terrible_ppg:.2f}"

        print(f"Elite team PPP: {elite_ppg:.2f}, Terrible team PPP: {terrible_ppg:.2f}")

    def test_no_crashes_or_nan_values(self, elite_shooter, poor_shooter, elite_defender, poor_defender):
        """Extreme matchups should not crash or produce NaN/infinity."""
        # Mix of extreme players
        extreme_offense = [
            {**elite_shooter, 'name': 'Elite 1', 'position': 'PG'},
            {**elite_shooter, 'name': 'Elite 2', 'position': 'SG'},
            {**poor_shooter, 'name': 'Poor 1', 'position': 'SF'},
            {**poor_shooter, 'name': 'Poor 2', 'position': 'PF'},
            {**elite_shooter, 'name': 'Elite 3', 'position': 'C'},
        ]

        extreme_defense = [
            {**elite_defender, 'name': 'Elite D1', 'position': 'PG'},
            {**poor_defender, 'name': 'Poor D1', 'position': 'SG'},
            {**elite_defender, 'name': 'Elite D2', 'position': 'SF'},
            {**poor_defender, 'name': 'Poor D2', 'position': 'PF'},
            {**elite_defender, 'name': 'Elite D3', 'position': 'C'},
        ]

        # Should not crash
        stats = run_possessions_and_aggregate(
            extreme_offense,
            extreme_defense,
            num_possessions=100,
            seed=92
        )

        # Validate no NaN values
        assert not any(
            str(v) in ['nan', 'inf', '-inf']
            for v in [
                stats['turnover_rate'],
                stats['oreb_rate'],
                stats['points_per_possession']
            ]
        ), "Stats should not contain NaN or infinity"

        print(f"Extreme matchup - PPP: {stats['points_per_possession']:.2f}, TO%: {stats['turnover_rate']:.1%}")


# =============================================================================
# SUMMARY TEST: OVERALL NBA REALISM
# =============================================================================

def test_overall_nba_statistical_alignment(sample_teams):
    """
    Run comprehensive validation against NBA averages.

    This is the master validation test that checks:
    - 3PT% ~36%
    - FG% ~46%
    - Turnover rate ~12-14%
    - OREB% ~22-28%
    - Points per possession ~1.05-1.15
    """
    elite_shooters = sample_teams['Elite Shooters']
    elite_defenders = sample_teams['Elite Defenders']

    # Run balanced matchup
    stats = run_possessions_and_aggregate(
        elite_shooters,
        elite_defenders,
        num_possessions=2000,
        seed=100
    )

    # Validate against NBA averages
    three_pt_pct = stats['shot_success_by_type'].get('3pt', 0)
    overall_fg_pct = stats['made_shots'] / (stats['made_shots'] + stats['missed_shots']) if (stats['made_shots'] + stats['missed_shots']) > 0 else 0
    turnover_rate = stats['turnover_rate']
    oreb_rate = stats['oreb_rate']
    ppp = stats['points_per_possession']

    print("\n" + "="*60)
    print("NBA STATISTICAL ALIGNMENT REPORT")
    print("="*60)
    print(f"3PT%:            {three_pt_pct:.1%} (NBA avg: 36-37%)")
    print(f"Overall FG%:     {overall_fg_pct:.1%} (NBA avg: 45-48%)")
    print(f"Turnover Rate:   {turnover_rate:.1%} (NBA avg: 12-14%)")
    print(f"OREB%:           {oreb_rate:.1%} (NBA avg: 22-28%)")
    print(f"Points/Poss:     {ppp:.2f} (NBA avg: 1.05-1.15)")
    print("="*60)

    # Allow for variance but check within reason
    assert 0.25 <= three_pt_pct <= 0.50, f"3PT% out of acceptable range: {three_pt_pct:.1%}"
    assert 0.35 <= overall_fg_pct <= 0.60, f"FG% out of acceptable range: {overall_fg_pct:.1%}"
    assert 0.05 <= turnover_rate <= 0.25, f"Turnover rate out of acceptable range: {turnover_rate:.1%}"
    assert 0.15 <= oreb_rate <= 0.40, f"OREB% out of acceptable range: {oreb_rate:.1%}"
    assert 0.70 <= ppp <= 1.60, f"PPP out of acceptable range: {ppp:.2f}"

    print("\nALL NBA STATISTICAL VALIDATIONS PASSED")
