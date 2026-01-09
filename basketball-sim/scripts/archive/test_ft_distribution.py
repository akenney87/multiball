"""
M4.5 PHASE 4: Live FT Distribution Test

Run a single game and track which players take FTs and their composites.
"""
import random
import json
import math
from src.core.data_structures import TacticalSettings
from src.systems.game_simulation import GameSimulator

# FT composite weights
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

def sigmoid(x):
    return 1.0 / (1.0 + math.exp(-x))

def expected_ft_pct(composite):
    """Calculate expected FT% for given composite."""
    base_rate = 0.40
    k = 0.02
    composite_diff = composite - 50.0
    sigmoid_output = sigmoid(k * composite_diff)
    return base_rate + (1.0 - base_rate) * sigmoid_output

# Set seed for reproducibility
random.seed(99999)

# Load two high-rated teams (closer to NBA caliber)
# Team_042: 82.3 rating, Team_075: 81.5 rating
with open('teams/Team_042.json', 'r') as f:
    home_team_data = json.load(f)

with open('teams/Team_075.json', 'r') as f:
    away_team_data = json.load(f)

home_roster = home_team_data['roster']
away_roster = away_team_data['roster']

# Calculate FT composites
print('='*70)
print('HOME TEAM ROSTER')
print('='*70)
print(f'{"Player":<20} {"Pos":<5} {"FT Composite":<15}')
print('-'*70)

home_composites = {}
for player in home_roster:
    comp = calculate_ft_composite(player)
    home_composites[player['name']] = comp
    print(f'{player["name"]:<20} {player["position"]:<5} {comp:<15.1f}')

home_avg = sum(home_composites.values()) / len(home_composites)
print(f'\nTeam Average: {home_avg:.1f}')
print(f'Expected FT% for team avg: {expected_ft_pct(home_avg)*100:.1f}%')

print()
print('='*70)
print('AWAY TEAM ROSTER')
print('='*70)
print(f'{"Player":<20} {"Pos":<5} {"FT Composite":<15}')
print('-'*70)

away_composites = {}
for player in away_roster:
    comp = calculate_ft_composite(player)
    away_composites[player['name']] = comp
    print(f'{player["name"]:<20} {player["position"]:<5} {comp:<15.1f}')

away_avg = sum(away_composites.values()) / len(away_composites)
print(f'\nTeam Average: {away_avg:.1f}')
print(f'Expected FT% for team avg: {expected_ft_pct(away_avg)*100:.1f}%')

print()
print('='*70)
print('SIMULATING GAME...')
print('='*70)

# Define tactical settings (standard)
tactical = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    scoring_option_1=None,
    scoring_option_2=None,
    scoring_option_3=None,
    rebounding_strategy='standard'
)

# Run game
simulator = GameSimulator(
    home_roster=home_roster,
    away_roster=away_roster,
    tactical_home=tactical,
    tactical_away=tactical,
    home_team_name=home_team_data['name'],
    away_team_name=away_team_data['name']
)

result = simulator.simulate_game()

# Track FT attempts per player
home_ft_stats = {}
away_ft_stats = {}

# Parse all quarters
for quarter_result in result.quarter_results:
    for poss in quarter_result.possession_results:
        foul_event = poss.foul_event
        if not foul_event:
            continue

        fta = foul_event.free_throws_awarded
        if fta == 0:
            continue

        # For FT possessions, use the debug info to find shooter
        # or fallback to scoring_player if FTs were made
        ft_shooter = poss.debug.get('ft_shooter') if poss.debug else None
        if not ft_shooter and poss.scoring_player:
            ft_shooter = poss.scoring_player

        offensive_team = poss.offensive_team

        if not ft_shooter:
            # Skip if we can't determine who shot the FTs
            continue

        ftm = poss.debug.get('free_throws_made', 0) if poss.debug else 0

        if offensive_team == 'home':
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
print()
print('='*70)
print('FREE THROW ANALYSIS')
print('='*70)
print()

total_home_fta = sum(s['attempts'] for s in home_ft_stats.values())
total_home_ftm = sum(s['made'] for s in home_ft_stats.values())

print(f'HOME TEAM')
print(f'Total FTA: {total_home_fta}, FTM: {total_home_ftm}, FT%: {100*total_home_ftm/total_home_fta if total_home_fta > 0 else 0:.1f}%')
print()
print(f'{"Player":<20} {"Pos":<5} {"FTA":<5} {"FTM":<5} {"FT%":<7} {"Composite":<10} {"Expected%":<10}')
print('-'*70)

