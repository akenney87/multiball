"""
Demonstration script for the turnover system.

Shows turnover mechanics with various scenarios:
1. Average vs Average matchup (baseline)
2. Elite ball handler vs poor defender
3. Poor ball handler vs elite defender
4. Fast pace vs slow pace
5. Man defense vs zone defense
6. Transition vs halfcourt
"""

import json
from src.systems.turnovers import check_turnover, get_turnover_description
from src.core.data_structures import TacticalSettings, PossessionContext
from src.core.probability import set_seed


def load_sample_teams():
    """Load sample teams from JSON."""
    with open('data/sample_teams.json', 'r') as f:
        data = json.load(f)
    return data['teams']


def run_scenario(
    scenario_name: str,
    ball_handler,
    defender,
    tactical_settings: TacticalSettings,
    possession_context: PossessionContext,
    trials: int = 100
):
    """Run a turnover scenario and print results."""
    print(f"\n{'='*70}")
    print(f"SCENARIO: {scenario_name}")
    print(f"{'='*70}")
    print(f"Ball Handler: {ball_handler['name']}")
    print(f"Defender: {defender['name']}")
    print(f"Pace: {tactical_settings.pace}")
    print(f"Defense: {tactical_settings.man_defense_pct}% man, {100-tactical_settings.man_defense_pct}% zone")
    print(f"Transition: {possession_context.is_transition}")
    print(f"\nRunning {trials} possessions...\n")

    turnovers = 0
    turnover_types = {
        'bad_pass': 0,
        'lost_ball': 0,
        'offensive_foul': 0,
        'violation': 0
    }
    steals = 0
    transition_triggers = 0

    # Run one detailed example first
    occurred, debug = check_turnover(
        ball_handler,
        defender,
        tactical_settings,
        possession_context
    )

    print("DETAILED EXAMPLE:")
    print(f"  Ball Handler Composite: {debug['ball_handler_composite']:.2f}")
    print(f"  Base Turnover Rate: {debug['base_turnover_rate']:.1%}")
    print(f"  Pace Modifier: {debug['pace_modifier']:+.1%}")
    print(f"  Zone Modifier: {debug['zone_modifier']:+.1%}")
    print(f"  Transition Modifier: {debug['transition_modifier']:+.1%}")
    print(f"  Total Modifier: {debug['total_modifier']:+.1%}")
    print(f"  Sigmoid Adjustment: {debug['sigmoid_output']:.3f}x")
    print(f"  Final Turnover Rate: {debug['adjusted_turnover_rate']:.1%}")
    print(f"  Roll: {debug['roll_value']:.3f}")
    print(f"  Result: {'TURNOVER' if occurred else 'No Turnover'}")

    if occurred:
        print(f"  Type: {debug['turnover_type']}")
        print(f"  Steal: {debug['steal_credited_to'] or 'No'}")
        print(f"  Triggers Transition: {debug['triggers_transition']}")

    # Run full trial
    print(f"\nSTATISTICAL RESULTS ({trials} possessions):")

    for _ in range(trials):
        occurred, debug = check_turnover(
            ball_handler,
            defender,
            tactical_settings,
            possession_context
        )

        if occurred:
            turnovers += 1
            turnover_types[debug['turnover_type']] += 1

            if debug['steal_credited_to']:
                steals += 1

            if debug['triggers_transition']:
                transition_triggers += 1

    turnover_rate = turnovers / trials
    print(f"  Overall Turnover Rate: {turnover_rate:.1%} ({turnovers}/{trials})")

    if turnovers > 0:
        print(f"\n  Turnover Type Breakdown:")
        for t_type, count in turnover_types.items():
            if count > 0:
                pct = count / turnovers
                print(f"    {t_type:20s}: {pct:.1%} ({count})")

        print(f"\n  Steals: {steals}/{turnovers} ({steals/turnovers:.1%} of turnovers)")
        print(f"  Transition Triggers: {transition_triggers}/{turnovers} ({transition_triggers/turnovers:.1%} of turnovers)")


