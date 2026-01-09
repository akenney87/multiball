"""
Generate 3 Sample Play-by-Play Logs for M2 User Review

Creates representative quarter simulations to showcase:
1. Fast pace, high scoring
2. Standard pace, balanced teams
3. Slow pace, defensive battle
"""

import json
from src.core.data_structures import TacticalSettings
from src.systems.quarter_simulation import QuarterSimulator


def create_tactical_settings(
    pace: str,
    man_defense_pct: int,
    rebounding_strategy: str,
    roster: list,
    scoring_options: list
) -> TacticalSettings:
    """Create tactical settings with default minutes allocation."""
    minutes_allotment = {p['name']: 32.0 for p in roster}

    return TacticalSettings(
        pace=pace,
        man_defense_pct=man_defense_pct,
        scoring_option_1=scoring_options[0] if len(scoring_options) > 0 else None,
        scoring_option_2=scoring_options[1] if len(scoring_options) > 1 else None,
        scoring_option_3=scoring_options[2] if len(scoring_options) > 2 else None,
        minutes_allotment=minutes_allotment,
        rebounding_strategy=rebounding_strategy
    )


def main():
    """Generate 3 sample play-by-play logs."""
    # Load sample teams
    with open('data/sample_teams.json') as f:
        data = json.load(f)

    elite_shooters = data['teams']['Elite Shooters']
    elite_defenders = data['teams']['Elite Defenders']
    poor_team = data['teams']['G-League Rookies']

    print("=" * 80)
    print("GENERATING SAMPLE PLAY-BY-PLAY LOGS FOR M2 USER REVIEW")
    print("=" * 80)
    print("")

    # Sample 1: Fast Pace, High Scoring
    print("Sample 1: Fast Pace Game (Elite vs Elite)...")

    home_tactics_1 = create_tactical_settings(
        pace='fast',
        man_defense_pct=60,
        rebounding_strategy='crash_glass',
        roster=elite_shooters,
        scoring_options=[
            elite_shooters[0]['name'],  # Stephen Curry
            elite_shooters[1]['name'],  # Klay Thompson
            elite_shooters[3]['name']   # Kevin Durant
        ]
    )

    away_tactics_1 = create_tactical_settings(
        pace='fast',
        man_defense_pct=70,
        rebounding_strategy='standard',
        roster=elite_defenders,
        scoring_options=[
            elite_defenders[1]['name'],  # Kawhi Leonard
            elite_defenders[0]['name'],  # Draymond Green
            elite_defenders[3]['name']   # Gary Payton
        ]
    )

    sim_1 = QuarterSimulator(
        home_roster=elite_shooters,
        away_roster=elite_defenders,
        tactical_home=home_tactics_1,
        tactical_away=away_tactics_1,
        home_team_name='Elite Shooters',
        away_team_name='Elite Defenders',
        quarter_number=1
    )

    result_1 = sim_1.simulate_quarter(seed=100)

    # Save to file
    with open('output/sample_quarter_fast_pace.txt', 'w', encoding='utf-8') as f:
        f.write(result_1.play_by_play_text)

    print(f"  Saved to output/sample_quarter_fast_pace.txt")
    print(f"  Final Score: {result_1.home_score} - {result_1.away_score}")
    print(f"  Possessions: {result_1.possession_count}")
    print("")

    # Sample 2: Standard Pace, Balanced
    print("Sample 2: Standard Pace Game (Elite Shooters vs Elite Defenders)...")

    home_tactics_2 = create_tactical_settings(
        pace='standard',
        man_defense_pct=50,
        rebounding_strategy='standard',
        roster=elite_shooters,
        scoring_options=[
            elite_shooters[0]['name'],  # Stephen Curry
            elite_shooters[1]['name'],  # Klay Thompson
            elite_shooters[3]['name']   # Kevin Durant
        ]
    )

    away_tactics_2 = create_tactical_settings(
        pace='standard',
        man_defense_pct=50,
        rebounding_strategy='standard',
        roster=elite_defenders,
        scoring_options=[
            elite_defenders[1]['name'],  # Kawhi Leonard
            elite_defenders[0]['name'],  # Draymond Green
            elite_defenders[3]['name']   # Gary Payton
        ]
    )

    sim_2 = QuarterSimulator(
        home_roster=elite_shooters,
        away_roster=elite_defenders,
        tactical_home=home_tactics_2,
        tactical_away=away_tactics_2,
        home_team_name='Elite Shooters',
        away_team_name='Elite Defenders',
        quarter_number=1
    )

    result_2 = sim_2.simulate_quarter(seed=200)

    # Save to file
    with open('output/sample_quarter_standard.txt', 'w', encoding='utf-8') as f:
        f.write(result_2.play_by_play_text)

    print(f"  Saved to output/sample_quarter_standard.txt")
    print(f"  Final Score: {result_2.home_score} - {result_2.away_score}")
    print(f"  Possessions: {result_2.possession_count}")
    print("")

    # Sample 3: Slow Pace, Defensive Battle
    print("Sample 3: Slow Pace Game (Defensive Battle)...")

    home_tactics_3 = create_tactical_settings(
        pace='slow',
        man_defense_pct=30,  # More zone defense
        rebounding_strategy='prevent_transition',
        roster=elite_defenders,
        scoring_options=[
            elite_defenders[1]['name'],  # Kawhi Leonard
            elite_defenders[0]['name'],  # Draymond Green
            elite_defenders[3]['name']   # Gary Payton
        ]
    )

    away_tactics_3 = create_tactical_settings(
        pace='slow',
        man_defense_pct=40,
        rebounding_strategy='prevent_transition',
        roster=poor_team,
        scoring_options=[
            poor_team[0]['name'],
            poor_team[1]['name'],
            poor_team[2]['name']
        ]
    )

    sim_3 = QuarterSimulator(
        home_roster=elite_defenders,
        away_roster=poor_team,
        tactical_home=home_tactics_3,
        tactical_away=away_tactics_3,
        home_team_name='Elite Defenders',
        away_team_name='G-League Rookies',
        quarter_number=1
    )

    result_3 = sim_3.simulate_quarter(seed=300)

    # Save to file
    with open('output/sample_quarter_slow_pace.txt', 'w', encoding='utf-8') as f:
        f.write(result_3.play_by_play_text)

    print(f"  Saved to output/sample_quarter_slow_pace.txt")
    print(f"  Final Score: {result_3.home_score} - {result_3.away_score}")
    print(f"  Possessions: {result_3.possession_count}")
    print("")

    print("=" * 80)
    print("All sample play-by-play logs generated successfully!")
    print("")
    print("Files created:")
    print("  1. output/sample_quarter_fast_pace.txt")
    print("  2. output/sample_quarter_standard.txt")
    print("  3. output/sample_quarter_slow_pace.txt")
    print("")
    print("These files are ready for user review.")
    print("=" * 80)


if __name__ == '__main__':
    main()
