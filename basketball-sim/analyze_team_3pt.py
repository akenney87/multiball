"""
Analyze correlation between team 3PT shooting composite and actual team 3PT%.
"""
import json
from pathlib import Path
from typing import List, Dict, Any
import statistics


def calculate_3pt_composite(player: Dict[str, Any]) -> float:
    """Calculate 3PT shooting composite for a player."""
    weights = {
        'form_technique': 0.25,
        'throw_accuracy': 0.20,
        'finesse': 0.15,
        'hand_eye_coordination': 0.12,
        'balance': 0.10,
        'composure': 0.08,
        'consistency': 0.06,
        'agility': 0.04
    }

    composite = sum(player.get(attr, 50) * weight for attr, weight in weights.items())
    return composite


def load_teams_with_composites(teams_dir: str) -> Dict[str, Dict]:
    """Load all teams and calculate their average 3PT composite."""
    teams_data = {}

    for team_file in sorted(Path(teams_dir).glob('team_*.json')):
        team = json.loads(team_file.read_text())
        team_name = team['name']

        # Calculate composite for each player
        player_composites = [calculate_3pt_composite(p) for p in team['roster']]

        teams_data[team_name] = {
            'avg_composite': statistics.mean(player_composites),
            'roster_size': len(team['roster']),
            'overall_rating': team.get('actual_overall_rating', 0)
        }

    return teams_data


def analyze_validation_games(validation_dir: str, teams_data: Dict) -> Dict[str, Dict]:
    """Extract team 3PT stats from validation games."""
    team_stats = {}

    games_dir = Path(validation_dir) / 'games'
    if not games_dir.exists():
        print(f"Games directory not found: {games_dir}")
        return team_stats

    for game_file in sorted(games_dir.glob('game_*.json')):
        game = json.loads(game_file.read_text())

        # Get team names
        home_team = game['home_team']
        away_team = game['away_team']

        # Initialize if needed
        if home_team not in team_stats:
            team_stats[home_team] = {'fg3m': 0, 'fg3a': 0, 'games': 0}
        if away_team not in team_stats:
            team_stats[away_team] = {'fg3m': 0, 'fg3a': 0, 'games': 0}

        # Get stats
        game_stats = game.get('game_statistics', {})
        home_stats = game_stats.get('home_stats', {})
        away_stats = game_stats.get('away_stats', {})

        # Accumulate
        team_stats[home_team]['fg3m'] += home_stats.get('fg3m', 0)
        team_stats[home_team]['fg3a'] += home_stats.get('fg3a', 0)
        team_stats[home_team]['games'] += 1

        team_stats[away_team]['fg3m'] += away_stats.get('fg3m', 0)
        team_stats[away_team]['fg3a'] += away_stats.get('fg3a', 0)
        team_stats[away_team]['games'] += 1

    # Calculate percentages
    for team_name, stats in team_stats.items():
        if stats['fg3a'] > 0:
            stats['fg3_pct'] = (stats['fg3m'] / stats['fg3a']) * 100
            stats['fg3a_per_game'] = stats['fg3a'] / stats['games'] if stats['games'] > 0 else 0
        else:
            stats['fg3_pct'] = 0.0
            stats['fg3a_per_game'] = 0.0

    return team_stats


