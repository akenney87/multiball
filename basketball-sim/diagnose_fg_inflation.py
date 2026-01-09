"""
Comprehensive FG% Diagnostic to identify where inflation is occurring

Tracks:
- FG% by shot type (3PT/mid/rim/dunk/layup)
- FG% by contest level (wide/contested/heavy)
- FG% by offensive vs defensive composite differential
- FG% by stamina level
- FG% with/without rubber-band modifier
"""

import json
import sys
import os
from collections import defaultdict

sys.path.insert(0, os.path.dirname(__file__))

from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

# Load teams
with open('teams/specialized/team_a.json', 'r') as f:
    team_a = json.load(f)

with open('teams/specialized/team_b.json', 'r') as f:
    team_b = json.load(f)

# Tactical settings (standard)
tactics = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    scoring_option_1=None,
    scoring_option_2=None,
    scoring_option_3=None,
    minutes_allotment={},
    rebounding_strategy='standard'
)

# Aggregators
stats = {
    'by_shot_type': defaultdict(lambda: {'attempts': 0, 'makes': 0}),
    'by_contest': defaultdict(lambda: {'attempts': 0, 'makes': 0}),
    'by_attr_diff': defaultdict(lambda: {'attempts': 0, 'makes': 0}),
    'by_stamina': defaultdict(lambda: {'attempts': 0, 'makes': 0}),
    'with_rubber_band': {'attempts': 0, 'makes': 0},
    'without_rubber_band': {'attempts': 0, 'makes': 0},
}

print("=" * 80)
print("FG% INFLATION DIAGNOSTIC - 20 GAMES")
print("=" * 80)
print()

NUM_GAMES = 20

for game_num in range(1, NUM_GAMES + 1):
    game_sim = GameSimulator(
        home_roster=team_a['players'],
        away_roster=team_b['players'],
        tactical_home=tactics,
        tactical_away=tactics,
        home_team_name=team_a['team_name'],
        away_team_name=team_b['team_name']
    )

    result = game_sim.simulate_game(seed=2000 + game_num)

    # Analyze possession results
    for quarter_result in result.quarter_results:
        for poss_result in quarter_result.possession_results:
            # Only analyze shot attempts
            if poss_result.possession_outcome not in ['made_shot', 'missed_shot']:
                continue

            # Skip if foul/and-1 (different mechanics)
            if poss_result.foul_event and poss_result.foul_event.and_one:
                continue

            debug = poss_result.debug
            if 'shot_attempt' not in debug:
                continue

            shot_debug = debug['shot_attempt']
            shot_type = debug.get('shot_type', 'unknown')
            made = poss_result.possession_outcome == 'made_shot'

            # By shot type
            stats['by_shot_type'][shot_type]['attempts'] += 1
            if made:
                stats['by_shot_type'][shot_type]['makes'] += 1

            # By contest level
            contest_distance = shot_debug.get('contest_distance', 999)
            if contest_distance >= 6:
                contest_level = 'wide_open'
            elif contest_distance >= 2:
                contest_level = 'contested'
            else:
                contest_level = 'heavy'

            stats['by_contest'][contest_level]['attempts'] += 1
            if made:
                stats['by_contest'][contest_level]['makes'] += 1

            # By attribute differential
            attr_diff = shot_debug.get('attribute_diff', 0)
            if attr_diff >= 20:
                diff_bucket = '+20_or_more'
            elif attr_diff >= 10:
                diff_bucket = '+10_to_19'
            elif attr_diff >= 0:
                diff_bucket = '+0_to_9'
            elif attr_diff >= -10:
                diff_bucket = '-1_to_-10'
            elif attr_diff >= -20:
                diff_bucket = '-11_to_-20'
            else:
                diff_bucket = '-21_or_less'

            stats['by_attr_diff'][diff_bucket]['attempts'] += 1
            if made:
                stats['by_attr_diff'][diff_bucket]['makes'] += 1

            # By stamina (use shooter's stamina if available)
            # Note: This would require tracking stamina in debug, approximating for now

            # Rubber-band tracking
            rubber_band = shot_debug.get('rubber_band_modifier', 0)
            if rubber_band > 0:
                stats['with_rubber_band']['attempts'] += 1
                if made:
                    stats['with_rubber_band']['makes'] += 1
            else:
                stats['without_rubber_band']['attempts'] += 1
                if made:
                    stats['without_rubber_band']['makes'] += 1

    if game_num % 5 == 0:
        print(f"Completed {game_num}/{NUM_GAMES} games...")

print()
print("=" * 80)
print("FG% BY SHOT TYPE")
print("=" * 80)
print(f"{'Shot Type':<20} {'FGA':<10} {'FGM':<10} {'FG%':<10} {'NBA Target'}")
print("-" * 80)

shot_targets = {
    '3pt': '35-37%',
    'midrange': '38-42%',
    'midrange_short': '40-44%',
    'midrange_long': '35-39%',
    'rim': '60-65%',
    'layup': '55-60%',
    'dunk': '70-75%',
}

for shot_type in sorted(stats['by_shot_type'].keys()):
    data = stats['by_shot_type'][shot_type]
    attempts = data['attempts']
    makes = data['makes']
    pct = (makes / attempts * 100) if attempts > 0 else 0
    target = shot_targets.get(shot_type, 'N/A')

    print(f"{shot_type:<20} {attempts:<10} {makes:<10} {pct:<10.1f} {target}")

print()
print("=" * 80)
print("FG% BY CONTEST LEVEL")
print("=" * 80)
print(f"{'Contest Level':<20} {'FGA':<10} {'FGM':<10} {'FG%':<10} {'Expected Penalty'}")
print("-" * 80)