for player_name in sorted(home_ft_stats.keys(), key=lambda p: home_ft_stats[p]['attempts'], reverse=True):
    stats = home_ft_stats[player_name]
    ft_pct = 100 * stats['made'] / stats['attempts'] if stats['attempts'] > 0 else 0
    expected = expected_ft_pct(stats['composite']) * 100
    print(f'{player_name:<20} {stats["position"]:<5} {stats["attempts"]:<5} {stats["made"]:<5} {ft_pct:<7.1f} {stats["composite"]:<10.1f} {expected:<10.1f}')

if total_home_fta > 0:
    weighted_comp = sum(s['composite'] * s['attempts'] for s in home_ft_stats.values()) / total_home_fta
    print()
    print(f'Weighted Avg Composite (by FTA): {weighted_comp:.1f}')
    print(f'Team Roster Average: {home_avg:.1f}')
    print(f'Difference: {weighted_comp - home_avg:+.1f}')
    print(f'Expected FT% for weighted comp: {expected_ft_pct(weighted_comp)*100:.1f}%')

print()
total_away_fta = sum(s['attempts'] for s in away_ft_stats.values())
total_away_ftm = sum(s['made'] for s in away_ft_stats.values())

print(f'AWAY TEAM')
print(f'Total FTA: {total_away_fta}, FTM: {total_away_ftm}, FT%: {100*total_away_ftm/total_away_fta if total_away_fta > 0 else 0:.1f}%')
print()
print(f'{"Player":<20} {"Pos":<5} {"FTA":<5} {"FTM":<5} {"FT%":<7} {"Composite":<10} {"Expected%":<10}')
print('-'*70)

for player_name in sorted(away_ft_stats.keys(), key=lambda p: away_ft_stats[p]['attempts'], reverse=True):
    stats = away_ft_stats[player_name]
    ft_pct = 100 * stats['made'] / stats['attempts'] if stats['attempts'] > 0 else 0
    expected = expected_ft_pct(stats['composite']) * 100
    print(f'{player_name:<20} {stats["position"]:<5} {stats["attempts"]:<5} {stats["made"]:<5} {ft_pct:<7.1f} {stats["composite"]:<10.1f} {expected:<10.1f}')

if total_away_fta > 0:
    weighted_comp = sum(s['composite'] * s['attempts'] for s in away_ft_stats.values()) / total_away_fta
    print()
    print(f'Weighted Avg Composite (by FTA): {weighted_comp:.1f}')
    print(f'Team Roster Average: {away_avg:.1f}')
    print(f'Difference: {weighted_comp - away_avg:+.1f}')
    print(f'Expected FT% for weighted comp: {expected_ft_pct(weighted_comp)*100:.1f}%')

print()
print('='*70)
print('OVERALL ANALYSIS')
print('='*70)

total_fta = total_home_fta + total_away_fta
total_ftm = total_home_ftm + total_away_ftm

if total_fta > 0:
    all_ft_stats = {**home_ft_stats, **away_ft_stats}
    overall_weighted = sum(s['composite'] * s['attempts'] for s in all_ft_stats.values()) / total_fta
    overall_roster_avg = (home_avg + away_avg) / 2

    actual_pct = 100 * total_ftm / total_fta
    expected_pct = expected_ft_pct(overall_weighted) * 100

    print(f'Total FTA: {total_fta}')
    print(f'Total FTM: {total_ftm}')
    print(f'Actual FT%: {actual_pct:.1f}%')
    print()
    print(f'Overall Roster Average Composite: {overall_roster_avg:.1f}')
    print(f'Weighted Average (by FTA): {overall_weighted:.1f}')
    print(f'Selection Bias: {overall_weighted - overall_roster_avg:+.1f} points')
    print()
    print(f'Expected FT% for weighted composite: {expected_pct:.1f}%')
    print(f'Gap (Expected - Actual): {expected_pct - actual_pct:+.1f} percentage points')
    print()

    if abs(overall_weighted - overall_roster_avg) > 5:
        print('FINDING: Significant shooter selection bias detected!')
        print('Players taking FTs have different composite than roster average.')
    else:
        print('FINDING: No significant shooter selection bias.')
        print('Players taking FTs represent roster average.')

    print()
    if abs(expected_pct - actual_pct) > 10:
        print('FINDING: Large gap between expected and actual FT%.')
        print('This suggests a bug in FT execution or formula implementation.')
    elif abs(expected_pct - actual_pct) > 5:
        print('FINDING: Moderate gap between expected and actual FT%.')
        print('May be variance or minor implementation issue.')
    else:
        print('FINDING: Expected and actual FT% match closely.')
        print('Formula is working correctly.')
