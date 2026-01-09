"""
Shot Distribution Analysis from 100-Game Validation

Analyzes what percentage of shots are 3PT, Midrange, and Rim attempts.
Compares to NBA averages.
"""

import json
import sys
import os
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(__file__))

from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

# Load teams
with open('teams/review/team_specialists_a.json', 'r') as f:
    team_a = json.load(f)

with open('teams/review/team_specialists_b.json', 'r') as f:
    team_b = json.load(f)

# Tactical settings with scoring options (same as validation)
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
print("SHOT DISTRIBUTION ANALYSIS - 100 GAMES")
print("="*80)
print()
print("Running 100 games to analyze shot type distribution...")
print()

# Track shot types
shot_type_counter = Counter()
shot_type_by_team = {'home': Counter(), 'away': Counter()}
shot_outcomes = defaultdict(lambda: {'made': 0, 'missed': 0})

total_possessions = 0
total_fga = 0

for game_num in range(1, 101):
    if game_num % 10 == 0:
        print(f"Analyzed {game_num}/100 games...")

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

    # Analyze each possession
    for quarter in result.quarter_results:
        total_possessions += len(quarter.possession_results)

        for poss in quarter.possession_results:
            # Only count shot attempts (not turnovers, etc.)
            if poss.possession_outcome in ['made_shot', 'missed_shot', 'shooting_foul']:
                shot_type = poss.debug.get('shot_type')

                if shot_type:
                    shot_type_counter[shot_type] += 1
                    shot_type_by_team[poss.offensive_team][shot_type] += 1
                    total_fga += 1

                    # Track makes/misses
                    if poss.possession_outcome == 'made_shot':
                        shot_outcomes[shot_type]['made'] += 1
                    else:
                        shot_outcomes[shot_type]['missed'] += 1

print()
print("Analysis complete!")
print()
print("="*80)
print("SHOT DISTRIBUTION RESULTS")
print("="*80)
print()

# Calculate percentages
print(f"Total Possessions: {total_possessions}")
print(f"Total Field Goal Attempts: {total_fga}")
print()
print("Shot Type Distribution:")
print("-"*80)
print(f"{'Shot Type':<15} {'Count':>8} {'% of FGA':>10} {'FGM':>6} {'FGA':>6} {'FG%':>7}")
print("-"*80)

# Sort by count
for shot_type in ['3pt', 'midrange', 'rim']:
    count = shot_type_counter[shot_type]
    pct = (count / total_fga * 100) if total_fga > 0 else 0
    made = shot_outcomes[shot_type]['made']
    missed = shot_outcomes[shot_type]['missed']
    attempts = made + missed
    fg_pct = (made / attempts * 100) if attempts > 0 else 0

    print(f"{shot_type:<15} {count:>8} {pct:>9.1f}% {made:>6} {attempts:>6} {fg_pct:>6.1f}%")

print()
print("="*80)
print("NBA COMPARISON")
print("="*80)
print()
print(f"{'Shot Type':<15} {'Simulator':>12} {'NBA Target':>12} {'Difference':>12}")
print("-"*80)

# NBA targets (approximate)
nba_targets = {
    '3pt': 40.0,
    'midrange': 25.0,
    'rim': 35.0
}

for shot_type in ['3pt', 'midrange', 'rim']:
    sim_pct = (shot_type_counter[shot_type] / total_fga * 100) if total_fga > 0 else 0
    nba_pct = nba_targets[shot_type]
    diff = sim_pct - nba_pct

    status = "✓" if abs(diff) < 5 else "✗"
    print(f"{shot_type:<15} {sim_pct:>11.1f}% {nba_pct:>11.1f}% {diff:>+11.1f}% {status}")

print()
print("="*80)
print("DETAILED BREAKDOWN")
print("="*80)
print()

# Per-game averages
avg_3pt = shot_type_counter['3pt'] / 100
avg_mid = shot_type_counter['midrange'] / 100
avg_rim = shot_type_counter['rim'] / 100
avg_total = total_fga / 100

