"""
Demo script for M3 Phase 2a: Fouls & Free Throws System

Tests:
1. Shooting fouls during quarter
2. Free throw execution
3. Foul-out substitutions
4. Foul statistics tracking
"""

import json
from src.core.data_structures import TacticalSettings
from src.systems.quarter_simulation import QuarterSimulator


def main():
    # Load sample teams
    with open('data/sample_teams.json') as f:
        data = json.load(f)

    ELITE_SHOOTERS = data['teams']['Elite Shooters']
    ELITE_DEFENDERS = data['teams']['Elite Defenders']

    print("=" * 80)
    print("M3 PHASE 2A DEMO: FOULS & FREE THROWS SYSTEM")
    print("=" * 80)
    print()

    # Define tactical settings
    tactical_shooters = TacticalSettings(
        pace='fast',
        man_defense_pct=80,  # Mostly man defense (more contact = more fouls)
        scoring_option_1='Stephen Curry',
        scoring_option_2='Kevin Durant',
        scoring_option_3='Klay Thompson',
        minutes_allotment={
            'Stephen Curry': 36,
            'Kevin Durant': 36,
            'Klay Thompson': 34,
            'Kyle Lowry': 28,
            'Shaquille O\'Neal': 30,
        },
        rebounding_strategy='standard'
    )

    tactical_defenders = TacticalSettings(
        pace='fast',
        man_defense_pct=80,  # Also man defense (more contact)
        scoring_option_1='Kawhi Leonard',
        scoring_option_2='Gary Payton',
        scoring_option_3='Draymond Green',
        minutes_allotment={
            'Kawhi Leonard': 36,
            'Gary Payton': 34,
            'Draymond Green': 32,
            'Dennis Rodman': 30,
            'Rudy Gobert': 28,
        },
        rebounding_strategy='crash_glass'
    )

    # Simulate quarter with fouls enabled
    print("Simulating quarter with fouls enabled...")
    print()

    quarter_sim = QuarterSimulator(
        home_roster=ELITE_SHOOTERS,
        away_roster=ELITE_DEFENDERS,
        tactical_home=tactical_shooters,
        tactical_away=tactical_defenders,
        home_team_name="Elite Shooters",
        away_team_name="Elite Defenders",
        quarter_number=1
    )

    result = quarter_sim.simulate_quarter(seed=42)

    # Display results
    print("=" * 80)
    print("QUARTER COMPLETE!")
    print("=" * 80)
    print()
    print(f"Final Score: {result.home_score} - {result.away_score}")
    print(f"Possessions: {result.possession_count}")
    print()

    # Display foul statistics
    foul_summary = quarter_sim.foul_system.get_foul_summary()
    print("FOUL STATISTICS:")
    print("-" * 80)
    print(f"Total Fouls: {foul_summary['total_fouls']}")
    print(f"Shooting Fouls: {foul_summary['shooting_fouls']}")
    print(f"Non-Shooting Fouls: {foul_summary['non_shooting_fouls']}")
    print(f"Players Fouled Out: {foul_summary['fouled_out_count']}")
    if foul_summary['fouled_out_players']:
        print(f"Fouled Out: {', '.join(foul_summary['fouled_out_players'])}")
    print()

    # Display foul events
    if foul_summary['foul_events']:
        print("FOUL EVENTS:")
        print("-" * 80)
        for foul in foul_summary['foul_events'][:10]:  # First 10 fouls
            ft_str = f"{foul.free_throws_awarded} FT" if foul.free_throws_awarded > 0 else "no FT"
            and_one_str = " (And-1)" if foul.and_one else ""
            print(f"[{foul.game_time}] {foul.foul_type}: {foul.fouling_player} fouls {foul.fouled_player} - {ft_str}{and_one_str}")
            print(f"  Personal fouls: {foul.personal_fouls_after}, Team fouls: {foul.team_fouls_after}")
            if foul.fouled_out:
                print(f"  ** {foul.fouling_player} FOULED OUT **")
        if len(foul_summary['foul_events']) > 10:
            print(f"... and {len(foul_summary['foul_events']) - 10} more fouls")
        print()

    # Save play-by-play to file
    output_file = "output/demo_fouls_quarter.txt"
    with open(output_file, 'w') as f:
        f.write(result.play_by_play_text)

    print(f"Full play-by-play saved to: {output_file}")
    print()
    print("Demo complete!")


if __name__ == '__main__':
    main()
