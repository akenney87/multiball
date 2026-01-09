"""
Tactical Validation: Pace Settings
Tests whether FAST vs SLOW pace produces expected possession count differences.

Expected Results (per basketball_sim.md):
- FAST pace: +10% to +15% more possessions
- SLOW pace: -10% to -15% fewer possessions
- Standard pace: baseline (~100 possessions per team)

Target: ~15-20% total difference between FAST and SLOW
"""

import json
import random
from pathlib import Path
from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

def validate_pace_impact(games_per_setting: int = 50, seed: int = 42):
    """Run games with different pace settings and compare possession counts."""

    results = {
        'fast': {'possessions': [], 'points': [], 'fg_pct': []},
        'standard': {'possessions': [], 'points': [], 'fg_pct': []},
        'slow': {'possessions': [], 'points': [], 'fg_pct': []}
    }

    random.seed(seed)

    # Load team pool from teams directory
    print("Loading team pool...")
    teams_dir = Path('teams')
    teams = []
    for team_file in sorted(teams_dir.glob('Team_*.json'))[:30]:
        with open(team_file, 'r') as f:
            teams.append(json.load(f))

    print(f"Loaded {len(teams)} teams\n")

    for pace_setting in ['fast', 'standard', 'slow']:
        print(f"{'='*80}")
        print(f"Testing {pace_setting.upper()} pace ({games_per_setting} games)...")
        print(f"{'='*80}")

        for game_num in range(games_per_setting):
            # Randomly select two teams
            home_team, away_team = random.sample(teams, 2)

            # Create minutes allotment for both teams
            home_minutes = {player['name']: 24.0 for player in home_team['roster'][:10]}
            away_minutes = {player['name']: 24.0 for player in away_team['roster'][:10]}

            # Set tactical settings
            home_tactics = TacticalSettings(
                pace=pace_setting,
                man_defense_pct=50,
                scoring_option_1=home_team['roster'][0]['name'],
                scoring_option_2=home_team['roster'][1]['name'],
                scoring_option_3=home_team['roster'][2]['name'],
                minutes_allotment=home_minutes,
                rebounding_strategy='standard'
            )

            away_tactics = TacticalSettings(
                pace=pace_setting,
                man_defense_pct=50,
                scoring_option_1=away_team['roster'][0]['name'],
                scoring_option_2=away_team['roster'][1]['name'],
                scoring_option_3=away_team['roster'][2]['name'],
                minutes_allotment=away_minutes,
                rebounding_strategy='standard'
            )

            # Simulate game
            try:
                sim = GameSimulator(
                    home_roster=home_team['roster'],
                    away_roster=away_team['roster'],
                    home_team_name=home_team['name'],
                    away_team_name=away_team['name'],
                    tactical_home=home_tactics,
                    tactical_away=away_tactics
                )
                result = sim.simulate_game()

                # Extract metrics
                stats = result.game_statistics
                total_poss = stats.get('total_possessions', 0)

                home_stats = stats['home_stats']
                away_stats = stats['away_stats']

                # Calculate FG%
                home_fg_pct = (home_stats['fgm'] / home_stats['fga'] * 100) if home_stats['fga'] > 0 else 0
                away_fg_pct = (away_stats['fgm'] / away_stats['fga'] * 100) if away_stats['fga'] > 0 else 0
                avg_fg_pct = (home_fg_pct + away_fg_pct) / 2

                # Store results
                results[pace_setting]['possessions'].append(total_poss)
                results[pace_setting]['points'].append(result.home_score + result.away_score)
                results[pace_setting]['fg_pct'].append(avg_fg_pct)

                if (game_num + 1) % 10 == 0:
                    print(f"  Completed {game_num + 1}/{games_per_setting} games...")

            except Exception as e:
                print(f"  [ERROR] Game {game_num + 1} failed: {e}")
                import traceback
                traceback.print_exc()
                continue

    # Calculate statistics
    print(f"\n{'='*80}")
    print("PACE VALIDATION RESULTS")
    print(f"{'='*80}\n")

    summary = {}

    for pace_setting in ['fast', 'standard', 'slow']:
        poss_list = results[pace_setting]['possessions']
        points_list = results[pace_setting]['points']
        fg_pct_list = results[pace_setting]['fg_pct']

        if len(poss_list) > 0:
            avg_poss = sum(poss_list) / len(poss_list)
            avg_points = sum(points_list) / len(points_list)
            avg_fg = sum(fg_pct_list) / len(fg_pct_list)

            summary[pace_setting] = {
                'avg_possessions': avg_poss,
                'min_possessions': min(poss_list),
                'max_possessions': max(poss_list),
                'avg_total_points': avg_points,
                'avg_fg_pct': avg_fg,
                'games_completed': len(poss_list)
            }

            print(f"{pace_setting.upper()} Pace:")
            print(f"  Games completed: {len(poss_list)}/{games_per_setting}")
            print(f"  Avg possessions: {avg_poss:.1f}")
            print(f"  Range: {min(poss_list):.1f} - {max(poss_list):.1f}")
            print(f"  Avg total points: {avg_points:.1f}")
            print(f"  Avg FG%: {avg_fg:.1f}%")
            print()

    # Calculate differences
    if 'standard' in summary and 'fast' in summary and 'slow' in summary:
        standard_poss = summary['standard']['avg_possessions']
        fast_poss = summary['fast']['avg_possessions']
        slow_poss = summary['slow']['avg_possessions']

        fast_diff_pct = ((fast_poss - standard_poss) / standard_poss) * 100
        slow_diff_pct = ((slow_poss - standard_poss) / standard_poss) * 100
        total_diff_pct = ((fast_poss - slow_poss) / slow_poss) * 100

        print(f"{'='*80}")
        print("PACE IMPACT ANALYSIS")
        print(f"{'='*80}\n")

        print(f"FAST vs STANDARD: {fast_diff_pct:+.1f}% possessions")
        print(f"  Expected: +10% to +15%")
        print(f"  Status: {'[PASS]' if 8 <= fast_diff_pct <= 17 else '[FAIL]'}\n")

        print(f"SLOW vs STANDARD: {slow_diff_pct:+.1f}% possessions")
        print(f"  Expected: -10% to -15%")
        print(f"  Status: {'[PASS]' if -17 <= slow_diff_pct <= -8 else '[FAIL]'}\n")

        print(f"FAST vs SLOW: {total_diff_pct:+.1f}% possessions")
        print(f"  Expected: +18% to +35% (combined effect)")
        print(f"  Status: {'[PASS]' if 15 <= total_diff_pct <= 40 else '[FAIL]'}\n")

        # Overall assessment
        fast_pass = 8 <= fast_diff_pct <= 17
        slow_pass = -17 <= slow_diff_pct <= -8
        total_pass = 15 <= total_diff_pct <= 40

        print(f"{'='*80}")
        if fast_pass and slow_pass and total_pass:
            print("[PASS] PACE TACTICAL VALIDATION: PASSED")
            print("Pace settings produce expected possession count differences.")
        else:
            print("[FAIL] PACE TACTICAL VALIDATION: FAILED")
            print("Pace settings not producing expected effects.")
            if not fast_pass:
                print(f"  - FAST pace deviation: {fast_diff_pct:.1f}% (expected +10% to +15%)")
            if not slow_pass:
                print(f"  - SLOW pace deviation: {slow_diff_pct:.1f}% (expected -10% to -15%)")
            if not total_pass:
                print(f"  - Total spread too narrow/wide: {total_diff_pct:.1f}%")
        print(f"{'='*80}")

        # Save results
        output_path = Path('output/PACE_VALIDATION.txt')
        with open(output_path, 'w') as f:
            f.write("="*80 + "\n")
            f.write("PACE TACTICAL VALIDATION RESULTS\n")
            f.write("="*80 + "\n\n")

            for pace_setting in ['fast', 'standard', 'slow']:
                s = summary[pace_setting]
                f.write(f"{pace_setting.upper()} Pace:\n")
                f.write(f"  Games completed: {s['games_completed']}/{games_per_setting}\n")
                f.write(f"  Avg possessions: {s['avg_possessions']:.1f}\n")
                f.write(f"  Range: {s['min_possessions']:.1f} - {s['max_possessions']:.1f}\n")
                f.write(f"  Avg total points: {s['avg_total_points']:.1f}\n")
                f.write(f"  Avg FG%: {s['avg_fg_pct']:.1f}%\n\n")

            f.write("="*80 + "\n")
            f.write("PACE IMPACT ANALYSIS\n")
            f.write("="*80 + "\n\n")

            f.write(f"FAST vs STANDARD: {fast_diff_pct:+.1f}% possessions\n")
            f.write(f"  Expected: +10% to +15%\n")
            f.write(f"  Status: {'[PASS]' if fast_pass else '[FAIL]'}\n\n")

            f.write(f"SLOW vs STANDARD: {slow_diff_pct:+.1f}% possessions\n")
            f.write(f"  Expected: -10% to -15%\n")
            f.write(f"  Status: {'[PASS]' if slow_pass else '[FAIL]'}\n\n")

            f.write(f"FAST vs SLOW: {total_diff_pct:+.1f}% possessions\n")
            f.write(f"  Expected: +18% to +35%\n")
            f.write(f"  Status: {'[PASS]' if total_pass else '[FAIL]'}\n\n")

            f.write("="*80 + "\n")
            if fast_pass and slow_pass and total_pass:
                f.write("[PASS] OVERALL: PASSED\n")
            else:
                f.write("[FAIL] OVERALL: FAILED\n")
            f.write("="*80 + "\n")

        print(f"\nResults saved to: {output_path}")

if __name__ == "__main__":
    validate_pace_impact(games_per_setting=50, seed=42)