def main():
    print("="*80)
    print("TEAM 3PT COMPOSITE vs ACTUAL 3PT% CORRELATION ANALYSIS")
    print("="*80)

    # Load teams with composites
    print("\nLoading teams and calculating 3PT composites...")
    teams_data = load_teams_with_composites('teams')
    print(f"Loaded {len(teams_data)} teams")

    # Analyze validation games
    validation_dir = 'validation/foul_fix_test'
    print(f"\nAnalyzing validation games from {validation_dir}...")
    team_game_stats = analyze_validation_games(validation_dir, teams_data)

    if not team_game_stats:
        print("WARNING: No team stats found!")
        validation_dir = 'validation/turnover_fix_final'
        print(f"Trying {validation_dir}...")
        team_game_stats = analyze_validation_games(validation_dir, teams_data)

    print(f"Found stats for {len(team_game_stats)} teams")

    # Merge data
    analysis_data = []
    for team_name, composite_data in teams_data.items():
        if team_name in team_game_stats:
            game_stats = team_game_stats[team_name]

            # Only include teams with meaningful sample
            if game_stats['games'] >= 1:
                analysis_data.append({
                    'team': team_name,
                    'composite': composite_data['avg_composite'],
                    'overall_rating': composite_data['overall_rating'],
                    'fg3m': game_stats['fg3m'],
                    'fg3a': game_stats['fg3a'],
                    'fg3_pct': game_stats['fg3_pct'],
                    'fg3a_per_game': game_stats['fg3a_per_game'],
                    'games': game_stats['games']
                })

    print(f"\nMerged data for {len(analysis_data)} teams")

    # Sort by composite
    analysis_data.sort(key=lambda x: x['composite'])

    # Create composite buckets
    print("\n" + "="*80)
    print("3PT SHOOTING BY TEAM COMPOSITE RANGE")
    print("="*80)

    buckets = [
        (0, 55, "Very Poor (0-55)"),
        (55, 60, "Poor (55-60)"),
        (60, 65, "Below Average (60-65)"),
        (65, 70, "Average (65-70)"),
        (70, 75, "Good (70-75)"),
        (75, 100, "Elite (75+)")
    ]

    bucket_results = []

    for min_comp, max_comp, label in buckets:
        bucket_teams = [t for t in analysis_data if min_comp <= t['composite'] < max_comp]

        if not bucket_teams:
            continue

        total_3pm = sum(t['fg3m'] for t in bucket_teams)
        total_3pa = sum(t['fg3a'] for t in bucket_teams)
        avg_pct = (total_3pm / total_3pa * 100) if total_3pa > 0 else 0
        avg_composite = sum(t['composite'] for t in bucket_teams) / len(bucket_teams)

        bucket_results.append({
            'label': label,
            'avg_composite': avg_composite,
            'avg_pct': avg_pct,
            'teams': len(bucket_teams)
        })

        print(f"\n{label}")
        print(f"  Teams: {len(bucket_teams)}")
        print(f"  Avg Composite: {avg_composite:.1f}")
        print(f"  Combined 3PT: {total_3pm}/{total_3pa} ({avg_pct:.1f}%)")

        # NBA expectations
        if max_comp <= 60:
            expected = "28-32%"
            assessment = "✓" if 28 <= avg_pct <= 32 else "⚠️"
        elif max_comp <= 65:
            expected = "31-35%"
            assessment = "✓" if 31 <= avg_pct <= 35 else "⚠️"
        elif max_comp <= 70:
            expected = "34-38%"
            assessment = "✓" if 34 <= avg_pct <= 38 else "⚠️"
        elif max_comp <= 75:
            expected = "37-41%"
            assessment = "✓" if 37 <= avg_pct <= 41 else "⚠️"
        else:
            expected = "40-45%"
            assessment = "✓" if 40 <= avg_pct <= 45 else "⚠️"

        print(f"  Expected: {expected} {assessment}")

    # Show top and bottom teams
    print("\n" + "="*80)
    print("TOP 15 TEAMS (by 3PT composite)")
    print("="*80)
    print(f"{'Team':<15} {'Comp':>6} {'Rating':>6} {'3PM':>4} {'3PA':>4} {'3P%':>6} {'3PA/G':>6}")
    print("-"*80)

    top_15 = sorted(analysis_data, key=lambda x: x['composite'], reverse=True)[:15]
    for t in top_15:
        print(f"{t['team']:<15} {t['composite']:>6.1f} {t['overall_rating']:>6.1f} {t['fg3m']:>4} {t['fg3a']:>4} {t['fg3_pct']:>6.1f}% {t['fg3a_per_game']:>6.1f}")

    print("\n" + "="*80)
    print("BOTTOM 15 TEAMS (by 3PT composite)")
    print("="*80)
    print(f"{'Team':<15} {'Comp':>6} {'Rating':>6} {'3PM':>4} {'3PA':>4} {'3P%':>6} {'3PA/G':>6}")
    print("-"*80)

    bottom_15 = sorted(analysis_data, key=lambda x: x['composite'])[:15]
    for t in bottom_15:
        print(f"{t['team']:<15} {t['composite']:>6.1f} {t['overall_rating']:>6.1f} {t['fg3m']:>4} {t['fg3a']:>4} {t['fg3_pct']:>6.1f}% {t['fg3a_per_game']:>6.1f}")

    # Calculate correlation
    if len(analysis_data) >= 10:
        composites = [t['composite'] for t in analysis_data]
        pcts = [t['fg3_pct'] for t in analysis_data]

        mean_comp = statistics.mean(composites)
        mean_pct = statistics.mean(pcts)

        numerator = sum((c - mean_comp) * (p - mean_pct) for c, p in zip(composites, pcts))
        denom_comp = sum((c - mean_comp)**2 for c in composites)
        denom_pct = sum((p - mean_pct)**2 for p in pcts)

        if denom_comp > 0 and denom_pct > 0:
            correlation = numerator / (denom_comp * denom_pct)**0.5

            print("\n" + "="*80)
            print("CORRELATION ANALYSIS")
            print("="*80)
            print(f"Pearson Correlation Coefficient: {correlation:.3f}")
            print(f"Sample Size: {len(analysis_data)} teams")

            if correlation > 0.7:
                assessment = "STRONG positive correlation ✓"
            elif correlation > 0.5:
                assessment = "MODERATE positive correlation ✓"
            elif correlation > 0.3:
                assessment = "WEAK positive correlation ⚠️"
            else:
                assessment = "VERY WEAK or NO correlation ❌"

            print(f"Assessment: {assessment}")

            # Check if composite progression leads to % progression
            print("\n" + "="*80)
            print("BUCKET PROGRESSION CHECK")
            print("="*80)
            print("Does 3PT% increase as composite increases?")
            print("-"*80)

            for i, bucket in enumerate(bucket_results):
                arrow = ""
                if i > 0:
                    pct_change = bucket['avg_pct'] - bucket_results[i-1]['avg_pct']
                    arrow = f"  ({pct_change:+.1f}%)" if pct_change != 0 else "  (no change)"

                print(f"{bucket['label']:<25} {bucket['avg_pct']:>6.1f}%{arrow}")

            # Check for issues
            print("\n" + "="*80)
            print("POTENTIAL ISSUES")
            print("="*80)

            issues_found = False

            # Check if elite shooters are underperforming
            elite_teams = [t for t in analysis_data if t['composite'] >= 75]
            if elite_teams:
                elite_avg = sum(t['fg3_pct'] for t in elite_teams) / len(elite_teams)
                if elite_avg < 40:
                    print(f"⚠️ Elite composite teams (75+) shooting {elite_avg:.1f}% (expected 40-45%)")
                    issues_found = True

            # Check if poor shooters are overperforming
            poor_teams = [t for t in analysis_data if t['composite'] < 60]
            if poor_teams:
                poor_avg = sum(t['fg3_pct'] for t in poor_teams) / len(poor_teams)
                if poor_avg > 32:
                    print(f"⚠️ Poor composite teams (<60) shooting {poor_avg:.1f}% (expected 28-32%)")
                    issues_found = True

            # Check if correlation is too weak
            if correlation < 0.5:
                print(f"⚠️ Correlation ({correlation:.3f}) is weaker than expected (target: 0.6+)")
                issues_found = True

            # Check league average
            league_avg_pct = statistics.mean(pcts)
            if not (35 <= league_avg_pct <= 37):
                print(f"⚠️ League average 3PT% ({league_avg_pct:.1f}%) outside NBA range (35-37%)")
                issues_found = True

            if not issues_found:
                print("✓ No significant issues detected")

    # Save report
    output_path = Path('output/TEAM_3PT_CORRELATION.txt')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("TEAM 3PT COMPOSITE vs ACTUAL SHOOTING %\n")
        f.write("="*80 + "\n\n")

        for t in sorted(analysis_data, key=lambda x: x['composite'], reverse=True):
            f.write(f"{t['team']:<20} Comp: {t['composite']:>5.1f}  3PT: {t['fg3m']:>3}/{t['fg3a']:<4} ({t['fg3_pct']:>5.1f}%)  Games: {t['games']}\n")

    print(f"\nDetailed report saved to: {output_path}")


if __name__ == '__main__':
    main()
