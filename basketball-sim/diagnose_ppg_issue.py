"""
PPG Diagnostic Analysis

Investigates root cause of low PPG by analyzing:
1. Shooting foul frequency (FTA per game)
2. 3PT shooting efficiency
3. Possession outcome distribution
4. Points per possession breakdown
"""

import json
import sys
import os
import random
from collections import Counter
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))

from src.systems.game_simulation import GameSimulator
from src.systems.possession import calculate_shot_creation_ability
from src.core.data_structures import TacticalSettings

# Load teams for testing
teams_dir = Path('teams')
team_files = list(teams_dir.glob('Team_*.json'))

print("="*80)
print("PPG DIAGNOSTIC ANALYSIS")
print("="*80)
print()
print("Running 20 games to diagnose low PPG issue...")
print("Current: 91.9 PPG (Target: 108-114)")
print("Gap: 16.1 points below minimum")
print()
print("Investigating:")
print("  1. Shooting foul frequency (FTA per game)")
print("  2. Free throw efficiency")
print("  3. 3PT shooting efficiency")
print("  4. Possession outcome distribution")
print("  5. Points per possession")
print()
print("="*80)
print()

# Track comprehensive statistics
possession_outcomes = Counter()
shot_types = Counter()
points_by_source = {
    'made_2pt': 0,
    'made_3pt': 0,
    'made_ft': 0
}

shooting_fouls = 0
total_fta = 0
total_ftm = 0

total_points = 0
total_possessions = 0
total_fga = 0

# Track 3PT efficiency
threes_made = 0
threes_attempted = 0

# Track shooting efficiency by type
shot_efficiency = {
    '3pt': {'made': 0, 'attempted': 0},
    'midrange': {'made': 0, 'attempted': 0},
    'rim': {'made': 0, 'attempted': 0}
}

num_games = 20

for game_num in range(1, num_games + 1):
    if game_num % 5 == 0:
        print(f"Completed {game_num}/{num_games} games...")

    # Randomly select two different teams
    team_a_file, team_b_file = random.sample(team_files, 2)

    with open(team_a_file, 'r') as f:
        team_a = json.load(f)

    with open(team_b_file, 'r') as f:
        team_b = json.load(f)

    team_a_players = team_a['roster']
    team_b_players = team_b['roster']

    # Calculate shot creation for scoring options
    team_a_creation = [(p['name'], calculate_shot_creation_ability(p)) for p in team_a_players]
    team_b_creation = [(p['name'], calculate_shot_creation_ability(p)) for p in team_b_players]

    team_a_creation.sort(key=lambda x: x[1], reverse=True)
    team_b_creation.sort(key=lambda x: x[1], reverse=True)

    tactics_home = TacticalSettings(
        pace='standard',
        man_defense_pct=50,
        scoring_option_1=team_a_creation[0][0] if len(team_a_creation) > 0 else None,
        scoring_option_2=team_a_creation[1][0] if len(team_a_creation) > 1 else None,
        scoring_option_3=team_a_creation[2][0] if len(team_a_creation) > 2 else None,
        minutes_allotment={},
        rebounding_strategy='standard'
    )

    tactics_away = TacticalSettings(
        pace='standard',
        man_defense_pct=50,
        scoring_option_1=team_b_creation[0][0] if len(team_b_creation) > 0 else None,
        scoring_option_2=team_b_creation[1][0] if len(team_b_creation) > 1 else None,
        scoring_option_3=team_b_creation[2][0] if len(team_b_creation) > 2 else None,
        minutes_allotment={},
        rebounding_strategy='standard'
    )

    # Run simulation
    game_sim = GameSimulator(
        home_roster=team_a_players,
        away_roster=team_b_players,
        tactical_home=tactics_home,
        tactical_away=tactics_away,
        home_team_name=team_a['name'],
        away_team_name=team_b['name']
    )

    result = game_sim.simulate_game(seed=None)

    total_points += result.home_score + result.away_score

    # Analyze each possession
    for quarter in result.quarter_results:
        for poss in quarter.possession_results:
            total_possessions += 1
            outcome = poss.possession_outcome
            possession_outcomes[outcome] += 1

            # Track shot types
            shot_type = poss.debug.get('shot_type')
            if shot_type:
                shot_types[shot_type] += 1

            # Track fouls and free throws
            if outcome == 'foul':
                # Get FT info from free_throw_result (NOT from debug!)
                if poss.free_throw_result:
                    fta = poss.free_throw_result.attempts
                    ftm = poss.free_throw_result.made

                    if fta > 0:
                        shooting_fouls += 1
                        total_fta += fta
                        total_ftm += ftm
                        points_by_source['made_ft'] += ftm

            # Track made shots
            if outcome == 'made_shot':
                total_fga += 1
                if shot_type == '3pt':
                    threes_made += 1
                    threes_attempted += 1
                    shot_efficiency['3pt']['made'] += 1
                    shot_efficiency['3pt']['attempted'] += 1
                    points_by_source['made_3pt'] += 3
                elif shot_type in ['midrange', 'rim']:
                    shot_efficiency[shot_type]['made'] += 1
                    shot_efficiency[shot_type]['attempted'] += 1
                    points_by_source['made_2pt'] += 2
                    if shot_type == '3pt':
                        threes_made += 1
                        threes_attempted += 1

            # Track missed shots
            if outcome == 'missed_shot':
                total_fga += 1
                if shot_type == '3pt':
                    threes_attempted += 1
                    shot_efficiency['3pt']['attempted'] += 1
                elif shot_type in ['midrange', 'rim']:
                    shot_efficiency[shot_type]['attempted'] += 1

