"""
Phase 4 Validation - 20 Games

Fine-tuning 3PT/midrange balance with baseline adjustments.
"""

import json
import sys
import os
from collections import Counter

sys.path.insert(0, os.path.dirname(__file__))

from src.systems.game_simulation import GameSimulator
from src.systems.possession import calculate_shot_creation_ability
from src.core.data_structures import TacticalSettings

# Load teams
with open('teams/review/team_specialists_a.json', 'r') as f:
    team_a = json.load(f)

with open('teams/review/team_specialists_b.json', 'r') as f:
    team_b = json.load(f)

# Tactical settings with scoring options
tactics_alpha = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    scoring_option_1='Chris Maestro',
    scoring_option_2='Ray Sniper',
    scoring_option_3='Marcus Slasher',
    minutes_allotment={},
    rebounding_strategy='standard'
)

tactics_beta = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    scoring_option_1='Steve Facilitator',
    scoring_option_2='Reggie Shooter',
    scoring_option_3='Dwyane Slasher',
    minutes_allotment={},
    rebounding_strategy='standard'
)

print("="*80)
print("PHASE 4 VALIDATION - 20 GAMES (BASELINE FINE-TUNING)")
print("="*80)
print()
print("Fine-tuning 3PT/midrange balance:")
print("  - Phase 3c achieved: 3PT 46.3%, Midrange 15.6%, Rim 38.1%")
print("  - 3PT too high (+6.3% from target)")
print("  - Midrange too low (-9.4% from target)")
print()
print("Baseline Adjustments:")
print("  - 3PT:      42% -> 40% (-2%)")
print("  - Midrange: 28% -> 32% (+4%)")
print("  - Rim:      30% -> 28% (-2%)")
print()
print("Expected Impact:")
print("  - 3PT:      46.3% -> 42-44%")
print("  - Midrange: 15.6% -> 20-22%")
print("  - Rim:      38.1% -> 36-38%")
print()
print("="*80)
print()
print("Running 20 games...")
print()

# Track shot types
shot_type_counter = Counter()
shot_outcomes = {'made': 0, 'missed': 0}
shot_outcomes_by_type = {'3pt': {'made': 0, 'missed': 0},
                          'midrange': {'made': 0, 'missed': 0},
                          'rim': {'made': 0, 'missed': 0}}

total_fga = 0
total_points_home = 0
total_points_away = 0

for game_num in range(1, 21):
    if game_num % 5 == 0:
        print(f"Completed {game_num}/20 games...")

    # Run simulation
    game_sim = GameSimulator(
        home_roster=team_a['players'],
        away_roster=team_b['players'],
        tactical_home=tactics_alpha,
        tactical_away=tactics_beta,
        home_team_name=team_a['team_name'],
        away_team_name=team_b['team_name']
    )

    result = game_sim.simulate_game(seed=None)

    total_points_home += result.home_score
    total_points_away += result.away_score

    # Analyze each possession
    for quarter in result.quarter_results:
        for poss in quarter.possession_results:
            if poss.possession_outcome in ['made_shot', 'missed_shot', 'shooting_foul']:
                shot_type = poss.debug.get('shot_type')

                if shot_type:
                    shot_type_counter[shot_type] += 1
                    total_fga += 1

                    # Track makes/misses
                    if poss.possession_outcome == 'made_shot':
                        shot_outcomes['made'] += 1
                        shot_outcomes_by_type[shot_type]['made'] += 1
                    else:
                        shot_outcomes['missed'] += 1
                        shot_outcomes_by_type[shot_type]['missed'] += 1

print()
print("="*80)
print("PHASE 4 RESULTS")
print("="*80)
print()

# Calculate averages
avg_ppg = (total_points_home + total_points_away) / 40  # 20 games * 2 teams
print(f"Average Points Per Game: {avg_ppg:.1f}")
print()

print(f"Total FGA: {total_fga} ({total_fga/20:.1f} per game)")
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

    print(f"{shot_type:<15} {count:>8} {pct:>9.1f}% {made:>6} {attempts:>6} {fg_pct:>6.1f}%")

# Overall FG%
overall_made = shot_outcomes['made']
overall_attempts = shot_outcomes['made'] + shot_outcomes['missed']
overall_fg_pct = (overall_made / overall_attempts * 100) if overall_attempts > 0 else 0

print("-"*80)
print(f"{'OVERALL':<15} {total_fga:>8} {'100.0%':>10} {overall_made:>6} {overall_attempts:>6} {overall_fg_pct:>6.1f}%")
print()

# Comparison to targets
print("="*80)
print("PROGRESSION: BEFORE -> P1 -> P2 -> P3c -> P4")
print("="*80)
print()
print(f"{'Shot Type':<12} {'Before':>8} {'P1':>8} {'P2':>8} {'P3c':>8} {'P4':>8} {'NBA':>8}")
print("-"*80)

# Historical values
before_phase1 = {'3pt': 37.0, 'midrange': 5.4, 'rim': 57.6}
phase1_results = {'3pt': 39.9, 'midrange': 11.1, 'rim': 49.0}
phase2_results = {'3pt': 41.5, 'midrange': 13.6, 'rim': 44.9}
phase3c_results = {'3pt': 46.3, 'midrange': 15.6, 'rim': 38.1}
nba_targets = {'3pt': 40.0, 'midrange': 25.0, 'rim': 35.0}

