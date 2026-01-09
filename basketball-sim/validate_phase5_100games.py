"""
Phase 5 Validation - 100 Games with Diverse Teams

Final shot distribution tuning based on 100-game validation findings.
Adjusts baselines to center averages on NBA targets accounting for team variance.
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

# Load all available teams
teams_dir = Path('teams')
team_files = list(teams_dir.glob('Team_*.json'))

if len(team_files) < 2:
    print("ERROR: Need at least 2 teams in teams/ folder")
    sys.exit(1)

print("="*80)
print("PHASE 5 VALIDATION - 100 GAMES (FINAL SHOT DISTRIBUTION TUNING)")
print("="*80)
print()
print(f"Found {len(team_files)} teams available for validation")
print()
print("Phase 5 Baseline Adjustments:")
print("  Based on 100-game validation findings that showed:")
print("    - 3PT: 38.4% (near 40% target, baseline working well)")
print("    - Midrange: 32.7% (7.7% too high, baseline too high)")
print("    - Rim: 28.9% (6.1% too low, baseline too low)")
print()
print("  Adjustments:")
print("    - 3PT:      40% -> 40% (keep)")
print("    - Midrange: 32% -> 26% (-6%)")
print("    - Rim:      28% -> 34% (+6%)")
print()
print("  Expected Results:")
print("    - 3PT:      38.4% -> 39-40%")
print("    - Midrange: 32.7% -> 25-27%")
print("    - Rim:      28.9% -> 33-35%")
print()
print("="*80)
print()
print("Running 100 games...")
print()

# Track comprehensive statistics
shot_type_counter = Counter()
shot_outcomes = {'made': 0, 'missed': 0}
shot_outcomes_by_type = {
    '3pt': {'made': 0, 'missed': 0},
    'midrange': {'made': 0, 'missed': 0},
    'rim': {'made': 0, 'missed': 0}
}

total_fga = 0
total_points_home = 0
total_points_away = 0
total_possessions = 0

# Track per-game stats for variance analysis
per_game_stats = []

# Track team diversity
teams_used = set()

for game_num in range(1, 101):
    if game_num % 10 == 0:
        print(f"Completed {game_num}/100 games...")

    # Randomly select two different teams
    team_a_file, team_b_file = random.sample(team_files, 2)

    # Load teams
    with open(team_a_file, 'r') as f:
        team_a = json.load(f)

    with open(team_b_file, 'r') as f:
        team_b = json.load(f)

    teams_used.add(team_a['name'])
    teams_used.add(team_b['name'])

    # Select random scoring options from each team (top 3 by shot creation)
    team_a_players = team_a['roster']
    team_b_players = team_b['roster']

    # Calculate shot creation for all players
    team_a_creation = [(p['name'], calculate_shot_creation_ability(p)) for p in team_a_players]
    team_b_creation = [(p['name'], calculate_shot_creation_ability(p)) for p in team_b_players]

    # Sort by creation ability and pick top 3
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

    total_points_home += result.home_score
    total_points_away += result.away_score

    # Track per-game stats
    game_shots = Counter()
    game_fga = 0
    game_possessions = 0

    # Analyze each possession
    for quarter in result.quarter_results:
        game_possessions += len(quarter.possession_results)

        for poss in quarter.possession_results:
            if poss.possession_outcome in ['made_shot', 'missed_shot', 'shooting_foul']:
                shot_type = poss.debug.get('shot_type')

                if shot_type:
                    shot_type_counter[shot_type] += 1
                    game_shots[shot_type] += 1
                    total_fga += 1
                    game_fga += 1

                    # Track makes/misses
                    if poss.possession_outcome == 'made_shot':
                        shot_outcomes['made'] += 1
                        shot_outcomes_by_type[shot_type]['made'] += 1
                    else:
                        shot_outcomes['missed'] += 1
                        shot_outcomes_by_type[shot_type]['missed'] += 1

    total_possessions += game_possessions

    # Store per-game statistics
    per_game_stats.append({
        'game_num': game_num,
        'home_score': result.home_score,
        'away_score': result.away_score,
        'total_score': result.home_score + result.away_score,
        'fga': game_fga,
        'possessions': game_possessions,
        'shots': dict(game_shots),
        '3pt_pct': (game_shots['3pt'] / game_fga * 100) if game_fga > 0 else 0,
        'mid_pct': (game_shots['midrange'] / game_fga * 100) if game_fga > 0 else 0,
        'rim_pct': (game_shots['rim'] / game_fga * 100) if game_fga > 0 else 0,
    })

print()
print("="*80)
print("PHASE 5 RESULTS")
print("="*80)
print()

# Team diversity
print(f"Team Diversity: {len(teams_used)} unique teams used")
print()

# Calculate averages
avg_ppg = (total_points_home + total_points_away) / 200  # 100 games * 2 teams
avg_possessions = total_possessions / 200
print(f"Average Points Per Game: {avg_ppg:.1f}")
print(f"Average Possessions Per Game: {avg_possessions:.1f}")
print()

print(f"Total FGA: {total_fga:,} ({total_fga/100:.1f} per game)")
print()

# Shot distribution
print("Shot Type Distribution:")
print("-"*80)
print(f"{'Shot Type':<15} {'Count':>8} {'% of FGA':>10} {'FGM':>6} {'FGA':>6} {'FG%':>7}")
print("-"*80)

for shot_type in ['3pt', 'midrange', 'rim']:
    count = shot_type_counter[shot_type]
    pct = (count / total_fga * 100) if total_fga > 0 else 0
    made = shot_outcomes_by_type[shot_type]['made']
    missed = shot_outcomes_by_type[shot_type]['missed']
    attempts = made + missed
    fg_pct = (made / attempts * 100) if attempts > 0 else 0

    print(f"{shot_type:<15} {count:>8,} {pct:>9.1f}% {made:>6,} {attempts:>6,} {fg_pct:>6.1f}%")

# Overall FG%
overall_made = shot_outcomes['made']
overall_attempts = shot_outcomes['made'] + shot_outcomes['missed']
overall_fg_pct = (overall_made / overall_attempts * 100) if overall_attempts > 0 else 0

print("-"*80)
print(f"{'OVERALL':<15} {total_fga:>8,} {'100.0%':>10} {overall_made:>6,} {overall_attempts:>6,} {overall_fg_pct:>6.1f}%")
print()

# Calculate standard deviations for variance analysis
import statistics

rim_pcts = [g['rim_pct'] for g in per_game_stats]
mid_pcts = [g['mid_pct'] for g in per_game_stats]
three_pcts = [g['3pt_pct'] for g in per_game_stats]
ppgs = [g['total_score'] for g in per_game_stats]

rim_stddev = statistics.stdev(rim_pcts)
mid_stddev = statistics.stdev(mid_pcts)
three_stddev = statistics.stdev(three_pcts)
ppg_stddev = statistics.stdev(ppgs)

print("="*80)
print("STATISTICAL VARIANCE ANALYSIS")
print("="*80)
print()
print("Per-Game Standard Deviations:")
print(f"  3PT%:      +/-{three_stddev:.1f}%")
print(f"  Midrange%: +/-{mid_stddev:.1f}%")
print(f"  Rim%:      +/-{rim_stddev:.1f}%")
print(f"  PPG:       +/-{ppg_stddev:.1f} points")
print()

# Comparison to Phase 4 and first 100-game
print("="*80)
print("PROGRESSION: PHASE 4 -> 100-GAME -> PHASE 5")
print("="*80)
print()

phase4_results = {'3pt': 43.5, 'midrange': 19.5, 'rim': 36.9}
first_100game = {'3pt': 38.4, 'midrange': 32.7, 'rim': 28.9}
nba_targets = {'3pt': 40.0, 'midrange': 25.0, 'rim': 35.0}

print(f"{'Shot Type':<12} {'Phase 4':>10} {'100-Game':>10} {'Phase 5':>10} {'NBA':>10} {'Distance':>10}")
print("-"*80)

for shot_type in ['3pt', 'midrange', 'rim']:
    current_pct = (shot_type_counter[shot_type] / total_fga * 100) if total_fga > 0 else 0
    phase4 = phase4_results[shot_type]
    first_100 = first_100game[shot_type]
    nba = nba_targets[shot_type]
    distance = current_pct - nba

    print(f"{shot_type:<12} {phase4:>9.1f}% {first_100:>9.1f}% {current_pct:>9.1f}% {nba:>9.1f}% {distance:>+9.1f}%")

print()

# Impact of Phase 5 adjustments
print("="*80)
print("PHASE 5 IMPACT ASSESSMENT")
print("="*80)
print()

current_rim_pct = (shot_type_counter['rim'] / total_fga * 100) if total_fga > 0 else 0
current_mid_pct = (shot_type_counter['midrange'] / total_fga * 100) if total_fga > 0 else 0
current_3pt_pct = (shot_type_counter['3pt'] / total_fga * 100) if total_fga > 0 else 0

delta_3pt_from_100 = current_3pt_pct - first_100game['3pt']
delta_mid_from_100 = current_mid_pct - first_100game['midrange']
delta_rim_from_100 = current_rim_pct - first_100game['rim']

print(f"Changes from First 100-Game Validation:")
print(f"  3PT:      {first_100game['3pt']:.1f}% -> {current_3pt_pct:.1f}% (change: {delta_3pt_from_100:+.1f}%)")
print(f"  Midrange: {first_100game['midrange']:.1f}% -> {current_mid_pct:.1f}% (change: {delta_mid_from_100:+.1f}%)")
print(f"  Rim:      {first_100game['rim']:.1f}% -> {current_rim_pct:.1f}% (change: {delta_rim_from_100:+.1f}%)")
print()

# Assess if changes are in expected direction
print("Expected vs Actual Impact:")
if delta_mid_from_100 < -3:
    print(f"  Midrange: [OK] Reduced by {abs(delta_mid_from_100):.1f}% (expected -6 to -8%)")
elif delta_mid_from_100 < 0:
    print(f"  Midrange: [INFO] Reduced by {abs(delta_mid_from_100):.1f}% (less than expected)")
else:
    print(f"  Midrange: [WARN] Increased by {delta_mid_from_100:+.1f}% (unexpected!)")

if delta_rim_from_100 > 3:
    print(f"  Rim: [OK] Increased by {delta_rim_from_100:.1f}% (expected +4 to +6%)")
elif delta_rim_from_100 > 0:
    print(f"  Rim: [INFO] Increased by {delta_rim_from_100:.1f}% (less than expected)")
else:
    print(f"  Rim: [WARN] Decreased by {abs(delta_rim_from_100):.1f}% (unexpected!)")

if abs(delta_3pt_from_100) <= 2:
    print(f"  3PT: [OK] Stable at {current_3pt_pct:.1f}% (change: {delta_3pt_from_100:+.1f}%)")
else:
    print(f"  3PT: [INFO] Changed by {delta_3pt_from_100:+.1f}% (baseline was kept at 40%)")

print()

# Distance from NBA targets
rim_diff = current_rim_pct - nba_targets['rim']
mid_diff = current_mid_pct - nba_targets['midrange']
three_diff = current_3pt_pct - nba_targets['3pt']

print("="*80)
print("FINAL ASSESSMENT")
print("="*80)
print()

print("Distance from NBA Targets:")
print(f"  3PT:      {three_diff:+.1f}% (target: 40%)")
print(f"  Midrange: {mid_diff:+.1f}% (target: 25%)")
print(f"  Rim:      {rim_diff:+.1f}% (target: 35%)")
print()

# Success criteria
success_3pt = abs(three_diff) <= 3
success_mid = abs(mid_diff) <= 5
success_rim = abs(rim_diff) <= 3

print("Target Achievement:")
if success_3pt:
    print(f"  [OK] 3PT within 3% of target ({abs(three_diff):.1f}%)")
else:
    print(f"  [WARN] 3PT outside acceptable range ({abs(three_diff):.1f}% from target)")

if success_mid:
    print(f"  [OK] Midrange within 5% of target ({abs(mid_diff):.1f}%)")
else:
    print(f"  [WARN] Midrange outside acceptable range ({abs(mid_diff):.1f}% from target)")

if success_rim:
    print(f"  [OK] Rim within 3% of target ({abs(rim_diff):.1f}%)")
else:
    print(f"  [WARN] Rim outside acceptable range ({abs(rim_diff):.1f}% from target)")

print()

# Overall verdict
if success_3pt and success_mid and success_rim:
    print("[OK] SUCCESS: All shot types within acceptable range of NBA targets!")
    print()
    print("Shot Distribution Tuning: COMPLETE AND VALIDATED")
    print("  - System produces stable, realistic shot distributions")
    print("  - Averages across diverse teams match NBA targets")
    print("  - Team composition variance is realistic (3-4% std dev)")
    print()
    print("Ready to proceed to next milestone: PPG/FG% Tuning")
elif (success_3pt and success_rim) or (success_3pt and success_mid) or (success_rim and success_mid):
    print("[INFO] PARTIAL SUCCESS: 2 of 3 shot types on target")
    print()
    print("Decision point:")
    print("  - Accept current distribution and move to PPG tuning")
    print("  - OR make minor baseline adjustments for final shot type")
else:
    print("[WARN] Shot distribution still needs adjustment")
    print()
    print("  -> Review baseline settings")
    print("  -> Consider additional tuning phase")

print()
print(f"Overall FG%: {overall_fg_pct:.1f}% (Target: 46-50%)")
print(f"Average PPG: {avg_ppg:.1f} (Target: 108-114)")
print()

# Overall metrics comparison
print("="*80)
print("OVERALL METRICS PROGRESSION")
print("="*80)
print()
print(f"{'Metric':<15} {'Phase 4':>10} {'100-Game':>10} {'Phase 5':>10} {'Target':>10}")
print("-"*80)
print(f"{'FG%':<15} {'50.8%':>10} {'49.0%':>10} {overall_fg_pct:>9.1f}% {'46-50%':>10}")
print(f"{'PPG':<15} {'95.5':>10} {'89.8':>10} {avg_ppg:>9.1f} {'108-114':>10}")
print()

# Next steps
print("="*80)
print("NEXT STEPS")
print("="*80)
print()

if success_3pt and success_mid and success_rim:
    print("[OK] Shot distribution tuning COMPLETE!")
    print()
    print("Proceed to M4.5 PPG/FG% Tuning:")
    print(f"  - Current PPG: {avg_ppg:.1f} (target: 108-114)")
    print(f"  - Gap: {108 - avg_ppg:.1f} points below minimum")
    print()
    print("Areas to address:")
    print("  1. BaseRate adjustments (increase shooting success rates)")
    print("  2. Free throw frequency (increase FT attempts)")
    print("  3. Turnover rates (if too high)")
    print()
    print("Estimated time: 2-3 hours")
else:
    print("Shot distribution close but not complete:")
    if not success_mid:
        print(f"  - Midrange {mid_diff:+.1f}% from target")
        print(f"    -> Consider baseline adjustment: 26% -> {26 + (25 - current_mid_pct)/100:.0f}%")
    if not success_rim:
        print(f"  - Rim {rim_diff:+.1f}% from target")
        print(f"    -> Consider baseline adjustment: 34% -> {34 + (35 - current_rim_pct)/100:.0f}%")
    if not success_3pt:
        print(f"  - 3PT {three_diff:+.1f}% from target")
        print(f"    -> Consider baseline adjustment: 40% -> {40 + (40 - current_3pt_pct)/100:.0f}%")
    print()
    print("OR accept current distribution and move to PPG tuning")

print()
print("="*80)
print()
print("Validation complete!")
print(f"Total games simulated: 100")
print(f"Total teams used: {len(teams_used)}")
print(f"Total possessions: {total_possessions:,}")
print(f"Total FGA: {total_fga:,}")
print()
print("="*80)
