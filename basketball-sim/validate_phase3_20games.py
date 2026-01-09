"""
Phase 3 Validation - 20 Games

Testing the impact of skill-based (versatility-weighted) usage distribution.
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
print("PHASE 3C VALIDATION - 20 GAMES (COMBINED APPROACH)")
print("="*80)
print()
print("Testing COMBINED approach:")
print("  1. Shot creation usage (exponential penalty)")
print("     - Non-creators (Hassan) get less usage than creators (Chris)")
print("  2. Composite bonus reduction (0.008 -> 0.005)")
print("     - ALL players attack rim less frequently when they have ball")
print()
print("Changes:")
print("  - Phase 3b: Shot creation with exponential penalty")
print("  - Phase 3c: Composite bonus reduction (rim +32% -> +20%)")
print()
print("Expected Impact:")
print("  - Hassan gets less ball (usage reduction)")
print("  - Hassan still takes 90% at rim when he has it (realistic)")
print("  - BUT Jerry takes 45% at rim instead of 60% (composite reduction)")
print("  - Combined effect: Rim 45.9% -> 38-42%")
print()

# Show shot creation scores for Team Alpha players
print("TEAM ALPHA SHOT CREATION SCORES (with exponential penalty):")
print("-"*80)
print(f"{'Player':<20} {'Creation':>9} {'Weight':>8} {'Weight%':>9} {'Role':<15}")
print("-"*80)

for player in team_a['players']:
    creation = calculate_shot_creation_ability(player)

    # Apply exponential penalty
    weight = (creation / 100.0) ** 1.5

    role = ""
    if player['name'] in [tactics_alpha.scoring_option_1, tactics_alpha.scoring_option_2, tactics_alpha.scoring_option_3]:
        role = "Scoring Option"
    else:
        role = "Non-Option"

    # Show weight as percentage of creation score to visualize penalty
    weight_pct = (weight / (creation / 100.0)) * 100 if creation > 0 else 0

    print(f"{player['name']:<20} {creation:>9.1f} {weight:>8.3f} {weight_pct:>8.1f}% {role:<15}")

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
print("PHASE 3 RESULTS")
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
print("COMPARISON: BEFORE -> PHASE 1 -> PHASE 2 -> PHASE 3c")
print("="*80)
print()
print(f"{'Shot Type':<12} {'Before P1':>10} {'Phase 1':>10} {'Phase 2':>10} {'Phase 3c':>10} {'NBA Target':>12}")
print("-"*80)

# Historical values
before_phase1 = {'3pt': 37.0, 'midrange': 5.4, 'rim': 57.6}
phase1_results = {'3pt': 39.9, 'midrange': 11.1, 'rim': 49.0}
phase2_results = {'3pt': 41.5, 'midrange': 13.6, 'rim': 44.9}
phase3b_results = {'3pt': 41.4, 'midrange': 12.7, 'rim': 45.9}
nba_targets = {'3pt': 40.0, 'midrange': 25.0, 'rim': 35.0}

for shot_type in ['3pt', 'midrange', 'rim']:
    current_pct = (shot_type_counter[shot_type] / total_fga * 100) if total_fga > 0 else 0
    before = before_phase1[shot_type]
    phase1 = phase1_results[shot_type]
    phase2 = phase2_results[shot_type]
    nba = nba_targets[shot_type]

    print(f"{shot_type:<12} {before:>9.1f}% {phase1:>9.1f}% {phase2:>9.1f}% {current_pct:>9.1f}% {nba:>11.1f}%")

print()
print("="*80)
print("ASSESSMENT")
print("="*80)
print()

# Calculate changes from Phase 3b (last phase)
rim_change = (shot_type_counter['rim'] / total_fga * 100) - phase3b_results['rim']
mid_change = (shot_type_counter['midrange'] / total_fga * 100) - phase3b_results['midrange']
three_change = (shot_type_counter['3pt'] / total_fga * 100) - phase3b_results['3pt']

print(f"Phase 3b -> Phase 3c Changes (combined approach):")
print(f"  Rim:      {phase3b_results['rim']:.1f}% -> {(shot_type_counter['rim'] / total_fga * 100):.1f}% (change: {rim_change:+.1f}%)")
print(f"  Midrange: {phase3b_results['midrange']:.1f}% -> {(shot_type_counter['midrange'] / total_fga * 100):.1f}% (change: {mid_change:+.1f}%)")
print(f"  3PT:      {phase3b_results['3pt']:.1f}% -> {(shot_type_counter['3pt'] / total_fga * 100):.1f}% (change: {three_change:+.1f}%)")
print()

# Also show total impact from Phase 2
rim_change_total = (shot_type_counter['rim'] / total_fga * 100) - phase2_results['rim']
print(f"Total Impact (Phase 2 -> Phase 3c):")
print(f"  Rim:      {phase2_results['rim']:.1f}% -> {(shot_type_counter['rim'] / total_fga * 100):.1f}% (change: {rim_change_total:+.1f}%)")
print()

current_rim_pct = (shot_type_counter['rim'] / total_fga * 100) if total_fga > 0 else 0
current_mid_pct = (shot_type_counter['midrange'] / total_fga * 100) if total_fga > 0 else 0
current_3pt_pct = (shot_type_counter['3pt'] / total_fga * 100) if total_fga > 0 else 0

# Phase 3c impact assessment
if abs(rim_change) > 5:
    print("[OK] MAJOR IMPACT from combined approach!")
elif abs(rim_change) > 3:
    print("[OK] SIGNIFICANT IMPACT from combined approach!")
elif abs(rim_change) > 1:
    print("[INFO] Moderate impact from combined approach")
else:
    print("[WARN] Minimal impact from combined approach")

print()

# Distance from NBA targets
rim_diff = current_rim_pct - nba_targets['rim']
mid_diff = current_mid_pct - nba_targets['midrange']
three_diff = current_3pt_pct - nba_targets['3pt']

print("Distance from NBA Targets:")
print(f"  Rim:      {rim_diff:+.1f}% (target: 35%)")
print(f"  Midrange: {mid_diff:+.1f}% (target: 25%)")
print(f"  3PT:      {three_diff:+.1f}% (target: 40%)")
print()

# Overall assessment
if current_rim_pct <= 38:
    print("[OK] Rim attempts near target! Phases 1+2+3 successful.")
elif current_rim_pct <= 42:
    print("[INFO] Rim attempts improved but still 4-7% high. Consider additional tuning.")
else:
    print("[WARN] Rim attempts still significantly high. Additional phases needed.")

if current_mid_pct >= 20:
    print("[OK] Midrange rate significantly improved!")
elif current_mid_pct >= 15:
    print("[INFO] Midrange improving. Getting closer to target.")
else:
    print("[WARN] Midrange still low. Additional tuning needed.")

if abs(current_3pt_pct - nba_targets['3pt']) <= 3:
    print("[OK] 3PT rate on target!")
else:
    print("[INFO] 3PT rate slightly off target but acceptable.")

print()
print(f"Overall FG%: {overall_fg_pct:.1f}% (Target: 46-50%)")
print(f"Average PPG: {avg_ppg:.1f} (Target: 108-114)")
print()

# Next steps
print("="*80)
print("NEXT STEPS")
print("="*80)
print()

if current_rim_pct <= 38 and current_mid_pct >= 18:
    print("[OK] Phases 1+2+3c achieved near-target distribution!")
    print("  -> Run full 100-game validation to confirm stability")
    print("  -> Move to M4.5 next steps (PPG, FG%, assists tuning)")
elif current_rim_pct <= 42:
    print("[INFO] Phases 1+2+3c made good progress. Close to target.")
    print("  -> Consider more aggressive composite reduction (0.005 -> 0.004)")
    print("  -> Or run 100-game validation if results are acceptable")
else:
    print("[WARN] Phases 1+2+3c still insufficient.")
    print("  -> Reduce composite multiplier further (0.005 -> 0.004 or 0.003)")
    print("  -> May need to address other modifiers (transition, bravery)")

print()
print("="*80)
