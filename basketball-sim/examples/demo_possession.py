"""
Demo script for possession orchestration system.

Tests a single possession with full debug output.
"""

import json
from src.core.data_structures import PossessionContext, TacticalSettings
from src.systems.possession import simulate_possession


# Create sample teams with extreme attributes for testing
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
    print("=" * 80)
    print("BASKETBALL SIMULATOR - POSSESSION ORCHESTRATION DEMO")
    print("=" * 80)
    print()

    # Build teams
    offensive_team = [
        create_elite_shooter(),
        create_rim_finisher(),
        create_balanced_player('Role Player 1', 'SG'),
        create_balanced_player('Role Player 2', 'PF'),
        create_balanced_player('Role Player 3', 'C'),
    ]

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
        man_defense_pct=70,  # Mostly man defense
        rebounding_strategy='standard'
    )

    # Possession context
    possession_context = PossessionContext(
        is_transition=False,
        shot_clock=24,
        score_differential=0,
        game_time_remaining=2880
    )

    print("TEAMS:")
    print(f"Offense: {', '.join([p['name'] for p in offensive_team])}")
    print(f"Defense: {', '.join([p['name'] for p in defensive_team])}")
    print()

    print("TACTICAL SETTINGS:")
    print(f"Offense: Pace={tactical_offense.pace}, Scoring Options={tactical_offense.scoring_option_1}, "
          f"{tactical_offense.scoring_option_2}, {tactical_offense.scoring_option_3}")
    print(f"Defense: Man={tactical_defense.man_defense_pct}%, Rebounding={tactical_defense.rebounding_strategy}")
    print()

    print("POSSESSION CONTEXT:")
    print(f"Transition={possession_context.is_transition}, Shot Clock={possession_context.shot_clock}s")
    print()

    # Simulate possession
    print("SIMULATING POSSESSION...")
    print("-" * 80)

    result = simulate_possession(
        offensive_team=offensive_team,
        defensive_team=defensive_team,
        tactical_settings_offense=tactical_offense,
        tactical_settings_defense=tactical_defense,
        possession_context=possession_context,
        seed=42  # Fixed seed for reproducibility
    )

    # Display results
    print()
    print("=" * 80)
    print("PLAY-BY-PLAY:")
    print("=" * 80)
    print(result.play_by_play_text)
    print()

    print("=" * 80)
    print("POSSESSION RESULT:")
    print("=" * 80)
    print(f"Outcome: {result.possession_outcome}")
    print(f"Points Scored: {result.points_scored}")
    print(f"Scoring Player: {result.scoring_player}")
    print(f"Assist Player: {result.assist_player}")
    print(f"Rebounder: {result.rebound_player}")
    print()

    print("=" * 80)
    print("DEBUG INFORMATION:")
    print("=" * 80)

    # Pretty print key debug sections
    print("\n[Usage Distribution]")
    for player, usage in result.debug['usage_distribution'].items():
        print(f"  {player}: {usage:.1%}")

    print(f"\n[Ball Handler]: {result.debug['ball_handler']}")

    if 'shooter' in result.debug:
        print(f"[Shooter]: {result.debug['shooter']}")
        print(f"[Primary Defender]: {result.debug['primary_defender']}")
        print(f"[Shot Type]: {result.debug['shot_type']}")
        print(f"[Contest Distance]: {result.debug['contest_distance']:.2f} ft")

    if 'turnover_check' in result.debug:
        to_check = result.debug['turnover_check']
        print(f"\n[Turnover Check]")
        print(f"  Ball Handler Composite: {to_check['ball_handler_composite']:.2f}")
        print(f"  Adjusted TO Rate: {to_check['adjusted_turnover_rate']:.1%}")
        print(f"  Turnover Occurred: {to_check['turnover_occurred']}")

    if 'shot_attempt' in result.debug:
        shot = result.debug['shot_attempt']
        print(f"\n[Shot Attempt]")
        print(f"  Shooter Composite: {shot['shooter_composite']:.2f}")
        print(f"  Defender Composite: {shot['defender_composite']:.2f}")
        print(f"  Base Success Rate: {shot['base_success']:.1%}")
        print(f"  Contest Penalty: {shot['contest_penalty']:.1%}")
        print(f"  Final Success Rate: {shot['final_success_rate']:.1%}")
        print(f"  Roll: {shot['roll_value']:.3f}")
        print(f"  Result: {shot['result']}")

    if 'rebound' in result.debug:
        reb = result.debug['rebound']
        if reb['rebound_occurred']:
            print(f"\n[Rebound]")
            print(f"  Offensive Rebounders: {reb['num_offensive_rebounders']}")
            print(f"  Defensive Rebounders: {reb['num_defensive_rebounders']}")
            print(f"  OREB Probability: {reb['final_oreb_probability']:.1%}")
            print(f"  Result: {'OFFENSIVE' if reb['offensive_rebound'] else 'DEFENSIVE'} REBOUND")
            print(f"  Rebounder: {reb['rebounder_name']}")

            if reb['offensive_rebound'] and reb['putback_attempted']:
                print(f"  Putback Attempted: YES")
                print(f"  Putback Made: {reb['putback_made']}")

    print()
    print("=" * 80)
    print("DEMO COMPLETE")
    print("=" * 80)


if __name__ == '__main__':
    main()
