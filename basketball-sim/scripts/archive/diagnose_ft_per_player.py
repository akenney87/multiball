"""
M4.5 PHASE 4 CONTINUATION: Per-Player FT Analysis

Investigate why FT% is 48-52% when formula expects 75% for composite 67.2.

This script analyzes a saved game to see:
1. Which players are taking FTs
2. Their FT composites
3. Whether big men (low FT composite) are shooting disproportionately
"""
import json
import sys

# FT composite weights (from basketball_sim.md)
FT_WEIGHTS = {
    'form_technique': 0.25,
    'throw_accuracy': 0.20,
    'finesse': 0.15,
    'hand_eye_coordination': 0.12,
    'balance': 0.10,
    'composure': 0.08,
    'consistency': 0.06,
    'agility': 0.04,
}

def calculate_ft_composite(player):
    """Calculate FT composite for a player."""
    total = 0.0
    for attr, weight in FT_WEIGHTS.items():
        total += player.get(attr, 50) * weight
    return total

def analyze_game(game_path):
    """Analyze FT attempts in a single game."""
    with open(game_path, 'r') as f:
        game = json.load(f)

    print('='*70)
    print(f'ANALYZING GAME: {game["home_team"]} vs {game["away_team"]}')
    print('='*70)
    print()

    # Load rosters
    home_roster = game['home_roster']
    away_roster = game['away_roster']

    # Calculate FT composites for all players
    home_composites = {}
    away_composites = {}

    for player in home_roster:
        home_composites[player['name']] = calculate_ft_composite(player)

    for player in away_roster:
        away_composites[player['name']] = calculate_ft_composite(player)

    # Track FT attempts per player
    home_ft_stats = {}  # player_name -> {'attempts': int, 'made': int, 'composite': float}
    away_ft_stats = {}

    # Parse possession results from all quarters
    total_home_fta = 0
    total_home_ftm = 0
    total_away_fta = 0
    total_away_ftm = 0

    for quarter_num in [1, 2, 3, 4]:
        quarter_key = f'quarter_{quarter_num}_results'
        if quarter_key not in game:
            continue

        quarter_data = game[quarter_key]
        possession_results = quarter_data.get('possession_results', [])

        for poss in possession_results:
            # Check if this possession had free throws
            foul_event = poss.get('foul_event')
            if not foul_event:
                continue

            fta = foul_event.get('free_throws_awarded', 0)
            if fta == 0:
                continue

            # Get shooter and offensive team
            ft_shooter = poss.get('shooter') or poss.get('ball_handler')
            offensive_team = poss.get('offensive_team', 'home')

            if not ft_shooter:
                continue

            # Get FTM from debug info
            ftm = poss.get('debug', {}).get('free_throws_made', 0)

            # Attribute to correct team
            if offensive_team == 'home':
                total_home_fta += fta
                total_home_ftm += ftm

                if ft_shooter not in home_ft_stats:
                    home_ft_stats[ft_shooter] = {
                        'attempts': 0,
                        'made': 0,
                        'composite': home_composites.get(ft_shooter, 50.0),
                        'position': next((p['position'] for p in home_roster if p['name'] == ft_shooter), '?')
                    }
                home_ft_stats[ft_shooter]['attempts'] += fta
                home_ft_stats[ft_shooter]['made'] += ftm
            else:
                total_away_fta += fta
                total_away_ftm += ftm

                if ft_shooter not in away_ft_stats:
                    away_ft_stats[ft_shooter] = {
                        'attempts': 0,
                        'made': 0,
                        'composite': away_composites.get(ft_shooter, 50.0),
                        'position': next((p['position'] for p in away_roster if p['name'] == ft_shooter), '?')
                    }
                away_ft_stats[ft_shooter]['attempts'] += fta
                away_ft_stats[ft_shooter]['made'] += ftm

    # Print results
    print(f'HOME TEAM: {game["home_team"]}')
    print(f'Total FTA: {total_home_fta}, FTM: {total_home_ftm}, FT%: {100*total_home_ftm/total_home_fta if total_home_fta > 0 else 0:.1f}%')
    print()
    print('Per-Player Breakdown:')
    print(f'{"Player":<20} {"Pos":<5} {"FTA":<5} {"FTM":<5} {"FT%":<7} {"Composite":<10}')
    print('-'*70)

    for player_name in sorted(home_ft_stats.keys(), key=lambda p: home_ft_stats[p]['attempts'], reverse=True):
        stats = home_ft_stats[player_name]
        ft_pct = 100 * stats['made'] / stats['attempts'] if stats['attempts'] > 0 else 0
        print(f'{player_name:<20} {stats["position"]:<5} {stats["attempts"]:<5} {stats["made"]:<5} {ft_pct:<7.1f} {stats["composite"]:<10.1f}')

    # Calculate weighted average composite
    if total_home_fta > 0:
        weighted_comp = sum(
            home_ft_stats[p]['composite'] * home_ft_stats[p]['attempts']
            for p in home_ft_stats
        ) / total_home_fta
        print()
        print(f'Weighted Average FT Composite: {weighted_comp:.1f}')
        print(f'Team Average FT Composite: {sum(home_composites.values())/len(home_composites):.1f}')

    print()
    print('='*70)
    print(f'AWAY TEAM: {game["away_team"]}')
    print(f'Total FTA: {total_away_fta}, FTM: {total_away_ftm}, FT%: {100*total_away_ftm/total_away_fta if total_away_fta > 0 else 0:.1f}%')
    print()
    print('Per-Player Breakdown:')
    print(f'{"Player":<20} {"Pos":<5} {"FTA":<5} {"FTM":<5} {"FT%":<7} {"Composite":<10}')
    print('-'*70)

    for player_name in sorted(away_ft_stats.keys(), key=lambda p: away_ft_stats[p]['attempts'], reverse=True):
        stats = away_ft_stats[player_name]
        ft_pct = 100 * stats['made'] / stats['attempts'] if stats['attempts'] > 0 else 0
        print(f'{player_name:<20} {stats["position"]:<5} {stats["attempts"]:<5} {stats["made"]:<5} {ft_pct:<7.1f} {stats["composite"]:<10.1f}')

    # Calculate weighted average composite
    if total_away_fta > 0:
        weighted_comp = sum(
            away_ft_stats[p]['composite'] * away_ft_stats[p]['attempts']
            for p in away_ft_stats
        ) / total_away_fta
        print()
        print(f'Weighted Average FT Composite: {weighted_comp:.1f}')
        print(f'Team Average FT Composite: {sum(away_composites.values())/len(away_composites):.1f}')

    print()
    print('='*70)
    print('GAME TOTALS')
    print('='*70)
    total_fta = total_home_fta + total_away_fta
    total_ftm = total_home_ftm + total_away_ftm
    print(f'Total FTA: {total_fta}')
    print(f'Total FTM: {total_ftm}')
    print(f'Overall FT%: {100*total_ftm/total_fta if total_fta > 0 else 0:.1f}%')
    print()

    # Calculate overall weighted composite
    all_ft_stats = {**home_ft_stats, **away_ft_stats}
    if total_fta > 0:
        overall_weighted_comp = sum(
            all_ft_stats[p]['composite'] * all_ft_stats[p]['attempts']
            for p in all_ft_stats
        ) / total_fta

        all_composites = {**home_composites, **away_composites}
        overall_team_avg = sum(all_composites.values()) / len(all_composites)

        print(f'Weighted Average FT Composite (by attempts): {overall_weighted_comp:.1f}')
        print(f'Overall Team Average FT Composite: {overall_team_avg:.1f}')
        print(f'Difference: {overall_weighted_comp - overall_team_avg:.1f}')
        print()

        # Expected FT% for weighted composite
        import math
        def sigmoid(x):
            return 1.0 / (1.0 + math.exp(-x))

        base_rate = 0.40
        k = 0.02
        composite_diff = overall_weighted_comp - 50.0
        sigmoid_output = sigmoid(k * composite_diff)
        expected_ft_pct = base_rate + (1.0 - base_rate) * sigmoid_output

        print(f'Expected FT% for weighted composite {overall_weighted_comp:.1f}: {expected_ft_pct*100:.1f}%')
        print(f'Actual FT%: {100*total_ftm/total_fta:.1f}%')
        print(f'Gap: {expected_ft_pct*100 - 100*total_ftm/total_fta:.1f} percentage points')

if __name__ == '__main__':
    if len(sys.argv) > 1:
        game_path = sys.argv[1]
    else:
        # Use most recent validation game
        game_path = 'output/substitution_final_test/games/game_001.json'

    analyze_game(game_path)
