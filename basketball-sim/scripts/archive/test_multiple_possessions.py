"""
Test multiple possessions with different outcomes.

Runs 10 possessions with different seeds to showcase:
- Made shots
- Missed shots with rebounds
- Turnovers
- Assists
- Offensive rebounds with putbacks
"""

from src.core.data_structures import PossessionContext, TacticalSettings
from src.systems.possession import simulate_possession


def create_elite_shooter():
    """Elite 3PT specialist (Curry-like)"""
    return {
        'name': 'Elite Shooter',
        'position': 'PG',
        # Physical
        'grip_strength': 70, 'arm_strength': 60, 'core_strength': 65,
        'agility': 85, 'acceleration': 80, 'top_speed': 75,
        'jumping': 70, 'reactions': 85, 'stamina': 80,
        'balance': 90, 'height': 75, 'durability': 75,
        # Mental
        'awareness': 95, 'creativity': 90, 'determination': 85,
        'bravery': 80, 'consistency': 92, 'composure': 95, 'patience': 88,
        # Technical
        'hand_eye_coordination': 95, 'throw_accuracy': 98, 'form_technique': 98,
        'finesse': 90, 'deception': 85, 'teamwork': 90,
    }


def create_rim_finisher():
    """Athletic rim finisher (LeBron-like)"""
    return {
        'name': 'Rim Finisher',
        'position': 'SF',
        # Physical
        'grip_strength': 90, 'arm_strength': 92, 'core_strength': 90,
        'agility': 85, 'acceleration': 88, 'top_speed': 90,
        'jumping': 95, 'reactions': 85, 'stamina': 88,
        'balance': 85, 'height': 90, 'durability': 85,
        # Mental
        'awareness': 90, 'creativity': 85, 'determination': 95,
        'bravery': 95, 'consistency': 85, 'composure': 90, 'patience': 80,
        # Technical
        'hand_eye_coordination': 88, 'throw_accuracy': 75, 'form_technique': 70,
        'finesse': 85, 'deception': 80, 'teamwork': 85,
    }


def create_balanced_player(name: str, position: str):
    """Average NBA player (all 50s)"""
    return {
        'name': name,
        'position': position,
        # Physical
        'grip_strength': 50, 'arm_strength': 50, 'core_strength': 50,
        'agility': 50, 'acceleration': 50, 'top_speed': 50,
        'jumping': 50, 'reactions': 50, 'stamina': 50,
        'balance': 50, 'height': 50, 'durability': 50,
        # Mental
        'awareness': 50, 'creativity': 50, 'determination': 50,
        'bravery': 50, 'consistency': 50, 'composure': 50, 'patience': 50,
        # Technical
        'hand_eye_coordination': 50, 'throw_accuracy': 50, 'form_technique': 50,
        'finesse': 50, 'deception': 50, 'teamwork': 50,
    }


def create_elite_defender():
    """Elite perimeter defender (Kawhi-like)"""
    return {
        'name': 'Elite Defender',
        'position': 'SF',
        # Physical
        'grip_strength': 85, 'arm_strength': 85, 'core_strength': 88,
        'agility': 92, 'acceleration': 90, 'top_speed': 88,
        'jumping': 88, 'reactions': 95, 'stamina': 90,
        'balance': 85, 'height': 85, 'durability': 90,
        # Mental
        'awareness': 95, 'creativity': 70, 'determination': 95,
        'bravery': 90, 'consistency': 90, 'composure': 92, 'patience': 88,
        # Technical
        'hand_eye_coordination': 90, 'throw_accuracy': 80, 'form_technique': 75,
        'finesse': 80, 'deception': 75, 'teamwork': 85,
    }


