"""
Defense System Demonstration

Shows all defensive mechanics in action with detailed output.
"""

import json
from src.systems.defense import (
    assign_defender,
    calculate_contest_distance,
    select_help_defender,
    apply_zone_modifiers,
    get_zone_drive_modifier,
    get_primary_defender,
    calculate_contest_quality,
    format_defense_debug,
)
from src.core.probability import set_seed, calculate_composite
from src.constants import WEIGHTS_CONTEST


def load_sample_teams():
    """Load sample teams from JSON."""
    with open('data/sample_teams.json', 'r') as f:
        data = json.load(f)
    return data['teams']


def print_section(title):
    """Print formatted section header."""
    print(f"\n{'='*80}")
    print(f"{title.center(80)}")
    print(f"{'='*80}\n")


def demo_defensive_assignment():
    """Demonstrate defensive assignment system."""
    print_section("DEFENSIVE ASSIGNMENT SYSTEM")

    teams = load_sample_teams()
    elite_shooters = teams['Elite Shooters']
    elite_defenders = teams['Elite Defenders']

    shooter = elite_shooters[0]  # Stephen Curry
    print(f"Shooter: {shooter['name']} ({shooter['position']})")
    print(f"Position: {shooter['position']}")

    # Test position-based assignment
    available = [p['name'] for p in elite_defenders]
    defender = assign_defender(shooter, elite_defenders, available)

    print(f"\nAssigned Defender: {defender['name']} ({defender['position']})")

    if '_assignment_debug' in defender:
        debug = defender['_assignment_debug']
        print(f"\nAssignment Logic:")
        print(f"  Offensive Player: {debug['offensive_player']}")
        print(f"  Offensive Position: {debug['offensive_position']}")
        print(f"\n  Candidate Scores:")
        for name, info in debug['all_scores'].items():
            print(f"    {name}:")
            print(f"      Position: {info['position']}")
            print(f"      Compatibility: {info['compatibility']:.2f}")
            print(f"      Defensive Composite: {info['defensive_composite']:.2f}")
            print(f"      Combined Score: {info['combined_score']:.3f}")
        print(f"\n  Selected: {debug['selected']} (Score: {debug['selected_score']:.3f})")


def demo_contest_distance():
    """Demonstrate contest distance calculation."""
    print_section("CONTEST DISTANCE CALCULATION")

    teams = load_sample_teams()
    defenders = teams['Elite Defenders']

    print("Testing different defender qualities:\n")

    # Elite defender
    elite = defenders[0]
    elite_composite = calculate_composite(elite, WEIGHTS_CONTEST)
    elite_distance = calculate_contest_distance(elite)
    print(f"Elite Defender: {elite['name']}")
    print(f"  Contest Composite: {elite_composite:.2f}")
    print(f"  Contest Distance: {elite_distance:.2f} ft")
    print(f"  Category: {'HEAVILY CONTESTED' if elite_distance < 2 else 'CONTESTED'}")

    # Average defender (create one)
    avg_defender = {
        'name': 'Average Joe',
        'position': 'SF',
        'height': 75,
        'reactions': 50,
        'agility': 50,
    }
    # Add remaining attributes at 50
    for attr in ['grip_strength', 'arm_strength', 'core_strength', 'acceleration',
                 'top_speed', 'jumping', 'stamina', 'balance', 'durability',
                 'awareness', 'creativity', 'determination', 'bravery',
                 'consistency', 'composure', 'patience', 'hand_eye_coordination',
                 'throw_accuracy', 'form_technique', 'finesse', 'deception', 'teamwork']:
        avg_defender[attr] = 50

    avg_composite = calculate_composite(avg_defender, WEIGHTS_CONTEST)
    avg_distance = calculate_contest_distance(avg_defender)
    print(f"\nAverage Defender: {avg_defender['name']}")
    print(f"  Contest Composite: {avg_composite:.2f}")
    print(f"  Contest Distance: {avg_distance:.2f} ft")
    print(f"  Category: {'CONTESTED' if 2 <= avg_distance < 6 else 'WIDE OPEN'}")

    # Test help defense penalty
    print(f"\n\nHelp Defense Penalty (+3 ft):")
    help_distance = calculate_contest_distance(elite, is_help_defense=True)
    print(f"  {elite['name']} as help defender:")
    print(f"    Base distance: {elite_distance:.2f} ft")
    print(f"    Help distance: {help_distance:.2f} ft")
    print(f"    Penalty: +{help_distance - elite_distance:.2f} ft")

    # Test zone defense effect
    print(f"\n\nZone Defense Effect:")
    for zone_pct in [0, 50, 100]:
        zone_distance = calculate_contest_distance(elite, zone_pct=zone_pct)
        print(f"  {zone_pct}% Zone: {zone_distance:.2f} ft "
              f"(+{zone_distance - elite_distance:.2f} ft from base)")