print("Per Game Averages:")
print(f"  3PT Attempts: {avg_3pt:.1f}")
print(f"  Midrange Attempts: {avg_mid:.1f}")
print(f"  Rim Attempts: {avg_rim:.1f}")
print(f"  Total FGA: {avg_total:.1f}")
print()

print("FG% by Shot Type:")
for shot_type in ['3pt', 'midrange', 'rim']:
    made = shot_outcomes[shot_type]['made']
    missed = shot_outcomes[shot_type]['missed']
    attempts = made + missed
    fg_pct = (made / attempts * 100) if attempts > 0 else 0
    print(f"  {shot_type.capitalize()}: {fg_pct:.1f}%")

print()
print("="*80)
print("DIAGNOSIS")
print("="*80)
print()

# Diagnose issues
issues = []
sim_3pt_pct = (shot_type_counter['3pt'] / total_fga * 100) if total_fga > 0 else 0
sim_mid_pct = (shot_type_counter['midrange'] / total_fga * 100) if total_fga > 0 else 0
sim_rim_pct = (shot_type_counter['rim'] / total_fga * 100) if total_fga > 0 else 0

if sim_3pt_pct < 35:
    issues.append(f"⚠️  3PT attempts too LOW ({sim_3pt_pct:.1f}% vs 40% NBA)")
elif sim_3pt_pct > 45:
    issues.append(f"⚠️  3PT attempts too HIGH ({sim_3pt_pct:.1f}% vs 40% NBA)")

if sim_mid_pct > 30:
    issues.append(f"⚠️  Midrange attempts too HIGH ({sim_mid_pct:.1f}% vs 25% NBA)")
    issues.append("   → This explains high FG% + low PPG (too many 2-point jumpers)")

if sim_rim_pct < 30:
    issues.append(f"⚠️  Rim attempts too LOW ({sim_rim_pct:.1f}% vs 35% NBA)")
    issues.append("   → Not enough high-percentage rim attempts")

if issues:
    print("Issues Detected:")
    for issue in issues:
        print(issue)
else:
    print("✓ Shot distribution matches NBA targets!")

print()
print("="*80)

# Save results
output_lines = []
output_lines.append("="*80)
output_lines.append("SHOT DISTRIBUTION ANALYSIS - 100 GAMES")
output_lines.append("="*80)
output_lines.append("")
output_lines.append(f"Total Possessions: {total_possessions}")
output_lines.append(f"Total FGA: {total_fga}")
output_lines.append(f"Per Game FGA: {total_fga/100:.1f}")
output_lines.append("")
output_lines.append("Shot Type Distribution:")
output_lines.append("-"*80)

for shot_type in ['3pt', 'midrange', 'rim']:
    count = shot_type_counter[shot_type]
    pct = (count / total_fga * 100) if total_fga > 0 else 0
    made = shot_outcomes[shot_type]['made']
    missed = shot_outcomes[shot_type]['missed']
    attempts = made + missed
    fg_pct = (made / attempts * 100) if attempts > 0 else 0

    output_lines.append(f"{shot_type}: {count} attempts ({pct:.1f}%) - {made}/{attempts} ({fg_pct:.1f}%)")

output_lines.append("")
output_lines.append("NBA Comparison:")
output_lines.append(f"3PT:      Sim {sim_3pt_pct:.1f}% vs NBA 40%  (diff: {sim_3pt_pct-40:+.1f}%)")
output_lines.append(f"Midrange: Sim {sim_mid_pct:.1f}% vs NBA 25%  (diff: {sim_mid_pct-25:+.1f}%)")
output_lines.append(f"Rim:      Sim {sim_rim_pct:.1f}% vs NBA 35%  (diff: {sim_rim_pct-35:+.1f}%)")

with open('output/SHOT_DISTRIBUTION_ANALYSIS.txt', 'w', encoding='utf-8') as f:
    f.write("\n".join(output_lines))

print("Results saved to: output/SHOT_DISTRIBUTION_ANALYSIS.txt")
