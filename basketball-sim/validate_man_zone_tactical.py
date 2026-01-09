"""
Tactical Validation: Man vs Zone Defense
Tests whether man_defense_pct setting produces expected statistical differences.

Expected Results (per basketball_sim.md):
- 100% MAN defense: Higher contest rates, lower 3PT attempts
- 100% ZONE defense: Lower contest rates, higher 3PT attempts
- Zone should produce observable differences in turnover rates and shot selection

Target: Observable and meaningful statistical differences
"""

import json
import random
from pathlib import Path
from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

def validate_man_zone_impact(games_per_setting: int = 50, seed: int = 42):
    """Run games with different defensive settings and compare statistics."""

    results = {
        'man_100': {
            'fg3a_per_game': [],
            'fg3_pct': [],
            'turnovers': [],
            'total_points': [],
            'contest_rate_estimate': []
        },
        'balanced_50': {
            'fg3a_per_game': [],
            'fg3_pct': [],
            'turnovers': [],
            'total_points': [],
            'contest_rate_estimate': []
        },
        'zone_100': {
            'fg3a_per_game': [],
            'fg3_pct': [],
            'turnovers': [],
            'total_points': [],
            'contest_rate_estimate': []
        }
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

    # Test configurations
    test_configs = {
        'man_100': 100,
        'balanced_50': 50,
        'zone_100': 0
    }

    for config_name, man_defense_pct in test_configs.items():
        print(f"{'='*80}")
        print(f"Testing {config_name.upper().replace('_', ' ')} ({man_defense_pct}% man) - {games_per_setting} games...")
        print(f"{'='*80}")

        for game_num in range(games_per_setting):
            # Randomly select two teams
            home_team, away_team = random.sample(teams, 2)

            # Create minutes allotment for both teams
            home_minutes = {player['name']: 24.0 for player in home_team['roster'][:10]}
            away_minutes = {player['name']: 24.0 for player in away_team['roster'][:10]}

            # Set tactical settings (both teams use same defense for cleaner analysis)
            home_tactics = TacticalSettings(
                pace='standard',
                man_defense_pct=man_defense_pct,
                scoring_option_1=home_team['roster'][0]['name'],
                scoring_option_2=home_team['roster'][1]['name'],
                scoring_option_3=home_team['roster'][2]['name'],
                minutes_allotment=home_minutes,
                rebounding_strategy='standard'
            )

            away_tactics = TacticalSettings(
                pace='standard',
                man_defense_pct=man_defense_pct,
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
                home_stats = stats['home_stats']
                away_stats = stats['away_stats']

                # Calculate average 3PA per team
                avg_fg3a = (home_stats['fg3a'] + away_stats['fg3a']) / 2.0

                # Calculate average 3PT%
                home_fg3_pct = (home_stats['fg3m'] / home_stats['fg3a'] * 100) if home_stats['fg3a'] > 0 else 0
                away_fg3_pct = (away_stats['fg3m'] / away_stats['fg3a'] * 100) if away_stats['fg3a'] > 0 else 0
                avg_fg3_pct = (home_fg3_pct + away_fg3_pct) / 2

                # Calculate average turnovers per team
                avg_tov = (home_stats['tov'] + away_stats['tov']) / 2.0

                # Total points per game
                total_points = result.home_score + result.away_score

                # Estimate contest rate from FG% depression
                # This is rough: lower FG% = higher contest rate
                home_fg_pct = (home_stats['fgm'] / home_stats['fga'] * 100) if home_stats['fga'] > 0 else 0
                away_fg_pct = (away_stats['fgm'] / away_stats['fga'] * 100) if away_stats['fga'] > 0 else 0
                avg_fg_pct = (home_fg_pct + away_fg_pct) / 2
                # Lower FG% suggests more contests (inverse relationship estimate)
                contest_estimate = 100 - avg_fg_pct  # Rough proxy

                # Store results
                results[config_name]['fg3a_per_game'].append(avg_fg3a)
                results[config_name]['fg3_pct'].append(avg_fg3_pct)
                results[config_name]['turnovers'].append(avg_tov)
                results[config_name]['total_points'].append(total_points)
                results[config_name]['contest_rate_estimate'].append(contest_estimate)

                if (game_num + 1) % 10 == 0:
                    print(f"  Completed {game_num + 1}/{games_per_setting} games...")

            except Exception as e:
                print(f"  [ERROR] Game {game_num + 1} failed: {e}")
                import traceback
                traceback.print_exc()
                continue

    # Calculate statistics
    print(f"\n{'='*80}")
    print("MAN VS ZONE DEFENSE VALIDATION RESULTS")
    print(f"{'='*80}\n")

    summary = {}

    for config_name in ['man_100', 'balanced_50', 'zone_100']:
        data = results[config_name]

        if len(data['fg3a_per_game']) > 0:
            avg_fg3a = sum(data['fg3a_per_game']) / len(data['fg3a_per_game'])
            avg_fg3_pct = sum(data['fg3_pct']) / len(data['fg3_pct'])
            avg_tov = sum(data['turnovers']) / len(data['turnovers'])
            avg_points = sum(data['total_points']) / len(data['total_points'])
            avg_contest = sum(data['contest_rate_estimate']) / len(data['contest_rate_estimate'])

            summary[config_name] = {
                'avg_fg3a': avg_fg3a,
                'avg_fg3_pct': avg_fg3_pct,
                'avg_tov': avg_tov,
                'avg_points': avg_points,
                'avg_contest_estimate': avg_contest,
                'games_completed': len(data['fg3a_per_game'])
            }

            print(f"{config_name.upper().replace('_', ' ')}:")
            print(f"  Games completed: {len(data['fg3a_per_game'])}/{games_per_setting}")
            print(f"  Avg 3PA per team: {avg_fg3a:.1f}")
            print(f"  Avg 3PT%: {avg_fg3_pct:.1f}%")
            print(f"  Avg turnovers per team: {avg_tov:.1f}")
            print(f"  Avg total points: {avg_points:.1f}")
            print(f"  Contest estimate (proxy): {avg_contest:.1f}")
            print()

    # Calculate differences
    if all(k in summary for k in ['man_100', 'balanced_50', 'zone_100']):
        man_fg3a = summary['man_100']['avg_fg3a']
        zone_fg3a = summary['zone_100']['avg_fg3a']
        balanced_fg3a = summary['balanced_50']['avg_fg3a']

        man_fg3_pct = summary['man_100']['avg_fg3_pct']
        zone_fg3_pct = summary['zone_100']['avg_fg3_pct']

        man_tov = summary['man_100']['avg_tov']
        zone_tov = summary['zone_100']['avg_tov']

        man_contest = summary['man_100']['avg_contest_estimate']
        zone_contest = summary['zone_100']['avg_contest_estimate']

        print(f"{'='*80}")
        print("MAN VS ZONE DEFENSE IMPACT ANALYSIS")
        print(f"{'='*80}\n")

        # 3PT attempt rate
        fg3a_diff = zone_fg3a - man_fg3a
        fg3a_diff_pct = (fg3a_diff / man_fg3a) * 100
        print(f"3PT Attempt Rate:")
        print(f"  ZONE vs MAN: {fg3a_diff:+.1f} attempts ({fg3a_diff_pct:+.1f}%)")
        print(f"  Expected: ZONE should encourage more 3PT attempts")
        print(f"  Status: {'[PASS]' if fg3a_diff > 1.0 else '[FAIL]'}")
        print()

        # 3PT percentage (contest effect)
        fg3_pct_diff = zone_fg3_pct - man_fg3_pct
        print(f"3PT Shooting Percentage:")
        print(f"  ZONE vs MAN: {fg3_pct_diff:+.1f}%")
        print(f"  Expected: MAN defense should contest more effectively (lower opponent 3PT%)")
        print(f"  Status: {'[PASS]' if fg3_pct_diff > 1.0 else '[CAUTION]'}")
        print()

        # Turnover rate
        tov_diff = zone_tov - man_tov
        tov_diff_pct = (tov_diff / man_tov) * 100
        print(f"Turnover Rate:")
        print(f"  ZONE vs MAN: {tov_diff:+.1f} turnovers ({tov_diff_pct:+.1f}%)")
        print(f"  Expected: MAN defense should force more turnovers")
        print(f"  Status: {'[PASS]' if tov_diff < -0.5 else '[CAUTION]'}")
        print()

        # Contest proxy
        contest_diff = man_contest - zone_contest
        print(f"Contest Rate (proxy via FG% depression):")
        print(f"  MAN vs ZONE: {contest_diff:+.1f} points difference")
        print(f"  Expected: MAN should contest more (higher proxy value)")
        print(f"  Status: {'[PASS]' if contest_diff > 0.5 else '[CAUTION]'}")
        print()

        # Overall assessment
        fg3a_pass = fg3a_diff > 1.0
        fg3_pct_pass = fg3_pct_diff > 1.0
        tov_pass = tov_diff < -0.5
        contest_pass = contest_diff > 0.5

        tests_passed = sum([fg3a_pass, fg3_pct_pass, tov_pass, contest_pass])

        print(f"{'='*80}")
        if tests_passed >= 3:
            print("[PASS] MAN VS ZONE TACTICAL VALIDATION: PASSED")
            print(f"Man/zone defense settings produce observable statistical differences ({tests_passed}/4 tests passed).")
        elif tests_passed >= 2:
            print("[CAUTION] MAN VS ZONE TACTICAL VALIDATION: PARTIAL")
            print(f"Some effects observed but not all tests passed ({tests_passed}/4 tests passed).")
        else:
            print("[FAIL] MAN VS ZONE TACTICAL VALIDATION: FAILED")
            print(f"Man/zone defense settings not producing expected effects ({tests_passed}/4 tests passed).")

        print(f"{'='*80}")

        # Save results
        output_path = Path('output/MAN_ZONE_VALIDATION.txt')
        with open(output_path, 'w') as f:
            f.write("="*80 + "\n")
            f.write("MAN VS ZONE DEFENSE TACTICAL VALIDATION RESULTS\n")
            f.write("="*80 + "\n\n")

            for config_name in ['man_100', 'balanced_50', 'zone_100']:
                s = summary[config_name]
                f.write(f"{config_name.upper().replace('_', ' ')}:\n")
                f.write(f"  Games completed: {s['games_completed']}/{games_per_setting}\n")
                f.write(f"  Avg 3PA per team: {s['avg_fg3a']:.1f}\n")
                f.write(f"  Avg 3PT%: {s['avg_fg3_pct']:.1f}%\n")
                f.write(f"  Avg turnovers per team: {s['avg_tov']:.1f}\n")
                f.write(f"  Avg total points: {s['avg_points']:.1f}\n")
                f.write(f"  Contest estimate: {s['avg_contest_estimate']:.1f}\n\n")

            f.write("="*80 + "\n")
            f.write("MAN VS ZONE DEFENSE IMPACT ANALYSIS\n")
            f.write("="*80 + "\n\n")

            f.write(f"3PT Attempt Rate:\n")
            f.write(f"  ZONE vs MAN: {fg3a_diff:+.1f} attempts ({fg3a_diff_pct:+.1f}%)\n")
            f.write(f"  Status: {'[PASS]' if fg3a_pass else '[FAIL]'}\n\n")

            f.write(f"3PT Shooting Percentage:\n")
            f.write(f"  ZONE vs MAN: {fg3_pct_diff:+.1f}%\n")
            f.write(f"  Status: {'[PASS]' if fg3_pct_pass else '[CAUTION]'}\n\n")

            f.write(f"Turnover Rate:\n")
            f.write(f"  ZONE vs MAN: {tov_diff:+.1f} turnovers ({tov_diff_pct:+.1f}%)\n")
            f.write(f"  Status: {'[PASS]' if tov_pass else '[CAUTION]'}\n\n")

            f.write(f"Contest Rate (proxy):\n")
            f.write(f"  MAN vs ZONE: {contest_diff:+.1f}\n")
            f.write(f"  Status: {'[PASS]' if contest_pass else '[CAUTION]'}\n\n")

            f.write("="*80 + "\n")
            if tests_passed >= 3:
                f.write("[PASS] OVERALL: PASSED\n")
            elif tests_passed >= 2:
                f.write("[CAUTION] OVERALL: PARTIAL\n")
            else:
                f.write("[FAIL] OVERALL: FAILED\n")
            f.write("="*80 + "\n")

        print(f"\nResults saved to: {output_path}")

if __name__ == "__main__":
    validate_man_zone_impact(games_per_setting=50, seed=42)
