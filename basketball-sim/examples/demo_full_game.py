"""
Demo script for M3 Phase 1: Full 48-minute game simulation

Demonstrates:
1. Full game simulation (4 quarters)
2. Halftime stamina recovery
3. Cumulative statistics
4. Full game box score
"""

import json
from src.core.data_structures import TacticalSettings
from src.systems.game_simulation import GameSimulator


def main():
    # Load sample teams
    with open('data/sample_teams.json') as f:
        data = json.load(f)

    ELITE_SHOOTERS = data['teams']['Elite Shooters']
    ELITE_DEFENDERS = data['teams']['Elite Defenders']
    print("=" * 80)
    print("M3 PHASE 1 DEMO: FULL 48-MINUTE GAME SIMULATION")
    print("=" * 80)
    print()

    # Define tactical settings
    tactical_shooters = TacticalSettings(
        pace='fast',
        man_defense_pct=80,  # Mostly man defense
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
        pace='slow',
        man_defense_pct=30,  # Mostly zone defense
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

    # Create game simulator
    print("Initializing full game simulator...")
    print(f"Home Team: Elite Shooters (Fast Pace, Man Defense)")
    print(f"Away Team: Elite Defenders (Slow Pace, Zone Defense)")
    print()

    game_sim = GameSimulator(
        home_roster=ELITE_SHOOTERS,
        away_roster=ELITE_DEFENDERS,
        tactical_home=tactical_shooters,
        tactical_away=tactical_defenders,
        home_team_name="Elite Shooters",
        away_team_name="Elite Defenders"
    )

    # Simulate full game
    print("Simulating 48-minute game...")
    print()
    game_result = game_sim.simulate_game(seed=42)

    # Display results
    print()
    print("=" * 80)
    print("GAME COMPLETE!")
    print("=" * 80)
    print()
    print(f"Final Score: {game_result.home_score} - {game_result.away_score}")
    print()
    print("Quarter-by-Quarter:")
    for i, (home_q, away_q) in enumerate(game_result.quarter_scores, 1):
        print(f"  Q{i}: Elite Shooters {home_q}, Elite Defenders {away_q}")
    print()

    # Save full play-by-play to file
    output_file = "output/demo_full_game.txt"
    with open(output_file, 'w') as f:
        f.write(game_result.play_by_play_text)

    print(f"Full game play-by-play saved to: {output_file}")
    print()

    # Display summary statistics
    stats = game_result.game_statistics
    print("Game Statistics:")
    print(f"  Total Possessions: {stats['total_possessions']}")
    print(f"  {stats['home_team']}: {stats['home_stats']['points']} points, {stats['home_stats']['fgm']}/{stats['home_stats']['fga']} FG")
    print(f"  {stats['away_team']}: {stats['away_stats']['points']} points, {stats['away_stats']['fgm']}/{stats['away_stats']['fga']} FG")
    print()

    print("Demo complete!")


if __name__ == '__main__':
    main()
