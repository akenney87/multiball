"""
Phase 1 Validation - 20 Games

Quick validation to test the impact of baseline shot distribution changes.
"""

import json
import sys
import os
from collections import Counter

sys.path.insert(0, os.path.dirname(__file__))

from src.systems.game_simulation import GameSimulator
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
print("PHASE 1 VALIDATION - 20 GAMES")
print("="*80)
print()
print("Testing baseline shot distribution changes:")
print("  3PT:      0.40 -> 0.42 (+2%)")
print("  Midrange: 0.20 -> 0.28 (+8%)")
print("  Rim:      0.40 -> 0.30 (-10%)")
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
print("PHASE 1 RESULTS")
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
print("COMPARISON TO NBA TARGETS")
print("="*80)
print()
print(f"{'Shot Type':<15} {'Phase 1':>12} {'NBA Target':>12} {'Before Phase 1':>15} {'Change':>10}")
print("-"*80)

# Previous values from 100-game validation
previous = {'3pt': 37.0, 'midrange': 5.4, 'rim': 57.6}
nba_targets = {'3pt': 40.0, 'midrange': 25.0, 'rim': 35.0}

for shot_type in ['3pt', 'midrange', 'rim']:
    current_pct = (shot_type_counter[shot_type] / total_fga * 100) if total_fga > 0 else 0
    nba_pct = nba_targets[shot_type]
    prev_pct = previous[shot_type]
    change = current_pct - prev_pct

    status = "OK" if abs(current_pct - nba_pct) < 5 else "->" if abs(change) > 2 else "~"
    print(f"{shot_type:<15} {current_pct:>11.1f}% {nba_pct:>11.1f}% {prev_pct:>14.1f}% {change:>+9.1f}% {status}")

print()
print("="*80)
print("ASSESSMENT")
print("="*80)
print()

# Calculate changes
rim_change = (shot_type_counter['rim'] / total_fga * 100) - previous['rim']
mid_change = (shot_type_counter['midrange'] / total_fga * 100) - previous['midrange']
three_change = (shot_type_counter['3pt'] / total_fga * 100) - previous['3pt']

print(f"Rim attempts: {previous['rim']:.1f}% -> {(shot_type_counter['rim'] / total_fga * 100):.1f}% (change: {rim_change:+.1f}%)")
print(f"Midrange:     {previous['midrange']:.1f}% -> {(shot_type_counter['midrange'] / total_fga * 100):.1f}% (change: {mid_change:+.1f}%)")
print(f"3PT:          {previous['3pt']:.1f}% -> {(shot_type_counter['3pt'] / total_fga * 100):.1f}% (change: {three_change:+.1f}%)")
print()

current_rim_pct = (shot_type_counter['rim'] / total_fga * 100) if total_fga > 0 else 0
current_mid_pct = (shot_type_counter['midrange'] / total_fga * 100) if total_fga > 0 else 0

if abs(rim_change) > 5:
    print("[OK] SIGNIFICANT IMPACT on rim attempts!")
else:
    print("[WARN] Modest impact on rim attempts.")

if current_rim_pct > 45:
    print(f"[WARN] Rim attempts still high ({current_rim_pct:.1f}%). Phase 2 may be needed.")
elif current_rim_pct > 38:
    print(f"[INFO] Rim attempts improved ({current_rim_pct:.1f}%). Phase 2-3 may help.")
else:
    print(f"[OK] Rim attempts near target ({current_rim_pct:.1f}%)!")

if current_mid_pct > 15:
    print(f"[OK] Midrange rate significantly improved ({current_mid_pct:.1f}%)!")
else:
    print(f"[WARN] Midrange still low ({current_mid_pct:.1f}%).")

print()
print(f"Overall FG%: {overall_fg_pct:.1f}% (Target: 46-50%)")
print(f"Average PPG: {avg_ppg:.1f} (Target: 108-114)")
print()

# Next steps
print("="*80)
print("NEXT STEPS")
print("="*80)
print()

if current_rim_pct <= 38:
    print("[OK] Phase 1 successful! Rim attempts within 3% of target.")
    print("  --> Run full 100-game validation to confirm stability")
elif current_rim_pct <= 45:
    print("[INFO] Phase 1 made progress. Rim attempts reduced but still high.")
    print("  --> Consider Phase 2 (reduce position bonuses)")
    print("  --> Or run more games to confirm these results")
else:
    print("[WARN] Phase 1 had modest impact. Additional phases needed.")
    print("  --> Proceed to Phase 2 (reduce position bonuses)")
    print("  --> May need Phase 3-4 for full correction")

print()
print("="*80)