print()
print("="*80)
print("DIAGNOSTIC RESULTS")
print("="*80)
print()

# Calculate per-game averages (multiply by 2 since we track per team)
games_played = num_games * 2
avg_ppg = total_points / games_played
avg_possessions = total_possessions / games_played
avg_fga = total_fga / games_played
avg_shooting_fouls = shooting_fouls / games_played
avg_fta = total_fta / games_played
avg_ftm = total_ftm / games_played

print(f"Games Analyzed: {num_games} ({games_played} team performances)")
print()

# NBA Targets for comparison
print("="*80)
print("KEY METRICS vs NBA TARGETS")
print("="*80)
print()

print(f"{'Metric':<25} {'Current':>12} {'NBA Target':>12} {'Gap':>12}")
print("-"*80)
print(f"{'Points Per Game':<25} {avg_ppg:>11.1f} {' 108-114':>12} {avg_ppg - 108:>+11.1f}")
print(f"{'Possessions Per Game':<25} {avg_possessions:>11.1f} {'  ~100':>12} {avg_possessions - 100:>+11.1f}")
print(f"{'FGA Per Game':<25} {avg_fga:>11.1f} {'   ~88':>12} {avg_fga - 88:>+11.1f}")
print(f"{'FTA Per Game':<25} {avg_fta:>11.1f} {'   ~24':>12} {avg_fta - 24:>+11.1f}")
print(f"{'Shooting Fouls/Game':<25} {avg_shooting_fouls:>11.1f} {'   ~20':>12} {avg_shooting_fouls - 20:>+11.1f}")
print()

# Free throw efficiency
ft_pct = (total_ftm / total_fta * 100) if total_fta > 0 else 0
print(f"Free Throw %: {ft_pct:.1f}% (NBA average: ~77%)")
print()

# 3PT efficiency
three_pt_pct = (threes_made / threes_attempted * 100) if threes_attempted > 0 else 0
print(f"3PT FG%: {three_pt_pct:.1f}% (NBA average: ~36-37%)")
print()

# Shot efficiency breakdown
print("="*80)
print("SHOOTING EFFICIENCY BY TYPE")
print("="*80)
print()
print(f"{'Shot Type':<15} {'FGM':>8} {'FGA':>8} {'FG%':>8} {'NBA Avg':>10}")
print("-"*80)

for shot_type in ['3pt', 'midrange', 'rim']:
    made = shot_efficiency[shot_type]['made']
    attempted = shot_efficiency[shot_type]['attempted']
    fg_pct = (made / attempted * 100) if attempted > 0 else 0

    nba_avg = {
        '3pt': '36-37%',
        'midrange': '40-42%',
        'rim': '62-65%'
    }[shot_type]

    print(f"{shot_type:<15} {made:>8} {attempted:>8} {fg_pct:>7.1f}% {nba_avg:>10}")

print()

# Points breakdown
print("="*80)
print("POINTS BY SOURCE")
print("="*80)
print()

total_points_tracked = sum(points_by_source.values())
print(f"{'Source':<20} {'Points':>10} {'% of Total':>12} {'Per Game':>12}")
print("-"*80)
print(f"{'2PT Field Goals':<20} {points_by_source['made_2pt']:>10} {points_by_source['made_2pt']/total_points_tracked*100:>11.1f}% {points_by_source['made_2pt']/games_played:>11.1f}")
print(f"{'3PT Field Goals':<20} {points_by_source['made_3pt']:>10} {points_by_source['made_3pt']/total_points_tracked*100:>11.1f}% {points_by_source['made_3pt']/games_played:>11.1f}")
print(f"{'Free Throws':<20} {points_by_source['made_ft']:>10} {points_by_source['made_ft']/total_points_tracked*100:>11.1f}% {points_by_source['made_ft']/games_played:>11.1f}")
print("-"*80)
print(f"{'TOTAL':<20} {total_points_tracked:>10} {'100.0%':>12} {total_points_tracked/games_played:>11.1f}")
print()

# NBA comparison for points source
print("NBA Typical Breakdown:")
print("  2PT: ~50-55 points per game (45-50%)")
print("  3PT: ~35-40 points per game (30-35%)")
print("  FT:  ~18-22 points per game (15-20%)")
print()

# Possession outcomes
print("="*80)
print("POSSESSION OUTCOME DISTRIBUTION")
print("="*80)
print()
print(f"{'Outcome':<20} {'Count':>10} {'% of Total':>12} {'Per Game':>12}")
print("-"*80)