def demo_help_defense():
    """Demonstrate help defense selection."""
    print_section("HELP DEFENSE SYSTEM")

    teams = load_sample_teams()
    defensive_team = teams['Elite Defenders']

    # Pick a perimeter defender as primary
    primary = defensive_team[0]
    print(f"Primary Defender (beaten): {primary['name']} ({primary['position']})")

    # Run multiple simulations to show stochastic behavior
    print(f"\nHelp Defense Rotations (10 attempts):\n")

    help_selections = []
    for i in range(10):
        set_seed(100 + i)
        help_defender = select_help_defender(defensive_team, primary)

        if help_defender:
            help_selections.append(help_defender['name'])
            print(f"  Attempt {i+1}: {help_defender['name']} rotates")

            if i == 0 and '_help_defense_debug' in help_defender:
                # Show detailed debug for first rotation
                debug = help_defender['_help_defense_debug']
                print(f"\n    Rotation Details:")
                for candidate in debug['all_candidates']:
                    print(f"      {candidate['name']}:")
                    print(f"        Composite: {candidate['composite']:.2f}")
                    print(f"        Awareness: {candidate['awareness']}")
                    print(f"        Rotation Prob: {candidate['rotation_prob']:.3f}")
                    print(f"        Rotated: {'YES' if candidate['rotated'] else 'NO'}")
                print()
        else:
            print(f"  Attempt {i+1}: No help defender rotates")

    if help_selections:
        print(f"\nSummary:")
        print(f"  Total Rotations: {len(help_selections)}/10")
        print(f"  Most Common Helper: {max(set(help_selections), key=help_selections.count)}")


def demo_zone_modifiers():
    """Demonstrate zone defense modifiers."""
    print_section("ZONE DEFENSE MODIFIERS")

    print("Contest Effectiveness Reduction:\n")

    base_effectiveness = 0.80
    print(f"Base Contest Effectiveness: {base_effectiveness:.2%}\n")

    for zone_pct in [0, 25, 50, 75, 100]:
        modified = apply_zone_modifiers(base_effectiveness, zone_pct)
        penalty = modified - base_effectiveness
        print(f"  {zone_pct:3d}% Zone: {modified:.2%} "
              f"(penalty: {penalty:.2%})")

    print("\n\nDrive Success Modifier:\n")

    for zone_pct in [0, 25, 50, 75, 100]:
        modifier = get_zone_drive_modifier(zone_pct)
        penalty_pct = (1.0 - modifier) * 100
        print(f"  {zone_pct:3d}% Zone: {modifier:.2f}x multiplier "
              f"(-{penalty_pct:.1f}% success rate)")


def demo_integrated_defense():
    """Demonstrate integrated defense coordinator."""
    print_section("INTEGRATED DEFENSE COORDINATOR")

    teams = load_sample_teams()
    offensive_team = teams['Elite Shooters']
    defensive_team = teams['Elite Defenders']

    shooter = offensive_team[0]  # Stephen Curry
    print(f"Shooter: {shooter['name']} ({shooter['position']})")

    # Manual assignments
    manual_assignments = {
        shooter['name']: defensive_team[1]['name']  # Assign specific defender
    }

    # Test man defense with manual assignment
    print(f"\n1. MAN DEFENSE (Manual Assignment):")
    print(f"   Assignment: {shooter['name']} -> {manual_assignments[shooter['name']]}")

    man_defender = get_primary_defender(
        shooter,
        defensive_team,
        manual_assignments,
        defense_type='man'
    )

    print(f"   Result: {man_defender['name']} ({man_defender['_assignment_type']})")

    # Test man defense without manual assignment (fallback)
    print(f"\n2. MAN DEFENSE (Position Fallback):")

    fallback_defender = get_primary_defender(
        shooter,
        defensive_team,
        {},  # No manual assignments
        defense_type='man'
    )

    print(f"   Result: {fallback_defender['name']} ({fallback_defender['_assignment_type']})")

    # Test zone defense
    print(f"\n3. ZONE DEFENSE (Proximity-Based):")

    zone_defender = get_primary_defender(
        shooter,
        defensive_team,
        manual_assignments,  # Ignored in zone
        defense_type='zone'
    )

    print(f"   Result: {zone_defender['name']} ({zone_defender['_assignment_type']})")
    print(f"   Note: Manual assignment ignored in zone defense")


def demo_contest_quality():
    """Demonstrate contest quality calculation."""
    print_section("CONTEST QUALITY ASSESSMENT")

    teams = load_sample_teams()
    defender = teams['Elite Defenders'][0]

    print(f"Defender: {defender['name']}\n")
    print(f"Contest Quality by Distance:\n")

    distances = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 10.0]

    for distance in distances:
        quality = calculate_contest_quality(defender, distance)

        # Determine category
        if quality >= 0.7:
            category = "EXCELLENT"
        elif quality >= 0.5:
            category = "GOOD"
        elif quality >= 0.3:
            category = "MODERATE"
        else:
            category = "POOR"

        bar_length = int(quality * 40)
        bar = '#' * bar_length + '-' * (40 - bar_length)

        print(f"  {distance:4.1f} ft: {quality:.3f} [{bar}] {category}")

    print(f"\nHelp Defense Trigger Threshold: 0.30")
    print(f"Contests below 0.30 quality trigger help defense rotation")


def main():
    """Run all demonstrations."""
    set_seed(42)

    print("\n" + "="*80)
    print("BASKETBALL SIMULATOR - DEFENSE SYSTEM DEMONSTRATION".center(80))
    print("="*80)
    print("\nThis demo showcases all defensive mechanics:")
    print("  1. Defensive Assignment (position-based)")
    print("  2. Contest Distance Calculation")
    print("  3. Help Defense Selection")
    print("  4. Zone Defense Modifiers")
    print("  5. Integrated Defense Coordinator")
    print("  6. Contest Quality Assessment")

    demo_defensive_assignment()
    demo_contest_distance()
    demo_help_defense()
    demo_zone_modifiers()
    demo_integrated_defense()
    demo_contest_quality()

    print("\n" + "="*80)
    print("DEMONSTRATION COMPLETE".center(80))
    print("="*80 + "\n")


if __name__ == '__main__':
    main()
