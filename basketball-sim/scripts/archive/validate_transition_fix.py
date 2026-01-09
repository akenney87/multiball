"""
Transition Shot Selection Bug - Validation Script

This script demonstrates that the transition bonus is now working correctly
after fixing the simulate_multiple_possessions function.

BEFORE FIX:
- Halfcourt rim%: 34.1%
- Transition rim%: 34.1% (SAME - BUG!)

AFTER FIX:
- Halfcourt rim%: 34.1%
- Transition rim%: 53.8% (+19.6% - CORRECT!)

Root Cause:
- simulate_multiple_possessions() did not accept possession_context parameter
- run_possessions_and_aggregate() could not pass transition context through
- All possessions were simulated with is_transition=False

Fix Applied:
1. Added possession_context parameter to simulate_multiple_possessions()
2. Pass possession_context from run_possessions_and_aggregate() to simulate_multiple_possessions()
3. Pass possession_context from simulate_multiple_possessions() to each simulate_single_possession() call
"""

import random
from typing import Dict, Any, List
from collections import Counter

from src.simulation import simulate_multiple_possessions
from src.core.data_structures import PossessionContext, TacticalSettings


def create_average_player(name: str = "Average Player") -> Dict[str, Any]:
    """Create an average player with all attributes at 50."""
    return {
        'name': name,
        'position': 'SG',
        # All attributes at 50 (league average)
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
        'stamina': 90,
        'durability': 50,
        'creativity': 50,
        'determination': 50,
        'bravery': 50,
        'patience': 50,
        'deception': 50,
        'teamwork': 50,
    }


def create_team_from_player(base_player: Dict[str, Any], count: int = 5) -> List[Dict[str, Any]]:
    """Create a team by duplicating a player with different positions."""
    positions = ['PG', 'SG', 'SF', 'PF', 'C']
    return [
        {**base_player, 'name': f"{base_player['name']} {i+1}", 'position': positions[i]}
        for i in range(count)
    ]


def aggregate_shot_types(results: List) -> Dict[str, float]:
    """Aggregate shot type distribution from possession results."""
    shot_attempts_by_type = Counter()

    for result in results:
        outcome = result.possession_outcome

        if outcome in ('made_shot', 'missed_shot'):
            # Use top-level shot_type from debug (simplified: '3pt', 'midrange', 'rim')
            shot_type = result.debug.get('shot_type', 'unknown')
            shot_attempts_by_type[shot_type] += 1

    total_shot_attempts = sum(shot_attempts_by_type.values())

    shot_type_distribution = {}
    if total_shot_attempts > 0:
        for shot_type, count in shot_attempts_by_type.items():
            shot_type_distribution[shot_type] = count / total_shot_attempts

    return shot_type_distribution


def main():
    """Run validation comparing halfcourt vs transition shot distributions."""
    print("="*80)
    print("TRANSITION SHOT SELECTION BUG - VALIDATION")
    print("="*80)
    print()

    # Create teams
    average_player = create_average_player()
    offensive_team = create_team_from_player(average_player)
    defensive_team = create_team_from_player(average_player)

    # Standard tactical settings
    tactics = TacticalSettings(
        pace='standard',
        man_defense_pct=50,
        rebounding_strategy='standard'
    )

    print("Running 1000 halfcourt possessions...")
    halfcourt_context = PossessionContext(
        is_transition=False,
        shot_clock=24,
        score_differential=0,
        game_time_remaining=2880
    )

    halfcourt_results = simulate_multiple_possessions(
        offensive_team=offensive_team,
        defensive_team=defensive_team,
        num_possessions=1000,
        tactical_settings_offense=tactics,
        tactical_settings_defense=tactics,
        possession_context=halfcourt_context,
        seed=100
    )

    halfcourt_distribution = aggregate_shot_types(halfcourt_results)

    print("Running 1000 transition possessions...")
    transition_context = PossessionContext(
        is_transition=True,
        shot_clock=24,
        score_differential=0,
        game_time_remaining=2880
    )

    transition_results = simulate_multiple_possessions(
        offensive_team=offensive_team,
        defensive_team=defensive_team,
        num_possessions=1000,
        tactical_settings_offense=tactics,
        tactical_settings_defense=tactics,
        possession_context=transition_context,
        seed=200
    )

    transition_distribution = aggregate_shot_types(transition_results)

    print()
    print("="*80)
    print("RESULTS")
    print("="*80)
    print()

    # Extract shot type percentages (using simplified shot types)
    rim_halfcourt = halfcourt_distribution.get('rim', 0)
    rim_transition = transition_distribution.get('rim', 0)

    threept_halfcourt = halfcourt_distribution.get('3pt', 0)
    threept_transition = transition_distribution.get('3pt', 0)

    mid_halfcourt = halfcourt_distribution.get('midrange', 0)
    mid_transition = transition_distribution.get('midrange', 0)

    print("HALFCOURT POSSESSIONS (is_transition=False):")
    print(f"  3PT:      {threept_halfcourt:6.1%}")
    print(f"  Midrange: {mid_halfcourt:6.1%}")
    print(f"  Rim:      {rim_halfcourt:6.1%}")
    print()

    print("TRANSITION POSSESSIONS (is_transition=True):")
    print(f"  3PT:      {threept_transition:6.1%}")
    print(f"  Midrange: {mid_transition:6.1%}")
    print(f"  Rim:      {rim_transition:6.1%}")
    print()

    print("DIFFERENCE (Transition - Halfcourt):")
    print(f"  3PT:      {threept_transition - threept_halfcourt:+6.1%}")
    print(f"  Midrange: {mid_transition - mid_halfcourt:+6.1%}")
    print(f"  Rim:      {rim_transition - rim_halfcourt:+6.1%}")
    print()

    # Validation
    rim_diff = rim_transition - rim_halfcourt
    expected_diff = 0.20  # +20% per spec

    print("="*80)
    print("VALIDATION")
    print("="*80)
    print()
    print(f"Expected rim attempt increase: ~{expected_diff:+.1%}")
    print(f"Actual rim attempt increase:   {rim_diff:+.1%}")
    print()

    # Check if within reasonable tolerance (±5%)
    if abs(rim_diff - expected_diff) <= 0.05:
        print("STATUS: PASS - Rim attempt increase matches specification!")
    else:
        print("STATUS: FAIL - Rim attempt increase does not match specification")
        print(f"         Difference from expected: {abs(rim_diff - expected_diff):.1%}")

    print()
    print("="*80)
    print()


if __name__ == '__main__':
    main()
