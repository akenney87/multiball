"""
Demo: Quarter Simulation (Milestone 2)

Demonstrates a complete 12-minute quarter simulation with:
- Stamina tracking and degradation
- Substitution system
- Play-by-play narrative
- Quarter statistics

Usage:
    python demo_quarter.py
    python demo_quarter.py --seed 42  # For reproducibility
"""

import sys
import json
from src.core.data_structures import TacticalSettings
from src.systems.quarter_simulation import QuarterSimulator


def load_sample_teams(filepath="data/sample_teams.json"):
    """Load sample teams from JSON file."""
    with open(filepath, 'r') as f:
        data = json.load(f)
    return data


def main():
    """Run quarter simulation demo."""
    print("=" * 70)
    print("BASKETBALL SIMULATOR - MILESTONE 2 DEMO")
    print("Quarter Simulation with Stamina and Substitutions")
    print("=" * 70)
    print()

    # Load teams
    print("Loading sample teams...")
    teams_data = load_sample_teams()

    home_roster = teams_data['teams']['Elite Shooters']
    away_roster = teams_data['teams']['Elite Defenders']

    print(f"Home Team: Elite Shooters ({len(home_roster)} players)")
    print(f"Away Team: Elite Defenders ({len(away_roster)} players)")
    print()

    # Define tactical settings
    print("Configuring tactical settings...")

    # Home: Aggressive (fast pace, high man defense, crash glass)
    tactical_home = TacticalSettings(
        pace='fast',
        man_defense_pct=80,
        scoring_option_1='Stephen Curry',
        scoring_option_2='Klay Thompson',
        scoring_option_3='Kevin Durant',
        rebounding_strategy='crash_glass',
        minutes_allotment={
            'Stephen Curry': 36,
            'Klay Thompson': 32,
            'Kevin Durant': 36,
            'Kyle Lowry': 24,
            'Shaquille O\'Neal': 28,
        }
    )

    # Away: Balanced (standard pace, balanced defense)
    tactical_away = TacticalSettings(
        pace='standard',
        man_defense_pct=50,
        scoring_option_1='Kawhi Leonard',
        scoring_option_2='Gary Payton',
        scoring_option_3=None,
        rebounding_strategy='standard',
        minutes_allotment={
            'Draymond Green': 32,
            'Kawhi Leonard': 36,
            'Dennis Rodman': 24,
            'Gary Payton': 32,
            'Rudy Gobert': 28,
        }
    )

    print("Home (Elite Shooters): Fast pace, 80% man defense, crash glass")
    print("Away (Elite Defenders): Standard pace, 50% man defense, standard")
    print()

    # Parse seed from command line
    seed = None
    if len(sys.argv) > 1 and sys.argv[1] == '--seed':
        seed = int(sys.argv[2])
        print(f"Using random seed: {seed}")
        print()

    # Create quarter simulator
    print("Initializing quarter simulator...")
    simulator = QuarterSimulator(
        home_roster=home_roster,
        away_roster=away_roster,
        tactical_home=tactical_home,
        tactical_away=tactical_away,
        home_team_name="Elite Shooters",
        away_team_name="Elite Defenders",
        quarter_number=1
    )

    # Run simulation
    print("Simulating 1st quarter...")
    print()
    print("=" * 70)
    print()

    result = simulator.simulate_quarter(seed=seed)

    # Display results
    print(result.play_by_play_text)
    print()
    print("=" * 70)
    print()

    # Additional stats
    print("QUARTER SUMMARY")
    print("=" * 70)
    print(f"Final Score: {result.home_score} - {result.away_score}")
    print(f"Total Possessions: {result.possession_count}")
    print()

    print("STAMINA REPORT (Final Values)")
    print("-" * 70)
    for player_name, stamina in sorted(result.stamina_final.items()):
        minutes = result.minutes_played.get(player_name, 0.0)
        print(f"{player_name:25s} {stamina:5.1f} stamina  ({minutes:.1f} min played)")
    print()

    # Write play-by-play to file
    output_file = "output/quarter_playbyplay.txt"
    print(f"Writing play-by-play to {output_file}...")

    import os
    os.makedirs("output", exist_ok=True)

    with open(output_file, 'w') as f:
        f.write(result.play_by_play_text)

    print(f"Play-by-play saved to {output_file}")
    print()
    print("=" * 70)
    print("Demo complete!")


if __name__ == '__main__':
    main()
