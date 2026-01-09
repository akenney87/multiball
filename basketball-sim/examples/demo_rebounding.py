"""
Demonstration of the rebounding system.

Shows the complete rebounding flow with debug output.
"""

from src.systems.rebounding import simulate_rebound, format_rebound_debug
from src.core.probability import set_seed
from tests.test_rebounding import (
    create_balanced_team,
    create_elite_rebounding_team,
    create_poor_rebounding_team
)


def demo_basic_rebound():
    """Demonstrate basic rebound with balanced teams."""
    print("=" * 80)
    print("DEMO 1: Balanced Teams - Standard Rebounding")
    print("=" * 80)
    print()

    set_seed(42)

    off_team = create_balanced_team('Offense')
    def_team = create_balanced_team('Defense')

    result = simulate_rebound(
        off_team, def_team,
        offensive_strategy='standard',
        defensive_strategy='standard',
        shot_type='midrange',
        shot_made=False
    )

    print(format_rebound_debug(result))
    print()


def demo_crash_glass():
    """Demonstrate crash glass strategy."""
    print("=" * 80)
    print("DEMO 2: Crash Glass Strategy (5 offensive rebounders)")
    print("=" * 80)
    print()

    set_seed(100)

    off_team = create_balanced_team('Offense')
    def_team = create_balanced_team('Defense')

    result = simulate_rebound(
        off_team, def_team,
        offensive_strategy='crash_glass',
        defensive_strategy='standard',
        shot_type='rim',
        shot_made=False
    )

    print(format_rebound_debug(result))
    print()


def demo_elite_vs_poor():
    """Demonstrate elite rebounders dominating poor rebounders."""
    print("=" * 80)
    print("DEMO 3: Elite Rebounders vs Poor Rebounders")
    print("=" * 80)
    print()

    set_seed(200)

    off_team = create_elite_rebounding_team('Elite')
    def_team = create_poor_rebounding_team('Poor')

    result = simulate_rebound(
        off_team, def_team,
        offensive_strategy='standard',
        defensive_strategy='standard',
        shot_type='midrange',
        shot_made=False
    )

    print(format_rebound_debug(result))
    print()


def demo_putback_attempt():
    """Demonstrate putback attempt by tall player."""
    print("=" * 80)
    print("DEMO 4: Offensive Rebound with Putback Attempt")
    print("=" * 80)
    print()

    set_seed(300)

    # Create team with very tall players (all height 85+)
    from tests.test_rebounding import create_test_player

    tall_team = [
        create_test_player('Center', 'C', height=95, jumping=85, core_strength=85,
                          awareness=80, reactions=75, determination=80,
                          finesse=70, hand_eye_coordination=65, balance=70),
        create_test_player('PF', 'PF', height=88, jumping=80, core_strength=80,
                          awareness=75, reactions=70, determination=75),
        create_test_player('SF', 'SF', height=82, jumping=75, core_strength=75,
                          awareness=70, reactions=65, determination=70),
        create_test_player('SG', 'SG', height=78, jumping=70, core_strength=70,
                          awareness=65, reactions=60, determination=65),
        create_test_player('PG', 'PG', height=74, jumping=65, core_strength=65,
                          awareness=60, reactions=55, determination=60),
    ]

    def_team = create_balanced_team('Defense')

    # Keep trying until we get an OREB
    for i in range(50):
        set_seed(300 + i)
        result = simulate_rebound(
            tall_team, def_team,
            offensive_strategy='crash_glass',
            defensive_strategy='prevent_transition',
            shot_type='rim',
            shot_made=False
        )

        if result['offensive_rebound'] and result.get('putback_attempted'):
            print(format_rebound_debug(result))
            print()
            print("PUTBACK RESULT:")
            if result['putback_made']:
                print(f"  {result['rebounder_name']} MAKES THE PUTBACK! (+2 points)")
            else:
                print(f"  {result['rebounder_name']} misses the putback attempt")
            print()
            break
    else:
        print("No putback attempt occurred in 50 attempts")
        print()


def demo_statistical_summary():
    """Run many rebounds and show statistical summary."""
    print("=" * 80)
    print("DEMO 5: Statistical Summary (200 rebounds)")
    print("=" * 80)
    print()

    set_seed(1000)

    off_team = create_balanced_team('Offense')
    def_team = create_balanced_team('Defense')

    orebs = 0
    drebs = 0
    putback_attempts = 0
    putback_makes = 0
    kickouts = 0

    for i in range(200):
        set_seed(1000 + i)
        result = simulate_rebound(
            off_team, def_team,
            offensive_strategy='standard',
            defensive_strategy='standard',
            shot_type='midrange',
            shot_made=False
        )

        if result['offensive_rebound']:
            orebs += 1
            if result.get('putback_attempted'):
                putback_attempts += 1
                if result.get('putback_made'):
                    putback_makes += 1
            else:
                kickouts += 1
        else:
            drebs += 1

    total = orebs + drebs
    oreb_rate = orebs / total * 100
    dreb_rate = drebs / total * 100

    print(f"Total Rebounds: {total}")
    print(f"Offensive Rebounds: {orebs} ({oreb_rate:.1f}%)")
    print(f"Defensive Rebounds: {drebs} ({dreb_rate:.1f}%)")
    print()
    print(f"Putback Attempts: {putback_attempts}")
    if putback_attempts > 0:
        putback_success_rate = putback_makes / putback_attempts * 100
        print(f"Putback Makes: {putback_makes} ({putback_success_rate:.1f}%)")
    print(f"Kickouts: {kickouts}")
    print()
    print(f"NBA Average OREB%: ~27%")
    print(f"Our Simulation: {oreb_rate:.1f}%")
    print()


if __name__ == '__main__':
    demo_basic_rebound()
    demo_crash_glass()
    demo_elite_vs_poor()
    demo_putback_attempt()
    demo_statistical_summary()

    print("=" * 80)
    print("All demos complete!")
    print("=" * 80)