contest_penalties = {
    'wide_open': '0% penalty',
    'contested': '-15% penalty',
    'heavy': '-25% penalty',
}

for contest in ['wide_open', 'contested', 'heavy']:
    data = stats['by_contest'][contest]
    attempts = data['attempts']
    makes = data['makes']
    pct = (makes / attempts * 100) if attempts > 0 else 0
    penalty = contest_penalties.get(contest, 'N/A')

    print(f"{contest:<20} {attempts:<10} {makes:<10} {pct:<10.1f} {penalty}")

print()
print("=" * 80)
print("FG% BY ATTRIBUTE DIFFERENTIAL")
print("=" * 80)
print(f"{'Attr Diff':<20} {'FGA':<10} {'FGM':<10} {'FG%':<10} {'Notes'}")
print("-" * 80)

for diff_bucket in ['+20_or_more', '+10_to_19', '+0_to_9', '-1_to_-10', '-11_to_-20', '-21_or_less']:
    data = stats['by_attr_diff'][diff_bucket]
    attempts = data['attempts']
    makes = data['makes']
    pct = (makes / attempts * 100) if attempts > 0 else 0

    if diff_bucket == '+20_or_more':
        note = 'Elite offensive mismatch'
    elif diff_bucket == '-21_or_less':
        note = 'Elite defensive mismatch'
    else:
        note = ''

    print(f"{diff_bucket:<20} {attempts:<10} {makes:<10} {pct:<10.1f} {note}")

print()
print("=" * 80)
print("RUBBER-BAND IMPACT")
print("=" * 80)

rb_attempts = stats['with_rubber_band']['attempts']
rb_makes = stats['with_rubber_band']['makes']
rb_pct = (rb_makes / rb_attempts * 100) if rb_attempts > 0 else 0

no_rb_attempts = stats['without_rubber_band']['attempts']
no_rb_makes = stats['without_rubber_band']['makes']
no_rb_pct = (no_rb_makes / no_rb_attempts * 100) if no_rb_attempts > 0 else 0

print(f"Shots WITH rubber-band modifier: {rb_attempts} attempts, {rb_pct:.1f}%")
print(f"Shots WITHOUT rubber-band: {no_rb_attempts} attempts, {no_rb_pct:.1f}%")
print(f"Difference: {rb_pct - no_rb_pct:+.1f} percentage points")

if rb_pct - no_rb_pct > 5:
    print()
    print("ANALYSIS: Rubber-band is significantly inflating FG%")
    print(f"  Impact: +{rb_pct - no_rb_pct:.1f}% on {rb_attempts} shots")
    print(f"  This explains part of the overall FG% inflation")

print()
print("=" * 80)
print("KEY FINDINGS")
print("=" * 80)

# Calculate overall FG%
total_attempts = sum(data['attempts'] for data in stats['by_shot_type'].values())
total_makes = sum(data['makes'] for data in stats['by_shot_type'].values())
overall_pct = (total_makes / total_attempts * 100) if total_attempts > 0 else 0

print(f"Overall FG%: {overall_pct:.1f}% (Target: 46-48%)")
print()

if overall_pct > 50:
    print("CRITICAL INFLATION DETECTED:")
    inflation_points = overall_pct - 47
    print(f"  {inflation_points:.1f} percentage points above target")
    print()

    # Identify biggest contributors
    print("LIKELY CAUSES:")

    # Check if rim shots are too high
    rim_pct = (stats['by_shot_type']['rim']['makes'] / stats['by_shot_type']['rim']['attempts'] * 100) if stats['by_shot_type']['rim']['attempts'] > 0 else 0
    if rim_pct > 62:
        print(f"  1. Rim FG% too high: {rim_pct:.1f}% (target ~60%)")

    # Check if 3PT is too high
    three_pct = (stats['by_shot_type']['3pt']['makes'] / stats['by_shot_type']['3pt']['attempts'] * 100) if stats['by_shot_type']['3pt']['attempts'] > 0 else 0
    if three_pct > 38:
        print(f"  2. 3PT% too high: {three_pct:.1f}% (target 35-37%)")

    # Check rubber-band impact
    if rb_pct - no_rb_pct > 3:
        print(f"  3. Rubber-band inflating: +{rb_pct - no_rb_pct:.1f}% on {rb_attempts}/{total_attempts} shots")

    # Check contest distribution
    wide_pct = stats['by_contest']['wide_open']['attempts'] / total_attempts * 100 if total_attempts > 0 else 0
    if wide_pct > 40:
        print(f"  4. Too many wide-open shots: {wide_pct:.1f}% (may indicate weak defense)")

print()
print("=" * 80)
print("RECOMMENDED FIXES")
print("=" * 80)

fixes = []

if rb_pct - no_rb_pct > 3:
    fixes.append("1. REMOVE or significantly reduce rubber-band modifiers")

if three_pct > 38:
    fixes.append(f"2. Reduce BASE_RATE_3PT (currently 0.23, suggest 0.20-0.21)")

if rim_pct > 62:
    fixes.append(f"3. Reduce rim base rates or increase contest penalties at rim")

contest_heavy_pct = (stats['by_contest']['heavy']['makes'] / stats['by_contest']['heavy']['attempts'] * 100) if stats['by_contest']['heavy']['attempts'] > 0 else 0
if contest_heavy_pct > 40:
    fixes.append(f"4. Increase heavy contest penalty (currently -25%, suggest -30% or -35%)")

if not fixes:
    fixes.append("Inflation is moderate - fine-tune base rates by 1-2%")

for fix in fixes:
    print(f"  {fix}")

print()
print("=" * 80)
print("DIAGNOSTIC COMPLETE")
print("=" * 80)
