"""
M4.5 PHASE 4: Check substitution counts per team per game

Target: ~20 substitutions per team per game
"""

import json
import os
from pathlib import Path

def analyze_substitution_counts(validation_dir: str):
    """Analyze substitution counts from validation games."""

    games_dir = Path(validation_dir) / "games"

    if not games_dir.exists():
        print(f"Error: {games_dir} not found")
        return

    game_files = sorted(games_dir.glob("game_*.json"))

    if not game_files:
        print(f"No game files found in {games_dir}")
        return

    print("=" * 80)
    print("SUBSTITUTION COUNT ANALYSIS")
    print("=" * 80)
    print(f"\nAnalyzing {len(game_files)} games from {validation_dir}\n")

    all_sub_counts = []

    for game_file in game_files[:10]:  # Analyze first 10 games for quick check
        with open(game_file, 'r') as f:
            game_data = json.load(f)

        game_num = game_data.get('game_number', '?')
        home_team = game_data.get('home_team', 'Home')
        away_team = game_data.get('away_team', 'Away')

        # Count substitutions by team
        home_subs = 0
        away_subs = 0

        # Check if game has substitution data
        if 'substitutions' in game_data:
            for sub in game_data['substitutions']:
                # Determine team by player name prefix
                player_out = sub.get('player_out', '')

                if home_team in player_out:
                    home_subs += 1
                elif away_team in player_out:
                    away_subs += 1
                else:
                    # Old format without team prefix - try to infer
                    # Count all as unknown for now
                    pass

        total_subs = home_subs + away_subs
        all_sub_counts.append(total_subs)

        print(f"Game {game_num:3d}: {home_team} vs {away_team}")
        print(f"  Home subs: {home_subs:2d} | Away subs: {away_subs:2d} | Total: {total_subs:2d}")

    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)

    if all_sub_counts:
        avg_total = sum(all_sub_counts) / len(all_sub_counts)
        avg_per_team = avg_total / 2

        print(f"\nAverage substitutions per game (both teams): {avg_total:.1f}")
        print(f"Average substitutions per team per game: {avg_per_team:.1f}")
        print(f"\nTarget: ~20 substitutions per team per game")

        if 18 <= avg_per_team <= 22:
            print("STATUS: ✓ GOOD - Within target range!")
        elif 15 <= avg_per_team <= 25:
            print("STATUS: ~ OK - Close to target")
        else:
            print(f"STATUS: ✗ OFF TARGET - Expected ~20, got {avg_per_team:.1f}")
    else:
        print("\nNo substitution data found. Games may be using old format.")
        print("Running a fresh game with current code...")

if __name__ == "__main__":
    # Check the most recent validation
    validation_dir = "m45_final_validation"

    if not os.path.exists(validation_dir):
        print(f"{validation_dir} not found. Trying m45_fixed_validation...")
        validation_dir = "m45_fixed_validation"

    if not os.path.exists(validation_dir):
        print("No validation directories found. Running a test game...")
        # Run a single test game
        import random
        from generate_teams import generate_team
        from src.systems.full_game import simulate_full_game
        from src.core.data_structures import TacticalSettings

        random.seed(99999)

        home_team_data = generate_team(team_name="TestHome", overall_rating=75)
        away_team_data = generate_team(team_name="TestAway", overall_rating=75)

        home_tactics = TacticalSettings(
            minutes_allotment={p['name']: 24 for p in home_team_data['roster']}
        )
        away_tactics = TacticalSettings(
            minutes_allotment={p['name']: 24 for p in away_team_data['roster']}
        )

        print("\nRunning test game to count substitutions...\n")

        result = simulate_full_game(
            home_roster=home_team_data['roster'],
            away_roster=away_team_data['roster'],
            tactical_home=home_tactics,
            tactical_away=away_tactics
        )

        # Count substitutions
        home_subs = 0
        away_subs = 0

        for q_result in result['quarter_results']:
            for sub in q_result.substitution_events:
                if 'TestHome' in sub.player_out:
                    home_subs += 1
                else:
                    away_subs += 1

        print("=" * 80)
        print("TEST GAME SUBSTITUTION COUNTS")
        print("=" * 80)
        print(f"\nHome team (TestHome): {home_subs} substitutions")
        print(f"Away team (TestAway): {away_subs} substitutions")
        print(f"Total: {home_subs + away_subs} substitutions")
        print(f"\nAverage per team: {(home_subs + away_subs) / 2:.1f}")
        print(f"Target: ~20 substitutions per team per game")

        avg_per_team = (home_subs + away_subs) / 2
        if 18 <= avg_per_team <= 22:
            print("\nSTATUS: ✓ GOOD - Within target range!")
        elif 15 <= avg_per_team <= 25:
            print("\nSTATUS: ~ OK - Close to target")
        else:
            print(f"\nSTATUS: ✗ OFF TARGET - Expected ~20, got {avg_per_team:.1f}")
    else:
        analyze_substitution_counts(validation_dir)