for shot_type in ['3pt', 'midrange', 'rim']:
    current_pct = (shot_type_counter[shot_type] / total_fga * 100) if total_fga > 0 else 0
    before = before_phase1[shot_type]
    phase1 = phase1_results[shot_type]
    phase2 = phase2_results[shot_type]
    phase3c = phase3c_results[shot_type]
    nba = nba_targets[shot_type]

    print(f"{shot_type:<12} {before:>7.1f}% {phase1:>7.1f}% {phase2:>7.1f}% {phase3c:>7.1f}% {current_pct:>7.1f}% {nba:>7.1f}%")

print()
print("="*80)
print("ASSESSMENT")
print("="*80)
print()

# Calculate changes from Phase 3c
rim_change = (shot_type_counter['rim'] / total_fga * 100) - phase3c_results['rim']
mid_change = (shot_type_counter['midrange'] / total_fga * 100) - phase3c_results['midrange']
three_change = (shot_type_counter['3pt'] / total_fga * 100) - phase3c_results['3pt']

print(f"Phase 3c -> Phase 4 Changes (baseline adjustments):")
print(f"  3PT:      {phase3c_results['3pt']:.1f}% -> {(shot_type_counter['3pt'] / total_fga * 100):.1f}% (change: {three_change:+.1f}%)")
print(f"  Midrange: {phase3c_results['midrange']:.1f}% -> {(shot_type_counter['midrange'] / total_fga * 100):.1f}% (change: {mid_change:+.1f}%)")
print(f"  Rim:      {phase3c_results['rim']:.1f}% -> {(shot_type_counter['rim'] / total_fga * 100):.1f}% (change: {rim_change:+.1f}%)")
print()

current_rim_pct = (shot_type_counter['rim'] / total_fga * 100) if total_fga > 0 else 0
current_mid_pct = (shot_type_counter['midrange'] / total_fga * 100) if total_fga > 0 else 0
current_3pt_pct = (shot_type_counter['3pt'] / total_fga * 100) if total_fga > 0 else 0

# Phase 4 impact assessment
print("Impact Assessment:")
if abs(three_change) > 2:
    print(f"  3PT: Significant change ({three_change:+.1f}%)")
elif abs(three_change) > 1:
    print(f"  3PT: Moderate change ({three_change:+.1f}%)")
else:
    print(f"  3PT: Minimal change ({three_change:+.1f}%)")

if abs(mid_change) > 3:
    print(f"  Midrange: Significant change ({mid_change:+.1f}%)")
elif abs(mid_change) > 1:
    print(f"  Midrange: Moderate change ({mid_change:+.1f}%)")
else:
    print(f"  Midrange: Minimal change ({mid_change:+.1f}%)")

if abs(rim_change) > 2:
    print(f"  Rim: Significant change ({rim_change:+.1f}%) - May need adjustment")
elif abs(rim_change) > 1:
    print(f"  Rim: Moderate change ({rim_change:+.1f}%)")
else:
    print(f"  Rim: Minimal change ({rim_change:+.1f}%) - Stable")

print()

# Distance from NBA targets
rim_diff = current_rim_pct - nba_targets['rim']
mid_diff = current_mid_pct - nba_targets['midrange']
three_diff = current_3pt_pct - nba_targets['3pt']

print("Distance from NBA Targets:")
print(f"  3PT:      {three_diff:+.1f}% (target: 40%)")
print(f"  Midrange: {mid_diff:+.1f}% (target: 25%)")
print(f"  Rim:      {rim_diff:+.1f}% (target: 35%)")
print()

# Overall assessment
if abs(three_diff) <= 3 and abs(mid_diff) <= 5 and abs(rim_diff) <= 3:
    print("[OK] All shot types within acceptable range of NBA targets!")
    print("  -> Ready for 100-game validation")
elif abs(three_diff) <= 5 and abs(mid_diff) <= 8 and abs(rim_diff) <= 5:
    print("[INFO] Shot distribution close to NBA targets")
    print("  -> Consider running 100-game validation or minor adjustments")
else:
    print("[WARN] Shot distribution still needs tuning")
    print("  -> Additional baseline adjustments may be needed")

print()
print(f"Overall FG%: {overall_fg_pct:.1f}% (Target: 46-50%)")
print(f"Average PPG: {avg_ppg:.1f} (Target: 108-114)")
print()

# Next steps
print("="*80)
print("NEXT STEPS")
print("="*80)
print()

if abs(three_diff) <= 3 and abs(mid_diff) <= 5 and abs(rim_diff) <= 3:
    print("[OK] Shot distribution tuning COMPLETE!")
    print("  -> Run 100-game validation to confirm stability")
    print("  -> Move to PPG/FG% tuning (address 93.8 vs 108-114 PPG gap)")
elif abs(mid_diff) > 8:
    print("[INFO] Midrange still needs work")
    print("  -> Consider increasing midrange baseline further (32% -> 34%)")
    print("  -> Or accept current state and move to validation")
elif abs(three_diff) > 5:
    print("[INFO] 3PT needs adjustment")
    print("  -> Consider reducing 3PT baseline further (40% -> 38%)")
else:
    print("[INFO] Distribution acceptable")
    print("  -> Proceed with 100-game validation")
    print("  -> Then address PPG/assists/turnovers")

print()
print("="*80)