def main():
    """Run turnover system demonstration."""
    set_seed(42)

    print("\n" + "="*70)
    print("BASKETBALL SIMULATOR - TURNOVER SYSTEM DEMONSTRATION")
    print("="*70)

    # Load teams
    teams = load_sample_teams()

    # Extract players
    elite_shooters = teams['Elite Shooters']
    elite_defenders = teams['Elite Defenders']
    g_league = teams['G-League Rookies']

    curry = elite_shooters[0]  # Stephen Curry
    payton = elite_defenders[1]  # Gary Payton
    shaq = elite_shooters[4]  # Shaq (poor ball handler)
    rookie_pg = g_league[0]  # Rookie point guard

    # Standard settings
    standard_tactics = TacticalSettings(
        pace='standard',
        man_defense_pct=50,
        rebounding_strategy='standard'
    )

    standard_context = PossessionContext(
        is_transition=False,
        shot_clock=24
    )

    # Scenario 1: Baseline (average composite matchup)
    run_scenario(
        "Baseline - Curry (Elite) vs Rookie (Poor)",
        curry,
        rookie_pg,
        standard_tactics,
        standard_context,
        trials=100
    )

    # Scenario 2: Elite ball handler
    run_scenario(
        "Elite Ball Handler - Curry vs Payton (Elite Defender)",
        curry,
        payton,
        standard_tactics,
        standard_context,
        trials=100
    )

    # Scenario 3: Poor ball handler
    run_scenario(
        "Poor Ball Handler - Shaq vs Payton",
        shaq,
        payton,
        standard_tactics,
        standard_context,
        trials=100
    )

    # Scenario 4: Fast pace
    fast_tactics = TacticalSettings(
        pace='fast',
        man_defense_pct=50,
        rebounding_strategy='standard'
    )

    run_scenario(
        "Fast Pace - Curry vs Payton",
        curry,
        payton,
        fast_tactics,
        standard_context,
        trials=100
    )

    # Scenario 5: Zone defense
    zone_tactics = TacticalSettings(
        pace='standard',
        man_defense_pct=0,  # 100% zone
        rebounding_strategy='standard'
    )

    run_scenario(
        "Zone Defense (100%) - Curry vs Payton",
        curry,
        payton,
        zone_tactics,
        standard_context,
        trials=100
    )

    # Scenario 6: Transition
    transition_context = PossessionContext(
        is_transition=True,
        shot_clock=24
    )

    run_scenario(
        "Transition Possession - Curry vs Payton",
        curry,
        payton,
        standard_tactics,
        transition_context,
        trials=100
    )

    # Scenario 7: Worst case (poor handler, fast pace, zone defense)
    worst_case_tactics = TacticalSettings(
        pace='fast',
        man_defense_pct=0,
        rebounding_strategy='standard'
    )

    run_scenario(
        "Worst Case - Shaq (Poor Handler), Fast Pace, Zone Defense",
        shaq,
        payton,
        worst_case_tactics,
        standard_context,
        trials=100
    )

    # Scenario 8: Best case (elite handler, slow pace, transition)
    best_case_tactics = TacticalSettings(
        pace='slow',
        man_defense_pct=100,  # All man
        rebounding_strategy='standard'
    )

    run_scenario(
        "Best Case - Curry (Elite), Slow Pace, Man Defense, Transition",
        curry,
        rookie_pg,  # Poor defender
        best_case_tactics,
        transition_context,
        trials=100
    )

    print("\n" + "="*70)
    print("DEMONSTRATION COMPLETE")
    print("="*70)
    print("\nKey Takeaways:")
    print("1. Base turnover rate ~8%, modified by attributes and tactics")
    print("2. Elite ball handlers (90+ composite) have <3% turnover rates")
    print("3. Poor ball handlers (30 composite) have ~6-10% turnover rates")
    print("4. Fast pace adds ~2.5%, slow pace reduces ~2.5%")
    print("5. Zone defense adds ~3% to turnover rate")
    print("6. Transition reduces turnovers by ~2%")
    print("7. Live ball turnovers (bad_pass, lost_ball) trigger transition")
    print("8. Elite defenders get steal credit ~70% of the time on live ball TOs")
    print("="*70 + "\n")


if __name__ == '__main__':
    main()
