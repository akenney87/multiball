"""
Shooting System Demonstration

Shows all shooting mechanics in action with detailed output.
"""

from src.systems.shooting import (
    select_shot_type,
    attempt_shot,
    simulate_contest_distance,
)
from src.core.data_structures import PossessionContext, TacticalSettings
from src.core.probability import set_seed


def create_curry():
    """Stephen Curry archetype - elite shooter."""
    return {
        'name': 'Stephen Curry',
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
        'height': 75,
        'arm_strength': 70,
        'awareness': 95,
        'reactions': 92,
        'grip_strength': 70,
        'core_strength': 70,
        'acceleration': 85,
        'top_speed': 80,
        'stamina': 90,
        'durability': 85,
        'creativity': 90,
        'determination': 95,
        'bravery': 80,
        'patience': 90,
        'deception': 85,
        'teamwork': 92,
    }


def create_shaq():
    """Shaquille O'Neal archetype - elite dunker."""
    return {
        'name': "Shaquille O'Neal",
        'position': 'C',
        'jumping': 90,
        'height': 95,
        'arm_strength': 95,
        'agility': 65,
        'finesse': 70,
        'hand_eye_coordination': 75,
        'balance': 80,
        'form_technique': 40,
        'throw_accuracy': 35,
        'composure': 85,
        'consistency': 70,
        'reactions': 75,
        'awareness': 80,
        'grip_strength': 95,
        'core_strength': 98,
        'acceleration': 60,
        'top_speed': 55,
        'stamina': 85,
        'durability': 95,
        'creativity': 60,
        'determination': 95,
        'bravery': 95,
        'patience': 50,
        'deception': 55,
        'teamwork': 70,
    }


def create_kawhi():
    """Kawhi Leonard archetype - elite defender."""
    return {
        'name': 'Kawhi Leonard',
        'position': 'SF',
        'height': 80,
        'reactions': 95,
        'agility': 92,
        'awareness': 93,
        'top_speed': 88,
        'jumping': 85,
        'arm_strength': 75,
        'core_strength': 80,
        'balance': 85,
        'stamina': 90,
        'form_technique': 60,
        'throw_accuracy': 55,
        'finesse': 65,
        'hand_eye_coordination': 80,
        'composure': 85,
        'consistency': 75,
        'grip_strength': 78,
        'acceleration': 90,
        'durability': 88,
        'creativity': 70,
        'determination': 90,
        'bravery': 88,
        'patience': 80,
        'deception': 65,
        'teamwork': 85,
    }


def create_trae():
    """Trae Young archetype - poor defender."""
    return {
        'name': 'Trae Young',
        'position': 'PG',
        'height': 72,
        'reactions': 75,
        'agility': 85,
        'awareness': 88,
        'top_speed': 82,
        'jumping': 65,
        'arm_strength': 40,
        'core_strength': 45,
        'balance': 75,
        'stamina': 85,
        'form_technique': 92,
        'throw_accuracy': 94,
        'finesse': 90,
        'hand_eye_coordination': 93,
        'composure': 88,
        'consistency': 85,
        'grip_strength': 45,
        'acceleration': 88,
        'durability': 70,
        'creativity': 95,
        'determination': 85,
        'bravery': 70,
        'patience': 80,
        'deception': 92,
        'teamwork': 88,
    }


def print_divider():
    print("\n" + "=" * 70)