def main():
    print("=" * 100)
    print("MULTIPLE POSSESSION TEST - BASKETBALL SIMULATOR")
    print("=" * 100)
    print()

    # Build teams
    offensive_team = [
        create_elite_shooter(),
        create_rim_finisher(),
        create_balanced_player('Role Player 1', 'SG'),
        create_balanced_player('Role Player 2', 'PF'),
        create_balanced_player('Big Man', 'C'),
    ]

    # Make Big Man taller for putback testing
    offensive_team[4]['height'] = 85
    offensive_team[4]['jumping'] = 70

    defensive_team = [
        create_elite_defender(),
        create_balanced_player('Defender 1', 'PG'),
        create_balanced_player('Defender 2', 'SG'),
        create_balanced_player('Defender 3', 'PF'),
        create_balanced_player('Defender 4', 'C'),
    ]

    # Tactical settings
    tactical_offense = TacticalSettings(
        pace='standard',
        man_defense_pct=50,
        scoring_option_1='Elite Shooter',
        scoring_option_2='Rim Finisher',
        scoring_option_3='Role Player 1',
        rebounding_strategy='standard'
    )

    tactical_defense = TacticalSettings(
        pace='standard',
        man_defense_pct=60,
        rebounding_strategy='standard'
    )

    possession_context = PossessionContext(
        is_transition=False,
        shot_clock=24,
        score_differential=0,
        game_time_remaining=2880
    )

    # Run 10 possessions with different seeds
    results = []
    for i in range(10):
        result = simulate_possession(
            offensive_team=offensive_team,
            defensive_team=defensive_team,
            tactical_settings_offense=tactical_offense,
            tactical_settings_defense=tactical_defense,
            possession_context=possession_context,
            seed=i  # Different seed each time
        )
        results.append(result)

    # Display summary
    print("POSSESSION SUMMARY:")
    print("-" * 100)
    print(f"{'#':<5} {'Outcome':<15} {'Pts':<5} {'Scorer':<20} {'Shot Type':<12} {'Assist':<20}")
    print("-" * 100)

    total_points = 0
    outcomes_count = {'made_shot': 0, 'missed_shot': 0, 'turnover': 0}

    for i, result in enumerate(results, 1):
        outcome = result.possession_outcome
        points = result.points_scored
        scorer = result.scoring_player or '-'
        shot_type = result.debug.get('shot_type', '-')
        assist = result.assist_player or '-'

        total_points += points
        outcomes_count[outcome] += 1

        print(f"{i:<5} {outcome:<15} {points:<5} {scorer:<20} {shot_type:<12} {assist:<20}")

    print("-" * 100)
    print(f"Total Points: {total_points}")
    print(f"Made Shots: {outcomes_count['made_shot']}")
    print(f"Missed Shots: {outcomes_count['missed_shot']}")
    print(f"Turnovers: {outcomes_count['turnover']}")
    print()

    # Show detailed play-by-play for interesting possessions
    print("=" * 100)
    print("DETAILED PLAY-BY-PLAY (Selected Possessions)")
    print("=" * 100)

    for i, result in enumerate(results, 1):
        if result.possession_outcome == 'made_shot' or (
            result.possession_outcome == 'missed_shot' and
            result.debug.get('rebound', {}).get('offensive_rebound', False)
        ):
            print()
            print(f"POSSESSION #{i}:")
            print("-" * 100)
            print(result.play_by_play_text)
            print()

            # Show key stats
            if 'shot_attempt' in result.debug:
                shot = result.debug['shot_attempt']
                print(f"  Shot Details: {shot['shooter_name']} - {shot['shot_type']}")
                print(f"  Success Rate: {shot['final_success_rate']:.1%} (Base: {shot['base_success']:.1%}, "
                      f"Contest: {shot['contest_penalty']:+.1%})")

            if result.debug.get('rebound', {}).get('offensive_rebound'):
                reb = result.debug['rebound']
                print(f"  OREB by {reb['rebounder_name']}")
                if reb.get('putback_attempted'):
                    print(f"  Putback: {'MADE' if reb['putback_made'] else 'MISSED'}")

    print()
    print("=" * 100)
    print("TEST COMPLETE")
    print("=" * 100)


if __name__ == '__main__':
    main()
