"""
Analyze correlation between 3PT shooting composite and actual 3PT% achieved.
"""
import json
from pathlib import Path
from typing import List, Dict, Any


def calculate_3pt_composite(player: Dict[str, Any]) -> float:
    """
    Calculate 3PT shooting composite using the same weights as the simulator.

    From basketball_sim.md Section 14.2:
    - Form Technique: 25%
    - Throw Accuracy: 20%
    - Finesse: 15%
    - Hand-Eye Coordination: 12%
    - Balance: 10%
    - Composure: 8%
    - Consistency: 6%
    - Agility: 4%
    """
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


def load_team_players(teams_dir: str) -> List[Dict[str, Any]]:
    """Load all players from all teams."""
    all_players = []

    for team_file in Path(teams_dir).glob('team_*.json'):
        team = json.loads(team_file.read_text())
        for player in team['roster']:
            player_with_team = player.copy()
            player_with_team['team'] = team['name']
            all_players.append(player_with_team)

    return all_players


def analyze_validation_games(validation_dir: str) -> Dict[str, Dict]:
    """
    Extract player 3PT stats from validation games.
    Returns: {player_name: {'3pm': X, '3pa': Y, '3p_pct': Z}}
    """
    player_stats = {}

    games_dir = Path(validation_dir) / 'games'
    if not games_dir.exists():
        print(f"Games directory not found: {games_dir}")
        return player_stats

    for game_file in sorted(games_dir.glob('game_*.json')):
        game = json.loads(game_file.read_text())

        # Skip if no player stats
        if 'player_stats' not in game:
            continue

        # Process both home and away player stats
        for team_side in ['home', 'away']:
            team_stats = game['player_stats'].get(team_side, {})

            for player_name, stats in team_stats.items():
                if player_name not in player_stats:
                    player_stats[player_name] = {'fg3m': 0, 'fg3a': 0}

                player_stats[player_name]['fg3m'] += stats.get('fg3m', 0)
                player_stats[player_name]['fg3a'] += stats.get('fg3a', 0)

    # Calculate percentages
    for player_name, stats in player_stats.items():
        if stats['fg3a'] > 0:
            stats['fg3_pct'] = (stats['fg3m'] / stats['fg3a']) * 100
        else:
            stats['fg3_pct'] = 0.0

    return player_stats