for outcome, count in possession_outcomes.most_common():
    pct = count / total_possessions * 100
    per_game = count / games_played
    print(f"{outcome:<20} {count:>10} {pct:>11.1f}% {per_game:>11.1f}")

print()

# Calculate expected points per possession
print("="*80)
print("ROOT CAUSE ANALYSIS")
print("="*80)
print()

# Expected PPG calculation
expected_2pt_ppg = points_by_source['made_2pt'] / games_played
expected_3pt_ppg = points_by_source['made_3pt'] / games_played
expected_ft_ppg = points_by_source['made_ft'] / games_played
expected_total = expected_2pt_ppg + expected_3pt_ppg + expected_ft_ppg

nba_2pt_ppg = 52.5  # NBA average
nba_3pt_ppg = 37.5  # NBA average
nba_ft_ppg = 20.0   # NBA average
nba_total = 110.0

print("Current vs NBA Target (per game):")
print(f"  2PT: {expected_2pt_ppg:.1f} vs {nba_2pt_ppg:.1f} (gap: {expected_2pt_ppg - nba_2pt_ppg:+.1f})")
print(f"  3PT: {expected_3pt_ppg:.1f} vs {nba_3pt_ppg:.1f} (gap: {expected_3pt_ppg - nba_3pt_ppg:+.1f})")
print(f"  FT:  {expected_ft_ppg:.1f} vs {nba_ft_ppg:.1f} (gap: {expected_ft_ppg - nba_ft_ppg:+.1f})")
print(f"  TOTAL: {expected_total:.1f} vs {nba_total:.1f} (gap: {expected_total - nba_total:+.1f})")
print()

# Identify biggest gaps
gaps = {
    '2PT': abs(expected_2pt_ppg - nba_2pt_ppg),
    '3PT': abs(expected_3pt_ppg - nba_3pt_ppg),
    'FT': abs(expected_ft_ppg - nba_ft_ppg)
}

print("Biggest Contributors to PPG Gap (sorted by impact):")
for i, (source, gap) in enumerate(sorted(gaps.items(), key=lambda x: x[1], reverse=True), 1):
    print(f"  {i}. {source}: {gap:.1f} points below target")

print()

# Recommendations
print("="*80)
print("RECOMMENDATIONS")
print("="*80)
print()

if avg_fta < 20:
    print(f"[CRITICAL] Free throw rate is LOW: {avg_fta:.1f} FTA/game vs NBA ~24")
    print(f"  -> Current: {avg_shooting_fouls:.1f} shooting fouls per game")
    print(f"  -> Missing: ~{24 - avg_fta:.1f} FTA per game")
    print(f"  -> Lost points: ~{(24 - avg_fta) * 0.77:.1f} per game (at 77% FT%)")
    print()
    print("  SOLUTION: Increase shooting foul probability")
    print(f"    - Current shooting fouls: {shooting_fouls} in {num_games} games")
    if avg_shooting_fouls > 0:
        print(f"    - Need to increase by: ~{(20 - avg_shooting_fouls) / avg_shooting_fouls * 100:.0f}%")
    else:
        print(f"    - CRITICAL: Shooting fouls are NOT being called at all!")
        print(f"    - Need to implement/fix shooting foul system")
    print()

if three_pt_pct < 35:
    print(f"[ISSUE] 3PT efficiency is LOW: {three_pt_pct:.1f}% vs NBA ~36-37%")
    print(f"  -> Gap: {36.5 - three_pt_pct:.1f}%")
    print(f"  -> Lost makes: ~{(36.5 - three_pt_pct) / 100 * threes_attempted / games_played:.1f} per game")
    print(f"  -> Lost points: ~{(36.5 - three_pt_pct) / 100 * threes_attempted / games_played * 3:.1f} per game")
    print()
    print("  SOLUTION: Increase 3PT BaseRate")
    print()

if avg_fga < 85:
    print(f"[INFO] FGA slightly low: {avg_fga:.1f} vs NBA ~88")
    print(f"  -> This is acceptable given possession rate")
    print()

# Calculate total impact
ft_impact = (24 - avg_fta) * 0.77 if avg_fta < 24 else 0
three_impact = (36.5 - three_pt_pct) / 100 * threes_attempted / games_played * 3 if three_pt_pct < 35 else 0
total_impact = ft_impact + three_impact

print(f"Total Estimated Impact of Fixes:")
print(f"  Free throws: +{ft_impact:.1f} PPG")
print(f"  3PT efficiency: +{three_impact:.1f} PPG")
print(f"  Combined: +{total_impact:.1f} PPG")
print()
print(f"  Current: {avg_ppg:.1f} PPG")
print(f"  After fixes: ~{avg_ppg + total_impact:.1f} PPG")
print(f"  Target: 108-114 PPG")
print()

if avg_ppg + total_impact >= 108:
    print("[OK] These fixes should bring PPG into target range!")
else:
    remaining = 108 - (avg_ppg + total_impact)
    print(f"[INFO] Additional {remaining:.1f} PPG needed beyond these fixes")
    print("  -> May need to adjust overall FG% or pace")

print()
print("="*80)