def demo_scenario(title, shooter, defender, context, defense_type='man'):
    """Simulate and display a shooting scenario."""
    print_divider()
    print(f"SCENARIO: {title}")
    print_divider()

    # Select shot type
    tactics = TacticalSettings(pace='standard')
    shot_type = select_shot_type(shooter, tactics, context, defense_type)

    # Simulate contest
    contest_distance = simulate_contest_distance(shooter, defender)

    # Attempt shot
    success, debug = attempt_shot(
        shooter=shooter,
        defender=defender,
        shot_type=shot_type,
        contest_distance=contest_distance,
        possession_context=context,
        defense_type=defense_type
    )

    # Display results
    print(f"\nShooter: {shooter['name']}")
    print(f"Defender: {defender['name']}")
    print(f"Defense Type: {defense_type.upper()}")
    print(f"Transition: {'YES' if context.is_transition else 'NO'}")

    print(f"\n--- SHOT SELECTION ---")
    print(f"Shot Type: {debug['shot_type'].upper()}")

    print(f"\n--- COMPOSITES ---")
    print(f"Shooter Composite: {debug['shooter_composite']:.2f}")
    print(f"Defender Composite: {debug['defender_composite']:.2f}")
    print(f"Attribute Difference: {debug['attribute_diff']:+.2f}")

    print(f"\n--- PROBABILITY CALCULATION ---")
    print(f"Base Rate: {debug['base_rate']:.1%}")
    print(f"Base Success (uncontested): {debug['base_success']:.1%}")

    if contest_distance >= 6.0:
        contest_label = "WIDE OPEN"
    elif contest_distance >= 2.0:
        contest_label = "CONTESTED"
    else:
        contest_label = "HEAVILY CONTESTED"

    print(f"\n--- CONTEST ---")
    print(f"Distance: {debug['contest_distance']:.1f} ft ({contest_label})")
    print(f"Contest Penalty: {debug['contest_penalty']:.1%}")

    if debug['transition_bonus'] > 0:
        print(f"\n--- TRANSITION BONUS ---")
        print(f"Bonus: +{debug['transition_bonus']:.1%}")

    print(f"\n--- FINAL RESULT ---")
    print(f"Final Success Rate: {debug['final_success_rate']:.1%}")
    print(f"Roll: {debug['roll_value']:.4f}")
    print(f"Result: {debug['result'].upper()}")

    if success:
        points = 3 if debug['shot_type'] == '3pt' else 2
        print(f"\n>>> {shooter['name']} SCORES {points} POINTS! <<<")
    else:
        print(f"\n>>> MISS <<<")


def main():
    """Run shooting system demonstration."""
    set_seed(42)

    curry = create_curry()
    shaq = create_shaq()
    kawhi = create_kawhi()
    trae = create_trae()

    print("\n" + "#" * 70)
    print("#" + " " * 68 + "#")
    print("#" + " " * 15 + "SHOOTING SYSTEM DEMONSTRATION" + " " * 23 + "#")
    print("#" + " " * 68 + "#")
    print("#" * 70)

    # Scenario 1: Elite shooter vs poor defender (wide open)
    demo_scenario(
        "Elite Shooter vs Weak Defender (Halfcourt)",
        shooter=curry,
        defender=trae,
        context=PossessionContext(is_transition=False),
        defense_type='man'
    )

    # Scenario 2: Elite shooter vs elite defender
    demo_scenario(
        "Elite Shooter vs Elite Defender (Lockdown)",
        shooter=curry,
        defender=kawhi,
        context=PossessionContext(is_transition=False),
        defense_type='man'
    )

    # Scenario 3: Elite dunker in transition
    demo_scenario(
        "Elite Dunker in Transition",
        shooter=shaq,
        defender=trae,
        context=PossessionContext(is_transition=True),
        defense_type='man'
    )

    # Scenario 4: Elite shooter vs zone defense
    demo_scenario(
        "Elite Shooter vs Zone Defense",
        shooter=curry,
        defender=kawhi,
        context=PossessionContext(is_transition=False),
        defense_type='zone'
    )

    # Statistical summary
    print_divider()
    print("STATISTICAL VALIDATION (100 attempts each)")
    print_divider()

    scenarios = [
        ("Curry (wide open) vs Trae", curry, trae, PossessionContext(is_transition=False), 'man'),
        ("Curry (contested) vs Kawhi", curry, kawhi, PossessionContext(is_transition=False), 'man'),
        ("Shaq (halfcourt rim)", shaq, trae, PossessionContext(is_transition=False), 'man'),
        ("Shaq (transition rim)", shaq, trae, PossessionContext(is_transition=True), 'man'),
    ]

    for title, shooter, defender, context, defense in scenarios:
        makes = 0
        for _ in range(100):
            tactics = TacticalSettings(pace='standard')
            shot_type = select_shot_type(shooter, tactics, context, defense)
            contest_distance = simulate_contest_distance(shooter, defender)
            success, _ = attempt_shot(
                shooter=shooter,
                defender=defender,
                shot_type=shot_type,
                contest_distance=contest_distance,
                possession_context=context,
                defense_type=defense
            )
            if success:
                makes += 1

        print(f"\n{title}: {makes}% make rate")

    print_divider()
    print("\nDemonstration complete!")
    print("\nKey Takeaways:")
    print("  - Two-stage calculation: base success + contest penalty")
    print("  - Elite shooters reach ~70-85% wide open")
    print("  - Elite defenders reduce success by ~15-25%")
    print("  - Transition provides +8-20% bonus")
    print("  - Zone defense increases 3PT attempts but reduces contest")
    print("  - All probabilities bounded to [0, 1]")
    print("  - Full debug transparency for every shot")


if __name__ == '__main__':
    main()