def main():
    print("="*80)
    print("3PT COMPOSITE CORRELATION ANALYSIS")
    print("="*80)

    # Load all players
    print("\nLoading players from teams directory...")
    players = load_team_players('teams')
    print(f"Loaded {len(players)} players from {len(players)//10} teams")

    # Calculate composites
    print("\nCalculating 3PT composites...")
    player_composites = {}
    for player in players:
        name = player['name']
        composite = calculate_3pt_composite(player)
        player_composites[name] = {
            'composite': composite,
            'team': player['team'],
            'position': player.get('position', 'Unknown')
        }

    # Load validation game stats
    validation_dir = 'validation/foul_fix_test'
    print(f"\nAnalyzing validation games from {validation_dir}...")
    player_game_stats = analyze_validation_games(validation_dir)

    if not player_game_stats:
        print("WARNING: No player stats found in validation games!")
        print("Trying alternate validation directory...")
        validation_dir = 'validation/turnover_fix_final'
        player_game_stats = analyze_validation_games(validation_dir)

    print(f"Found stats for {len(player_game_stats)} players")

    # Merge composite + game stats
    print("\nMerging composite scores with game performance...")
    analysis_data = []

    for player_name, composite_data in player_composites.items():
        if player_name in player_game_stats:
            game_stats = player_game_stats[player_name]

            # Only include players with meaningful attempts (10+ 3PA)
            if game_stats['fg3a'] >= 10:
                analysis_data.append({
                    'name': player_name,
                    'composite': composite_data['composite'],
                    'position': composite_data['position'],
                    'fg3m': game_stats['fg3m'],
                    'fg3a': game_stats['fg3a'],
                    'fg3_pct': game_stats['fg3_pct']
                })

    print(f"Found {len(analysis_data)} players with 10+ 3PT attempts")

    # Sort by composite
    analysis_data.sort(key=lambda x: x['composite'])

    # Create buckets
    print("\n" + "="*80)
    print("3PT SHOOTING BY COMPOSITE RANGE")
    print("="*80)

    buckets = [
        (0, 50, "Very Poor (0-50)"),
        (50, 60, "Poor (50-60)"),
        (60, 70, "Below Average (60-70)"),
        (70, 80, "Average (70-80)"),
        (80, 90, "Good (80-90)"),
        (90, 100, "Elite (90-100)")
    ]

    for min_comp, max_comp, label in buckets:
        bucket_players = [p for p in analysis_data if min_comp <= p['composite'] < max_comp]

        if not bucket_players:
            continue

        total_3pm = sum(p['fg3m'] for p in bucket_players)
        total_3pa = sum(p['fg3a'] for p in bucket_players)
        avg_pct = (total_3pm / total_3pa * 100) if total_3pa > 0 else 0
        avg_composite = sum(p['composite'] for p in bucket_players) / len(bucket_players)

        print(f"\n{label}")
        print(f"  Players: {len(bucket_players)}")
        print(f"  Avg Composite: {avg_composite:.1f}")
        print(f"  Combined 3PT: {total_3pm}/{total_3pa} ({avg_pct:.1f}%)")
        print(f"  Expected NBA Range:")
        if max_comp <= 60:
            print(f"    28-32% (poor shooters)")
        elif max_comp <= 70:
            print(f"    31-35% (below avg)")
        elif max_comp <= 80:
            print(f"    34-38% (average)")
        elif max_comp <= 90:
            print(f"    37-41% (good)")
        else:
            print(f"    40-45% (elite)")

    # Show top and bottom performers
    print("\n" + "="*80)
    print("TOP 10 SHOOTERS (by composite)")
    print("="*80)
    print(f"{'Player':<25} {'Pos':<5} {'Comp':>6} {'3PM':>4} {'3PA':>4} {'3P%':>6}")
    print("-"*80)

    top_10 = sorted(analysis_data, key=lambda x: x['composite'], reverse=True)[:10]
    for p in top_10:
        print(f"{p['name']:<25} {p['position']:<5} {p['composite']:>6.1f} {p['fg3m']:>4} {p['fg3a']:>4} {p['fg3_pct']:>6.1f}%")

    print("\n" + "="*80)
    print("BOTTOM 10 SHOOTERS (by composite)")
    print("="*80)
    print(f"{'Player':<25} {'Pos':<5} {'Comp':>6} {'3PM':>4} {'3PA':>4} {'3P%':>6}")
    print("-"*80)

    bottom_10 = sorted(analysis_data, key=lambda x: x['composite'])[:10]
    for p in bottom_10:
        print(f"{p['name']:<25} {p['position']:<5} {p['composite']:>6.1f} {p['fg3m']:>4} {p['fg3a']:>4} {p['fg3_pct']:>6.1f}%")

    # Calculate correlation coefficient
    if len(analysis_data) >= 10:
        import statistics
        composites = [p['composite'] for p in analysis_data]
        pcts = [p['fg3_pct'] for p in analysis_data]

        # Pearson correlation
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
            print(f"Sample Size: {len(analysis_data)} players")

            if correlation > 0.7:
                print("Assessment: STRONG positive correlation ✓")
            elif correlation > 0.5:
                print("Assessment: MODERATE positive correlation ✓")
            elif correlation > 0.3:
                print("Assessment: WEAK positive correlation ⚠️")
            else:
                print("Assessment: VERY WEAK or NO correlation ❌")

    # Save detailed report
    output_path = Path('output/3PT_CORRELATION_ANALYSIS.txt')
    with open(output_path, 'w') as f:
        f.write("3PT COMPOSITE vs ACTUAL SHOOTING % ANALYSIS\n")
        f.write("="*80 + "\n\n")
        f.write(f"Total players analyzed: {len(analysis_data)}\n")
        f.write(f"Validation directory: {validation_dir}\n\n")

        for p in sorted(analysis_data, key=lambda x: x['composite'], reverse=True):
            f.write(f"{p['name']:<25} Comp: {p['composite']:>5.1f}  3PT: {p['fg3m']:>3}/{p['fg3a']:<3} ({p['fg3_pct']:>5.1f}%)\n")

    print(f"\nDetailed report saved to: {output_path}")


if __name__ == '__main__':
    main()
